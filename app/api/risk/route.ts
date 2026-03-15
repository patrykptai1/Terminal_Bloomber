import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, fetchHistory } from "@/lib/yahoo"
import { computeFullAnalysis } from "@/lib/analysis"

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json()
    if (!ticker) return NextResponse.json({ error: "Ticker required" }, { status: 400 })

    const sym = ticker.toUpperCase()
    const [quote, stats, history] = await Promise.all([
      fetchQuote(sym),
      fetchKeyStats(sym).catch(() => null),
      fetchHistory(sym, "1y").catch(() => []),
    ])

    const analysis = computeFullAnalysis(quote, stats, history)

    return NextResponse.json({ quote, stats, analysis })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
