import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, fetchHistory, searchTickers } from "@/lib/yahoo"
import { computeFullAnalysis } from "@/lib/analysis"
import { fetchNews } from "@/lib/news"

/** Try to resolve a user query to a valid Yahoo Finance symbol.
 *  If the raw symbol fails, search Yahoo and pick the best equity match. */
async function resolveSymbol(raw: string): Promise<string> {
  // First try the raw symbol directly
  try {
    const q = await fetchQuote(raw)
    if (q) return raw
  } catch { /* continue to search */ }

  // Search Yahoo Finance for matching tickers
  const results = await searchTickers(raw)
  if (results.length === 0) throw new Error(`No data for ${raw}`)

  // Prefer WSE (Warsaw Stock Exchange) if input looks Polish (no dot = not a full ticker)
  if (!raw.includes(".")) {
    const wse = results.find(r => r.exchange === "WSE" || r.symbol.endsWith(".WA"))
    if (wse) return wse.symbol
  }

  // Otherwise return first equity result
  return results[0].symbol
}

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json()
    if (!ticker) return NextResponse.json({ error: "Ticker required" }, { status: 400 })

    const sym = await resolveSymbol(ticker.toUpperCase().trim())

    const [quote, stats, history, news] = await Promise.all([
      fetchQuote(sym),
      fetchKeyStats(sym).catch(() => null),
      fetchHistory(sym, "1y").catch(() => []),
      fetchNews(sym, sym).catch(() => []),
    ])

    const analysis = computeFullAnalysis(quote, stats, history, stats?.sector ?? undefined)

    // Update news with company name now that we have it
    let finalNews = news
    if (news.length === 0 && quote.name) {
      finalNews = await fetchNews(sym, quote.name).catch(() => [])
    }

    // Trim history to last 250 data points
    const trimmedHistory = history.slice(-250)

    return NextResponse.json({
      quote,
      stats,
      analysis,
      news: finalNews,
      history: trimmedHistory,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
