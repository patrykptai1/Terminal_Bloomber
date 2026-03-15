import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchEarnings } from "@/lib/yahoo"

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json()
    if (!ticker) return NextResponse.json({ error: "Ticker required" }, { status: 400 })

    const sym = ticker.toUpperCase()
    const [quote, earnings] = await Promise.all([
      fetchQuote(sym),
      fetchEarnings(sym).catch(() => ({ quarterly: [], financials: [] })),
    ])

    return NextResponse.json({ quote, earnings })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
