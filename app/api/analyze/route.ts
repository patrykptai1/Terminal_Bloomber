import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, fetchHistory, resolveSymbol } from "@/lib/yahoo"
import { computeFullAnalysis } from "@/lib/analysis"
import { fetchNews } from "@/lib/news"

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json()
    if (!ticker) return NextResponse.json({ error: "Ticker required" }, { status: 400 })

    const sym = await resolveSymbol(ticker.toUpperCase().trim())

    const [quote, stats, history3y, news] = await Promise.all([
      fetchQuote(sym),
      fetchKeyStats(sym).catch(() => null),
      fetchHistory(sym, "3y").catch(() => []),
      fetchNews(sym, sym).catch(() => []),
    ])

    // Use full 3y history for analysis (RSI, MA need long history)
    const analysis = computeFullAnalysis(quote, stats, history3y, stats?.sector ?? undefined)

    // Update news with company name now that we have it
    let finalNews = news
    if (news.length === 0 && quote.name) {
      finalNews = await fetchNews(sym, quote.name).catch(() => [])
    }

    // Aggregate to weekly (1W) for chart — take last close of each week
    const weeklyMap = new Map<string, typeof history3y[0]>()
    for (const bar of history3y) {
      const d = bar.date instanceof Date ? bar.date : new Date(bar.date)
      // ISO week key: year-week
      const jan1 = new Date(d.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`
      weeklyMap.set(key, bar) // last bar of the week wins
    }
    const trimmedHistory = [...weeklyMap.values()].slice(-156) // ~3 years of weekly data

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
