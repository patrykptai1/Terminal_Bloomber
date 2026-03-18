"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Loader2 } from "lucide-react"
import TerminalInput from "@/components/TerminalInput"
import { getTabCache, setTabCache } from "@/lib/tabCache"

// ── Types ────────────────────────────────────────────────────

interface SankeySegment { name: string; revenue: number; pctOfTotal: number; yoyChange: number | null }
interface SankeyCosts {
  costOfRevenue: number | null; grossProfit: number | null
  researchAndDevelopment: number | null; sellingAndMarketing: number | null
  generalAndAdmin: number | null; depreciationAmortization: number | null
  otherOpex: number | null; operatingIncome: number | null
  interestExpense: number | null; interestIncome: number | null
  otherNonOperating: number | null; incomeTax: number | null; netIncome: number | null
}
interface SankeyYearData {
  year: number; date: string; revenue: number; segments: SankeySegment[]
  costs: SankeyCosts; margins: { gross: number | null; operating: number | null; net: number | null }
}
interface SankeyResponse {
  ticker: string; companyName: string; years: SankeyYearData[]
  availableYears: number[]; hasSegments: boolean
}

const LS_KEY = "bloomberg_last_ticker_sankey"

// ── Helpers ──────────────────────────────────────────────────

function fmt(v: number, c = "$"): string {
  const abs = Math.abs(v)
  const s = v < 0 ? "-" : ""
  if (abs >= 1e12) return `${s}${c}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${s}${c}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${s}${c}${(abs / 1e6).toFixed(0)}M`
  return `${s}${c}${(abs / 1e3).toFixed(0)}K`
}

function yoyStr(v: number | null): string {
  if (v == null || !isFinite(v)) return ""
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}% Y/Y`
}

// Colors matching the reference image
const C_GREEN = "#3dba6b"
const C_GREEN_FLOW = "rgba(61,186,107,0.25)"
const C_RED = "#d94452"
const C_RED_FLOW = "rgba(217,68,82,0.20)"
const C_GRAY = "#8b8b8b"
const C_GRAY_FLOW = "rgba(139,139,139,0.15)"
const C_AMBER = "#d4920a"

// ── SVG: Bezier flow link ────────────────────────────────────

function Flow({ x1, y1, h1, x2, y2, h2, color }: {
  x1: number; y1: number; h1: number; x2: number; y2: number; h2: number; color: string
}) {
  const midX = (x1 + x2) / 2
  return (
    <path
      d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2} L${x2},${y2 + h2} C${midX},${y2 + h2} ${midX},${y1 + h1} ${x1},${y1 + h1} Z`}
      fill={color}
    />
  )
}

// ── SVG: Node rectangle ─────────────────────────────────────

function Node({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  return <rect x={x} y={y} width={w} height={Math.max(h, 3)} rx={2} fill={color} />
}

// ── Full Sankey Chart (reference-style) ──────────────────────

function SankeyChart({ data, currency }: { data: SankeyYearData; currency: string }) {
  const hasSeg = data.segments.length > 0
  const segN = data.segments.length
  const c = data.costs
  const rev = data.revenue

  // Dynamic height based on segments — generous spacing
  const segRowH = 70
  const H = Math.max(700, hasSeg ? segN * segRowH + 100 : 700)
  const W = 1500
  const NW = 18 // node bar width
  const pad = 40

  // Column X positions — generous spacing for labels
  const segLabelW = 220 // space for segment labels on left
  const colSegNode = segLabelW
  const colRev = hasSeg ? 440 : 200
  const colGP = hasSeg ? 700 : 460
  const colOP = hasSeg ? 960 : 720
  const colNI = hasSeg ? 1220 : 980

  const totalH = H - pad * 2
  const pct = (v: number | null) => (v != null && rev > 0) ? v / rev : 0
  const nodeH = (v: number | null, minH = 10) => {
    const raw = pct(v) * totalH
    return v != null && v > 0 ? Math.max(raw, minH) : 0
  }

  // ── Y layout ──────────────────────────────────

  const topY = pad

  // Segments — evenly distributed with min height
  const segHeights = data.segments.map(s => Math.max(pct(s.revenue) * totalH, 32))
  const segTotalH = segHeights.reduce((a, b) => a + b, 0)
  const segGap = segN > 1 ? Math.max(3, (totalH - segTotalH) / (segN - 1)) : 0

  // Revenue bar (full height)
  const revY = topY
  const revH = totalH

  // GP column: COGS top, Gross Profit bottom
  const cogsH = nodeH(c.costOfRevenue)
  const gpH = c.grossProfit != null ? totalH - cogsH : 0
  const cogsY = topY
  const gpY = cogsY + cogsH

  // OP column: expenses top, operating income bottom
  const smH = nodeH(c.sellingAndMarketing)
  const rdH = nodeH(c.researchAndDevelopment)
  const gaH = nodeH(c.generalAndAdmin)
  const daH = nodeH(c.depreciationAmortization)
  const otherOpH = nodeH(c.otherOpex)
  const expH = smH + rdH + gaH + daH + otherOpH
  const opH = c.operatingIncome != null && c.operatingIncome > 0 ? Math.max(gpH - expH, 14) : 0

  let ey = gpY
  const smY = ey; ey += smH
  const rdY = ey; ey += rdH
  const gaY = ey; ey += gaH
  const daY = ey; ey += daH
  const otherOpY = ey; ey += otherOpH
  const opY = ey

  // NI column: tax+interest top, net income bottom
  const taxH = nodeH(c.incomeTax)
  const intH = nodeH(c.interestExpense)
  const othNonH = nodeH(c.otherNonOperating != null ? Math.abs(c.otherNonOperating) : null)
  const deductH = taxH + intH + othNonH
  const niH = c.netIncome != null && c.netIncome > 0 ? Math.max(opH - deductH, 14) : 0

  const taxY = opY
  const intY = taxY + taxH
  const othNonY = intY + intH
  const niY = othNonY + othNonH

  // Label helper
  const Label = ({ x, y: ly, align, lines, bold }: {
    x: number; y: number; align: "left" | "right"; lines: (string | null)[]; bold?: boolean
  }) => {
    const anchor = align === "left" ? "end" : "start"
    const dx = align === "left" ? -10 : 10
    const filtered = lines.filter(Boolean) as string[]
    return (
      <g>
        {filtered.map((line, i) => (
          <text key={i} x={x + dx} y={ly + i * 16} textAnchor={anchor}
            fill={i === 0 ? "#e5e7eb" : i === 1 ? "#9ca3af" : (line.includes("+") ? C_GREEN : line.includes("-") ? C_RED : "#6b7280")}
            fontSize={i === 0 ? (bold ? 15 : 13) : 12}
            fontWeight={i === 0 ? "bold" : "normal"}
            fontFamily="'Segoe UI', system-ui, sans-serif">
            {line}
          </text>
        ))}
      </g>
    )
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
      {/* ═══ SEGMENT FLOWS → Revenue ═══ */}
      {hasSeg && (() => {
        // Calculate node Y positions (proportional)
        let sy = topY
        const segYs: number[] = []
        data.segments.forEach((_, i) => { segYs.push(sy); sy += segHeights[i] + segGap })

        // Calculate label Y positions (evenly spaced, no overlap)
        const labelH = 52 // height per label block
        const labelTotalH = segN * labelH
        const labelStartY = topY + Math.max(0, (totalH - labelTotalH) / 2)
        const labelYs = data.segments.map((_, i) => labelStartY + i * labelH)

        let cumRev = 0
        return data.segments.map((seg, i) => {
          const sH = segHeights[i]
          const sY = segYs[i]
          const revTargetY = revY + (cumRev / rev) * totalH
          const revSliceH = pct(seg.revenue) * totalH
          cumRev += seg.revenue

          // Label position (evenly spaced)
          const lY = labelYs[i]
          // Node midpoint for leader line
          const nodeMidY = sY + sH / 2
          // Leader line: from label right edge → node left edge
          const leaderX1 = colSegNode - 6
          const leaderX2 = colSegNode - 1

          return (
            <g key={i}>
              <Flow x1={colSegNode + NW} y1={sY} h1={sH} x2={colRev} y2={revTargetY} h2={revSliceH} color={C_GRAY_FLOW} />
              <Node x={colSegNode} y={sY} w={NW} h={sH} color={C_GRAY} />
              {/* Leader line from label to node */}
              <path
                d={`M${leaderX1},${lY + 8} L${leaderX2},${nodeMidY}`}
                stroke="#4b5563" strokeWidth={1} fill="none" opacity={0.5}
              />
              <circle cx={leaderX2} cy={nodeMidY} r={2} fill="#4b5563" opacity={0.5} />
              {/* Label at evenly-spaced Y */}
              <Label x={leaderX1 - 2} y={lY} align="left" lines={[
                seg.name,
                fmt(seg.revenue, currency),
                seg.yoyChange != null ? yoyStr(seg.yoyChange) : `${seg.pctOfTotal.toFixed(0)}% of rev`,
              ]} />
            </g>
          )
        })
      })()}

      {/* ═══ Revenue → COGS + Gross Profit ═══ */}
      {c.costOfRevenue != null && c.costOfRevenue > 0 && (
        <Flow x1={colRev + NW} y1={revY} h1={cogsH} x2={colGP} y2={cogsY} h2={cogsH} color={C_RED_FLOW} />
      )}
      {c.grossProfit != null && c.grossProfit > 0 && (
        <Flow x1={colRev + NW} y1={revY + cogsH} h1={gpH} x2={colGP} y2={gpY} h2={gpH} color={C_GREEN_FLOW} />
      )}

      {/* ═══ Gross Profit → OpEx + Operating Profit ═══ */}
      {c.sellingAndMarketing != null && c.sellingAndMarketing > 0 && (
        <Flow x1={colGP + NW} y1={gpY} h1={smH} x2={colOP} y2={smY} h2={smH} color={C_RED_FLOW} />
      )}
      {c.researchAndDevelopment != null && c.researchAndDevelopment > 0 && (
        <Flow x1={colGP + NW} y1={gpY + smH} h1={rdH} x2={colOP} y2={rdY} h2={rdH} color={C_RED_FLOW} />
      )}
      {c.generalAndAdmin != null && c.generalAndAdmin > 0 && (
        <Flow x1={colGP + NW} y1={gpY + smH + rdH} h1={gaH} x2={colOP} y2={gaY} h2={gaH} color={C_RED_FLOW} />
      )}
      {c.depreciationAmortization != null && c.depreciationAmortization > 0 && (
        <Flow x1={colGP + NW} y1={gpY + smH + rdH + gaH} h1={daH} x2={colOP} y2={daY} h2={daH} color={C_RED_FLOW} />
      )}
      {c.otherOpex != null && c.otherOpex > 0 && (
        <Flow x1={colGP + NW} y1={gpY + smH + rdH + gaH + daH} h1={otherOpH} x2={colOP} y2={otherOpY} h2={otherOpH} color={C_RED_FLOW} />
      )}
      {c.operatingIncome != null && c.operatingIncome > 0 && (
        <Flow x1={colGP + NW} y1={gpY + expH} h1={opH} x2={colOP} y2={opY} h2={opH} color={C_GREEN_FLOW} />
      )}

      {/* ═══ Operating Profit → Tax/Interest + Net Income ═══ */}
      {c.incomeTax != null && c.incomeTax > 0 && (
        <Flow x1={colOP + NW} y1={opY} h1={taxH} x2={colNI} y2={taxY} h2={taxH} color={C_RED_FLOW} />
      )}
      {c.interestExpense != null && c.interestExpense > 0 && (
        <Flow x1={colOP + NW} y1={opY + taxH} h1={intH} x2={colNI} y2={intY} h2={intH} color={C_RED_FLOW} />
      )}
      {c.otherNonOperating != null && Math.abs(c.otherNonOperating) > 0 && (
        <Flow x1={colOP + NW} y1={opY + taxH + intH} h1={othNonH} x2={colNI} y2={othNonY} h2={othNonH}
          color={c.otherNonOperating > 0 ? C_GREEN_FLOW : C_RED_FLOW} />
      )}
      {c.netIncome != null && c.netIncome > 0 && (
        <Flow x1={colOP + NW} y1={opY + deductH} h1={niH} x2={colNI} y2={niY} h2={niH} color={C_GREEN_FLOW} />
      )}

      {/* ═══ NODE BARS + LABELS ═══ */}

      {/* Revenue */}
      <Node x={colRev} y={revY} w={NW} h={revH} color={C_GRAY} />
      <Label x={colRev + NW} y={revY + revH / 2 - 8} align="right" bold lines={["Revenue", fmt(rev, currency)]} />

      {/* Cost of Revenue */}
      <Node x={colGP} y={cogsY} w={NW} h={cogsH} color={C_RED} />
      {cogsH > 30 && <Label x={colGP + NW} y={cogsY + Math.min(cogsH / 2, 30) - 8} align="right" lines={["Cost of Revenue", fmt(c.costOfRevenue!, currency)]} />}

      {/* Gross Profit */}
      <Node x={colGP} y={gpY} w={NW} h={gpH} color={C_GREEN} />
      {gpH > 30 && <Label x={colGP + NW} y={gpY + Math.min(gpH / 2, 60) - 8} align="right" bold lines={[
        "Gross Profit", fmt(c.grossProfit!, currency), `${data.margins.gross?.toFixed(0)}% margin`
      ]} />}

      {/* S&M */}
      <Node x={colOP} y={smY} w={NW} h={smH} color={C_RED} />
      {smH > 20 && <Label x={colOP + NW} y={smY + Math.min(smH / 2, 20) - 8} align="right" lines={["S&M", fmt(c.sellingAndMarketing!, currency)]} />}

      {/* R&D */}
      <Node x={colOP} y={rdY} w={NW} h={rdH} color={C_RED} />
      {rdH > 20 && <Label x={colOP + NW} y={rdY + Math.min(rdH / 2, 20) - 8} align="right" lines={["R&D", fmt(c.researchAndDevelopment!, currency)]} />}

      {/* G&A */}
      <Node x={colOP} y={gaY} w={NW} h={gaH} color={C_RED} />
      {gaH > 15 && <Label x={colOP + NW} y={gaY + Math.min(gaH / 2, 20) - 8} align="right" lines={["G&A", fmt(c.generalAndAdmin!, currency)]} />}

      {/* D&A */}
      {c.depreciationAmortization != null && c.depreciationAmortization > 0 && (
        <>
          <Node x={colOP} y={daY} w={NW} h={daH} color={C_AMBER} />
          {daH > 15 && <Label x={colOP + NW} y={daY + Math.min(daH / 2, 20) - 8} align="right" lines={["D&A", fmt(c.depreciationAmortization, currency)]} />}
        </>
      )}

      {/* Other OpEx */}
      {c.otherOpex != null && c.otherOpex > 0 && (
        <>
          <Node x={colOP} y={otherOpY} w={NW} h={otherOpH} color="#991b1b" />
          {otherOpH > 15 && <Label x={colOP + NW} y={otherOpY + Math.min(otherOpH / 2, 20) - 8} align="right" lines={["Other OpEx", fmt(c.otherOpex, currency)]} />}
        </>
      )}

      {/* Operating Profit */}
      <Node x={colOP} y={opY} w={NW} h={opH} color={C_GREEN} />
      {opH > 30 && <Label x={colOP + NW} y={opY + Math.min(opH / 2, 40) - 8} align="right" bold lines={[
        "Operating Profit", fmt(c.operatingIncome!, currency), `${data.margins.operating?.toFixed(0)}% margin`
      ]} />}

      {/* Tax */}
      <Node x={colNI} y={taxY} w={NW} h={taxH} color={C_RED} />
      {taxH > 15 && <Label x={colNI + NW} y={taxY + Math.min(taxH / 2, 20) - 8} align="right" lines={["Tax", fmt(c.incomeTax!, currency)]} />}

      {/* Interest */}
      {c.interestExpense != null && c.interestExpense > 0 && (
        <>
          <Node x={colNI} y={intY} w={NW} h={intH} color={C_RED} />
          {intH > 10 && <Label x={colNI + NW} y={intY + Math.min(intH / 2, 15) - 4} align="right" lines={["Interest", fmt(c.interestExpense, currency)]} />}
        </>
      )}

      {/* Other non-operating */}
      {c.otherNonOperating != null && Math.abs(c.otherNonOperating) > 0 && (
        <>
          <Node x={colNI} y={othNonY} w={NW} h={othNonH} color={c.otherNonOperating > 0 ? C_GREEN : C_RED} />
          {othNonH > 10 && <Label x={colNI + NW} y={othNonY + Math.min(othNonH / 2, 15) - 4} align="right"
            lines={[c.otherNonOperating > 0 ? "Other Income" : "Other Expense", fmt(Math.abs(c.otherNonOperating), currency)]} />}
        </>
      )}

      {/* Net Profit */}
      <Node x={colNI} y={niY} w={NW} h={niH} color={C_GREEN} />
      {niH > 30 && <Label x={colNI + NW} y={niY + Math.min(niH / 2, 40) - 8} align="right" bold lines={[
        "Net Profit", fmt(c.netIncome!, currency), `${data.margins.net?.toFixed(0)}% margin`
      ]} />}
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

  useEffect(() => {
    if (didAutoLoad.current) return
    didAutoLoad.current = true
    if (data?.availableYears?.length) { setSelectedYear(data.availableYears[0]); return }
    const saved = localStorage.getItem(LS_KEY)
    if (saved) handleFetch(saved)
  }, [handleFetch, data])

  const yearData = useMemo(() => {
    if (!data || !selectedYear) return null
    return data.years.find(y => y.year === selectedYear) ?? null
  }, [data, selectedYear])

  return (
    <div className="font-mono space-y-3">
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
        <TerminalInput
          label="SANKEY CHART"
          placeholder="Wpisz ticker (np. MSFT, AAPL, NVDA, GOOGL)"
          onSubmit={handleFetch}
          defaultValue={typeof window !== "undefined" ? localStorage.getItem(LS_KEY) ?? "" : ""}
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-bloomberg-amber" />
          <span className="text-muted-foreground text-sm">Pobieranie danych segmentowych z FMP...</span>
        </div>
      )}

      {error && <div className="bg-bloomberg-card border border-bloomberg-red/30 rounded p-4 text-center text-bloomberg-red text-sm">{error}</div>}

      {!loading && data && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-bloomberg-border flex-wrap">
            <div>
              <div className="text-bloomberg-amber font-bold text-lg tracking-wider">{data.companyName}</div>
              <div className="text-muted-foreground text-xs">{data.ticker} • Income Statement Flow</div>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {data.availableYears.map(yr => (
                <button key={yr} onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${
                    selectedYear === yr
                      ? "bg-bloomberg-amber/20 text-bloomberg-amber border-bloomberg-amber/50"
                      : "border-bloomberg-border/50 text-muted-foreground hover:border-bloomberg-amber/30"
                  }`}>
                  FY{yr}
                </button>
              ))}
            </div>
          </div>

          {/* Margins */}
          {yearData && (
            <div className="flex items-center gap-8 px-5 py-2.5 border-b border-bloomberg-border/50 bg-bloomberg-bg/30">
              {yearData.margins.gross != null && (
                <span className="text-xs text-muted-foreground">Marza brutto: <span className="text-green-400 font-bold text-sm">{yearData.margins.gross.toFixed(1)}%</span></span>
              )}
              {yearData.margins.operating != null && (
                <span className="text-xs text-muted-foreground">Marza operacyjna: <span className={`font-bold text-sm ${yearData.margins.operating >= 0 ? "text-green-400" : "text-red-400"}`}>{yearData.margins.operating.toFixed(1)}%</span></span>
              )}
              {yearData.margins.net != null && (
                <span className="text-xs text-muted-foreground">Marza netto: <span className={`font-bold text-sm ${yearData.margins.net >= 0 ? "text-green-400" : "text-red-400"}`}>{yearData.margins.net.toFixed(1)}%</span></span>
              )}
              {yearData.segments.length > 0 && (
                <span className="text-[10px] text-purple-400 ml-auto font-bold">{yearData.segments.length} segmentow | FMP data</span>
              )}
            </div>
          )}

          {/* Chart */}
          {yearData && (
            <div className="p-2 overflow-x-auto">
              <SankeyChart data={yearData} currency="$" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
