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
  avgCostUsd: number
  pairCreatedAt: number
  firstBuyEstimate: number
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
  avgEntryUsd: number
  solBalanceUsd: number
  insiderScore: number
  scoreBreakdown: ScoreBreakdown
  walletType: 'HOLDER' | 'TRADER'
  tags: string[]
  labels: string[]
  // Zmiana 1: New Smart Score (0.0 - 1.0)
  smartScore: number
  coverageRatio: number
  // Zmiana 3: Early entry analysis
  earlyEntryRatio: number
  earlyEntryCount: number
  // Zmiana 4: Bot detection
  botRatio: number
  botWarning: boolean
  // Zmiana 7: Weighted win rate
  weightedWinRate: number
  // Zmiana 9: Late entry warning
  lateEntryWarning: boolean
}

export interface TokenAnalyzerResponse {
  wallets: InsiderWallet[]
  processedTokens: number
  totalTokensAnalyzed: number
  totalEarlyBuyers: number
  elapsedMs: number
  errors: string[]
}

// ── Filtering ──────────────────────────────────────────────────────────

const BOT_TAGS = new Set([
  'sandwich', 'sandwich_bot', 'mev', 'bot', 'sniper_bot',
  'copy_trade_bot', 'copy_trader', 'photon', 'bonkbot',
  'trojan', 'banana_gun', 'maestro', 'sol_trading_bot',
  'bundler', 'sniper',
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

// Zmiana 4: Count bot tags per hit, return ratio instead of boolean
function countBotTags(hits: TokenHit[]): number {
  let botTagged = 0
  for (const hit of hits) {
    if (hit.tags.some(t => BOT_TAGS.has(t.toLowerCase()))) botTagged++
  }
  return hits.length > 0 ? botTagged / hits.length : 0
}

function isExchange(trader: GmgnTrader): boolean {
  if (trader.exchange && trader.exchange.length > 0) return true
  if (KNOWN_EXCHANGE_ADDRESSES.has(trader.address)) return true
  return trader.tags.some(t => EXCHANGE_TAGS.has(t.toLowerCase()))
}

// ── Zmiana 2: Dynamic winRate threshold ─────────────────────────────────
function getMinWinRate(tokenCount: number): number {
  if (tokenCount <= 2) return 100
  if (tokenCount <= 4) return 67
  if (tokenCount <= 9) return 60
  return 55
}

// ── Zmiana 7: Temporal decay ────────────────────────────────────────────
function getTimeDecayWeight(createdAtUnix: number): number {
  if (!createdAtUnix || createdAtUnix <= 0) return 0.50
  const ageInDays = (Date.now() / 1000 - createdAtUnix) / 86400
  if (ageInDays <= 7) return 1.00
  if (ageInDays <= 30) return 0.85
  if (ageInDays <= 90) return 0.65
  if (ageInDays <= 180) return 0.40
  return 0.20
}

// ── Wallet type classification ─────────────────────────────────────────

function classifyWalletType(hits: TokenHit[]): 'HOLDER' | 'TRADER' {
  const totalBuys = hits.reduce((s, h) => s + h.buyCount, 0)
  const totalSells = hits.reduce((s, h) => s + h.sellCount, 0)
  const totalTx = totalBuys + totalSells

  let avgHoldHours = 24
  const holdTimes = hits
    .filter(h => h.holdingSince && h.holdingSince > 0)
    .map(h => (Date.now() / 1000 - h.holdingSince!) / 3600)
  if (holdTimes.length > 0) {
    avgHoldHours = holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
  }

  const daysActive = Math.max(avgHoldHours / 24, 1)
  const txPerDay = totalTx / daysActive

  if (txPerDay > 50) return 'TRADER'
  if (avgHoldHours > 4) return 'HOLDER'
  return 'TRADER'
}

// ── InsiderScore (0-100) — kept as secondary metric ─────────────────────

function calculateInsiderScore(
  hits: TokenHit[],
  allTradersByToken: Map<string, GmgnTrader[]>,
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    earlyEntry: 0,
    holdDuration: 0,
    pnlScore: 0,
    consistency: 0,
  }

  if (hits.length === 0) return { score: 0, breakdown }

  // 1. Early Entry (0-30)
  const entryScores: number[] = []
  for (const hit of hits) {
    const allTraders = allTradersByToken.get(hit.mint) ?? []
    if (allTraders.length === 0 || !hit.holdingSince) {
      entryScores.push(0)
      continue
    }

    const sorted = allTraders
      .filter(t => t.startHoldingAt && t.startHoldingAt > 0)
      .sort((a, b) => (a.startHoldingAt ?? 0) - (b.startHoldingAt ?? 0))

    if (sorted.length === 0) {
      entryScores.push(0)
      continue
    }

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

  // 2. Hold Duration (0-35)
  const holdDurations: number[] = []
  for (const hit of hits) {
    if (hit.holdingSince && hit.holdingSince > 0) {
      const holdDays = (Date.now() / 1000 - hit.holdingSince) / 86400
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

  // 3. Realized PnL % (0-25)
  const totalCost = hits.reduce((s, h) => s + h.totalCostUsd, 0)
  const totalRealized = hits.reduce((s, h) => s + h.realizedPnlUsd, 0)
  const pnlPct = totalCost > 0 ? (totalRealized / totalCost) * 100 : 0

  if (pnlPct > 500) breakdown.pnlScore = 25
  else if (pnlPct > 100) breakdown.pnlScore = 15
  else if (pnlPct > 0) breakdown.pnlScore = 8
  else breakdown.pnlScore = 0

  // 4. Consistency (0-10)
  const totalBuys = hits.reduce((s, h) => s + h.buyCount, 0)
  const totalSells = hits.reduce((s, h) => s + h.sellCount, 0)

  if (totalBuys >= 3 && totalSells <= totalBuys * 0.3) {
    breakdown.consistency = 10
  } else if (totalBuys >= 1 && totalSells <= 1) {
    breakdown.consistency = 5
  } else {
    breakdown.consistency = 0
  }

  const score = Math.min(100, breakdown.earlyEntry + breakdown.holdDuration + breakdown.pnlScore + breakdown.consistency)
  return { score, breakdown }
}

// ── Average Entry (weighted) ────────────────────────────────────────

function computeWeightedAvgEntry(hits: TokenHit[]): number {
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
  w: { tokensHit: number; avgEntryMcap: number; totalRealizedPnl: number; totalUnrealizedPnl: number; tokens: TokenHit[]; scoreBreakdown: ScoreBreakdown; earlyEntryRatio: number; botWarning: boolean; lateEntryWarning: boolean }
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

  // Zmiana 3: Early entry badges
  if (w.earlyEntryRatio >= 0.80) labels.push('🎯 EARLY HUNTER')
  else if (w.earlyEntryRatio >= 0.50) labels.push('⚡ EARLY BUYER')

  // Zmiana 4: Bot warning
  if (w.botWarning) labels.push('⚠️ BOT')

  // Zmiana 9: Late entry
  if (w.lateEntryWarning) labels.push('⚠️ PÓŹNE WEJŚCIA')

  return labels
}

// ── Zmiana 1: New Smart Score (0.0 - 1.0) ───────────────────────────────

function calculateSmartScore(
  hits: TokenHit[],
  totalTokensAnalyzed: number,
): number {
  const tokenCount = hits.length
  if (tokenCount === 0) return 0

  // Coverage (0.40)
  const coverageRatio = totalTokensAnalyzed > 0 ? tokenCount / totalTokensAnalyzed : 0

  // PnL weight (0.35)
  const totalPnl = hits.reduce((s, h) => s + h.realizedPnlUsd + h.unrealizedPnlUsd, 0)
  const pnlWeight = totalPnl > 0 ? Math.min(Math.log10(totalPnl + 1) / Math.log10(100000), 1.0) : 0

  // Zmiana 7: Weighted win rate for consistency (0.25)
  let weightedWins = 0
  let weightedTotal = 0
  for (const hit of hits) {
    const weight = getTimeDecayWeight(hit.pairCreatedAt)
    weightedTotal += weight
    if (hit.realizedPnlUsd + hit.unrealizedPnlUsd > 0) weightedWins += weight
  }
  const consistency = weightedTotal > 0 ? weightedWins / weightedTotal : 0

  // Zmiana 3: Early entry bonus (0.15)
  const EARLY_MCAP = 500_000
  let earlyCount = 0
  let entryCount = 0
  for (const hit of hits) {
    if (hit.entryMcapUsd > 0) {
      entryCount++
      if (hit.entryMcapUsd < EARLY_MCAP) earlyCount++
    }
  }
  const earlyEntryRatio = entryCount > 0 ? earlyCount / entryCount : 0
  const earlyBonus = earlyEntryRatio * 0.15

  const baseScore = (coverageRatio * 0.40) + (pnlWeight * 0.35) + (consistency * 0.25)
  return Math.min(Math.round((baseScore + earlyBonus) * 10000) / 10000, 1.0)
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
        // Zmiana 5: Keep exchange filter as-is (different from analyze route)
        if (isExchange(trader)) continue

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

  // Diagnostic: count overlap and balance distribution
  const hitCountDist: Record<number, number> = {}
  let balBelow1k = 0, bal1kTo5k = 0, bal5kTo15k = 0, balAbove15k = 0
  let botFiltered = 0, balFiltered = 0
  for (const [, hits] of walletHits) {
    hitCountDist[hits.length] = (hitCountDist[hits.length] || 0) + 1
  }
  for (const [, lamports] of walletSolBalance) {
    const usd = Math.round((lamports / 1e9) * solPrice)
    if (usd < 1000) balBelow1k++
    else if (usd < 5000) bal1kTo5k++
    else if (usd < 15000) bal5kTo15k++
    else balAbove15k++
  }
  console.log(`[token-analyzer] Wallet overlap: ${JSON.stringify(hitCountDist)}`)
  console.log(`[token-analyzer] SOL balance dist: <$1K:${balBelow1k} $1K-5K:${bal1kTo5k} $5K-15K:${bal5kTo15k} >$15K:${balAbove15k}`)

  for (const [address, hits] of walletHits.entries()) {
    const lamports = walletSolBalance.get(address) ?? 0
    const solBalUsd = Math.round((lamports / 1e9) * solPrice)

    // Portfolio filter: skip only if SOL balance is tiny AND no significant PnL
    // Many meme traders keep minimal SOL — filter by PnL instead
    const totalPnlCheck = hits.reduce((s, h) => s + h.realizedPnlUsd + h.unrealizedPnlUsd, 0)
    if (solBalUsd < 1_000 && totalPnlCheck < 1_000) { balFiltered++; continue }

    // Zmiana 4: Bot filter with ratio
    const botRatio = countBotTags(hits)
    if (botRatio > 0.70) { botFiltered++; continue }
    const botWarning = botRatio > 0.30

    const totalRealized = hits.reduce((s, h) => s + h.realizedPnlUsd, 0)
    const totalUnrealized = hits.reduce((s, h) => s + h.unrealizedPnlUsd, 0)
    const avgEntryMcap = Math.round(hits.reduce((s, h) => s + h.entryMcapUsd, 0) / hits.length)
    const avgEntryUsd = computeWeightedAvgEntry(hits)
    const tags = Array.from(walletTags.get(address) ?? [])
    const walletType = classifyWalletType(hits)

    const { score: insiderScore, breakdown: scoreBreakdown } = calculateInsiderScore(
      hits,
      allTradersByToken,
    )

    // Zmiana 1: New Smart Score
    const smartScore = calculateSmartScore(hits, processedTokens)

    // Zmiana 1: Coverage ratio
    const coverageRatio = processedTokens > 0 ? hits.length / processedTokens : 0

    // Zmiana 3: Early entry analysis
    const EARLY_MCAP = 500_000
    let earlyEntryCount = 0
    let entryCount = 0
    let mcapSum = 0
    for (const hit of hits) {
      if (hit.entryMcapUsd > 0) {
        entryCount++
        mcapSum += hit.entryMcapUsd
        if (hit.entryMcapUsd < EARLY_MCAP) earlyEntryCount++
      }
    }
    const earlyEntryRatio = entryCount > 0 ? earlyEntryCount / entryCount : 0

    // Zmiana 7: Weighted win rate
    let weightedWins = 0
    let weightedTotal = 0
    for (const hit of hits) {
      const weight = getTimeDecayWeight(hit.pairCreatedAt)
      weightedTotal += weight
      if (hit.realizedPnlUsd + hit.unrealizedPnlUsd > 0) weightedWins += weight
    }
    const weightedWinRate = weightedTotal > 0 ? (weightedWins / weightedTotal) * 100 : 0

    // Zmiana 9: Late entry warning
    const totalPnl = totalRealized + totalUnrealized
    const isSmartMoney = totalPnl > 0 &&
      hits.length >= 2 &&
      weightedWinRate >= getMinWinRate(hits.length) &&
      !botWarning
    const lateEntryWarning = isSmartMoney && earlyEntryRatio < 0.30

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
      smartScore,
      coverageRatio,
      earlyEntryRatio,
      earlyEntryCount,
      botRatio,
      botWarning,
      weightedWinRate,
      lateEntryWarning,
    }
    wallet.labels = computeLabels(wallet)
    qualifiedWallets.push(wallet)
  }

  console.log(`[token-analyzer] Filtered: ${balFiltered} by balance, ${botFiltered} by bot. Qualified: ${qualifiedWallets.length}`)

  // Sort by smartScore (primary), insiderScore (secondary)
  qualifiedWallets.sort((a, b) => {
    if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore
    return b.insiderScore - a.insiderScore
  })

  const response: TokenAnalyzerResponse = {
    wallets: qualifiedWallets.slice(0, 50),
    processedTokens,
    totalTokensAnalyzed: processedTokens,
    totalEarlyBuyers: walletHits.size,
    elapsedMs: Date.now() - start,
    errors,
  }

  return NextResponse.json(response)
}
