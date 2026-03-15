import { NextRequest, NextResponse } from "next/server"
import { fetchQuote } from "@/lib/yahoo"

export async function POST(req: NextRequest) {
  try {
    const { tickers } = await req.json()
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: "Provide array of tickers" }, { status: 400 })
    }

    const results = await Promise.allSettled(
      tickers.map((t: string) => fetchQuote(t.toUpperCase()))
    )

    const quotes = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof fetchQuote>>>).value)

    return NextResponse.json({ quotes })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
