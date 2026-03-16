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
  source: 'gmgn' | 'coingecko' | 'both'
}

interface ScanResponse {
  tokens: ScannedToken[]
  total: number
  scanned: number
  sources: { gmgn: number; coingecko: number }
}

// ── cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number }

const resultCache = new Map<string, CacheEntry<ScanResponse>>()
const RESULT_TTL = 3 * 60 * 1000

// CoinGecko address map: coingecko_id -> solana_address  (cached 12h)
let cgAddressMap: Map<string, string> | null = null
let cgAddressMapTs = 0
const CG_MAP_TTL = 12 * 3600 * 1000

// CoinGecko markets cache (5 min)
let cgMarketsCache: CoinGeckoMarketToken[] | null = null
let cgMarketsCacheTs = 0
const CG_MARKETS_TTL = 5 * 60 * 1000

function getCached(key: string): ScanResponse | null {
  const entry = resultCache.get(key)
  if (!entry || Date.now() - entry.ts > RESULT_TTL) {
    if (entry) resultCache.delete(key)
    return null
  }
  return entry.data
}

// ── CoinGecko helpers ────────────────────────────────────────────────────────

interface CoinGeckoMarketToken {
  id: string
  symbol: string
  name: string
  image: string
  market_cap: number
  total_volume: number
  current_price: number
  ath: number
  total_supply: number
  circulating_supply: number
  price_change_percentage_24h: number
  fully_diluted_valuation: number
}

async function fetchCGAddressMap(): Promise<Map<string, string>> {
  if (cgAddressMap && Date.now() - cgAddressMapTs < CG_MAP_TTL) return cgAddressMap

  console.log('[token-scanner] Fetching CoinGecko coins/list for address mapping...')
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/list?include_platform=true',
      { signal: AbortSignal.timeout(30000) }
    )
    if (!res.ok) throw new Error(`CG list: ${res.status}`)
    const data = await res.json() as { id: string; platforms?: Record<string, string> }[]

    const map = new Map<string, string>()
    for (const coin of data) {
      const solAddr = coin.platforms?.solana
      if (solAddr && solAddr.length > 20) {
        map.set(coin.id, solAddr)
      }
    }
    cgAddressMap = map
    cgAddressMapTs = Date.now()
    console.log(`[token-scanner] CG address map: ${map.size} Solana tokens`)
    return map
  } catch (e) {
    console.error('[token-scanner] CG address map error:', e)
    return cgAddressMap ?? new Map()
  }
}

async function fetchCGMarkets(): Promise<CoinGeckoMarketToken[]> {
  if (cgMarketsCache && Date.now() - cgMarketsCacheTs < CG_MARKETS_TTL) return cgMarketsCache

  console.log('[token-scanner] Fetching CoinGecko markets...')
  const allTokens: CoinGeckoMarketToken[] = []

  // Fetch 2 pages (up to 500 tokens)
  for (const page of [1, 2]) {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=solana-meme-coins&order=market_cap_desc&per_page=250&page=${page}`
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) {
        console.error(`[token-scanner] CG markets page ${page}: ${res.status}`)
        break
      }
      const data = await res.json() as CoinGeckoMarketToken[]
      if (!Array.isArray(data) || data.length === 0) break
      allTokens.push(...data)

      if (page < 2) await sleep(1200) // CoinGecko rate limit
    } catch (e) {
      console.error(`[token-scanner] CG markets page ${page} error:`, e)
      break
    }
  }

  if (allTokens.length > 0) {
    cgMarketsCache = allTokens
    cgMarketsCacheTs = Date.now()
  }
  console.log(`[token-scanner] CG markets: ${allTokens.length} tokens`)
  return allTokens
}

// ── ATH mcap from GMGN kline ────────────────────────────────────────────────

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

// ── DexScreener enrichment for CG tokens ─────────────────────────────────────

interface DexInfo {
  holders: number
  liquidity: number
  volume24h: number
  mcap: number
  price: number
  priceChange24h: number
  createdAt: number
  logo: string
}

async function fetchDexScreenerBatch(addresses: string[]): Promise<Map<string, DexInfo>> {
  const map = new Map<string, DexInfo>()
  const BATCH = 30

  for (let i = 0; i < addresses.length; i += BATCH) {
    const batch = addresses.slice(i, i + BATCH)
    try {
      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`,
        { signal: AbortSignal.timeout(15000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      const pairs = Array.isArray(data) ? data : (data as Record<string, unknown>).pairs ?? []

      // Pick highest-liquidity pair per token
      const best = new Map<string, Record<string, unknown>>()
      for (const p of pairs as Record<string, unknown>[]) {
        const addr = (p.baseToken as Record<string, string>)?.address
        if (!addr) continue
        const existing = best.get(addr)
        const liq = parseFloat(String((p.liquidity as Record<string, unknown>)?.usd ?? 0)) || 0
        const eLiq = existing
          ? parseFloat(String((existing.liquidity as Record<string, unknown>)?.usd ?? 0)) || 0
          : 0
        if (!existing || liq > eLiq) best.set(addr, p)
      }

      for (const [addr, p] of best) {
        map.set(addr, {
          holders: 0, // DexScreener doesn't reliably give holders
          liquidity: parseFloat(String((p.liquidity as Record<string, unknown>)?.usd ?? 0)) || 0,
          volume24h: parseFloat(String((p.volume as Record<string, unknown>)?.h24 ?? 0)) || 0,
          mcap: (p.fdv as number) ?? 0,
          price: parseFloat(String(p.priceUsd ?? 0)) || 0,
          priceChange24h: parseFloat(String((p.priceChange as Record<string, unknown>)?.h24 ?? 0)) || 0,
          createdAt: p.pairCreatedAt ? Math.floor((p.pairCreatedAt as number) / 1000) : 0,
          logo: ((p.info as Record<string, unknown>)?.imageUrl as string) ?? '',
        })
      }
    } catch { /* skip batch */ }
    if (i + BATCH < addresses.length) await sleep(300)
  }

  return map
}

// ── GMGN rank token parser ───────────────────────────────────────────────────

interface RankToken {
  address: string; name: string; symbol: string; logo: string
  currentMcap: number; currentPrice: number; currentHolders: number
  volume24h: number; liquidity: number; swaps24h: number
  buys24h: number; sells24h: number; priceChange24h: number
  createdAt: number; launchpad: string; totalSupply: number
}

function parseRankToken(t: Record<string, unknown>): RankToken | null {
  const addr = (t.address as string) ?? ''
  if (!addr) return null
  return {
    address: addr,
    name: (t.name as string) ?? '',
    symbol: (t.symbol as string) ?? '',
    logo: (t.logo as string) ?? '',
    currentMcap: parseFloat(String(t.market_cap ?? 0)) || 0,
    currentPrice: parseFloat(String(t.price ?? 0)) || 0,
    currentHolders: Number(t.holder_count ?? 0) || 0,
    volume24h: parseFloat(String(t.volume ?? 0)) || 0,
    liquidity: parseFloat(String(t.liquidity ?? 0)) || 0,
    swaps24h: Number(t.swaps ?? 0) || 0,
    buys24h: Number(t.buys ?? 0) || 0,
    sells24h: Number(t.sells ?? 0) || 0,
    priceChange24h: parseFloat(String(t.price_change_percent ?? 0)) || 0,
    createdAt: Number(t.open_timestamp ?? t.creation_timestamp ?? 0) || 0,
    launchpad: (t.launchpad_platform as string) ?? '',
    totalSupply: parseFloat(String(t.total_supply ?? 0)) || 0,
  }
}

// ── main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const minAth       = Number(sp.get('minAth')        ?? 0)
  const minHolders   = Number(sp.get('minHolders')    ?? 100)
  const minVolume24h = Number(sp.get('minVolume24h')  ?? 50_000)
  const minLiquidity = Number(sp.get('minLiquidity')  ?? 0)
  const maxAge       = sp.get('maxAge')               ?? 'any'
  const orderBy      = sp.get('orderBy')              ?? 'market_cap'
  const sortDir      = sp.get('sortDir')              ?? 'desc'

  const cacheKey = `v3|${minAth}|${minHolders}|${minVolume24h}|${minLiquidity}|${maxAge}|${orderBy}|${sortDir}`
  const cached = getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  // Age filter — compute cutoff timestamp
  const AGE_MAP: Record<string, number> = {
    '1h': 3600, '6h': 21600, '12h': 43200,
    '1d': 86400, '7d': 604800, '30d': 2592000,
    '90d': 7776000, '180d': 15552000, '365d': 31536000,
  }
  const ageSeconds = AGE_MAP[maxAge] ?? 0
  const minCreatedTs = ageSeconds > 0 ? Math.floor(Date.now() / 1000) - ageSeconds : 0

  const seen = new Set<string>()
  const allTokens: ScannedToken[] = []
  let gmgnCount = 0
  let cgCount = 0

  // ═══ Source 1: GMGN rank (trending small tokens) ═══════════════════════════

  const TIMEFRAMES = ['5m', '1h', '6h', '24h']
  const gmgnTokens: RankToken[] = []

  const baseParams = new URLSearchParams({
    limit: '100', offset: '0', orderby: orderBy, direction: sortDir,
  })
  if (minVolume24h > 0) baseParams.set('min_volume', String(minVolume24h))
  if (minHolders > 0)   baseParams.set('min_holder_count', String(minHolders))

  for (const tf of TIMEFRAMES) {
    try {
      const url = `https://gmgn.ai/defi/quotation/v1/rank/sol/swaps/${tf}?${baseParams.toString()}`
      const data = await gmgnGet(url)
      const rank = (data.data as Record<string, unknown>)?.rank as Record<string, unknown>[] ?? []
      for (const raw of rank) {
        const t = parseRankToken(raw)
        if (!t || seen.has(t.address)) continue
        seen.add(t.address)
        if (minCreatedTs > 0 && t.createdAt > 0 && t.createdAt < minCreatedTs) continue
        if (minLiquidity > 0 && t.liquidity < minLiquidity) continue
        gmgnTokens.push(t)
      }
      await sleep(350)
    } catch (e) {
      console.error(`[token-scanner] GMGN rank tf=${tf}:`, e)
    }
  }

  // Fetch ATH for GMGN tokens (batches of 10)
  const BATCH_ATH = 10
  for (let i = 0; i < gmgnTokens.length; i += BATCH_ATH) {
    const batch = gmgnTokens.slice(i, i + BATCH_ATH)
    const athResults = await Promise.allSettled(
      batch.map(t => fetchAthMcap(t.address, t.totalSupply))
    )
    for (let j = 0; j < batch.length; j++) {
      const t = batch[j]
      const athR = athResults[j]
      const athMcap = athR.status === 'fulfilled' ? athR.value : 0
      const finalAth = athMcap > 0 ? athMcap : t.currentMcap
      if (minAth > 0 && finalAth < minAth) continue

      allTokens.push({
        address: t.address, name: t.name, symbol: t.symbol, logo: t.logo,
        athMcap: finalAth, currentMcap: t.currentMcap, currentPrice: t.currentPrice,
        currentHolders: t.currentHolders, volume24h: t.volume24h, liquidity: t.liquidity,
        swaps24h: t.swaps24h, buys24h: t.buys24h, sells24h: t.sells24h,
        priceChange24h: t.priceChange24h, createdAt: t.createdAt, launchpad: t.launchpad,
        dexUrl: `https://dexscreener.com/solana/${t.address}`,
        gmgnUrl: `https://gmgn.ai/sol/token/${t.address}`,
        source: 'gmgn',
      })
      gmgnCount++
    }
    if (i + BATCH_ATH < gmgnTokens.length) await sleep(300)
  }

  // ═══ Source 2: CoinGecko (established Solana meme tokens) ══════════════════

  try {
    const [addressMap, cgMarkets] = await Promise.all([
      fetchCGAddressMap(),
      fetchCGMarkets(),
    ])

    // Map CG tokens to Solana addresses
    interface CgMapped {
      cg: CoinGeckoMarketToken
      address: string
      athMcap: number
    }
    const cgMapped: CgMapped[] = []

    for (const cg of cgMarkets) {
      const addr = addressMap.get(cg.id)
      if (!addr || seen.has(addr)) continue

      // Compute ATH mcap from CoinGecko data
      const supply = cg.total_supply || cg.circulating_supply || 0
      const athMcap = cg.ath && supply ? cg.ath * supply : (cg.fully_diluted_valuation || cg.market_cap || 0)

      // Volume filter
      if (minVolume24h > 0 && (cg.total_volume || 0) < minVolume24h) continue
      // ATH filter
      if (minAth > 0 && athMcap < minAth) continue

      seen.add(addr)
      cgMapped.push({ cg, address: addr, athMcap })
    }

    // Enrich with DexScreener for liquidity, holders, real-time data
    if (cgMapped.length > 0) {
      const addresses = cgMapped.map(c => c.address)
      const dexMap = await fetchDexScreenerBatch(addresses)

      for (const { cg, address, athMcap } of cgMapped) {
        const dex = dexMap.get(address)

        // Liquidity filter
        if (minLiquidity > 0 && (dex?.liquidity ?? 0) < minLiquidity) continue

        // Age filter — use DexScreener createdAt
        if (minCreatedTs > 0 && dex?.createdAt && dex.createdAt > 0 && dex.createdAt < minCreatedTs) continue

        allTokens.push({
          address,
          name: cg.name,
          symbol: cg.symbol.toUpperCase(),
          logo: cg.image || dex?.logo || '',
          athMcap,
          currentMcap: dex?.mcap || cg.market_cap || 0,
          currentPrice: dex?.price || cg.current_price || 0,
          currentHolders: dex?.holders || 0,
          volume24h: dex?.volume24h || cg.total_volume || 0,
          liquidity: dex?.liquidity || 0,
          swaps24h: 0,
          buys24h: 0,
          sells24h: 0,
          priceChange24h: dex?.priceChange24h || cg.price_change_percentage_24h || 0,
          createdAt: dex?.createdAt || 0,
          launchpad: '',
          dexUrl: `https://dexscreener.com/solana/${address}`,
          gmgnUrl: `https://gmgn.ai/sol/token/${address}`,
          source: 'coingecko',
        })
        cgCount++
      }
    }
  } catch (e) {
    console.error('[token-scanner] CoinGecko source error:', e)
  }

  // ═══ Sort ══════════════════════════════════════════════════════════════════

  const sortKey = (t: ScannedToken) => {
    switch (orderBy) {
      case 'volume': return t.volume24h
      case 'swaps': return t.swaps24h
      case 'holder_count': return t.currentHolders
      case 'price_change_percent': return t.priceChange24h
      case 'athMcap': return t.athMcap
      default: return t.currentMcap
    }
  }
  allTokens.sort((a, b) => sortDir === 'desc' ? sortKey(b) - sortKey(a) : sortKey(a) - sortKey(b))

  const response: ScanResponse = {
    tokens: allTokens,
    total: allTokens.length,
    scanned: seen.size,
    sources: { gmgn: gmgnCount, coingecko: cgCount },
  }

  resultCache.set(cacheKey, { data: response, ts: Date.now() })

  return NextResponse.json(response)
}
