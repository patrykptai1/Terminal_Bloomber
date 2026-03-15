"use client"

import { useState } from "react"
import { Filter, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import type { QuoteData, KeyStatistics } from "@/lib/yahoo"

const STRATEGIES = ["growth", "value", "dividend", "momentum", "quality", "small-cap"]
const MARKETS = ["ALL", "US", "PL"]

const STRATEGY_DESC: Record<string, string> = {
  growth: "Revenue growth > 10%, positive earnings growth",
  value: "P/E < 20, P/B < 3",
  dividend: "Dividend yield > 2%",
  momentum: "Positive momentum, price > 20% above 52w low",
  quality: "ROE > 15%, profit margin > 10%",
  "small-cap": "Market cap < $10B",
}

interface ScreenerResult {
  strategy: string
  total: number
  matched: number
  stocks: { quote: QuoteData; stats: KeyStatistics | null }[]
}

export default function StockScreener() {
  const [strategy, setStrategy] = useState("growth")
  const [market, setMarket] = useState("ALL")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ScreenerResult | null>(null)
  const [error, setError] = useState("")

  const handleScreen = async () => {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch("/api/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy, market }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Screener failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Screen 60+ stocks (US + GPW) by strategy — real-time Yahoo Finance data
      </div>

      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4 space-y-4">
        <div>
          <label className="text-xs text-bloomberg-amber block mb-1">STRATEGY</label>
          <div className="flex flex-wrap gap-2">
            {STRATEGIES.map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  strategy === s
                    ? "bg-bloomberg-green/20 text-bloomberg-green border-bloomberg-green/50"
                    : "bg-bloomberg-card border-bloomberg-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Filter: {STRATEGY_DESC[strategy]}</div>
        </div>

        <div>
          <label className="text-xs text-bloomberg-amber block mb-1">MARKET</label>
          <div className="flex gap-2">
            {MARKETS.map((m) => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  market === m
                    ? "bg-bloomberg-amber/20 text-bloomberg-amber border-bloomberg-amber/50"
                    : "bg-bloomberg-card border-bloomberg-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleScreen}
          disabled={loading}
          className="px-6 py-2 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded text-xs font-bold hover:bg-bloomberg-green/30 disabled:opacity-40 transition-colors"
        >
          {loading ? "SCANNING..." : "RUN SCREENER"}
        </button>
        {loading && <div className="text-xs text-muted-foreground">Fetching data for 60+ stocks... this may take 15-30 seconds</div>}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-bloomberg-amber" />
            <span className="text-bloomberg-amber font-bold">{data.strategy.toUpperCase()}</span>
            <span className="text-muted-foreground">— {data.matched} matches out of {data.total} scanned</span>
          </div>

          <div className="bg-bloomberg-card border border-bloomberg-border rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-bloomberg-border bg-bloomberg-bg">
                    <th className="text-left py-2 px-3 text-muted-foreground">TICKER</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">NAME</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">PRICE</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">CHG%</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">MKT CAP</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">P/E</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">
                      {strategy === "growth" ? "REV GR" :
                       strategy === "dividend" ? "DIV YIELD" :
                       strategy === "quality" ? "ROE" :
                       strategy === "value" ? "P/B" : "CHG%"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.stocks.map((row, i) => {
                    const q = row.quote
                    const s = row.stats
                    let keyMetric = ""
                    switch (strategy) {
                      case "growth": keyMetric = s?.revenueGrowth != null ? `${(s.revenueGrowth * 100).toFixed(1)}%` : "N/A"; break
                      case "value": keyMetric = s?.priceToBook != null ? s.priceToBook.toFixed(2) : "N/A"; break
                      case "dividend": keyMetric = q.dividendYield ? `${(q.dividendYield * 100).toFixed(2)}%` : "N/A"; break
                      case "quality": keyMetric = s?.returnOnEquity != null ? `${(s.returnOnEquity * 100).toFixed(1)}%` : "N/A"; break
                      default: keyMetric = `${q.changePercent.toFixed(2)}%`
                    }
                    return (
                      <tr key={i} className="border-b border-bloomberg-border/30 hover:bg-bloomberg-bg/50">
                        <td className="py-2 px-3 font-bold text-bloomberg-green">{q.symbol}</td>
                        <td className="py-2 px-3 text-muted-foreground truncate max-w-[150px]">{q.name}</td>
                        <td className="py-2 px-3 text-right font-bold">${q.price.toFixed(2)}</td>
                        <td className={`py-2 px-3 text-right ${q.changePercent >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                          <span className="inline-flex items-center gap-0.5">
                            {q.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {q.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">{fmtB(q.marketCap)}</td>
                        <td className="py-2 px-3 text-right">{q.peRatio?.toFixed(1) ?? "N/A"}</td>
                        <td className="py-2 px-3 text-right font-bold text-bloomberg-amber">{keyMetric}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {data.stocks.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-4">
              No stocks matched the {strategy} criteria
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function fmtB(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}
