// lib/messari.ts
// Messari API — https://messari.io/api
// Darmowy BEZ klucza, limit 20 req/min, 1000/dzień
// Najlepszy do: narracja projektu, tokenomics, ROI historyczne
// OGRANICZENIE: głównie duże tokeny (>$10M mcap)

const MESSARI_BASE = 'https://data.messari.io/api/v1'
const messariCache = new Map<string, { data: unknown; ts: number }>()

async function msrFetch(path: string, ttl: number): Promise<unknown> {
  const cached = messariCache.get(path)
  if (cached && Date.now() - cached.ts < ttl) return cached.data
  try {
    const res = await fetch(`${MESSARI_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return cached?.data ?? null
    const json = await res.json() as { data?: unknown }
    messariCache.set(path, { data: json.data, ts: Date.now() })
    return json.data
  } catch {
    return cached?.data ?? null
  }
}

interface MessariMetricsData {
  market_data?: { price_usd?: number; volume_last_24_hours?: number }
  marketcap?: { current_marketcap_usd?: number; realized_marketcap_usd?: number }
  on_chain_data?: { txn_count_last_24_hours?: number; active_addresses?: number }
  roi_data?: {
    percent_change_all_time?: number
    percent_change_last_1_year?: number
    percent_change_last_3_months?: number
    percent_change_last_1_month?: number
  }
  profile?: { general?: { sector?: { name?: string }; summary?: string } }
}

export async function getMessariMetrics(assetSlug: string) {
  const data = await msrFetch(`/assets/${assetSlug}/metrics`, 10 * 60 * 1000) as MessariMetricsData | null
  if (!data) return null
  return {
    priceUsd: data.market_data?.price_usd ?? null,
    marketCapUsd: data.marketcap?.current_marketcap_usd ?? null,
    realizedCap: data.marketcap?.realized_marketcap_usd ?? null,
    volume24h: data.market_data?.volume_last_24_hours ?? null,
    txCount24h: data.on_chain_data?.txn_count_last_24_hours ?? null,
    activeAddresses24h: data.on_chain_data?.active_addresses ?? null,
    roiAllTime: data.roi_data?.percent_change_all_time ?? null,
    roi1y: data.roi_data?.percent_change_last_1_year ?? null,
    roi90d: data.roi_data?.percent_change_last_3_months ?? null,
    roi30d: data.roi_data?.percent_change_last_1_month ?? null,
    category: data.profile?.general?.sector?.name ?? null,
    projectSummary: data.profile?.general?.summary ?? null,
  }
}

interface MessariProfileData {
  profile?: {
    general?: { overview?: string }
    economics?: { use_cases?: string }
    technology?: { overview?: string; consensus?: string }
    launch?: {
      general?: { launch_date?: string }
      fundraising?: { total_amount_raised?: number }
    }
  }
}

export async function getMessariProfile(assetSlug: string) {
  const data = await msrFetch(`/assets/${assetSlug}/profile`, 60 * 60 * 1000) as MessariProfileData | null
  if (!data) return null
  return {
    overview: data.profile?.general?.overview ?? null,
    useCases: data.profile?.economics?.use_cases ?? null,
    technology: data.profile?.technology?.overview ?? null,
    consensus: data.profile?.technology?.consensus ?? null,
    launchDate: data.profile?.launch?.general?.launch_date ?? null,
    fundraising: data.profile?.launch?.fundraising?.total_amount_raised ?? null,
  }
}
