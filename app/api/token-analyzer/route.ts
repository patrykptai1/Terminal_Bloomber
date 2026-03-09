import { NextRequest, NextResponse } from 'next/server'
import { fetchTopTraders, GmgnTrader } from '@/lib/gmgn'
import { fetchTokenInfoBatch, fetchSolPrice } from '@/lib/dexscreener'

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
  holdingSince: number | null  // Unix timestamp — start of current/last holding
}

export interface InsiderWallet {
  address: string
  tokensHit: number
  tokens: TokenHit[]
  totalRealizedPnl: number
  totalUnrealizedPnl: number
  winRate: number
  avgEntryMcap: number
  solBalanceUsd: number
  insiderScore: number
  tags: string[]
  labels: string[]  // e.g. ['MULTI-TOKEN', 'HIGH PROFIT', 'EARLY ENTRY', 'SNIPER', 'DIAMOND HANDS']
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

function isBot(trader: GmgnTrader): boolean {
  return trader.tags.some(t => BOT_TAGS.has(t.toLowerCase()))
}

function isExchange(trader: GmgnTrader): boolean {
  if (trader.exchange && trader.exchange.length > 0) return true
  return trader.tags.some(t => EXCHANGE_TAGS.has(t.toLowerCase()))
}

// ── InsiderScore calculation ───────────────────────────────────────────

function calculateInsiderScore(
  tokensHit: number,
  totalTokens: number,
  avgEntryMcap: number,
  winRate: number,
  totalPnl: number,
  solBalanceUsd: number
): number {
  // Weight 1: Token coverage (0-30) — multi-token wallets get big bonus
  const coverageRatio = tokensHit / Math.max(totalTokens, 1)
  const coverageScore = tokensHit >= 2
    ? Math.min(30, coverageRatio * 30 + 10)  // base 10 bonus for multi-token
    : 0

  // Weight 2: Entry quality (0-30) — lower avg entry mcap = better
  const entryScore = avgEntryMcap <= 50_000 ? 30
    : avgEntryMcap <= 100_000 ? 24
    : avgEntryMcap <= 250_000 ? 18
    : avgEntryMcap <= 500_000 ? 12
    : avgEntryMcap <= 1_000_000 ? 6
    : 3

  // Weight 3: Profitability (0-25)
  const pnlLog = totalPnl > 0 ? Math.log10(totalPnl + 1) : 0
  const pnlScore = Math.min(25, pnlLog * 5)

  // Weight 4: Win rate (0-10)
  const winScore = (winRate / 100) * 10

  // Weight 5: Active wallet bonus (0-5)
  const balanceBonus = solBalanceUsd >= 50_000 ? 5
    : solBalanceUsd >= 15_000 ? 3
    : 1

  return Math.min(100, Math.round(coverageScore + entryScore + pnlScore + winScore + balanceBonus))
}

function computeLabels(
  w: { tokensHit: number; avgEntryMcap: number; totalRealizedPnl: number; totalUnrealizedPnl: number; winRate: number; tokens: TokenHit[] }
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

  if (w.winRate >= 80 && w.tokensHit >= 2) labels.push('CONSISTENT')

  // Diamond hands: has sells but held through big gains
  const hasHugeMultiplier = w.tokens.some(t =>
    t.entryMcapUsd > 0 && t.currentMcapUsd / t.entryMcapUsd >= 10 && t.sellCount > 0
  )
  if (hasHugeMultiplier) labels.push('DIAMOND HANDS')

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

  // Step 2: For each token, fetch traders and find early buyers
  // Map: walletAddress → TokenHit[]
  const walletHits = new Map<string, TokenHit[]>()
  const walletSolBalance = new Map<string, number>() // lamports
  const walletTags = new Map<string, Set<string>>()
  let processedTokens = 0

  for (const mint of mints) {
    const info = tokenInfoMap.get(mint)
    if (!info) {
      errors.push(`Token ${mint.slice(0, 8)}... not found on DexScreener`)
      continue
    }

    const currentPrice = info.priceUsd
    const currentFdv = info.fdv

    if (!currentPrice || currentPrice === 0 || !currentFdv || currentFdv === 0) {
      errors.push(`${info.symbol}: no price/FDV data`)
      continue
    }

    try {
      const traders = await fetchTopTraders(mint, 200)
      processedTokens++

      for (const trader of traders) {
        // Filter bots and exchanges
        if (isBot(trader) || isExchange(trader)) continue

        // Estimate mcap at entry: (avgCost / currentPrice) * currentFdv
        const avgCost = trader.avgCostUsd
        const mcapAtEntry = (avgCost && avgCost > 0 && currentPrice > 0)
          ? (avgCost / currentPrice) * currentFdv
          : 0

        // SOL balance — track but don't filter aggressively
        // (profitable insiders often move SOL out after trading)
        const solBal = (trader.nativeBalance / 1e9) * solPrice

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
        }

        const existing = walletHits.get(trader.address) ?? []
        existing.push(hit)
        walletHits.set(trader.address, existing)

        // Track highest SOL balance seen
        const prevBal = walletSolBalance.get(trader.address) ?? 0
        if (trader.nativeBalance > prevBal) {
          walletSolBalance.set(trader.address, trader.nativeBalance)
        }

        // Collect tags
        const tagSet = walletTags.get(trader.address) ?? new Set()
        trader.tags.forEach(t => tagSet.add(t))
        walletTags.set(trader.address, tagSet)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      errors.push(`${info.symbol}: ${msg}`)
    }

    // Rate limit between tokens
    if (mints.indexOf(mint) < mints.length - 1) {
      await sleep(400)
    }
  }

  // Step 3: Build all wallets (no minimum token filter)
  const qualifiedWallets: InsiderWallet[] = []

  for (const [address, hits] of walletHits.entries()) {
    const totalRealized = hits.reduce((s, h) => s + h.realizedPnlUsd, 0)
    const totalUnrealized = hits.reduce((s, h) => s + h.unrealizedPnlUsd, 0)
    const wins = hits.filter(h => h.realizedPnlUsd + h.unrealizedPnlUsd > 0).length
    const winRate = hits.length > 0 ? Math.round((wins / hits.length) * 100) : 0
    const avgEntryMcap = Math.round(hits.reduce((s, h) => s + h.entryMcapUsd, 0) / hits.length)
    const lamports = walletSolBalance.get(address) ?? 0
    const solBalUsd = Math.round((lamports / 1e9) * solPrice)
    const tags = Array.from(walletTags.get(address) ?? [])

    const insiderScore = calculateInsiderScore(
      hits.length,
      processedTokens,
      avgEntryMcap,
      winRate,
      totalRealized + totalUnrealized,
      solBalUsd
    )

    const wallet: InsiderWallet = {
      address,
      tokensHit: hits.length,
      tokens: hits.sort((a, b) => a.entryMcapUsd - b.entryMcapUsd),
      totalRealizedPnl: Math.round(totalRealized),
      totalUnrealizedPnl: Math.round(totalUnrealized),
      winRate,
      avgEntryMcap,
      solBalanceUsd: solBalUsd,
      insiderScore,
      tags,
      labels: [],
    }
    wallet.labels = computeLabels(wallet)
    qualifiedWallets.push(wallet)
  }

  // Sort by InsiderScore desc
  qualifiedWallets.sort((a, b) => b.insiderScore - a.insiderScore)

  const response: TokenAnalyzerResponse = {
    wallets: qualifiedWallets.slice(0, 200),
    processedTokens,
    totalEarlyBuyers: walletHits.size,
    elapsedMs: Date.now() - start,
    errors,
  }

  return NextResponse.json(response)
}
