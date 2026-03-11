// lib/coinpaprika.ts
// Coinpaprika API — https://api.coinpaprika.com
// Darmowy BEZ klucza, limit ~25k/miesiąc
// Fallback cenowy + cross-check vs GMGN

const CP_BASE = 'https://api.coinpaprika.com/v1'
const cpCache = new Map<string, { data: unknown; ts: number }>()
const CP_TTL = 3 * 60 * 1000

async function cpFetch(path: string, ttl = CP_TTL): Promise<unknown> {
  const cached = cpCache.get(path)
  if (cached && Date.now() - cached.ts < ttl) return cached.data
  try {
    const res = await fetch(`${CP_BASE}${path}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return cached?.data ?? null
    const data = await res.json()
    cpCache.set(path, { data, ts: Date.now() })
    return data
  } catch {
    return cached?.data ?? null
  }
}

// Szukaj tokena po symbolu
export async function findCoinpaprikaToken(symbolOrName: string): Promise<string | null> {
  const data = await cpFetch('/coins', 24 * 60 * 60 * 1000) as Array<{
    id: string; symbol?: string; name?: string
  }> | null
  if (!Array.isArray(data)) return null
  const query = symbolOrName.toLowerCase()
  const match = data.find(
    c =>
      c.symbol?.toLowerCase() === query ||
      c.name?.toLowerCase() === query ||
      c.name?.toLowerCase().includes(query),
  )
  return match?.id ?? null
}

// Dane rynkowe tokena
export async function getCoinpaprikaTickerData(coinId: string) {
  const data = await cpFetch(`/tickers/${coinId}?quotes=USD`) as {
    name?: string; symbol?: string; rank?: number; error?: string
    quotes?: { USD?: Record<string, number | string | null> }
  } | null
  if (!data || data.error) return null

  const usd = data.quotes?.USD
  return {
    name: data.name ?? null,
    symbol: data.symbol ?? null,
    rank: data.rank ?? null,
    priceUsd: (usd?.price as number) ?? null,
    volume24h: (usd?.volume_24h as number) ?? null,
    marketCapUsd: (usd?.market_cap as number) ?? null,
    percentChange1h: (usd?.percent_change_1h as number) ?? null,
    percentChange24h: (usd?.percent_change_24h as number) ?? null,
    percentChange7d: (usd?.percent_change_7d as number) ?? null,
    percentChange30d: (usd?.percent_change_30d as number) ?? null,
    ath: (usd?.ath_price as number) ?? null,
    athDate: (usd?.ath_date as string) ?? null,
    percentFromAth: (usd?.percent_from_price_ath as number) ?? null,
  }
}

// Globalne statystyki rynku krypto
export async function getCryptoGlobalStats() {
  const data = await cpFetch('/global', 10 * 60 * 1000) as {
    market_cap_usd?: number
    volume_24h_usd?: number
    bitcoin_dominance_percentage?: number
    market_cap_ath_value?: number
    active_cryptocurrencies?: number
  } | null
  if (!data) return null
  return {
    totalMarketCapUsd: data.market_cap_usd ?? null,
    totalVolume24h: data.volume_24h_usd ?? null,
    btcDominance: data.bitcoin_dominance_percentage ?? null,
    marketCapAth: data.market_cap_ath_value ?? null,
    activeCurrencies: data.active_cryptocurrencies ?? null,
  }
}
