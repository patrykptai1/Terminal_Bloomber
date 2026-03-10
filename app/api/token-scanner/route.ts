import { NextRequest, NextResponse } from 'next/server'
import { gmgnGet } from '@/lib/gmgn'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── types ────────────────────────────────────────────────────────────────────

interface ScannedToken {
  address: string
  name: string
  symbol: string
  logo: string
  currentMcap: number
  currentPrice: number
  currentHolders: number
  volume24h: number
  liquidity: number
  swaps24h: number
  buys24h: number
  sells24h: number
  priceChange24h: number
  createdAt: number
  launchpad: string
  dexUrl: string
  gmgnUrl: string
}

interface ScanResponse {
  tokens: ScannedToken[]
  total: number
  scanned: number
}

// ── 3-minute cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  data: ScanResponse
  ts: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 3 * 60 * 1000

function getCached(key: string): ScanResponse | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data
}

// ── main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const minMcap      = Number(sp.get('minMcap')      ?? 0)
  const maxMcap      = Number(sp.get('maxMcap')       ?? 100_000_000)
  const minHolders   = Number(sp.get('minHolders')    ?? 100)
  const minVolume24h = Number(sp.get('minVolume24h')  ?? 50_000)
  const minLiquidity = Number(sp.get('minLiquidity')  ?? 0)
  const maxAge       = sp.get('maxAge')               ?? 'any'   // e.g. '7d','30d','365d','any'
  const orderBy      = sp.get('orderBy')              ?? 'market_cap'
  const sortDir      = sp.get('sortDir')              ?? 'desc'

  const cacheKey = `${minMcap}|${maxMcap}|${minHolders}|${minVolume24h}|${minLiquidity}|${maxAge}|${orderBy}|${sortDir}`
  const cached = getCached(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  // Age filter — compute cutoff timestamp
  const AGE_MAP: Record<string, number> = {
    '1h': 3600, '6h': 21600, '12h': 43200,
    '1d': 86400, '7d': 604800, '30d': 2592000,
    '90d': 7776000, '180d': 15552000, '365d': 31536000,
  }
  const ageSeconds = AGE_MAP[maxAge] ?? 0
  const minCreatedTs = ageSeconds > 0 ? Math.floor(Date.now() / 1000) - ageSeconds : 0

  // Build GMGN query params — use server-side filters where possible
  const params = new URLSearchParams({
    limit: '100',
    offset: '0',
    orderby: orderBy,
    direction: sortDir,
  })
  if (minMcap > 0)      params.set('min_marketcap', String(minMcap))
  if (maxMcap > 0)      params.set('max_marketcap', String(maxMcap))
  if (minVolume24h > 0)  params.set('min_volume', String(minVolume24h))
  if (minHolders > 0)    params.set('min_holder_count', String(minHolders))

  // Fetch pages until no more results
  const allTokens: ScannedToken[] = []
  const seen = new Set<string>()
  let totalScanned = 0
  const MAX_PAGES = 5

  for (let page = 0; page < MAX_PAGES; page++) {
    params.set('offset', String(page * 100))

    try {
      const url = `https://gmgn.ai/defi/quotation/v1/rank/sol/swaps/24h?${params.toString()}`
      const data = await gmgnGet(url)
      const rank = (data.data as Record<string, unknown>)?.rank as Record<string, unknown>[] ?? []

      if (rank.length === 0) break

      for (const t of rank) {
        const addr = (t.address as string) ?? ''
        if (!addr || seen.has(addr)) continue
        seen.add(addr)
        totalScanned++

        const createdAt    = Number(t.open_timestamp ?? t.creation_timestamp ?? 0) || 0
        const volume       = parseFloat(String(t.volume ?? 0)) || 0
        const mcap         = parseFloat(String(t.market_cap ?? 0)) || 0
        const holders      = Number(t.holder_count ?? 0) || 0
        const liq          = parseFloat(String(t.liquidity ?? 0)) || 0

        // Client-side filters (age, liquidity — not supported server-side)
        if (minCreatedTs > 0 && createdAt > 0 && createdAt < minCreatedTs) continue
        if (minLiquidity > 0 && liq < minLiquidity) continue

        allTokens.push({
          address: addr,
          name: (t.name as string) ?? '',
          symbol: (t.symbol as string) ?? '',
          logo: (t.logo as string) ?? '',
          currentMcap: mcap,
          currentPrice: parseFloat(String(t.price ?? 0)) || 0,
          currentHolders: holders,
          volume24h: volume,
          liquidity: liq,
          swaps24h: Number(t.swaps ?? 0) || 0,
          buys24h: Number(t.buys ?? 0) || 0,
          sells24h: Number(t.sells ?? 0) || 0,
          priceChange24h: parseFloat(String(t.price_change_percent ?? 0)) || 0,
          createdAt,
          launchpad: (t.launchpad_platform as string) ?? '',
          dexUrl: `https://dexscreener.com/solana/${addr}`,
          gmgnUrl: `https://gmgn.ai/sol/token/${addr}`,
        })
      }

      // If less than 100 returned, no more pages
      if (rank.length < 100) break
      if (page < MAX_PAGES - 1) await sleep(400)
    } catch (e) {
      console.error(`[token-scanner] rank fetch error page ${page}:`, e)
      if (page === 0) {
        return NextResponse.json({ error: 'Nie udało się pobrać danych z GMGN' }, { status: 502 })
      }
      break
    }
  }

  const response: ScanResponse = {
    tokens: allTokens,
    total: allTokens.length,
    scanned: totalScanned,
  }

  cache.set(cacheKey, { data: response, ts: Date.now() })

  return NextResponse.json(response)
}
