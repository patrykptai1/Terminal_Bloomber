import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats } from "@/lib/yahoo"
import type { QuoteData, KeyStatistics } from "@/lib/yahoo"

// Well-known tickers to scan
const US_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "UNH", "JNJ",
  "V", "XOM", "JPM", "WMT", "PG", "MA", "HD", "CVX", "MRK", "ABBV",
  "LLY", "PEP", "KO", "COST", "AVGO", "TMO", "MCD", "CSCO", "ACN", "ABT",
  "DHR", "NKE", "TXN", "UPS", "NEE", "PM", "RTX", "HON", "QCOM", "LOW",
  "INTC", "AMD", "CRM", "ORCL", "NFLX", "ADBE", "PYPL", "IBM", "GE", "CAT",
]

const PL_TICKERS = [
  "CDR.WA", "PKN.WA", "PKO.WA", "PZU.WA", "KGH.WA", "PEO.WA", "DNP.WA", "ALE.WA",
  "SPL.WA", "CPS.WA", "LPP.WA", "MBK.WA", "OPL.WA",
]

export async function POST(req: NextRequest) {
  try {
    const { strategy, market } = await req.json()

    const tickers = market === "PL" ? PL_TICKERS
      : market === "US" ? US_TICKERS
      : [...US_TICKERS, ...PL_TICKERS]

    // Fetch quotes in parallel (batches of 10)
    const results: { quote: QuoteData; stats: KeyStatistics | null }[] = []

    for (let i = 0; i < tickers.length; i += 10) {
      const batch = tickers.slice(i, i + 10)
      const batchResults = await Promise.allSettled(
        batch.map(async (t) => {
          const quote = await fetchQuote(t)
          const stats = await fetchKeyStats(t).catch(() => null)
          return { quote, stats }
        })
      )
      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value)
      }
    }

    // Apply screening filters
    const filtered = results.filter(({ quote: q, stats: s }) => {
      switch (strategy) {
        case "growth":
          return (s?.revenueGrowth ?? 0) > 0.1 && (s?.earningsGrowth ?? 0) > 0
        case "value":
          return q.peRatio != null && q.peRatio > 0 && q.peRatio < 20 && (s?.priceToBook ?? 99) < 3
        case "dividend":
          return (q.dividendYield ?? 0) > 0.02
        case "momentum":
          return q.changePercent > 0 && q.price > q.low52 * 1.2
        case "quality":
          return (s?.returnOnEquity ?? 0) > 0.15 && (s?.profitMargin ?? 0) > 0.1
        case "small-cap":
          return q.marketCap > 0 && q.marketCap < 10e9
        default:
          return true
      }
    })

    // Sort by relevant metric
    filtered.sort((a, b) => {
      switch (strategy) {
        case "growth": return (b.stats?.revenueGrowth ?? 0) - (a.stats?.revenueGrowth ?? 0)
        case "value": return (a.quote.peRatio ?? 999) - (b.quote.peRatio ?? 999)
        case "dividend": return (b.quote.dividendYield ?? 0) - (a.quote.dividendYield ?? 0)
        case "momentum": return b.quote.changePercent - a.quote.changePercent
        case "quality": return (b.stats?.returnOnEquity ?? 0) - (a.stats?.returnOnEquity ?? 0)
        default: return b.quote.marketCap - a.quote.marketCap
      }
    })

    return NextResponse.json({
      strategy,
      total: results.length,
      matched: filtered.length,
      stocks: filtered.slice(0, 20),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
