import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats } from "@/lib/yahoo"
import { getIndexConstituents, getTickersForSector } from "@/lib/indexConstituents"
import { PL_TICKERS, NC_TICKERS } from "@/lib/sectorTickers"

// ── Types ────────────────────────────────────────────────────

export interface SectorStock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap: number
  currency: string
  exchange: string
  market: "US" | "GPW" | "NC"
  sector: string
  industry: string | null
  source: "S&P500" | "NASDAQ" | "GPW" | "NC"
  peRatio: number | null
  forwardPE: number | null
  priceToSales: number | null
  evToEbitda: number | null
  dividendYield: number | null
  pegRatio: number | null
  ebitda: number | null
  enterpriseValue: number | null
  profitMargin: number | null
  revenueGrowth: number | null
}

// GICS sector mapping from Yahoo Finance names
const SECTOR_MAP: Record<string, string> = {
  "Technology": "Information Technology",
  "Information Technology": "Information Technology",
  "Healthcare": "Healthcare",
  "Health Care": "Healthcare",
  "Financial Services": "Financials",
  "Financials": "Financials",
  "Financial": "Financials",
  "Consumer Cyclical": "Consumer Discretionary",
  "Consumer Discretionary": "Consumer Discretionary",
  "Consumer Defensive": "Consumer Staples",
  "Consumer Staples": "Consumer Staples",
  "Energy": "Energy",
  "Industrials": "Industrials",
  "Basic Materials": "Materials",
  "Materials": "Materials",
  "Utilities": "Utilities",
  "Real Estate": "Real Estate",
  "Communication Services": "Communication Services",
  "Telecommunication Services": "Communication Services",
}

function normalizeSector(raw: string | null): string | null {
  if (!raw) return null
  return SECTOR_MAP[raw] ?? null
}

// ── Fetch one stock ──────────────────────────────────────────

async function fetchStock(
  symbol: string,
  mkt: "US" | "GPW" | "NC",
  preSector: string | null,
  source: "S&P500" | "NASDAQ" | "GPW" | "NC",
  targetSector?: string,
): Promise<SectorStock | null> {
  const [quote, stats] = await Promise.all([
    fetchQuote(symbol),
    fetchKeyStats(symbol).catch(() => null),
  ])

  // Determine sector
  let gicsSector = preSector
  if (!gicsSector && stats?.sector) {
    gicsSector = normalizeSector(stats.sector)
  }
  if (!gicsSector) return null // Skip unknown sectors

  // Filter by sector (for NASDAQ tickers where sector comes from Yahoo)
  if (targetSector && targetSector !== "ALL" && gicsSector !== targetSector) return null

  return {
    symbol: quote.symbol,
    name: quote.name,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    marketCap: quote.marketCap,
    currency: quote.currency,
    exchange: quote.exchange,
    market: mkt,
    sector: gicsSector,
    industry: stats?.industry ?? null,
    source,
    peRatio: quote.peRatio,
    forwardPE: stats?.forwardPE ?? quote.forwardPE,
    priceToSales: stats?.priceToSales ?? null,
    evToEbitda: stats?.enterpriseToEbitda ?? null,
    dividendYield: quote.dividendYield != null ? quote.dividendYield * 100 : null,
    pegRatio: stats?.pegRatio ?? null,
    ebitda: stats?.freeCashFlow ?? null,
    enterpriseValue: stats?.enterpriseValue ?? null,
    profitMargin: stats?.profitMargin != null ? stats.profitMargin * 100 : null,
    revenueGrowth: stats?.revenueGrowth != null ? stats.revenueGrowth * 100 : null,
  }
}

// ── Batch helper ─────────────────────────────────────────────

async function fetchBatch(
  tickers: { symbol: string; mkt: "US" | "GPW" | "NC"; preSector: string | null; source: "S&P500" | "NASDAQ" | "GPW" | "NC" }[],
  targetSector: string | undefined,
  batchSize: number,
): Promise<{ results: SectorStock[]; errors: number }> {
  const results: SectorStock[] = []
  let errors = 0

  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map(({ symbol, mkt, preSector, source }) =>
        fetchStock(symbol, mkt, preSector, source, targetSector)
      )
    )

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value)
      } else if (r.status === "rejected") {
        errors++
      }
    }
  }

  return { results, errors }
}

// ── Main handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { sector, market, includeNasdaq } = await req.json() as {
      sector?: string
      market?: string
      includeNasdaq?: boolean // Include NASDAQ-only stocks (not in S&P 500)
    }

    // 1. Get index constituents (cached 24h)
    const indexData = await getIndexConstituents()

    // Build task list
    const tasks: { symbol: string; mkt: "US" | "GPW" | "NC"; preSector: string | null; source: "S&P500" | "NASDAQ" | "GPW" | "NC" }[] = []

    if (!market || market === "ALL" || market === "US") {
      // S&P 500 tickers — pre-classified by GICS sector
      if (sector && sector !== "ALL") {
        const sp500Sector = indexData.sp500BySector[sector] ?? []
        tasks.push(...sp500Sector.map(e => ({
          symbol: e.symbol, mkt: "US" as const, preSector: e.sector, source: "S&P500" as const,
        })))
      } else {
        tasks.push(...indexData.sp500.map(e => ({
          symbol: e.symbol, mkt: "US" as const, preSector: e.sector, source: "S&P500" as const,
        })))
      }

      // NASDAQ-only (not in S&P 500) — sector from Yahoo Finance
      if (includeNasdaq) {
        const sp500Set = new Set(indexData.sp500.map(e => e.symbol))
        const nasdaqOnly = indexData.nasdaqSymbols.filter(e => !sp500Set.has(e.symbol))

        // Limit NASDAQ-only to reasonable batch (sector filtering happens in fetchStock)
        // For specific sector: take first 500 (Yahoo will classify)
        // For ALL: too many, skip unless specifically requested
        const limit = sector && sector !== "ALL" ? 500 : 200
        tasks.push(...nasdaqOnly.slice(0, limit).map(e => ({
          symbol: e.symbol, mkt: "US" as const, preSector: null, source: "NASDAQ" as const,
        })))
      }
    }

    // Polish markets
    if (!market || market === "ALL" || market === "GPW") {
      tasks.push(...PL_TICKERS.map(s => ({
        symbol: s, mkt: "GPW" as const, preSector: null, source: "GPW" as const,
      })))
    }
    if (!market || market === "ALL" || market === "NC") {
      tasks.push(...NC_TICKERS.map(s => ({
        symbol: s, mkt: "NC" as const, preSector: null, source: "NC" as const,
      })))
    }

    // 2. Fetch data in batches of 20
    const { results, errors } = await fetchBatch(tasks, sector, 20)

    // 3. Calculate sector medians for US stocks
    const usStocks = results.filter(s => s.market === "US")
    const sectorMedians: Record<string, Record<string, number | null>> = {}
    const metricKeys = ["peRatio", "forwardPE", "priceToSales", "evToEbitda", "dividendYield", "pegRatio", "profitMargin", "revenueGrowth"] as const

    const bySector: Record<string, SectorStock[]> = {}
    for (const s of usStocks) {
      if (!bySector[s.sector]) bySector[s.sector] = []
      bySector[s.sector].push(s)
    }

    for (const [sec, stocks] of Object.entries(bySector)) {
      sectorMedians[sec] = {}
      for (const key of metricKeys) {
        const vals = stocks
          .map(s => s[key])
          .filter((v): v is number => v != null && isFinite(v))
          .sort((a, b) => a - b)
        if (vals.length === 0) {
          sectorMedians[sec][key] = null
        } else {
          const mid = Math.floor(vals.length / 2)
          sectorMedians[sec][key] = vals.length % 2 === 0
            ? (vals[mid - 1] + vals[mid]) / 2
            : vals[mid]
        }
      }
    }

    return NextResponse.json({
      stocks: results,
      total: results.length,
      sectorCounts: indexData.sp500SectorCounts,
      sectorMedians,
      indexInfo: {
        sp500: indexData.sp500Total,
        nasdaq: indexData.nasdaqTotal,
        fetchedSP500: tasks.filter(t => t.source === "S&P500").length,
        fetchedNASDAQ: tasks.filter(t => t.source === "NASDAQ").length,
      },
      errors: errors > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    console.error("[sector-screener] Error:", e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Sector screener error",
    }, { status: 500 })
  }
}
