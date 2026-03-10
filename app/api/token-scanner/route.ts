import { NextRequest, NextResponse } from 'next/server'
import { gmgnGet } from '@/lib/gmgn'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── types ────────────────────────────────────────────────────────────────────

interface ScannedToken {
  address: string
  name: string
  symbol: string
  logo: string
  athMcap: number
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

// ── ATH mcap from kline ─────────────────────────────────────────────────────

async function fetchAthMcap(address: string, totalSupply: number): Promise<number> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const url =
      `https://gmgn.ai/api/v1/token_kline/sol/${address}` +
      `?resolution=1d&from=${now - 365 * 86400}&to=${now}`
    const data = await gmgnGet(url)
    const list = (data.data as Record<string, unknown>)?.list as Record<string, unknown>[] ?? []
    if (list.length === 0) return 0

    let maxHigh = 0
    for (const candle of list) {
      const high = parseFloat(String(candle.high ?? 0)) || 0
      if (high > maxHigh) maxHigh = high
    }
    return maxHigh * totalSupply
  } catch {
    return 0
  }
}

// ── main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const minMcap      = Number(sp.get('minMcap')      ?? 0)
  const maxMcap      = Number(sp.get('maxMcap')       ?? 100_000_000)
  const minHolders   = Number(sp.get('minHolders')    ?? 100)
  const minVolume24h = Number(sp.get('minVolume24h')  ?? 50_000)
  const minLiquidity = Number(sp.get('minLiquidity')  ?? 0)
  const maxAge       = sp.get('maxAge')               ?? 'any'
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
  if (minMcap > 0)       params.set('min_marketcap', String(minMcap))
  if (maxMcap > 0)       params.set('max_marketcap', String(maxMcap))
  if (minVolume24h > 0)  params.set('min_volume', String(minVolume24h))
  if (minHolders > 0)    params.set('min_holder_count', String(minHolders))

  // Step 1 — Fetch ranked tokens with server-side filters (paginated)
  interface RankToken {
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
    totalSupply: number
  }

  const rankTokens: RankToken[] = []
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

        const createdAt = Number(t.open_timestamp ?? t.creation_timestamp ?? 0) || 0
        const liq       = parseFloat(String(t.liquidity ?? 0)) || 0

        // Client-side filters (age, liquidity — not supported server-side)
        if (minCreatedTs > 0 && createdAt > 0 && createdAt < minCreatedTs) continue
        if (minLiquidity > 0 && liq < minLiquidity) continue

        rankTokens.push({
          address: addr,
          name: (t.name as string) ?? '',
          symbol: (t.symbol as string) ?? '',
          logo: (t.logo as string) ?? '',
          currentMcap: parseFloat(String(t.market_cap ?? 0)) || 0,
          currentPrice: parseFloat(String(t.price ?? 0)) || 0,
          currentHolders: Number(t.holder_count ?? 0) || 0,
          volume24h: parseFloat(String(t.volume ?? 0)) || 0,
          liquidity: liq,
          swaps24h: Number(t.swaps ?? 0) || 0,
          buys24h: Number(t.buys ?? 0) || 0,
          sells24h: Number(t.sells ?? 0) || 0,
          priceChange24h: parseFloat(String(t.price_change_percent ?? 0)) || 0,
          createdAt,
          launchpad: (t.launchpad_platform as string) ?? '',
          totalSupply: parseFloat(String(t.total_supply ?? 0)) || 0,
        })
      }

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

  // Step 2 — Fetch ATH mcap from kline data (batches of 10 concurrent)
  const BATCH_SIZE = 10
  const allTokens: ScannedToken[] = []

  for (let i = 0; i < rankTokens.length; i += BATCH_SIZE) {
    const batch = rankTokens.slice(i, i + BATCH_SIZE)
    const athResults = await Promise.allSettled(
      batch.map(t => fetchAthMcap(t.address, t.totalSupply))
    )

    for (let j = 0; j < batch.length; j++) {
      const t = batch[j]
      const athResult = athResults[j]
      const athMcap = athResult.status === 'fulfilled' ? athResult.value : 0

      allTokens.push({
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        logo: t.logo,
        athMcap: athMcap > 0 ? athMcap : t.currentMcap, // fallback to current
        currentMcap: t.currentMcap,
        currentPrice: t.currentPrice,
        currentHolders: t.currentHolders,
        volume24h: t.volume24h,
        liquidity: t.liquidity,
        swaps24h: t.swaps24h,
        buys24h: t.buys24h,
        sells24h: t.sells24h,
        priceChange24h: t.priceChange24h,
        createdAt: t.createdAt,
        launchpad: t.launchpad,
        dexUrl: `https://dexscreener.com/solana/${t.address}`,
        gmgnUrl: `https://gmgn.ai/sol/token/${t.address}`,
      })
    }

    if (i + BATCH_SIZE < rankTokens.length) await sleep(300)
  }

  const response: ScanResponse = {
    tokens: allTokens,
    total: allTokens.length,
    scanned: totalScanned,
  }

  cache.set(cacheKey, { data: response, ts: Date.now() })

  return NextResponse.json(response)
}
