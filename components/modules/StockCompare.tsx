"use client"

import { useState } from "react"
import { AlertTriangle, Trophy, Target, Shield, TrendingUp, Zap, Award, ArrowRight } from "lucide-react"
import type { QuoteData, KeyStatistics } from "@/lib/yahoo"
import type { FullAnalysis } from "@/lib/analysis"
import BarCompareChart from "@/components/charts/BarCompareChart"
import { fmtPrice as fmtCurrencyPrice } from "@/lib/currency"

import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts"

// --- Colors ---
const BLOOMBERG_BLUE = "oklch(0.65 0.15 250)"
const BLOOMBERG_AMBER = "oklch(0.7 0.12 60)"

interface CompareData {
  quoteA: QuoteData
  quoteB: QuoteData
  statsA: KeyStatistics | null
  statsB: KeyStatistics | null
  analysisA: FullAnalysis
  analysisB: FullAnalysis
}

export default function StockCompare() {
  const [tickerA, setTickerA] = useState("")
  const [tickerB, setTickerB] = useState("")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CompareData | null>(null)
  const [error, setError] = useState("")

  const handleCompare = async () => {
    if (!tickerA || !tickerB) return
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickerA, tickerB }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Comparison failed")
    } finally {
      setLoading(false)
    }
  }

  const qA = data?.quoteA
  const qB = data?.quoteB
  const sA = data?.statsA
  const sB = data?.statsB
  const aA = data?.analysisA
  const aB = data?.analysisB

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Compare two stocks head to head — full analysis with verdicts, metrics, and scoring
      </div>

      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-bloomberg-amber block mb-1">STOCK A</label>
            <input
              value={tickerA}
              onChange={(e) => setTickerA(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              placeholder="e.g. AAPL"
              className="w-full bg-bloomberg-bg border border-bloomberg-border rounded px-3 py-2 text-sm focus:outline-none focus:border-bloomberg-green/50"
            />
          </div>
          <div>
            <label className="text-xs text-bloomberg-amber block mb-1">STOCK B</label>
            <input
              value={tickerB}
              onChange={(e) => setTickerB(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              placeholder="e.g. MSFT"
              className="w-full bg-bloomberg-bg border border-bloomberg-border rounded px-3 py-2 text-sm focus:outline-none focus:border-bloomberg-green/50"
            />
          </div>
        </div>
        <button
          onClick={handleCompare}
          disabled={loading || !tickerA || !tickerB}
          className="px-6 py-2 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded text-xs font-bold hover:bg-bloomberg-green/30 disabled:opacity-40 transition-colors"
        >
          {loading ? "COMPARING..." : "COMPARE"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {qA && qB && aA && aB && sA !== undefined && sB !== undefined && (
        <div className="space-y-4">

          {/* 1. TWO DECISION DASHBOARDS side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DecisionDashboard q={qA} a={aA} color="text-bloomberg-blue" borderColor="border-bloomberg-blue/30" />
            <DecisionDashboard q={qB} a={aB} color="text-bloomberg-amber" borderColor="border-bloomberg-amber/30" />
          </div>

          {/* 2. COMPARISON TABLE */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3">HEAD-TO-HEAD COMPARISON</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-bloomberg-border">
                    <th className="text-left py-2 text-muted-foreground">METRIC</th>
                    <th className="text-right py-2 text-bloomberg-blue">{qA.symbol}</th>
                    <th className="text-right py-2 text-bloomberg-amber">{qB.symbol}</th>
                    <th className="text-center py-2 text-muted-foreground">WINNER</th>
                  </tr>
                </thead>
                <tbody>
                  <CompRow label="Revenue Growth" a={fmtPctVal(aA.revenueGrowth)} b={fmtPctVal(aB.revenueGrowth)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.revenueGrowth) > numVal(aB.revenueGrowth)} />
                  <CompRow label="Gross Margin" a={fmtPctVal(aA.grossMargin)} b={fmtPctVal(aB.grossMargin)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.grossMargin) > numVal(aB.grossMargin)} />
                  <CompRow label="FCF Margin" a={fmtPctVal(aA.fcfMargin)} b={fmtPctVal(aB.fcfMargin)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.fcfMargin) > numVal(aB.fcfMargin)} />
                  <CompRow label="P/E (Forward)" a={fmtNum(aA.peFwd)} b={fmtNum(aB.peFwd)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.peFwd) < numVal(aB.peFwd)} lowerBetter />
                  <CompRow label="EV/EBITDA" a={fmtNum(aA.evEbitda)} b={fmtNum(aB.evEbitda)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.evEbitda) < numVal(aB.evEbitda)} lowerBetter />
                  <CompRow label="Debt/EBITDA" a={fmtNum(aA.debtEbitda)} b={fmtNum(aB.debtEbitda)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.debtEbitda) < numVal(aB.debtEbitda)} lowerBetter />
                  <CompRow label="ROE" a={fmtPctVal(aA.roe)} b={fmtPctVal(aB.roe)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.roe) > numVal(aB.roe)} />
                  <CompRow label="Dividend Yield" a={qA.dividendYield ? (qA.dividendYield * 100).toFixed(2) + "%" : "N/A"} b={qB.dividendYield ? (qB.dividendYield * 100).toFixed(2) + "%" : "N/A"} symA={qA.symbol} symB={qB.symbol} winA={numVal(qA.dividendYield) > numVal(qB.dividendYield)} />
                  <CompRow label="52W Performance" a={fmtPctVal(aA.distanceFrom52Low)} b={fmtPctVal(aB.distanceFrom52Low)} symA={qA.symbol} symB={qB.symbol} winA={numVal(aA.distanceFrom52Low) > numVal(aB.distanceFrom52Low)} />
                  <CompRow label="Moat Rating" a={moatRating(aA)} b={moatRating(aB)} symA={qA.symbol} symB={qB.symbol} winA={moatScore(aA) > moatScore(aB)} />
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. RADAR CHART — both stocks overlaid */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3">RADAR COMPARISON</div>
            <DualRadarChart symA={qA.symbol} symB={qB.symbol} aA={aA} aB={aB} />
          </div>

          {/* 4. BAR COMPARISON */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3">KEY METRICS BAR COMPARISON</div>
            <BarCompareChart data={buildBarData(qA.symbol, qB.symbol, aA, aB)} />
          </div>

          {/* 5. SCORECARD */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-bloomberg-amber" />
              <span className="text-xs text-bloomberg-amber font-bold">CATEGORY SCORECARD</span>
            </div>
            <ScorecardTable symA={qA.symbol} symB={qB.symbol} aA={aA} aB={aB} qA={qA} qB={qB} />
          </div>

          {/* 6. THE CALL */}
          <TheCall symA={qA.symbol} symB={qB.symbol} aA={aA} aB={aB} qA={qA} qB={qB} />
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Decision Dashboard
// ──────────────────────────────────────────
function DecisionDashboard({ q, a, color, borderColor }: { q: QuoteData; a: FullAnalysis; color: string; borderColor: string }) {
  const verdictColor = a.verdict === "BUY" ? "text-bloomberg-green" : a.verdict === "HOLD" ? "text-bloomberg-amber" : "text-bloomberg-red"
  const verdictBg = a.verdict === "BUY" ? "bg-bloomberg-green/10" : a.verdict === "HOLD" ? "bg-bloomberg-amber/10" : "bg-bloomberg-red/10"

  return (
    <div className={`bg-bloomberg-card border ${borderColor} rounded p-4 space-y-3`}>
      <div className="flex items-baseline justify-between">
        <div>
          <span className={`text-lg font-bold ${color}`}>{q.symbol}</span>
          <span className="text-xs text-muted-foreground ml-2">{q.name}</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">{fmtCurrencyPrice(q.price, q.currency)}</div>
          <div className={`text-xs ${q.change >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
            {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)} ({q.changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div className={`${verdictBg} rounded p-3 text-center`}>
        <div className={`text-2xl font-black ${verdictColor}`}>{a.verdict}</div>
        <div className="text-xs text-muted-foreground">Confidence: {a.confidence}</div>
      </div>

      <div className="text-xs text-muted-foreground italic">{a.thesis}</div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-bloomberg-bg rounded p-2">
          <div className="text-muted-foreground">Entry</div>
          <div className="font-bold">{fmtCurrencyPrice(a.entry, q.currency)}</div>
        </div>
        <div className="bg-bloomberg-bg rounded p-2">
          <div className="text-muted-foreground">Target</div>
          <div className="font-bold text-bloomberg-green">{fmtCurrencyPrice(a.target1, q.currency)}</div>
          <div className="text-bloomberg-green text-[10px]">+{a.target1Pct.toFixed(1)}%</div>
        </div>
        <div className="bg-bloomberg-bg rounded p-2">
          <div className="text-muted-foreground">Stop</div>
          <div className="font-bold text-bloomberg-red">{fmtCurrencyPrice(a.stopLoss, q.currency)}</div>
          <div className="text-bloomberg-red text-[10px]">{a.stopLossPct.toFixed(1)}%</div>
        </div>
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">R/R Ratio</span>
        <span className={`font-bold ${a.riskReward >= 2 ? "text-bloomberg-green" : a.riskReward >= 1 ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>
          {a.riskReward.toFixed(2)}x
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Expected Return</span>
        <span className={`font-bold ${a.expectedReturn >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
          {a.expectedReturn >= 0 ? "+" : ""}{a.expectedReturn.toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Risk Score</span>
        <span className={`font-bold ${a.overallRiskScore <= 4 ? "text-bloomberg-green" : a.overallRiskScore <= 6 ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>
          {a.overallRiskScore}/9
        </span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Dual Radar Chart
// ──────────────────────────────────────────
function DualRadarChart({ symA, symB, aA, aB }: { symA: string; symB: string; aA: FullAnalysis; aB: FullAnalysis }) {
  const radarData = [
    {
      metric: "Revenue Growth",
      [symA]: normalizeMetric(aA.revenueGrowth, -20, 60),
      [symB]: normalizeMetric(aB.revenueGrowth, -20, 60),
    },
    {
      metric: "Margins",
      [symA]: normalizeMetric(aA.grossMargin, -10, 50),
      [symB]: normalizeMetric(aB.grossMargin, -10, 50),
    },
    {
      metric: "Valuation",
      [symA]: normalizeValuation(aA.peFwd),
      [symB]: normalizeValuation(aB.peFwd),
    },
    {
      metric: "Financial Health",
      [symA]: normalizeHealth(aA),
      [symB]: normalizeHealth(aB),
    },
    {
      metric: "Momentum",
      [symA]: normalizeMomentum(aA),
      [symB]: normalizeMomentum(aB),
    },
  ]

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
        <PolarGrid stroke="oklch(0.25 0.01 240)" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: "oklch(0.6 0.01 200)", fontSize: 11, fontFamily: "monospace" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: "oklch(0.6 0.01 200)", fontSize: 10, fontFamily: "monospace" }}
          axisLine={false}
          stroke="oklch(0.25 0.01 240)"
        />
        <Radar
          name={symA}
          dataKey={symA}
          stroke={BLOOMBERG_BLUE}
          fill={BLOOMBERG_BLUE}
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Radar
          name={symB}
          dataKey={symB}
          stroke={BLOOMBERG_AMBER}
          fill={BLOOMBERG_AMBER}
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Legend
          wrapperStyle={{ fontFamily: "monospace", fontSize: 11, color: "oklch(0.6 0.01 200)" }}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}

function normalizeMetric(val: number | null, min: number, max: number): number {
  if (val == null) return 30
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100))
}

function normalizeValuation(pe: number | null): number {
  // Lower PE is better -> higher score
  if (pe == null) return 50
  if (pe <= 0) return 20
  if (pe <= 10) return 95
  if (pe <= 15) return 80
  if (pe <= 20) return 65
  if (pe <= 30) return 50
  if (pe <= 50) return 30
  return 10
}

function normalizeHealth(a: FullAnalysis): number {
  let score = 50
  if (a.debtEbitda != null) {
    if (a.debtEbitda < 2) score += 25
    else if (a.debtEbitda < 4) score += 10
    else score -= 15
  }
  if (a.roe != null) {
    if (a.roe > 20) score += 20
    else if (a.roe > 10) score += 10
    else score -= 10
  }
  return Math.max(0, Math.min(100, score))
}

function normalizeMomentum(a: FullAnalysis): number {
  let score = 50
  if (a.checklist.aboveMA50 === true) score += 15
  if (a.checklist.aboveMA200 === true) score += 15
  if (a.rsi != null) {
    if (a.rsi > 50 && a.rsi < 70) score += 15
    else if (a.rsi >= 70) score += 5
    else score -= 10
  }
  if (a.distanceFrom52High > -10) score += 10
  return Math.max(0, Math.min(100, score))
}

// ──────────────────────────────────────────
// Bar Compare Data Builder
// ──────────────────────────────────────────
function buildBarData(symA: string, symB: string, aA: FullAnalysis, aB: FullAnalysis) {
  return [
    { name: "Rev Growth %", valueA: aA.revenueGrowth ?? 0, valueB: aB.revenueGrowth ?? 0, labelA: symA, labelB: symB },
    { name: "Gross Margin %", valueA: aA.grossMargin ?? 0, valueB: aB.grossMargin ?? 0, labelA: symA, labelB: symB },
    { name: "FCF Margin %", valueA: aA.fcfMargin ?? 0, valueB: aB.fcfMargin ?? 0, labelA: symA, labelB: symB },
    { name: "ROE %", valueA: aA.roe ?? 0, valueB: aB.roe ?? 0, labelA: symA, labelB: symB },
    { name: "P/E Fwd", valueA: aA.peFwd ?? 0, valueB: aB.peFwd ?? 0, labelA: symA, labelB: symB },
    { name: "EV/EBITDA", valueA: aA.evEbitda ?? 0, valueB: aB.evEbitda ?? 0, labelA: symA, labelB: symB },
    { name: "Risk/Reward", valueA: aA.riskReward, valueB: aB.riskReward, labelA: symA, labelB: symB },
  ]
}

// ──────────────────────────────────────────
// Scorecard
// ──────────────────────────────────────────
function ScorecardTable({ symA, symB, aA, aB, qA, qB }: { symA: string; symB: string; aA: FullAnalysis; aB: FullAnalysis; qA: QuoteData; qB: QuoteData }) {
  const categories = computeScorecard(aA, aB, qA, qB)

  let winsA = 0
  let winsB = 0
  for (const c of categories) {
    if (c.winner === "A") winsA++
    else if (c.winner === "B") winsB++
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-bloomberg-border">
              <th className="text-left py-2 text-muted-foreground">CATEGORY</th>
              <th className="text-center py-2 text-bloomberg-blue">{symA}</th>
              <th className="text-center py-2 text-bloomberg-amber">{symB}</th>
              <th className="text-center py-2 text-muted-foreground">WINNER</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c, i) => (
              <tr key={i} className="border-b border-bloomberg-border/50">
                <td className="py-2 text-muted-foreground flex items-center gap-1.5">
                  {c.icon}
                  {c.name}
                </td>
                <td className={`py-2 text-center font-bold ${c.winner === "A" ? "text-bloomberg-green" : ""}`}>{c.scoreA}/10</td>
                <td className={`py-2 text-center font-bold ${c.winner === "B" ? "text-bloomberg-green" : ""}`}>{c.scoreB}/10</td>
                <td className="py-2 text-center text-bloomberg-green font-bold">
                  {c.winner === "A" ? symA : c.winner === "B" ? symB : "TIE"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center gap-4 pt-2 text-sm">
        <span className="text-bloomberg-blue font-bold">{symA}: {winsA}</span>
        <span className="text-muted-foreground">vs</span>
        <span className="text-bloomberg-amber font-bold">{symB}: {winsB}</span>
      </div>
    </div>
  )
}

interface ScorecardRow {
  name: string
  icon: React.ReactNode
  scoreA: number
  scoreB: number
  winner: "A" | "B" | "TIE"
}

function computeScorecard(aA: FullAnalysis, aB: FullAnalysis, qA: QuoteData, qB: QuoteData): ScorecardRow[] {
  const rows: ScorecardRow[] = []

  // Valuation: lower PE, lower EV/EBITDA = better
  const valA = valuationScore(aA)
  const valB = valuationScore(aB)
  rows.push({ name: "Valuation", icon: <Target className="w-3 h-3" />, scoreA: valA, scoreB: valB, winner: valA > valB ? "A" : valB > valA ? "B" : "TIE" })

  // Growth
  const grA = growthScore(aA)
  const grB = growthScore(aB)
  rows.push({ name: "Growth", icon: <TrendingUp className="w-3 h-3" />, scoreA: grA, scoreB: grB, winner: grA > grB ? "A" : grB > grA ? "B" : "TIE" })

  // Financial Health
  const fhA = healthScore(aA)
  const fhB = healthScore(aB)
  rows.push({ name: "Financial Health", icon: <Shield className="w-3 h-3" />, scoreA: fhA, scoreB: fhB, winner: fhA > fhB ? "A" : fhB > fhA ? "B" : "TIE" })

  // Moat
  const moA = moatScore(aA)
  const moB = moatScore(aB)
  rows.push({ name: "Moat", icon: <Award className="w-3 h-3" />, scoreA: moA, scoreB: moB, winner: moA > moB ? "A" : moB > moA ? "B" : "TIE" })

  // Technical / Momentum
  const teA = technicalScore(aA)
  const teB = technicalScore(aB)
  rows.push({ name: "Technical", icon: <Zap className="w-3 h-3" />, scoreA: teA, scoreB: teB, winner: teA > teB ? "A" : teB > teA ? "B" : "TIE" })

  // Momentum (price-based)
  const momA = momentumScore(aA)
  const momB = momentumScore(aB)
  rows.push({ name: "Momentum", icon: <ArrowRight className="w-3 h-3" />, scoreA: momA, scoreB: momB, winner: momA > momB ? "A" : momB > momA ? "B" : "TIE" })

  return rows
}

function clamp10(v: number): number { return Math.max(1, Math.min(10, Math.round(v))) }

function valuationScore(a: FullAnalysis): number {
  let s = 5
  if (a.peFwd != null) {
    if (a.peFwd < 15) s += 3
    else if (a.peFwd < 25) s += 1
    else if (a.peFwd > 40) s -= 2
    else s -= 1
  }
  if (a.evEbitda != null) {
    if (a.evEbitda < 10) s += 2
    else if (a.evEbitda > 20) s -= 2
  }
  return clamp10(s)
}

function growthScore(a: FullAnalysis): number {
  let s = 5
  if (a.revenueGrowth != null) {
    if (a.revenueGrowth > 20) s += 3
    else if (a.revenueGrowth > 10) s += 2
    else if (a.revenueGrowth > 0) s += 1
    else s -= 2
  }
  if (a.expectedReturn > 10) s += 1
  if (a.expectedReturn < 0) s -= 1
  return clamp10(s)
}

function healthScore(a: FullAnalysis): number {
  let s = 5
  if (a.debtEbitda != null) {
    if (a.debtEbitda < 2) s += 2
    else if (a.debtEbitda > 5) s -= 2
  }
  if (a.roe != null) {
    if (a.roe > 20) s += 2
    else if (a.roe > 10) s += 1
    else if (a.roe < 0) s -= 2
  }
  if (a.checklist.balanceSheetHealthy === true) s += 1
  if (a.checklist.balanceSheetHealthy === false) s -= 1
  return clamp10(s)
}

function moatScore(a: FullAnalysis): number {
  let s = 5
  if (a.grossMargin != null) {
    if (a.grossMargin > 30) s += 2
    else if (a.grossMargin > 15) s += 1
    else s -= 1
  }
  if (a.operatingMargin != null && a.operatingMargin > 20) s += 1
  if (a.roe != null && a.roe > 25) s += 1
  if (a.revenueGrowth != null && a.revenueGrowth > 10) s += 1
  return clamp10(s)
}

function moatRating(a: FullAnalysis): string {
  const s = moatScore(a)
  if (s >= 8) return "Wide"
  if (s >= 6) return "Narrow"
  return "None"
}

function technicalScore(a: FullAnalysis): number {
  let s = 5
  if (a.checklist.aboveMA50 === true) s += 1
  if (a.checklist.aboveMA200 === true) s += 1
  if (a.rsi != null) {
    if (a.rsi >= 40 && a.rsi <= 60) s += 2
    else if (a.rsi > 60 && a.rsi < 75) s += 1
    else if (a.rsi >= 75) s -= 1
    else if (a.rsi < 30) s -= 1
  }
  if (a.riskReward >= 2) s += 1
  return clamp10(s)
}

function momentumScore(a: FullAnalysis): number {
  let s = 5
  if (a.distanceFrom52High > -5) s += 2
  else if (a.distanceFrom52High > -15) s += 1
  else if (a.distanceFrom52High < -30) s -= 2
  if (a.distanceFromMA50Pct != null && a.distanceFromMA50Pct > 0) s += 1
  if (a.distanceFromMA200Pct != null && a.distanceFromMA200Pct > 0) s += 1
  return clamp10(s)
}

// ──────────────────────────────────────────
// THE CALL
// ──────────────────────────────────────────
function TheCall({ symA, symB, aA, aB, qA, qB }: { symA: string; symB: string; aA: FullAnalysis; aB: FullAnalysis; qA: QuoteData; qB: QuoteData }) {
  const categories = computeScorecard(aA, aB, qA, qB)
  let winsA = 0, winsB = 0, totalA = 0, totalB = 0
  for (const c of categories) {
    totalA += c.scoreA
    totalB += c.scoreB
    if (c.winner === "A") winsA++
    else if (c.winner === "B") winsB++
  }

  const winner = totalA > totalB ? symA : totalB > totalA ? symB : null
  const winnerAnalysis = totalA > totalB ? aA : aB
  const loser = totalA > totalB ? symB : symA

  const reasons: string[] = []
  if (winnerAnalysis.revenueGrowth != null && winnerAnalysis.revenueGrowth > 5)
    reasons.push("stronger revenue growth")
  if (winnerAnalysis.riskReward >= 2)
    reasons.push("superior risk/reward ratio")
  if (winnerAnalysis.checklist.valuationReasonable)
    reasons.push("reasonable valuation")
  if (winnerAnalysis.expectedReturn > 5)
    reasons.push("higher expected return")
  if (winnerAnalysis.overallRiskScore < 5)
    reasons.push("lower risk profile")
  if (reasons.length === 0)
    reasons.push("better overall metrics")

  return (
    <div className="bg-bloomberg-card border border-bloomberg-green/30 rounded p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-5 h-5 text-bloomberg-green" />
        <span className="text-sm text-bloomberg-green font-bold">THE CALL</span>
      </div>
      {winner ? (
        <div className="space-y-2">
          <div className="text-lg font-bold">
            <span className="text-bloomberg-green">{winner}</span>
            <span className="text-muted-foreground"> is the stronger buy over </span>
            <span className="text-muted-foreground">{loser}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Won {Math.max(winsA, winsB)} of {categories.length} categories (total score: {Math.max(totalA, totalB)} vs {Math.min(totalA, totalB)}).
            Key advantages: {reasons.join(", ")}.
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-center text-xs">
            <div className="bg-bloomberg-bg rounded p-2">
              <div className="text-bloomberg-blue font-bold">{symA}</div>
              <div className={`text-lg font-black ${aA.verdict === "BUY" ? "text-bloomberg-green" : aA.verdict === "HOLD" ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>{aA.verdict}</div>
              <div className="text-muted-foreground">E[R]: {aA.expectedReturn >= 0 ? "+" : ""}{aA.expectedReturn.toFixed(1)}%</div>
            </div>
            <div className="bg-bloomberg-bg rounded p-2">
              <div className="text-bloomberg-amber font-bold">{symB}</div>
              <div className={`text-lg font-black ${aB.verdict === "BUY" ? "text-bloomberg-green" : aB.verdict === "HOLD" ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>{aB.verdict}</div>
              <div className="text-muted-foreground">E[R]: {aB.expectedReturn >= 0 ? "+" : ""}{aB.expectedReturn.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-bloomberg-amber font-bold">
          Too close to call — both stocks score equally. Consider your risk tolerance and time horizon.
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Comparison Row
// ──────────────────────────────────────────
function CompRow({ label, a, b, symA, symB, winA, lowerBetter }: {
  label: string; a: string; b: string; symA: string; symB: string; winA: boolean; lowerBetter?: boolean
}) {
  const aNA = a === "N/A"
  const bNA = b === "N/A"
  const tie = aNA && bNA
  const winner = tie ? "" : aNA ? symB : bNA ? symA : winA ? symA : symB
  return (
    <tr className="border-b border-bloomberg-border/50">
      <td className="py-2 text-muted-foreground">{label} {lowerBetter ? <span className="text-[10px]">(lower=better)</span> : ""}</td>
      <td className={`py-2 text-right font-bold ${winner === symA ? "text-bloomberg-green" : ""}`}>{a}</td>
      <td className={`py-2 text-right font-bold ${winner === symB ? "text-bloomberg-green" : ""}`}>{b}</td>
      <td className="py-2 text-center text-bloomberg-green font-bold">{winner || "---"}</td>
    </tr>
  )
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────
function numVal(v: number | null | undefined): number { return v ?? -Infinity }
function fmtNum(v: number | null | undefined): string { return v != null ? v.toFixed(2) : "N/A" }
function fmtPctVal(v: number | null | undefined): string { return v != null ? v.toFixed(2) + "%" : "N/A" }
