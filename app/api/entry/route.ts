import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, fetchHistory } from "@/lib/yahoo"
import { computeFullAnalysis } from "@/lib/analysis"
import { fetchNews } from "@/lib/news"
import type { HistoricalPrice } from "@/lib/yahoo"

function computeSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null
  const slice = prices.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null
  let gains = 0, losses = 0
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  if (losses === 0) return 100
  const rs = (gains / period) / (losses / period)
  return 100 - 100 / (1 + rs)
}

function findLevels(history: HistoricalPrice[], current: number) {
  const lows = history.map(h => h.low).sort((a, b) => a - b)
  const highs = history.map(h => h.high).sort((a, b) => a - b)

  const supports = [...new Set(lows.filter(l => l < current * 0.995))]
    .sort((a, b) => b - a).slice(0, 3)

  const resistances = [...new Set(highs.filter(h => h > current * 1.005))]
    .sort((a, b) => a - b).slice(0, 3)

  return { supports, resistances }
}

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

    const analysis = computeFullAnalysis(quote, stats, history, stats?.sector ?? undefined)

    // Compute technicals from history
    const closes = history.map(h => h.close)
    const sma20 = computeSMA(closes, 20)
    const sma50 = computeSMA(closes, 50)
    const sma200 = computeSMA(closes, Math.min(200, closes.length))
    const rsi = computeRSI(closes)
    const { supports, resistances } = findLevels(history, quote.price)

    const recentVols = history.slice(-5).map(h => h.volume)
    const avgRecentVol = recentVols.length ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0
    const volTrend = quote.avgVolume > 0 ? avgRecentVol / quote.avgVolume : 1

    const pctFrom52High = quote.high52 > 0 ? ((quote.high52 - quote.price) / quote.high52 * 100) : 0
    const pctFrom52Low = quote.low52 > 0 ? ((quote.price - quote.low52) / quote.low52 * 100) : 0

    const technicals = {
      sma20,
      sma50,
      sma200,
      rsi,
      volumeTrend: volTrend,
      supports,
      resistances,
      pctFrom52High: +pctFrom52High.toFixed(2),
      pctFrom52Low: +pctFrom52Low.toFixed(2),
      priceVsSma20: sma20 ? +((quote.price / sma20 - 1) * 100).toFixed(2) : null,
      priceVsSma50: sma50 ? +((quote.price / sma50 - 1) * 100).toFixed(2) : null,
      priceVsSma200: sma200 ? +((quote.price / sma200 - 1) * 100).toFixed(2) : null,
    }

    // Update news with company name if initial fetch was empty
    let finalNews = news
    if (news.length === 0 && quote.name) {
      finalNews = await fetchNews(sym, quote.name).catch(() => [])
    }

    return NextResponse.json({
      quote,
      analysis,
      technicals,
      history: history.slice(-250),
      news: finalNews,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
