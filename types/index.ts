export interface TokenInfo {
  address: string
  symbol: string
  name: string
  priceUsd: number
  fdv: number             // fully diluted valuation in USD (price × total supply)
  pairAddress: string
  pairCreatedAt: number   // Unix seconds — pool creation time
  totalTxEstimate: number // rough tx count to decide analysis mode
}

export interface WalletTrade {
  solSpent: number
  solReceived: number
  tradeCount: number
  pnlUsd: number
  unrealizedPnlUsd: number       // unrealized portion only (for balance estimate)
  buyCount: number
  sellCount: number
  tags: string[]
  startHoldingAt: number | null  // Unix ts of current/last holding start (from GMGN)
  avgCostUsd: number             // avg cost per token in USD (GMGN avg_cost) — always set for Source A
  nativeBalance: number          // wallet SOL balance in lamports (from GMGN)
}

export interface TokenEntry {
  tokenAddress: string
  tokenSymbol: string
  firstSeenAt: number     // Unix timestamp of first buy (0 = unknown)
  entryPriceUsd: number   // Token price at time of first buy (0 = unknown)
  mcapAtEntryUsd: number  // Market cap at time of first buy (0 = unknown)
}

export interface WalletAnalysis {
  address: string
  appearances: number
  tokens: string[]
  tokenSymbols: string[]
  tokenFirstSeen: (number | null)[]  // parallel to tokens[]
  tokenEntries: TokenEntry[]          // enriched entry data (populated in route.ts)
  totalPnlUsd: number
  totalUnrealizedUsd: number         // sum of unrealized profits across all tokens
  solBalanceLamports: number         // SOL balance from GMGN (lamports)
  solBalanceUsd: number              // solBalanceLamports / 1e9 × solPrice (set in route.ts)
  winRate: number        // weighted win rate (temporal decay applied)
  totalBuyCount: number
  totalSellCount: number
  smartScore: number     // composite: coverage(0.40) + pnl(0.35) + consistency(0.25) + earlyBonus(0.15), capped at 1.0
  isSmartMoney: boolean
  // Bot detection (Zmiana 4)
  botRatio: number       // 0.0-1.0: fraction of token positions with bot tags
  botWarning: boolean    // true when 0.30 < botRatio <= 0.70
  // Early entry analysis (Zmiana 3)
  earlyEntryRatio: number    // 0.0-1.0: fraction of tokens bought at mcap < $500K
  earlyEntryCount: number    // absolute count of early entries
  avgEntryMcap: number       // average mcap at entry in USD
  // Coverage (Zmiana 1)
  coverageRatio: number      // tokenCount / total_tokens_analyzed
  // Late entry warning (Zmiana 9)
  lateEntryWarning: boolean  // true when earlyEntryRatio < 0.30
  // Vybe Network enrichment (populated when VYBE_API_KEY is set)
  vybeName?:   string    // e.g. "Multicoin Capital"
  vybeLabels?: string[]  // e.g. ["VC"] | ["KOL"] | ["CEX"]
}

export interface GraphData {
  nodes: Array<{
    id: string
    type: 'wallet' | 'token'
    label: string
    val: number
    color: string
    pnl?: number
  }>
  links: Array<{ source: string; target: string }>
}

export interface AnalyzeResponse {
  wallets: WalletAnalysis[]
  graphData: GraphData
  processedTokens: number
  stats: {
    totalWallets: number
    smartMoneyCount: number
    elapsedMs: number
  }
}
