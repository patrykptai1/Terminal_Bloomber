"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Loader2 } from "lucide-react"

// ── Types (mirror API) ───────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────

function fmt(v: number, currency = "$"): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1e12) return `${sign}${currency}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${sign}${currency}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}${currency}${(abs / 1e6).toFixed(0)}M`
  return `${sign}${currency}${(abs / 1e3).toFixed(0)}K`
}

function yoyStr(v: number | null): string {
  if (v == null || !isFinite(v)) return ""
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}% Y/Y`
}

const GREEN = "#22c55e"
const GREEN_DIM = "rgba(34,197,94,0.12)"
const RED = "#ef4444"
const RED_DIM = "rgba(239,68,68,0.12)"
const GRAY = "#6b7280"
const AMBER = "#f59e0b"

// ── SVG Sankey Link (bezier curve) ───────────────────────────

function SLink({ x1, y1, h1, x2, y2, h2, color }: {
  x1: number; y1: number; h1: number; x2: number; y2: number; h2: number; color: string
}) {
  const cx1 = x1 + (x2 - x1) * 0.4
  const cx2 = x1 + (x2 - x1) * 0.6
  const d = `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2} L${x2},${y2 + h2} C${cx2},${y2 + h2} ${cx1},${y1 + h1} ${x1},${y1 + h1} Z`
  return <path d={d} fill={color} opacity={0.6} />
}

// ── SVG Node Block ───────────────────────────────────────────

function NBlock({ x, y, w, h, label, value, color, yoy, sub, align = "right", currency = "$" }: {
  x: number; y: number; w: number; h: number; label: string; value: number | null
  color: string; yoy?: number | null; sub?: string; align?: "left" | "right"; currency?: string
}) {
  if (value == null || (value === 0 && !label)) return null
  const tx = align === "right" ? x + w + 5 : x - 5
  const anchor = align === "right" ? "start" : "end"
  const hh = Math.max(h, 3)

  return (
    <g>
      <rect x={x} y={y} width={w} height={hh} rx={1.5} fill={color} />
      <text x={tx} y={y + hh / 2 - 7} textAnchor={anchor} fill="#e5e7eb" fontSize={10} fontWeight="bold" fontFamily="monospace">
        {label}
      </text>
      <text x={tx} y={y + hh / 2 + 4} textAnchor={anchor} fill="#9ca3af" fontSize={9} fontFamily="monospace">
        {fmt(value, currency)}
      </text>
      {yoy != null && (
        <text x={tx} y={y + hh / 2 + 14} textAnchor={anchor} fill={yoy >= 0 ? GREEN : RED} fontSize={8} fontFamily="monospace">
          {yoyStr(yoy)}
        </text>
      )}
      {sub && (
        <text x={tx} y={y + hh / 2 + (yoy != null ? 24 : 14)} textAnchor={anchor} fill="#6b7280" fontSize={8} fontFamily="monospace">
          {sub}
        </text>
      )}
    </g>
  )
}

// ── Main Sankey Renderer ─────────────────────────────────────

function SankeyChart({ data, currency }: { data: SankeyYearData; currency: string }) {
  const hasSegments = data.segments.length > 0

  // Layout dimensions
  const W = hasSegments ? 1100 : 900
  const segCount = Math.max(data.segments.length, 1)
  const H = Math.max(480, segCount * 42 + 60)
  const NW = 12 // node width

  // Columns
  const cols = hasSegments
    ? [100, 320, 520, 720, 920] // segments, revenue, GP/COGS, OP/OpEx, NI/Tax
    : [100, 340, 560, 780]       // revenue, GP/COGS, OP/OpEx, NI/Tax

  const colRevenue = hasSegments ? 1 : 0
  const colGP = hasSegments ? 2 : 1
  const colOP = hasSegments ? 3 : 2
  const colNI = hasSegments ? 4 : 3

  const topPad = 20
  const totalH = H - topPad * 2

  const rev = data.revenue
  const pct = (v: number | null) => v != null && rev > 0 ? Math.max(v / rev, 0) : 0
  const h = (v: number | null, minH = 6) => Math.max(pct(v) * totalH, v != null && v > 0 ? minH : 0)

  const c = data.costs

  // ── Y positions ────────────────────────────────────────

  // Revenue bar
  const revY = topPad
  const revH = totalH

  // Segments (left of revenue)
  const segHeights = data.segments.map(s => Math.max((s.revenue / rev) * totalH, 20))
  const segTotalH = segHeights.reduce((a, b) => a + b, 0)
  const segGap = segHeights.length > 1
    ? Math.min(4, (totalH - segTotalH) / (segHeights.length - 1))
    : 0
  const segStartY = topPad + (totalH - segTotalH - segGap * (segHeights.length - 1)) / 2

  // GP column: COGS (top/red) + Gross Profit (bottom/green)
  const cogsH = h(c.costOfRevenue)
  const gpH = c.grossProfit != null ? totalH - cogsH : 0
  const cogsY = revY
  const gpY = cogsY + cogsH

  // OP column: OpEx items (top/red) + Operating Income (bottom/green)
  const rdH = h(c.researchAndDevelopment)
  const smH = h(c.sellingAndMarketing)
  const gaH = h(c.generalAndAdmin)
  const daH = h(c.depreciationAmortization)
  const otherOpH = h(c.otherOpex)
  const opExTotalH = rdH + smH + gaH + daH + otherOpH
  const opIncH = c.operatingIncome != null && c.operatingIncome > 0
    ? Math.max(gpH - opExTotalH, 8) : 0

  let opExY = gpY
  const smY = opExY; opExY += smH
  const rdY = opExY; opExY += rdH
  const gaY = opExY; opExY += gaH
  const daY = opExY; opExY += daH
  const otherOpY = opExY; opExY += otherOpH
  const opIncY = opExY

  // NI column: Tax + Interest + Other (top/red) + Net Income (bottom/green)
  const taxH = h(c.incomeTax)
  const intH = h(c.interestExpense)
  const otherNonOpH = h(c.otherNonOperating != null ? Math.abs(c.otherNonOperating) : null)
  const otherIncH = h(c.interestIncome)
  const deductionsH = taxH + intH + otherNonOpH
  const niH = c.netIncome != null && c.netIncome > 0
    ? Math.max(opIncH - deductionsH + otherIncH, 8) : 0

  const taxY = opIncY
  const intY = taxY + taxH
  const otherNonOpY = intY + intH
  const niY = otherNonOpY + otherNonOpH

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* ═══ SEGMENT LINKS (left → revenue) ═══ */}
      {hasSegments && (() => {
        let segY = segStartY
        return data.segments.map((seg, i) => {
          const sH = segHeights[i]
          const y = segY
          segY += sH + segGap
          // Map to revenue bar proportionally
          const revSliceStart = revY + (seg.revenue / rev) * totalH * (i > 0 ? data.segments.slice(0, i).reduce((a, s) => a + s.revenue, 0) / rev : 0)
          const revSliceH = (seg.revenue / rev) * totalH

          // Calculate cumulative Y offset on revenue bar
          let cumRev = 0
          for (let j = 0; j < i; j++) cumRev += data.segments[j].revenue
          const revTargetY = revY + (cumRev / rev) * totalH

          return (
            <g key={i}>
              <SLink x1={cols[0] + NW} y1={y} h1={sH} x2={cols[colRevenue]} y2={revTargetY} h2={revSliceH}
                color="rgba(156,163,175,0.15)" />
              <NBlock x={cols[0]} y={y} w={NW} h={sH}
                label={seg.name} value={seg.revenue} color={GRAY}
                yoy={seg.yoyChange}
                sub={`${seg.pctOfTotal.toFixed(0)}%`}
                align="left" currency={currency} />
            </g>
          )
        })
      })()}

      {/* ═══ REVENUE → COGS + GP ═══ */}
      {c.costOfRevenue != null && c.costOfRevenue > 0 && (
        <SLink x1={cols[colRevenue] + NW} y1={revY} h1={cogsH} x2={cols[colGP]} y2={cogsY} h2={cogsH} color={RED_DIM} />
      )}
      {c.grossProfit != null && c.grossProfit > 0 && (
        <SLink x1={cols[colRevenue] + NW} y1={revY + cogsH} h1={gpH} x2={cols[colGP]} y2={gpY} h2={gpH} color={GREEN_DIM} />
      )}

      {/* ═══ GP → OpEx items + Operating Income ═══ */}
      {c.sellingAndMarketing != null && c.sellingAndMarketing > 0 && (
        <SLink x1={cols[colGP] + NW} y1={gpY} h1={smH} x2={cols[colOP]} y2={smY} h2={smH} color={RED_DIM} />
      )}
      {c.researchAndDevelopment != null && c.researchAndDevelopment > 0 && (
        <SLink x1={cols[colGP] + NW} y1={gpY + smH} h1={rdH} x2={cols[colOP]} y2={rdY} h2={rdH} color={RED_DIM} />
      )}
      {c.generalAndAdmin != null && c.generalAndAdmin > 0 && (
        <SLink x1={cols[colGP] + NW} y1={gpY + smH + rdH} h1={gaH} x2={cols[colOP]} y2={gaY} h2={gaH} color={RED_DIM} />
      )}
      {c.depreciationAmortization != null && c.depreciationAmortization > 0 && (
        <SLink x1={cols[colGP] + NW} y1={gpY + smH + rdH + gaH} h1={daH} x2={cols[colOP]} y2={daY} h2={daH} color={RED_DIM} />
      )}
      {c.otherOpex != null && c.otherOpex > 0 && (
        <SLink x1={cols[colGP] + NW} y1={gpY + smH + rdH + gaH + daH} h1={otherOpH} x2={cols[colOP]} y2={otherOpY} h2={otherOpH} color={RED_DIM} />
      )}
      {c.operatingIncome != null && c.operatingIncome > 0 && (
        <SLink x1={cols[colGP] + NW} y1={gpY + opExTotalH} h1={opIncH} x2={cols[colOP]} y2={opIncY} h2={opIncH} color={GREEN_DIM} />
      )}

      {/* ═══ OP → Tax + Interest + Net Income ═══ */}
      {c.incomeTax != null && c.incomeTax > 0 && (
        <SLink x1={cols[colOP] + NW} y1={opIncY} h1={taxH} x2={cols[colNI]} y2={taxY} h2={taxH} color={RED_DIM} />
      )}
      {c.interestExpense != null && c.interestExpense > 0 && (
        <SLink x1={cols[colOP] + NW} y1={opIncY + taxH} h1={intH} x2={cols[colNI]} y2={intY} h2={intH} color={RED_DIM} />
      )}
      {c.otherNonOperating != null && Math.abs(c.otherNonOperating) > 0 && (
        <SLink x1={cols[colOP] + NW} y1={opIncY + taxH + intH} h1={otherNonOpH} x2={cols[colNI]} y2={otherNonOpY} h2={otherNonOpH}
          color={c.otherNonOperating > 0 ? GREEN_DIM : RED_DIM} />
      )}
      {c.netIncome != null && c.netIncome > 0 && (
        <SLink x1={cols[colOP] + NW} y1={opIncY + deductionsH} h1={niH} x2={cols[colNI]} y2={niY} h2={niH} color={GREEN_DIM} />
      )}

      {/* ═══ NODES ═══ */}

      {/* Revenue */}
      <NBlock x={cols[colRevenue]} y={revY} w={NW} h={revH}
        label="Revenue" value={rev} color={GRAY} align={hasSegments ? "right" : "left"} currency={currency} />

      {/* COGS */}
      <NBlock x={cols[colGP]} y={cogsY} w={NW} h={cogsH}
        label="Cost of Revenue" value={c.costOfRevenue} color={RED} align="right" currency={currency} />

      {/* Gross Profit */}
      <NBlock x={cols[colGP]} y={gpY} w={NW} h={gpH}
        label="Gross Profit" value={c.grossProfit} color={GREEN}
        sub={data.margins.gross != null ? `${data.margins.gross.toFixed(0)}% margin` : undefined}
        align="right" currency={currency} />

      {/* S&M */}
      <NBlock x={cols[colOP]} y={smY} w={NW} h={smH}
        label="S&M" value={c.sellingAndMarketing} color={RED} align="right" currency={currency} />

      {/* R&D */}
      <NBlock x={cols[colOP]} y={rdY} w={NW} h={rdH}
        label="R&D" value={c.researchAndDevelopment} color={RED} align="right" currency={currency} />

      {/* G&A */}
      <NBlock x={cols[colOP]} y={gaY} w={NW} h={gaH}
        label="G&A" value={c.generalAndAdmin} color={RED} align="right" currency={currency} />

      {/* D&A */}
      <NBlock x={cols[colOP]} y={daY} w={NW} h={daH}
        label="D&A" value={c.depreciationAmortization} color="#b45309" align="right" currency={currency} />

      {/* Other OpEx */}
      <NBlock x={cols[colOP]} y={otherOpY} w={NW} h={otherOpH}
        label="Other OpEx" value={c.otherOpex} color="#991b1b" align="right" currency={currency} />

      {/* Operating Income */}
      <NBlock x={cols[colOP]} y={opIncY} w={NW} h={opIncH}
        label="Operating Profit" value={c.operatingIncome} color={GREEN}
        sub={data.margins.operating != null ? `${data.margins.operating.toFixed(0)}% margin` : undefined}
        align="right" currency={currency} />

      {/* Tax */}
      <NBlock x={cols[colNI]} y={taxY} w={NW} h={taxH}
        label="Tax" value={c.incomeTax} color={RED} align="right" currency={currency} />

      {/* Interest */}
      <NBlock x={cols[colNI]} y={intY} w={NW} h={intH}
        label="Interest" value={c.interestExpense} color="#dc2626" align="right" currency={currency} />

      {/* Other non-operating */}
      {c.otherNonOperating != null && Math.abs(c.otherNonOperating) > 0 && (
        <NBlock x={cols[colNI]} y={otherNonOpY} w={NW} h={otherNonOpH}
          label={c.otherNonOperating > 0 ? "Other Income" : "Other Expense"}
          value={Math.abs(c.otherNonOperating)}
          color={c.otherNonOperating > 0 ? GREEN : "#7c2d12"} align="right" currency={currency} />
      )}

      {/* Net Income */}
      <NBlock x={cols[colNI]} y={niY} w={NW} h={niH}
        label="Net Profit" value={c.netIncome} color={GREEN}
        sub={data.margins.net != null ? `${data.margins.net.toFixed(0)}% margin` : undefined}
        align="right" currency={currency} />
    </svg>
  )
}

// ── Main Component ───────────────────────────────────────────

interface SankeyFlowProps {
  ticker: string
  companyName: string
  currency?: string
}

export default function SankeyFlow({ ticker, companyName, currency = "$" }: SankeyFlowProps) {
  const [data, setData] = useState<SankeyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/sankey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setData(d)
      if (d.availableYears?.length > 0) setSelectedYear(d.availableYears[0])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => { fetchData() }, [fetchData])

  const yearData = useMemo(() => {
    if (!data || !selectedYear) return null
    return data.years.find(y => y.year === selectedYear) ?? null
  }, [data, selectedYear])

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-bloomberg-amber font-bold text-sm tracking-wider font-mono">SANKEY FLOW CHART</span>
        <span className="text-muted-foreground text-[10px] font-mono">{companyName}</span>

        {/* Year selector */}
        {data?.availableYears && data.availableYears.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {data.availableYears.map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-2 py-1 rounded text-[10px] font-bold font-mono border transition-colors ${
                  selectedYear === yr
                    ? "bg-bloomberg-amber/20 text-bloomberg-amber border-bloomberg-amber/50"
                    : "border-bloomberg-border/50 text-muted-foreground hover:border-bloomberg-amber/30"
                }`}
              >
                FY{yr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Margins bar */}
      {yearData && (
        <div className="flex gap-4 mb-3 text-[10px] font-mono">
          {yearData.margins.gross != null && (
            <span className="text-muted-foreground">
              Marza brutto: <span className="text-bloomberg-green font-bold">{yearData.margins.gross.toFixed(1)}%</span>
            </span>
          )}
          {yearData.margins.operating != null && (
            <span className="text-muted-foreground">
              Marza operacyjna: <span className={yearData.margins.operating >= 0 ? "text-bloomberg-green font-bold" : "text-bloomberg-red font-bold"}>
                {yearData.margins.operating.toFixed(1)}%
              </span>
            </span>
          )}
          {yearData.margins.net != null && (
            <span className="text-muted-foreground">
              Marza netto: <span className={yearData.margins.net >= 0 ? "text-bloomberg-green font-bold" : "text-bloomberg-red font-bold"}>
                {yearData.margins.net.toFixed(1)}%
              </span>
            </span>
          )}
          {yearData.segments.length > 0 && (
            <span className="text-[8px] text-purple-400 ml-auto">
              {yearData.segments.length} segmentow przychodowych
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-bloomberg-amber" />
          <span className="text-muted-foreground text-xs font-mono">Ladowanie danych Sankey...</span>
        </div>
      )}
      {error && (
        <div className="text-center py-8 text-bloomberg-red text-xs font-mono">{error}</div>
      )}
      {!loading && !error && yearData && (
        <div className="overflow-x-auto">
          <SankeyChart data={yearData} currency={currency} />
        </div>
      )}
      {!loading && !error && !yearData && data && (
        <div className="text-center py-8 text-muted-foreground text-xs font-mono">
          Brak danych dla wybranego roku
        </div>
      )}
    </div>
  )
}
