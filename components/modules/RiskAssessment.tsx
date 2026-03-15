"use client"

import { useState } from "react"
import { AlertTriangle, Shield, TrendingDown, Target, Activity } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import GaugeChart from "@/components/charts/GaugeChart"
import type { QuoteData, KeyStatistics } from "@/lib/yahoo"
import type { FullAnalysis } from "@/lib/analysis"

// ── Bloomberg Colors ─────────────────────────────────────────────
const GREEN = "oklch(0.75 0.15 145)"
const AMBER = "oklch(0.7 0.12 60)"
const RED = "oklch(0.6 0.2 25)"
const MUTED = "oklch(0.5 0.01 200)"

// ── Types ────────────────────────────────────────────────────────

interface ApiResponse {
  quote: QuoteData
  stats: KeyStatistics | null
  analysis: FullAnalysis
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────

function fmtB(v: number): string {
  if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

function fmtPrice(v: number): string {
  return v >= 1000 ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${v.toFixed(2)}`
}

function fmtPct(v: number | null): string {
  if (v == null) return "N/A"
  const sign = v >= 0 ? "+" : ""
  return `${sign}${v.toFixed(2)}%`
}

function scoreColor(score: number): string {
  if (score <= 3) return "text-bloomberg-green"
  if (score <= 6) return "text-bloomberg-amber"
  return "text-bloomberg-red"
}

function scoreBg(score: number): string {
  if (score <= 3) return "bg-bloomberg-green/10 border-bloomberg-green/30"
  if (score <= 6) return "bg-bloomberg-amber/10 border-bloomberg-amber/30"
  return "bg-bloomberg-red/10 border-bloomberg-red/30"
}

function verdictColor(verdict: string): string {
  if (verdict === "BUY") return "text-bloomberg-green"
  if (verdict === "HOLD") return "text-bloomberg-amber"
  return "text-bloomberg-red"
}

function verdictBg(verdict: string): string {
  if (verdict === "BUY") return "bg-bloomberg-green/10 border-bloomberg-green/30"
  if (verdict === "HOLD") return "bg-bloomberg-amber/10 border-bloomberg-amber/30"
  return "bg-bloomberg-red/10 border-bloomberg-red/30"
}

function probLabel(p: string): string {
  if (p === "Low") return "LOW"
  if (p === "Medium") return "MED"
  return "HIGH"
}

function probColor(p: string): string {
  if (p === "Low") return "text-bloomberg-green"
  if (p === "Medium") return "text-bloomberg-amber"
  return "text-bloomberg-red"
}

// ── Component ────────────────────────────────────────────────────

export default function RiskAssessment() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState("")

  const handleAnalyze = async (ticker: string) => {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const res = await fetch("/api/risk", {
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
  const s = data?.stats
  const a = data?.analysis

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Risk matrix, probability-weighted returns, key risk metrics (Yahoo Finance data)
      </div>
      <TerminalInput
        placeholder="Enter ticker (e.g. TSLA, META, NVDA)"
        onSubmit={handleAnalyze}
        loading={loading}
        label="RISK >"
      />

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {q && a && (
        <div className="space-y-4">

          {/* ── 1. DECISION DASHBOARD ─────────────────────────── */}
          <div className={`border rounded p-4 ${verdictBg(a.verdict)}`}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" />
              <span className="text-xs font-bold text-bloomberg-amber tracking-wider">DECISION DASHBOARD</span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">{q.symbol} - {q.name}</div>
                <div className={`text-4xl font-black tracking-tight ${verdictColor(a.verdict)}`}>
                  {a.verdict}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Confidence: <span className="font-bold text-foreground">{a.confidence}</span>
                </div>
              </div>
              <div className="flex-1 text-xs text-muted-foreground italic">
                {a.thesis}
              </div>
            </div>

            {/* Key levels */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">ENTRY</div>
                <div className="font-bold text-lg">{fmtPrice(a.entry)}</div>
              </div>
              <div className="bg-bloomberg-red/20 border border-bloomberg-red/30 rounded px-2 py-1">
                <div className="text-bloomberg-red font-bold">STOP-LOSS</div>
                <div className="font-bold text-lg text-bloomberg-red">{fmtPrice(a.stopLoss)}</div>
                <div className="text-bloomberg-red/70">{fmtPct(a.stopLossPct)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">TARGET 1</div>
                <div className="font-bold text-lg text-bloomberg-green">{fmtPrice(a.target1)}</div>
                <div className="text-bloomberg-green/70">{fmtPct(a.target1Pct)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">TARGET 2</div>
                <div className="font-bold text-lg text-bloomberg-green">{fmtPrice(a.target2)}</div>
                <div className="text-bloomberg-green/70">{fmtPct(a.target2Pct)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">RISK/REWARD</div>
                <div className={`font-bold text-lg ${a.riskReward >= 2 ? "text-bloomberg-green" : a.riskReward >= 1 ? "text-bloomberg-amber" : "text-bloomberg-red"}`}>
                  {a.riskReward.toFixed(2)}x
                </div>
              </div>
            </div>
          </div>

          {/* ── 2. RISK GAUGE ──────────────────────────────────── */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-xs font-bold text-bloomberg-amber tracking-wider">OVERALL RISK SCORE</span>
            </div>
            <div className="flex flex-col items-center">
              <GaugeChart value={a.overallRiskScore} max={9} label="RISK SCORE (1-9)" size={280} />
              <div className="mt-2 text-xs text-muted-foreground">
                Main risk: <span className="text-foreground font-medium">{a.mainRisk}</span>
              </div>
            </div>
          </div>

          {/* ── 3. RISK MATRIX TABLE ──────────────────────────── */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-bold text-bloomberg-amber tracking-wider">RISK MATRIX</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-bloomberg-border">
                    <th className="text-left py-2 text-muted-foreground font-normal">RISK CATEGORY</th>
                    <th className="text-center py-2 text-muted-foreground font-normal">PROBABILITY</th>
                    <th className="text-center py-2 text-muted-foreground font-normal">IMPACT</th>
                    <th className="text-center py-2 text-muted-foreground font-normal">SCORE</th>
                    <th className="text-left py-2 text-muted-foreground font-normal pl-3">MITIGATION</th>
                  </tr>
                </thead>
                <tbody>
                  {a.riskMatrix.map((row, i) => (
                    <tr key={i} className="border-b border-bloomberg-border/50 hover:bg-white/[0.02]">
                      <td className="py-2.5 font-medium text-foreground">{row.name}</td>
                      <td className={`py-2.5 text-center font-bold ${probColor(row.probability)}`}>
                        {probLabel(row.probability)}
                      </td>
                      <td className={`py-2.5 text-center font-bold ${probColor(row.impact)}`}>
                        {probLabel(row.impact)}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded font-bold ${scoreBg(row.score)} ${scoreColor(row.score)}`}>
                          {row.score}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted-foreground pl-3">{row.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 4. PROBABILITY-WEIGHTED RETURN ─────────────────── */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-bold text-bloomberg-amber tracking-wider">PROBABILITY-WEIGHTED RETURN</span>
            </div>

            <div className="space-y-3">
              {/* Bull Case */}
              <ScenarioBar
                label="BULL"
                probability={a.bullCase.probability}
                returnPct={a.bullCase.returnPct}
                price={a.bullCase.price}
                color={GREEN}
                maxPct={Math.max(Math.abs(a.bullCase.returnPct), Math.abs(a.bearCase.returnPct))}
              />
              {/* Base Case */}
              <ScenarioBar
                label="BASE"
                probability={a.baseCase.probability}
                returnPct={a.baseCase.returnPct}
                price={a.baseCase.price}
                color={AMBER}
                maxPct={Math.max(Math.abs(a.bullCase.returnPct), Math.abs(a.bearCase.returnPct))}
              />
              {/* Bear Case */}
              <ScenarioBar
                label="BEAR"
                probability={a.bearCase.probability}
                returnPct={a.bearCase.returnPct}
                price={a.bearCase.price}
                color={RED}
                maxPct={Math.max(Math.abs(a.bullCase.returnPct), Math.abs(a.bearCase.returnPct))}
              />
            </div>

            {/* Expected Value */}
            <div className="mt-4 pt-3 border-t border-bloomberg-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground">EXPECTED RETURN (probability-weighted)</div>
              <div className={`text-lg font-black ${a.expectedReturn >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                {fmtPct(a.expectedReturn)}
              </div>
            </div>
          </div>

          {/* ── 5. WORST CASE SCENARIO ─────────────────────────── */}
          <div className="bg-bloomberg-red/5 border border-bloomberg-red/20 rounded p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-bloomberg-red" />
              <span className="text-xs font-bold text-bloomberg-red tracking-wider">WORST CASE SCENARIO</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="text-center">
                <div className="text-3xl font-black text-bloomberg-red">{fmtPrice(a.bearCase.price)}</div>
                <div className="text-xs text-bloomberg-red/70">{fmtPct(a.bearCase.returnPct)}</div>
                <div className="text-xs text-muted-foreground mt-1">{a.bearCase.probability}% probability</div>
              </div>
              <div className="flex-1 text-xs text-muted-foreground leading-relaxed space-y-1.5">
                <WorstCaseChain analysis={a} stats={s ?? null} />
              </div>
            </div>
          </div>

          {/* ── 6. KEY RISK METRICS ────────────────────────────── */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            <div className="text-xs text-bloomberg-amber font-bold mb-3 tracking-wider">KEY RISK METRICS</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs">
              <MetricCard
                label="BETA"
                value={q.beta?.toFixed(2) ?? "N/A"}
                warn={q.beta != null && Math.abs(q.beta) > 1.5}
              />
              <MetricCard
                label="DEBT/EQUITY"
                value={s?.debtToEquity != null ? `${s.debtToEquity.toFixed(0)}%` : "N/A"}
                warn={s?.debtToEquity != null && s.debtToEquity > 150}
              />
              <MetricCard
                label="CURRENT RATIO"
                value={s?.currentRatio?.toFixed(2) ?? "N/A"}
                warn={s?.currentRatio != null && s.currentRatio < 1.0}
              />
              <MetricCard
                label="SHORT INTEREST"
                value={s?.shortPercentOfFloat != null ? `${(s.shortPercentOfFloat * 100).toFixed(1)}%` : "N/A"}
                warn={s?.shortPercentOfFloat != null && s.shortPercentOfFloat > 0.1}
              />
              <MetricCard
                label="52W DRAWDOWN"
                value={q.high52 > 0 ? `${((q.high52 - q.price) / q.high52 * 100).toFixed(1)}%` : "N/A"}
                warn={q.high52 > 0 && (q.high52 - q.price) / q.high52 > 0.3}
              />
              <MetricCard
                label="RSI (14)"
                value={a.rsi?.toFixed(1) ?? "N/A"}
                warn={a.rsi != null && (a.rsi > 70 || a.rsi < 30)}
              />
            </div>

            {/* Secondary metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mt-4 pt-3 border-t border-bloomberg-border/50">
              <div>
                <div className="text-muted-foreground">TOTAL DEBT</div>
                <div className="font-bold">{s?.totalDebt ? fmtB(s.totalDebt) : "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">TOTAL CASH</div>
                <div className="font-bold">{s?.totalCash ? fmtB(s.totalCash) : "N/A"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">FCF</div>
                <div className={`font-bold ${s?.freeCashFlow && s.freeCashFlow > 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                  {s?.freeCashFlow ? fmtB(s.freeCashFlow) : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">SHORT RATIO</div>
                <div className="font-bold">{s?.shortRatio?.toFixed(2) ?? "N/A"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function ScenarioBar({
  label,
  probability,
  returnPct,
  price,
  color,
  maxPct,
}: {
  label: string
  probability: number
  returnPct: number
  price: number
  color: string
  maxPct: number
}) {
  const barWidth = maxPct > 0 ? Math.abs(returnPct) / maxPct * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 text-xs font-bold shrink-0" style={{ color }}>
        {label}
      </div>
      <div className="w-10 text-xs text-muted-foreground text-right shrink-0">
        {probability}%
      </div>
      <div className="flex-1 h-7 bg-white/[0.03] rounded relative overflow-hidden">
        <div
          className="h-full rounded transition-all duration-500"
          style={{
            width: `${Math.max(barWidth, 2)}%`,
            backgroundColor: color,
            opacity: 0.7,
          }}
        />
        <div className="absolute inset-0 flex items-center px-2 text-xs font-mono">
          <span className="font-bold" style={{ color }}>
            {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="w-20 text-xs text-right font-mono shrink-0" style={{ color }}>
        {fmtPrice(price)}
      </div>
    </div>
  )
}

function MetricCard({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className={`rounded px-2 py-1.5 border ${warn ? "bg-bloomberg-red/10 border-bloomberg-red/20" : "bg-white/[0.02] border-bloomberg-border/50"}`}>
      <div className="text-muted-foreground text-[10px] mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${warn ? "text-bloomberg-red" : ""}`}>{value}</div>
    </div>
  )
}

function WorstCaseChain({ analysis: a, stats: s }: { analysis: FullAnalysis; stats: KeyStatistics | null }) {
  const events: string[] = []

  // Build a chain of events based on actual risk factors
  if (a.riskMatrix.find(r => r.name === "Macro / Rates" && r.score >= 5)) {
    events.push("Macro deterioration triggers risk-off sentiment")
  }
  if (a.peFwd != null && a.peFwd > a.sectorPE * 1.5) {
    events.push(`Valuation compression from ${a.peFwd.toFixed(1)}x P/E toward sector average of ${a.sectorPE.toFixed(1)}x`)
  }
  if (s?.debtToEquity != null && s.debtToEquity > 100) {
    events.push(`High leverage (D/E: ${s.debtToEquity.toFixed(0)}%) amplifies downside in a downturn`)
  }
  if (a.revenueGrowth != null && a.revenueGrowth < 5) {
    events.push(`Slowing revenue growth (${a.revenueGrowth.toFixed(1)}%) fails to support current multiple`)
  }
  if (a.rsi != null && a.rsi > 65) {
    events.push("Overbought technical conditions lead to mean reversion")
  }
  if (a.distanceFrom52High < -20) {
    events.push("Already in downtrend — broken support levels accelerate selling")
  }

  // Always have at least 2 events
  if (events.length === 0) {
    events.push("Unexpected negative catalyst (earnings miss, regulatory action, macro shock)")
    events.push("Selling pressure pushes price to key support levels")
  }
  if (events.length === 1) {
    events.push("Cascading sell-off breaks key technical support levels")
  }

  events.push(`Price reaches bear-case target of ${fmtPrice(a.bearCase.price)} (${fmtPct(a.bearCase.returnPct)})`)

  return (
    <div className="space-y-1">
      {events.map((evt, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-bloomberg-red font-bold shrink-0">{i + 1}.</span>
          <span>{evt}</span>
        </div>
      ))}
    </div>
  )
}
