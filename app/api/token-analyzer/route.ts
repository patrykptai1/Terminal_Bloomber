import { NextRequest, NextResponse } from 'next/server'
import { fetchTopTraders, GmgnTrader } from '@/lib/gmgn'
import { fetchTokenInfoBatch, fetchSolPrice } from '@/lib/dexscreener'
import { TokenInfo } from '@/types'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── Types ──────────────────────────────────────────────────────────────

export interface TokenHit {
  mint: string
  symbol: string
  entryMcapUsd: number
  currentMcapUsd: number
  totalCostUsd: number
  realizedPnlUsd: number
  unrealizedPnlUsd: number
  buyCount: number
  sellCount: number
  tags: string[]
  holdingSince: number | null
  // New fields for Etap 2 scoring
  avgCostUsd: number          // weighted avg buy price per token
  pairCreatedAt: number       // token deploy timestamp (unix sec)
  firstBuyEstimate: number    // estimated first buy timestamp
}

export interface ScoreBreakdown {
  earlyEntry: number    // 0-30
  holdDuration: number  // 0-35
  pnlScore: number      // 0-25
  consistency: number   // 0-10
}

export interface InsiderWallet {
  address: string
  tokensHit: number
  tokens: TokenHit[]
  totalRealizedPnl: number
  totalUnrealizedPnl: number
  avgEntryMcap: number
  avgEntryUsd: number         // weighted average entry price in USD
  solBalanceUsd: number
  insiderScore: number
  scoreBreakdown: ScoreBreakdown
  walletType: 'HOLDER' | 'TRADER'
  tags: string[]
  labels: string[]
}

export interface TokenAnalyzerResponse {
  wallets: InsiderWallet[]
  processedTokens: number
  totalEarlyBuyers: number
  elapsedMs: number
  errors: string[]
}

// ── Filtering ──────────────────────────────────────────────────────────

const BOT_TAGS = new Set([
  'sandwich', 'sandwich_bot', 'mev', 'bot', 'sniper_bot',
  'copy_trade_bot', 'copy_trader', 'photon', 'bonkbot',
  'trojan', 'banana_gun', 'maestro', 'sol_trading_bot',
])

const EXCHANGE_TAGS = new Set([
  'cex', 'binance', 'okx', 'bybit', 'coinbase', 'kraken',
  'kucoin', 'gate', 'htx', 'bitget', 'mexc',
])

const KNOWN_EXCHANGE_ADDRESSES = new Set([
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2',
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm',
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE',
  '5VCwKtCXgCDuQosQfcz2bU7Qvx5WtPBr4tJFBa9JMmp8',
  '4jBaxMoJhW5LBEnMEhBwWqGjUQobHSm3FoF8BALFaKBk',
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5',
  'CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz',
  'BmFdpraQhkiDQE6SnfG5PW2vCFtgSbR1RKmhAzk6HN3B',
  'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w',
])

function isBot(trader: GmgnTrader): boolean {
  if (trader.tags.some(t => BOT_TAGS.has(t.toLowerCase()))) return true
  const totalTx = trader.buyCount + trader.sellCount
  if (totalTx > 50 && trader.startHoldingAt) {
    const now = Date.now() / 1000
    const holdMinutes = (now - trader.startHoldingAt) / 60
    if (holdMinutes < 30 && totalTx > 50) return true
  }
  return false
}

function isExchange(trader: GmgnTrader): boolean {
  if (trader.exchange && trader.exchange.length > 0) return true
  if (KNOWN_EXCHANGE_ADDRESSES.has(trader.address)) return true
  return trader.tags.some(t => EXCHANGE_TAGS.has(t.toLowerCase()))
}

// ── Wallet type classification (refined) ─────────────────────────────

function classifyWalletType(hits: TokenHit[]): 'HOLDER' | 'TRADER' {
  const totalBuys = hits.reduce((s, h) => s + h.buyCount, 0)
  const totalSells = hits.reduce((s, h) => s + h.sellCount, 0)
  const totalTx = totalBuys + totalSells

  // Average hold time in hours
  let avgHoldHours = 24
  const holdTimes = hits
    .filter(h => h.holdingSince && h.holdingSince > 0)
    .map(h => (Date.now() / 1000 - h.holdingSince!) / 3600)
  if (holdTimes.length > 0) {
    avgHoldHours = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
  }

  const daysActive = Math.max(avgHoldHours / 24, 1)
  const txPerDay = totalTx / daysActive

  // TRADER: >50 tx/day
  if (txPerDay > 50) return 'TRADER'
  // HOLDER: average hold > 4h
  if (avgHoldHours > 4) return 'HOLDER'
  return 'TRADER'
}

// ── New Barry-style InsiderScore (0-100) ─────────────────────────────

function calculateInsiderScore(
  hits: TokenHit[],
  allTradersByToken: Map<string, GmgnTrader[]>,
  traderData: Map<string, GmgnTrader>
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    earlyEntry: 0,
    holdDuration: 0,
    pnlScore: 0,
    consistency: 0,
  }

  if (hits.length === 0) return { score: 0, breakdown }

  // ── 1. Early Entry (0-30) ──────────────────────────────────────────
  // For each token, check if this wallet was in the top 5/10/25% of earliest buyers
  const entryScores: number[] = []
  for (const hit of hits) {
    const allTraders = allTradersByToken.get(hit.mint) ?? []
    if (allTraders.length === 0 || !hit.holdingSince) {
      entryScores.push(0)
      continue
    }

    // Sort all traders by their holding start (earliest first)
    const sorted = allTraders
      .filter(t => t.startHoldingAt && t.startHoldingAt > 0)
      .sort((a, b) => (a.startHoldingAt ?? 0) - (b.startHoldingAt ?? 0))

    if (sorted.length === 0) {
      entryScores.push(0)
      continue
    }

    // Find this wallet's position
    const traderInfo = traderData.get(`${hit.mint}:${traderData.keys().next().value?.split(':')[1] ?? ''}`)
    const walletStartHolding = hit.holdingSince ?? 0
    const rank = sorted.findIndex(t => (t.startHoldingAt ?? 0) >= walletStartHolding)
    const percentile = rank >= 0 ? (rank / sorted.length) : 1

    if (percentile <= 0.05) entryScores.push(30)
    else if (percentile <= 0.10) entryScores.push(20)
    else if (percentile <= 0.25) entryScores.push(10)
    else entryScores.push(0)
  }
  breakdown.earlyEntry = entryScores.length > 0
    ? Math.round(entryScores.reduce((a, b) => a + b, 0) / entryScores.length)
    : 0

  // ── 2. Hold Duration (0-35) ────────────────────────────────────────
  const holdDurations: number[] = []
  for (const hit of hits) {
    if (hit.holdingSince && hit.holdingSince > 0) {
      const now = Date.now() / 1000
      const holdDays = (now - hit.holdingSince) / 86400
      holdDurations.push(holdDays)
    }
  }
  if (holdDurations.length > 0) {
    const avgHoldDays = holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length
    if (avgHoldDays > 7) breakdown.holdDuration = 35
    else if (avgHoldDays > 3) breakdown.holdDuration = 25
    else if (avgHoldDays > 1) breakdown.holdDuration = 15
    else breakdown.holdDuration = 5
  } else {
    breakdown.holdDuration = 5
  }

  // ── 3. Realized PnL % (0-25) ──────────────────────────────────────
  const totalCost = hits.reduce((s, h) => s + h.totalCostUsd, 0)
  const totalRealized = hits.reduce((s, h) => s + h.realizedPnlUsd, 0)
  const pnlPct = totalCost > 0 ? (totalRealized / totalCost) * 100 : 0

  if (pnlPct > 500) breakdown.pnlScore = 25
  else if (pnlPct > 100) breakdown.pnlScore = 15
  else if (pnlPct > 0) breakdown.pnlScore = 8
  else breakdown.pnlScore = 0

  // ── 4. Consistency (0-10) ──────────────────────────────────────────
  // DCA without panic selling: multiple buys with holds
  const totalBuys = hits.reduce((s, h) => s + h.buyCount, 0)
  const totalSells = hits.reduce((s, h) => s + h.sellCount, 0)

  if (totalBuys >= 3 && totalSells <= totalBuys * 0.3) {
    // DCA: bought multiple times, sold little → 10
    breakdown.consistency = 10
  } else if (totalBuys >= 1 && totalSells <= 1) {
    // Held without active selling → 5
    breakdown.consistency = 5
  } else {
    // Sold early/often → 0
    breakdown.consistency = 0
  }

  const score = Math.min(100, breakdown.earlyEntry + breakdown.holdDuration + breakdown.pnlScore + breakdown.consistency)
  return { score, breakdown }
}

// ── Average Entry (weighted) ────────────────────────────────────────

function computeWeightedAvgEntry(hits: TokenHit[]): number {
  // avgCostUsd from GMGN is already weighted avg per token
  // Weight by totalCostUsd (how much was invested)
  let totalWeight = 0
  let weightedSum = 0
  for (const hit of hits) {
    if (hit.avgCostUsd > 0 && hit.totalCostUsd > 0) {
      weightedSum += hit.avgCostUsd * hit.totalCostUsd
      totalWeight += hit.totalCostUsd
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

function computeLabels(
  w: { tokensHit: number; avgEntryMcap: number; totalRealizedPnl: number; totalUnrealizedPnl: number; tokens: TokenHit[]; scoreBreakdown: ScoreBreakdown }
): string[] {
  const labels: string[] = []
  const totalPnl = w.totalRealizedPnl + w.totalUnrealizedPnl

  if (w.tokensHit >= 2) labels.push('MULTI-TOKEN')
  if (totalPnl >= 100_000) labels.push('WHALE PROFIT')
  else if (totalPnl >= 10_000) labels.push('HIGH PROFIT')
  else if (totalPnl >= 1_000) labels.push('PROFIT')

  if (w.avgEntryMcap > 0 && w.avgEntryMcap <= 50_000) labels.push('SNIPER')
  else if (w.avgEntryMcap > 0 && w.avgEntryMcap <= 200_000) labels.push('VERY EARLY')
  else if (w.avgEntryMcap > 0 && w.avgEntryMcap <= 500_000) labels.push('EARLY')

  if (w.scoreBreakdown.holdDuration >= 25) labels.push('DIAMOND HANDS')
  if (w.scoreBreakdown.consistency >= 10) labels.push('DCA')

  return labels
}

// ── Main handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now()
  const errors: string[] = []

  let body: { mints: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const mints = (body.mints ?? []).filter(Boolean)
  if (mints.length === 0) {
    return NextResponse.json({ error: 'No mint addresses provided' }, { status: 400 })
  }

  // Step 1: Token info from DexScreener
  const tokenInfoMap = await fetchTokenInfoBatch(mints)
  const solPrice = await fetchSolPrice()

  // Step 2: Fetch traders per token
  const walletHits = new Map<string, TokenHit[]>()
  const walletSolBalance = new Map<string, number>()
  const walletTags = new Map<string, Set<string>>()
  const allTradersByToken = new Map<string, GmgnTrader[]>()
  let processedTokens = 0

  for (const mint of mints) {
    const info = tokenInfoMap.get(mint)
    if (!info) {
      errors.push(`Token ${mint.slice(0, 8)}... nie znaleziony na DexScreener`)
      continue
    }

    const currentPrice = info.priceUsd
    const currentFdv = info.fdv

    if (!currentPrice || currentPrice === 0 || !currentFdv || currentFdv === 0) {
      errors.push(`${info.symbol}: brak danych cenowych`)
      continue
    }

    try {
      const traders = await fetchTopTraders(mint, 200)
      processedTokens++
      allTradersByToken.set(mint, traders)

      for (const trader of traders) {
        if (isBot(trader) || isExchange(trader)) continue

        const avgCost = trader.avgCostUsd
        const mcapAtEntry = (avgCost && avgCost > 0 && currentPrice > 0)
          ? (avgCost / currentPrice) * currentFdv
          : 0

        const hit: TokenHit = {
          mint,
          symbol: info.symbol,
          entryMcapUsd: Math.round(mcapAtEntry),
          currentMcapUsd: Math.round(currentFdv),
          totalCostUsd: Math.round(trader.totalCost),
          realizedPnlUsd: trader.realizedProfit,
          unrealizedPnlUsd: trader.unrealizedProfit,
          buyCount: trader.buyCount,
          sellCount: trader.sellCount,
          tags: trader.tags,
          holdingSince: trader.startHoldingAt,
          avgCostUsd: avgCost,
          pairCreatedAt: info.pairCreatedAt,
          firstBuyEstimate: trader.startHoldingAt ?? 0,
        }

        const existing = walletHits.get(trader.address) ?? []
        existing.push(hit)
        walletHits.set(trader.address, existing)

        const prevBal = walletSolBalance.get(trader.address) ?? 0
        if (trader.nativeBalance > prevBal) {
          walletSolBalance.set(trader.address, trader.nativeBalance)
        }

        const tagSet = walletTags.get(trader.address) ?? new Set()
        trader.tags.forEach(t => tagSet.add(t))
        walletTags.set(trader.address, tagSet)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      errors.push(`${info.symbol}: ${msg}`)
    }

    if (mints.indexOf(mint) < mints.length - 1) {
      await sleep(400)
    }
  }

  // Step 3: Build wallets
  const qualifiedWallets: InsiderWallet[] = []

  // Build a lookup for trader data by "mint:address"
  const traderDataMap = new Map<string, GmgnTrader>()
  for (const [mint, traders] of allTradersByToken) {
    for (const t of traders) {
      traderDataMap.set(`${mint}:${t.address}`, t)
    }
  }

  for (const [address, hits] of walletHits.entries()) {
    const lamports = walletSolBalance.get(address) ?? 0
    const solBalUsd = Math.round((lamports / 1e9) * solPrice)

    if (solBalUsd < 15_000) continue

    const totalRealized = hits.reduce((s, h) => s + h.realizedPnlUsd, 0)
    const totalUnrealized = hits.reduce((s, h) => s + h.unrealizedPnlUsd, 0)
    const avgEntryMcap = Math.round(hits.reduce((s, h) => s + h.entryMcapUsd, 0) / hits.length)
    const avgEntryUsd = computeWeightedAvgEntry(hits)
    const tags = Array.from(walletTags.get(address) ?? [])
    const walletType = classifyWalletType(hits)

    const { score: insiderScore, breakdown: scoreBreakdown } = calculateInsiderScore(
      hits,
      allTradersByToken,
      traderDataMap
    )

    const wallet: InsiderWallet = {
      address,
      tokensHit: hits.length,
      tokens: hits.sort((a, b) => a.entryMcapUsd - b.entryMcapUsd),
      totalRealizedPnl: Math.round(totalRealized),
      totalUnrealizedPnl: Math.round(totalUnrealized),
      avgEntryMcap,
      avgEntryUsd: Math.round(avgEntryUsd * 1e6) / 1e6,
      solBalanceUsd: solBalUsd,
      insiderScore,
      scoreBreakdown,
      walletType,
      tags,
      labels: [],
    }
    wallet.labels = computeLabels(wallet)
    qualifiedWallets.push(wallet)
  }

  qualifiedWallets.sort((a, b) => b.insiderScore - a.insiderScore)

  const response: TokenAnalyzerResponse = {
    wallets: qualifiedWallets.slice(0, 50),
    processedTokens,
    totalEarlyBuyers: walletHits.size,
    elapsedMs: Date.now() - start,
    errors,
  }

  return NextResponse.json(response)
}
