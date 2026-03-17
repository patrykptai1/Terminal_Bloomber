"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { CheckCircle, XCircle, Minus, AlertTriangle, TrendingUp, TrendingDown, Info } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts"
import TerminalInput from "@/components/TerminalInput"
import BarCompareChart from "@/components/charts/BarCompareChart"
import type { QuoteData, EarningsData } from "@/lib/yahoo"
import { fmtBigValue } from "@/lib/currency"

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */

interface QVal { date: string; value: number | null }
interface TTMPoint { date: string; label: string; value: number; quarters: string[] }

function computeTTM(quarters: QVal[]): TTMPoint[] {
  const sorted = [...quarters].sort((a, b) => a.date.localeCompare(b.date))
  const results: TTMPoint[] = []
  for (let i = 3; i < sorted.length; i++) {
    const window = sorted.slice(i - 3, i + 1)
    if (window.every((q) => q.value != null)) {
      const sum = window.reduce((acc, q) => acc + (q.value ?? 0), 0)
      results.push({ date: window[3].date, label: `TTM ${shortQLabel(window[3].date)}`, value: sum, quarters: window.map((q) => shortQLabel(q.date)) })
    }
  }
  return results
}

function shortQLabel(d: string): string {
  const m = d.match(/^(\d{4})-(\d{2})/); if (m) { const mo = parseInt(m[2]); const q = mo <= 3 ? 1 : mo <= 6 ? 2 : mo <= 9 ? 3 : 4; return `Q${q}'${m[1].slice(2)}` }
  const m2 = d.match(/^(\d)Q(\d{4})/); if (m2) return `Q${m2[1]}'${m2[2].slice(2)}`; return d
}
function yearFromDate(d: string): string { const m = d.match(/^(\d{4})/); return m ? m[1] : d }
function fmtShares(n: number): string { if (n >= 1e9) return (n / 1e9).toFixed(2) + "B"; if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1e3) return (n / 1e3).toFixed(0) + "K"; return n.toString() }
function fmtPct(n: number | null): string { return n != null ? `${(n * 100).toFixed(1)}%` : "N/A" }
function Explainer({ text }: { text: string }) {
  return <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mt-1"><Info className="w-3 h-3 mt-0.5 shrink-0 opacity-50" /><span>{text}</span></div>
}

/* ══════════════════════════════════════════════════════════════
   TTM BAR CHART
   ══════════════════════════════════════════════════════════════ */

function TTMBarSection({ title, ttmData, annualData, forwardAnnual, currency, color = "bg-bloomberg-blue", explainer }: {
  title: string; ttmData: TTMPoint[]; annualData?: { date: string; value: number | null }[]; forwardAnnual?: { date: string; estimate: number | null }[]; currency: string; color?: string; explainer?: string
}) {
  interface BarItem { label: string; value: number; isEstimate: boolean; isTTM: boolean; date: string }
  const bars: BarItem[] = []
  if (annualData) for (const a of annualData) { if (a.value != null) { const y = yearFromDate(a.date); if (!ttmData.some((t) => yearFromDate(t.date) === y && t.date.endsWith(a.date.slice(5)))) bars.push({ label: `FY${y}`, value: a.value, isEstimate: false, isTTM: false, date: a.date }) } }
  for (const t of ttmData) bars.push({ label: t.label, value: t.value, isEstimate: false, isTTM: true, date: t.date })
  if (forwardAnnual) for (const f of forwardAnnual) { if (f.estimate != null) { const y = yearFromDate(f.date); if (!bars.some((b) => yearFromDate(b.date) === y)) bars.push({ label: `FY${y} (E)`, value: f.estimate, isEstimate: true, isTTM: false, date: f.date }) } }
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
          let growth: number | null = null; let compLabel = ""
          const barYear = parseInt(yearFromDate(bar.date))
          const yoyBar = bars.find((b) => parseInt(yearFromDate(b.date)) === barYear - 1 && b.value !== 0)
          if (yoyBar) { growth = ((bar.value - yoyBar.value) / Math.abs(yoyBar.value)) * 100; compLabel = `vs ${yoyBar.label}` }
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
              {growth != null ? <div className="flex flex-col items-center"><div className={`text-[10px] font-bold flex items-center gap-0.5 ${growth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{growth >= 0 ? "+" : ""}{growth.toFixed(1)}%</div><div className="text-[8px] text-muted-foreground text-center">{compLabel}</div></div> : <div className="h-[26px]" />}
              <div className="w-full flex items-end h-28"><div className={`flex-1 rounded-t transition-all ${bar.isEstimate ? "border-2 border-dashed border-bloomberg-amber bg-bloomberg-amber/20" : bar.isTTM ? `${color} ring-1 ring-white/20` : negative ? "bg-bloomberg-red" : `${color} opacity-60`}`} style={{ height: `${Math.max(h, 2)}%` }} /></div>
              <div className="text-[10px] text-center font-bold text-muted-foreground leading-tight">{bar.label}</div>
              <div className="text-[10px] text-muted-foreground text-center">{fmtBigValue(bar.value, currency)}</div>
              {bar.isTTM && <div className="text-[8px] text-bloomberg-blue font-bold">TTM</div>}
              {bar.isEstimate && <div className="text-[9px] text-bloomberg-amber font-bold">EST</div>}
            </div>
          )
        })}
      </div>
      {explainer && <Explainer text={explainer} />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   TTM TABLE
   ══════════════════════════════════════════════════════════════ */

function TTMTable({ title, ttmData, annualData, forwardAnnual, currency }: {
  title: string; ttmData: TTMPoint[]; annualData?: { date: string; value: number | null }[]; forwardAnnual?: { date: string; estimate: number | null }[]; currency: string
}) {
  interface RowItem { label: string; sublabel: string; value: number; isEstimate: boolean; date: string }
  const rows: RowItem[] = []
  if (annualData) for (const a of annualData) { if (a.value != null) { const y = yearFromDate(a.date); if (!ttmData.some((t) => yearFromDate(t.date) === y && t.date.endsWith(a.date.slice(5)))) rows.push({ label: `FY${y}`, sublabel: "Annual", value: a.value, isEstimate: false, date: a.date }) } }
  for (const t of ttmData) rows.push({ label: t.label, sublabel: t.quarters.join(" + "), value: t.value, isEstimate: false, date: t.date })
  if (forwardAnnual) for (const f of forwardAnnual) { if (f.estimate != null) { const y = yearFromDate(f.date); if (!rows.some((r) => yearFromDate(r.date) === y)) rows.push({ label: `FY${y} (E)`, sublabel: "Consensus", value: f.estimate, isEstimate: true, date: f.date }) } }
  rows.sort((a, b) => a.date.localeCompare(b.date))
  if (rows.length === 0) return null
  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
      <div className="text-xs text-bloomberg-amber font-bold mb-3">{title}</div>
      <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">PERIOD</th><th className="text-left py-2 text-muted-foreground">DETAIL</th><th className="text-right py-2 text-muted-foreground">VALUE (TTM)</th><th className="text-right py-2 text-muted-foreground">YoY CHANGE</th><th className="text-center py-2 text-muted-foreground">TYPE</th></tr></thead>
      <tbody>{rows.map((row, i) => {
        const barYear = parseInt(yearFromDate(row.date)); const yoyRow = rows.find((r) => parseInt(yearFromDate(r.date)) === barYear - 1 && r.value !== 0)
        let change: number | null = null; let compRef = ""; if (yoyRow) { change = ((row.value - yoyRow.value) / Math.abs(yoyRow.value)) * 100; compRef = `vs ${yoyRow.label}` }
        return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{row.label}</td><td className="py-2 text-[10px] text-muted-foreground">{row.sublabel}</td><td className={`py-2 text-right font-bold ${row.value >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(row.value, currency)}</td><td className={`py-2 text-right ${change != null && change >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{change != null ? <span>{change >= 0 ? "+" : ""}{change.toFixed(1)}% <span className="text-[10px] text-muted-foreground">{compRef}</span></span> : "---"}</td><td className="py-2 text-center">{row.isEstimate ? <span className="text-[10px] bg-bloomberg-amber/20 text-bloomberg-amber px-1.5 py-0.5 rounded font-bold">EST</span> : <span className="text-[10px] text-muted-foreground">ACTUAL</span>}</td></tr>)
      })}</tbody></table></div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   EARNINGS SNAPSHOT
   ══════════════════════════════════════════════════════════════ */

interface SnapshotItem { icon: string; text: string; level: "good" | "warn" | "bad" }

function buildSnapshot(e: EarningsData, q: QuoteData, fcfTTM: TTMPoint[], revenueTTM: TTMPoint[], netIncomeTTM: TTMPoint[], ebitdaTTM: TTMPoint[], sbcTTM: TTMPoint[], annualRevenue: QVal[], annualSBC: QVal[]): SnapshotItem[] {
  const items: SnapshotItem[] = []
  // FCF
  if (fcfTTM.length > 0) {
    const latest = fcfTTM[fcfTTM.length - 1]
    const prev = fcfTTM.find((f) => parseInt(yearFromDate(f.date)) === parseInt(yearFromDate(latest.date)) - 1)
    const rev = revenueTTM.find((r) => r.date === latest.date)
    const margin = rev ? ((latest.value / rev.value) * 100).toFixed(1) : null
    if (latest.value > 0) {
      const yoy = prev ? ((latest.value - prev.value) / Math.abs(prev.value) * 100).toFixed(0) : null
      items.push({ icon: "good", text: `FCF dodatni${yoy ? ` i ${parseInt(yoy) >= 0 ? "rosnący" : "malejący"}: ${yoy}% YoY` : ""}${margin ? `, marża ${margin}%` : ""}`, level: "good" })
    } else {
      items.push({ icon: "bad", text: `FCF ujemny: ${fmtBigValue(latest.value, q.currency)} TTM — spółka pali gotówkę`, level: "bad" })
    }
  }
  // Beat rate
  const beats = e.quarterly.filter((r) => r.surprise != null && r.surprise > 0).length
  const total = e.quarterly.filter((r) => r.surprise != null).length
  if (total > 0) {
    const rate = (beats / total) * 100
    if (rate >= 75) items.push({ icon: "good", text: `Beat EPS ${beats}/${total} kwartałów (${rate.toFixed(0)}% beat rate)`, level: "good" })
    else if (rate < 50) items.push({ icon: "bad", text: `Słaba historia wyników: ${rate.toFixed(0)}% beat rate (${beats}/${total})`, level: "bad" })
  }
  // Net Income
  if (netIncomeTTM.length > 0) {
    const latest = netIncomeTTM[netIncomeTTM.length - 1]
    if (latest.value < 0) items.push({ icon: "warn", text: `Net Income wciąż ujemny: ${fmtBigValue(latest.value, q.currency)} TTM`, level: "warn" })
  }
  // Net Margin trend
  if (revenueTTM.length >= 2 && netIncomeTTM.length >= 2) {
    const rev1 = revenueTTM[revenueTTM.length - 1]; const rev0 = revenueTTM[revenueTTM.length - 2]
    const ni1 = netIncomeTTM.find((n) => n.date === rev1.date); const ni0 = netIncomeTTM.find((n) => n.date === rev0.date)
    if (ni1 && ni0) {
      const m1 = (ni1.value / rev1.value) * 100; const m0 = (ni0.value / rev0.value) * 100
      const delta = m1 - m0
      if (delta > 1) items.push({ icon: "good", text: `Marża netto poprawia się: ${delta > 0 ? "+" : ""}${delta.toFixed(1)}pp`, level: "good" })
    }
  }
  // EBITDA trend
  if (ebitdaTTM.length >= 2) {
    const l = ebitdaTTM[ebitdaTTM.length - 1]; const p = ebitdaTTM[ebitdaTTM.length - 2]
    if (l.value < p.value) items.push({ icon: "warn", text: `EBITDA spadła: ${fmtBigValue(p.value, q.currency)} → ${fmtBigValue(l.value, q.currency)} (zbadać)`, level: "warn" })
  }
  // SBC trend
  if (sbcTTM.length > 0 && revenueTTM.length > 0) {
    const sbcL = sbcTTM[sbcTTM.length - 1]; const revL = revenueTTM.find((r) => r.date === sbcL.date)
    const sbcPrevYear = annualSBC.find((a) => yearFromDate(a.date) === String(parseInt(yearFromDate(sbcL.date)) - 1))
    const revPrevYear = annualRevenue.find((a) => yearFromDate(a.date) === String(parseInt(yearFromDate(sbcL.date)) - 1))
    if (revL && sbcPrevYear?.value && revPrevYear?.value) {
      const pctNow = (sbcL.value / revL.value) * 100; const pctPrev = (sbcPrevYear.value / revPrevYear.value) * 100
      if (pctNow < pctPrev) items.push({ icon: "good", text: `SBC spada: ${pctPrev.toFixed(1)}% → ${pctNow.toFixed(1)}% Revenue`, level: "good" })
    }
  }
  // Shares outstanding
  const bsA = e.balanceSheetAnnual?.filter((b) => b.sharesOutstanding != null) ?? []
  if (bsA.length >= 2) {
    const l = bsA[bsA.length - 1]; const p = bsA[bsA.length - 2]
    if (l.sharesOutstanding && p.sharesOutstanding) {
      const ch = ((l.sharesOutstanding - p.sharesOutstanding) / p.sharesOutstanding) * 100
      if (ch > 5) items.push({ icon: "warn", text: `Rozwodnienie akcji: +${ch.toFixed(1)}% YoY`, level: "warn" })
    }
  }
  // Sort: bad first, then warn, then good. Max 6
  items.sort((a, b) => { const order = { bad: 0, warn: 1, good: 2 }; return order[a.level] - order[b.level] })
  return items.slice(0, 6)
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

const LS_KEY_EARNINGS = "bloomberg_last_ticker_earnings"

export default function EarningsReport() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ quote: QuoteData; earnings: EarningsData } | null>(null)
  const [error, setError] = useState("")
  const [lastTicker, setLastTicker] = useState("")
  const didAutoLoad = useRef(false)

  const handleAnalyze = useCallback(async (ticker: string) => {
    setLoading(true); setError(""); setData(null)
    const t = ticker.toUpperCase().trim()
    setLastTicker(t)
    try { localStorage.setItem(LS_KEY_EARNINGS, t) } catch {}
    try { const res = await fetch("/api/earnings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker: t }) }); const json = await res.json(); if (json.error) throw new Error(json.error); setData(json) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed") } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    try { const saved = localStorage.getItem(LS_KEY_EARNINGS); if (saved) { setLastTicker(saved); handleAnalyze(saved) } } catch {}
  }, [handleAnalyze])

  const q = data?.quote; const e = data?.earnings
  const fwdQ = (e?.forwardEstimates ?? []).filter((f) => f.period === "0q" || f.period === "+1q")
  const fwdY = (e?.forwardEstimates ?? []).filter((f) => f.period === "0y" || f.period === "+1y")

  const epsChartData = (e?.quarterly ?? []).map((row) => ({ name: row.date.length > 7 ? row.date.slice(5) : row.date, valueA: row.estimate ?? 0, valueB: row.actual ?? 0, labelA: "Estimate", labelB: "Actual" }))

  // TTM computations
  const revenueQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.revenue }))
  const ebitdaNormQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.ebitdaNormalized }))
  const netIncomeQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.netIncome }))
  const totalExpensesQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.totalExpenses }))
  const depQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.depreciation }))

  const revenueTTM = computeTTM(revenueQ)
  const ebitdaTTM = computeTTM(ebitdaNormQ)
  const netIncomeTTM = computeTTM(netIncomeQ)
  const totalExpensesTTM = computeTTM(totalExpensesQ)
  const depTTM = computeTTM(depQ)

  const epsQ = (e?.quarterly ?? []).map((q) => ({ date: q.date, value: q.actual }))
  const epsTTM = computeTTM(epsQ)
  const gaapEpsQ = (e?.incomeStatements ?? []).map((s) => ({ date: s.date, value: s.dilutedEPS }))
  const gaapEpsTTM = computeTTM(gaapEpsQ)

  const annualRevenue = (e?.annualStatements ?? []).map((a) => ({ date: a.date, value: a.revenue }))
  const annualEbitdaNorm = (e?.annualStatements ?? []).map((a) => ({ date: a.date, value: a.ebitdaNormalized }))
  const annualNetIncome = (e?.annualStatements ?? []).map((a) => ({ date: a.date, value: a.netIncome }))
  const fwdAnnualRev = fwdY.filter((f) => f.revEstimate != null).map((f) => ({ date: f.endDate || f.period, estimate: f.revEstimate }))

  // FCF
  const fcfQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.freeCashFlow }))
  const opCfQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.operatingCashFlow }))
  const capexQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.capitalExpenditure }))
  const sbcQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.stockBasedCompensation }))
  const depCfQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.depreciation }))
  const taxesPaidQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.taxesPaid }))
  const interestPaidQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.interestPaid }))
  const wcQ = (e?.cashFlowQuarterly ?? []).map((c) => ({ date: c.date, value: c.changeInWorkingCapital }))
  const fcfTTM = computeTTM(fcfQ); const opCfTTM = computeTTM(opCfQ); const capexTTM = computeTTM(capexQ); const sbcTTM = computeTTM(sbcQ); const depCfTTM = computeTTM(depCfQ)
  const taxesPaidTTM = computeTTM(taxesPaidQ); const interestPaidTTM = computeTTM(interestPaidQ); const wcTTM = computeTTM(wcQ)
  const annualFCF = (e?.cashFlowAnnual ?? []).map((c) => ({ date: c.date, value: c.freeCashFlow }))
  const annualSBC = (e?.cashFlowAnnual ?? []).map((c) => ({ date: c.date, value: c.stockBasedCompensation }))

  const latestFCF = fcfTTM.length > 0 ? fcfTTM[fcfTTM.length - 1].value : null
  const latestCash = e?.balanceSheetQuarterly?.length ? e.balanceSheetQuarterly[e.balanceSheetQuarterly.length - 1].cashAndEquivalents : null

  const nonGaapEpsTTMVal = epsTTM.length > 0 ? epsTTM[epsTTM.length - 1].value : q?.eps ?? null
  const gaapEpsTTMVal = gaapEpsTTM.length > 0 ? gaapEpsTTM[gaapEpsTTM.length - 1].value : e?.gaapEpsTTM ?? null
  const hasGaapDiff = gaapEpsTTMVal != null && nonGaapEpsTTMVal != null && Math.abs(gaapEpsTTMVal - nonGaapEpsTTMVal) > 0.01

  // Snapshot
  const snapshotItems = e && q ? buildSnapshot(e, q, fcfTTM, revenueTTM, netIncomeTTM, ebitdaTTM, sbcTTM, annualRevenue, annualSBC) : []

  // Net Margin combined (annual + TTM)
  const marginRows: { label: string; rev: number; ni: number; date: string }[] = []
  for (const a of annualRevenue) {
    const ni = annualNetIncome.find((n) => yearFromDate(n.date) === yearFromDate(a.date))
    if (a.value != null && ni?.value != null) {
      const y = yearFromDate(a.date)
      if (!revenueTTM.some((t) => yearFromDate(t.date) === y && t.date.endsWith(a.date.slice(5))))
        marginRows.push({ label: `FY${y}`, rev: a.value, ni: ni.value, date: a.date })
    }
  }
  for (const r of revenueTTM) { const ni = netIncomeTTM.find((n) => n.date === r.date); if (ni) marginRows.push({ label: r.label, rev: r.value, ni: ni.value, date: r.date }) }
  marginRows.sort((a, b) => a.date.localeCompare(b.date))

  // Ownership
  const ow = e?.ownership

  // PIE colors
  const PIE_COLORS = ["#22c55e", "#3b82f6", "#6b7280"]

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">Earnings report — EPS, Revenue, EBITDA, FCF & Net Income with TTM analysis (Yahoo Finance)</div>
      <TerminalInput placeholder="Enter ticker (e.g. AAPL, GOOGL, TSLA)" onSubmit={handleAnalyze} loading={loading} label="EARNINGS >" defaultValue={lastTicker} />
      {error && <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {q && e && (
        <div className="space-y-4">

          {/* ═══ HEADER ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div><span className="text-xl font-bold text-bloomberg-green">{q.symbol}</span><span className="text-sm text-muted-foreground ml-2">{q.name}</span></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 items-center">
              {gaapEpsTTMVal != null && <div className="flex items-center gap-2"><span className="text-[10px] bg-bloomberg-red/20 text-bloomberg-red px-1.5 py-0.5 rounded font-bold">GAAP</span><span className="text-xs text-muted-foreground">EPS (TTM):</span><span className={`font-bold text-sm ${gaapEpsTTMVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{gaapEpsTTMVal.toFixed(2)}</span></div>}
              {nonGaapEpsTTMVal != null && hasGaapDiff && <div className="flex items-center gap-2"><span className="text-[10px] bg-bloomberg-blue/20 text-bloomberg-blue px-1.5 py-0.5 rounded font-bold">ADJ</span><span className="text-xs text-muted-foreground">EPS Non-GAAP (TTM):</span><span className={`font-bold text-sm ${nonGaapEpsTTMVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{nonGaapEpsTTMVal.toFixed(2)}</span></div>}
              {!hasGaapDiff && nonGaapEpsTTMVal != null && gaapEpsTTMVal == null && <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">EPS (TTM):</span><span className="font-bold text-sm">{nonGaapEpsTTMVal.toFixed(2)}</span></div>}
            </div>
            {hasGaapDiff && <Explainer text="GAAP uwzgl. koszty jednorazowe i SBC. Non-GAAP (Adjusted) je wyklucza." />}
          </div>

          {/* ═══ EARNINGS SNAPSHOT ═══ */}
          {snapshotItems.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EARNINGS SNAPSHOT</div>
              <div className="space-y-1.5">
                {snapshotItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">{item.level === "good" ? "✅" : item.level === "warn" ? "⚠️" : "❌"}</span>
                    <span className={item.level === "good" ? "text-bloomberg-green" : item.level === "warn" ? "text-bloomberg-amber" : "text-bloomberg-red"}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SECTION 1: EPS ═══ */}
          {e.quarterly.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS — ZYSK NA AKCJĘ (QUARTERLY)</div>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">QUARTER</th><th className="text-right py-2 text-muted-foreground">ESTIMATE</th><th className="text-right py-2 text-muted-foreground">ACTUAL</th><th className="text-right py-2 text-muted-foreground">SURPRISE</th><th className="text-right py-2 text-muted-foreground">%</th>{hasGaapDiff && <th className="text-right py-2 text-muted-foreground">GAAP EPS</th>}<th className="text-center py-2 text-muted-foreground">TYPE</th><th className="text-center py-2 text-muted-foreground">STATUS</th></tr></thead>
              <tbody>
                {e.quarterly.map((row, i) => {
                  const isBeat = row.surprise != null && row.surprise > 0; const isMiss = row.surprise != null && row.surprise < 0
                  const gaapMatch = (e.incomeStatements ?? []).find((s) => s.date === row.date)
                  return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{row.date} <span className="text-[10px] text-muted-foreground">{shortQLabel(row.date)}</span></td><td className="py-2 text-right text-muted-foreground">{row.estimate?.toFixed(2) ?? "N/A"}</td><td className={`py-2 text-right font-bold ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : ""}`}>{row.actual?.toFixed(2) ?? "N/A"}</td><td className={`py-2 text-right ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : ""}`}>{row.surprise != null ? (row.surprise > 0 ? "+" : "") + row.surprise.toFixed(2) : "N/A"}</td><td className={`py-2 text-right ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : ""}`}>{row.surprisePercent != null ? (row.surprisePercent > 0 ? "+" : "") + row.surprisePercent.toFixed(1) + "%" : "N/A"}</td>{hasGaapDiff && <td className={`py-2 text-right ${gaapMatch?.dilutedEPS != null && gaapMatch.dilutedEPS >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{gaapMatch?.dilutedEPS != null ? gaapMatch.dilutedEPS.toFixed(2) : "N/A"}</td>}<td className="py-2 text-center"><span className="text-[10px] text-muted-foreground">{hasGaapDiff ? "Non-GAAP" : "GAAP"}</span></td><td className="py-2 text-center">{isBeat ? <CheckCircle className="w-4 h-4 text-bloomberg-green inline" /> : isMiss ? <XCircle className="w-4 h-4 text-bloomberg-red inline" /> : <Minus className="w-4 h-4 text-bloomberg-amber inline" />}</td></tr>)
                })}
                {fwdQ.filter((f) => f.epsEstimate != null && !e.quarterly.some((q) => q.date === (f.endDate || f.period))).map((f, i) => (<tr key={`fwd-${i}`} className="border-b border-bloomberg-border/50 bg-bloomberg-amber/5"><td className="py-2 font-bold">{f.endDate || f.period}<span className="ml-1 text-[10px] text-bloomberg-amber font-bold">EST</span></td><td className="py-2 text-right text-bloomberg-amber font-bold">{f.epsEstimate?.toFixed(2) ?? "N/A"}</td><td className="py-2 text-right text-muted-foreground">---</td><td className="py-2 text-right text-muted-foreground">---</td><td className="py-2 text-right text-muted-foreground">---</td>{hasGaapDiff && <td className="py-2 text-right text-muted-foreground">---</td>}<td className="py-2 text-center"><span className="text-[10px] text-muted-foreground">Est.</span></td><td className="py-2 text-center"><span className="text-[10px] bg-bloomberg-amber/20 text-bloomberg-amber px-1.5 py-0.5 rounded font-bold">FORECAST</span></td></tr>))}
              </tbody></table></div>
            </div>
          )}

          {epsChartData.length > 0 && <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4"><div className="text-xs text-bloomberg-amber font-bold mb-3">EPS: ESTIMATE vs ACTUAL (HISTORICAL)</div><BarCompareChart data={epsChartData} /></div>}

          {/* Forward EPS cards */}
          {fwdQ.filter((f) => f.epsEstimate != null).length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">FORWARD EPS — YoY</div>
              <div className="grid grid-cols-2 gap-4">{fwdQ.filter((f) => f.epsEstimate != null).map((f, i) => { const yoy = f.yearAgoEps && f.epsEstimate ? ((f.epsEstimate - f.yearAgoEps) / Math.abs(f.yearAgoEps)) * 100 : null; return (<div key={i} className="bg-bloomberg-bg rounded p-3 border border-bloomberg-border/50"><div className="text-sm font-bold text-bloomberg-amber mb-2">{f.endDate?.slice(0,7) || f.period} <span className="text-[10px] bg-bloomberg-amber/20 px-1.5 py-0.5 rounded">EST</span></div><div className="space-y-1 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Forecast</span><span className="font-bold">${f.epsEstimate?.toFixed(3)}</span></div>{f.yearAgoEps != null && <div className="flex justify-between"><span className="text-muted-foreground">Year Ago</span><span className="font-bold">${f.yearAgoEps.toFixed(3)}</span></div>}{yoy != null && <div className="flex justify-between pt-1 border-t border-bloomberg-border/50"><span className="text-muted-foreground font-bold">YoY</span><span className={`font-bold ${yoy >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%</span></div>}</div></div>) })}</div>
            </div>
          )}

          {/* Annual estimates + Revisions */}
          {fwdY.length > 0 && (<>
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">ANNUAL ESTIMATES (CONSENSUS)</div>
              <div className="grid grid-cols-2 gap-4">{fwdY.map((f, i) => { const y = f.endDate?.slice(0,4) || f.period; const eg = f.yearAgoEps && f.epsEstimate ? ((f.epsEstimate - f.yearAgoEps) / Math.abs(f.yearAgoEps)) * 100 : null; const rg = f.yearAgoRev && f.revEstimate ? ((f.revEstimate - f.yearAgoRev) / Math.abs(f.yearAgoRev)) * 100 : null; return (<div key={i} className="bg-bloomberg-bg rounded p-3 border border-bloomberg-border/50"><div className="text-sm font-bold text-bloomberg-green mb-2">FY {y} {f.period === "0y" ? "(Current)" : "(Next)"}</div><div className="space-y-1 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">EPS Est.</span><span className="font-bold">${f.epsEstimate?.toFixed(2) ?? "N/A"}</span></div>{eg != null && <div className="flex justify-between"><span className="text-muted-foreground">EPS YoY</span><span className={`font-bold ${eg >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{eg >= 0 ? "+" : ""}{eg.toFixed(1)}%</span></div>}{f.revEstimate != null && <div className="flex justify-between"><span className="text-muted-foreground">Rev Est.</span><span className="font-bold">{fmtBigValue(f.revEstimate, q.currency)}</span></div>}{rg != null && <div className="flex justify-between"><span className="text-muted-foreground">Rev YoY</span><span className={`font-bold ${rg >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{rg >= 0 ? "+" : ""}{rg.toFixed(1)}%</span></div>}</div></div>) })}</div>
            </div>

            {/* ANALYST ESTIMATE REVISIONS */}
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">ANALYST ESTIMATE REVISIONS</div>
              {fwdY.some((f) => f.epsTrend30d != null) ? (
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">PERIOD</th><th className="text-left py-2 text-muted-foreground">METRIC</th><th className="text-right py-2 text-muted-foreground">30D AGO</th><th className="text-right py-2 text-muted-foreground">CURRENT</th><th className="text-right py-2 text-muted-foreground">CHANGE</th><th className="text-center py-2 text-muted-foreground">DIR</th><th className="text-center py-2 text-muted-foreground">UP/DOWN</th></tr></thead>
                <tbody>{fwdY.map((f, i) => { const y = f.endDate ? `FY${f.endDate.slice(0,4)}` : f.period; const c = f.epsTrendCurrent; const p = f.epsTrend30d; const ch = c != null && p != null ? c - p : null; const dir = ch != null ? (ch > 0.001 ? "up" : ch < -0.001 ? "down" : "flat") : null; return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{y}</td><td className="py-2">EPS Est.</td><td className="py-2 text-right text-muted-foreground">{p != null ? `$${p.toFixed(3)}` : "N/A"}</td><td className="py-2 text-right font-bold">{c != null ? `$${c.toFixed(3)}` : "N/A"}</td><td className={`py-2 text-right font-bold ${dir === "up" ? "text-bloomberg-green" : dir === "down" ? "text-bloomberg-red" : "text-muted-foreground"}`}>{ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(3)}` : "---"}</td><td className="py-2 text-center text-lg">{dir === "up" ? <span className="text-bloomberg-green">▲</span> : dir === "down" ? <span className="text-bloomberg-red">▼</span> : <span className="text-muted-foreground">—</span>}</td><td className="py-2 text-center"><span className="text-bloomberg-green">{f.epsRevisionsUp30d}↑</span><span className="text-muted-foreground mx-1">/</span><span className="text-bloomberg-red">{f.epsRevisionsDown30d}↓</span></td></tr>) })}</tbody></table></div>
              ) : <div className="text-sm text-muted-foreground text-center py-4">Dane rewizji niedostępne dla tej spółki</div>}
              <Explainer text="Rosnące estymaty = pozytywny momentum. Spadające = pogarszające się oczekiwania." />
            </div>
          </>)}

          {/* Surprise History */}
          {e.quarterly.length > 0 && e.quarterly.some((r) => r.surprise != null) && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">EPS SURPRISE HISTORY</div>
              <div className="space-y-2">{e.quarterly.map((row, i) => { const isBeat = row.surprise != null && row.surprise > 0; const isMiss = row.surprise != null && row.surprise < 0; const isNeutral = row.surprise == null || row.surprise === 0; const mag = row.surprisePercent != null ? Math.abs(row.surprisePercent) : 0; const maxS = Math.max(...e.quarterly.filter((r) => r.surprisePercent != null).map((r) => Math.abs(r.surprisePercent!)), 1); const bw = mag > 0 ? Math.max(5, (mag / maxS) * 100) : 0; return (<div key={i} className="flex items-center gap-3"><div className="w-20 text-xs text-muted-foreground shrink-0 font-mono">{shortQLabel(row.date)}</div><div className="flex-1 flex items-center gap-2"><div className="flex-1 h-5 bg-bloomberg-bg rounded overflow-hidden"><div className={`h-full rounded ${isBeat ? "bg-bloomberg-green/60" : isMiss ? "bg-bloomberg-red/60" : "bg-bloomberg-amber/30"}`} style={{ width: `${bw}%` }} /></div><div className={`w-16 text-right text-xs font-bold shrink-0 ${isBeat ? "text-bloomberg-green" : isMiss ? "text-bloomberg-red" : "text-muted-foreground"}`}>{isNeutral ? "---" : <>{isBeat ? "BEAT" : "MISS"} {row.surprisePercent != null ? `${Math.abs(row.surprisePercent).toFixed(1)}%` : ""}</>}</div></div><div className="shrink-0">{isBeat ? <CheckCircle className="w-4 h-4 text-bloomberg-green" /> : isMiss ? <XCircle className="w-4 h-4 text-bloomberg-red" /> : <Minus className="w-4 h-4 text-bloomberg-amber" />}</div></div>) })}</div>
              {(() => { const beats = e.quarterly.filter((r) => r.surprise != null && r.surprise > 0).length; const misses = e.quarterly.filter((r) => r.surprise != null && r.surprise < 0).length; const total = e.quarterly.filter((r) => r.surprise != null).length; return <div className="mt-3 pt-3 border-t border-bloomberg-border flex items-center justify-between text-xs"><span className="text-muted-foreground">Track Record</span><div className="flex gap-4"><span className="text-bloomberg-green font-bold">{beats} Beats</span><span className="text-bloomberg-red font-bold">{misses} Misses</span><span className={`font-bold ${beats > misses ? "text-bloomberg-green" : "text-bloomberg-red"}`}>({total > 0 ? ((beats / total) * 100).toFixed(0) : 0}% beat rate)</span></div></div> })()}
            </div>
          )}

          {/* ═══ REVENUE TTM ═══ */}
          {(revenueTTM.length > 0 || annualRevenue.some((a) => a.value != null)) && (<>
            <div className="border-t border-bloomberg-border pt-4 mt-2" />
            <TTMBarSection title="REVENUE TTM TREND" ttmData={revenueTTM} annualData={annualRevenue} forwardAnnual={fwdAnnualRev} currency={q.currency} color="bg-bloomberg-blue" />
            <TTMTable title="REVENUE TTM TABLE" ttmData={revenueTTM} annualData={annualRevenue} forwardAnnual={fwdAnnualRev} currency={q.currency} />

            {/* OPERATING LEVERAGE */}
            {revenueTTM.length >= 1 && totalExpensesTTM.length >= 1 && (() => {
              const isValidNum = (n: number | null | undefined): n is number =>
                n !== null && n !== undefined && !isNaN(n) && isFinite(n) && n !== 0

              const revL = revenueTTM[revenueTTM.length - 1]
              const revP = revenueTTM.find((r) => parseInt(yearFromDate(r.date)) === parseInt(yearFromDate(revL.date)) - 1)
                ?? annualRevenue.filter((a) => a.value != null).slice(-1).map((a) => ({ date: a.date, label: `FY${yearFromDate(a.date)}`, value: a.value!, quarters: [] }))[0]
              const expL = totalExpensesTTM[totalExpensesTTM.length - 1]
              const expP = totalExpensesTTM.find((r) => parseInt(yearFromDate(r.date)) === parseInt(yearFromDate(expL.date)) - 1)

              // Validate all 4 values exist and are non-zero
              if (!revP || !expP) return null
              if (!isValidNum(revL.value) || !isValidNum(revP.value) || !isValidNum(expL.value) || !isValidNum(expP.value)) {
                return (
                  <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                    <div className="text-xs text-bloomberg-amber font-bold mb-1">OPERATING LEVERAGE</div>
                    <div className="text-xs text-muted-foreground mt-2">Operating data unavailable for this period</div>
                  </div>
                )
              }

              const rg = ((revL.value - revP.value) / Math.abs(revP.value)) * 100
              const eg = ((expL.value - expP.value) / Math.abs(expP.value)) * 100
              const spread = rg - eg

              // Sanity check: if spread is extreme (>50pp or <-50pp), data is likely unreliable
              if (Math.abs(spread) > 50 || Math.abs(rg) > 200 || Math.abs(eg) > 200) {
                return (
                  <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                    <div className="text-xs text-bloomberg-amber font-bold mb-1">OPERATING LEVERAGE</div>
                    <div className="text-xs text-muted-foreground mt-2">Insufficient data for leverage calculation</div>
                  </div>
                )
              }

              const isPos = spread > 0
              return (
                <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                  <div className="text-xs text-bloomberg-amber font-bold mb-1">OPERATING LEVERAGE — {revL.label} vs {revP.label}</div>
                  <div className="grid grid-cols-4 gap-4 text-xs mt-3">
                    <div><div className="text-muted-foreground">Revenue Growth</div><div className={`font-bold text-sm ${rg >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{rg >= 0 ? "+" : ""}{rg.toFixed(1)}%</div></div>
                    <div><div className="text-muted-foreground">OpEx Growth</div><div className={`font-bold text-sm ${eg <= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{eg >= 0 ? "+" : ""}{eg.toFixed(1)}%</div></div>
                    <div><div className="text-muted-foreground">Leverage Spread</div><div className={`font-bold text-sm ${isPos ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{spread >= 0 ? "+" : ""}{spread.toFixed(1)} pp</div></div>
                    <div><div className="text-muted-foreground">Status</div><div className={`font-bold text-sm ${isPos ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{isPos ? "POSITIVE ✓" : "NEGATIVE ✗"}</div></div>
                  </div>
                  <Explainer text="Positive leverage = spółka skaluje się efektywnie. Każdy % wzrostu przychodów kosztuje mniej niż % wzrostu kosztów." />
                </div>
              )
            })()}
          </>)}

          {/* ═══ EBITDA TTM (Normalized/Adjusted) ═══ */}
          {(ebitdaTTM.length > 0 || annualEbitdaNorm.some((a) => a.value != null)) && (<>
            <div className="border-t border-bloomberg-border pt-4 mt-2" />
            <TTMBarSection title="EBITDA TTM TREND (NORMALIZED)" ttmData={ebitdaTTM} annualData={annualEbitdaNorm} currency={q.currency} color="bg-bloomberg-purple" explainer="EBITDA = Operating Income + D&A. Adjusted EBITDA wyklucza koszty jednorazowe (restructuring, SBC)." />
            <TTMTable title="EBITDA TTM TABLE (NORMALIZED)" ttmData={ebitdaTTM} annualData={annualEbitdaNorm} currency={q.currency} />
          </>)}

          {/* ═══ FREE CASH FLOW TTM ═══ */}
          {(fcfTTM.length > 0 || annualFCF.some((a) => a.value != null)) && (<>
            <div className="border-t border-bloomberg-border pt-4 mt-2" />
            <TTMBarSection title="FCF TTM TREND" ttmData={fcfTTM} annualData={annualFCF} currency={q.currency} color="bg-bloomberg-green" explainer="FCF = Operating Cash Flow minus CapEx. Pokazuje ile gotówki spółka generuje po inwestycjach." />

            {/* FCF TABLE */}
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">FCF TTM TABLE</div>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">PERIOD</th><th className="text-right py-2 text-muted-foreground">OP. CF</th><th className="text-right py-2 text-muted-foreground">CAPEX</th><th className="text-right py-2 text-muted-foreground">FCF</th><th className="text-right py-2 text-muted-foreground">FCF MARGIN</th><th className="text-right py-2 text-muted-foreground">YoY</th></tr></thead>
              <tbody>
                {(e.cashFlowAnnual ?? []).filter((c) => c.freeCashFlow != null).map((c, i, arr) => { const y = yearFromDate(c.date); if (fcfTTM.some((t) => yearFromDate(t.date) === y)) return null; const ra = annualRevenue.find((r) => yearFromDate(r.date) === y); const fm = ra?.value && c.freeCashFlow ? (c.freeCashFlow / ra.value) * 100 : null; const prev = arr[i - 1]; const yoy = prev?.freeCashFlow && c.freeCashFlow ? ((c.freeCashFlow - prev.freeCashFlow) / Math.abs(prev.freeCashFlow)) * 100 : null; return (<tr key={`a-${i}`} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">FY{y}</td><td className="py-2 text-right">{c.operatingCashFlow != null ? fmtBigValue(c.operatingCashFlow, q.currency) : "N/A"}</td><td className="py-2 text-right text-bloomberg-red">{c.capitalExpenditure != null ? fmtBigValue(c.capitalExpenditure, q.currency) : "N/A"}</td><td className={`py-2 text-right font-bold ${(c.freeCashFlow ?? 0) >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(c.freeCashFlow!, q.currency)}</td><td className={`py-2 text-right ${fm != null && fm >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fm != null ? `${fm.toFixed(1)}%` : "N/A"}</td><td className={`py-2 text-right ${yoy != null && yoy >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "---"}</td></tr>) })}
                {fcfTTM.map((fcf, i) => { const oc = opCfTTM.find((o) => o.date === fcf.date); const cx = capexTTM.find((c) => c.date === fcf.date); const rv = revenueTTM.find((r) => r.date === fcf.date); const fm = rv ? (fcf.value / rv.value) * 100 : null; const py = parseInt(yearFromDate(fcf.date)) - 1; const pf = fcfTTM.find((f) => parseInt(yearFromDate(f.date)) === py) ?? annualFCF.find((a) => yearFromDate(a.date) === String(py)); const pv = pf && "value" in pf ? pf.value : null; const yoy = pv && pv !== 0 ? ((fcf.value - pv) / Math.abs(pv)) * 100 : null; return (<tr key={`t-${i}`} className="border-b border-bloomberg-border/50 bg-bloomberg-blue/5"><td className="py-2 font-bold">{fcf.label} <span className="text-[8px] text-bloomberg-blue">TTM</span></td><td className="py-2 text-right">{oc ? fmtBigValue(oc.value, q.currency) : "N/A"}</td><td className="py-2 text-right text-bloomberg-red">{cx ? fmtBigValue(cx.value, q.currency) : "N/A"}</td><td className={`py-2 text-right font-bold ${fcf.value >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(fcf.value, q.currency)}</td><td className={`py-2 text-right ${fm != null && fm >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fm != null ? `${fm.toFixed(1)}%` : "N/A"}</td><td className={`py-2 text-right ${yoy != null && yoy >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "---"}</td></tr>) })}
              </tbody></table></div>
            </div>

            {/* FCF YIELD */}
            {fcfTTM.length > 0 && (() => {
              const latFcf = fcfTTM[fcfTTM.length - 1].value
              const mc = q.marketCap
              const fcfYield = mc > 0 ? (latFcf / mc) * 100 : null
              const label = fcfYield == null ? "N/A" : fcfYield < 0 ? "Negative FCF" : fcfYield < 2 ? "Expensive" : fcfYield <= 5 ? "Fair" : "Attractive"
              const color = fcfYield == null ? "text-muted-foreground" : fcfYield >= 5 ? "text-bloomberg-green" : fcfYield >= 2 ? "text-bloomberg-amber" : "text-bloomberg-red"
              return (
                <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                  <div className="text-xs text-bloomberg-amber font-bold mb-3">FCF YIELD</div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div><div className="text-muted-foreground">FCF (TTM)</div><div className={`font-bold text-sm ${latFcf >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(latFcf, q.currency)}</div></div>
                    <div><div className="text-muted-foreground">Market Cap</div><div className="font-bold text-sm">{mc > 0 ? fmtBigValue(mc, q.currency) : "N/A"}</div></div>
                    <div><div className="text-muted-foreground">FCF Yield</div><div className={`font-bold text-sm ${color}`}>{fcfYield != null ? `${fcfYield.toFixed(1)}%` : "N/A"} <span className="text-[10px]">{label}</span></div></div>
                  </div>
                </div>
              )
            })()}

            {/* JAK LICZYMY FCF? — RECONCILIATION FROM EBITDA */}
            {fcfTTM.length > 0 && (() => {
              // Bank/Financial Services detection — EBITDA not standard
              const sector = e.sector ?? null
              const isBank = sector === "Financial Services" || sector === "Banks"
              if (isBank) {
                return (
                  <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                    <div className="text-xs text-bloomberg-amber font-bold mb-3">JAK LICZYMY FCF? — RECONCILIATION</div>
                    <div className="text-xs text-muted-foreground">⚠️ Reconciliation niedostępne — EBITDA nie jest standardową metryką dla banków i instytucji finansowych.</div>
                  </div>
                )
              }

              const f = fcfTTM[fcfTTM.length - 1]
              const ebitda = ebitdaTTM.find((eb) => eb.date === f.date)
              const tp = taxesPaidTTM.find((t) => t.date === f.date)
              const ip = interestPaidTTM.find((i) => i.date === f.date)
              const wc = wcTTM.find((w) => w.date === f.date)
              const sbc = sbcTTM.find((s) => s.date === f.date)
              const oc = opCfTTM.find((o) => o.date === f.date)
              const cx = capexTTM.find((c) => c.date === f.date)

              if (!ebitda && !oc) return null

              const ebitdaVal = ebitda?.value ?? null
              const taxVal = tp?.value ?? null
              const intPaidVal = ip?.value ?? null
              const wcVal = wc?.value ?? null
              const sbcVal = sbc?.value ?? null
              const ocVal = oc?.value ?? null
              const cxVal = cx?.value ?? null
              const fcfVal = f.value

              // Calculate "Other adjustments" as plug so reconciliation always balances:
              // OCF = EBITDA - Taxes - Interest + SBC + WC + Other
              // Other = OCF - EBITDA + Taxes + Interest - SBC - WC
              let otherVal: number | null = null
              if (ocVal != null && ebitdaVal != null) {
                otherVal = ocVal - ebitdaVal
                  + Math.abs(taxVal ?? 0)
                  + Math.abs(intPaidVal ?? 0)
                  - (sbcVal ?? 0)
                  - (wcVal ?? 0)
              }

              // FCF Conversion
              const convPct = ebitdaVal && ebitdaVal !== 0 ? (fcfVal / ebitdaVal) * 100 : null
              const convLabel = convPct == null ? null : convPct < 0 ? "Negative FCF" : convPct >= 50 ? "Excellent conversion" : convPct >= 25 ? "Moderate conversion" : "Weak conversion"
              const convColor = convPct == null ? "text-muted-foreground" : convPct >= 50 ? "text-bloomberg-green" : convPct >= 25 ? "text-bloomberg-amber" : "text-bloomberg-red"

              return (
                <div className="bg-bloomberg-card border border-bloomberg-green/30 rounded p-4">
                  <div className="text-xs text-bloomberg-green font-bold mb-3">JAK LICZYMY FCF? — RECONCILIATION ({f.label})</div>
                  <div className="overflow-x-auto"><table className="w-full text-xs"><tbody>
                    <tr className="border-b border-bloomberg-border/50"><td className={`py-1.5 ${ebitdaVal != null && ebitdaVal < 0 ? "text-bloomberg-red font-bold" : ""}`}>EBITDA <span className="text-[10px] text-muted-foreground">(OpIncome + D&A)</span></td><td className={`py-1.5 text-right font-bold ${ebitdaVal != null && ebitdaVal < 0 ? "text-bloomberg-red" : ""}`}>{ebitdaVal != null ? fmtBigValue(ebitdaVal, q.currency) : "N/A"}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">- Taxes</td><td className="py-1.5 text-right text-bloomberg-red font-bold">{taxVal != null ? `-${fmtBigValue(Math.abs(taxVal), q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">- Interest Expense</td><td className="py-1.5 text-right text-bloomberg-red font-bold">{intPaidVal != null ? `-${fmtBigValue(Math.abs(intPaidVal), q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">+ Stock Based Compensation <span className="text-[10px] text-muted-foreground">(non-cash)</span></td><td className="py-1.5 text-right text-bloomberg-green font-bold">{sbcVal != null ? `+${fmtBigValue(Math.abs(sbcVal), q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">+/- Working Capital Changes</td><td className={`py-1.5 text-right font-bold ${wcVal != null && wcVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{wcVal != null ? `${wcVal >= 0 ? "+" : ""}${fmtBigValue(wcVal, q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5 text-muted-foreground">+/- Other Adjustments <span className="text-[10px]">(deferred tax, other non-cash)</span></td><td className={`py-1.5 text-right font-bold ${otherVal != null && otherVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{otherVal != null ? `${otherVal >= 0 ? "+" : ""}${fmtBigValue(otherVal, q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border"><td className="py-1.5 font-bold">= Operating Cash Flow</td><td className="py-1.5 text-right font-bold">{ocVal != null ? fmtBigValue(ocVal, q.currency) : "N/A"}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">- Capital Expenditures (CapEx)</td><td className="py-1.5 text-right text-bloomberg-red font-bold">{cxVal != null ? fmtBigValue(cxVal, q.currency) : "N/A"}</td></tr>
                    <tr><td className="py-1.5 font-bold text-bloomberg-green">= Free Cash Flow</td><td className={`py-1.5 text-right font-bold text-sm ${fcfVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(fcfVal, q.currency)}</td></tr>
                  </tbody></table></div>

                  {convPct != null && ebitdaVal != null && (
                    <div className={`mt-2 text-xs font-bold ${convColor}`}>
                      FCF Conversion: FCF ({fmtBigValue(fcfVal, q.currency)}) = {convPct.toFixed(0)}% EBITDA ({fmtBigValue(ebitdaVal, q.currency)}) — {convLabel}
                    </div>
                  )}

                  <Explainer text="EBITDA to zysk operacyjny przed odsetkami, podatkami i amortyzacją. Odejmując podatki, odsetki, dodając SBC (non-cash) i zmiany w kapitale obrotowym — dochodzimy do Operating Cash Flow. Po odjęciu CapEx = Free Cash Flow." />
                </div>
              )
            })()}
          </>)}

          {/* CASH RUNWAY (only if FCF negative) */}
          {latestFCF != null && latestFCF < 0 && latestCash != null && latestCash > 0 && (() => {
            const qBurn = Math.abs(latestFCF) / 4; const rQ = latestCash / qBurn; const rM = rQ * 3
            const c = rQ > 8 ? "text-bloomberg-green" : rQ >= 4 ? "text-bloomberg-amber" : "text-bloomberg-red"
            return (<div className="bg-bloomberg-card border border-bloomberg-border rounded p-4"><div className="text-xs text-bloomberg-amber font-bold mb-3">⚠ CASH RUNWAY</div><div className="grid grid-cols-3 gap-4 text-xs"><div><div className="text-muted-foreground">Cash on Hand</div><div className="font-bold text-sm">{fmtBigValue(latestCash, q.currency)}</div></div><div><div className="text-muted-foreground">Quarterly Burn</div><div className="font-bold text-sm text-bloomberg-red">{fmtBigValue(qBurn, q.currency)}</div></div><div><div className="text-muted-foreground">Runway</div><div className={`font-bold text-sm ${c}`}>~{rQ.toFixed(1)} kwartałów (~{rM.toFixed(0)} mies.)</div></div></div></div>)
          })()}

          {/* ═══ NET INCOME TTM ═══ */}
          {(netIncomeTTM.length > 0 || annualNetIncome.some((a) => a.value != null)) && (<>
            <div className="border-t border-bloomberg-border pt-4 mt-2" />
            <TTMBarSection title="NET INCOME TTM TREND" ttmData={netIncomeTTM} annualData={annualNetIncome} currency={q.currency} color="bg-bloomberg-green" />
            <TTMTable title="NET INCOME TTM TABLE" ttmData={netIncomeTTM} annualData={annualNetIncome} currency={q.currency} />
          </>)}

          {/* ═══ NET MARGIN TREND (with annual history) ═══ */}
          {marginRows.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">NET MARGIN TREND</div>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">PERIOD</th><th className="text-right py-2 text-muted-foreground">REVENUE</th><th className="text-right py-2 text-muted-foreground">NET INCOME</th><th className="text-right py-2 text-muted-foreground">NET MARGIN</th><th className="text-center py-2 text-muted-foreground">TREND</th></tr></thead>
              <tbody>{marginRows.map((r, i) => {
                const margin = (r.ni / r.rev) * 100
                const prev = i > 0 ? marginRows[i - 1] : null; const prevMargin = prev ? (prev.ni / prev.rev) * 100 : null; const delta = prevMargin != null ? margin - prevMargin : null
                const mColor = margin > 0 ? "text-bloomberg-green" : margin > -5 ? "text-bloomberg-amber" : "text-bloomberg-red"
                return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{r.label}</td><td className="py-2 text-right">{fmtBigValue(r.rev, q.currency)}</td><td className={`py-2 text-right font-bold ${r.ni >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(r.ni, q.currency)}</td><td className={`py-2 text-right font-bold ${mColor}`}>{margin.toFixed(1)}%</td><td className="py-2 text-center">{delta != null ? <span className={`text-[10px] font-bold ${delta >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}pp</span> : <span className="text-[10px] text-muted-foreground">---</span>}</td></tr>)
              })}</tbody></table></div>
              <div className="mt-4 flex items-end gap-3 h-24">{marginRows.map((r, i) => {
                const margin = (r.ni / r.rev) * 100; const maxM = Math.max(...marginRows.map((x) => Math.abs((x.ni / x.rev) * 100))); const h = maxM > 0 ? (Math.abs(margin) / maxM) * 100 : 0
                return (<div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full flex items-end h-16"><div className={`flex-1 rounded-t ${margin >= 0 ? "bg-bloomberg-green" : margin > -5 ? "bg-bloomberg-amber" : "bg-bloomberg-red"}`} style={{ height: `${h}%` }} /></div><div className="text-[10px] text-muted-foreground">{r.label}</div><div className={`text-[10px] font-bold ${margin >= 0 ? "text-bloomberg-green" : margin > -5 ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>{margin.toFixed(1)}%</div></div>)
              })}</div>
            </div>
          )}

          {/* ═══ DILUTION & SBC ═══ */}
          {((e.balanceSheetAnnual ?? []).some((b) => b.sharesOutstanding != null) || sbcTTM.length > 0 || annualSBC.some((a) => a.value != null)) && (<>
            <div className="border-t border-bloomberg-border pt-4 mt-2" />
            {(e.balanceSheetAnnual ?? []).some((b) => b.sharesOutstanding != null) && (
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                <div className="text-xs text-bloomberg-amber font-bold mb-3">SHARES OUTSTANDING TREND</div>
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">PERIOD</th><th className="text-right py-2 text-muted-foreground">SHARES</th><th className="text-right py-2 text-muted-foreground">YoY CHANGE</th><th className="text-center py-2 text-muted-foreground">DILUTION</th></tr></thead>
                <tbody>
                  {(e.balanceSheetAnnual ?? []).filter((b) => b.sharesOutstanding != null).map((b, i, arr) => { const prev = arr[i - 1]; const ch = prev?.sharesOutstanding && b.sharesOutstanding ? ((b.sharesOutstanding - prev.sharesOutstanding) / prev.sharesOutstanding) * 100 : null; const dilut = ch != null && ch > 0.5; return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">FY{yearFromDate(b.date)}</td><td className="py-2 text-right font-bold">{fmtShares(b.sharesOutstanding!)}</td><td className={`py-2 text-right ${ch != null ? (dilut ? "text-bloomberg-red" : "text-bloomberg-green") : ""}`}>{ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` : "---"}</td><td className="py-2 text-center">{ch != null && (dilut ? <span className="text-[10px] bg-bloomberg-red/20 text-bloomberg-red px-1.5 py-0.5 rounded font-bold">DILUTIVE</span> : <span className="text-[10px] bg-bloomberg-green/20 text-bloomberg-green px-1.5 py-0.5 rounded font-bold">STABLE</span>)}</td></tr>) })}
                  {(() => { const la = (e.balanceSheetAnnual ?? []).filter((b) => b.sharesOutstanding != null).slice(-1)[0]; const lq = (e.balanceSheetQuarterly ?? []).filter((b) => b.sharesOutstanding != null).slice(-1)[0]; if (!lq || !la || lq.date <= la.date) return null; const ch = la.sharesOutstanding && lq.sharesOutstanding ? ((lq.sharesOutstanding - la.sharesOutstanding) / la.sharesOutstanding) * 100 : null; return (<tr className="border-b border-bloomberg-border/50 bg-bloomberg-blue/5"><td className="py-2 font-bold">{shortQLabel(lq.date)} <span className="text-[8px] text-bloomberg-blue">LATEST</span></td><td className="py-2 text-right font-bold">{fmtShares(lq.sharesOutstanding!)}</td><td className={`py-2 text-right ${ch != null && ch > 0.5 ? "text-bloomberg-red" : "text-bloomberg-green"}`}>{ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` : "---"}</td><td className="py-2 text-center"><span className="text-[10px] text-muted-foreground">vs FY{yearFromDate(la.date)}</span></td></tr>) })()}
                </tbody></table></div>
              </div>
            )}
            {(sbcTTM.length > 0 || annualSBC.some((a) => a.value != null)) && (
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                <div className="text-xs text-bloomberg-amber font-bold mb-3">STOCK-BASED COMPENSATION (SBC)</div>
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">PERIOD</th><th className="text-right py-2 text-muted-foreground">SBC</th><th className="text-right py-2 text-muted-foreground">% REVENUE</th><th className="text-right py-2 text-muted-foreground">YoY</th></tr></thead>
                <tbody>
                  {annualSBC.filter((a) => a.value != null).map((s, i, arr) => { const y = yearFromDate(s.date); if (sbcTTM.some((t) => yearFromDate(t.date) === y)) return null; const rv = annualRevenue.find((r) => yearFromDate(r.date) === y); const pr = rv?.value && s.value ? (s.value / rv.value) * 100 : null; const pv = arr[i - 1]; const yoy = pv?.value && s.value ? ((s.value - pv.value) / Math.abs(pv.value)) * 100 : null; return (<tr key={`a-${i}`} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">FY{y}</td><td className="py-2 text-right font-bold">{fmtBigValue(s.value!, q.currency)}</td><td className={`py-2 text-right ${pr != null && pr > 20 ? "text-bloomberg-red" : pr != null && pr > 10 ? "text-bloomberg-amber" : ""}`}>{pr != null ? `${pr.toFixed(1)}%` : "N/A"}</td><td className={`py-2 text-right ${yoy != null && yoy > 0 ? "text-bloomberg-red" : "text-bloomberg-green"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "---"}</td></tr>) })}
                  {sbcTTM.map((s, i) => { const rv = revenueTTM.find((r) => r.date === s.date); const pr = rv ? (s.value / rv.value) * 100 : null; const py = parseInt(yearFromDate(s.date)) - 1; const ps = sbcTTM.find((x) => parseInt(yearFromDate(x.date)) === py) ?? annualSBC.find((a) => yearFromDate(a.date) === String(py)); const pv = ps && "value" in ps ? ps.value : null; const yoy = pv && pv !== 0 ? ((s.value - pv) / Math.abs(pv)) * 100 : null; return (<tr key={`t-${i}`} className="border-b border-bloomberg-border/50 bg-bloomberg-blue/5"><td className="py-2 font-bold">{s.label} <span className="text-[8px] text-bloomberg-blue">TTM</span></td><td className="py-2 text-right font-bold">{fmtBigValue(s.value, q.currency)}</td><td className={`py-2 text-right ${pr != null && pr > 20 ? "text-bloomberg-red" : pr != null && pr > 10 ? "text-bloomberg-amber" : ""}`}>{pr != null ? `${pr.toFixed(1)}%` : "N/A"}</td><td className={`py-2 text-right ${yoy != null && yoy > 0 ? "text-bloomberg-red" : "text-bloomberg-green"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "---"}</td></tr>) })}
                </tbody></table></div>
                <Explainer text="SBC obniża GAAP EPS ale nie wpływa na gotówkę. Wysoki SBC jako % Revenue może sygnalizować nadmierne rozwodnienie." />
              </div>
            )}
          </>)}

          {/* ═══ AKCJONARIAT & OWNERSHIP ═══ */}
          {ow && (
            <>
              <div className="border-t border-bloomberg-border pt-4 mt-2" />

              {/* Ownership Breakdown Pie */}
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                <div className="text-xs text-bloomberg-amber font-bold mb-3">OWNERSHIP BREAKDOWN</div>
                <div className="flex items-center gap-6">
                  <div className="w-48 h-48 shrink-0">
                    {(() => {
                      const inst = (ow.institutionsPercentHeld ?? 0) * 100
                      const ins = (ow.insidersPercentHeld ?? 0) * 100
                      const retail = Math.max(0, 100 - inst - ins)
                      const pieData = [{ name: "Institutional", value: parseFloat(inst.toFixed(1)) }, { name: "Insider", value: parseFloat(ins.toFixed(1)) }, { name: "Retail/Other", value: parseFloat(retail.toFixed(1)) }]
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={70} stroke="none">{pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx]} />)}</Pie><ReTooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 4, fontSize: 11 }} formatter={(v: unknown) => `${Number(v).toFixed(1)}%`} /></PieChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22c55e]" /><div className="text-xs"><div className="text-muted-foreground">Institutional</div><div className="font-bold text-sm">{fmtPct(ow.institutionsPercentHeld)}</div></div></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3b82f6]" /><div className="text-xs"><div className="text-muted-foreground">Insider</div><div className="font-bold text-sm">{fmtPct(ow.insidersPercentHeld)}</div></div></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#6b7280]" /><div className="text-xs"><div className="text-muted-foreground">Retail/Other</div><div className="font-bold text-sm">{((1 - (ow.institutionsPercentHeld ?? 0) - (ow.insidersPercentHeld ?? 0)) * 100).toFixed(1)}%</div></div></div>
                    {ow.institutionsCount != null && <div className="text-[10px] text-muted-foreground mt-2">{ow.institutionsCount} instytucji posiada akcje</div>}
                    <div className="text-[10px] text-muted-foreground">{(ow.institutionsPercentHeld ?? 0) > 0.7 ? "High institutional interest" : (ow.institutionsPercentHeld ?? 0) > 0.4 ? "Moderate institutional interest" : "Low institutional coverage"}</div>
                  </div>
                </div>
              </div>

              {/* Top 10 Institutions */}
              {ow.institutions.length > 0 && (
                <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                  <div className="text-xs text-bloomberg-amber font-bold mb-3">TOP {ow.institutions.length} INSTYTUCJI</div>
                  <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">INSTITUTION</th><th className="text-right py-2 text-muted-foreground">SHARES</th><th className="text-right py-2 text-muted-foreground">% OWNED</th><th className="text-right py-2 text-muted-foreground">VALUE</th><th className="text-center py-2 text-muted-foreground">CHANGE</th></tr></thead>
                  <tbody>{ow.institutions.map((inst, i) => {
                    const ch = inst.pctChange; const signal = ch == null ? null : ch > 0.05 ? "INCREASED" : ch < -0.05 ? "REDUCED" : null
                    return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{inst.organization}</td><td className="py-2 text-right">{inst.position != null ? fmtShares(inst.position) : "N/A"}</td><td className="py-2 text-right font-bold">{inst.pctHeld != null ? `${(inst.pctHeld * 100).toFixed(1)}%` : "N/A"}</td><td className="py-2 text-right">{inst.value != null ? fmtBigValue(inst.value, q.currency) : "N/A"}</td><td className="py-2 text-center">{signal === "INCREASED" ? <span className="text-[10px] bg-bloomberg-green/20 text-bloomberg-green px-1.5 py-0.5 rounded font-bold">+{((ch ?? 0) * 100).toFixed(0)}% ▲</span> : signal === "REDUCED" ? <span className="text-[10px] bg-bloomberg-red/20 text-bloomberg-red px-1.5 py-0.5 rounded font-bold">{((ch ?? 0) * 100).toFixed(0)}% ▼</span> : <span className="text-[10px] text-muted-foreground">—</span>}</td></tr>)
                  })}</tbody></table></div>
                </div>
              )}

              {/* Insider Activity */}
              {(() => {
                // Classify insider transactions
                const classifyTx = (type: string): "sale" | "purchase" | "award" | "other" => {
                  const t = type.toLowerCase()
                  if (t.includes("sale") || t.includes("sell")) return "sale"
                  if (t.includes("purchase") || t.includes("buy")) return "purchase"
                  if (t.includes("award") || t.includes("grant") || t.includes("rsu") || t.includes("vesting")) return "award"
                  return "other" // Option Exercise, Gift, etc.
                }

                const allTx = ow.insiderTransactions
                const openMarket = allTx.filter((tx) => { const c = classifyTx(tx.transactionType); return c === "sale" || c === "purchase" })
                const awards = allTx.filter((tx) => classifyTx(tx.transactionType) === "award")
                const other = allTx.filter((tx) => classifyTx(tx.transactionType) === "other")

                // Calculate Net Flow ONLY from open market transactions
                const omBuyShares = openMarket.filter((tx) => classifyTx(tx.transactionType) === "purchase").reduce((s, tx) => s + (tx.shares ?? 0), 0)
                const omSellShares = openMarket.filter((tx) => classifyTx(tx.transactionType) === "sale").reduce((s, tx) => s + (tx.shares ?? 0), 0)
                const omBuyCount = openMarket.filter((tx) => classifyTx(tx.transactionType) === "purchase").length
                const omSellCount = openMarket.filter((tx) => classifyTx(tx.transactionType) === "sale").length
                const netFlow = omBuyShares - omSellShares
                const hasOpenMarket = openMarket.length > 0

                const TxTable = ({ txs, caption }: { txs: typeof allTx; caption?: string }) => (
                  <div className="overflow-x-auto">
                    {caption && <div className="text-[10px] text-muted-foreground mb-1 italic">{caption}</div>}
                    <table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">NAME</th><th className="text-left py-2 text-muted-foreground">ROLE</th><th className="text-left py-2 text-muted-foreground">TYPE</th><th className="text-right py-2 text-muted-foreground">SHARES</th><th className="text-right py-2 text-muted-foreground">VALUE</th><th className="text-right py-2 text-muted-foreground">DATE</th></tr></thead>
                    <tbody>{txs.map((tx, i) => {
                      const c = classifyTx(tx.transactionType)
                      return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-1.5 font-bold">{tx.name}</td><td className="py-1.5 text-muted-foreground">{tx.relation}</td><td className={`py-1.5 ${c === "sale" ? "text-bloomberg-red" : c === "purchase" ? "text-bloomberg-green" : "text-muted-foreground"}`}>{tx.transactionType.split(" at ")[0]}</td><td className="py-1.5 text-right">{tx.shares != null ? fmtShares(tx.shares) : "N/A"}</td><td className="py-1.5 text-right">{tx.value != null && tx.value > 0 ? fmtBigValue(tx.value, q.currency) : "—"}</td><td className="py-1.5 text-right text-muted-foreground">{tx.date}</td></tr>)
                    })}</tbody></table>
                  </div>
                )

                return (
                  <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                    <div className="text-xs text-bloomberg-amber font-bold mb-3">INSIDER ACTIVITY (6M)</div>

                    {/* Summary bar — based ONLY on open market */}
                    <div className="flex flex-wrap items-center gap-4 mb-2 text-xs">
                      <span className="text-muted-foreground font-bold">Open Market:</span>
                      <span className="text-bloomberg-green font-bold">{omBuyCount} buy, {fmtShares(omBuyShares)} shares</span>
                      <span className="text-bloomberg-red font-bold">{omSellCount} sell, {fmtShares(omSellShares)} shares</span>
                      <span className={`font-bold ${netFlow > 0 ? "text-bloomberg-green" : netFlow < 0 ? "text-bloomberg-red" : "text-muted-foreground"}`}>Net: {netFlow > 0 ? "+" : ""}{fmtShares(netFlow)} shares</span>
                    </div>
                    {awards.length > 0 && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <span>Stock Awards: {awards.length} tx (RSU vesting — not indicative)</span>
                      </div>
                    )}

                    {/* Signal — based ONLY on open market transactions */}
                    <div className="text-xs mb-3">
                      {!hasOpenMarket
                        ? <span className="text-muted-foreground">⚪ No open market activity</span>
                        : netFlow > 0
                          ? <span className="text-bloomberg-green">🟢 Insider buying — bullish signal</span>
                          : netFlow < 0
                            ? <span className="text-bloomberg-red">🔴 Insider selling — monitor closely</span>
                            : <span className="text-muted-foreground">⚪ No significant insider activity</span>
                      }
                    </div>

                    {/* Open Market Transactions */}
                    {openMarket.length > 0 && (<>
                      <div className="text-[10px] text-bloomberg-amber font-bold mb-1 mt-2">OPEN MARKET TRANSACTIONS</div>
                      <TxTable txs={openMarket.slice(0, 10)} />
                    </>)}

                    {/* Stock Awards & Vesting */}
                    {awards.length > 0 && (<>
                      <div className="text-[10px] text-bloomberg-amber font-bold mb-1 mt-4">STOCK AWARDS & VESTING</div>
                      <TxTable txs={awards.slice(0, 10)} caption="Automatyczne przyznanie akcji — część wynagrodzenia. Nie wliczane do Net Flow." />
                    </>)}

                    {/* Other */}
                    {other.length > 0 && (<>
                      <div className="text-[10px] text-bloomberg-amber font-bold mb-1 mt-4">OTHER (Option Exercise, Gift, etc.)</div>
                      <TxTable txs={other.slice(0, 5)} />
                    </>)}

                    <Explainer text="Insider sales mogą być rutynowe (RSU vesting). Kupno insiderów jest silniejszym sygnałem niż sprzedaż. Tabela pokazuje tylko Open Market transactions w kalkulacji Net Flow." />
                  </div>
                )
              })()}
            </>
          )}

          {e.quarterly.length === 0 && e.financials.length === 0 && (e.incomeStatements ?? []).length === 0 && <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4 text-center text-muted-foreground text-sm">No earnings data available for this ticker</div>}
        </div>
      )}
    </div>
  )
}
