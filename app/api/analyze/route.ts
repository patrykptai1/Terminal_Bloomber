import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, fetchHistory } from "@/lib/yahoo"
import { computeFullAnalysis } from "@/lib/analysis"
import { fetchNews } from "@/lib/news"

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json()
    if (!ticker) return NextResponse.json({ error: "Ticker required" }, { status: 400 })

    const sym = ticker.toUpperCase()

    const [quote, stats, history, news] = await Promise.all([
      fetchQuote(sym),
      fetchKeyStats(sym).catch(() => null),
      fetchHistory(sym, "1y").catch(() => []),
      fetchNews(sym, sym).catch(() => []),
    ])

    const analysis = computeFullAnalysis(quote, stats, history)

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
