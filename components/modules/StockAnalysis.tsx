"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { TrendingUp, TrendingDown, AlertTriangle, ShieldAlert } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import PriceChart from "@/components/charts/PriceChart"
import RadarChart from "@/components/charts/RadarChart"
import GaugeChart from "@/components/charts/GaugeChart"
import HorizontalBar from "@/components/charts/HorizontalBar"
import type { FullAnalysis } from "@/lib/analysis"
import { useTranslatePL } from "@/hooks/useTranslate"
import type { QuoteData, KeyStatistics, HistoricalPrice } from "@/lib/yahoo"
import type { NewsItem } from "@/lib/news"
import { fmtPrice as fmtCurrencyPrice, fmtBigValue, currencySymbol } from "@/lib/currency"
import { computeFundamentalAnalysis } from "@/lib/fundamentalAnalysis"
import type { FundamentalReport } from "@/lib/fundamentalAnalysis"

// ── Helpers ──────────────────────────────────────────────────

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "N/A"
  return v.toFixed(2) + suffix
}

function fmtB(v: number | null | undefined, currency = "USD"): string {
  if (v == null) return "N/A"
  return fmtBigValue(v, currency)
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "N/A"
  return v.toFixed(2) + "%"
}

function verdictColor(verdict: string): string {
  if (verdict === "BUY") return "text-bloomberg-green"
  if (verdict === "HOLD") return "text-bloomberg-amber"
  if (verdict === "SELL") return "text-bloomberg-red"
  return "text-bloomberg-red"
}

function verdictBg(verdict: string): string {
  if (verdict === "BUY") return "bg-bloomberg-green/15 border-bloomberg-green/40"
  if (verdict === "HOLD") return "bg-bloomberg-amber/15 border-bloomberg-amber/40"
  if (verdict === "SELL") return "bg-bloomberg-red/15 border-bloomberg-red/40"
  return "bg-bloomberg-red/15 border-bloomberg-red/40"
}

function verdictEmoji(verdict: string): string {
  if (verdict === "BUY") return "BUY"
  if (verdict === "HOLD") return "HOLD"
  if (verdict === "SELL") return "SELL"
  return "AVOID"
}

function confidenceBg(c: string): string {
  if (c === "High") return "bg-bloomberg-green/20 text-bloomberg-green"
  if (c === "Medium") return "bg-bloomberg-amber/20 text-bloomberg-amber"
  return "bg-bloomberg-red/20 text-bloomberg-red"
}

function riskColor(level: string): string {
  if (level === "Low") return "text-bloomberg-green"
  if (level === "Medium") return "text-bloomberg-amber"
  return "text-bloomberg-red"
}

function riskBg(level: string): string {
  if (level === "Low") return "bg-bloomberg-green/15"
  if (level === "Medium") return "bg-bloomberg-amber/15"
  return "bg-bloomberg-red/15"
}

function sentimentIcon(s: string): string {
  if (s === "positive") return "[+]"
  if (s === "negative") return "[-]"
  return "[~]"
}

function sentimentColor(s: string): string {
  if (s === "positive") return "text-bloomberg-green"
  if (s === "negative") return "text-bloomberg-red"
  return "text-bloomberg-amber"
}

function checkIcon(v: boolean | null): string {
  if (v === true) return "[OK]"
  if (v === false) return "[X]"
  return "[?]"
}

function checkColor(v: boolean | null): string {
  if (v === true) return "text-bloomberg-green"
  if (v === false) return "text-bloomberg-red"
  return "text-muted-foreground"
}

// Compute running MA from history
function computeChartData(
  history: HistoricalPrice[]
): { date: string; close: number; ma50?: number; ma200?: number }[] {
  const result: { date: string; close: number; ma50?: number; ma200?: number }[] = []
  const closes: number[] = []

  for (const h of history) {
    closes.push(h.close)
    const dateStr =
      h.date instanceof Date
        ? h.date.toISOString().slice(0, 10)
        : String(h.date).slice(0, 10)

    const point: { date: string; close: number; ma50?: number; ma200?: number } = {
      date: dateStr,
      close: h.close,
    }

    if (closes.length >= 50) {
      const slice50 = closes.slice(-50)
      point.ma50 = slice50.reduce((a, b) => a + b, 0) / 50
    }

    if (closes.length >= 200) {
      const slice200 = closes.slice(-200)
      point.ma200 = slice200.reduce((a, b) => a + b, 0) / 200
    }

    result.push(point)
  }

  return result
}

// Normalize a metric to 0-100 for RadarChart
function normalizeMetric(val: number | null, maxGood: number): number {
  if (val == null) return 0
  return Math.max(0, Math.min(100, (val / maxGood) * 100))
}

// ── Main Component ──────────────────────────────────────────

interface ApiResponse {
  quote: QuoteData
  stats: KeyStatistics | null
  analysis: FullAnalysis
  news: NewsItem[]
  history: HistoricalPrice[]
}

const LS_KEY = "bloomberg_last_ticker_analysis"

export default function StockAnalysis() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState("")
  const [lastTicker, setLastTicker] = useState("")
  const didAutoLoad = useRef(false)

  const handleAnalyze = useCallback(async (ticker: string) => {
    setLoading(true)
    setError("")
    setData(null)
    const t = ticker.toUpperCase().trim()
    setLastTicker(t)
    try { localStorage.setItem(LS_KEY, t) } catch {}
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) { setLastTicker(saved); handleAnalyze(saved) }
    } catch {}
  }, [handleAnalyze])

  const q = data?.quote
  const a = data?.analysis
  const st = data?.stats
  const news = data?.news ?? []
  const history = data?.history ?? []

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Full stock analysis with decision dashboard, charts, risk matrix and probability scenarios
      </div>
      <TerminalInput
        placeholder="Enter ticker (e.g. AAPL, MSFT, NVDA, TSLA)"
        onSubmit={handleAnalyze}
        loading={loading}
        label="ANALYZE >"
        defaultValue={lastTicker}
      />

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {q && a && (
        <div className="space-y-4">

          {/* ═══ SECTION 1: DECISION DASHBOARD ═══ */}
          <div className={`border rounded p-5 ${verdictBg(a.verdict)}`}>
            <div className="text-xs text-bloomberg-amber font-bold mb-2 tracking-widest">
              DECISION DASHBOARD
            </div>

            {/* Company info: MCap */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-muted-foreground">MCap:</span>
              <span className="text-[11px] text-foreground font-bold">{fmtBigValue(q.marketCap, q.currency)}</span>
              {st?.sector && (
                <>
                  <span className="text-[10px] text-muted-foreground">|</span>
                  <span className="text-[10px] text-bloomberg-amber">{st.sector}</span>
                </>
              )}
              {st?.industry && (
                <>
                  <span className="text-[10px] text-muted-foreground">|</span>
                  <span className="text-[10px] text-muted-foreground">{st.industry}</span>
                </>
              )}
              {st?.fullTimeEmployees && (
                <>
                  <span className="text-[10px] text-muted-foreground">|</span>
                  <span className="text-[10px] text-muted-foreground">{st.fullTimeEmployees.toLocaleString()} pracowników</span>
                </>
              )}
            </div>

            {/* PROFIL SPÓŁKI — full business description in Polish */}
            {st?.longBusinessSummary && (
              <div className="mb-4 pb-3 border-b border-bloomberg-border/30">
                <div className="text-[9px] text-bloomberg-amber font-bold mb-1.5 tracking-wider">📋 PROFIL SPÓŁKI</div>
                <TranslatedSummary text={st.longBusinessSummary} full />
              </div>
            )}

            {/* Verdict + Thesis + Confidence */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
              <div
                className={`text-3xl font-black tracking-wider ${verdictColor(a.verdict)}`}
              >
                {verdictEmoji(a.verdict)}
              </div>
              <div className="flex-1">
                <div className="text-sm text-foreground">{a.thesis}</div>
              </div>
              <div
                className={`px-3 py-1 rounded text-xs font-bold ${confidenceBg(a.confidence)}`}
              >
                {a.confidence} Confidence
              </div>
            </div>

            {/* Key Levels */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-5">
              <LevelBox label="ENTRY" value={a.entry != null ? fmtCurrencyPrice(a.entry, q.currency) : "N/A"} sub="" color="text-foreground" />
              <LevelBox
                label="STOP-LOSS"
                value={a.stopLoss != null ? fmtCurrencyPrice(a.stopLoss, q.currency) : "N/A"}
                sub={`${fmt(a.stopLossPct)}%`}
                color="text-bloomberg-red"
              />
              <LevelBox
                label="TARGET 1"
                value={a.target1 != null ? fmtCurrencyPrice(a.target1, q.currency) : "N/A"}
                sub={`+${fmt(a.target1Pct)}%`}
                color="text-bloomberg-green"
              />
              <LevelBox
                label="TARGET 2"
                value={a.target2 != null ? fmtCurrencyPrice(a.target2, q.currency) : "N/A"}
                sub={`+${fmt(a.target2Pct)}%`}
                color="text-bloomberg-green"
              />
              <LevelBox
                label="RISK/REWARD"
                value={`${fmt(a.riskReward)}x`}
                sub=""
                color={a.riskReward >= 2 ? "text-bloomberg-green" : a.riskReward >= 1 ? "text-bloomberg-amber" : "text-bloomberg-red"}
              />
              <LevelBox
                label="EXP. RETURN"
                value={`${fmt(a.expectedReturn)}%`}
                sub=""
                color={a.expectedReturn >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}
              />
            </div>

            {/* Checklist */}
            <div className="text-xs text-muted-foreground font-bold mb-2 tracking-wider">
              INVESTMENT CHECKLIST
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1.5 text-xs">
              <CheckItem label="Valuation Reasonable" value={a.checklist.valuationReasonable} />
              <CheckItem label="Revenue Growth > 0" value={a.checklist.revenueGrowthPositive} />
              <CheckItem label="Margins Stable" value={a.checklist.marginsStable} />
              <CheckItem label="Balance Sheet Healthy" value={a.checklist.balanceSheetHealthy} />
              <CheckItem label="Above MA50" value={a.checklist.aboveMA50} />
              <CheckItem label="Above MA200" value={a.checklist.aboveMA200} />
              <CheckItem label="FCF Yield > 2%" value={a.checklist.healthyFCFYield} />
              <CheckItem label="Sector Tailwind" value={a.checklist.sectorTailwind} />
            </div>
          </div>

          {/* ═══ RULE OF 40 (Tech only) ═══ */}
          {(() => {
            const sec = st?.sector ?? a.sector ?? ""
            const isTech = /technology|information technology|communication services/i.test(sec)
            if (!isTech || a.revenueGrowth == null || a.fcfMargin == null) return null

            const rule40 = a.revenueGrowth + a.fcfMargin
            const passed = rule40 >= 40
            const tier = rule40 >= 60
              ? { label: "JEDNOROŻEC", emoji: "🦄", color: "text-purple-400", border: "border-purple-500/40", bg: "bg-purple-500/10" }
              : rule40 >= 50
              ? { label: "PERŁA", emoji: "💎", color: "text-cyan-400", border: "border-cyan-500/40", bg: "bg-cyan-500/10" }
              : rule40 >= 40
              ? { label: "DIAMENT", emoji: "💠", color: "text-bloomberg-green", border: "border-bloomberg-green/40", bg: "bg-bloomberg-green/10" }
              : { label: "FILAR", emoji: "🧱", color: "text-bloomberg-amber", border: "border-bloomberg-amber/40", bg: "bg-bloomberg-amber/10" }

            const barMax = 120
            const growthBar = Math.min(Math.max(a.revenueGrowth, 0) / barMax * 100, 50)
            const fcfBar = Math.min(Math.max(a.fcfMargin, 0) / barMax * 100, 50)

            return (
              <div className={`${tier.bg} border ${tier.border} rounded p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tier.emoji}</span>
                    <div>
                      <div className="text-[11px] font-bold tracking-wider text-foreground">RULE OF 40</div>
                      <div className="text-[8px] text-muted-foreground">Revenue Growth + FCF Margin ≥ 40%</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black ${tier.color}`}>{rule40.toFixed(1)}%</div>
                    <div className={`text-[9px] font-bold ${tier.color}`}>{tier.label}</div>
                  </div>
                </div>

                {/* Bar */}
                <div className="relative h-6 bg-bloomberg-bg rounded-full overflow-hidden mb-3 border border-bloomberg-border/50">
                  <div className="absolute top-0 bottom-0 left-[33.3%] w-px bg-white/30 z-10" />
                  <div className="absolute -top-4 left-[33.3%] -translate-x-1/2 text-[7px] text-white/50">40%</div>
                  <div className="absolute top-0 bottom-0 left-0 bg-bloomberg-green/60 transition-all duration-500" style={{ width: `${growthBar}%` }} />
                  <div className={`absolute top-0 bottom-0 transition-all duration-500 ${a.fcfMargin >= 0 ? "bg-blue-500/60" : "bg-bloomberg-red/40"}`} style={{ left: `${growthBar}%`, width: `${fcfBar}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white drop-shadow-md">{rule40.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bloomberg-bg/50 rounded p-2.5 border border-bloomberg-border/30">
                    <div className="text-[8px] text-muted-foreground mb-1">📈 Revenue Growth (YoY)</div>
                    <div className={`text-lg font-bold ${a.revenueGrowth >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                      {a.revenueGrowth > 0 ? "+" : ""}{a.revenueGrowth.toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-bloomberg-bg/50 rounded p-2.5 border border-bloomberg-border/30">
                    <div className="text-[8px] text-muted-foreground mb-1">💰 FCF Margin (TTM)</div>
                    <div className={`text-lg font-bold ${a.fcfMargin >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                      {a.fcfMargin > 0 ? "+" : ""}{a.fcfMargin.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  {passed
                    ? <span className="text-[10px] text-bloomberg-green font-bold">✅ Rule of 40 SPEŁNIONA — spółka rośnie szybko i/lub generuje silny FCF</span>
                    : <span className="text-[10px] text-bloomberg-red font-bold">❌ Rule of 40 NIESPEŁNIONA — wzrost + FCF poniżej progu 40%</span>
                  }
                </div>
              </div>
            )
          })()}

          {/* ═══ FUNDAMENTAL ANALYSIS ═══ */}
          {(() => {
            const fa = computeFundamentalAnalysis(
              st?.sector ?? null, st?.industry ?? null, st?.longBusinessSummary ?? null,
              a.grossMargin, a.operatingMargin, a.revenueGrowth, a.fcfMargin, q.marketCap,
              st?.fullTimeEmployees ?? null,
            )
            const moatColor = fa.moatRating === "Wide" ? "text-bloomberg-green" : fa.moatRating === "Narrow" ? "text-bloomberg-amber" : "text-bloomberg-red"
            const moatBorder = fa.moatRating === "Wide" ? "border-bloomberg-green/30" : fa.moatRating === "Narrow" ? "border-bloomberg-amber/30" : "border-bloomberg-border"
            const moatBg = fa.moatRating === "Wide" ? "bg-bloomberg-green/5" : fa.moatRating === "Narrow" ? "bg-bloomberg-amber/5" : "bg-bloomberg-bg"
            const impactIcon = (i: string) => i === "positive" ? "🟢" : i === "negative" ? "🔴" : "🟡"
            const strengthColor = (s: string) => s === "strong" ? "text-bloomberg-green" : s === "moderate" ? "text-bloomberg-amber" : s === "weak" ? "text-bloomberg-red/70" : "text-muted-foreground/40"
            const strengthLabel = (s: string) => s === "strong" ? "SILNA" : s === "moderate" ? "UMIARKOWANA" : s === "weak" ? "SŁABA" : "BRAK"

            const tierColor = fa.scoreTier === "Elita" ? "text-bloomberg-green" : fa.scoreTier === "Silna" ? "text-cyan-400" : fa.scoreTier === "Solidna" ? "text-bloomberg-amber" : fa.scoreTier === "Przeciętna" ? "text-orange-400" : "text-bloomberg-red"
            const tierBorder = fa.scoreTier === "Elita" ? "border-bloomberg-green" : fa.scoreTier === "Silna" ? "border-cyan-400" : fa.scoreTier === "Solidna" ? "border-bloomberg-amber" : fa.scoreTier === "Przeciętna" ? "border-orange-400" : "border-bloomberg-red"
            const scoreDeg = fa.fundamentalScore * 3.6
            const scoreGrad = fa.fundamentalScore >= 75 ? "from-green-500 to-green-700" : fa.fundamentalScore >= 60 ? "from-cyan-400 to-cyan-600" : fa.fundamentalScore >= 45 ? "from-amber-400 to-amber-600" : "from-red-500 to-red-700"

            return (
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4 space-y-4">
                {/* Header with score */}
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-bloomberg-amber font-bold tracking-widest">📊 ANALIZA FUNDAMENTALNA — PRODUKT & STRATEGIA</div>
                  <div className="flex items-center gap-3">
                    {/* Score circle */}
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-bloomberg-border/30" />
                        <circle cx="32" cy="32" r="28" fill="none" strokeWidth="4"
                          className={tierColor}
                          strokeDasharray={`${scoreDeg * 28 * Math.PI / 180} ${2 * Math.PI * 28}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-lg font-black ${tierColor}`}>{fa.fundamentalScore}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[10px] font-bold ${tierColor}`}>{fa.scoreTier.toUpperCase()}</div>
                      <div className="text-[7px] text-muted-foreground">/100</div>
                    </div>
                  </div>
                </div>

                {/* Score breakdown bar */}
                <div className="space-y-1">
                  <div className="flex h-3 rounded-full overflow-hidden border border-bloomberg-border/30">
                    <div className="bg-purple-500/70" style={{ width: `${fa.scoreBreakdown.productDNA}%` }} title={`DNA Produktu: ${fa.scoreBreakdown.productDNA}/20`} />
                    <div className="bg-blue-500/70" style={{ width: `${fa.scoreBreakdown.porterScore}%` }} title={`Porter: ${fa.scoreBreakdown.porterScore}/25`} />
                    <div className="bg-cyan-500/70" style={{ width: `${fa.scoreBreakdown.pestelScore}%` }} title={`PESTEL: ${fa.scoreBreakdown.pestelScore}/15`} />
                    <div className="bg-bloomberg-green/70" style={{ width: `${fa.scoreBreakdown.moatComponent}%` }} title={`Fosa: ${fa.scoreBreakdown.moatComponent}/25`} />
                    <div className="bg-bloomberg-amber/70" style={{ width: `${fa.scoreBreakdown.financialFit}%` }} title={`Finanse: ${fa.scoreBreakdown.financialFit}/15`} />
                  </div>
                  <div className="flex justify-between text-[7px] text-muted-foreground">
                    <span>🟣 Produkt {fa.scoreBreakdown.productDNA}/20</span>
                    <span>🔵 Porter {fa.scoreBreakdown.porterScore}/25</span>
                    <span>🔷 PESTEL {fa.scoreBreakdown.pestelScore}/15</span>
                    <span>🟢 Fosa {fa.scoreBreakdown.moatComponent}/25</span>
                    <span>🟡 Finanse {fa.scoreBreakdown.financialFit}/15</span>
                  </div>
                </div>

                {/* 1. Product DNA */}
                <div>
                  <div className="text-[10px] text-bloomberg-green font-bold mb-2">1. CO SPÓŁKA SPRZEDAJE — DNA PRODUKTU</div>

                  {/* Key metrics row */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                    <div className="bg-bloomberg-bg rounded p-2 border border-bloomberg-border/30">
                      <div className="text-[7px] text-muted-foreground mb-0.5">TYP ROZWIĄZANIA</div>
                      <div className="text-[10px] font-bold text-foreground">{fa.productType === "Painkiller" ? "💊 Painkiller" : fa.productType === "Platform" ? "🔗 Platforma" : fa.productType === "Infrastructure" ? "🏗️ Infrastruktura" : "💎 Vitamin"}</div>
                    </div>
                    <div className="bg-bloomberg-bg rounded p-2 border border-bloomberg-border/30">
                      <div className="text-[7px] text-muted-foreground mb-0.5">MODEL PRZYCHODOWY</div>
                      <div className="text-[10px] font-bold text-foreground">{fa.revenueModel}</div>
                    </div>
                    <div className="bg-bloomberg-bg rounded p-2 border border-bloomberg-border/30">
                      <div className="text-[7px] text-muted-foreground mb-0.5">CYKL ŻYCIA</div>
                      <div className={`text-[10px] font-bold ${fa.lifecycle === "Wzrost" ? "text-bloomberg-green" : fa.lifecycle === "Dojrzałość" ? "text-bloomberg-amber" : fa.lifecycle === "Schyłek" ? "text-bloomberg-red" : "text-purple-400"}`}>{fa.lifecycle}</div>
                    </div>
                    <div className="bg-bloomberg-bg rounded p-2 border border-bloomberg-border/30">
                      <div className="text-[7px] text-muted-foreground mb-0.5">KLIENT DOCELOWY</div>
                      <div className="text-[10px] font-bold text-foreground">{fa.targetCustomer}</div>
                    </div>
                    <div className="bg-bloomberg-bg rounded p-2 border border-bloomberg-border/30">
                      <div className="text-[7px] text-muted-foreground mb-0.5">ZASIĘG</div>
                      <div className="text-[9px] font-bold text-foreground">{fa.geographicReach}</div>
                    </div>
                  </div>

                  {/* Products table */}
                  {fa.mainProducts.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[8px] text-bloomberg-amber font-bold mb-1.5">📦 GŁÓWNE PRODUKTY / USŁUGI</div>
                      <div className="space-y-1">
                        {fa.mainProducts.map((p, i) => (
                          <div key={i} className="flex items-start gap-2 bg-bloomberg-bg/50 rounded p-1.5 border border-bloomberg-border/20">
                            <span className="text-[8px] text-bloomberg-green font-bold shrink-0 mt-0.5">#{i+1}</span>
                            <div>
                              <span className="text-[9px] font-bold text-foreground">{p.name}</span>
                              {p.description !== "—" && <span className="text-[8px] text-muted-foreground ml-1">— {p.description}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Customer segments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    <div>
                      <div className="text-[8px] text-bloomberg-amber font-bold mb-1">🎯 SEGMENTY KLIENTÓW</div>
                      <div className="flex flex-wrap gap-1">
                        {fa.customerSegments.map((s, i) => (
                          <span key={i} className="text-[8px] px-1.5 py-0.5 bg-bloomberg-green/10 text-bloomberg-green rounded border border-bloomberg-green/20">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] text-bloomberg-amber font-bold mb-1">🏢 BRANŻA & SKALA</div>
                      <div className="text-[9px] text-muted-foreground">
                        <span className="text-foreground font-bold">{st?.industry ?? "—"}</span>
                        {fa.employees && <span className="ml-2">| {fa.employees.toLocaleString()} pracowników</span>}
                        <span className="ml-2">| MCap: {fmtBigValue(q.marketCap, q.currency)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Competitive position */}
                  <div className="bg-bloomberg-bg/30 rounded p-2 border border-bloomberg-border/20">
                    <div className="text-[8px] text-bloomberg-amber font-bold mb-1">⚔️ POZYCJA KONKURENCYJNA</div>
                    <div className="text-[9px] text-foreground/80 leading-relaxed">{fa.competitivePosition}</div>
                  </div>

                  {/* USP */}
                  <div className="mt-2 text-[9px] text-muted-foreground leading-relaxed">
                    <span className="text-bloomberg-amber font-bold">USP:</span> {fa.usp}
                  </div>
                </div>

                {/* 2. Porter's 5 Forces */}
                <div>
                  <div className="text-[10px] text-bloomberg-green font-bold mb-2">2. PORTER&apos;S 5 FORCES <span className="text-muted-foreground font-normal">(Średnia: {fa.porterAvg}/10)</span></div>
                  <div className="space-y-1.5">
                    {fa.porter.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-[140px] text-[8px] text-muted-foreground shrink-0">{f.namePL}</div>
                        <div className="flex-1 h-3 bg-bloomberg-bg rounded-full overflow-hidden border border-bloomberg-border/30">
                          <div
                            className={`h-full rounded-full transition-all ${f.score >= 7 ? "bg-bloomberg-green/70" : f.score >= 5 ? "bg-bloomberg-amber/70" : "bg-bloomberg-red/70"}`}
                            style={{ width: `${f.score * 10}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold w-6 text-right ${f.score >= 7 ? "text-bloomberg-green" : f.score >= 5 ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>{f.score}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                    {fa.porter.map((f, i) => (
                      <div key={i} className="text-[8px] text-muted-foreground/80">
                        <span className="text-foreground font-bold">{f.namePL}:</span> {f.description}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. PESTEL */}
                <div>
                  <div className="text-[10px] text-bloomberg-green font-bold mb-2">3. ANALIZA PESTEL</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                    {fa.pestel.map((p, i) => (
                      <div key={i} className="flex items-start gap-1.5 bg-bloomberg-bg rounded p-2 border border-bloomberg-border/30">
                        <span className="text-[10px] shrink-0">{impactIcon(p.impact)}</span>
                        <div>
                          <div className="text-[8px] font-bold text-foreground">{p.code} — {p.name}</div>
                          <div className="text-[8px] text-muted-foreground leading-snug">{p.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Economic Moat */}
                <div className={`rounded p-3 border ${moatBorder} ${moatBg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-bloomberg-green font-bold">4. FOSA EKONOMICZNA (ECONOMIC MOAT)</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black ${moatColor}`}>{fa.moatScore}</span>
                      <span className="text-[8px] text-muted-foreground">/100</span>
                      <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded ${moatColor} ${moatBorder}`}>
                        {fa.moatRating === "Wide" ? "🏰 SZEROKA" : fa.moatRating === "Narrow" ? "🔶 WĄSKA" : "⚠️ BRAK"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    {fa.moatTypes.map((m, i) => (
                      <div key={i} className="bg-bloomberg-bg/50 rounded p-2 border border-bloomberg-border/20">
                        <div className="text-[8px] text-muted-foreground mb-0.5">{m.type}</div>
                        <div className={`text-[9px] font-bold ${strengthColor(m.strength)}`}>{strengthLabel(m.strength)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[9px] text-foreground/80 leading-relaxed">{fa.verdict}</div>
                </div>
              </div>
            )
          })()}

          {/* ═══ QUOTE HEADER ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <span className="text-2xl font-bold text-bloomberg-green">{q.symbol}</span>
                <span className="text-sm text-muted-foreground ml-2">{q.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({q.exchange})</span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {fmtCurrencyPrice(q.price, q.currency)}
                </div>
                <div
                  className={`flex items-center justify-end gap-1 text-sm ${
                    q.change >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"
                  }`}
                >
                  {q.change >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {q.change >= 0 ? "+" : ""}
                  {q.change.toFixed(2)} ({q.changePercent.toFixed(2)}%)
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  MCap {fmtB(q.marketCap, q.currency)} | Vol {q.volume.toLocaleString()} | 52W {`${fmtCurrencyPrice(q.low52, q.currency)} - ${fmtCurrencyPrice(q.high52, q.currency)}`}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 2: PRICE CHART — 3Y WEEKLY ═══ */}
          {history.length > 0 && (() => {
            const chartData = computeChartData(history)
            // Compute fair value zone from fundamentals
            // Fair value = price where forward PE = sector PE
            const fairPE = a.sectorPE
            const eps = q.eps ?? (q.forwardPE && q.price ? q.price / q.forwardPE : null)
            const fairValue = eps && fairPE ? eps * fairPE : null
            const overvalued = fairValue ? fairValue * 1.3 : null  // 30% above fair = overvalued
            const undervalued = fairValue ? fairValue * 0.7 : null  // 30% below fair = undervalued

            // Determine current valuation status
            const currentStatus = !fairValue ? null
              : q.price > (overvalued ?? 0) ? "overvalued"
              : q.price < (undervalued ?? 0) ? "undervalued"
              : "fairvalue"
            const statusLabel = currentStatus === "overvalued" ? "⚠️ PRZEWARTOŚCIOWANA"
              : currentStatus === "undervalued" ? "💎 NIEDOWARTOŚCIOWANA"
              : currentStatus === "fairvalue" ? "✅ WYCENA FAIR"
              : ""
            const statusColor = currentStatus === "overvalued" ? "text-bloomberg-red"
              : currentStatus === "undervalued" ? "text-bloomberg-green"
              : "text-bloomberg-amber"

            return (
              <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
                <div className="text-xs text-bloomberg-amber font-bold mb-1 tracking-widest">
                  WYKRES CENOWY — 3 LATA (1W)
                  {a.rsi != null && (
                    <span className="text-muted-foreground font-normal ml-3">
                      RSI: <span className={a.rsi > 70 ? "text-bloomberg-red" : a.rsi < 30 ? "text-bloomberg-green" : ""}>{a.rsi.toFixed(1)}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mb-3 text-[9px]">
                  {a.ma50 != null && (
                    <span className="text-muted-foreground">
                      MA50: <span className="text-foreground">{fmtCurrencyPrice(a.ma50, q.currency)}</span> ({fmtPct(a.distanceFromMA50Pct)})
                    </span>
                  )}
                  {a.ma200 != null && (
                    <span className="text-muted-foreground">
                      MA200: <span className="text-foreground">{fmtCurrencyPrice(a.ma200, q.currency)}</span> ({fmtPct(a.distanceFromMA200Pct)})
                    </span>
                  )}
                  {fairValue && (
                    <span className="text-muted-foreground">
                      Fair Value: <span className="text-bloomberg-amber font-bold">{fmtCurrencyPrice(fairValue, q.currency)}</span>
                    </span>
                  )}
                  {statusLabel && (
                    <span className={`font-bold ${statusColor}`}>{statusLabel}</span>
                  )}
                </div>
                <PriceChart
                  data={chartData}
                  fairValue={fairValue}
                  overvalued={overvalued}
                  undervalued={undervalued}
                  supports={a.stopLoss ? [a.stopLoss] : []}
                  resistances={a.target1 ? [a.target1] : []}
                />
                {/* Valuation legend */}
                <div className="flex items-center gap-4 mt-2 text-[8px]">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-bloomberg-red inline-block" /> Strefa przewartościowania {overvalued ? `(>${fmtCurrencyPrice(overvalued, q.currency)})` : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-bloomberg-green inline-block" /> Strefa niedowartościowania {undervalued ? `(<${fmtCurrencyPrice(undervalued, q.currency)})` : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-bloomberg-amber/50 inline-block border-dashed border-t border-bloomberg-amber" /> Fair Value {fairValue ? fmtCurrencyPrice(fairValue, q.currency) : ""}
                  </span>
                  <span className="text-muted-foreground ml-auto">
                    Wycena: P/E sektorowe ({a.sectorPE.toFixed(1)}x) × EPS ({eps ? fmtCurrencyPrice(eps, q.currency) : "N/A"})
                  </span>
                </div>
              </div>
            )
          })()}

          {/* ═══ SECTION 3: VALUATION INFOGRAPHIC ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-widest">
              VALUATION vs SECTOR ({a.sector})
            </div>
            <HorizontalBar
              data={[
                {
                  label: "Fwd P/E",
                  value: a.peFwd ?? 0,
                  benchmark: a.sectorPE,
                  color:
                    a.peFwd != null && a.peFwd > a.sectorPE * 1.5
                      ? "#ff3333"
                      : a.peFwd != null && a.peFwd > a.sectorPE
                        ? "#ff8c00"
                        : "#1a9938",
                },
                {
                  label: "EV/EBITDA",
                  value: a.evEbitda ?? 0,
                  benchmark: 15,
                  color:
                    a.evEbitda != null && a.evEbitda > 20
                      ? "#ff3333"
                      : "#1a9938",
                },
                {
                  label: "P/FCF",
                  value: a.pfcf ?? 0,
                  benchmark: 25,
                  color:
                    a.pfcf != null && a.pfcf > 30
                      ? "#ff3333"
                      : "#1a9938",
                },
              ]}
            />
            {a.premiumToSectorPE != null && (
              <div className="text-xs text-muted-foreground mt-2">
                Premium to sector P/E:{" "}
                <span
                  className={
                    a.premiumToSectorPE > 50
                      ? "text-bloomberg-red"
                      : a.premiumToSectorPE > 0
                        ? "text-bloomberg-amber"
                        : "text-bloomberg-green"
                  }
                >
                  {a.premiumToSectorPE > 0 ? "+" : ""}
                  {a.premiumToSectorPE.toFixed(1)}%
                </span>
                <span className="ml-2">(Amber line = sector/benchmark avg)</span>
              </div>
            )}
          </div>

          {/* ═══ SECTION 4: FINANCIAL HEALTH RADAR ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-widest">
              FINANCIAL HEALTH
            </div>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:w-1/2">
                <RadarChart
                  data={[
                    {
                      metric: "Rev Growth",
                      value: normalizeMetric(a.revenueGrowth, 30),
                      fullMark: 100,
                    },
                    {
                      metric: "Gross Margin",
                      value: normalizeMetric(a.grossMargin, 50),
                      fullMark: 100,
                    },
                    {
                      metric: "Op Margin",
                      value: normalizeMetric(a.operatingMargin, 30),
                      fullMark: 100,
                    },
                    {
                      metric: "FCF Margin",
                      value: normalizeMetric(a.fcfMargin, 25),
                      fullMark: 100,
                    },
                    {
                      metric: "ROE",
                      value: normalizeMetric(a.roe, 30),
                      fullMark: 100,
                    },
                  ]}
                />
              </div>
              <div className="w-full md:w-1/2 grid grid-cols-2 gap-3 text-xs">
                <MetricRow label="Revenue Growth" value={fmtPct(a.revenueGrowth)} positive={a.revenueGrowth != null && a.revenueGrowth > 0} />
                <MetricRow label="Gross Margin" value={fmtPct(a.grossMargin)} positive={a.grossMargin != null && a.grossMargin > 15} />
                <MetricRow label="Operating Margin" value={fmtPct(a.operatingMargin)} positive={a.operatingMargin != null && a.operatingMargin > 10} />
                <MetricRow label="FCF Margin" value={fmtPct(a.fcfMargin)} positive={a.fcfMargin != null && a.fcfMargin > 5} />
                <MetricRow label="ROE" value={fmtPct(a.roe)} positive={a.roe != null && a.roe > 10} />
                <MetricRow label="Debt/EBITDA" value={fmt(a.debtEbitda)} positive={a.debtEbitda != null && a.debtEbitda < 4} />
              </div>
            </div>
          </div>

          {/* ═══ SECTION 5: RISK GAUGE ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-widest">
              OVERALL RISK SCORE
            </div>
            <div className="flex justify-center">
              <GaugeChart
                value={a.overallRiskScore}
                max={10}
                label={`Risk ${a.overallRiskScore}/10`}
                size={240}
              />
            </div>
          </div>

          {/* ═══ SECTION 6: RISK MATRIX ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-widest">
              RISK MATRIX
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-bloomberg-border">
                    <th className="text-left py-2 pr-4 text-muted-foreground">RISK</th>
                    <th className="text-center py-2 px-3 text-muted-foreground">PROB</th>
                    <th className="text-center py-2 px-3 text-muted-foreground">IMPACT</th>
                    <th className="text-center py-2 px-3 text-muted-foreground">SCORE</th>
                    <th className="text-left py-2 pl-3 text-muted-foreground">MITIGATION</th>
                  </tr>
                </thead>
                <tbody>
                  {a.riskMatrix.map((r) => (
                    <tr key={r.name} className="border-b border-bloomberg-border/50">
                      <td className="py-2 pr-4 text-foreground font-bold">{r.name}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${riskBg(r.probability)} ${riskColor(r.probability)}`}>
                          {r.probability}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${riskBg(r.impact)} ${riskColor(r.impact)}`}>
                          {r.impact}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`font-bold ${riskColor(r.score <= 3 ? "Low" : r.score <= 6 ? "Medium" : "High")}`}>
                          {r.score}
                        </span>
                      </td>
                      <td className="py-2 pl-3 text-muted-foreground">{r.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ SECTION 7: PROBABILITY SCENARIOS ═══ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-widest">
              PROBABILITY SCENARIOS
            </div>
            <div className="space-y-4">
              <ScenarioBar
                label="BULL"
                probability={a.bullCase.probability}
                returnPct={a.bullCase.returnPct}
                price={a.bullCase.price}
                color="bg-bloomberg-green"
                textColor="text-bloomberg-green"
                currency={q.currency}
              />
              <ScenarioBar
                label="BASE"
                probability={a.baseCase.probability}
                returnPct={a.baseCase.returnPct}
                price={a.baseCase.price}
                color="bg-bloomberg-amber"
                textColor="text-bloomberg-amber"
                currency={q.currency}
              />
              <ScenarioBar
                label="BEAR"
                probability={a.bearCase.probability}
                returnPct={a.bearCase.returnPct}
                price={a.bearCase.price}
                color="bg-bloomberg-red"
                textColor="text-bloomberg-red"
                currency={q.currency}
              />
            </div>
            <div className="mt-3 pt-3 border-t border-bloomberg-border flex justify-between text-xs">
              <span className="text-muted-foreground">Weighted Expected Return</span>
              <span className={`font-bold ${a.expectedReturn >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                {a.expectedReturn >= 0 ? "+" : ""}{a.expectedReturn.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* ═══ SECTION 8: NEWS ═══ */}
          {news.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-widest">
                RECENT NEWS
              </div>
              <div className="space-y-2">
                {news.map((n, i) => (
                  <a
                    key={i}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 py-1.5 border-b border-bloomberg-border/30 last:border-0 hover:bg-bloomberg-border/10 transition-colors px-1 -mx-1 rounded"
                  >
                    <span className={`text-xs font-bold shrink-0 mt-0.5 ${sentimentColor(n.sentiment)}`}>
                      {sentimentIcon(n.sentiment)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-foreground truncate">{n.headline}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {n.source} — {n.date}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SECTION 9: MAIN RISK WARNING ═══ */}
          <div className="bg-bloomberg-red/10 border border-bloomberg-red/30 rounded p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-bloomberg-red shrink-0 mt-0.5" />
            <div>
              <div className="text-xs text-bloomberg-red font-bold tracking-widest mb-1">
                PRIMARY RISK
              </div>
              <div className="text-sm text-foreground">{a.mainRisk}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-Components ──────────────────────────────────────────

function LevelBox({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted-foreground tracking-wider">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      {sub && <div className={`text-[10px] ${color} opacity-70`}>{sub}</div>}
    </div>
  )
}

function CheckItem({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`font-bold text-[10px] ${checkColor(value)}`}>
        {checkIcon(value)}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

function MetricRow({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive: boolean
}) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-bloomberg-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${value === "N/A" ? "text-muted-foreground" : positive ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
        {value}
      </span>
    </div>
  )
}

function ScenarioBar({
  label,
  probability,
  returnPct,
  price,
  color,
  textColor,
  currency = "USD",
}: {
  label: string
  probability: number
  returnPct: number
  price: number
  color: string
  textColor: string
  currency?: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-bold ${textColor}`}>{label}</span>
        <span className="text-muted-foreground">
          {fmtCurrencyPrice(price, currency)} ({returnPct >= 0 ? "+" : ""}
          {returnPct.toFixed(1)}%)
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-5 bg-bloomberg-border/30 rounded overflow-hidden">
          <div
            className={`h-full ${color} rounded transition-all duration-500`}
            style={{ width: `${probability}%` }}
          />
        </div>
        <span className={`text-xs font-bold ${textColor} w-10 text-right`}>
          {probability}%
        </span>
      </div>
    </div>
  )
}

function TranslatedSummary({ text, full }: { text: string; full?: boolean }) {
  const translated = useTranslatePL(text)
  if (full) {
    return (
      <div className="text-[10px] text-foreground/80 leading-relaxed">
        {translated}
      </div>
    )
  }
  return (
    <div className="text-[9px] text-muted-foreground leading-snug flex-1 line-clamp-2">
      {translated}
    </div>
  )
}
