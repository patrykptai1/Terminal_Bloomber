import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, fetchHistory, fetchEarnings, resolveSymbol } from "@/lib/yahoo"
import { computeFullAnalysis } from "@/lib/analysis"

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json()
    if (!ticker) return NextResponse.json({ error: "Ticker required" }, { status: 400 })

    const sym = await resolveSymbol(ticker.toUpperCase().trim())
    const [quote, stats, history, earnings] = await Promise.all([
      fetchQuote(sym),
      fetchKeyStats(sym).catch(() => null),
      fetchHistory(sym, "3y").catch(() => []),
      fetchEarnings(sym).catch(() => null),
    ])

    const analysis = computeFullAnalysis(quote, stats, history, stats?.sector ?? undefined)

    return NextResponse.json({ quote, stats, analysis, earnings })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
