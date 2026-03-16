"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Minus, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import BarCompareChart from "@/components/charts/BarCompareChart"
import type { QuoteData, EarningsData } from "@/lib/yahoo"
import { fmtBigValue } from "@/lib/currency"

/* ── helper: find YoY match (same month-day, one year earlier) ── */
function findYoYMatch(date: string, allBars: { date: string; value: number | null }[]): { value: number | null; date: string } | null {
  const match = date.match(/^(\d{4})-(\d{2}-\d{2})$/)
  if (!match) return null
  const yearAgo = `${parseInt(match[1]) - 1}-${match[2]}`
  const found = allBars.find((b) => b.date === yearAgo)
  return found ? { value: found.value, date: yearAgo } : null
}

/* ── helper: format short quarter label like "Q1'25" ── */
function shortQLabel(date: string): string {
  // Handle YYYY-MM-DD format
  const m = date.match(/^(\d{4})-(\d{2})/)
  if (m) {
    const month = parseInt(m[2])
    const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4
    return `Q${q}'${m[1].slice(2)}`
  }
  // Handle "1Q2025" format from financialsChart
  const m2 = date.match(/^(\d)Q(\d{4})/)
  if (m2) return `Q${m2[1]}'${m2[2].slice(2)}`
  return date
}

/* ── helper: bar chart section (reusable for Revenue / EBITDA / Net Income) ── */
function FinancialBarSection({
  title,
  data,
  currency,
  color = "bg-bloomberg-blue",
  forwardBars,
}: {
  title: string
  data: { date: string; value: number | null }[]
  currency: string
  color?: string
  forwardBars?: { date: string; estimate: number | null; low?: number | null; high?: number | null }[]
}) {
  const combined = [
    ...data.map((d) => ({ date: d.date, value: d.value, isEstimate: false })),
    ...(forwardBars ?? [])
      .filter((f) => !data.some((d) => d.date === f.date))
      .map((f) => ({ date: f.date, value: f.estimate, isEstimate: true })),
  ]
  if (combined.length === 0) return null
  const maxVal = Math.max(...combined.map((r) => Math.abs(r.value ?? 0)))

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
      <div className="text-xs text-bloomberg-amber font-bold mb-3">{title}</div>
      <div className="flex items-end gap-3 h-48">
        {combined.map((row, i) => {
          const h = maxVal > 0 ? (Math.abs(row.value ?? 0) / maxVal) * 100 : 0
          const negative = (row.value ?? 0) < 0

          // Always compare YoY (same quarter last year) — most meaningful for seasonal businesses
          // Fallback to QoQ for actuals when no YoY data available
          let growth: number | null = null
          let compLabel = ""
          const yoyMatch = findYoYMatch(row.date, [...data, ...(forwardBars ?? []).map((f) => ({ date: f.date, value: f.estimate }))])
          if (yoyMatch && yoyMatch.value && yoyMatch.value !== 0 && row.value) {
            growth = ((row.value - yoyMatch.value) / Math.abs(yoyMatch.value)) * 100
            compLabel = `vs ${shortQLabel(yoyMatch.date)}`
          } else if (!row.isEstimate && i > 0) {
            const prev = combined[i - 1].value
            if (prev && prev !== 0 && row.value) {
              growth = ((row.value - prev) / Math.abs(prev)) * 100
              compLabel = `vs ${shortQLabel(combined[i - 1].date)}`
            }
          }

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              {growth != null && (
                <div className="flex flex-col items-center">
                  <div
                    className={`text-[10px] font-bold flex items-center gap-0.5 ${growth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}
                  >
                    {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {growth >= 0 ? "+" : ""}
                    {growth.toFixed(1)}%
                  </div>
                  <div className="text-[8px] text-muted-foreground">{compLabel}</div>
                </div>
              )}
              {growth == null && <div className="h-[26px]" />}
              <div className="w-full flex items-end h-24">
                <div
                  className={`flex-1 rounded-t transition-all ${row.isEstimate ? "border-2 border-dashed border-bloomberg-amber bg-bloomberg-amber/20" : negative ? "bg-bloomberg-red" : color}`}
                  style={{ height: `${Math.max(h, 2)}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground font-bold">
                {shortQLabel(row.date)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {row.value != null ? fmtBigValue(row.value, currency) : "N/A"}
              </div>
              {row.isEstimate && <div className="text-[9px] text-bloomberg-amber font-bold">EST</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── helper: financial table ── */
function FinancialTable({
  title,
  rows,
  currency,
}: {
  title: string
  rows: { date: string; value: number | null; isEstimate?: boolean }[]
  currency: string
}) {
  if (rows.length === 0) return null
  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
      <div className="text-xs text-bloomberg-amber font-bold mb-3">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-bloomberg-border">
              <th className="text-left py-2 text-muted-foreground">QUARTER</th>
              <th className="text-right py-2 text-muted-foreground">VALUE</th>
              <th className="text-right py-2 text-muted-foreground">CHANGE</th>
              <th className="text-center py-2 text-muted-foreground">TYPE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              // Always try YoY first, fallback QoQ for actuals
              let change: number | null = null
              let compRef = ""
              const yoyMatch = findYoYMatch(row.date, rows)
              if (yoyMatch && yoyMatch.value && yoyMatch.value !== 0 && row.value) {
                change = ((row.value - yoyMatch.value) / Math.abs(yoyMatch.value)) * 100
                compRef = `vs ${shortQLabel(yoyMatch.date)}`
              } else if (!row.isEstimate && i > 0) {
                const prev = rows[i - 1].value
                if (prev && prev !== 0 && row.value) {
                  change = ((row.value - prev) / Math.abs(prev)) * 100
                  compRef = `vs ${shortQLabel(rows[i - 1].date)}`
                }
              }
              const positive = (row.value ?? 0) >= 0
              return (
                <tr key={i} className="border-b border-bloomberg-border/50">
                  <td className="py-2 font-bold">{row.date} <span className="text-[10px] text-muted-foreground font-normal">{shortQLabel(row.date)}</span></td>
                  <td className={`py-2 text-right font-bold ${positive ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                    {row.value != null ? fmtBigValue(row.value, currency) : "N/A"}
                  </td>
                  <td className={`py-2 text-right ${change != null && change >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                    {change != null ? (
                      <span>{change >= 0 ? "+" : ""}{change.toFixed(1)}% <span className="text-[10px] text-muted-foreground">{compRef}</span></span>
                    ) : "---"}
                  </td>
                  <td className="py-2 text-center">
                    {row.isEstimate ? (
                      <span className="text-[10px] bg-bloomberg-amber/20 text-bloomberg-amber px-1.5 py-0.5 rounded font-bold">EST</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">ACTUAL</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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

  // Separate quarterly vs yearly forward estimates
  const fwdQuarterly = (e?.forwardEstimates ?? []).filter((f) => f.period === "0q" || f.period === "+1q")
  const fwdYearly = (e?.forwardEstimates ?? []).filter((f) => f.period === "0y" || f.period === "+1y")

  // Build forward estimate entries for revenue (quarterly only for chart)
  const fwdRevenue = fwdQuarterly
    .filter((f) => f.revEstimate != null)
    .map((f) => ({
      date: f.endDate || f.period,
      estimate: f.revEstimate,
      low: f.revLow,
      high: f.revHigh,
    }))

  // Build EPS chart data: historical only (no forward — they are shown separately as YoY)
  const epsChartData = (e?.quarterly ?? []).map((row) => ({
    name: row.date.length > 7 ? row.date.slice(5) : row.date,
    valueA: row.estimate ?? 0,
    valueB: row.actual ?? 0,
    labelA: "Estimate",
    labelB: "Actual",
  }))

  // Income statement rows
  const revenueRows = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.revenue }))
  const ebitdaRows = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.ebitda }))
  const netIncomeRows = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.netIncome }))

  // Add forward revenue estimates to table
  const revTableRows = [
    ...revenueRows.map((r) => ({ ...r, isEstimate: false })),
    ...fwdRevenue
      .filter((f) => !revenueRows.some((r) => r.date === f.date))
      .map((f) => ({ date: f.date, value: f.estimate, isEstimate: true })),
  ]

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Earnings report -- EPS, Revenue, EBITDA & Net Income with forward estimates (Yahoo Finance)
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

          {/* ═══ SECTION 1: EPS (Zysk na Akcję) ═══ */}

          {/* 1a. EPS BEAT/MISS TABLE */}
          {e.quarterly.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS — ZYSK NA AKCJĘ (QUARTERLY)</div>
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
                    {/* Forward EPS estimates (quarterly only) */}
                    {fwdQuarterly
                      .filter((f) => f.epsEstimate != null && !e.quarterly.some((q) => q.date === (f.endDate || f.period)))
                      .map((f, i) => (
                        <tr key={`fwd-${i}`} className="border-b border-bloomberg-border/50 bg-bloomberg-amber/5">
                          <td className="py-2 font-bold">
                            {f.endDate || f.period}
                            <span className="ml-1 text-[10px] text-bloomberg-amber font-bold">EST</span>
                          </td>
                          <td className="py-2 text-right text-bloomberg-amber font-bold">{f.epsEstimate?.toFixed(2) ?? "N/A"}</td>
                          <td className="py-2 text-right text-muted-foreground">---</td>
                          <td className="py-2 text-right text-muted-foreground">---</td>
                          <td className="py-2 text-right text-muted-foreground">---</td>
                          <td className="py-2 text-center">
                            <span className="text-[10px] bg-bloomberg-amber/20 text-bloomberg-amber px-1.5 py-0.5 rounded font-bold">FORECAST</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 1b. EPS BAR CHART — Estimate vs Actual (historical) */}
          {epsChartData.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS: ESTIMATE vs ACTUAL (HISTORICAL)</div>
              <BarCompareChart data={epsChartData} />
            </div>
          )}

          {/* 1b2. FORWARD EPS — YoY comparison cards */}
          {fwdQuarterly.filter((f) => f.epsEstimate != null).length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">FORWARD EPS ESTIMATES — YoY COMPARISON</div>
              <div className="grid grid-cols-2 gap-4">
                {fwdQuarterly
                  .filter((f) => f.epsEstimate != null)
                  .map((f, i) => {
                    const qLabel = f.endDate ? f.endDate.slice(0, 7) : f.period
                    const yoyGrowth = f.yearAgoEps && f.epsEstimate
                      ? ((f.epsEstimate - f.yearAgoEps) / Math.abs(f.yearAgoEps)) * 100
                      : null
                    return (
                      <div key={i} className="bg-bloomberg-bg rounded p-3 border border-bloomberg-border/50">
                        <div className="text-sm font-bold text-bloomberg-amber mb-2">
                          {qLabel} <span className="text-[10px] font-bold bg-bloomberg-amber/20 px-1.5 py-0.5 rounded">ESTIMATE</span>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">EPS Forecast</span>
                            <span className="font-bold text-base">${f.epsEstimate?.toFixed(3)}</span>
                          </div>
                          {f.epsLow != null && f.epsHigh != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Range</span>
                              <span className="text-muted-foreground">${f.epsLow.toFixed(3)} — ${f.epsHigh.toFixed(3)}</span>
                            </div>
                          )}
                          {f.yearAgoEps != null && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Year Ago (Actual)</span>
                              <span className="font-bold">${f.yearAgoEps.toFixed(3)}</span>
                            </div>
                          )}
                          {yoyGrowth != null && (
                            <div className="flex justify-between items-center pt-1 border-t border-bloomberg-border/50">
                              <span className="text-muted-foreground font-bold">YoY Growth</span>
                              <span className={`font-bold text-sm ${yoyGrowth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                                {yoyGrowth >= 0 ? "+" : ""}{yoyGrowth.toFixed(1)}%
                                {yoyGrowth >= 0 ? " ▲" : " ▼"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* 1b2. YEARLY EPS & REVENUE ESTIMATES */}
          {fwdYearly.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">ANNUAL ESTIMATES (CONSENSUS)</div>
              <div className="grid grid-cols-2 gap-4">
                {fwdYearly.map((f, i) => {
                  const yearLabel = f.endDate ? f.endDate.slice(0, 4) : f.period
                  const epsGrowth = f.yearAgoEps && f.epsEstimate ? ((f.epsEstimate - f.yearAgoEps) / Math.abs(f.yearAgoEps)) * 100 : null
                  const revGrowth = f.yearAgoRev && f.revEstimate ? ((f.revEstimate - f.yearAgoRev) / Math.abs(f.yearAgoRev)) * 100 : null
                  return (
                    <div key={i} className="bg-bloomberg-bg rounded p-3 border border-bloomberg-border/50">
                      <div className="text-sm font-bold text-bloomberg-green mb-2">FY {yearLabel} {f.period === "0y" ? "(Current)" : "(Next)"}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">EPS Estimate</span>
                          <span className="font-bold">${f.epsEstimate?.toFixed(2) ?? "N/A"}</span>
                        </div>
                        {f.epsLow != null && f.epsHigh != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">EPS Range</span>
                            <span className="text-muted-foreground">${f.epsLow.toFixed(2)} — ${f.epsHigh.toFixed(2)}</span>
                          </div>
                        )}
                        {epsGrowth != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">EPS YoY</span>
                            <span className={`font-bold ${epsGrowth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                              {epsGrowth >= 0 ? "+" : ""}{epsGrowth.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {f.revEstimate != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue Est.</span>
                            <span className="font-bold">{fmtBigValue(f.revEstimate, q.currency)}</span>
                          </div>
                        )}
                        {revGrowth != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rev YoY</span>
                            <span className={`font-bold ${revGrowth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                              {revGrowth >= 0 ? "+" : ""}{revGrowth.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 1c. SURPRISE HISTORY */}
          {e.quarterly.length > 0 && e.quarterly.some((r) => r.surprise != null) && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS SURPRISE HISTORY</div>
              <div className="space-y-2">
                {e.quarterly.map((row, i) => {
                  const isBeat = row.surprise != null && row.surprise > 0
                  const isMiss = row.surprise != null && row.surprise < 0
                  const isNeutral = row.surprise == null || row.surprise === 0
                  const magnitude = row.surprisePercent != null ? Math.abs(row.surprisePercent) : 0
                  const maxSurprise = Math.max(
                    ...e.quarterly.filter((r) => r.surprisePercent != null).map((r) => Math.abs(r.surprisePercent!)),
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
                            className={`h-full rounded transition-all ${isBeat ? "bg-bloomberg-green/60" : isMiss ? "bg-bloomberg-red/60" : "bg-bloomberg-amber/30"}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className={`w-16 text-right text-xs font-bold shrink-0 ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : "text-muted-foreground"}`}>
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
              {(() => {
                const beats = e.quarterly.filter((r) => r.surprise != null && r.surprise > 0).length
                const misses = e.quarterly.filter((r) => r.surprise != null && r.surprise < 0).length
                const total = e.quarterly.filter((r) => r.surprise != null).length
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

          {/* ═══ SECTION 2: REVENUE (Przychody) ═══ */}

          {(revenueRows.length > 0 || fwdRevenue.length > 0) && (
            <>
              <div className="border-t border-bloomberg-border pt-4 mt-2">
                <div className="text-sm font-bold text-bloomberg-green mb-3">REVENUE — PRZYCHODY</div>
              </div>

              <FinancialBarSection
                title="REVENUE TREND (QUARTERLY) + FORWARD ESTIMATES"
                data={revenueRows}
                currency={q.currency}
                color="bg-bloomberg-blue"
                forwardBars={fwdRevenue}
              />

              <FinancialTable
                title="REVENUE TABLE"
                rows={revTableRows}
                currency={q.currency}
              />
            </>
          )}

          {/* ═══ SECTION 3: EBITDA ═══ */}

          {ebitdaRows.length > 0 && ebitdaRows.some((r) => r.value != null) && (
            <>
              <div className="border-t border-bloomberg-border pt-4 mt-2">
                <div className="text-sm font-bold text-bloomberg-green mb-3">EBITDA</div>
              </div>

              <FinancialBarSection
                title="EBITDA TREND (QUARTERLY)"
                data={ebitdaRows}
                currency={q.currency}
                color="bg-bloomberg-purple"
              />

              <FinancialTable
                title="EBITDA TABLE"
                rows={ebitdaRows.map((r) => ({ ...r, isEstimate: false }))}
                currency={q.currency}
              />
            </>
          )}

          {/* ═══ SECTION 4: NET INCOME — Zysk Netto ═══ */}

          {netIncomeRows.length > 0 && netIncomeRows.some((r) => r.value != null) && (
            <>
              <div className="border-t border-bloomberg-border pt-4 mt-2">
                <div className="text-sm font-bold text-bloomberg-green mb-3">NET INCOME — ZYSK NETTO</div>
              </div>

              <FinancialBarSection
                title="NET INCOME TREND (QUARTERLY)"
                data={netIncomeRows}
                currency={q.currency}
                color="bg-bloomberg-green"
              />

              <FinancialTable
                title="NET INCOME TABLE"
                rows={netIncomeRows.map((r) => ({ ...r, isEstimate: false }))}
                currency={q.currency}
              />
            </>
          )}

          {/* ═══ SECTION 5: MARGIN TREND (Revenue vs Earnings) ═══ */}

          {e.financials.length > 0 && e.financials.some((r) => r.revenue && r.earnings) && (
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
                      const prevMargin =
                        i > 0 && e.financials[i - 1].revenue && e.financials[i - 1].earnings
                          ? (e.financials[i - 1].earnings! / e.financials[i - 1].revenue!) * 100
                          : null
                      const marginDelta = margin != null && prevMargin != null ? margin - prevMargin : null
                      const prevLabel = i > 0 ? shortQLabel(e.financials[i - 1].date) : ""
                      return (
                        <tr key={i} className="border-b border-bloomberg-border/50">
                          <td className="py-2 font-bold">{row.date} <span className="text-[10px] text-muted-foreground font-normal">{shortQLabel(row.date)}</span></td>
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
                                <span className="text-muted-foreground font-normal ml-1">vs {prevLabel}</span>
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
              <div className="mt-4">
                <div className="flex items-end gap-3 h-24">
                  {e.financials.map((row, i) => {
                    const margin = row.revenue && row.earnings ? (row.earnings / row.revenue) * 100 : 0
                    const maxMargin = Math.max(
                      ...e.financials.map((r) => (r.revenue && r.earnings ? Math.abs((r.earnings / r.revenue) * 100) : 0))
                    )
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

          {e.quarterly.length === 0 && e.financials.length === 0 && (e.incomeStatements ?? []).length === 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4 text-center text-muted-foreground text-sm">
              No earnings data available for this ticker
            </div>
          )}
        </div>
      )}
    </div>
  )
}
