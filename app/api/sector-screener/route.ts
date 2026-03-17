import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats } from "@/lib/yahoo"
import {
  SECTOR_TICKERS,
  PL_TICKERS,
  NC_TICKERS,
  getTickersForSector,
  getAllUSTickers,
  getSectorForTicker,
} from "@/lib/sectorTickers"

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

// ── Handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { sector, market } = await req.json() as { sector?: string; market?: string }

    // Build ticker list based on sector + market selection
    let tickers: { symbol: string; market: "US" | "GPW" | "NC"; preSector: string | null }[] = []

    // US tickers — use pre-categorized lists
    if (!market || market === "ALL" || market === "US") {
      if (sector && sector !== "ALL") {
        // Only fetch tickers for selected sector
        const sectorTickers = getTickersForSector(sector)
        tickers.push(...sectorTickers.map(s => ({ symbol: s, market: "US" as const, preSector: sector })))
      } else {
        // All US tickers
        const all = getAllUSTickers()
        tickers.push(...all.map(s => ({ symbol: s, market: "US" as const, preSector: getSectorForTicker(s) })))
      }
    }

    // Polish tickers — sector determined from Yahoo Finance
    if (!market || market === "ALL" || market === "GPW") {
      tickers.push(...PL_TICKERS.map(s => ({ symbol: s, market: "GPW" as const, preSector: null })))
    }
    if (!market || market === "ALL" || market === "NC") {
      tickers.push(...NC_TICKERS.map(s => ({ symbol: s, market: "NC" as const, preSector: null })))
    }

    const results: SectorStock[] = []

    // Count all sectors (including non-fetched) for the sector selector counts
    const sectorCounts: Record<string, number> = {}
    for (const [sec, arr] of Object.entries(SECTOR_TICKERS)) {
      sectorCounts[sec] = arr.length
    }

    // Batch fetch — 20 at a time for speed
    for (let i = 0; i < tickers.length; i += 20) {
      const batch = tickers.slice(i, i + 20)
      const batchResults = await Promise.allSettled(
        batch.map(async ({ symbol, market: mkt, preSector }) => {
          const [quote, stats] = await Promise.all([
            fetchQuote(symbol),
            fetchKeyStats(symbol).catch(() => null),
          ])

          // Determine sector: pre-assigned (US) or from Yahoo (PL/NC)
          let gicsSector = preSector
          if (!gicsSector && stats?.sector) {
            gicsSector = normalizeSector(stats.sector)
          }
          if (!gicsSector) gicsSector = "Other"

          // Filter by sector for PL/NC tickers (US already pre-filtered)
          if (sector && sector !== "ALL" && gicsSector !== sector && mkt !== "US") return null

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
          } satisfies SectorStock
        })
      )

      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value) results.push(r.value)
      }
    }

    // Calculate sector medians for US stocks
    const usStocks = results.filter(s => s.market === "US")
    const sectorMedians: Record<string, Record<string, number | null>> = {}

    const metricKeys = ["peRatio", "forwardPE", "priceToSales", "evToEbitda", "dividendYield", "pegRatio", "profitMargin", "revenueGrowth"] as const

    // Group US stocks by sector for median calc
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
      sectorCounts,
      sectorMedians,
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    console.error("[sector-screener] Error:", e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Sector screener error",
    }, { status: 500 })
  }
}
