import { WalletTrade, WalletAnalysis, GraphData, TokenInfo } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedSwapTx = any

/**
 * @deprecated — use GMGN data directly. Kept for potential fallback use.
 */
export function parseSwapTransactions(
  txs: ParsedSwapTx[],
  getPrice: (unixSec: number) => number
): Map<string, WalletTrade> {
  const wallets = new Map<string, WalletTrade>()

  for (const tx of txs) {
    const wallet = tx.feePayer
    if (!wallet) continue
    if (Math.abs(tx.solDelta) < 0.0005) continue

    const historicalPrice = getPrice(tx.blockTime)
    const usdValue = tx.solDelta * historicalPrice   // negative=buy cost, positive=sale revenue

    const existing = wallets.get(wallet) ?? {
      solSpent: 0,
      solReceived: 0,
      tradeCount: 0,
      pnlUsd: 0,
      unrealizedPnlUsd: 0,
      buyCount: 0,
      sellCount: 0,
      tags: [] as string[],
      startHoldingAt: null as number | null,
      avgCostUsd: 0,
      nativeBalance: 0,
    }

    if (tx.solDelta < 0) {
      existing.solSpent    += Math.abs(tx.solDelta)
      existing.pnlUsd      -= Math.abs(usdValue)    // cost (negative)
    } else {
      existing.solReceived += tx.solDelta
      existing.pnlUsd      += usdValue               // revenue (positive)
    }
    existing.tradeCount += 1
    wallets.set(wallet, existing)
  }

  return wallets
}

// ── Zmiana 4: Bot tags ──────────────────────────────────────────────────────
const BOT_TAGS = new Set(['bundler', 'sniper', 'sandwich_bot'])

// ── Zmiana 2: Dynamic winRate threshold ─────────────────────────────────────
function getMinWinRate(tokenCount: number): number {
  if (tokenCount <= 2) return 100   // oba muszą być na plusie
  if (tokenCount <= 4) return 67    // min 2/3 lub 3/4
  if (tokenCount <= 9) return 60    // min 60%
  return 55                          // przy 10+ tokenach próg 55%
}

// ── Zmiana 7: Temporal decay ────────────────────────────────────────────────
function getTimeDecayWeight(createdAtUnix: number | null): number {
  if (!createdAtUnix || createdAtUnix <= 0) return 0.50 // neutral default
  const nowMs = Date.now()
  const ageInDays = (nowMs - createdAtUnix * 1000) / (1000 * 60 * 60 * 24)

  if (ageInDays <= 7) return 1.00
  if (ageInDays <= 30) return 0.85
  if (ageInDays <= 90) return 0.65
  if (ageInDays <= 180) return 0.40
  return 0.20
}

export function aggregateWallets(
  tokenResults: Array<{
    tokenAddress: string
    tokenInfo: TokenInfo
    walletTrades: Map<string, WalletTrade>
  }>,
  totalTokensAnalyzed: number,
): WalletAnalysis[] {
  const walletMap = new Map<
    string,
    {
      appearances: number
      tokens: string[]
      tokenSymbols: string[]
      tokenFirstSeen: (number | null)[]
      tokenCreatedAts: (number | null)[]  // pairCreatedAt per token (for temporal decay)
      tokenPnls: number[]                 // pnl per token position (for weighted winRate)
      totalPnlUsd: number
      totalUnrealizedUsd: number
      maxNativeBalance: number
      totalBuyCount: number
      totalSellCount: number
      tokenTags: string[][]
    }
  >()

  for (const { tokenAddress, tokenInfo, walletTrades } of tokenResults) {
    for (const [walletAddr, trade] of walletTrades) {
      const existing = walletMap.get(walletAddr) ?? {
        appearances: 0,
        tokens: [],
        tokenSymbols: [],
        tokenFirstSeen: [],
        tokenCreatedAts: [],
        tokenPnls: [],
        totalPnlUsd: 0,
        totalUnrealizedUsd: 0,
        maxNativeBalance: 0,
        totalBuyCount: 0,
        totalSellCount: 0,
        tokenTags: [],
      }
      existing.appearances += 1
      if (!existing.tokens.includes(tokenAddress)) {
        existing.tokens.push(tokenAddress)
        existing.tokenSymbols.push(tokenInfo.symbol)
        existing.tokenFirstSeen.push(trade.startHoldingAt ?? null)
        existing.tokenCreatedAts.push(tokenInfo.pairCreatedAt ?? null)
        existing.tokenPnls.push(trade.pnlUsd)
      }
      existing.totalPnlUsd += trade.pnlUsd
      existing.totalUnrealizedUsd += trade.unrealizedPnlUsd ?? 0
      if (trade.nativeBalance > existing.maxNativeBalance) existing.maxNativeBalance = trade.nativeBalance
      existing.totalBuyCount += trade.buyCount
      existing.totalSellCount += trade.sellCount
      existing.tokenTags.push(trade.tags)
      walletMap.set(walletAddr, existing)
    }
  }

  const wallets: WalletAnalysis[] = []
  for (const [address, data] of walletMap) {
    const tokenCount = data.tokens.length

    // ── Zmiana 4: Bot filter with botRatio ──────────────────────────────────
    let botTaggedCount = 0
    for (const tags of data.tokenTags) {
      if (tags.some(t => BOT_TAGS.has(t))) botTaggedCount++
    }
    const botRatio = data.tokenTags.length > 0 ? botTaggedCount / data.tokenTags.length : 0

    // botRatio > 0.70 → reject entirely
    if (botRatio > 0.70) continue

    const botWarning = botRatio > 0.30 // 0.30 < botRatio <= 0.70

    // ── Zmiana 7: Temporal decay weighted winRate ────────────────────────────
    let weightedWins = 0
    let weightedTotal = 0
    for (let i = 0; i < tokenCount; i++) {
      const weight = getTimeDecayWeight(data.tokenCreatedAts[i])
      weightedTotal += weight
      if (data.tokenPnls[i] > 0) weightedWins += weight
    }
    const winRate = weightedTotal > 0 ? (weightedWins / weightedTotal) * 100 : 0

    // ── Zmiana 2: Dynamic winRate threshold ─────────────────────────────────
    // ── Zmiana 1: Coverage ratio ────────────────────────────────────────────
    const coverageRatio = totalTokensAnalyzed > 0 ? tokenCount / totalTokensAnalyzed : 0

    // ── Zmiana 1: New Smart Score (computed without early bonus — added later in route.ts)
    const isSmartMoney =
      data.totalPnlUsd > 0 &&
      tokenCount >= 2 &&
      winRate >= getMinWinRate(tokenCount) &&
      data.totalBuyCount >= 1 &&
      data.totalSellCount >= 1

    // Base smart score: coverage(0.40) + pnl(0.35) + consistency(0.25)
    let smartScore = 0
    if (isSmartMoney) {
      const pnlWeight = Math.min(Math.log10(data.totalPnlUsd + 1) / Math.log10(100000), 1.0)
      const consistency = winRate / 100
      smartScore = (coverageRatio * 0.40) + (pnlWeight * 0.35) + (consistency * 0.25)
    }

    wallets.push({
      address,
      appearances: data.appearances,
      tokens: data.tokens,
      tokenSymbols: data.tokenSymbols,
      tokenFirstSeen: data.tokenFirstSeen,
      tokenEntries: [],   // populated in route.ts after price history fetch
      totalPnlUsd: data.totalPnlUsd,
      totalUnrealizedUsd: data.totalUnrealizedUsd,
      solBalanceLamports: data.maxNativeBalance,
      solBalanceUsd: 0,   // populated in route.ts after solPrice fetch
      winRate,
      totalBuyCount: data.totalBuyCount,
      totalSellCount: data.totalSellCount,
      smartScore,
      isSmartMoney,
      // Zmiana 4
      botRatio,
      botWarning,
      // Zmiana 3 — defaults, populated in route.ts after Phase 4
      earlyEntryRatio: 0,
      earlyEntryCount: 0,
      avgEntryMcap: 0,
      // Zmiana 1
      coverageRatio,
      // Zmiana 9
      lateEntryWarning: false,
    })
  }

  wallets.sort((a, b) => {
    if (a.isSmartMoney !== b.isSmartMoney) return a.isSmartMoney ? -1 : 1
    if (a.isSmartMoney) return b.smartScore - a.smartScore
    return b.totalPnlUsd - a.totalPnlUsd
  })

  return wallets
}

export function buildGraphData(
  wallets: WalletAnalysis[],
  tokenInfos: Map<string, TokenInfo>
): GraphData {
  const nodes: GraphData['nodes'] = []
  const links: GraphData['links'] = []
  const addedTokens = new Set<string>()

  for (const [addr, info] of tokenInfos) {
    addedTokens.add(addr)
    nodes.push({
      id: addr,
      type: 'token',
      label: info.symbol,
      val: 8,
      color: '#3b82f6',
    })
  }

  const topWallets = wallets.slice(0, 200)
  for (const wallet of topWallets) {
    nodes.push({
      id: wallet.address,
      type: 'wallet',
      label: `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`,
      val: wallet.isSmartMoney ? 6 : 3,
      color: wallet.isSmartMoney ? '#ff6b2b' : '#6b7280',
      pnl: wallet.totalPnlUsd,
    })

    for (const tokenAddr of wallet.tokens) {
      if (addedTokens.has(tokenAddr)) {
        links.push({ source: wallet.address, target: tokenAddr })
      }
    }
  }

  return { nodes, links }
}
