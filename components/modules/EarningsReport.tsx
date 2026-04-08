"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { CheckCircle, XCircle, Minus, AlertTriangle, TrendingUp, TrendingDown, Info } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts"
import TerminalInput from "@/components/TerminalInput"
import BarCompareChart from "@/components/charts/BarCompareChart"
import type { QuoteData, EarningsData } from "@/lib/yahoo"
import { fmtBigValue } from "@/lib/currency"
import { calculateFinancialScore, type ScoreBreakdown } from "@/lib/financialScore"

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
  return <div className="flex items-start gap-1.5 text-[12px] text-muted-foreground mt-1"><Info className="w-3 h-3 mt-0.5 shrink-0 opacity-50" /><span>{text}</span></div>
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
      <div className="text-[12px] text-muted-foreground mb-3">TTM = Trailing Twelve Months (suma 4 kwartałów) — eliminuje sezonowość</div>
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
              {growth != null ? <div className="flex flex-col items-center"><div className={`text-[12px] font-bold flex items-center gap-0.5 ${growth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{growth >= 0 ? "+" : ""}{growth.toFixed(1)}%</div><div className="text-[12px] text-muted-foreground text-center">{compLabel}</div></div> : <div className="h-[26px]" />}
              <div className="w-full flex items-end h-28"><div className={`flex-1 rounded-t transition-all ${bar.isEstimate ? "border-2 border-dashed border-bloomberg-amber bg-bloomberg-amber/20" : bar.isTTM ? `${color} ring-1 ring-white/20` : negative ? "bg-bloomberg-red" : `${color} opacity-60`}`} style={{ height: `${Math.max(h, 2)}%` }} /></div>
              <div className="text-[12px] text-center font-bold text-muted-foreground leading-tight">{bar.label}</div>
              <div className="text-[12px] text-muted-foreground text-center">{fmtBigValue(bar.value, currency)}</div>
              {bar.isTTM && <div className="text-[12px] text-bloomberg-blue font-bold">TTM</div>}
              {bar.isEstimate && <div className="text-[13px] text-bloomberg-amber font-bold">EST</div>}
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
        return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{row.label}</td><td className="py-2 text-[12px] text-muted-foreground">{row.sublabel}</td><td className={`py-2 text-right font-bold ${row.value >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(row.value, currency)}</td><td className={`py-2 text-right ${change != null && change >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{change != null ? <span>{change >= 0 ? "+" : ""}{change.toFixed(1)}% <span className="text-[12px] text-muted-foreground">{compRef}</span></span> : "---"}</td><td className="py-2 text-center">{row.isEstimate ? <span className="text-[12px] bg-bloomberg-amber/20 text-bloomberg-amber px-1.5 py-0.5 rounded font-bold">EST</span> : <span className="text-[12px] text-muted-foreground">ACTUAL</span>}</td></tr>)
      })}</tbody></table></div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   PRZEGLĄD WYNIKÓW
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
   FINANCIAL REPORT — Raport finansowy (algorytmiczny)
   ══════════════════════════════════════════════════════════════ */

function FinancialReport({ earnings: e, quote: q, currency }: { earnings: EarningsData; quote: QuoteData; currency: string }) {
  const ann = (e.annualStatements ?? []).filter(a => a.revenue != null).sort((a, b) => a.date.localeCompare(b.date))
  const qtr = (e.incomeStatements ?? []).filter(a => a.revenue != null).sort((a, b) => a.date.localeCompare(b.date)).slice(-8) // last 8 quarters
  const cfAnn = (e.cashFlowAnnual ?? []).sort((a, b) => a.date.localeCompare(b.date))
  const bsAnn = (e.balanceSheetAnnual ?? []).sort((a, b) => a.date.localeCompare(b.date))
  const bsQ = (e.balanceSheetQuarterly ?? []).sort((a, b) => a.date.localeCompare(b.date))

  if (ann.length < 1) return null

  const latest = ann[ann.length - 1]
  const latestBS = bsQ.length > 0 ? bsQ[bsQ.length - 1] : bsAnn.length > 0 ? bsAnn[bsAnn.length - 1] : null
  const latestCF = cfAnn.length > 0 ? cfAnn[cfAnn.length - 1] : null

  const pct = (part: number | null, whole: number | null) => (part != null && whole != null && whole !== 0) ? ((part / whole) * 100).toFixed(1) + "%" : "—"
  const chg = (curr: number | null, prev: number | null) => (curr != null && prev != null && prev !== 0) ? (((curr - prev) / Math.abs(prev)) * 100).toFixed(1) : null
  const valColor = (v: number | null) => v == null ? "text-muted-foreground" : v > 0 ? "text-bloomberg-green" : v < 0 ? "text-bloomberg-red" : "text-muted-foreground"
  const fmtV = (v: number | null) => v != null ? fmtBigValue(v, currency) : "—"
  const pctColor = (s: string | null) => {
    if (!s || s === "—") return "text-muted-foreground"
    const n = parseFloat(s)
    return n > 0 ? "text-bloomberg-green" : n < 0 ? "text-bloomberg-red" : "text-muted-foreground"
  }

  // ── P&L WATERFALL rows ──
  type PLRow = { label: string; key: string; indent?: boolean; isBold?: boolean; isSubtotal?: boolean }
  const plRows: PLRow[] = [
    { label: "Przychody", key: "revenue", isBold: true },
    { label: "Koszt własny sprzedaży", key: "costOfRevenue", indent: true },
    { label: "ZYSK BRUTTO", key: "grossProfit", isBold: true, isSubtotal: true },
    { label: "SG&A (Sprzedaż, administracja)", key: "sga", indent: true },
    { label: "R&D (Badania i rozwój)", key: "rd", indent: true },
    { label: "ZYSK OPERACYJNY", key: "operatingIncome", isBold: true, isSubtotal: true },
    { label: "Odsetki", key: "interest", indent: true },
    { label: "Podatki", key: "tax", indent: true },
    { label: "Pozostałe", key: "other", indent: true },
    { label: "ZYSK NETTO", key: "netIncome", isBold: true, isSubtotal: true },
  ]

  const getPlValue = (a: typeof ann[0], key: string): number | null => {
    switch (key) {
      case "revenue": return a.revenue
      case "costOfRevenue": return a.costOfRevenue != null ? -Math.abs(a.costOfRevenue) : null
      case "grossProfit": return a.grossProfit ?? (a.revenue != null && a.costOfRevenue != null ? a.revenue - a.costOfRevenue : null)
      case "sga": return a.sellingGeneralAndAdministration != null ? -Math.abs(a.sellingGeneralAndAdministration) : null
      case "rd": return a.researchAndDevelopment != null ? -Math.abs(a.researchAndDevelopment) : null
      case "operatingIncome": return a.operatingIncome
      case "interest": return a.interestExpense != null ? -Math.abs(a.interestExpense) : null
      case "tax": return a.taxProvision != null ? -Math.abs(a.taxProvision) : null
      case "other": return a.otherIncomeExpense
      case "netIncome": return a.netIncome
      default: return null
    }
  }

  // ── ONE-TIME ITEM DETECTION ──
  // Detect if a value is a one-time/non-recurring anomaly:
  // 1. Compare each value to median of the series
  // 2. If |value| > 3× median AND significant vs revenue (>5%), flag it
  // 3. Only flag non-subtotal, non-revenue rows (interest, tax, other)
  const oneTimeKeys = new Set(["other", "tax", "interest", "sga", "rd", "costOfRevenue"])
  const isOneTimeItem = (key: string, vals: (number | null)[], idx: number, rev: number | null): boolean => {
    if (!oneTimeKeys.has(key)) return false
    const v = vals[idx]
    if (v == null || rev == null || rev === 0) return false
    // Must be significant relative to revenue (>5%)
    if (Math.abs(v) / Math.abs(rev) < 0.05) return false
    // Get non-null values for comparison
    const nonNull = vals.filter((x): x is number => x != null)
    if (nonNull.length < 3) return false
    // Calculate median absolute value
    const sorted = nonNull.map(x => Math.abs(x)).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (median === 0) return Math.abs(v) > 0
    // Flag if this value is >3× the median
    return Math.abs(v) / median > 3
  }

  // ── BALANCE SHEET rows ──
  type BSRow = { label: string; getValue: (b: typeof latestBS) => number | null; isBold?: boolean; isRatio?: boolean; ratioFn?: (b: typeof latestBS) => string }
  const bsRows: BSRow[] = [
    { label: "Gotówka i ekwiwalenty", getValue: b => b?.cashAndEquivalents ?? null },
    { label: "Aktywa obrotowe", getValue: b => b?.currentAssets ?? null },
    { label: "Aktywa razem", getValue: b => b?.totalAssets ?? null, isBold: true },
    { label: "Goodwill", getValue: b => b?.goodwill ?? null },
    { label: "Wartości niematerialne", getValue: b => b?.intangibleAssets ?? null },
    { label: "Zobowiązania bieżące", getValue: b => b?.currentLiabilities ?? null },
    { label: "Dług", getValue: b => b?.totalDebt ?? null },
    { label: "Zobowiązania razem", getValue: b => b?.totalLiabilities ?? null, isBold: true },
    { label: "Kapitał własny", getValue: b => b?.stockholdersEquity ?? null, isBold: true },
    { label: "Zyski zatrzymane", getValue: b => b?.retainedEarnings ?? null },
    { label: "Należności", getValue: b => b?.accountsReceivable ?? null },
  ]

  // ── CASH FLOW rows ──
  type CFRow = { label: string; getValue: (c: typeof latestCF) => number | null; isBold?: boolean }
  const cfRows: CFRow[] = [
    { label: "Przepływy operacyjne (OCF)", getValue: c => c?.operatingCashFlow ?? null, isBold: true },
    { label: "CapEx", getValue: c => c?.capitalExpenditure ?? null },
    { label: "Free Cash Flow (FCF)", getValue: c => c?.freeCashFlow ?? null, isBold: true },
    { label: "SBC (wynagrodzenie akcjami)", getValue: c => c?.stockBasedCompensation ?? null },
    { label: "Buyback (skup akcji)", getValue: c => c?.repurchaseOfStock ?? null },
    { label: "Emisja akcji", getValue: c => c?.issuanceOfStock ?? null },
  ]

  // ── ALGORITHMIC COMMENTARY ──
  const comments: { text: string; type: "good" | "warn" | "bad" | "neutral" }[] = []

  // Revenue growth
  if (ann.length >= 2) {
    const first = ann[0]; const last = ann[ann.length - 1]
    if (first.revenue && last.revenue) {
      const totalGrowth = ((last.revenue - first.revenue) / Math.abs(first.revenue)) * 100
      const years = ann.length - 1
      const ratio = first.revenue !== 0 ? last.revenue / first.revenue : 0
      const cagr = years > 0 && ratio > 0 ? ((Math.pow(ratio, 1 / years) - 1) * 100) : 0
      comments.push({
        text: `Przychody wzrosły z ${fmtV(first.revenue)} (${yearFromDate(first.date)}) do ${fmtV(last.revenue)} (${yearFromDate(last.date)}), CAGR: ${cagr.toFixed(1)}%.`,
        type: cagr > 15 ? "good" : cagr > 5 ? "neutral" : cagr > 0 ? "warn" : "bad"
      })
    }
  }

  // Gross Margin
  if (latest.grossProfit != null && latest.revenue) {
    const gm = (latest.grossProfit / latest.revenue) * 100
    comments.push({
      text: `Marża brutto: ${gm.toFixed(1)}% — ${gm > 60 ? "wysoka, silna pozycja cenowa" : gm > 40 ? "umiarkowana" : gm > 20 ? "niska, presja kosztowa" : "bardzo niska, model niskomarżowy"}.`,
      type: gm > 50 ? "good" : gm > 30 ? "neutral" : "warn"
    })
  }

  // SG&A discipline
  if (latest.sellingGeneralAndAdministration != null && latest.revenue) {
    const sgaPct = (latest.sellingGeneralAndAdministration / latest.revenue) * 100
    comments.push({
      text: `SG&A stanowi ${sgaPct.toFixed(1)}% przychodów — ${sgaPct > 40 ? "bardzo wysoki, brak dźwigni operacyjnej" : sgaPct > 25 ? "podwyższony, wymaga optymalizacji" : "kontrolowany"}.`,
      type: sgaPct < 25 ? "good" : sgaPct < 40 ? "warn" : "bad"
    })
    // Check SG&A scaling over time
    if (ann.length >= 2) {
      const prev = ann[ann.length - 2]
      if (prev.sellingGeneralAndAdministration && prev.revenue && latest.revenue) {
        const sgaGrowth = ((latest.sellingGeneralAndAdministration - prev.sellingGeneralAndAdministration) / Math.abs(prev.sellingGeneralAndAdministration)) * 100
        const revGrowth = ((latest.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100
        if (revGrowth > sgaGrowth + 5) {
          comments.push({ text: `Pozytywny sygnał: przychody rosną szybciej (${revGrowth.toFixed(1)}%) niż SG&A (${sgaGrowth.toFixed(1)}%) — pojawia się dźwignia operacyjna.`, type: "good" })
        } else if (sgaGrowth > revGrowth + 5) {
          comments.push({ text: `Negatywny sygnał: SG&A (${sgaGrowth.toFixed(1)}%) rośnie szybciej niż przychody (${revGrowth.toFixed(1)}%) — brak skalowalności.`, type: "bad" })
        }
      }
    }
  }

  // Operating income trend
  if (latest.operatingIncome != null && ann.length >= 2) {
    const prev = ann[ann.length - 2]
    if (prev.operatingIncome != null) {
      if (prev.operatingIncome < 0 && latest.operatingIncome >= 0) {
        comments.push({ text: `Zysk operacyjny przeszedł z ujemnego (${fmtV(prev.operatingIncome)}) na dodatni (${fmtV(latest.operatingIncome)}) — punkt zwrotny.`, type: "good" })
      } else if (latest.operatingIncome < 0) {
        comments.push({ text: `Zysk operacyjny wciąż ujemny: ${fmtV(latest.operatingIncome)}.`, type: "bad" })
      }
    }
  }

  // Balance sheet: goodwill risk
  if (latestBS?.goodwill != null && latestBS?.totalAssets != null && latestBS.totalAssets > 0) {
    const gwPct = ((latestBS.goodwill + (latestBS.intangibleAssets ?? 0)) / latestBS.totalAssets) * 100
    if (gwPct > 30) {
      comments.push({ text: `Goodwill + wartości niematerialne stanowią ${gwPct.toFixed(0)}% aktywów — wzrost oparty na akwizycjach, ryzyko odpisów.`, type: "warn" })
    }
  }

  // Balance sheet: liquidity
  if (latestBS?.currentAssets != null && latestBS?.currentLiabilities != null && latestBS.currentLiabilities > 0) {
    const cr = latestBS.currentAssets / latestBS.currentLiabilities
    comments.push({
      text: `Wskaźnik płynności bieżącej: ${cr.toFixed(2)}x — ${cr > 2 ? "silna płynność" : cr > 1.2 ? "wystarczająca płynność" : cr > 1 ? "napięta płynność, do obserwacji" : "poniżej 1.0x — ryzyko płynnościowe"}.`,
      type: cr > 1.5 ? "good" : cr > 1 ? "warn" : "bad"
    })
  }

  // Retained earnings
  if (latestBS?.retainedEarnings != null && latestBS.retainedEarnings < 0) {
    comments.push({ text: `Zyski zatrzymane głęboko ujemne (${fmtV(latestBS.retainedEarnings)}) — historycznie akcjonariusze finansowali straty.`, type: "warn" })
  }

  // Debt
  if (latestBS?.totalDebt != null && latest.revenue) {
    const debtToRev = (latestBS.totalDebt / latest.revenue) * 100
    comments.push({
      text: `Dług: ${fmtV(latestBS.totalDebt)} (${debtToRev.toFixed(0)}% przychodów) — ${debtToRev > 100 ? "wysoki" : debtToRev > 50 ? "umiarkowany" : "niski"}.`,
      type: debtToRev < 50 ? "good" : debtToRev < 100 ? "neutral" : "warn"
    })
  }

  // Cash flow: OCF quality
  if (latestCF?.operatingCashFlow != null && latest.revenue) {
    const ocfMargin = (latestCF.operatingCashFlow / latest.revenue) * 100
    comments.push({
      text: `OCF margin: ${ocfMargin.toFixed(1)}% — ${ocfMargin > 20 ? "silna konwersja gotówkowa" : ocfMargin > 10 ? "przyzwoita" : ocfMargin > 0 ? "słaba" : "ujemna — firma spala gotówkę"}.`,
      type: ocfMargin > 15 ? "good" : ocfMargin > 5 ? "neutral" : "bad"
    })
  }

  // SBC vs FCF
  if (latestCF?.stockBasedCompensation != null && latestCF?.freeCashFlow != null && latestCF.freeCashFlow > 0) {
    const sbcPctFcf = (latestCF.stockBasedCompensation / latestCF.freeCashFlow) * 100
    if (sbcPctFcf > 80) {
      comments.push({ text: `SBC stanowi ${sbcPctFcf.toFixed(0)}% FCF — większość wolnej gotówki to efekt dystrybucji kosztu przez rozwodnienie, nie realny zysk.`, type: "bad" })
    } else if (sbcPctFcf > 40) {
      comments.push({ text: `SBC stanowi ${sbcPctFcf.toFixed(0)}% FCF — znacząca część gotówki pochodzi z kompensacji akcjami.`, type: "warn" })
    }
  }

  // Buybacks
  if (latestCF?.repurchaseOfStock != null && Math.abs(latestCF.repurchaseOfStock) > 0) {
    comments.push({
      text: `Skup akcji: ${fmtV(Math.abs(latestCF.repurchaseOfStock))} — ${latestCF.issuanceOfStock != null && latestCF.issuanceOfStock > 0 ? "ale jednocześnie emitowano nowe akcje" : "firma zwraca kapitał akcjonariuszom"}.`,
      type: "neutral"
    })
  }

  return (
    <div className="space-y-3">
      <div className="border-t border-bloomberg-border pt-4 mt-2" />
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider">📊 RAPORT FINANSOWY — OSTATNIE SPRAWOZDANIE</div>

      {/* ── P&L WATERFALL ── */}
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
        <div className="text-[12px] text-bloomberg-amber font-bold mb-3">RACHUNEK ZYSKÓW I STRAT (ROCZNY)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-bloomberg-border">
                <th className="text-left py-1.5 text-muted-foreground sticky left-0 bg-bloomberg-card z-10 min-w-[160px]">POZYCJA</th>
                {ann.map((a, i) => (
                  <th key={i} className="text-right py-1.5 text-muted-foreground min-w-[90px]">{yearFromDate(a.date)}</th>
                ))}
                {ann.length >= 2 && <th className="text-right py-1.5 text-muted-foreground min-w-[70px]">YoY</th>}
              </tr>
            </thead>
            <tbody>
              {plRows.map((row, ri) => {
                const vals = ann.map(a => getPlValue(a, row.key))
                const lastTwo = vals.length >= 2 ? [vals[vals.length - 2], vals[vals.length - 1]] : null
                const yoyVal = lastTwo && lastTwo[0] != null && lastTwo[1] != null && lastTwo[0] !== 0 ? chg(lastTwo[1], lastTwo[0]) : null
                return (
                  <tr key={ri} className={`border-b border-bloomberg-border/30 ${row.isSubtotal ? "bg-bloomberg-bg/30" : ""}`}>
                    <td className={`py-1.5 sticky left-0 bg-bloomberg-card z-10 ${row.indent ? "pl-3 text-muted-foreground" : ""} ${row.isBold ? "font-bold text-foreground" : ""}`}>
                      {row.label}
                    </td>
                    {vals.map((v, vi) => {
                      const flagged = isOneTimeItem(row.key, vals, vi, ann[vi].revenue)
                      return (
                        <td key={vi} className={`py-1.5 text-right ${row.isBold ? "font-bold" : ""} ${row.isSubtotal ? valColor(v) : v != null && v < 0 ? "text-bloomberg-red/70" : "text-muted-foreground"}`}>
                          {fmtV(v)}
                          {row.isSubtotal && v != null && ann[vi].revenue ? (
                            <span className="text-[13px] text-muted-foreground/60 ml-0.5">({pct(v, ann[vi].revenue)})</span>
                          ) : null}
                          {flagged && (
                            <span className="ml-1 text-[13px] text-yellow-400 border border-yellow-400/40 rounded px-0.5" title="Pozycja jednorazowa — odbiega znacząco od normy historycznej">1x</span>
                          )}
                        </td>
                      )
                    })}
                    {ann.length >= 2 && (
                      <td className={`py-1.5 text-right font-bold ${pctColor(yoyVal)}`}>
                        {yoyVal != null ? `${parseFloat(yoyVal) > 0 ? "+" : ""}${yoyVal}%` : "—"}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Explainer text="Wartości ujemne oznaczają koszty. % w nawiasach to udział w przychodach. YoY = zmiana ostatni rok vs poprzedni. Tag [1x] = pozycja jednorazowa." />

        {/* ── P&L VISUAL BAR (stacked for latest year) ── */}
        {latest.revenue != null && latest.revenue > 0 && (
          <div className="mt-3">
            <div className="text-[12px] text-muted-foreground mb-1.5">STRUKTURA KOSZTÓW — {yearFromDate(latest.date)}</div>
            {(() => {
              const rev = latest.revenue!
              const items = [
                { label: "Koszt sprzedaży", val: latest.costOfRevenue, color: "bg-red-600/60" },
                { label: "SG&A", val: latest.sellingGeneralAndAdministration, color: "bg-red-500/50" },
                { label: "R&D", val: latest.researchAndDevelopment, color: "bg-orange-500/50" },
              ].filter(x => x.val != null && x.val > 0) as { label: string; val: number; color: string }[]
              const totalCost = items.reduce((s, x) => s + x.val, 0)
              const profit = rev - totalCost
              return (
                <div className="space-y-1">
                  <div className="flex h-5 rounded overflow-hidden border border-bloomberg-border/30">
                    {items.map((item, i) => (
                      <div key={i} className={`${item.color} flex items-center justify-center text-[13px] text-white/80 overflow-hidden`}
                        style={{ width: `${(item.val / rev) * 100}%` }}>
                        {(item.val / rev) * 100 > 8 ? `${item.label} ${((item.val / rev) * 100).toFixed(0)}%` : ""}
                      </div>
                    ))}
                    <div className={`${profit >= 0 ? "bg-bloomberg-green/40" : "bg-bloomberg-red/40"} flex items-center justify-center text-[13px] text-white/80`}
                      style={{ width: `${Math.max((Math.abs(profit) / rev) * 100, 2)}%` }}>
                      {profit >= 0 ? `Zysk ${((profit / rev) * 100).toFixed(0)}%` : `Strata`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[13px] text-muted-foreground">
                    {items.map((item, i) => (
                      <span key={i}><span className={`inline-block w-2 h-2 rounded-sm mr-0.5 ${item.color}`} />{item.label}: {fmtV(item.val)} ({((item.val / rev) * 100).toFixed(1)}%)</span>
                    ))}
                    <span><span className={`inline-block w-2 h-2 rounded-sm mr-0.5 ${profit >= 0 ? "bg-bloomberg-green/40" : "bg-bloomberg-red/40"}`} />
                      Pozostałe/Zysk: {fmtV(profit)}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── P&L QUARTERLY ── */}
      {qtr.length > 0 && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
          <div className="text-[12px] text-bloomberg-amber font-bold mb-3">RACHUNEK ZYSKÓW I STRAT (KWARTALNY)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-bloomberg-border">
                  <th className="text-left py-1.5 text-muted-foreground sticky left-0 bg-bloomberg-card z-10 min-w-[160px]">POZYCJA</th>
                  {qtr.map((q2, i) => (
                    <th key={i} className="text-right py-1.5 text-muted-foreground min-w-[80px]">{shortQLabel(q2.date)}</th>
                  ))}
                  {qtr.length >= 2 && <th className="text-right py-1.5 text-muted-foreground min-w-[60px]">QoQ</th>}
                </tr>
              </thead>
              <tbody>
                {plRows.map((row, ri) => {
                  const vals = qtr.map(a => getPlValue(a, row.key))
                  const lastTwo = vals.length >= 2 ? [vals[vals.length - 2], vals[vals.length - 1]] : null
                  const qoqVal = lastTwo && lastTwo[0] != null && lastTwo[1] != null && lastTwo[0] !== 0 ? chg(lastTwo[1], lastTwo[0]) : null
                  return (
                    <tr key={ri} className={`border-b border-bloomberg-border/30 ${row.isSubtotal ? "bg-bloomberg-bg/30" : ""}`}>
                      <td className={`py-1.5 sticky left-0 bg-bloomberg-card z-10 ${row.indent ? "pl-3 text-muted-foreground" : ""} ${row.isBold ? "font-bold text-foreground" : ""}`}>
                        {row.label}
                      </td>
                      {vals.map((v, vi) => {
                        const flagged = isOneTimeItem(row.key, vals, vi, qtr[vi].revenue)
                        return (
                          <td key={vi} className={`py-1.5 text-right ${row.isBold ? "font-bold" : ""} ${row.isSubtotal ? valColor(v) : v != null && v < 0 ? "text-bloomberg-red/70" : "text-muted-foreground"}`}>
                            {fmtV(v)}
                            {row.isSubtotal && v != null && qtr[vi].revenue ? (
                              <span className="text-[13px] text-muted-foreground/60 ml-0.5">({pct(v, qtr[vi].revenue)})</span>
                            ) : null}
                            {flagged && (
                              <span className="ml-1 text-[13px] text-yellow-400 border border-yellow-400/40 rounded px-0.5" title="Pozycja jednorazowa — odbiega znacząco od normy historycznej">1x</span>
                            )}
                          </td>
                        )
                      })}
                      {qtr.length >= 2 && (
                        <td className={`py-1.5 text-right font-bold ${pctColor(qoqVal)}`}>
                          {qoqVal != null ? `${parseFloat(qoqVal) > 0 ? "+" : ""}${qoqVal}%` : "—"}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Explainer text="Ostatnie 8 kwartałów. % w nawiasach to udział w przychodach. QoQ = zmiana vs poprzedni kwartał. Tag [1x] = pozycja jednorazowa." />
        </div>
      )}

      {/* ── BALANCE SHEET ── */}
      {latestBS && (latestBS.totalAssets != null || latestBS.totalDebt != null) && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
          <div className="text-[12px] text-bloomberg-amber font-bold mb-3">BILANS — {latestBS.date ? shortQLabel(latestBS.date) : "OSTATNI"}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Assets */}
            <div>
              <div className="text-[12px] text-bloomberg-green font-bold mb-1.5">AKTYWA</div>
              <table className="w-full text-[13px]">
                <tbody>
                  {bsRows.filter(r => ["Gotówka i ekwiwalenty", "Aktywa obrotowe", "Aktywa razem", "Goodwill", "Wartości niematerialne", "Należności"].includes(r.label)).map((row, i) => {
                    const v = row.getValue(latestBS)
                    if (v == null && !row.isBold) return null
                    return (
                      <tr key={i} className="border-b border-bloomberg-border/20">
                        <td className={`py-1 ${row.isBold ? "font-bold" : "text-muted-foreground pl-2"}`}>{row.label}</td>
                        <td className={`py-1 text-right ${row.isBold ? "font-bold text-bloomberg-green" : ""}`}>{fmtV(v)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Liabilities + Equity */}
            <div>
              <div className="text-[12px] text-bloomberg-red font-bold mb-1.5">PASYWA</div>
              <table className="w-full text-[13px]">
                <tbody>
                  {bsRows.filter(r => ["Zobowiązania bieżące", "Dług", "Zobowiązania razem", "Kapitał własny", "Zyski zatrzymane"].includes(r.label)).map((row, i) => {
                    const v = row.getValue(latestBS)
                    if (v == null && !row.isBold) return null
                    const isEquity = row.label === "Kapitał własny"
                    return (
                      <tr key={i} className="border-b border-bloomberg-border/20">
                        <td className={`py-1 ${row.isBold ? "font-bold" : "text-muted-foreground pl-2"}`}>{row.label}</td>
                        <td className={`py-1 text-right ${row.isBold ? `font-bold ${isEquity ? "text-bloomberg-blue" : "text-bloomberg-red"}` : ""} ${!row.isBold && v != null && v < 0 ? "text-bloomberg-red" : ""}`}>{fmtV(v)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ratios */}
          <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
            {latestBS.currentAssets != null && latestBS.currentLiabilities != null && latestBS.currentLiabilities > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Płynność bieżąca:</span>
                <span className={`font-bold ${(latestBS.currentAssets / latestBS.currentLiabilities) >= 1.2 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                  {(latestBS.currentAssets / latestBS.currentLiabilities).toFixed(2)}x
                </span>
              </div>
            )}
            {latestBS.totalDebt != null && latestBS.stockholdersEquity != null && latestBS.stockholdersEquity > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Dług/Kapitał:</span>
                <span className={`font-bold ${(latestBS.totalDebt / latestBS.stockholdersEquity) <= 1 ? "text-bloomberg-green" : "text-bloomberg-amber"}`}>
                  {(latestBS.totalDebt / latestBS.stockholdersEquity).toFixed(2)}x
                </span>
              </div>
            )}
            {latestBS.goodwill != null && latestBS.totalAssets != null && latestBS.totalAssets > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Goodwill/Aktywa:</span>
                <span className={`font-bold ${((latestBS.goodwill + (latestBS.intangibleAssets ?? 0)) / latestBS.totalAssets) > 0.3 ? "text-bloomberg-amber" : "text-muted-foreground"}`}>
                  {(((latestBS.goodwill + (latestBS.intangibleAssets ?? 0)) / latestBS.totalAssets) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CASH FLOW ANNUAL ── */}
      {cfAnn.length > 0 && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
          <div className="text-[12px] text-bloomberg-amber font-bold mb-3">PRZEPŁYWY PIENIĘŻNE (ROCZNE)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-bloomberg-border">
                  <th className="text-left py-1.5 text-muted-foreground sticky left-0 bg-bloomberg-card z-10 min-w-[160px]">POZYCJA</th>
                  {cfAnn.map((c, i) => (
                    <th key={i} className="text-right py-1.5 text-muted-foreground min-w-[90px]">{yearFromDate(c.date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-bloomberg-border/30">
                    <td className={`py-1.5 sticky left-0 bg-bloomberg-card z-10 ${row.isBold ? "font-bold" : "text-muted-foreground pl-2"}`}>{row.label}</td>
                    {cfAnn.map((c, ci) => {
                      const v = row.getValue(c)
                      return <td key={ci} className={`py-1.5 text-right ${row.isBold ? "font-bold" : ""} ${valColor(v)}`}>{fmtV(v)}</td>
                    })}
                  </tr>
                ))}
                {/* FCF - SBC row */}
                <tr className="border-b border-bloomberg-border/30 bg-bloomberg-bg/30">
                  <td className="py-1.5 sticky left-0 bg-bloomberg-card z-10 font-bold">FCF realny (FCF − SBC)</td>
                  {cfAnn.map((c, ci) => {
                    const fcf = c.freeCashFlow; const sbc = c.stockBasedCompensation
                    const realFcf = fcf != null && sbc != null ? fcf - sbc : null
                    return <td key={ci} className={`py-1.5 text-right font-bold ${valColor(realFcf)}`}>{fmtV(realFcf)}</td>
                  })}
                </tr>
                {/* SBC % Revenue */}
                {ann.length > 0 && (
                  <tr className="border-b border-bloomberg-border/30">
                    <td className="py-1.5 sticky left-0 bg-bloomberg-card z-10 text-muted-foreground pl-2">SBC % przychodów</td>
                    {cfAnn.map((c, ci) => {
                      const matchAnn = ann.find(a => yearFromDate(a.date) === yearFromDate(c.date))
                      const sbcPct = c.stockBasedCompensation != null && matchAnn?.revenue ? ((c.stockBasedCompensation / matchAnn.revenue) * 100) : null
                      return <td key={ci} className={`py-1.5 text-right ${sbcPct != null && sbcPct > 15 ? "text-bloomberg-red" : sbcPct != null && sbcPct > 8 ? "text-bloomberg-amber" : "text-muted-foreground"}`}>
                        {sbcPct != null ? `${sbcPct.toFixed(1)}%` : "—"}
                      </td>
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Explainer text="FCF realny = Free Cash Flow minus SBC. Pokazuje ile gotówki firma generuje po uwzględnieniu rozwodnienia." />
        </div>
      )}

      {/* ── KOMENTARZ ALGORYTMICZNY ── */}
      {comments.length > 0 && (
        <div className="bg-bloomberg-card border border-bloomberg-amber/30 rounded p-4">
          <div className="text-[12px] text-bloomberg-amber font-bold mb-3">💬 KOMENTARZ — PODSUMOWANIE</div>
          <div className="space-y-1.5">
            {comments.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="shrink-0 mt-0.5">{c.type === "good" ? "🟢" : c.type === "warn" ? "🟡" : c.type === "bad" ? "🔴" : "⚪"}</span>
                <span className={c.type === "good" ? "text-bloomberg-green" : c.type === "bad" ? "text-bloomberg-red" : c.type === "warn" ? "text-bloomberg-amber" : "text-muted-foreground"}>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
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

  // Financial Score
  const scoreData: ScoreBreakdown | null = q && e ? calculateFinancialScore(q, e) : null

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
      <TerminalInput placeholder="Wpisz ticker (np. AAPL, GOOGL, TSLA)" onSubmit={handleAnalyze} loading={loading} label="EARNINGS >" defaultValue={lastTicker} />
      {error && <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {q && e && (
        <div className="space-y-4">

          {/* ═══ HEADER ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div><span className="text-xl font-bold text-bloomberg-green">{q.symbol}</span><span className="text-sm text-muted-foreground ml-2">{q.name}</span></div>
              </div>
              {scoreData && <FinancialScoreCircle score={scoreData} />}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 items-center">
              {gaapEpsTTMVal != null && <div className="flex items-center gap-2"><span className="text-[12px] bg-bloomberg-red/20 text-bloomberg-red px-1.5 py-0.5 rounded font-bold">GAAP</span><span className="text-xs text-muted-foreground">EPS (TTM):</span><span className={`font-bold text-sm ${gaapEpsTTMVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{gaapEpsTTMVal.toFixed(2)}</span></div>}
              {nonGaapEpsTTMVal != null && hasGaapDiff && <div className="flex items-center gap-2"><span className="text-[12px] bg-bloomberg-blue/20 text-bloomberg-blue px-1.5 py-0.5 rounded font-bold">ADJ</span><span className="text-xs text-muted-foreground">EPS Non-GAAP (TTM):</span><span className={`font-bold text-sm ${nonGaapEpsTTMVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{nonGaapEpsTTMVal.toFixed(2)}</span></div>}
              {!hasGaapDiff && nonGaapEpsTTMVal != null && gaapEpsTTMVal == null && <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">EPS (TTM):</span><span className="font-bold text-sm">{nonGaapEpsTTMVal.toFixed(2)}</span></div>}
            </div>
            {hasGaapDiff && <Explainer text="GAAP uwzgl. koszty jednorazowe i SBC. Non-GAAP (Adjusted) je wyklucza." />}
          </div>

          {/* ═══ RULE OF 40 (Tech only) ═══ */}
          {(() => {
            const sector = e.sector ?? ""
            const isTech = sector === "Technology" || sector === "Information Technology" || sector === "Communication Services"
            if (!isTech) return null

            // Revenue Growth YoY (TTM vs previous year annual)
            let revGrowth: number | null = null
            if (revenueTTM.length > 0 && annualRevenue.length > 0) {
              const latestTTMRev = revenueTTM[revenueTTM.length - 1].value
              // Find previous FY revenue
              const sortedAnnual = [...annualRevenue].filter(a => a.value != null && a.value > 0).sort((a, b) => a.date.localeCompare(b.date))
              const prevFY = sortedAnnual.length >= 2 ? sortedAnnual[sortedAnnual.length - 2] : sortedAnnual[sortedAnnual.length - 1]
              if (prevFY && prevFY.value && prevFY.value > 0 && latestTTMRev > 0) {
                revGrowth = ((latestTTMRev - prevFY.value) / prevFY.value) * 100
              }
            }

            // FCF Margin (TTM)
            let fcfMargin: number | null = null
            if (fcfTTM.length > 0 && revenueTTM.length > 0) {
              const latFCF = fcfTTM[fcfTTM.length - 1].value
              const latRev = revenueTTM[revenueTTM.length - 1].value
              if (latRev > 0) fcfMargin = (latFCF / latRev) * 100
            }

            if (revGrowth == null || fcfMargin == null) return null

            const rule40 = revGrowth + fcfMargin
            const passed = rule40 >= 40
            const tier = rule40 >= 60 ? { label: "JEDNOROŻEC", emoji: "🦄", color: "text-purple-400", border: "border-purple-500/40", bg: "bg-purple-500/10", glow: "shadow-purple-500/20" }
              : rule40 >= 50 ? { label: "PERŁA", emoji: "💎", color: "text-cyan-400", border: "border-cyan-500/40", bg: "bg-cyan-500/10", glow: "shadow-cyan-500/20" }
              : rule40 >= 40 ? { label: "DIAMENT", emoji: "💠", color: "text-bloomberg-green", border: "border-bloomberg-green/40", bg: "bg-bloomberg-green/10", glow: "shadow-bloomberg-green/20" }
              : { label: "FILAR", emoji: "🧱", color: "text-bloomberg-amber", border: "border-bloomberg-amber/40", bg: "bg-bloomberg-amber/10", glow: "shadow-bloomberg-amber/20" }

            // Bar width calculation (capped at 120%)
            const barPct = Math.min(Math.max(rule40 / 120 * 100, 0), 100)
            const growthBarPct = Math.min(Math.max(Math.abs(revGrowth) / 120 * 100, 0), 50)
            const fcfBarPct = Math.min(Math.max(Math.abs(fcfMargin) / 120 * 100, 0), 50)

            return (
              <div className={`${tier.bg} border ${tier.border} rounded p-4 ${tier.glow} shadow-lg`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tier.emoji}</span>
                    <div>
                      <div className="text-[13px] font-bold tracking-wider text-foreground">RULE OF 40</div>
                      <div className="text-[12px] text-muted-foreground">Revenue Growth + FCF Margin ≥ 40%</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black ${tier.color}`}>{rule40.toFixed(1)}%</div>
                    <div className={`text-[13px] font-bold ${tier.color}`}>{tier.label}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative h-6 bg-bloomberg-bg rounded-full overflow-hidden mb-3 border border-bloomberg-border/50">
                  {/* 40% threshold marker */}
                  <div className="absolute top-0 bottom-0 left-[33.3%] w-px bg-white/30 z-10" />
                  <div className="absolute -top-4 left-[33.3%] -translate-x-1/2 text-[13px] text-white/50">40%</div>
                  {/* Revenue growth portion */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-bloomberg-green/60 transition-all duration-500"
                    style={{ width: `${growthBarPct}%` }}
                  />
                  {/* FCF margin portion (stacked) */}
                  <div
                    className={`absolute top-0 bottom-0 transition-all duration-500 ${fcfMargin >= 0 ? "bg-blue-500/60" : "bg-bloomberg-red/40"}`}
                    style={{ left: `${growthBarPct}%`, width: `${fcfBarPct}%` }}
                  />
                  {/* Score label on bar */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[12px] font-bold text-white drop-shadow-md">{rule40.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bloomberg-bg/50 rounded p-2.5 border border-bloomberg-border/30">
                    <div className="text-[12px] text-muted-foreground mb-1">📈 Revenue Growth (YoY)</div>
                    <div className={`text-lg font-bold ${revGrowth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                      {revGrowth > 0 ? "+" : ""}{revGrowth.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-bloomberg-bg/50 rounded p-2.5 border border-bloomberg-border/30">
                    <div className="text-[12px] text-muted-foreground mb-1">💰 FCF Margin (TTM)</div>
                    <div className={`text-lg font-bold ${fcfMargin >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                      {fcfMargin > 0 ? "+" : ""}{fcfMargin.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="mt-3 flex items-center gap-2">
                  {passed
                    ? <span className="text-[12px] text-bloomberg-green font-bold">✅ Rule of 40 SPEŁNIONA — spółka rośnie szybko i/lub generuje silny FCF</span>
                    : <span className="text-[12px] text-bloomberg-red font-bold">❌ Rule of 40 NIESPEŁNIONA — wzrost + FCF poniżej progu 40%</span>
                  }
                </div>
              </div>
            )
          })()}

          {/* ═══ RAPORT FINANSOWY ═══ */}
          <FinancialReport earnings={e} quote={q} currency={q.currency} />

          {/* ═══ PRZEGLĄD WYNIKÓW ═══ */}
          {snapshotItems.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3">PRZEGLĄD WYNIKÓW</div>
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

          {/* ═══ REVENUE TTM ═══ */}
          {(revenueTTM.length > 0 || annualRevenue.some((a) => a.value != null)) && (<>
            <div className="border-t border-bloomberg-border pt-4 mt-2" />
            <TTMBarSection title="PRZYCHODY TTM TREND" ttmData={revenueTTM} annualData={annualRevenue} forwardAnnual={fwdAnnualRev} currency={q.currency} color="bg-bloomberg-blue" />
            <TTMTable title="PRZYCHODY TTM TABELA" ttmData={revenueTTM} annualData={annualRevenue} forwardAnnual={fwdAnnualRev} currency={q.currency} />

            {/* REVENUE QUARTERLY */}
            {(e.incomeStatements ?? []).filter((s) => s.revenue != null).length > 0 && (
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                <div className="text-xs text-bloomberg-amber font-bold mb-3">REVENUE — QUARTERLY</div>
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">QUARTER</th><th className="text-right py-2 text-muted-foreground">REVENUE</th><th className="text-right py-2 text-muted-foreground">QoQ</th><th className="text-right py-2 text-muted-foreground">YoY</th></tr></thead>
                <tbody>
                  {(e.incomeStatements ?? []).filter((s) => s.revenue != null).sort((a, b) => a.date.localeCompare(b.date)).map((s, i, arr) => {
                    const prev = arr[i - 1]
                    const qoq = prev?.revenue && s.revenue ? ((s.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100 : null
                    const sameQPrevYear = arr.find((x) => {
                      const xY = parseInt(yearFromDate(x.date)); const sY = parseInt(yearFromDate(s.date))
                      const xM = x.date.slice(5, 7); const sM = s.date.slice(5, 7)
                      return xY === sY - 1 && xM === sM
                    })
                    const yoy = sameQPrevYear?.revenue && s.revenue ? ((s.revenue - sameQPrevYear.revenue) / Math.abs(sameQPrevYear.revenue)) * 100 : null
                    return (
                      <tr key={i} className="border-b border-bloomberg-border/50">
                        <td className="py-2 font-bold">{shortQLabel(s.date)}</td>
                        <td className="py-2 text-right font-bold">{fmtBigValue(s.revenue!, q.currency)}</td>
                        <td className={`py-2 text-right ${qoq != null && qoq >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{qoq != null ? `${qoq >= 0 ? "+" : ""}${qoq.toFixed(1)}%` : "—"}</td>
                        <td className={`py-2 text-right font-bold ${yoy != null && yoy >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody></table></div>
              </div>
            )}

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
            <TTMBarSection title="EBITDA TTM TREND (ZNORMALIZOWANA)" ttmData={ebitdaTTM} annualData={annualEbitdaNorm} currency={q.currency} color="bg-bloomberg-purple" explainer="EBITDA = Operating Income + D&A. Adjusted EBITDA wyklucza koszty jednorazowe (restructuring, SBC)." />
            <TTMTable title="EBITDA TTM TABELA (ZNORMALIZOWANA)" ttmData={ebitdaTTM} annualData={annualEbitdaNorm} currency={q.currency} />

            {/* EBITDA QUARTERLY */}
            {(e.incomeStatements ?? []).filter((s) => (s.ebitdaNormalized ?? s.ebitda) != null).length > 0 && (
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                <div className="text-xs text-bloomberg-amber font-bold mb-3">EBITDA — QUARTERLY (NORMALIZED)</div>
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">QUARTER</th><th className="text-right py-2 text-muted-foreground">EBITDA</th><th className="text-right py-2 text-muted-foreground">MARGIN</th><th className="text-right py-2 text-muted-foreground">QoQ</th><th className="text-right py-2 text-muted-foreground">YoY</th></tr></thead>
                <tbody>
                  {(e.incomeStatements ?? []).filter((s) => (s.ebitdaNormalized ?? s.ebitda) != null).sort((a, b) => a.date.localeCompare(b.date)).map((s, i, arr) => {
                    const eb = (s.ebitdaNormalized ?? s.ebitda)!
                    const margin = s.revenue && s.revenue > 0 ? (eb / s.revenue) * 100 : null
                    const prev = arr[i - 1]
                    const prevEb = prev ? (prev.ebitdaNormalized ?? prev.ebitda) : null
                    const qoq = prevEb && prevEb !== 0 ? ((eb - prevEb) / Math.abs(prevEb)) * 100 : null
                    const sameQPrevYear = arr.find((x) => {
                      const xY = parseInt(yearFromDate(x.date)); const sY = parseInt(yearFromDate(s.date))
                      const xM = x.date.slice(5, 7); const sM = s.date.slice(5, 7)
                      return xY === sY - 1 && xM === sM
                    })
                    const prevYearEb = sameQPrevYear ? (sameQPrevYear.ebitdaNormalized ?? sameQPrevYear.ebitda) : null
                    const yoy = prevYearEb && prevYearEb !== 0 ? ((eb - prevYearEb) / Math.abs(prevYearEb)) * 100 : null
                    return (
                      <tr key={i} className="border-b border-bloomberg-border/50">
                        <td className="py-2 font-bold">{shortQLabel(s.date)}</td>
                        <td className={`py-2 text-right font-bold ${eb >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(eb, q.currency)}</td>
                        <td className={`py-2 text-right ${margin != null && margin >= 0 ? "text-muted-foreground" : "text-bloomberg-red"}`}>{margin != null ? `${margin.toFixed(1)}%` : "—"}</td>
                        <td className={`py-2 text-right ${qoq != null && qoq >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{qoq != null ? `${qoq >= 0 ? "+" : ""}${qoq.toFixed(1)}%` : "—"}</td>
                        <td className={`py-2 text-right font-bold ${yoy != null && yoy >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody></table></div>
              </div>
            )}
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
                {fcfTTM.map((fcf, i) => { const oc = opCfTTM.find((o) => o.date === fcf.date); const cx = capexTTM.find((c) => c.date === fcf.date); const rv = revenueTTM.find((r) => r.date === fcf.date); const fm = rv ? (fcf.value / rv.value) * 100 : null; const py = parseInt(yearFromDate(fcf.date)) - 1; const pf = fcfTTM.find((f) => parseInt(yearFromDate(f.date)) === py) ?? annualFCF.find((a) => yearFromDate(a.date) === String(py)); const pv = pf && "value" in pf ? pf.value : null; const yoy = pv && pv !== 0 ? ((fcf.value - pv) / Math.abs(pv)) * 100 : null; return (<tr key={`t-${i}`} className="border-b border-bloomberg-border/50 bg-bloomberg-blue/5"><td className="py-2 font-bold">{fcf.label} <span className="text-[12px] text-bloomberg-blue">TTM</span></td><td className="py-2 text-right">{oc ? fmtBigValue(oc.value, q.currency) : "N/A"}</td><td className="py-2 text-right text-bloomberg-red">{cx ? fmtBigValue(cx.value, q.currency) : "N/A"}</td><td className={`py-2 text-right font-bold ${fcf.value >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(fcf.value, q.currency)}</td><td className={`py-2 text-right ${fm != null && fm >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fm != null ? `${fm.toFixed(1)}%` : "N/A"}</td><td className={`py-2 text-right ${yoy != null && yoy >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "---"}</td></tr>) })}
              </tbody></table></div>
            </div>

            {/* FCF YIELD */}
            {fcfTTM.length > 0 && (() => {
              const latFcf = fcfTTM[fcfTTM.length - 1].value
              const mc = q.marketCap
              const fcfYield = mc > 0 ? (latFcf / mc) * 100 : null
              const label = fcfYield == null ? "N/A" : fcfYield < 0 ? "Negative FCF" : fcfYield < 2 ? "Drogo" : fcfYield <= 5 ? "W normie" : "Atrakcyjnie"
              const color = fcfYield == null ? "text-muted-foreground" : fcfYield >= 5 ? "text-bloomberg-green" : fcfYield >= 2 ? "text-bloomberg-amber" : "text-bloomberg-red"
              return (
                <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                  <div className="text-xs text-bloomberg-amber font-bold mb-3">FCF YIELD</div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div><div className="text-muted-foreground">FCF (TTM)</div><div className={`font-bold text-sm ${latFcf >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(latFcf, q.currency)}</div></div>
                    <div><div className="text-muted-foreground">Market Cap</div><div className="font-bold text-sm">{mc > 0 ? fmtBigValue(mc, q.currency) : "N/A"}</div></div>
                    <div><div className="text-muted-foreground">FCF Yield</div><div className={`font-bold text-sm ${color}`}>{fcfYield != null ? `${fcfYield.toFixed(1)}%` : "N/A"} <span className="text-[12px]">{label}</span></div></div>
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
                    <tr className="border-b border-bloomberg-border/50"><td className={`py-1.5 ${ebitdaVal != null && ebitdaVal < 0 ? "text-bloomberg-red font-bold" : ""}`}>EBITDA <span className="text-[12px] text-muted-foreground">(OpIncome + D&A)</span></td><td className={`py-1.5 text-right font-bold ${ebitdaVal != null && ebitdaVal < 0 ? "text-bloomberg-red" : ""}`}>{ebitdaVal != null ? fmtBigValue(ebitdaVal, q.currency) : "N/A"}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">- Taxes</td><td className="py-1.5 text-right text-bloomberg-red font-bold">{taxVal != null ? `-${fmtBigValue(Math.abs(taxVal), q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">- Interest Expense</td><td className="py-1.5 text-right text-bloomberg-red font-bold">{intPaidVal != null ? `-${fmtBigValue(Math.abs(intPaidVal), q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">+ Stock Based Compensation <span className="text-[12px] text-muted-foreground">(non-cash)</span></td><td className="py-1.5 text-right text-bloomberg-green font-bold">{sbcVal != null ? `+${fmtBigValue(Math.abs(sbcVal), q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5">+/- Working Capital Changes</td><td className={`py-1.5 text-right font-bold ${wcVal != null && wcVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{wcVal != null ? `${wcVal >= 0 ? "+" : ""}${fmtBigValue(wcVal, q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
                    <tr className="border-b border-bloomberg-border/50"><td className="py-1.5 text-muted-foreground">+/- Other Adjustments <span className="text-[12px]">(deferred tax, other non-cash)</span></td><td className={`py-1.5 text-right font-bold ${otherVal != null && otherVal >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{otherVal != null ? `${otherVal >= 0 ? "+" : ""}${fmtBigValue(otherVal, q.currency)}` : <span className="text-muted-foreground">N/A</span>}</td></tr>
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
                return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{r.label}</td><td className="py-2 text-right">{fmtBigValue(r.rev, q.currency)}</td><td className={`py-2 text-right font-bold ${r.ni >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{fmtBigValue(r.ni, q.currency)}</td><td className={`py-2 text-right font-bold ${mColor}`}>{margin.toFixed(1)}%</td><td className="py-2 text-center">{delta != null ? <span className={`text-[12px] font-bold ${delta >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}pp</span> : <span className="text-[12px] text-muted-foreground">---</span>}</td></tr>)
              })}</tbody></table></div>
              <div className="mt-4 flex items-end gap-3 h-24">{marginRows.map((r, i) => {
                const margin = (r.ni / r.rev) * 100; const maxM = Math.max(...marginRows.map((x) => Math.abs((x.ni / x.rev) * 100))); const h = maxM > 0 ? (Math.abs(margin) / maxM) * 100 : 0
                return (<div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full flex items-end h-16"><div className={`flex-1 rounded-t ${margin >= 0 ? "bg-bloomberg-green" : margin > -5 ? "bg-bloomberg-amber" : "bg-bloomberg-red"}`} style={{ height: `${h}%` }} /></div><div className="text-[12px] text-muted-foreground">{r.label}</div><div className={`text-[12px] font-bold ${margin >= 0 ? "text-bloomberg-green" : margin > -5 ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>{margin.toFixed(1)}%</div></div>)
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
                  {(e.balanceSheetAnnual ?? []).filter((b) => b.sharesOutstanding != null).map((b, i, arr) => { const prev = arr[i - 1]; const ch = prev?.sharesOutstanding && b.sharesOutstanding ? ((b.sharesOutstanding - prev.sharesOutstanding) / prev.sharesOutstanding) * 100 : null; const dilut = ch != null && ch > 0.5; return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">FY{yearFromDate(b.date)}</td><td className="py-2 text-right font-bold">{fmtShares(b.sharesOutstanding!)}</td><td className={`py-2 text-right ${ch != null ? (dilut ? "text-bloomberg-red" : "text-bloomberg-green") : ""}`}>{ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` : "---"}</td><td className="py-2 text-center">{ch != null && (dilut ? <span className="text-[12px] bg-bloomberg-red/20 text-bloomberg-red px-1.5 py-0.5 rounded font-bold">DILUTIVE</span> : <span className="text-[12px] bg-bloomberg-green/20 text-bloomberg-green px-1.5 py-0.5 rounded font-bold">STABLE</span>)}</td></tr>) })}
                  {(() => { const la = (e.balanceSheetAnnual ?? []).filter((b) => b.sharesOutstanding != null).slice(-1)[0]; const lq = (e.balanceSheetQuarterly ?? []).filter((b) => b.sharesOutstanding != null).slice(-1)[0]; if (!lq || !la || lq.date <= la.date) return null; const ch = la.sharesOutstanding && lq.sharesOutstanding ? ((lq.sharesOutstanding - la.sharesOutstanding) / la.sharesOutstanding) * 100 : null; return (<tr className="border-b border-bloomberg-border/50 bg-bloomberg-blue/5"><td className="py-2 font-bold">{shortQLabel(lq.date)} <span className="text-[12px] text-bloomberg-blue">LATEST</span></td><td className="py-2 text-right font-bold">{fmtShares(lq.sharesOutstanding!)}</td><td className={`py-2 text-right ${ch != null && ch > 0.5 ? "text-bloomberg-red" : "text-bloomberg-green"}`}>{ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` : "---"}</td><td className="py-2 text-center"><span className="text-[12px] text-muted-foreground">vs FY{yearFromDate(la.date)}</span></td></tr>) })()}
                </tbody></table></div>
              </div>
            )}
            {(sbcTTM.length > 0 || annualSBC.some((a) => a.value != null)) && (
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                <div className="text-xs text-bloomberg-amber font-bold mb-3">STOCK-BASED COMPENSATION (SBC)</div>
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-bloomberg-border"><th className="text-left py-2 text-muted-foreground">PERIOD</th><th className="text-right py-2 text-muted-foreground">SBC</th><th className="text-right py-2 text-muted-foreground">% REVENUE</th><th className="text-right py-2 text-muted-foreground">YoY</th></tr></thead>
                <tbody>
                  {annualSBC.filter((a) => a.value != null).map((s, i, arr) => { const y = yearFromDate(s.date); if (sbcTTM.some((t) => yearFromDate(t.date) === y)) return null; const rv = annualRevenue.find((r) => yearFromDate(r.date) === y); const pr = rv?.value && s.value ? (s.value / rv.value) * 100 : null; const pv = arr[i - 1]; const yoy = pv?.value && s.value ? ((s.value - pv.value) / Math.abs(pv.value)) * 100 : null; return (<tr key={`a-${i}`} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">FY{y}</td><td className="py-2 text-right font-bold">{fmtBigValue(s.value!, q.currency)}</td><td className={`py-2 text-right ${pr != null && pr > 20 ? "text-bloomberg-red" : pr != null && pr > 10 ? "text-bloomberg-amber" : ""}`}>{pr != null ? `${pr.toFixed(1)}%` : "N/A"}</td><td className={`py-2 text-right ${yoy != null && yoy > 0 ? "text-bloomberg-red" : "text-bloomberg-green"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "---"}</td></tr>) })}
                  {sbcTTM.map((s, i) => { const rv = revenueTTM.find((r) => r.date === s.date); const pr = rv ? (s.value / rv.value) * 100 : null; const py = parseInt(yearFromDate(s.date)) - 1; const ps = sbcTTM.find((x) => parseInt(yearFromDate(x.date)) === py) ?? annualSBC.find((a) => yearFromDate(a.date) === String(py)); const pv = ps && "value" in ps ? ps.value : null; const yoy = pv && pv !== 0 ? ((s.value - pv) / Math.abs(pv)) * 100 : null; return (<tr key={`t-${i}`} className="border-b border-bloomberg-border/50 bg-bloomberg-blue/5"><td className="py-2 font-bold">{s.label} <span className="text-[12px] text-bloomberg-blue">TTM</span></td><td className="py-2 text-right font-bold">{fmtBigValue(s.value, q.currency)}</td><td className={`py-2 text-right ${pr != null && pr > 20 ? "text-bloomberg-red" : pr != null && pr > 10 ? "text-bloomberg-amber" : ""}`}>{pr != null ? `${pr.toFixed(1)}%` : "N/A"}</td><td className={`py-2 text-right ${yoy != null && yoy > 0 ? "text-bloomberg-red" : "text-bloomberg-green"}`}>{yoy != null ? `${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "---"}</td></tr>) })}
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
                    {ow.institutionsCount != null && <div className="text-[12px] text-muted-foreground mt-2">{ow.institutionsCount} instytucji posiada akcje</div>}
                    <div className="text-[12px] text-muted-foreground">{(ow.institutionsPercentHeld ?? 0) > 0.7 ? "High institutional interest" : (ow.institutionsPercentHeld ?? 0) > 0.4 ? "Moderate institutional interest" : "Low institutional coverage"}</div>
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
                    return (<tr key={i} className="border-b border-bloomberg-border/50"><td className="py-2 font-bold">{inst.organization}</td><td className="py-2 text-right">{inst.position != null ? fmtShares(inst.position) : "N/A"}</td><td className="py-2 text-right font-bold">{inst.pctHeld != null ? `${(inst.pctHeld * 100).toFixed(1)}%` : "N/A"}</td><td className="py-2 text-right">{inst.value != null ? fmtBigValue(inst.value, q.currency) : "N/A"}</td><td className="py-2 text-center">{signal === "INCREASED" ? <span className="text-[12px] bg-bloomberg-green/20 text-bloomberg-green px-1.5 py-0.5 rounded font-bold">+{((ch ?? 0) * 100).toFixed(0)}% ▲</span> : signal === "REDUCED" ? <span className="text-[12px] bg-bloomberg-red/20 text-bloomberg-red px-1.5 py-0.5 rounded font-bold">{((ch ?? 0) * 100).toFixed(0)}% ▼</span> : <span className="text-[12px] text-muted-foreground">—</span>}</td></tr>)
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
                    {caption && <div className="text-[12px] text-muted-foreground mb-1 italic">{caption}</div>}
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
                      <div className="text-[12px] text-bloomberg-amber font-bold mb-1 mt-2">OPEN MARKET TRANSACTIONS</div>
                      <TxTable txs={openMarket.slice(0, 10)} />
                    </>)}

                    {/* Stock Awards & Vesting */}
                    {awards.length > 0 && (<>
                      <div className="text-[12px] text-bloomberg-amber font-bold mb-1 mt-4">STOCK AWARDS & VESTING</div>
                      <TxTable txs={awards.slice(0, 10)} caption="Automatyczne przyznanie akcji — część wynagrodzenia. Nie wliczane do Net Flow." />
                    </>)}

                    {/* Other */}
                    {other.length > 0 && (<>
                      <div className="text-[12px] text-bloomberg-amber font-bold mb-1 mt-4">OTHER (Option Exercise, Gift, etc.)</div>
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

// ── Financial Score Circle ──────────────────────────────────

function FinancialScoreCircle({ score }: { score: ScoreBreakdown }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const s = score.total
  const deg = s * 3.6

  // Color based on score
  const color = s >= 75 ? { start: "#00e676", end: "#00c853", glow: "#00e676" }
    : s >= 60 ? { start: "#ffeb3b", end: "#f9a825", glow: "#ffeb3b" }
    : s >= 45 ? { start: "#ff9800", end: "#e65100", glow: "#ff9800" }
    : { start: "#f44336", end: "#b71c1c", glow: "#f44336" }

  const label = s >= 75 ? "STRONG" : s >= 60 ? "GOOD" : s >= 45 ? "FAIR" : "WEAK"

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        {/* Circle */}
        <div
          className="relative w-14 h-14 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: `conic-gradient(${color.start} 0deg, ${color.end} ${deg}deg, #1e1e1e ${deg}deg 360deg)`,
            boxShadow: `0 0 16px ${color.glow}66`,
          }}
        >
          <div className="absolute w-10 h-10 rounded-full bg-bloomberg-bg" />
          <span className="relative text-sm font-extrabold text-white z-10">{s}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] text-muted-foreground tracking-wider">FINANCIAL SCORE</span>
          <span className="text-[12px] font-bold" style={{ color: color.start }}>{label}</span>
        </div>
      </div>

      {/* Breakdown tooltip */}
      {showBreakdown && (
        <div className="absolute right-0 top-16 z-50 bg-bloomberg-card border border-bloomberg-border rounded p-3 shadow-xl min-w-[220px]">
          <div className="text-[13px] text-bloomberg-amber font-bold mb-2 tracking-wider">SCORE BREAKDOWN</div>
          {(score.subIndustry || score.sector) && <div className="text-[12px] text-muted-foreground mb-2">Profil: <span className="text-bloomberg-amber">{score.subIndustry}</span>{score.sector && ` (${score.sector})`}</div>}
          <div className="space-y-1.5">
            <ScoreBar label="Growth" value={score.growth} max={score.maxGrowth} color="#22c55e" />
            <ScoreBar label="Profitability" value={score.profitability} max={score.maxProfit} color="#3b82f6" />
            <ScoreBar label="Earnings Quality" value={score.earningsQuality} max={score.maxEarningsQ} color="#a855f7" />
            <ScoreBar label="Forward Outlook" value={score.forwardOutlook} max={score.maxForward} color="#f59e0b" />
            <ScoreBar label="Dilution Risk" value={score.dilutionRisk} max={score.maxDilution} color="#ef4444" />
            <ScoreBar label="Capital Structure" value={score.capitalStructure} max={score.maxCapital} color="#06b6d4" />
            <ScoreBar label="Ownership" value={score.ownership} max={score.maxOwnership} color="#8b5cf6" />
          </div>
          {score.details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-bloomberg-border">
              {score.details.map((d, i) => (
                <div key={i} className="text-[12px] text-muted-foreground">{d}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-muted-foreground w-[85px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-bloomberg-bg rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] text-foreground font-bold w-8 text-right">{value}/{max}</span>
    </div>
  )
}
