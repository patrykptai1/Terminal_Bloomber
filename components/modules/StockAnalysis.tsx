"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown, AlertTriangle, ShieldAlert } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import PriceChart from "@/components/charts/PriceChart"
import RadarChart from "@/components/charts/RadarChart"
import GaugeChart from "@/components/charts/GaugeChart"
import HorizontalBar from "@/components/charts/HorizontalBar"
import type { FullAnalysis } from "@/lib/analysis"
import type { QuoteData, KeyStatistics, HistoricalPrice } from "@/lib/yahoo"
import type { NewsItem } from "@/lib/news"

// ── Helpers ──────────────────────────────────────────────────

function fmt(v: number | null | undefined, suffix = ""): string {
  if (v == null) return "N/A"
  return v.toFixed(2) + suffix
}

function fmtB(v: number | null | undefined): string {
  if (v == null) return "N/A"
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  return `$${v.toLocaleString()}`
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

export default function StockAnalysis() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState("")

  const handleAnalyze = async (ticker: string) => {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch("/api/analyze", {
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

  const q = data?.quote
  const a = data?.analysis
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
            <div className="text-xs text-bloomberg-amber font-bold mb-4 tracking-widest">
              DECISION DASHBOARD
            </div>

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
              <LevelBox label="ENTRY" value={`$${fmt(a.entry)}`} sub="" color="text-foreground" />
              <LevelBox
                label="STOP-LOSS"
                value={`$${fmt(a.stopLoss)}`}
                sub={`${fmt(a.stopLossPct)}%`}
                color="text-bloomberg-red"
              />
              <LevelBox
                label="TARGET 1"
                value={`$${fmt(a.target1)}`}
                sub={`+${fmt(a.target1Pct)}%`}
                color="text-bloomberg-green"
              />
              <LevelBox
                label="TARGET 2"
                value={`$${fmt(a.target2)}`}
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
              <CheckItem label="No Excess Premium" value={a.checklist.noExcessivePremium} />
              <CheckItem label="Sector Tailwind" value={a.checklist.sectorTailwind} />
            </div>
          </div>

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
                  {q.currency === "USD" ? "$" : ""}
                  {q.price.toFixed(2)}
                  <span className="text-xs text-muted-foreground ml-1">{q.currency}</span>
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
                  MCap {fmtB(q.marketCap)} | Vol {q.volume.toLocaleString()} | 52W {`$${q.low52.toFixed(2)} - $${q.high52.toFixed(2)}`}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 2: PRICE CHART ═══ */}
          {history.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
              <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-widest">
                PRICE CHART — 1Y
                {a.ma50 != null && (
                  <span className="text-muted-foreground font-normal ml-3">
                    MA50: ${a.ma50.toFixed(2)} ({fmtPct(a.distanceFromMA50Pct)})
                  </span>
                )}
                {a.ma200 != null && (
                  <span className="text-muted-foreground font-normal ml-3">
                    MA200: ${a.ma200.toFixed(2)} ({fmtPct(a.distanceFromMA200Pct)})
                  </span>
                )}
                {a.rsi != null && (
                  <span className="text-muted-foreground font-normal ml-3">
                    RSI: {a.rsi.toFixed(1)}
                  </span>
                )}
              </div>
              <PriceChart
                data={computeChartData(history)}
                supports={a.stopLoss ? [a.stopLoss] : []}
                resistances={a.target1 ? [a.target1] : []}
              />
            </div>
          )}

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
                      ? "oklch(0.6 0.2 25)"
                      : a.peFwd != null && a.peFwd > a.sectorPE
                        ? "oklch(0.7 0.12 60)"
                        : "oklch(0.75 0.15 145)",
                },
                {
                  label: "EV/EBITDA",
                  value: a.evEbitda ?? 0,
                  benchmark: 15,
                  color:
                    a.evEbitda != null && a.evEbitda > 20
                      ? "oklch(0.6 0.2 25)"
                      : "oklch(0.75 0.15 145)",
                },
                {
                  label: "P/FCF",
                  value: a.pfcf ?? 0,
                  benchmark: 25,
                  color:
                    a.pfcf != null && a.pfcf > 30
                      ? "oklch(0.6 0.2 25)"
                      : "oklch(0.75 0.15 145)",
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
              />
              <ScenarioBar
                label="BASE"
                probability={a.baseCase.probability}
                returnPct={a.baseCase.returnPct}
                price={a.baseCase.price}
                color="bg-bloomberg-amber"
                textColor="text-bloomberg-amber"
              />
              <ScenarioBar
                label="BEAR"
                probability={a.bearCase.probability}
                returnPct={a.bearCase.returnPct}
                price={a.bearCase.price}
                color="bg-bloomberg-red"
                textColor="text-bloomberg-red"
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
}: {
  label: string
  probability: number
  returnPct: number
  price: number
  color: string
  textColor: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-bold ${textColor}`}>{label}</span>
        <span className="text-muted-foreground">
          ${price.toFixed(2)} ({returnPct >= 0 ? "+" : ""}
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
