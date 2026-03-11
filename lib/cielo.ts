// lib/cielo.ts
// Cielo Finance API — https://developer.cielo.finance
// Darmowy plan: 5000 credits/miesiąc, /feed endpoint (3-5 credits/req)
// API KEY: CIELO_API_KEY w .env.local

const CIELO_BASE = 'https://feed-api.cielo.finance/api/v1'
const cieloCache = new Map<string, { data: unknown; ts: number }>()
const CIELO_TTL = 2 * 60 * 1000 // 2 min

// ━━━ RAW API TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CieloRawSwap {
  wallet: string
  tx_hash: string
  tx_type: 'swap'
  chain: string
  timestamp: number
  dex: string
  from: string
  to: string
  token0_address: string
  token0_amount: number
  token0_amount_usd: number
  token0_price_usd: number
  token0_name: string
  token0_symbol: string
  token0_icon_link: string
  token1_address: string
  token1_amount: number
  token1_amount_usd: number
  token1_price_usd: number
  token1_name: string
  token1_symbol: string
  token1_icon_link: string
  first_interaction: boolean
  is_sell: boolean
}

interface CieloRawTransfer {
  wallet: string
  tx_hash: string
  tx_type: 'transfer'
  chain: string
  timestamp: number
  from: string
  to: string
  amount: number
  amount_usd: number
  contract_address: string
  name: string
  symbol: string
  token_icon_link: string
}

type CieloRawItem = CieloRawSwap | CieloRawTransfer

interface CieloRawResponse {
  status: string
  message?: string
  data: {
    items: CieloRawItem[]
    paging: {
      total_rows_in_page: number
      has_next_page: boolean
      next_cursor?: string
    }
  } | null
}

// ━━━ NORMALIZED TYPE (for UI) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CieloTransaction {
  tx_hash: string
  timestamp: number
  wallet: string
  chain: string
  tx_type: 'swap' | 'transfer' | string
  // Bought token (for swaps: the token received; for transfers: the token transferred)
  token_address: string
  token_symbol: string
  token_name: string
  token_logo: string
  amount_token: number
  amount_usd: number
  price_usd: number
  // Swap-specific
  is_buy: boolean
  first_interaction: boolean
  dex: string
  // Sold token (swap only)
  sold_token_address?: string
  sold_token_symbol?: string
  sold_amount_usd?: number
}

// ━━━ HELPERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizeItem(raw: CieloRawItem): CieloTransaction {
  if (raw.tx_type === 'swap') {
    const swap = raw as CieloRawSwap
    // is_sell=true means token0 is sold, token1 is received
    // is_sell=false means token0 is bought, token1 is sold (SOL)
    const isBuy = !swap.is_sell
    const boughtToken = isBuy
      ? { addr: swap.token0_address, sym: swap.token0_symbol, name: swap.token0_name, logo: swap.token0_icon_link, amount: swap.token0_amount, usd: swap.token0_amount_usd, price: swap.token0_price_usd }
      : { addr: swap.token1_address, sym: swap.token1_symbol, name: swap.token1_name, logo: swap.token1_icon_link, amount: swap.token1_amount, usd: swap.token1_amount_usd, price: swap.token1_price_usd }
    const soldToken = isBuy
      ? { addr: swap.token1_address, sym: swap.token1_symbol, usd: swap.token1_amount_usd }
      : { addr: swap.token0_address, sym: swap.token0_symbol, usd: swap.token0_amount_usd }

    return {
      tx_hash: swap.tx_hash,
      timestamp: swap.timestamp,
      wallet: swap.wallet,
      chain: swap.chain,
      tx_type: 'swap',
      token_address: boughtToken.addr,
      token_symbol: boughtToken.sym,
      token_name: boughtToken.name,
      token_logo: boughtToken.logo,
      amount_token: boughtToken.amount,
      amount_usd: boughtToken.usd,
      price_usd: boughtToken.price,
      is_buy: isBuy,
      first_interaction: swap.first_interaction,
      dex: swap.dex,
      sold_token_address: soldToken.addr,
      sold_token_symbol: soldToken.sym,
      sold_amount_usd: soldToken.usd,
    }
  }

  // Transfer
  const tr = raw as CieloRawTransfer
  return {
    tx_hash: tr.tx_hash,
    timestamp: tr.timestamp,
    wallet: tr.wallet,
    chain: tr.chain,
    tx_type: 'transfer',
    token_address: tr.contract_address,
    token_symbol: tr.symbol,
    token_name: tr.name,
    token_logo: tr.token_icon_link,
    amount_token: tr.amount,
    amount_usd: tr.amount_usd,
    price_usd: 0,
    is_buy: tr.to.toLowerCase() === tr.wallet.toLowerCase(),
    first_interaction: false,
    dex: '',
  }
}

async function cieloFetch(path: string, params?: Record<string, string>): Promise<CieloRawResponse | null> {
  const apiKey = process.env.CIELO_API_KEY
  if (!apiKey) {
    console.warn('[Cielo] No CIELO_API_KEY in .env.local')
    return null
  }

  const url = new URL(`${CIELO_BASE}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const cacheKey = url.toString()
  const cached = cieloCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CIELO_TTL) return cached.data as CieloRawResponse

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      console.warn(`[Cielo] HTTP ${res.status} for ${path}`)
      return null
    }

    const data = await res.json() as CieloRawResponse

    // Handle "pending" status — Cielo needs time to index a new wallet
    if (data.status === 'pending') {
      console.warn('[Cielo] Data pending, wallet being indexed:', data.message)
      return null
    }

    if (data.status !== 'ok') {
      console.warn('[Cielo] API error:', data.message)
      return null
    }

    cieloCache.set(cacheKey, { data, ts: Date.now() })
    return data
  } catch (err) {
    console.error('[Cielo] Error:', err)
    return null
  }
}

// ━━━ FEED — Transakcje walletów ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Pobierz feed transakcji dla jednego walleta (Cielo /feed?wallet=...).
 * Koszt: 3 credits z wallet filter.
 */
async function getWalletFeed(
  wallet: string,
  options?: {
    chains?: string[]
    txTypes?: string[]
    limit?: number
    minUsd?: number
  },
): Promise<CieloTransaction[]> {
  const params: Record<string, string> = {
    wallet,
    limit: String(options?.limit ?? 50),
  }

  if (options?.chains?.length) params.chains = options.chains.join(',')
  if (options?.txTypes?.length) params.txTypes = options.txTypes.join(',')
  if (options?.minUsd) params.minUSD = String(options.minUsd)

  const data = await cieloFetch('/feed', params)
  if (!data?.data?.items) return []

  return data.data.items.map(normalizeItem)
}

/**
 * Pobierz feed dla wielu walletów (sekwencyjnie, 1 request per wallet).
 * Cielo API nie obsługuje wielu walletów w jednym requeście.
 */
export async function getWalletsFeed(
  wallets: string[],
  options?: {
    chains?: string[]
    txTypes?: string[]
    limit?: number
    minUsd?: number
  },
): Promise<CieloTransaction[]> {
  if (wallets.length === 0) return []

  // Fetch per-wallet, max 3 concurrent to avoid rate limit (20 req/s)
  const results: CieloTransaction[] = []
  const batchSize = 3

  for (let i = 0; i < wallets.length; i += batchSize) {
    const batch = wallets.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map(w => getWalletFeed(w, options)),
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(...r.value)
    }
  }

  // Sort by timestamp desc
  results.sort((a, b) => b.timestamp - a.timestamp)
  return results
}

/**
 * Pobierz ogólny feed (bez walleta) — wymaga tracked wallets w Cielo.
 */
export async function getGeneralFeed(
  options?: {
    chains?: string[]
    txTypes?: string[]
    limit?: number
    minUsd?: number
  },
): Promise<CieloTransaction[]> {
  const params: Record<string, string> = {
    limit: String(options?.limit ?? 50),
  }

  if (options?.chains?.length) params.chains = options.chains.join(',')
  if (options?.txTypes?.length) params.txTypes = options.txTypes.join(',')
  if (options?.minUsd) params.minUSD = String(options.minUsd)

  const data = await cieloFetch('/feed', params)
  if (!data?.data?.items) return []

  return data.data.items.map(normalizeItem)
}

// ━━━ SCOUT — Pierwsze interakcje ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Filtruj transakcje z first_interaction: true — wallety kupujące token po raz pierwszy.
 */
export function extractFirstBuyers(transactions: CieloTransaction[]): CieloTransaction[] {
  return transactions.filter(tx => tx.first_interaction && tx.is_buy)
}

/**
 * Znajdź tokeny kupowane po raz pierwszy przez wiele walletów (convergence signal).
 */
export function findConvergenceTokens(
  transactions: CieloTransaction[],
): Array<{
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  firstBuyerCount: number
  totalUsd: number
  wallets: string[]
  latestTx: CieloTransaction
}> {
  const firstBuys = extractFirstBuyers(transactions)

  const tokenMap = new Map<
    string,
    {
      tokenSymbol: string
      tokenName: string
      wallets: Set<string>
      totalUsd: number
      latestTx: CieloTransaction
    }
  >()

  for (const tx of firstBuys) {
    // Skip native SOL
    if (tx.token_address === 'native') continue

    const existing = tokenMap.get(tx.token_address)
    if (existing) {
      existing.wallets.add(tx.wallet)
      existing.totalUsd += tx.amount_usd
      if (tx.timestamp > existing.latestTx.timestamp) {
        existing.latestTx = tx
      }
    } else {
      tokenMap.set(tx.token_address, {
        tokenSymbol: tx.token_symbol,
        tokenName: tx.token_name,
        wallets: new Set([tx.wallet]),
        totalUsd: tx.amount_usd,
        latestTx: tx,
      })
    }
  }

  return Array.from(tokenMap.entries())
    .map(([tokenAddress, data]) => ({
      tokenAddress,
      tokenSymbol: data.tokenSymbol,
      tokenName: data.tokenName,
      firstBuyerCount: data.wallets.size,
      totalUsd: data.totalUsd,
      wallets: Array.from(data.wallets),
      latestTx: data.latestTx,
    }))
    .sort((a, b) => b.firstBuyerCount - a.firstBuyerCount)
}

/**
 * Scout: Pobierz feed walletów i wyodrębnij first-buyer tokeny.
 */
export async function scoutFirstBuyers(
  wallets: string[],
  options?: {
    chains?: string[]
    limit?: number
    minUsd?: number
  },
): Promise<{
  transactions: CieloTransaction[]
  firstBuyers: CieloTransaction[]
  convergence: ReturnType<typeof findConvergenceTokens>
}> {
  const transactions = await getWalletsFeed(wallets, {
    ...options,
    txTypes: ['swap'],
  })

  const firstBuyers = extractFirstBuyers(transactions)
  const convergence = findConvergenceTokens(transactions)

  return { transactions, firstBuyers, convergence }
}
