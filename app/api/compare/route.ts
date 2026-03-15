import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, fetchHistory } from "@/lib/yahoo"
import { computeFullAnalysis } from "@/lib/analysis"

export async function POST(req: NextRequest) {
  try {
    const { tickerA, tickerB } = await req.json()
    if (!tickerA || !tickerB) return NextResponse.json({ error: "Both tickers required" }, { status: 400 })

    const a = tickerA.toUpperCase()
    const b = tickerB.toUpperCase()

    const [quoteA, quoteB, statsA, statsB, historyA, historyB] = await Promise.all([
      fetchQuote(a),
      fetchQuote(b),
      fetchKeyStats(a).catch(() => null),
      fetchKeyStats(b).catch(() => null),
      fetchHistory(a, "1y").catch(() => []),
      fetchHistory(b, "1y").catch(() => []),
    ])

    const analysisA = computeFullAnalysis(quoteA, statsA, historyA)
    const analysisB = computeFullAnalysis(quoteB, statsB, historyB)

    return NextResponse.json({ quoteA, quoteB, statsA, statsB, analysisA, analysisB })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
