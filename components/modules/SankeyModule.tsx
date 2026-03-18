"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Loader2, Search } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import { getTabCache, setTabCache, CACHE_KEYS } from "@/lib/tabCache"

// ── Types ────────────────────────────────────────────────────

interface SankeySegment {
  name: string
  revenue: number
  pctOfTotal: number
  yoyChange: number | null
}

interface SankeyCosts {
  costOfRevenue: number | null
  grossProfit: number | null
  researchAndDevelopment: number | null
  sellingAndMarketing: number | null
  generalAndAdmin: number | null
  depreciationAmortization: number | null
  otherOpex: number | null
  operatingIncome: number | null
  interestExpense: number | null
  interestIncome: number | null
  otherNonOperating: number | null
  incomeTax: number | null
  netIncome: number | null
}

interface SankeyYearData {
  year: number
  date: string
  revenue: number
  segments: SankeySegment[]
  costs: SankeyCosts
  margins: { gross: number | null; operating: number | null; net: number | null }
}

interface SankeyResponse {
  ticker: string
  companyName: string
  years: SankeyYearData[]
  availableYears: number[]
  hasSegments: boolean
}

const LS_KEY = "bloomberg_last_ticker_sankey"

// ── Helpers ──────────────────────────────────────────────────

function fmt(v: number, c = "$"): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1e12) return `${sign}${c}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}${c}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${c}${(abs / 1e6).toFixed(0)}M`
  return `${sign}${c}${(abs / 1e3).toFixed(0)}K`
}

function yoy(v: number | null): string {
  if (v == null || !isFinite(v)) return ""
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}% Y/Y`
}

const G = "#22c55e"
const GD = "rgba(34,197,94,0.15)"
const R = "#ef4444"
const RD = "rgba(239,68,68,0.12)"
const GRAY = "#6b7280"

// ── SVG Components ───────────────────────────────────────────

function SLink({ x1, y1, h1, x2, y2, h2, color }: {
  x1: number; y1: number; h1: number; x2: number; y2: number; h2: number; color: string
}) {
  const cx1 = x1 + (x2 - x1) * 0.35
  const cx2 = x1 + (x2 - x1) * 0.65
  return <path d={`M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2} L${x2},${y2 + h2} C${cx2},${y2 + h2} ${cx1},${y1 + h1} ${x1},${y1 + h1} Z`} fill={color} opacity={0.55} />
}

function NBlock({ x, y, w, h: nodeH, label, value, color, yoyVal, sub, align = "right", c = "$", fontSize = 12 }: {
  x: number; y: number; w: number; h: number; label: string; value: number | null
  color: string; yoyVal?: number | null; sub?: string; align?: "left" | "right"; c?: string; fontSize?: number
}) {
  if (value == null) return null
  const tx = align === "right" ? x + w + 8 : x - 8
  const anchor = align === "right" ? "start" : "end"
  const hh = Math.max(nodeH, 4)
  const fs = fontSize
  const lineH = fs + 2

  return (
    <g>
      <rect x={x} y={y} width={w} height={hh} rx={2} fill={color} />
      <text x={tx} y={y + Math.min(hh / 2, 20) - 1} textAnchor={anchor}
        fill="#f3f4f6" fontSize={fs} fontWeight="bold" fontFamily="monospace">
        {label}
      </text>
      <text x={tx} y={y + Math.min(hh / 2, 20) + lineH - 1} textAnchor={anchor}
        fill="#9ca3af" fontSize={fs - 1} fontFamily="monospace">
        {fmt(value, c)}
      </text>
      {yoyVal != null && (
        <text x={tx} y={y + Math.min(hh / 2, 20) + lineH * 2 - 1} textAnchor={anchor}
          fill={yoyVal >= 0 ? G : R} fontSize={fs - 2} fontFamily="monospace">
          {yoy(yoyVal)}
        </text>
      )}
      {sub && (
        <text x={tx} y={y + Math.min(hh / 2, 20) + lineH * (yoyVal != null ? 3 : 2) - 1} textAnchor={anchor}
          fill="#6b7280" fontSize={fs - 3} fontFamily="monospace">
          {sub}
        </text>
      )}
    </g>
  )
}

// ── Full Sankey Chart ────────────────────────────────────────

function FullSankeyChart({ data, currency }: { data: SankeyYearData; currency: string }) {
  const hasSeg = data.segments.length > 0
  const segN = data.segments.length

  // Dynamic sizing — large and clear
  const W = hasSeg ? 1400 : 1000
  const rowH = 55
  const H = Math.max(600, hasSeg ? segN * rowH + 80 : 600)
  const NW = 16

  // Columns with more spacing
  const cols = hasSeg
    ? [160, 420, 680, 940, 1200]
    : [140, 380, 620, 860]

  const ci = hasSeg ? { rev: 1, gp: 2, op: 3, ni: 4 } : { rev: 0, gp: 1, op: 2, ni: 3 }

  const pad = 30
  const totalH = H - pad * 2
  const rev = data.revenue
  const pct = (v: number | null) => v != null && rev > 0 ? Math.max(v / rev, 0) : 0
  const h = (v: number | null, min = 8) => Math.max(pct(v) * totalH, v != null && v > 0 ? min : 0)
  const c = data.costs

  // Revenue bar
  const revY = pad
  const revH = totalH

  // Segments
  const segHeights = data.segments.map(s => Math.max((s.revenue / rev) * totalH, 28))
  const segTotalH = segHeights.reduce((a, b) => a + b, 0)
  const segGap = segHeights.length > 1 ? Math.min(5, (totalH - segTotalH) / Math.max(segHeights.length - 1, 1)) : 0
  const segStartY = pad + Math.max(0, (totalH - segTotalH - segGap * Math.max(segHeights.length - 1, 0)) / 2)

  // GP column
  const cogsH = h(c.costOfRevenue)
  const gpH = c.grossProfit != null ? totalH - cogsH : 0
  const cogsY = revY
  const gpY = cogsY + cogsH

  // OP column
  const smH = h(c.sellingAndMarketing)
  const rdH = h(c.researchAndDevelopment)
  const gaH = h(c.generalAndAdmin)
  const daH = h(c.depreciationAmortization)
  const otherOpH = h(c.otherOpex)
  const opExH = smH + rdH + gaH + daH + otherOpH
  const opIncH = c.operatingIncome != null && c.operatingIncome > 0 ? Math.max(gpH - opExH, 12) : 0

  let ey = gpY
  const smY = ey; ey += smH
  const rdY = ey; ey += rdH
  const gaY = ey; ey += gaH
  const daY = ey; ey += daH
  const otherOpY = ey; ey += otherOpH
  const opIncY = ey

  // NI column
  const taxH = h(c.incomeTax)
  const intH = h(c.interestExpense)
  const otherNonH = h(c.otherNonOperating != null ? Math.abs(c.otherNonOperating) : null)
  const deductH = taxH + intH + otherNonH
  const niH = c.netIncome != null && c.netIncome > 0 ? Math.max(opIncH - deductH, 12) : 0
  const taxY = opIncY
  const intY = taxY + taxH
  const otherNonY = intY + intH
  const niY = otherNonY + otherNonH

  const fs = 13

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: "85vh" }}>
      {/* ═══ SEGMENT → REVENUE links ═══ */}
      {hasSeg && (() => {
        let sy = segStartY
        let cumRev = 0
        return data.segments.map((seg, i) => {
          const sH = segHeights[i]
          const sY = sy
          sy += sH + segGap
          const revTargetY = revY + (cumRev / rev) * totalH
          const revSliceH = (seg.revenue / rev) * totalH
          cumRev += seg.revenue
          return (
            <g key={i}>
              <SLink x1={cols[0] + NW} y1={sY} h1={sH} x2={cols[ci.rev]} y2={revTargetY} h2={revSliceH} color="rgba(156,163,175,0.12)" />
              <NBlock x={cols[0]} y={sY} w={NW} h={sH}
                label={seg.name} value={seg.revenue} color={GRAY}
                yoyVal={seg.yoyChange} sub={`${seg.pctOfTotal.toFixed(0)}% of rev`}
                align="left" c={currency} fontSize={fs} />
            </g>
          )
        })
      })()}

      {/* Revenue → COGS + GP */}
      {c.costOfRevenue != null && c.costOfRevenue > 0 && (
        <SLink x1={cols[ci.rev] + NW} y1={revY} h1={cogsH} x2={cols[ci.gp]} y2={cogsY} h2={cogsH} color={RD} />
      )}
      {c.grossProfit != null && c.grossProfit > 0 && (
        <SLink x1={cols[ci.rev] + NW} y1={revY + cogsH} h1={gpH} x2={cols[ci.gp]} y2={gpY} h2={gpH} color={GD} />
      )}

      {/* GP → OpEx + OP */}
      {c.sellingAndMarketing != null && c.sellingAndMarketing > 0 && (
        <SLink x1={cols[ci.gp] + NW} y1={gpY} h1={smH} x2={cols[ci.op]} y2={smY} h2={smH} color={RD} />
      )}
      {c.researchAndDevelopment != null && c.researchAndDevelopment > 0 && (
        <SLink x1={cols[ci.gp] + NW} y1={gpY + smH} h1={rdH} x2={cols[ci.op]} y2={rdY} h2={rdH} color={RD} />
      )}
      {c.generalAndAdmin != null && c.generalAndAdmin > 0 && (
        <SLink x1={cols[ci.gp] + NW} y1={gpY + smH + rdH} h1={gaH} x2={cols[ci.op]} y2={gaY} h2={gaH} color={RD} />
      )}
      {c.depreciationAmortization != null && c.depreciationAmortization > 0 && (
        <SLink x1={cols[ci.gp] + NW} y1={gpY + smH + rdH + gaH} h1={daH} x2={cols[ci.op]} y2={daY} h2={daH} color={RD} />
      )}
      {c.otherOpex != null && c.otherOpex > 0 && (
        <SLink x1={cols[ci.gp] + NW} y1={gpY + smH + rdH + gaH + daH} h1={otherOpH} x2={cols[ci.op]} y2={otherOpY} h2={otherOpH} color={RD} />
      )}
      {c.operatingIncome != null && c.operatingIncome > 0 && (
        <SLink x1={cols[ci.gp] + NW} y1={gpY + opExH} h1={opIncH} x2={cols[ci.op]} y2={opIncY} h2={opIncH} color={GD} />
      )}

      {/* OP → Tax + Interest + NI */}
      {c.incomeTax != null && c.incomeTax > 0 && (
        <SLink x1={cols[ci.op] + NW} y1={opIncY} h1={taxH} x2={cols[ci.ni]} y2={taxY} h2={taxH} color={RD} />
      )}
      {c.interestExpense != null && c.interestExpense > 0 && (
        <SLink x1={cols[ci.op] + NW} y1={opIncY + taxH} h1={intH} x2={cols[ci.ni]} y2={intY} h2={intH} color={RD} />
      )}
      {c.otherNonOperating != null && Math.abs(c.otherNonOperating) > 0 && (
        <SLink x1={cols[ci.op] + NW} y1={opIncY + taxH + intH} h1={otherNonH} x2={cols[ci.ni]} y2={otherNonY} h2={otherNonH}
          color={c.otherNonOperating > 0 ? GD : RD} />
      )}
      {c.netIncome != null && c.netIncome > 0 && (
        <SLink x1={cols[ci.op] + NW} y1={opIncY + deductH} h1={niH} x2={cols[ci.ni]} y2={niY} h2={niH} color={GD} />
      )}

      {/* ═══ NODES ═══ */}
      <NBlock x={cols[ci.rev]} y={revY} w={NW} h={revH} label="Revenue" value={rev} color={GRAY}
        align={hasSeg ? "right" : "left"} c={currency} fontSize={fs + 1} />

      <NBlock x={cols[ci.gp]} y={cogsY} w={NW} h={cogsH} label="Cost of Revenue" value={c.costOfRevenue} color={R}
        align="right" c={currency} fontSize={fs} />
      <NBlock x={cols[ci.gp]} y={gpY} w={NW} h={gpH} label="Gross Profit" value={c.grossProfit} color={G}
        sub={data.margins.gross != null ? `${data.margins.gross.toFixed(1)}% margin` : undefined}
        align="right" c={currency} fontSize={fs} />

      <NBlock x={cols[ci.op]} y={smY} w={NW} h={smH} label="S&M" value={c.sellingAndMarketing} color={R} align="right" c={currency} fontSize={fs} />
      <NBlock x={cols[ci.op]} y={rdY} w={NW} h={rdH} label="R&D" value={c.researchAndDevelopment} color={R} align="right" c={currency} fontSize={fs} />
      <NBlock x={cols[ci.op]} y={gaY} w={NW} h={gaH} label="G&A" value={c.generalAndAdmin} color={R} align="right" c={currency} fontSize={fs} />
      <NBlock x={cols[ci.op]} y={daY} w={NW} h={daH} label="D&A" value={c.depreciationAmortization} color="#b45309" align="right" c={currency} fontSize={fs} />
      <NBlock x={cols[ci.op]} y={otherOpY} w={NW} h={otherOpH} label="Other OpEx" value={c.otherOpex} color="#991b1b" align="right" c={currency} fontSize={fs} />
      <NBlock x={cols[ci.op]} y={opIncY} w={NW} h={opIncH} label="Operating Profit" value={c.operatingIncome} color={G}
        sub={data.margins.operating != null ? `${data.margins.operating.toFixed(1)}% margin` : undefined}
        align="right" c={currency} fontSize={fs} />

      <NBlock x={cols[ci.ni]} y={taxY} w={NW} h={taxH} label="Tax" value={c.incomeTax} color={R} align="right" c={currency} fontSize={fs} />
      <NBlock x={cols[ci.ni]} y={intY} w={NW} h={intH} label="Interest" value={c.interestExpense} color="#dc2626" align="right" c={currency} fontSize={fs} />
      {c.otherNonOperating != null && Math.abs(c.otherNonOperating) > 0 && (
        <NBlock x={cols[ci.ni]} y={otherNonY} w={NW} h={otherNonH}
          label={c.otherNonOperating > 0 ? "Other Income" : "Other Expense"}
          value={Math.abs(c.otherNonOperating)} color={c.otherNonOperating > 0 ? G : "#7c2d12"}
          align="right" c={currency} fontSize={fs} />
      )}
      <NBlock x={cols[ci.ni]} y={niY} w={NW} h={niH} label="Net Profit" value={c.netIncome} color={G}
        sub={data.margins.net != null ? `${data.margins.net.toFixed(1)}% margin` : undefined}
        align="right" c={currency} fontSize={fs + 1} />
    </svg>
  )
}

// ── Module Component ─────────────────────────────────────────

export default function SankeyModule() {
  const [data, setData] = useState<SankeyResponse | null>(() => getTabCache<SankeyResponse>("sankey_data"))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const didAutoLoad = useRef(false)

  const handleFetch = useCallback(async (ticker?: string) => {
    const t = ticker?.trim().toUpperCase()
    if (!t) return
    localStorage.setItem(LS_KEY, t)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/sankey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setData(d)
      setTabCache("sankey_data", d)
      if (d.availableYears?.length) setSelectedYear(d.availableYears[0])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-load
  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    if (data?.availableYears?.length) {
      setSelectedYear(data.availableYears[0])
      return
    }
    const saved = localStorage.getItem(LS_KEY)
    if (saved) handleFetch(saved)
  }, [handleFetch, data])

  const yearData = useMemo(() => {
    if (!data || !selectedYear) return null
    return data.years.find(y => y.year === selectedYear) ?? null
  }, [data, selectedYear])

  return (
    <div className="font-mono space-y-3">
      {/* Input */}
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
        <TerminalInput
          label="SANKEY CHART"
          placeholder="Wpisz ticker (np. MSFT, AAPL, NVDA)"
          onSubmit={handleFetch}
          defaultValue={localStorage.getItem(LS_KEY) ?? ""}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-bloomberg-amber" />
          <span className="text-muted-foreground text-sm">Pobieranie danych segmentowych...</span>
        </div>
      )}

      {error && (
        <div className="bg-bloomberg-card border border-bloomberg-red/30 rounded p-4 text-center text-bloomberg-red text-sm">{error}</div>
      )}

      {!loading && data && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded">
          {/* Header with year selector */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-bloomberg-border flex-wrap">
            <div>
              <div className="text-bloomberg-amber font-bold text-base tracking-wider">SANKEY FLOW CHART</div>
              <div className="text-muted-foreground text-xs">{data.companyName} ({data.ticker})</div>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {data.availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                    selectedYear === yr
                      ? "bg-bloomberg-amber/20 text-bloomberg-amber border-bloomberg-amber/50"
                      : "border-bloomberg-border/50 text-muted-foreground hover:border-bloomberg-amber/30 hover:text-bloomberg-amber/70"
                  }`}
                >
                  FY{yr}
                </button>
              ))}
            </div>
          </div>

          {/* Margins bar */}
          {yearData && (
            <div className="flex items-center gap-6 px-4 py-2 border-b border-bloomberg-border/50 bg-bloomberg-bg/50">
              {yearData.margins.gross != null && (
                <div className="text-xs text-muted-foreground">
                  Marza brutto: <span className="text-bloomberg-green font-bold text-sm">{yearData.margins.gross.toFixed(1)}%</span>
                </div>
              )}
              {yearData.margins.operating != null && (
                <div className="text-xs text-muted-foreground">
                  Marza operacyjna: <span className={`font-bold text-sm ${yearData.margins.operating >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                    {yearData.margins.operating.toFixed(1)}%
                  </span>
                </div>
              )}
              {yearData.margins.net != null && (
                <div className="text-xs text-muted-foreground">
                  Marza netto: <span className={`font-bold text-sm ${yearData.margins.net >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                    {yearData.margins.net.toFixed(1)}%
                  </span>
                </div>
              )}
              {yearData.segments.length > 0 && (
                <div className="text-[10px] text-purple-400 ml-auto font-bold">
                  {yearData.segments.length} segmentow przychodowych | FMP data
                </div>
              )}
            </div>
          )}

          {/* Chart — full width */}
          {yearData && (
            <div className="p-4 overflow-x-auto">
              <FullSankeyChart data={yearData} currency="$" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
