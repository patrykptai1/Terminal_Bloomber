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
  holdingSince: number | null
}

export interface InsiderWallet {
  address: string
  tokensHit: number
  tokens: TokenHit[]
  totalRealizedPnl: number
  totalUnrealizedPnl: number
  avgEntryMcap: number
  solBalanceUsd: number
  insiderScore: number
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

// Known exchange hot wallet addresses (Solana)
const KNOWN_EXCHANGE_ADDRESSES = new Set([
  // Binance
  '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2',
  // Coinbase
  '2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm',
  'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
  'GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE',
  // OKX
  '5VCwKtCXgCDuQosQfcz2bU7Qvx5WtPBr4tJFBa9JMmp8',
  '4jBaxMoJhW5LBEnMEhBwWqGjUQobHSm3FoF8BALFaKBk',
  // Bybit
  'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2',
  // Kraken
  'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5',
  'CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz',
  // KuCoin
  'BmFdpraQhkiDQE6SnfG5PW2vCFtgSbR1RKmhAzk6HN3B',
  // Gate.io
  'u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w',
])

function isBot(trader: GmgnTrader): boolean {
  if (trader.tags.some(t => BOT_TAGS.has(t.toLowerCase()))) return true
  // Heuristic: >50 total trades AND very short hold → bot pattern
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

// ── Wallet type classification ────────────────────────────────────────

function classifyWalletType(hits: TokenHit[]): 'HOLDER' | 'TRADER' {
  const totalBuys = hits.reduce((s, h) => s + h.buyCount, 0)
  const totalSells = hits.reduce((s, h) => s + h.sellCount, 0)
  const totalTx = totalBuys + totalSells

  // Estimate days active from holdingSince
  let avgHoldHours = 24 // default
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

// ── InsiderScore calculation ───────────────────────────────────────────

function calculateInsiderScore(
  tokensHit: number,
  totalTokens: number,
  avgEntryMcap: number,
  totalPnl: number,
  solBalanceUsd: number
): number {
  // Weight 1: Token coverage (0-30)
  const coverageRatio = tokensHit / Math.max(totalTokens, 1)
  const coverageScore = tokensHit >= 2
    ? Math.min(30, coverageRatio * 30 + 10)
    : 0

  // Weight 2: Entry quality (0-30)
  const entryScore = avgEntryMcap <= 50_000 ? 30
    : avgEntryMcap <= 100_000 ? 24
    : avgEntryMcap <= 250_000 ? 18
    : avgEntryMcap <= 500_000 ? 12
    : avgEntryMcap <= 1_000_000 ? 6
    : 3

  // Weight 3: Profitability (0-30)
  const pnlLog = totalPnl > 0 ? Math.log10(totalPnl + 1) : 0
  const pnlScore = Math.min(30, pnlLog * 6)

  // Weight 4: Active wallet bonus (0-10)
  const balanceBonus = solBalanceUsd >= 50_000 ? 10
    : solBalanceUsd >= 25_000 ? 7
    : solBalanceUsd >= 15_000 ? 5
    : 2

  return Math.min(100, Math.round(coverageScore + entryScore + pnlScore + balanceBonus))
}

function computeLabels(
  w: { tokensHit: number; avgEntryMcap: number; totalRealizedPnl: number; totalUnrealizedPnl: number; tokens: TokenHit[] }
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

  // Step 2: For each token, fetch traders
  const walletHits = new Map<string, TokenHit[]>()
  const walletSolBalance = new Map<string, number>()
  const walletTags = new Map<string, Set<string>>()
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

  // Step 3: Build wallets, filter by balance >= $15K
  const qualifiedWallets: InsiderWallet[] = []

  for (const [address, hits] of walletHits.entries()) {
    const lamports = walletSolBalance.get(address) ?? 0
    const solBalUsd = Math.round((lamports / 1e9) * solPrice)

    // Filter: exclude wallets with balance < $15K
    if (solBalUsd < 15_000) continue

    const totalRealized = hits.reduce((s, h) => s + h.realizedPnlUsd, 0)
    const totalUnrealized = hits.reduce((s, h) => s + h.unrealizedPnlUsd, 0)
    const avgEntryMcap = Math.round(hits.reduce((s, h) => s + h.entryMcapUsd, 0) / hits.length)
    const tags = Array.from(walletTags.get(address) ?? [])
    const walletType = classifyWalletType(hits)

    const insiderScore = calculateInsiderScore(
      hits.length,
      processedTokens,
      avgEntryMcap,
      totalRealized + totalUnrealized,
      solBalUsd
    )

    const wallet: InsiderWallet = {
      address,
      tokensHit: hits.length,
      tokens: hits.sort((a, b) => a.entryMcapUsd - b.entryMcapUsd),
      totalRealizedPnl: Math.round(totalRealized),
      totalUnrealizedPnl: Math.round(totalUnrealized),
      avgEntryMcap,
      solBalanceUsd: solBalUsd,
      insiderScore,
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
