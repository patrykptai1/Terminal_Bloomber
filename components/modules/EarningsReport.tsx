"use client"

import { useState } from "react"
import { CheckCircle, XCircle, Minus, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import BarCompareChart from "@/components/charts/BarCompareChart"
import type { QuoteData, EarningsData } from "@/lib/yahoo"
import { fmtBigValue } from "@/lib/currency"

/* ── TTM helper: compute rolling 4-quarter sum ── */
interface QVal { date: string; value: number | null }
interface TTMPoint { date: string; label: string; value: number; quarters: string[] }

function computeTTM(quarters: QVal[]): TTMPoint[] {
  const sorted = [...quarters].sort((a, b) => a.date.localeCompare(b.date))
  const results: TTMPoint[] = []
  for (let i = 3; i < sorted.length; i++) {
    const window = sorted.slice(i - 3, i + 1)
    if (window.every((q) => q.value != null)) {
      const sum = window.reduce((acc, q) => acc + (q.value ?? 0), 0)
      results.push({
        date: window[3].date,
        label: `TTM ${shortQLabel(window[3].date)}`,
        value: sum,
        quarters: window.map((q) => shortQLabel(q.date)),
      })
    }
  }
  return results
}

/* ── helper: format short quarter label like "Q1'25" ── */
function shortQLabel(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})/)
  if (m) {
    const month = parseInt(m[2])
    const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4
    return `Q${q}'${m[1].slice(2)}`
  }
  const m2 = date.match(/^(\d)Q(\d{4})/)
  if (m2) return `Q${m2[1]}'${m2[2].slice(2)}`
  return date
}

function yearFromDate(date: string): string {
  const m = date.match(/^(\d{4})/)
  return m ? m[1] : date
}

/* ── TTM Bar Chart Section ── */
function TTMBarSection({
  title,
  ttmData,
  annualData,
  forwardAnnual,
  currency,
  color = "bg-bloomberg-blue",
}: {
  title: string
  ttmData: TTMPoint[]
  annualData?: { date: string; value: number | null }[]
  forwardAnnual?: { date: string; estimate: number | null }[]
  currency: string
  color?: string
}) {
  // Build combined bars: annual history + computed TTM + forward annual estimates
  interface BarItem { label: string; sublabel: string; value: number; isEstimate: boolean; isTTM: boolean; date: string }
  const bars: BarItem[] = []

  // Add annual statements as long-term TTM (they ARE full-year = TTM)
  if (annualData) {
    for (const a of annualData) {
      if (a.value != null) {
        const year = yearFromDate(a.date)
        // Don't add annual if we already have a TTM ending in same fiscal year-end
        const hasTTMSameYear = ttmData.some((t) => yearFromDate(t.date) === year && t.date.endsWith(a.date.slice(5)))
        if (!hasTTMSameYear) {
          bars.push({ label: `FY${year}`, sublabel: "Annual", value: a.value, isEstimate: false, isTTM: false, date: a.date })
        }
      }
    }
  }

  // Add computed TTM from quarterly data
  for (const t of ttmData) {
    bars.push({ label: t.label, sublabel: t.quarters.join(" + "), value: t.value, isEstimate: false, isTTM: true, date: t.date })
  }

  // Add forward annual estimates
  if (forwardAnnual) {
    for (const f of forwardAnnual) {
      if (f.estimate != null) {
        const year = yearFromDate(f.date)
        if (!bars.some((b) => yearFromDate(b.date) === year)) {
          bars.push({ label: `FY${year} (E)`, sublabel: "Consensus Est.", value: f.estimate, isEstimate: true, isTTM: false, date: f.date })
        }
      }
    }
  }

  // Sort by date and deduplicate
  bars.sort((a, b) => a.date.localeCompare(b.date))

  if (bars.length === 0) return null
  const maxVal = Math.max(...bars.map((b) => Math.abs(b.value)))

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
      <div className="text-xs text-bloomberg-amber font-bold mb-1">{title}</div>
      <div className="text-[10px] text-muted-foreground mb-3">TTM = Trailing Twelve Months (suma 4 kwartałów) — eliminuje sezonowość</div>
      <div className="flex items-end gap-3 h-56">
        {bars.map((bar, i) => {
          const h = maxVal > 0 ? (Math.abs(bar.value) / maxVal) * 100 : 0
          const negative = bar.value < 0

          // YoY TTM growth: compare to bar ~1 year earlier
          let growth: number | null = null
          let compLabel = ""
          const barYear = parseInt(yearFromDate(bar.date))
          const yoyBar = bars.find((b) => {
            const bYear = parseInt(yearFromDate(b.date))
            return bYear === barYear - 1 && b.value !== 0
          })
          if (yoyBar) {
            growth = ((bar.value - yoyBar.value) / Math.abs(yoyBar.value)) * 100
            compLabel = `vs ${yoyBar.label}`
          }

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
              {growth != null && (
                <div className="flex flex-col items-center">
                  <div className={`text-[10px] font-bold flex items-center gap-0.5 ${growth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                    {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
                  </div>
                  <div className="text-[8px] text-muted-foreground text-center">{compLabel}</div>
                </div>
              )}
              {growth == null && <div className="h-[26px]" />}
              <div className="w-full flex items-end h-28">
                <div
                  className={`flex-1 rounded-t transition-all ${
                    bar.isEstimate
                      ? "border-2 border-dashed border-bloomberg-amber bg-bloomberg-amber/20"
                      : bar.isTTM
                        ? `${color} ring-1 ring-white/20`
                        : negative ? "bg-bloomberg-red" : `${color} opacity-60`
                  }`}
                  style={{ height: `${Math.max(h, 2)}%` }}
                />
              </div>
              <div className="text-[10px] text-center font-bold text-muted-foreground leading-tight">
                {bar.label}
              </div>
              <div className="text-[10px] text-muted-foreground text-center">
                {fmtBigValue(bar.value, currency)}
              </div>
              {bar.isTTM && <div className="text-[8px] text-bloomberg-blue font-bold">TTM</div>}
              {bar.isEstimate && <div className="text-[9px] text-bloomberg-amber font-bold">EST</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── TTM Table ── */
function TTMTable({
  title,
  ttmData,
  annualData,
  forwardAnnual,
  currency,
}: {
  title: string
  ttmData: TTMPoint[]
  annualData?: { date: string; value: number | null }[]
  forwardAnnual?: { date: string; estimate: number | null }[]
  currency: string
}) {
  interface RowItem { label: string; sublabel: string; value: number; isEstimate: boolean; date: string }
  const rows: RowItem[] = []

  if (annualData) {
    for (const a of annualData) {
      if (a.value != null) {
        const year = yearFromDate(a.date)
        const hasTTM = ttmData.some((t) => yearFromDate(t.date) === year && t.date.endsWith(a.date.slice(5)))
        if (!hasTTM) {
          rows.push({ label: `FY${year}`, sublabel: "Annual Report", value: a.value, isEstimate: false, date: a.date })
        }
      }
    }
  }

  for (const t of ttmData) {
    rows.push({ label: t.label, sublabel: t.quarters.join(" + "), value: t.value, isEstimate: false, date: t.date })
  }

  if (forwardAnnual) {
    for (const f of forwardAnnual) {
      if (f.estimate != null) {
        const year = yearFromDate(f.date)
        if (!rows.some((r) => yearFromDate(r.date) === year)) {
          rows.push({ label: `FY${year} (E)`, sublabel: "Consensus", value: f.estimate, isEstimate: true, date: f.date })
        }
      }
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date))
  if (rows.length === 0) return null

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
      <div className="text-xs text-bloomberg-amber font-bold mb-3">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-bloomberg-border">
              <th className="text-left py-2 text-muted-foreground">PERIOD</th>
              <th className="text-left py-2 text-muted-foreground">DETAIL</th>
              <th className="text-right py-2 text-muted-foreground">VALUE (TTM)</th>
              <th className="text-right py-2 text-muted-foreground">YoY CHANGE</th>
              <th className="text-center py-2 text-muted-foreground">TYPE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const barYear = parseInt(yearFromDate(row.date))
              const yoyRow = rows.find((r) => parseInt(yearFromDate(r.date)) === barYear - 1 && r.value !== 0)
              let change: number | null = null
              let compRef = ""
              if (yoyRow) {
                change = ((row.value - yoyRow.value) / Math.abs(yoyRow.value)) * 100
                compRef = `vs ${yoyRow.label}`
              }
              const positive = row.value >= 0
              return (
                <tr key={i} className="border-b border-bloomberg-border/50">
                  <td className="py-2 font-bold">{row.label}</td>
                  <td className="py-2 text-[10px] text-muted-foreground">{row.sublabel}</td>
                  <td className={`py-2 text-right font-bold ${positive ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                    {fmtBigValue(row.value, currency)}
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

  // Build EPS chart data: historical only
  const epsChartData = (e?.quarterly ?? []).map((row) => ({
    name: row.date.length > 7 ? row.date.slice(5) : row.date,
    valueA: row.estimate ?? 0,
    valueB: row.actual ?? 0,
    labelA: "Estimate",
    labelB: "Actual",
  }))

  // Income statement quarterly rows for TTM computation
  const revenueQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.revenue }))
  const ebitdaQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.ebitda }))
  const netIncomeQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.netIncome }))

  // Compute TTM rolling values
  const revenueTTM = computeTTM(revenueQ)
  const ebitdaTTM = computeTTM(ebitdaQ)
  const netIncomeTTM = computeTTM(netIncomeQ)

  // EPS TTM from quarterly actuals
  const epsQ = (e?.quarterly ?? []).map((q) => ({ date: q.date, value: q.actual }))
  const epsTTM = computeTTM(epsQ)

  // Annual data for long-term trend
  const annualRevenue = (e?.annualStatements ?? []).map((a) => ({ date: a.date, value: a.revenue }))
  const annualEbitda = (e?.annualStatements ?? []).map((a) => ({ date: a.date, value: a.ebitda }))
  const annualNetIncome = (e?.annualStatements ?? []).map((a) => ({ date: a.date, value: a.netIncome }))

  // Forward annual estimates for Revenue
  const fwdAnnualRevenue = fwdYearly
    .filter((f) => f.revEstimate != null)
    .map((f) => ({ date: f.endDate || f.period, estimate: f.revEstimate }))

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Earnings report — EPS, Revenue, EBITDA & Net Income with TTM (Trailing 12M) analysis (Yahoo Finance)
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
              <div className="text-right text-sm space-x-4">
                <span>
                  <span className="text-muted-foreground">EPS (TTM): </span>
                  <span className="font-bold">{q.eps?.toFixed(2) ?? "N/A"}</span>
                </span>
                {epsTTM.length > 0 && (
                  <span>
                    <span className="text-muted-foreground">EPS TTM (calc): </span>
                    <span className="font-bold">{epsTTM[epsTTM.length - 1].value.toFixed(2)}</span>
                  </span>
                )}
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
                          <td className="py-2 font-bold">{row.date} <span className="text-[10px] text-muted-foreground">{shortQLabel(row.date)}</span></td>
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
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS: ESTIMATE vs ACTUAL (HISTORICAL QUARTERLY)</div>
              <BarCompareChart data={epsChartData} />
            </div>
          )}

          {/* 1c. FORWARD EPS — YoY comparison cards */}
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

          {/* 1d. YEARLY EPS & REVENUE ESTIMATES */}
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

          {/* 1e. SURPRISE HISTORY */}
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
                        {shortQLabel(row.date)}
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

          {/* ═══ SECTION 2: REVENUE TTM (Przychody) ═══ */}

          {(revenueTTM.length > 0 || annualRevenue.some((a) => a.value != null)) && (
            <>
              <div className="border-t border-bloomberg-border pt-4 mt-2">
                <div className="text-sm font-bold text-bloomberg-green mb-3">REVENUE — PRZYCHODY (TTM)</div>
              </div>

              <TTMBarSection
                title="REVENUE TTM TREND"
                ttmData={revenueTTM}
                annualData={annualRevenue}
                forwardAnnual={fwdAnnualRevenue}
                currency={q.currency}
                color="bg-bloomberg-blue"
              />

              <TTMTable
                title="REVENUE TTM TABLE"
                ttmData={revenueTTM}
                annualData={annualRevenue}
                forwardAnnual={fwdAnnualRevenue}
                currency={q.currency}
              />
            </>
          )}

          {/* ═══ SECTION 3: EBITDA TTM ═══ */}

          {(ebitdaTTM.length > 0 || annualEbitda.some((a) => a.value != null)) && (
            <>
              <div className="border-t border-bloomberg-border pt-4 mt-2">
                <div className="text-sm font-bold text-bloomberg-green mb-3">EBITDA (TTM)</div>
              </div>

              <TTMBarSection
                title="EBITDA TTM TREND"
                ttmData={ebitdaTTM}
                annualData={annualEbitda}
                currency={q.currency}
                color="bg-bloomberg-purple"
              />

              <TTMTable
                title="EBITDA TTM TABLE"
                ttmData={ebitdaTTM}
                annualData={annualEbitda}
                currency={q.currency}
              />
            </>
          )}

          {/* ═══ SECTION 4: NET INCOME TTM — Zysk Netto ═══ */}

          {(netIncomeTTM.length > 0 || annualNetIncome.some((a) => a.value != null)) && (
            <>
              <div className="border-t border-bloomberg-border pt-4 mt-2">
                <div className="text-sm font-bold text-bloomberg-green mb-3">NET INCOME — ZYSK NETTO (TTM)</div>
              </div>

              <TTMBarSection
                title="NET INCOME TTM TREND"
                ttmData={netIncomeTTM}
                annualData={annualNetIncome}
                currency={q.currency}
                color="bg-bloomberg-green"
              />

              <TTMTable
                title="NET INCOME TTM TABLE"
                ttmData={netIncomeTTM}
                annualData={annualNetIncome}
                currency={q.currency}
              />
            </>
          )}

          {/* ═══ SECTION 5: MARGIN TREND (Revenue vs Earnings — TTM) ═══ */}

          {revenueTTM.length > 0 && netIncomeTTM.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">NET MARGIN TREND (TTM)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-bloomberg-border">
                      <th className="text-left py-2 text-muted-foreground">PERIOD</th>
                      <th className="text-right py-2 text-muted-foreground">REVENUE TTM</th>
                      <th className="text-right py-2 text-muted-foreground">NET INCOME TTM</th>
                      <th className="text-right py-2 text-muted-foreground">NET MARGIN</th>
                      <th className="text-center py-2 text-muted-foreground">TREND</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueTTM.map((rev, i) => {
                      const ni = netIncomeTTM.find((n) => n.date === rev.date)
                      if (!ni) return null
                      const margin = (ni.value / rev.value) * 100
                      const prevRev = i > 0 ? revenueTTM[i - 1] : null
                      const prevNI = prevRev ? netIncomeTTM.find((n) => n.date === prevRev.date) : null
                      const prevMargin = prevRev && prevNI ? (prevNI.value / prevRev.value) * 100 : null
                      const delta = prevMargin != null ? margin - prevMargin : null
                      return (
                        <tr key={i} className="border-b border-bloomberg-border/50">
                          <td className="py-2 font-bold">{rev.label}</td>
                          <td className="py-2 text-right">{fmtBigValue(rev.value, q.currency)}</td>
                          <td className={`py-2 text-right font-bold ${ni.value >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                            {fmtBigValue(ni.value, q.currency)}
                          </td>
                          <td className={`py-2 text-right font-bold ${margin >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                            {margin.toFixed(1)}%
                          </td>
                          <td className="py-2 text-center">
                            {delta != null ? (
                              <span className={`text-[10px] font-bold ${delta >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                                {delta >= 0 ? "+" : ""}{delta.toFixed(1)}pp
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
              <div className="mt-4 flex items-end gap-3 h-24">
                {revenueTTM.map((rev, i) => {
                  const ni = netIncomeTTM.find((n) => n.date === rev.date)
                  if (!ni) return null
                  const margin = (ni.value / rev.value) * 100
                  const maxMargin = Math.max(
                    ...revenueTTM.map((r) => {
                      const n = netIncomeTTM.find((n) => n.date === r.date)
                      return n ? Math.abs((n.value / r.value) * 100) : 0
                    })
                  )
                  const h = maxMargin > 0 ? (Math.abs(margin) / maxMargin) * 100 : 0
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end h-16">
                        <div
                          className={`flex-1 rounded-t ${margin >= 0 ? "bg-bloomberg-green" : "bg-bloomberg-red"}`}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">{rev.label}</div>
                      <div className={`text-[10px] font-bold ${margin >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                        {margin.toFixed(1)}%
                      </div>
                    </div>
                  )
                })}
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
