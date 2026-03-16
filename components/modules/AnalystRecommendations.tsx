"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ScatterChart, Scatter, ZAxis } from "recharts"
import TerminalInput from "@/components/TerminalInput"
import MiniSparkline from "@/components/charts/MiniSparkline"
import { fmtPrice, fmtBigValue } from "@/lib/currency"
import type { QuoteData, AnalystData, RecommendationPeriod, EarningsForecast, AnalystUpgrade } from "@/lib/yahoo"

// ── Colors ───────────────────────────────────────────────────

const GREEN = "oklch(0.75 0.15 145)"
const DARK_GREEN = "oklch(0.55 0.15 145)"
const AMBER = "oklch(0.75 0.15 85)"
const ORANGE = "oklch(0.65 0.15 55)"
const RED = "oklch(0.55 0.2 25)"
const BLUE = "oklch(0.65 0.15 250)"
const GRAY = "oklch(0.5 0 0)"

// ── Helpers ──────────────────────────────────────────────────

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "N/A"
  return v.toFixed(decimals)
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "N/A"
  const s = (v * 100).toFixed(1) + "%"
  return v > 0 ? "+" + s : s
}

function fmtPctRaw(v: number | null | undefined): string {
  if (v == null) return "N/A"
  const s = v.toFixed(1) + "%"
  return v > 0 ? "+" + s : s
}

function growthColor(v: number | null | undefined): string {
  if (v == null) return "text-muted-foreground"
  return v >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"
}

function consensusColor(key: string | null): string {
  if (!key) return "text-muted-foreground"
  const k = key.toLowerCase()
  if (k.includes("strong_buy") || k.includes("strong buy")) return "text-bloomberg-green"
  if (k.includes("buy")) return "text-bloomberg-green"
  if (k.includes("hold")) return "text-bloomberg-amber"
  if (k.includes("sell")) return "text-bloomberg-red"
  return "text-muted-foreground"
}

function consensusBg(key: string | null): string {
  if (!key) return "border-bloomberg-border"
  const k = key.toLowerCase()
  if (k.includes("strong_buy") || k.includes("strong buy")) return "border-bloomberg-green bg-bloomberg-green/15"
  if (k.includes("buy")) return "border-bloomberg-green/60 bg-bloomberg-green/10"
  if (k.includes("hold")) return "border-bloomberg-amber bg-bloomberg-amber/10"
  if (k.includes("sell")) return "border-bloomberg-red bg-bloomberg-red/10"
  return "border-bloomberg-border"
}

function actionColor(action: string): string {
  const a = action.toLowerCase()
  if (a === "up" || a === "upgrade") return GREEN
  if (a === "down" || a === "downgrade") return RED
  if (a === "init") return BLUE
  return GRAY
}

function actionLabel(action: string): string {
  const a = action.toLowerCase()
  if (a === "up") return "Upgrade"
  if (a === "down") return "Downgrade"
  if (a === "main" || a === "reit") return "Maintain"
  if (a === "init") return "Initiate"
  return action
}

function periodLabel(period: string): string {
  if (period === "0m") return "Current"
  if (period === "-1m") return "1M Ago"
  if (period === "-2m") return "2M Ago"
  if (period === "-3m") return "3M Ago"
  if (period === "0q") return "Current Q"
  if (period === "+1q") return "Next Q"
  if (period === "0y") return "Current Y"
  if (period === "+1y") return "Next Y"
  return period
}

// ── Component ────────────────────────────────────────────────

export default function AnalystRecommendations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [analyst, setAnalyst] = useState<AnalystData | null>(null)

  async function handleSearch(ticker: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analyst?ticker=${encodeURIComponent(ticker)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setQuote(data.quote)
      setAnalyst(data.analyst)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch")
      setQuote(null)
      setAnalyst(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <TerminalInput
        placeholder="Enter ticker symbol (e.g. NVDA, AAPL, MSFT)"
        onSubmit={handleSearch}
        loading={loading}
        label="ANALYST>"
      />

      {error && (
        <div className="p-3 bg-bloomberg-red/10 border border-bloomberg-red/30 rounded text-bloomberg-red text-xs">
          {error}
        </div>
      )}

      {quote && analyst && (
        <div className="space-y-4">
          <QuoteHeader quote={quote} />
          <ConsensusOverview analyst={analyst} currency={quote.currency} />
          <RecommendationDistribution recs={analyst.recommendations} />
          <RecommendationTrend recs={analyst.recommendations} />
          <AnalystActionsTable upgrades={analyst.upgrades} currency={quote.currency} />
          <EarningsForecasts forecasts={analyst.forecasts} currency={quote.currency} />
          <EpsRevisionTrend forecasts={analyst.forecasts} />
          <PriceTargetDistribution upgrades={analyst.upgrades} currentPrice={analyst.currentPrice} currency={quote.currency} />
        </div>
      )}
    </div>
  )
}

// ── Section 1: Quote Header ──────────────────────────────────

function QuoteHeader({ quote }: { quote: QuoteData }) {
  const positive = quote.change >= 0
  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-bloomberg-green font-bold text-lg">{quote.symbol}</span>
          <span className="text-muted-foreground text-xs ml-2">{quote.name}</span>
          <span className="text-muted-foreground text-xs ml-2">| {quote.exchange}</span>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{fmtPrice(quote.price, quote.currency)}</div>
          <div className={`text-xs ${positive ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
            {positive ? "+" : ""}{quote.change.toFixed(2)} ({positive ? "+" : ""}{quote.changePercent.toFixed(2)}%)
          </div>
        </div>
      </div>
      <div className="flex gap-6 mt-2 text-xs text-muted-foreground">
        <span>Mkt Cap: <span className="text-foreground">{fmtBigValue(quote.marketCap, quote.currency)}</span></span>
        <span>Vol: <span className="text-foreground">{fmtBigValue(quote.volume, quote.currency).replace(/[$]|zł/g, "")}</span></span>
        <span>52W: <span className="text-foreground">{fmtPrice(quote.low52, quote.currency)} - {fmtPrice(quote.high52, quote.currency)}</span></span>
      </div>
    </div>
  )
}

// ── Section 2: Consensus Overview ────────────────────────────

function ConsensusOverview({ analyst, currency }: { analyst: AnalystData; currency: string }) {
  const { targetLow, targetHigh, targetMean, currentPrice, recommendationKey, recommendationMean, numberOfAnalysts } = analyst
  const displayKey = recommendationKey ? recommendationKey.replace(/_/g, " ").toUpperCase() : "N/A"

  // Price target bar calculations
  const lo = targetLow ?? currentPrice * 0.8
  const hi = targetHigh ?? currentPrice * 1.2
  const range = hi - lo || 1
  const currentPct = Math.min(100, Math.max(0, ((currentPrice - lo) / range) * 100))
  const meanPct = targetMean != null ? Math.min(100, Math.max(0, ((targetMean - lo) / range) * 100)) : null
  const upside = targetMean != null && currentPrice > 0 ? ((targetMean - currentPrice) / currentPrice) * 100 : null

  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded space-y-4">
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider mb-2">CONSENSUS OVERVIEW</div>

      <div className="flex items-center gap-6">
        {/* Large consensus badge */}
        <div className={`px-5 py-3 border-2 rounded ${consensusBg(recommendationKey)}`}>
          <div className={`text-2xl font-bold ${consensusColor(recommendationKey)}`}>{displayKey}</div>
        </div>

        <div className="space-y-1 text-xs">
          <div>
            <span className="text-muted-foreground">Consensus Score: </span>
            <span className="text-foreground font-bold">{fmt(recommendationMean, 1)}</span>
            <span className="text-muted-foreground"> / 5 (1=Strong Buy, 5=Strong Sell)</span>
          </div>
          <div>
            <span className="text-muted-foreground">Analysts: </span>
            <span className="text-foreground font-bold">{numberOfAnalysts}</span>
          </div>
          {upside != null && (
            <div>
              <span className="text-muted-foreground">Upside to Mean Target: </span>
              <span className={upside >= 0 ? "text-bloomberg-green font-bold" : "text-bloomberg-red font-bold"}>
                {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Price target range bar */}
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">PRICE TARGET RANGE</div>
        <div className="relative h-8 bg-bloomberg-bg border border-bloomberg-border rounded overflow-hidden">
          {/* Bar fill from low to high */}
          <div className="absolute inset-0 bg-bloomberg-green/10" />

          {/* Current price marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-bloomberg-amber z-10"
            style={{ left: `${currentPct}%` }}
          >
            <div className="absolute -top-5 -translate-x-1/2 text-[10px] text-bloomberg-amber whitespace-nowrap">
              Current: {fmtPrice(currentPrice, currency)}
            </div>
          </div>

          {/* Mean target marker */}
          {meanPct != null && targetMean != null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-bloomberg-green z-10"
              style={{ left: `${meanPct}%` }}
            >
              <div className="absolute -bottom-5 -translate-x-1/2 text-[10px] text-bloomberg-green whitespace-nowrap">
                Mean: {fmtPrice(targetMean, currency)}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>Low: {targetLow != null ? fmtPrice(targetLow, currency) : "N/A"}</span>
          <span>High: {targetHigh != null ? fmtPrice(targetHigh, currency) : "N/A"}</span>
        </div>
      </div>
    </div>
  )
}

// ── Section 3: Recommendation Distribution ───────────────────

function RecommendationDistribution({ recs }: { recs: RecommendationPeriod[] }) {
  const current = recs.find(r => r.period === "0m")
  if (!current) return null

  const total = current.strongBuy + current.buy + current.hold + current.sell + current.strongSell
  if (total === 0) return null

  const segments = [
    { label: "Strong Buy", value: current.strongBuy, color: DARK_GREEN },
    { label: "Buy", value: current.buy, color: GREEN },
    { label: "Hold", value: current.hold, color: AMBER },
    { label: "Sell", value: current.sell, color: ORANGE },
    { label: "Strong Sell", value: current.strongSell, color: RED },
  ].filter(s => s.value > 0)

  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded">
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider mb-3">RECOMMENDATION DISTRIBUTION (CURRENT)</div>

      {/* Stacked horizontal bar */}
      <div className="flex h-10 rounded overflow-hidden border border-bloomberg-border">
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100
          return (
            <div
              key={i}
              className="flex items-center justify-center text-xs font-bold text-black/80 min-w-[30px]"
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${seg.value}`}
            >
              {pct > 8 ? seg.value : ""}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-2 text-xs">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}:</span>
            <span className="text-foreground font-bold">{seg.value}</span>
          </div>
        ))}
        <div className="text-muted-foreground ml-auto">Total: {total}</div>
      </div>
    </div>
  )
}

// ── Section 4: Recommendation Trend ──────────────────────────

function RecommendationTrend({ recs }: { recs: RecommendationPeriod[] }) {
  if (recs.length === 0) return null

  // Sort: oldest first
  const sorted = [...recs].sort((a, b) => {
    const order: Record<string, number> = { "-3m": 0, "-2m": 1, "-1m": 2, "0m": 3 }
    return (order[a.period] ?? 0) - (order[b.period] ?? 0)
  })

  const data = sorted.map(r => ({
    period: periodLabel(r.period),
    strongBuy: r.strongBuy,
    buy: r.buy,
    hold: r.hold,
    sell: r.sell,
    strongSell: r.strongSell,
  }))

  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded">
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider mb-3">RECOMMENDATION TREND (4 MONTHS)</div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", fontSize: 11 }}
              labelStyle={{ color: "#888" }}
            />
            <Bar dataKey="strongBuy" stackId="a" fill={DARK_GREEN} name="Strong Buy" />
            <Bar dataKey="buy" stackId="a" fill={GREEN} name="Buy" />
            <Bar dataKey="hold" stackId="a" fill={AMBER} name="Hold" />
            <Bar dataKey="sell" stackId="a" fill={ORANGE} name="Sell" />
            <Bar dataKey="strongSell" stackId="a" fill={RED} name="Strong Sell" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Section 5: Analyst Actions Table ─────────────────────────

function AnalystActionsTable({ upgrades, currency }: { upgrades: AnalystUpgrade[]; currency: string }) {
  if (upgrades.length === 0) return null

  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded">
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider mb-3">RECENT ANALYST ACTIONS</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-bloomberg-border">
              <th className="text-left py-1.5 pr-3">Date</th>
              <th className="text-left py-1.5 pr-3">Firm</th>
              <th className="text-left py-1.5 pr-3">Action</th>
              <th className="text-left py-1.5 pr-3">Rating</th>
              <th className="text-right py-1.5 pr-3">Price Target</th>
              <th className="text-right py-1.5">Change</th>
            </tr>
          </thead>
          <tbody>
            {upgrades.map((u, i) => {
              const ptChange = u.currentPriceTarget != null && u.priorPriceTarget != null
                ? u.currentPriceTarget - u.priorPriceTarget
                : null
              return (
                <tr key={i} className="border-b border-bloomberg-border/50 hover:bg-bloomberg-bg/50">
                  <td className="py-1.5 pr-3 text-muted-foreground">{u.date}</td>
                  <td className="py-1.5 pr-3 text-foreground">{u.firm}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: actionColor(u.action) + "33", color: actionColor(u.action) }}
                    >
                      {actionLabel(u.action)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-foreground">
                    {u.fromGrade ? (
                      <span>
                        <span className="text-muted-foreground">{u.fromGrade}</span>
                        <span className="text-muted-foreground mx-1">&rarr;</span>
                        <span>{u.toGrade}</span>
                      </span>
                    ) : (
                      <span>{u.toGrade}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-foreground">
                    {u.currentPriceTarget != null ? fmtPrice(u.currentPriceTarget, currency) : "-"}
                  </td>
                  <td className="py-1.5 text-right">
                    {ptChange != null ? (
                      <span className={ptChange >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}>
                        {ptChange >= 0 ? "+" : ""}{fmtPrice(ptChange, currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
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

// ── Section 6: Earnings & Revenue Forecasts ──────────────────

function EarningsForecasts({ forecasts, currency }: { forecasts: EarningsForecast[]; currency: string }) {
  if (forecasts.length === 0) return null

  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded">
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider mb-3">EARNINGS & REVENUE FORECASTS</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-bloomberg-border">
              <th className="text-left py-1.5 pr-3">Period</th>
              <th className="text-right py-1.5 pr-3">EPS Low</th>
              <th className="text-right py-1.5 pr-3">EPS Avg</th>
              <th className="text-right py-1.5 pr-3">EPS High</th>
              <th className="text-right py-1.5 pr-3">EPS YoY</th>
              <th className="text-right py-1.5 pr-3">Rev Low</th>
              <th className="text-right py-1.5 pr-3">Rev Avg</th>
              <th className="text-right py-1.5 pr-3">Rev High</th>
              <th className="text-right py-1.5">Rev YoY</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((f, i) => {
              const epsGrowth = f.yearAgoEps != null && f.epsAvg != null && f.yearAgoEps !== 0
                ? ((f.epsAvg - f.yearAgoEps) / Math.abs(f.yearAgoEps)) * 100
                : null
              return (
                <tr key={i} className="border-b border-bloomberg-border/50">
                  <td className="py-1.5 pr-3 text-bloomberg-amber font-bold">
                    {periodLabel(f.period)}
                    {f.endDate && <span className="text-muted-foreground font-normal ml-1">({f.endDate})</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-foreground">{fmt(f.epsLow)}</td>
                  <td className="py-1.5 pr-3 text-right text-foreground font-bold">{fmt(f.epsAvg)}</td>
                  <td className="py-1.5 pr-3 text-right text-foreground">{fmt(f.epsHigh)}</td>
                  <td className={`py-1.5 pr-3 text-right font-bold ${growthColor(epsGrowth != null ? epsGrowth / 100 : null)}`}>
                    {epsGrowth != null ? fmtPctRaw(epsGrowth) : "N/A"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-foreground">{f.revLow != null ? fmtBigValue(f.revLow, currency) : "N/A"}</td>
                  <td className="py-1.5 pr-3 text-right text-foreground font-bold">{f.revAvg != null ? fmtBigValue(f.revAvg, currency) : "N/A"}</td>
                  <td className="py-1.5 pr-3 text-right text-foreground">{f.revHigh != null ? fmtBigValue(f.revHigh, currency) : "N/A"}</td>
                  <td className={`py-1.5 text-right font-bold ${growthColor(f.revGrowth)}`}>
                    {fmtPct(f.revGrowth)}
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

// ── Section 7: EPS Revision Trend ────────────────────────────

function EpsRevisionTrend({ forecasts }: { forecasts: EarningsForecast[] }) {
  if (forecasts.length === 0) return null

  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded">
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider mb-3">EPS REVISION TREND</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forecasts.map((f, i) => {
          const trend = f.epsTrend
          const sparkData = [trend.d90, trend.d60, trend.d30, trend.d7, trend.current].filter(
            (v): v is number => v != null
          )
          const rev = f.epsRevisions
          const trendUp = sparkData.length >= 2 && sparkData[sparkData.length - 1] > sparkData[0]
          const sparkColor = trendUp ? GREEN : RED

          return (
            <div key={i} className="p-3 bg-bloomberg-bg border border-bloomberg-border rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-bloomberg-amber font-bold">{periodLabel(f.period)}</span>
                {sparkData.length > 1 && (
                  <MiniSparkline data={sparkData} color={sparkColor} width={100} height={28} />
                )}
              </div>

              {/* EPS trend values */}
              <div className="grid grid-cols-5 gap-1 text-[10px] mb-2">
                {[
                  { label: "90d", val: trend.d90 },
                  { label: "60d", val: trend.d60 },
                  { label: "30d", val: trend.d30 },
                  { label: "7d", val: trend.d7 },
                  { label: "Now", val: trend.current },
                ].map((item, j) => (
                  <div key={j} className="text-center">
                    <div className="text-muted-foreground">{item.label}</div>
                    <div className="text-foreground">{item.val != null ? item.val.toFixed(2) : "-"}</div>
                  </div>
                ))}
              </div>

              {/* Revision counts */}
              <div className="flex gap-3 text-[10px]">
                <span className="text-muted-foreground">Revisions (30d):</span>
                <span className="px-1.5 py-0.5 rounded bg-bloomberg-green/20 text-bloomberg-green font-bold">
                  {rev.upLast30d} Up
                </span>
                <span className="px-1.5 py-0.5 rounded bg-bloomberg-red/20 text-bloomberg-red font-bold">
                  {rev.downLast30d} Down
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 8: Price Target Distribution ─────────────────────

function PriceTargetDistribution({ upgrades, currentPrice, currency }: { upgrades: AnalystUpgrade[]; currentPrice: number; currency: string }) {
  // Filter upgrades that have price targets
  const withTargets = upgrades.filter(u => u.currentPriceTarget != null)
  if (withTargets.length === 0) return null

  // Group by grade category
  type GradeCategory = "Buy" | "Hold" | "Sell" | "Other"
  function categorize(grade: string): GradeCategory {
    const g = grade.toLowerCase()
    if (g.includes("buy") || g.includes("outperform") || g.includes("overweight") || g.includes("positive") || g.includes("accumulate")) return "Buy"
    if (g.includes("hold") || g.includes("neutral") || g.includes("market perform") || g.includes("equal") || g.includes("peer") || g.includes("sector perform") || g.includes("in-line")) return "Hold"
    if (g.includes("sell") || g.includes("underperform") || g.includes("underweight") || g.includes("reduce") || g.includes("negative")) return "Sell"
    return "Other"
  }

  const categoryColor: Record<GradeCategory, string> = { Buy: GREEN, Hold: AMBER, Sell: RED, Other: GRAY }
  const categoryY: Record<GradeCategory, number> = { Buy: 3, Hold: 2, Sell: 1, Other: 0 }

  const scatterData = withTargets.map(u => ({
    x: u.currentPriceTarget!,
    y: categoryY[categorize(u.toGrade)],
    z: 80,
    firm: u.firm,
    grade: u.toGrade,
    category: categorize(u.toGrade),
  }))

  // Group for rendering
  const groups: Record<GradeCategory, typeof scatterData> = { Buy: [], Hold: [], Sell: [], Other: [] }
  scatterData.forEach(d => groups[d.category].push(d))

  return (
    <div className="p-4 bg-bloomberg-card border border-bloomberg-border rounded">
      <div className="text-xs text-bloomberg-amber font-bold tracking-wider mb-3">PRICE TARGET DISTRIBUTION</div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
            <XAxis
              type="number"
              dataKey="x"
              tick={{ fill: "#888", fontSize: 10 }}
              axisLine={{ stroke: "#333" }}
              tickLine={false}
              domain={["dataMin - 10", "dataMax + 10"]}
              name="Price Target"
            />
            <YAxis
              type="number"
              dataKey="y"
              tick={false}
              axisLine={false}
              tickLine={false}
              domain={[-0.5, 3.5]}
              width={10}
            />
            <ZAxis type="number" dataKey="z" range={[40, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", fontSize: 11 }}
              /* eslint-disable @typescript-eslint/no-explicit-any */
              formatter={(_val: any, _name: any, props: any) => {
                const p = props?.payload
                if (!p) return ""
                return [`${p.firm}: ${p.grade} - ${p.x != null ? fmtPrice(p.x, currency) : ""}`, ""]
              }}
              labelFormatter={() => ""}
            />
            <ReferenceLine x={currentPrice} stroke={AMBER} strokeDasharray="5 5" label={{ value: "Current", fill: AMBER, fontSize: 10, position: "top" }} />
            {(["Buy", "Hold", "Sell", "Other"] as GradeCategory[]).map(cat => (
              groups[cat].length > 0 && (
                <Scatter key={cat} name={cat} data={groups[cat]} fill={categoryColor[cat]}>
                  {groups[cat].map((_, idx) => (
                    <Cell key={idx} fill={categoryColor[cat]} />
                  ))}
                </Scatter>
              )
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs">
        {(["Buy", "Hold", "Sell"] as GradeCategory[]).map(cat => (
          groups[cat].length > 0 && (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColor[cat] }} />
              <span className="text-muted-foreground">{cat} ({groups[cat].length})</span>
            </div>
          )
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-6 h-0.5" style={{ backgroundColor: AMBER, opacity: 0.7 }} />
          <span className="text-muted-foreground">Current Price ({fmtPrice(currentPrice, currency)})</span>
        </div>
      </div>
    </div>
  )
}
