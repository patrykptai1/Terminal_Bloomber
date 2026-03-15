"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Minus, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import BarCompareChart from "@/components/charts/BarCompareChart"
import type { QuoteData, EarningsData } from "@/lib/yahoo"
import { fmtBigValue } from "@/lib/currency"

export default function EarningsReport() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ quote: QuoteData; earnings: EarningsData } | null>(null)
  const [error, setError] = useState("")

  const handleAnalyze = async (ticker: string) => {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch("/api/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  const q = data?.quote
  const e = data?.earnings

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Earnings history -- EPS beats/misses, revenue & earnings per quarter (Yahoo Finance)
      </div>
      <TerminalInput
        placeholder="Enter ticker (e.g. AAPL, GOOGL, TSLA)"
        onSubmit={handleAnalyze}
        loading={loading}
        label="EARNINGS >"
      />

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {q && e && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <span className="text-xl font-bold text-bloomberg-green">{q.symbol}</span>
                <span className="text-sm text-muted-foreground ml-2">{q.name}</span>
              </div>
              <div className="text-right text-sm">
                <span className="text-muted-foreground">EPS (TTM): </span>
                <span className="font-bold">{q.eps?.toFixed(2) ?? "N/A"}</span>
              </div>
            </div>
          </div>

          {/* 1. BEAT/MISS TABLE */}
          {e.quarterly.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS HISTORY (QUARTERLY)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-bloomberg-border">
                      <th className="text-left py-2 text-muted-foreground">QUARTER</th>
                      <th className="text-right py-2 text-muted-foreground">ESTIMATE</th>
                      <th className="text-right py-2 text-muted-foreground">ACTUAL</th>
                      <th className="text-right py-2 text-muted-foreground">SURPRISE</th>
                      <th className="text-right py-2 text-muted-foreground">%</th>
                      <th className="text-center py-2 text-muted-foreground">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.quarterly.map((row, i) => {
                      const isBeat = row.surprise != null && row.surprise > 0
                      const isMiss = row.surprise != null && row.surprise < 0
                      return (
                        <tr key={i} className="border-b border-bloomberg-border/50">
                          <td className="py-2 font-bold">{row.date}</td>
                          <td className="py-2 text-right text-muted-foreground">{row.estimate?.toFixed(2) ?? "N/A"}</td>
                          <td className={`py-2 text-right font-bold ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : ""}`}>
                            {row.actual?.toFixed(2) ?? "N/A"}
                          </td>
                          <td className={`py-2 text-right ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : ""}`}>
                            {row.surprise != null ? (row.surprise > 0 ? "+" : "") + row.surprise.toFixed(2) : "N/A"}
                          </td>
                          <td className={`py-2 text-right ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : ""}`}>
                            {row.surprisePercent != null ? (row.surprisePercent > 0 ? "+" : "") + row.surprisePercent.toFixed(1) + "%" : "N/A"}
                          </td>
                          <td className="py-2 text-center">
                            {isBeat ? <CheckCircle className="w-4 h-4 text-bloomberg-green inline" /> :
                             isMiss ? <XCircle className="w-4 h-4 text-bloomberg-red inline" /> :
                             <Minus className="w-4 h-4 text-bloomberg-amber inline" />}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. EPS BAR CHART — Estimate vs Actual */}
          {e.quarterly.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS: ESTIMATE vs ACTUAL</div>
              <BarCompareChart
                data={e.quarterly.map((row) => ({
                  name: row.date.length > 7 ? row.date.slice(5) : row.date,
                  valueA: row.estimate ?? 0,
                  valueB: row.actual ?? 0,
                  labelA: "Estimate",
                  labelB: "Actual",
                }))}
              />
            </div>
          )}

          {/* 3. REVENUE TREND with growth labels */}
          {e.financials.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">REVENUE TREND (QUARTERLY)</div>
              <div className="flex items-end gap-3 h-40">
                {e.financials.map((row, i) => {
                  const maxRev = Math.max(...e.financials.map(r => Math.abs(r.revenue ?? 0)))
                  const h = maxRev > 0 ? Math.abs(row.revenue ?? 0) / maxRev * 100 : 0
                  const prevRev = i > 0 ? e.financials[i - 1].revenue : null
                  const growth = prevRev && prevRev !== 0 && row.revenue
                    ? ((row.revenue - prevRev) / Math.abs(prevRev)) * 100
                    : null
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      {growth != null && (
                        <div className={`text-[10px] font-bold flex items-center gap-0.5 ${growth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                          {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                        </div>
                      )}
                      {growth == null && <div className="text-[10px] text-transparent">---</div>}
                      <div className="w-full flex items-end h-24">
                        <div className="flex-1 bg-bloomberg-blue rounded-t transition-all" style={{ height: `${h}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground font-bold">{row.date}</div>
                      <div className="text-[10px] text-muted-foreground">{row.revenue != null ? fmtBigValue(row.revenue, q.currency) : "N/A"}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. MARGIN TREND */}
          {e.financials.length > 0 && e.financials.some(r => r.revenue && r.earnings) && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EARNINGS MARGIN TREND</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-bloomberg-border">
                      <th className="text-left py-2 text-muted-foreground">QUARTER</th>
                      <th className="text-right py-2 text-muted-foreground">REVENUE</th>
                      <th className="text-right py-2 text-muted-foreground">EARNINGS</th>
                      <th className="text-right py-2 text-muted-foreground">MARGIN</th>
                      <th className="text-center py-2 text-muted-foreground">TREND</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.financials.map((row, i) => {
                      const margin = row.revenue && row.earnings ? (row.earnings / row.revenue) * 100 : null
                      const prevMargin = i > 0 && e.financials[i - 1].revenue && e.financials[i - 1].earnings
                        ? (e.financials[i - 1].earnings! / e.financials[i - 1].revenue!) * 100
                        : null
                      const marginDelta = margin != null && prevMargin != null ? margin - prevMargin : null
                      return (
                        <tr key={i} className="border-b border-bloomberg-border/50">
                          <td className="py-2 font-bold">{row.date}</td>
                          <td className="py-2 text-right">{row.revenue != null ? fmtBigValue(row.revenue, q.currency) : "N/A"}</td>
                          <td className={`py-2 text-right font-bold ${row.earnings && row.earnings > 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                            {row.earnings != null ? fmtBigValue(row.earnings, q.currency) : "N/A"}
                          </td>
                          <td className={`py-2 text-right font-bold ${margin != null && margin > 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                            {margin != null ? margin.toFixed(1) + "%" : "N/A"}
                          </td>
                          <td className="py-2 text-center">
                            {marginDelta != null ? (
                              <span className={`text-[10px] font-bold ${marginDelta >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                                {marginDelta >= 0 ? "+" : ""}{marginDelta.toFixed(1)}pp
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">---</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Margin visual bar */}
              <div className="mt-4">
                <div className="flex items-end gap-3 h-24">
                  {e.financials.map((row, i) => {
                    const margin = row.revenue && row.earnings ? (row.earnings / row.revenue) * 100 : 0
                    const maxMargin = Math.max(...e.financials.map(r =>
                      r.revenue && r.earnings ? Math.abs((r.earnings / r.revenue) * 100) : 0
                    ))
                    const h = maxMargin > 0 ? (Math.abs(margin) / maxMargin) * 100 : 0
                    const positive = margin >= 0
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end h-16">
                          <div
                            className={`flex-1 rounded-t ${positive ? "bg-bloomberg-green" : "bg-bloomberg-red"}`}
                            style={{ height: `${h}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground">{row.date}</div>
                        <div className={`text-[10px] font-bold ${positive ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                          {margin.toFixed(1)}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 5. SURPRISE HISTORY — color-coded */}
          {e.quarterly.length > 0 && e.quarterly.some(r => r.surprise != null) && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">SURPRISE HISTORY</div>
              <div className="space-y-2">
                {e.quarterly.map((row, i) => {
                  const isBeat = row.surprise != null && row.surprise > 0
                  const isMiss = row.surprise != null && row.surprise < 0
                  const isNeutral = row.surprise == null || row.surprise === 0
                  const magnitude = row.surprisePercent != null ? Math.abs(row.surprisePercent) : 0

                  // Bar width relative to max surprise
                  const maxSurprise = Math.max(
                    ...e.quarterly
                      .filter(r => r.surprisePercent != null)
                      .map(r => Math.abs(r.surprisePercent!)),
                    1
                  )
                  const barWidth = magnitude > 0 ? Math.max(5, (magnitude / maxSurprise) * 100) : 0

                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground shrink-0 font-mono">
                        {row.date.length > 7 ? row.date.slice(5) : row.date}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-5 bg-bloomberg-bg rounded overflow-hidden relative">
                          <div
                            className={`h-full rounded transition-all ${
                              isBeat ? "bg-bloomberg-green/60" : isMiss ? "bg-bloomberg-red/60" : "bg-bloomberg-amber/30"
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className={`w-16 text-right text-xs font-bold shrink-0 ${
                          isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : "text-muted-foreground"
                        }`}>
                          {isNeutral ? "---" : (
                            <>
                              {isBeat ? "BEAT" : "MISS"}{" "}
                              {row.surprisePercent != null ? `${Math.abs(row.surprisePercent).toFixed(1)}%` : ""}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {isBeat ? <CheckCircle className="w-4 h-4 text-bloomberg-green" /> :
                         isMiss ? <XCircle className="w-4 h-4 text-bloomberg-red" /> :
                         <Minus className="w-4 h-4 text-bloomberg-amber" />}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              {(() => {
                const beats = e.quarterly.filter(r => r.surprise != null && r.surprise > 0).length
                const misses = e.quarterly.filter(r => r.surprise != null && r.surprise < 0).length
                const total = e.quarterly.filter(r => r.surprise != null).length
                return (
                  <div className="mt-3 pt-3 border-t border-bloomberg-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Track Record</span>
                    <div className="flex gap-4">
                      <span className="text-bloomberg-green font-bold">{beats} Beats</span>
                      <span className="text-bloomberg-red font-bold">{misses} Misses</span>
                      <span className="text-muted-foreground">{total - beats - misses} Inline</span>
                      <span className={`font-bold ${beats > misses ? "text-bloomberg-green" : beats < misses ? "text-bloomberg-red" : "text-bloomberg-amber"}`}>
                        ({total > 0 ? ((beats / total) * 100).toFixed(0) : 0}% beat rate)
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {e.quarterly.length === 0 && e.financials.length === 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4 text-center text-muted-foreground text-sm">
              No earnings data available for this ticker
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// fmtB removed — using fmtBigValue from @/lib/currency
