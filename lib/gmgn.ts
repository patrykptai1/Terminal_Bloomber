import { exec } from 'child_process'
import { promisify } from 'util'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const execAsync = promisify(exec)

// GMGN.ai blocks standard Node.js fetch (TLS fingerprint detection).
// curl with --tlsv1.3 passes Cloudflare — we use it as a subprocess.
const CURL_FLAGS = [
  '--silent',
  '--compressed',
  '--tlsv1.3',
  '--max-time 15',
  `-H 'accept: application/json, text/plain, */*'`,
  `-H 'accept-encoding: gzip, deflate, br'`,
  `-H 'accept-language: en-US,en;q=0.9'`,
  `-H 'referer: https://gmgn.ai/'`,
  `-H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'`,
].join(' ')

export async function gmgnGet(url: string): Promise<Record<string, unknown>> {
  const { stdout } = await execAsync(`curl ${CURL_FLAGS} '${url}'`, { timeout: 20000 })
  return JSON.parse(stdout)
}

export interface GmgnTrader {
  address: string
  realizedProfit: number    // USD — all-time realized gain/loss
  unrealizedProfit: number  // USD — current unrealized
  totalCost: number         // USD — total spent buying
  profitMultiplier: number  // e.g. 57888 means 57888x
  buyCount: number
  sellCount: number
  tags: string[]            // e.g. ['whale', 'smart_degen']
  startHoldingAt: number | null  // Unix ts of current/last holding start (NOT always first buy)
  avgCostUsd: number        // avg cost per token in USD across all buys — reliable entry price
  exchange: string          // non-empty = known CEX wallet (e.g. 'binance', 'okx')
  nativeBalance: number     // wallet SOL balance in lamports
}

/**
 * Fetch top traders for a Solana token from GMGN.
 * Returns up to `limit` traders sorted by realized profit (desc).
 * Uses all-time data — not limited to recent transactions.
 */
export async function fetchTopTraders(
  tokenAddress: string,
  limit = 100
): Promise<GmgnTrader[]> {
  try {
    const url =
      `https://gmgn.ai/vas/api/v1/token_traders/sol/${tokenAddress}` +
      `?orderby=realized_profit&direction=desc&limit=${limit}`

    const data = await gmgnGet(url)
    if (data.code !== 0) {
      console.warn(`[gmgn] non-zero code for ${tokenAddress}:`, data.code)
      return []
    }

    const list = (data.data as Record<string, unknown>)?.list as Record<string, unknown>[] ?? []

    return list.map(t => ({
      address: t.address as string,
      realizedProfit: (t.realized_profit as number) ?? 0,
      unrealizedProfit: (t.unrealized_profit as number) ?? 0,
      totalCost: (t.total_cost as number) ?? 0,
      profitMultiplier: (t.profit_change as number) ?? 0,
      buyCount: (t.buy_tx_count_cur as number) ?? 0,
      sellCount: (t.sell_tx_count_cur as number) ?? 0,
      tags: [
        ...((t.tags as string[]) ?? []),
        ...((t.maker_token_tags as string[]) ?? []),
      ],
      startHoldingAt: (t.start_holding_at as number) ?? null,
      avgCostUsd: (t.avg_cost as number) ?? 0,
      exchange: (t.exchange as string) ?? '',
      nativeBalance: Number(t.native_balance ?? 0) || 0,
    }))
  } catch (e) {
    console.error('[gmgn] fetchTopTraders error:', e)
    return []
  }
}

export interface GmgnHolder {
  owner: string
  realizedProfit: number
  unrealizedProfit: number
  tags: string[]
  startHoldingAt: number | null  // Unix ts of current holding start (from start_holding_at)
  nativeBalance: number          // wallet SOL balance in lamports
}

/**
 * Fetch current top holders for a Solana token from GMGN.
 * Holders include PnL data — better than Helius which only returned addresses.
 */
export async function fetchTokenHolders(
  tokenAddress: string,
  limit = 100
): Promise<GmgnHolder[]> {
  try {
    const url =
      `https://gmgn.ai/vas/api/v1/token_holders/sol/${tokenAddress}` +
      `?orderby=amount_percentage&direction=desc&limit=${limit}`

    const data = await gmgnGet(url)
    if (data.code !== 0) return []

    const list = (data.data as Record<string, unknown>)?.list as Record<string, unknown>[] ?? []
    return list.map(h => ({
      owner: h.address as string,
      realizedProfit: (h.realized_profit as number) ?? 0,
      unrealizedProfit: (h.unrealized_profit as number) ?? 0,
      tags: [
        ...((h.tags as string[]) ?? []),
        ...((h.maker_token_tags as string[]) ?? []),
      ],
      startHoldingAt: (h.start_holding_at as number) ?? null,
      nativeBalance: Number(h.native_balance ?? 0) || 0,
    }))
  } catch (e) {
    console.error('[gmgn] fetchTokenHolders error:', e)
    return []
  }
}

export interface GmgnWalletTrade {
  realizedProfit: number
  unrealizedProfit: number
  tradeCount: number
}

/**
 * Scan recent token trades for specific seed wallets.
 * Paginates up to maxPages × 50 trades per token.
 * Returns a map of { walletAddress → trade data } for found wallets.
 */
export async function findSeedWalletsInTrades(
  tokenAddress: string,
  seedWallets: Set<string>,
  maxPages = 8
): Promise<Map<string, GmgnWalletTrade>> {
  const found = new Map<string, GmgnWalletTrade>()
  if (seedWallets.size === 0) return found

  let cursor: string | null = null

  for (let page = 0; page < maxPages; page++) {
    try {
      const url = cursor
        ? `https://gmgn.ai/vas/api/v1/token_trades/sol/${tokenAddress}?limit=50&cursor=${cursor}`
        : `https://gmgn.ai/vas/api/v1/token_trades/sol/${tokenAddress}?limit=50`

      const data = await gmgnGet(url)
      const history = ((data.data as Record<string, unknown>)?.history as Record<string, unknown>[]) ?? []
      cursor = ((data.data as Record<string, unknown>)?.next as string) ?? null

      for (const trade of history) {
        const maker = trade.maker as string
        if (seedWallets.has(maker) && !found.has(maker)) {
          found.set(maker, {
            realizedProfit: parseFloat(String(trade.realized_profit ?? 0)) || 0,
            unrealizedProfit: parseFloat(String(trade.unrealized_profit ?? 0)) || 0,
            tradeCount: (trade.total_trade as number) ?? 1,
          })
        }
      }

      if (!cursor || found.size === seedWallets.size) break
      await sleep(300)
    } catch (e) {
      console.error('[gmgn] findSeedWalletsInTrades error:', e)
      break
    }
  }

  return found
}

/**
 * Fetch daily OHLCV price history for a token from GMGN.
 * Uses the kline endpoint which covers data back to ~Feb 2024.
 * Returns a map of dayBucket (unix / 86400) → close price USD.
 */
export interface GmgnTrade {
  timestamp: number
  type: 'buy' | 'sell'
  tokenAmount: number
  quoteAmount: number   // SOL amount
  priceUsd: number
  costUsd: number
  txHash: string
  mcapUsd: number
}

/**
 * Fetch individual trades for a specific wallet on a specific token.
 * Uses token_trades endpoint with maker filter.
 */
export async function fetchWalletTokenTrades(
  tokenAddress: string,
  walletAddress: string,
  limit = 100
): Promise<GmgnTrade[]> {
  const trades: GmgnTrade[] = []
  let cursor: string | null = null
  const maxPages = Math.ceil(limit / 50)

  for (let page = 0; page < maxPages; page++) {
    try {
      let url = `https://gmgn.ai/vas/api/v1/token_trades/sol/${tokenAddress}?limit=50&maker=${walletAddress}`
      if (cursor) url += `&cursor=${cursor}`

      const data = await gmgnGet(url)
      const history = ((data.data as Record<string, unknown>)?.history as Record<string, unknown>[]) ?? []
      cursor = ((data.data as Record<string, unknown>)?.next as string) ?? null

      for (const t of history) {
        const event = (t.event as string) ?? ''
        const isBuy = event === 'buy'
        trades.push({
          timestamp: (t.timestamp as number) ?? 0,
          type: isBuy ? 'buy' : 'sell',
          tokenAmount: parseFloat(String(t.token_amount ?? 0)) || 0,
          quoteAmount: parseFloat(String(t.quote_amount ?? 0)) || 0,
          priceUsd: parseFloat(String(t.price_usd ?? 0)) || 0,
          costUsd: parseFloat(String(t.cost_usd ?? 0)) || 0,
          txHash: (t.tx_hash as string) ?? '',
          mcapUsd: parseFloat(String(t.market_cap ?? t.fdv ?? 0)) || 0,
        })
      }

      if (!cursor || history.length < 50) break
      await sleep(300)
    } catch (e) {
      console.error('[gmgn] fetchWalletTokenTrades error:', e)
      break
    }
  }

  return trades.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Fetch daily OHLCV price history for a token from GMGN.
 * Uses the kline endpoint which covers data back to ~Feb 2024.
 * Returns a map of dayBucket (unix / 86400) → close price USD.
 */
export async function fetchTokenPriceHistory(
  tokenAddress: string,
  fromTs: number,
  toTs: number
): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  try {
    const url =
      `https://gmgn.ai/api/v1/token_kline/sol/${tokenAddress}` +
      `?resolution=1d&from=${fromTs}&to=${toTs}`

    const data = await gmgnGet(url)
    const list = (data.data as Record<string, unknown>)?.list as Record<string, unknown>[] ?? []

    for (const candle of list) {
      const ts = Math.floor((candle.time as number) / 1000)
      const close = parseFloat(candle.close as string)
      if (ts > 0 && close > 0) {
        result.set(Math.floor(ts / 86400), close)
      }
    }
  } catch (e) {
    console.error('[gmgn] fetchTokenPriceHistory error:', e)
  }
  return result
}

/**
 * Find the close price for a given Unix timestamp.
 * Looks for exact day match, then nearest day within 3 days.
 */
export function lookupPrice(history: Map<number, number>, timestamp: number): number {
  if (!history.size || !timestamp) return 0
  const target = Math.floor(timestamp / 86400)
  if (history.has(target)) return history.get(target)!

  let bestPrice = 0
  let bestDist = Infinity
  for (const [bucket, price] of history) {
    const dist = Math.abs(bucket - target)
    if (dist < bestDist) { bestDist = dist; bestPrice = price }
  }
  return bestDist <= 3 ? bestPrice : 0
}
