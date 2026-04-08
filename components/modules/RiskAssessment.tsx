"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { AlertTriangle, Shield, TrendingDown, ChevronDown, ChevronUp } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import GaugeChart from "@/components/charts/GaugeChart"
import type { QuoteData, KeyStatistics, EarningsData } from "@/lib/yahoo"
import type { FullAnalysis } from "@/lib/analysis"
import { fmtBigValue } from "@/lib/currency"
import { computeFundamentalRisk } from "@/lib/fundamentalRisk"
import type { FundamentalRiskReport, RiskItem, RiskCategory } from "@/lib/fundamentalRisk"
import { useTranslatePL } from "@/hooks/useTranslate"

// ── Helpers ──

function sevColor(s: string): string {
  if (s === "critical") return "text-bloomberg-red"
  if (s === "high") return "text-bloomberg-red/80"
  if (s === "medium") return "text-bloomberg-amber"
  return "text-bloomberg-green"
}

function sevBg(s: string): string {
  if (s === "critical") return "bg-bloomberg-red/15 border-bloomberg-red/30"
  if (s === "high") return "bg-bloomberg-red/10 border-bloomberg-red/20"
  if (s === "medium") return "bg-bloomberg-amber/10 border-bloomberg-amber/20"
  return "bg-bloomberg-green/10 border-bloomberg-green/20"
}

function sevLabel(s: string): string {
  if (s === "critical") return "KRYTYCZNE"
  if (s === "high") return "WYSOKIE"
  if (s === "medium") return "ŚREDNIE"
  return "NISKIE"
}

function scoreColor(score: number): string {
  if (score <= 3) return "text-bloomberg-green"
  if (score <= 6) return "text-bloomberg-amber"
  return "text-bloomberg-red"
}

function overallColor(score: number): string {
  if (score >= 75) return "text-bloomberg-green"
  if (score >= 50) return "text-bloomberg-amber"
  return "text-bloomberg-red"
}

function trendIcon(t?: string): string {
  if (t === "worsening") return "📉"
  if (t === "improving") return "📈"
  return ""
}

// ── Types ──

interface ApiResponse {
  quote: QuoteData
  stats: KeyStatistics | null
  analysis: FullAnalysis
  earnings: EarningsData | null
}

// ── Component ──

const LS_KEY_RISK = "bloomberg_last_ticker_risk"

export default function RiskAssessment() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState("")
  const [lastTicker, setLastTicker] = useState("")
  const [expandedCat, setExpandedCat] = useState<number | null>(null)
  const didAutoLoad = useRef(false)

  const handleAnalyze = useCallback(async (ticker: string) => {
    setLoading(true)
    setError("")
    setData(null)
    const t = ticker.toUpperCase().trim()
    setLastTicker(t)
    try { localStorage.setItem(LS_KEY_RISK, t) } catch {}
    try {
      const res = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setExpandedCat(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analiza nie powiodła się")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    try { const saved = localStorage.getItem(LS_KEY_RISK); if (saved) { setLastTicker(saved); handleAnalyze(saved) } } catch {}
  }, [handleAnalyze])

  const q = data?.quote
  const s = data?.stats
  const e = data?.earnings

  const risk: FundamentalRiskReport | null = useMemo(() => {
    if (!q) return null
    return computeFundamentalRisk(q, s ?? null, e ?? null)
  }, [q, s, e])

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Kompleksowa ocena ryzyka fundamentalnego, finansowego i makroekonomicznego
      </div>
      <TerminalInput
        placeholder="Wpisz ticker (np. TSLA, META, NVDA, ZETA)"
        onSubmit={handleAnalyze}
        loading={loading}
        label="RISK >"
        defaultValue={lastTicker}
      />

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {q && risk && (
        <div className="space-y-4">

          {/* ── HEADER: Company + Overall Score ── */}
          <div className="bg-bloomberg-card border border-bloomberg-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xl font-bold text-bloomberg-green">{q.symbol} <span className="text-sm text-muted-foreground font-normal">{q.name}</span></div>
                <div className="text-[12px] text-muted-foreground">
                  {s?.sector && <span className="text-bloomberg-amber">{s.sector}</span>}
                  {s?.industry && <span> | {s.industry}</span>}
                  <span> | MCap: {fmtBigValue(q.marketCap, q.currency)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-black ${overallColor(risk.overallScore)}`}>{risk.overallScore}</div>
                <div className={`text-[12px] font-bold ${overallColor(risk.overallScore)}`}>{risk.riskLevel}</div>
                <div className="text-[12px] text-muted-foreground">BEZPIECZEŃSTWO /100</div>
              </div>
            </div>

            {/* Profile translation */}
            {s?.longBusinessSummary && <ProfileSummary text={s.longBusinessSummary} />}
          </div>

          {/* ── VERDICT ── */}
          <div className={`border p-3 ${risk.overallScore >= 60 ? "bg-bloomberg-green/5 border-bloomberg-green/20" : risk.overallScore >= 40 ? "bg-bloomberg-amber/5 border-bloomberg-amber/20" : "bg-bloomberg-red/5 border-bloomberg-red/20"}`}>
            <div className="text-[12px] text-foreground leading-relaxed">{risk.verdict}</div>
          </div>

          {/* ── TOP 5 RISKS ── */}
          {risk.topRisks.length > 0 && (
            <div className="bg-bloomberg-card border border-bloomberg-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-bloomberg-red" />
                <span className="text-[13px] font-bold text-bloomberg-red tracking-wider">TOP RYZYKA</span>
              </div>
              <div className="space-y-2">
                {risk.topRisks.map((r, i) => (
                  <div key={i} className={`border p-2.5 ${sevBg(r.severity)}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[12px] font-bold border px-1 py-px ${sevColor(r.severity)} border-current/30`}>{sevLabel(r.severity)}</span>
                        <span className="text-[12px] font-bold text-foreground">{r.title}</span>
                        {r.trend && <span className="text-[12px]">{trendIcon(r.trend)}</span>}
                      </div>
                      {r.metric && <span className="text-[13px] text-muted-foreground font-mono">{r.metric}</span>}
                    </div>
                    <div className="text-[13px] text-muted-foreground leading-relaxed">{r.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RISK CATEGORIES ── */}
          <div className="bg-bloomberg-card border border-bloomberg-border p-4">
            <div className="text-[13px] font-bold text-bloomberg-amber tracking-wider mb-3">KATEGORIE RYZYKA</div>

            {/* Overview bar */}
            <div className="flex h-4 mb-3 border border-bloomberg-border/50 overflow-hidden">
              {risk.categories.map((cat, i) => (
                <div
                  key={i}
                  className={`flex-1 flex items-center justify-center text-[9px] font-bold cursor-pointer transition-opacity hover:opacity-80 ${
                    cat.score <= 3 ? "bg-bloomberg-green/30 text-bloomberg-green" :
                    cat.score <= 6 ? "bg-bloomberg-amber/30 text-bloomberg-amber" :
                    "bg-bloomberg-red/30 text-bloomberg-red"
                  }`}
                  onClick={() => setExpandedCat(expandedCat === i ? null : i)}
                  title={cat.name}
                >
                  {cat.icon} {cat.score}/10
                </div>
              ))}
            </div>

            {/* Category cards */}
            <div className="space-y-1">
              {risk.categories.map((cat, i) => (
                <div key={i} className="border border-bloomberg-border/30">
                  <button
                    onClick={() => setExpandedCat(expandedCat === i ? null : i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-[12px] font-bold text-foreground flex-1">{cat.name}</span>
                    <span className={`text-[12px] font-bold ${scoreColor(cat.score)}`}>{cat.score}/10</span>
                    <div className="w-16 h-2 bg-bloomberg-bg border border-bloomberg-border/30 overflow-hidden">
                      <div
                        className={`h-full ${cat.score <= 3 ? "bg-bloomberg-green/60" : cat.score <= 6 ? "bg-bloomberg-amber/60" : "bg-bloomberg-red/60"}`}
                        style={{ width: `${cat.score * 10}%` }}
                      />
                    </div>
                    {expandedCat === i ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </button>

                  {expandedCat === i && (
                    <div className="px-3 pb-3 border-t border-bloomberg-border/20">
                      <div className="text-[13px] text-muted-foreground mt-2 mb-2">{cat.summary}</div>
                      {cat.items.length > 0 ? (
                        <div className="space-y-1.5">
                          {cat.items.map((item, j) => (
                            <div key={j} className={`border p-2 ${sevBg(item.severity)}`}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[13px] font-bold ${sevColor(item.severity)}`}>{sevLabel(item.severity)}</span>
                                <span className="text-[13px] font-bold text-foreground">{item.title}</span>
                                {item.metric && <span className="text-[12px] text-muted-foreground ml-auto font-mono">{item.metric}</span>}
                              </div>
                              <div className="text-[12px] text-muted-foreground leading-relaxed">{item.description}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[13px] text-bloomberg-green">Brak zidentyfikowanych istotnych ryzyk w tej kategorii.</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── POSITIVE FACTORS ── */}
          {risk.positiveFactors.length > 0 && (
            <div className="bg-bloomberg-green/5 border border-bloomberg-green/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-bloomberg-green" />
                <span className="text-[13px] font-bold text-bloomberg-green tracking-wider">CZYNNIKI POZYTYWNE</span>
              </div>
              <div className="space-y-1">
                {risk.positiveFactors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-bloomberg-green text-[12px] mt-0.5">✓</span>
                    <span className="text-[12px] text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── KEY METRICS ── */}
          <div className="bg-bloomberg-card border border-bloomberg-border p-4">
            <div className="text-[13px] font-bold text-bloomberg-amber tracking-wider mb-3">KLUCZOWE WSKAŹNIKI RYZYKA</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
              <MetricCard label="DEBT/EQUITY" value={s?.debtToEquity != null ? `${s.debtToEquity.toFixed(0)}%` : "N/A"} warn={s?.debtToEquity != null && s.debtToEquity > 150} />
              <MetricCard label="CURRENT RATIO" value={s?.currentRatio?.toFixed(2) ?? "N/A"} warn={s?.currentRatio != null && s.currentRatio < 1.0} />
              <MetricCard label="FCF" value={s?.freeCashFlow ? fmtBigValue(s.freeCashFlow, q.currency) : "N/A"} warn={s?.freeCashFlow != null && s.freeCashFlow < 0} />
              <MetricCard label="DŁUG CAŁKOWITY" value={s?.totalDebt ? fmtBigValue(s.totalDebt, q.currency) : "N/A"} warn={false} />
              <MetricCard label="GOTÓWKA" value={s?.totalCash ? fmtBigValue(s.totalCash, q.currency) : "N/A"} warn={false} />
              <MetricCard label="SHORT INTEREST" value={s?.shortPercentOfFloat != null ? `${(s.shortPercentOfFloat * 100).toFixed(1)}%` : "N/A"} warn={s?.shortPercentOfFloat != null && s.shortPercentOfFloat > 0.1} />
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function MetricCard({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className={`px-2 py-1.5 border ${warn ? "bg-bloomberg-red/10 border-bloomberg-red/20" : "bg-white/[0.02] border-bloomberg-border/50"}`}>
      <div className="text-muted-foreground text-[13px] mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${warn ? "text-bloomberg-red" : ""}`}>{value}</div>
    </div>
  )
}

function ProfileSummary({ text }: { text: string }) {
  const translated = useTranslatePL(text.slice(0, 500))
  return (
    <div className="text-[13px] text-muted-foreground leading-relaxed mt-2 pt-2 border-t border-bloomberg-border/30">
      {translated}
    </div>
  )
}
