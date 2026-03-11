// lib/cielo.ts
// Cielo Finance API — https://docs.cielo.finance
// Darmowy plan: 5000 credits/miesiąc, endpoint /feed
// API KEY: CIELO_API_KEY w .env.local

const CIELO_BASE = 'https://feed-api.cielo.finance/v1'
const cieloCache = new Map<string, { data: unknown; ts: number }>()
const CIELO_TTL = 2 * 60 * 1000 // 2 min

// ━━━ TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CieloTransaction {
  tx_hash: string
  timestamp: number
  wallet: string
  token_address: string
  token_symbol: string
  token_name: string
  action: 'buy' | 'sell' | 'swap' | string
  amount_token: number
  amount_usd: number
  price_usd: number
  chain: string
  first_interaction: boolean
  // Additional fields from API
  token_logo?: string
  dex?: string
  pair_address?: string
}

export interface CieloFeedResponse {
  items: CieloTransaction[]
  has_more: boolean
  total: number
}

// ━━━ HELPERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function cieloFetch<T>(path: string, params?: Record<string, string>): Promise<T | null> {
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
  if (cached && Date.now() - cached.ts < CIELO_TTL) return cached.data as T

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

    const data = await res.json() as T
    cieloCache.set(cacheKey, { data, ts: Date.now() })
    return data
  } catch (err) {
    console.error('[Cielo] Error:', err)
    return null
  }
}

// ━━━ FEED — Transakcje walletów ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Pobierz feed transakcji dla listy walletów.
 * Darmowy plan: tylko /feed endpoint.
 */
export async function getWalletsFeed(
  wallets: string[],
  options?: {
    chains?: string[]
    actions?: string[]
    limit?: number
    minUsd?: number
  },
): Promise<CieloTransaction[]> {
  if (wallets.length === 0) return []

  const params: Record<string, string> = {
    wallets: wallets.join(','),
    limit: String(options?.limit ?? 50),
  }

  if (options?.chains?.length) params.chains = options.chains.join(',')
  if (options?.actions?.length) params.actions = options.actions.join(',')
  if (options?.minUsd) params.min_usd = String(options.minUsd)

  const data = await cieloFetch<CieloFeedResponse>('/feed', params)
  if (!data?.items) return []

  return data.items
}

/**
 * Pobierz ogólny feed (bez filtrowania po walletach) — trending transactions.
 */
export async function getGeneralFeed(
  options?: {
    chains?: string[]
    actions?: string[]
    limit?: number
    minUsd?: number
  },
): Promise<CieloTransaction[]> {
  const params: Record<string, string> = {
    limit: String(options?.limit ?? 50),
  }

  if (options?.chains?.length) params.chains = options.chains.join(',')
  if (options?.actions?.length) params.actions = options.actions.join(',')
  if (options?.minUsd) params.min_usd = String(options.minUsd)

  const data = await cieloFetch<CieloFeedResponse>('/feed/latest', params)
  if (!data?.items) return []

  return data.items
}

// ━━━ SCOUT — Pierwsze interakcje ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Filtruj transakcje z first_interaction: true — wallety kupujące token po raz pierwszy.
 * To jest kluczowy sygnał smart money.
 */
export function extractFirstBuyers(transactions: CieloTransaction[]): CieloTransaction[] {
  return transactions.filter(tx => tx.first_interaction === true)
}

/**
 * Znajdź tokeny kupowane po raz pierwszy przez wiele walletów (convergence signal).
 * Zwraca tokeny posortowane po liczbie unikalnych first-buyer walletów.
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
    actions: ['buy', 'swap'],
  })

  const firstBuyers = extractFirstBuyers(transactions)
  const convergence = findConvergenceTokens(transactions)

  return { transactions, firstBuyers, convergence }
}
