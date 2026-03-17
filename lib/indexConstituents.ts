/**
 * Dynamically fetch S&P 500 and NASDAQ constituents from public sources.
 * - S&P 500: Wikipedia (with GICS sectors)
 * - NASDAQ: api.nasdaq.com (symbols only, sector from Yahoo Finance on-demand)
 * Results cached in-memory for 24 hours.
 */

export interface ConstituentEntry {
  symbol: string
  name: string
  sector: string // GICS sector
  source: "sp500" | "nasdaq"
}

interface ConstituentCache {
  sp500: ConstituentEntry[]
  nasdaqSymbols: { symbol: string; name: string }[]
  timestamp: number
}

let cache: ConstituentCache | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

// GICS sector normalization
const SECTOR_NORMALIZE: Record<string, string> = {
  "Information Technology": "Information Technology",
  "Health Care": "Healthcare",
  "Healthcare": "Healthcare",
  "Financials": "Financials",
  "Consumer Discretionary": "Consumer Discretionary",
  "Consumer Staples": "Consumer Staples",
  "Energy": "Energy",
  "Industrials": "Industrials",
  "Materials": "Materials",
  "Utilities": "Utilities",
  "Real Estate": "Real Estate",
  "Communication Services": "Communication Services",
  "Telecommunication Services": "Communication Services",
  // Yahoo Finance naming
  "Technology": "Information Technology",
  "Financial Services": "Financials",
  "Consumer Cyclical": "Consumer Discretionary",
  "Consumer Defensive": "Consumer Staples",
  "Basic Materials": "Materials",
}

function normSector(s: string): string {
  return SECTOR_NORMALIZE[s.trim()] ?? s.trim()
}

// ── S&P 500 from Wikipedia ──────────────────────────────────

async function fetchSP500(): Promise<ConstituentEntry[]> {
  try {
    const res = await fetch("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", {
      headers: { "User-Agent": "TerminalBloomberg/1.0" },
    })
    const html = await res.text()

    // Parse the first wikitable
    const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/i)
      ?? html.match(/<table[^>]*class="wikitable sortable"[^>]*>([\s\S]*?)<\/table>/i)

    if (!tableMatch) {
      console.error("[indexConstituents] Could not find S&P 500 table")
      return []
    }

    const rows = tableMatch[1].match(/<tr>([\s\S]*?)<\/tr>/gi) ?? []
    const entries: ConstituentEntry[] = []

    const extractText = (html: string): string =>
      html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#160;/g, " ").trim()

    for (const row of rows.slice(1)) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? []
      if (cells.length < 4) continue

      const symbol = extractText(cells[0] ?? "").replace(/\./g, "-")
      const name = extractText(cells[1] ?? "")
      const sector = extractText(cells[3] ?? "")

      if (symbol && name && sector && symbol.length <= 6) {
        entries.push({ symbol, name, sector: normSector(sector), source: "sp500" })
      }
    }

    console.log(`[indexConstituents] S&P 500: ${entries.length} constituents`)
    return entries
  } catch (e) {
    console.error("[indexConstituents] S&P 500 fetch error:", e)
    return []
  }
}

// ── NASDAQ symbols from api.nasdaq.com ──────────────────────

async function fetchNASDAQSymbols(): Promise<{ symbol: string; name: string }[]> {
  try {
    const res = await fetch(
      "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=5000&exchange=NASDAQ",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      }
    )
    if (!res.ok) throw new Error(`NASDAQ API ${res.status}`)

    const data = await res.json()
    const rows: any[] = data?.data?.table?.rows ?? []

    const entries: { symbol: string; name: string }[] = []
    for (const row of rows) {
      const symbol = (row.symbol ?? "").trim()
      const name = (row.name ?? "").trim()
      if (!symbol || !name) continue
      // Skip: too long symbols (warrants), duplicates with ^ or /
      if (symbol.length > 5 || symbol.includes("^") || symbol.includes("/") || symbol.includes(" ")) continue
      entries.push({ symbol, name })
    }

    console.log(`[indexConstituents] NASDAQ: ${entries.length} symbols`)
    return entries
  } catch (e) {
    console.error("[indexConstituents] NASDAQ fetch error:", e)
    return []
  }
}

// ── Public API ───────────────────────────────────────────────

export interface IndexData {
  sp500: ConstituentEntry[]
  nasdaqSymbols: { symbol: string; name: string }[]
  // S&P 500 organized by sector (has GICS sectors from Wikipedia)
  sp500BySector: Record<string, ConstituentEntry[]>
  sp500SectorCounts: Record<string, number>
  nasdaqTotal: number
  sp500Total: number
}

export async function getIndexConstituents(forceRefresh = false): Promise<IndexData> {
  if (!forceRefresh && cache && (Date.now() - cache.timestamp) < CACHE_TTL) {
    return buildIndexData(cache.sp500, cache.nasdaqSymbols)
  }

  const [sp500, nasdaqSymbols] = await Promise.all([
    fetchSP500(),
    fetchNASDAQSymbols(),
  ])

  cache = { sp500, nasdaqSymbols, timestamp: Date.now() }
  return buildIndexData(sp500, nasdaqSymbols)
}

function buildIndexData(
  sp500: ConstituentEntry[],
  nasdaqSymbols: { symbol: string; name: string }[]
): IndexData {
  const sp500BySector: Record<string, ConstituentEntry[]> = {}
  const sp500SectorCounts: Record<string, number> = {}

  for (const e of sp500) {
    if (!sp500BySector[e.sector]) sp500BySector[e.sector] = []
    sp500BySector[e.sector].push(e)
    sp500SectorCounts[e.sector] = (sp500SectorCounts[e.sector] ?? 0) + 1
  }

  return {
    sp500,
    nasdaqSymbols,
    sp500BySector,
    sp500SectorCounts,
    nasdaqTotal: nasdaqSymbols.length,
    sp500Total: sp500.length,
  }
}

/**
 * Get tickers for a sector:
 * - S&P 500: use pre-classified GICS sector from Wikipedia
 * - NASDAQ-only: symbols NOT in S&P 500 (sector will be fetched from Yahoo on-demand)
 */
export async function getTickersForSector(
  sector: string,
  includeNasdaqOnly: boolean
): Promise<{ sp500: string[]; nasdaqOnly: string[] }> {
  const data = await getIndexConstituents()

  // S&P 500 tickers for this sector
  const sp500 = sector === "ALL"
    ? data.sp500.map(e => e.symbol)
    : (data.sp500BySector[sector] ?? []).map(e => e.symbol)

  // NASDAQ symbols not in S&P 500
  let nasdaqOnly: string[] = []
  if (includeNasdaqOnly) {
    const sp500Set = new Set(data.sp500.map(e => e.symbol))
    nasdaqOnly = data.nasdaqSymbols
      .map(e => e.symbol)
      .filter(s => !sp500Set.has(s))
  }

  return { sp500, nasdaqOnly }
}
