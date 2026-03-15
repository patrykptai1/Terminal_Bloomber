"use client"

import { useState, useMemo } from "react"
import {
  Target,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingUp,
  TrendingDown,
  Shield,
  Crosshair,
  BarChart3,
  Activity,
} from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import PriceChart from "@/components/charts/PriceChart"
import GaugeChart from "@/components/charts/GaugeChart"
import type { QuoteData } from "@/lib/yahoo"
import type { FullAnalysis } from "@/lib/analysis"
import { fmtPrice as fmtCurrencyPrice } from "@/lib/currency"

interface Technicals {
  sma20: number | null
  sma50: number | null
  sma200: number | null
  rsi: number | null
  volumeTrend: number
  supports: number[]
  resistances: number[]
  pctFrom52High: number
  pctFrom52Low: number
  priceVsSma20: number | null
  priceVsSma50: number | null
  priceVsSma200: number | null
}

interface HistEntry {
  date: string
  close: number
  volume: number
  high: number
  low: number
}

interface EntryData {
  quote: QuoteData
  analysis: FullAnalysis
  technicals: Technicals
  history: HistEntry[]
}

// --- Verdict color helpers ---

function verdictColor(v: string): string {
  switch (v) {
    case "BUY": return "text-bloomberg-green"
    case "HOLD": return "text-bloomberg-amber"
    case "SELL": return "text-bloomberg-red"
    case "AVOID": return "text-bloomberg-red"
    default: return "text-muted-foreground"
  }
}

function verdictBg(v: string): string {
  switch (v) {
    case "BUY": return "bg-bloomberg-green/10 border-bloomberg-green/30"
    case "HOLD": return "bg-bloomberg-amber/10 border-bloomberg-amber/30"
    case "SELL": return "bg-bloomberg-red/10 border-bloomberg-red/30"
    case "AVOID": return "bg-bloomberg-red/15 border-bloomberg-red/40"
    default: return "bg-bloomberg-card border-bloomberg-border"
  }
}

function signalColor(pct: number | null, inverted = false): string {
  if (pct == null) return "text-muted-foreground"
  const val = inverted ? -pct : pct
  if (val > 3) return "text-bloomberg-green"
  if (val < -3) return "text-bloomberg-red"
  return "text-bloomberg-amber"
}

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "N/A"
  return n.toFixed(decimals)
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "N/A"
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`
}

function fmtP(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "N/A"
  return fmtCurrencyPrice(n, currency)
}

export default function EntryTiming() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<EntryData | null>(null)
  const [error, setError] = useState("")

  const handleAnalyze = async (ticker: string) => {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  // Compute MA50/MA200 overlays from full history client-side
  const chartData = useMemo(() => {
    if (!data?.history?.length) return []
    const h = data.history
    return h.map((bar, idx) => {
      let ma50: number | undefined
      let ma200: number | undefined
      if (idx >= 49) {
        const slice50 = h.slice(idx - 49, idx + 1)
        ma50 = slice50.reduce((s, b) => s + b.close, 0) / 50
      }
      if (idx >= 199) {
        const slice200 = h.slice(idx - 199, idx + 1)
        ma200 = slice200.reduce((s, b) => s + b.close, 0) / 200
      }
      return {
        date: new Date(bar.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        close: bar.close,
        ma50,
        ma200,
      }
    })
  }, [data?.history])

  const q = data?.quote
  const a = data?.analysis
  const t = data?.technicals

  // Build entry scenarios
  const scenarios = useMemo(() => {
    if (!q || !a || !t) return []
    const price = q.price

    // Buy Now condition
    const buyNowConditions: string[] = []
    if (a.verdict === "BUY") buyNowConditions.push("Checklist positive")
    if (t.rsi && t.rsi < 40) buyNowConditions.push("RSI not overbought")
    if (t.priceVsSma50 != null && t.priceVsSma50 > 0) buyNowConditions.push("Above MA50")
    const buyNowCond = buyNowConditions.length > 0 ? buyNowConditions.join(", ") : "Signals are mixed — proceed with caution"

    // Wait for dip — MA50 retest or 5% pullback
    const dipPrice = t.sma50 != null ? Math.min(t.sma50, price * 0.95) : price * 0.95
    const dipCond = t.sma50 != null
      ? `MA50 retest at ${fmtP(t.sma50, q.currency)} or ${fmt(((price - dipPrice) / price) * 100, 1)}% pullback`
      : "5% pullback from current level"

    // Aggressive entry — breakout above resistance
    const r1 = t.resistances[0]
    const aggressivePrice = r1 ?? (q.high52 > price ? q.high52 : price * 1.05)
    const aggressiveCond = r1
      ? `Breakout above R1 (${fmtP(r1, q.currency)}) with volume confirmation`
      : `New 52W high breakout above ${fmtP(q.high52, q.currency)}`

    // Avoid condition
    const avoidConditions: string[] = []
    if (t.supports[0]) avoidConditions.push(`Price breaks below S1 (${fmtP(t.supports[0], q.currency)})`)
    if (t.sma200) avoidConditions.push(`Loses MA200 (${fmtP(t.sma200, q.currency)})`)
    const avoidCond = avoidConditions.length > 0 ? avoidConditions.join(" or ") : "Major support breakdown"

    return [
      { scenario: "Buy Now", price: fmtP(price, q.currency), condition: buyNowCond, color: "text-bloomberg-green", icon: <TrendingUp className="w-4 h-4" /> },
      { scenario: "Wait for Dip", price: fmtP(dipPrice, q.currency), condition: dipCond, color: "text-bloomberg-amber", icon: <TrendingDown className="w-4 h-4" /> },
      { scenario: "Aggressive Entry", price: fmtP(aggressivePrice, q.currency), condition: aggressiveCond, color: "text-blue-400", icon: <ArrowUp className="w-4 h-4" /> },
      { scenario: "Avoid Entirely", price: "---", condition: avoidCond, color: "text-bloomberg-red", icon: <Shield className="w-4 h-4" /> },
    ]
  }, [q, a, t])

  // Technical signals list
  const signals = useMemo(() => {
    if (!t) return []
    return [
      {
        name: "RSI (14)",
        value: t.rsi?.toFixed(1) ?? "N/A",
        signal: t.rsi ? (t.rsi < 30 ? "bullish" : t.rsi > 70 ? "bearish" : "neutral") : "neutral",
        detail: t.rsi ? (t.rsi < 30 ? "Oversold" : t.rsi > 70 ? "Overbought" : "Neutral zone") : "",
      },
      {
        name: "SMA 20",
        value: fmt(t.sma20),
        signal: t.priceVsSma20 ? (t.priceVsSma20 > 0 ? "bullish" : "bearish") : "neutral",
        detail: t.priceVsSma20 ? `${fmtPct(t.priceVsSma20)} vs SMA20` : "",
      },
      {
        name: "SMA 50",
        value: fmt(t.sma50),
        signal: t.priceVsSma50 ? (t.priceVsSma50 > 0 ? "bullish" : "bearish") : "neutral",
        detail: t.priceVsSma50 ? `${fmtPct(t.priceVsSma50)} vs SMA50` : "",
      },
      {
        name: "SMA 200",
        value: fmt(t.sma200),
        signal: t.priceVsSma200 ? (t.priceVsSma200 > 0 ? "bullish" : "bearish") : "neutral",
        detail: t.priceVsSma200 ? `${fmtPct(t.priceVsSma200)} vs SMA200` : "",
      },
      {
        name: "Volume",
        value: `${(t.volumeTrend * 100).toFixed(0)}%`,
        signal: t.volumeTrend > 1.2 ? "bullish" : t.volumeTrend < 0.8 ? "bearish" : "neutral",
        detail: `${t.volumeTrend > 1 ? "Above" : "Below"} average volume`,
      },
      {
        name: "52W Position",
        value: `${t.pctFrom52High.toFixed(1)}% from high`,
        signal: t.pctFrom52High < 10 ? "bullish" : t.pctFrom52High > 30 ? "bearish" : "neutral",
        detail: `${t.pctFrom52Low.toFixed(1)}% above 52w low`,
      },
    ]
  }, [t])

  const signalIcon = {
    bullish: <ArrowUp className="w-3.5 h-3.5 text-bloomberg-green" />,
    bearish: <ArrowDown className="w-3.5 h-3.5 text-bloomberg-red" />,
    neutral: <Minus className="w-3.5 h-3.5 text-bloomberg-amber" />,
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Entry timing — price chart with MA overlay, support/resistance, entry scenarios, valuation check (Yahoo Finance)
      </div>
      <TerminalInput
        placeholder="Enter ticker (e.g. NVDA, AMZN, KGH.WA)"
        onSubmit={handleAnalyze}
        loading={loading}
        label="ENTRY >"
      />

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {q && a && t && (
        <div className="space-y-4">

          {/* ================================================================
              1. DECISION DASHBOARD
             ================================================================ */}
          <div className={`border rounded-lg p-5 ${verdictBg(a.verdict)}`}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Crosshair className={`w-5 h-5 ${verdictColor(a.verdict)}`} />
                  <span className="text-xs text-muted-foreground font-mono tracking-wider">DECISION DASHBOARD</span>
                </div>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="text-2xl font-bold text-foreground">{q.symbol}</span>
                  <span className="text-sm text-muted-foreground">{q.name}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{a.thesis}</div>
              </div>

              <div className="text-right">
                <div className={`text-4xl font-black tracking-tight ${verdictColor(a.verdict)}`}>
                  {a.verdict}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Confidence: <span className="text-foreground font-bold">{a.confidence}</span>
                </div>
              </div>
            </div>

            {/* Entry Price Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-white/10">
              <div>
                <div className="text-[10px] text-muted-foreground tracking-wider">ENTRY PRICE</div>
                <div className="text-2xl font-bold text-foreground">{fmtP(a.entry, q.currency)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground tracking-wider">STOP LOSS</div>
                <div className="text-lg font-bold text-bloomberg-red">{fmtP(a.stopLoss, q.currency)}</div>
                <div className="text-[10px] text-bloomberg-red">{fmtPct(a.stopLossPct)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground tracking-wider">TARGET 1</div>
                <div className="text-lg font-bold text-bloomberg-green">{fmtP(a.target1, q.currency)}</div>
                <div className="text-[10px] text-bloomberg-green">{fmtPct(a.target1Pct)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground tracking-wider">TARGET 2</div>
                <div className="text-lg font-bold text-bloomberg-green">{fmtP(a.target2, q.currency)}</div>
                <div className="text-[10px] text-bloomberg-green">{fmtPct(a.target2Pct)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground tracking-wider">RISK / REWARD</div>
                <div className={`text-lg font-bold ${a.riskReward >= 2 ? "text-bloomberg-green" : a.riskReward >= 1 ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>
                  1:{fmt(a.riskReward, 1)}
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================
              2. PRICE CHART (LARGE)
             ================================================================ */}
          {chartData.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-bloomberg-amber" />
                <span className="text-xs text-bloomberg-amber font-bold tracking-wider">PRICE CHART — 1 YEAR</span>
                <span className="text-[10px] text-muted-foreground ml-2">MA50 (amber) / MA200 (blue) / S&R levels</span>
              </div>
              <PriceChart
                data={chartData}
                supports={t.supports}
                resistances={t.resistances}
              />
            </div>
          )}

          {/* ================================================================
              3. VALUATION CHECK
             ================================================================ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-bloomberg-amber" />
              <span className="text-xs text-bloomberg-amber font-bold tracking-wider">VALUATION CHECK</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 52W Range position */}
              <div className="bg-bloomberg-bg rounded p-3">
                <div className="text-[10px] text-muted-foreground tracking-wider mb-2">52-WEEK RANGE</div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">From High</span>
                  <span className={`font-bold ${t.pctFrom52High > 20 ? "text-bloomberg-red" : t.pctFrom52High < 5 ? "text-bloomberg-green" : "text-bloomberg-amber"}`}>
                    -{fmt(t.pctFrom52High, 1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">From Low</span>
                  <span className={`font-bold ${t.pctFrom52Low > 50 ? "text-bloomberg-green" : "text-bloomberg-amber"}`}>
                    +{fmt(t.pctFrom52Low, 1)}%
                  </span>
                </div>
                {/* Mini bar */}
                <div className="relative h-2 bg-bloomberg-bg border border-bloomberg-border rounded mt-3 overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-bloomberg-red via-bloomberg-amber to-bloomberg-green opacity-50"
                    style={{ width: "100%" }}
                  />
                  <div
                    className="absolute top-0 h-full w-1 bg-foreground rounded"
                    style={{ left: `${q.high52 > q.low52 ? ((q.price - q.low52) / (q.high52 - q.low52)) * 100 : 50}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                  <span>{fmtP(q.low52, q.currency)}</span>
                  <span>{fmtP(q.high52, q.currency)}</span>
                </div>
              </div>

              {/* Fair value premium/discount */}
              <div className="bg-bloomberg-bg rounded p-3">
                <div className="text-[10px] text-muted-foreground tracking-wider mb-2">VS FAIR VALUE</div>
                {q.targetMeanPrice ? (() => {
                  const diff = ((q.price - q.targetMeanPrice) / q.targetMeanPrice) * 100
                  const isPremium = diff > 0
                  return (
                    <>
                      <div className={`text-xl font-bold ${isPremium ? "text-bloomberg-red" : "text-bloomberg-green"}`}>
                        {isPremium ? "+" : ""}{fmt(diff, 1)}%
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {isPremium ? "Premium" : "Discount"} to analyst mean
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Target: {fmtP(q.targetMeanPrice, q.currency)}
                      </div>
                    </>
                  )
                })() : (
                  <div className="text-xs text-muted-foreground">No analyst target available</div>
                )}
              </div>

              {/* Distance from MA50 */}
              <div className="bg-bloomberg-bg rounded p-3">
                <div className="text-[10px] text-muted-foreground tracking-wider mb-2">vs MA50</div>
                <div className={`text-xl font-bold ${signalColor(t.priceVsSma50)}`}>
                  {fmtPct(t.priceVsSma50)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.priceVsSma50 != null
                    ? t.priceVsSma50 > 5 ? "Overbought zone" : t.priceVsSma50 < -5 ? "Oversold zone" : "Neutral"
                    : "Insufficient data"}
                </div>
                {t.sma50 != null && (
                  <div className="text-[10px] text-muted-foreground mt-1">MA50: {fmtP(t.sma50, q.currency)}</div>
                )}
              </div>

              {/* Distance from MA200 */}
              <div className="bg-bloomberg-bg rounded p-3">
                <div className="text-[10px] text-muted-foreground tracking-wider mb-2">vs MA200 (TREND)</div>
                <div className={`text-xl font-bold ${signalColor(t.priceVsSma200)}`}>
                  {fmtPct(t.priceVsSma200)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.priceVsSma200 != null
                    ? t.priceVsSma200 > 0 ? "Long-term UPTREND" : "Long-term DOWNTREND"
                    : "Insufficient data"}
                </div>
                {t.sma200 != null && (
                  <div className="text-[10px] text-muted-foreground mt-1">MA200: {fmtP(t.sma200, q.currency)}</div>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================
              4. ENTRY SCENARIOS TABLE
             ================================================================ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Crosshair className="w-4 h-4 text-bloomberg-amber" />
              <span className="text-xs text-bloomberg-amber font-bold tracking-wider">ENTRY SCENARIOS</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bloomberg-border">
                    <th className="text-left text-[10px] text-muted-foreground tracking-wider py-2 pr-4">SCENARIO</th>
                    <th className="text-right text-[10px] text-muted-foreground tracking-wider py-2 px-4">PRICE</th>
                    <th className="text-left text-[10px] text-muted-foreground tracking-wider py-2 pl-4">CONDITION</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((row, i) => (
                    <tr key={i} className="border-b border-bloomberg-border/30 last:border-0">
                      <td className="py-3 pr-4">
                        <div className={`flex items-center gap-2 font-bold ${row.color}`}>
                          {row.icon}
                          {row.scenario}
                        </div>
                      </td>
                      <td className={`text-right py-3 px-4 font-mono font-bold ${row.color}`}>
                        {row.price}
                      </td>
                      <td className="py-3 pl-4 text-xs text-muted-foreground">
                        {row.condition}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================================================================
              5. TECHNICAL SIGNALS — RSI Gauge + MA signals
             ================================================================ */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-bloomberg-amber" />
              <span className="text-xs text-bloomberg-amber font-bold tracking-wider">TECHNICAL SIGNALS</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
              {/* RSI Gauge */}
              <div className="flex flex-col items-center justify-center bg-bloomberg-bg rounded p-3">
                <GaugeChart
                  value={t.rsi ?? 50}
                  max={100}
                  label="RSI (14)"
                  size={180}
                />
                <div className={`text-xs font-bold mt-1 ${
                  t.rsi != null
                    ? t.rsi < 30 ? "text-bloomberg-green" : t.rsi > 70 ? "text-bloomberg-red" : "text-bloomberg-amber"
                    : "text-muted-foreground"
                }`}>
                  {t.rsi != null
                    ? t.rsi < 30 ? "OVERSOLD" : t.rsi > 70 ? "OVERBOUGHT" : "NEUTRAL"
                    : "N/A"}
                </div>
              </div>

              {/* Signal grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {signals.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-bloomberg-bg rounded p-3">
                    {signalIcon[s.signal as keyof typeof signalIcon]}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{s.detail}</div>
                    </div>
                    <div className={`text-xs font-bold shrink-0 ${
                      s.signal === "bullish" ? "text-bloomberg-green" :
                      s.signal === "bearish" ? "text-bloomberg-red" : "text-bloomberg-amber"
                    }`}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ================================================================
              6. KEY LEVELS — Support & Resistance with % distance
             ================================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-bloomberg-card border border-bloomberg-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-bloomberg-green" />
                <span className="text-xs text-bloomberg-green font-bold tracking-wider">SUPPORT LEVELS</span>
              </div>
              {t.supports.length > 0 ? t.supports.map((s, i) => {
                const dist = ((q.price - s) / q.price) * 100
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-bloomberg-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono w-5">S{i + 1}</span>
                      <span className="text-bloomberg-green font-bold font-mono">{fmtP(s, q.currency)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-bloomberg-bg rounded overflow-hidden">
                        <div
                          className="h-full bg-bloomberg-green/50 rounded"
                          style={{ width: `${Math.min(dist * 3, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono w-16 text-right">
                        -{fmt(dist, 1)}%
                      </span>
                    </div>
                  </div>
                )
              }) : <div className="text-xs text-muted-foreground">No clear support levels found</div>}
            </div>

            <div className="bg-bloomberg-card border border-bloomberg-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-bloomberg-red" />
                <span className="text-xs text-bloomberg-red font-bold tracking-wider">RESISTANCE LEVELS</span>
              </div>
              {t.resistances.length > 0 ? t.resistances.map((r, i) => {
                const dist = ((r - q.price) / q.price) * 100
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-bloomberg-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono w-5">R{i + 1}</span>
                      <span className="text-bloomberg-red font-bold font-mono">{fmtP(r, q.currency)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-bloomberg-bg rounded overflow-hidden">
                        <div
                          className="h-full bg-bloomberg-red/50 rounded"
                          style={{ width: `${Math.min(dist * 3, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono w-16 text-right">
                        +{fmt(dist, 1)}%
                      </span>
                    </div>
                  </div>
                )
              }) : <div className="text-xs text-muted-foreground">No clear resistance levels found</div>}
            </div>
          </div>

          {/* ================================================================
              7. ANALYST TARGETS — Low / Mean / High with upside %
             ================================================================ */}
          {q.targetMeanPrice && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-bloomberg-amber" />
                <span className="text-xs text-bloomberg-amber font-bold tracking-wider">ANALYST PRICE TARGETS</span>
                {q.numberOfAnalysts != null && (
                  <span className="text-[10px] text-muted-foreground ml-2">({q.numberOfAnalysts} analysts)</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* LOW */}
                <div className="bg-bloomberg-bg rounded p-3 text-center">
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">LOW</div>
                  <div className="text-xl font-bold text-bloomberg-red font-mono">
                    {fmtP(q.targetLowPrice, q.currency)}
                  </div>
                  {q.targetLowPrice != null && (
                    <div className={`text-xs font-bold mt-1 ${q.targetLowPrice >= q.price ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                      {fmtPct(((q.targetLowPrice - q.price) / q.price) * 100)}
                    </div>
                  )}
                </div>

                {/* MEAN */}
                <div className="bg-bloomberg-bg rounded p-3 text-center border border-bloomberg-amber/20">
                  <div className="text-[10px] text-bloomberg-amber tracking-wider mb-1">MEAN</div>
                  <div className="text-xl font-bold text-bloomberg-amber font-mono">
                    {fmtP(q.targetMeanPrice, q.currency)}
                  </div>
                  <div className={`text-xs font-bold mt-1 ${q.targetMeanPrice >= q.price ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                    {fmtPct(((q.targetMeanPrice - q.price) / q.price) * 100)}
                  </div>
                </div>

                {/* HIGH */}
                <div className="bg-bloomberg-bg rounded p-3 text-center">
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">HIGH</div>
                  <div className="text-xl font-bold text-bloomberg-green font-mono">
                    {fmtP(q.targetHighPrice, q.currency)}
                  </div>
                  {q.targetHighPrice != null && (
                    <div className={`text-xs font-bold mt-1 ${q.targetHighPrice >= q.price ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                      {fmtPct(((q.targetHighPrice - q.price) / q.price) * 100)}
                    </div>
                  )}
                </div>
              </div>

              {/* Visual range bar */}
              {q.targetLowPrice != null && q.targetHighPrice != null && (
                <div className="mt-4">
                  <div className="relative h-3 bg-bloomberg-bg border border-bloomberg-border rounded overflow-hidden">
                    {/* Range band */}
                    <div
                      className="absolute h-full bg-bloomberg-amber/20"
                      style={{
                        left: `${((q.targetLowPrice - q.targetLowPrice * 0.9) / (q.targetHighPrice * 1.1 - q.targetLowPrice * 0.9)) * 100}%`,
                        width: `${((q.targetHighPrice - q.targetLowPrice) / (q.targetHighPrice * 1.1 - q.targetLowPrice * 0.9)) * 100}%`,
                      }}
                    />
                    {/* Current price marker */}
                    <div
                      className="absolute top-0 h-full w-1 bg-foreground rounded"
                      style={{
                        left: `${Math.max(0, Math.min(100, ((q.price - q.targetLowPrice * 0.9) / (q.targetHighPrice * 1.1 - q.targetLowPrice * 0.9)) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>Low: {fmtP(q.targetLowPrice, q.currency)}</span>
                    <span className="text-foreground font-bold">Current: {fmtP(q.price, q.currency)}</span>
                    <span>High: {fmtP(q.targetHighPrice, q.currency)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
