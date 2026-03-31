import { NextRequest, NextResponse } from "next/server"
import { fetchQuote } from "@/lib/yahoo"
import YahooFinanceModule from "yahoo-finance2"

const yf = new (YahooFinanceModule as any)({ suppressNotices: ["yahooSurvey"] })

export const dynamic = "force-dynamic"

async function fetchFxRates(): Promise<Record<string, number>> {
  // fxRates[CUR] = how many USD per 1 unit of CUR
  // e.g. PLN: 0.27 means 1 PLN = 0.27 USD
  const pairs: [string, string][] = [["PLNUSD=X", "PLN"], ["EURUSD=X", "EUR"], ["GBPUSD=X", "GBP"]]
  const rates: Record<string, number> = { USD: 1 }
  try {
    const results = await Promise.allSettled(
      pairs.map(([sym]) => yf.quote(sym))
    )
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === "fulfilled" && r.value) {
        const price = Number((r.value as any).regularMarketPrice ?? 0)
        if (price > 0) rates[pairs[i][1]] = price
      }
    }
  } catch { /* fallback: no conversion */ }
  return rates
}

export async function POST(req: NextRequest) {
  try {
    const { tickers } = await req.json()
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: "Provide array of tickers" }, { status: 400 })
    }

    const [results, fxRates] = await Promise.all([
      Promise.allSettled(tickers.map((t: string) => fetchQuote(t.toUpperCase()))),
      fetchFxRates(),
    ])

    const quotes = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof fetchQuote>>>).value)

    return NextResponse.json({ quotes, fxRates })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
