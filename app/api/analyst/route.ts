import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchAnalystData } from "@/lib/yahoo"

export async function GET(req: NextRequest) {
  try {
    const ticker = req.nextUrl.searchParams.get("ticker")
    if (!ticker) return NextResponse.json({ error: "Ticker required" }, { status: 400 })

    const sym = ticker.toUpperCase()

    const [quote, analyst] = await Promise.all([
      fetchQuote(sym),
      fetchAnalystData(sym),
    ])

    return NextResponse.json({ quote, analyst })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
