"use client"

import { useMemo } from "react"
import type { IncomeStatementEntry } from "@/lib/yahoo"

/**
 * Custom SVG-based Sankey Flow Chart for financial data.
 * Shows: Revenue → COGS → Gross Profit → OpEx breakdown → Operating Profit → Tax/Interest → Net Profit
 */

interface SankeyFlowProps {
  /** Last 4 quarters (TTM) or latest annual data */
  incomeStatements: IncomeStatementEntry[]
  companyName: string
  currency?: string
}

interface FlowNode {
  id: string
  label: string
  value: number
  color: string
  x: number
  y: number
  height: number
  yoyChange?: number | null
}

interface FlowLink {
  source: string
  target: string
  value: number
  color: string
}

function formatValue(v: number, currency = "$"): string {
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${currency}${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${currency}${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${currency}${(v / 1e6).toFixed(0)}M`
  if (abs >= 1e3) return `${currency}${(v / 1e3).toFixed(0)}K`
  return `${currency}${v.toFixed(0)}`
}

function pctStr(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return ""
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}% Y/Y`
}

export default function SankeyFlow({ incomeStatements, companyName, currency = "$" }: SankeyFlowProps) {
  const data = useMemo(() => {
    if (!incomeStatements.length) return null

    // Calculate TTM (sum last 4 quarters)
    const sorted = [...incomeStatements].sort((a, b) => a.date.localeCompare(b.date))
    const recent = sorted.slice(-4)
    const prev4 = sorted.slice(-8, -4) // Previous 4 for Y/Y

    function ttmSum(arr: IncomeStatementEntry[], key: keyof IncomeStatementEntry): number | null {
      const vals = arr.map(q => q[key]).filter((v): v is number => v != null && typeof v === "number")
      return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) : null
    }

    function yoyPct(current: number | null, previous: number | null): number | null {
      if (!current || !previous || previous === 0) return null
      return ((current - previous) / Math.abs(previous)) * 100
    }

    const revenue = ttmSum(recent, "revenue")
    const cogs = ttmSum(recent, "costOfRevenue")
    const grossProfit = ttmSum(recent, "grossProfit")
    const sga = ttmSum(recent, "sellingGeneralAndAdministration")
    const rd = ttmSum(recent, "researchAndDevelopment")
    const depreciation = ttmSum(recent, "depreciation")
    const operatingIncome = ttmSum(recent, "operatingIncome")
    const interestExpense = ttmSum(recent, "interestExpense")
    const taxProvision = ttmSum(recent, "taxProvision")
    const netIncome = ttmSum(recent, "netIncome")
    const otherExpense = ttmSum(recent, "otherIncomeExpense")

    if (!revenue || revenue <= 0) return null

    // Y/Y changes
    const prevRevenue = ttmSum(prev4, "revenue")
    const prevGrossProfit = ttmSum(prev4, "grossProfit")
    const prevOperatingIncome = ttmSum(prev4, "operatingIncome")
    const prevNetIncome = ttmSum(prev4, "netIncome")
    const prevCogs = ttmSum(prev4, "costOfRevenue")
    const prevSga = ttmSum(prev4, "sellingGeneralAndAdministration")
    const prevRd = ttmSum(prev4, "researchAndDevelopment")
    const prevTax = ttmSum(prev4, "taxProvision")

    // Calculate derived values
    const actualGrossProfit = grossProfit ?? (cogs != null ? revenue - cogs : null)
    const actualCogs = cogs ?? (grossProfit != null ? revenue - grossProfit : null)

    // Operating expenses breakdown
    const totalOpEx = actualGrossProfit != null && operatingIncome != null
      ? actualGrossProfit - operatingIncome
      : null

    // "Other OpEx" = total OpEx - SGA - R&D - D&A
    const knownOpEx = (sga ?? 0) + (rd ?? 0) + (depreciation ?? 0)
    const otherOpEx = totalOpEx != null && knownOpEx > 0
      ? Math.max(0, totalOpEx - knownOpEx)
      : null

    // Taxes + interest + other = operating income - net income
    const actualTax = taxProvision != null ? Math.abs(taxProvision) : null
    const actualInterest = interestExpense != null ? Math.abs(interestExpense) : null
    const actualOther = otherExpense != null ? otherExpense : null

    // "Other non-operating" plug
    let otherNonOp: number | null = null
    if (operatingIncome != null && netIncome != null) {
      const known = (actualTax ?? 0) + (actualInterest ?? 0) - (actualOther ?? 0)
      otherNonOp = operatingIncome - netIncome - known
      if (Math.abs(otherNonOp) < revenue * 0.005) otherNonOp = null // ignore tiny residuals
    }

    return {
      revenue,
      cogs: actualCogs,
      grossProfit: actualGrossProfit,
      sga,
      rd,
      depreciation,
      otherOpEx: otherOpEx && otherOpEx > revenue * 0.01 ? otherOpEx : null,
      operatingIncome,
      interest: actualInterest,
      tax: actualTax,
      otherNonOp: otherNonOp && Math.abs(otherNonOp) > revenue * 0.01 ? otherNonOp : null,
      netIncome,
      // Y/Y
      yoy: {
        revenue: yoyPct(revenue, prevRevenue),
        grossProfit: yoyPct(actualGrossProfit, prevGrossProfit),
        operatingIncome: yoyPct(operatingIncome, prevOperatingIncome),
        netIncome: yoyPct(netIncome, prevNetIncome),
        cogs: yoyPct(actualCogs, prevCogs),
        sga: yoyPct(sga, prevSga),
        rd: yoyPct(rd, prevRd),
        tax: yoyPct(actualTax, prevTax),
      },
      // Margins
      grossMargin: actualGrossProfit != null ? (actualGrossProfit / revenue) * 100 : null,
      operatingMargin: operatingIncome != null ? (operatingIncome / revenue) * 100 : null,
      netMargin: netIncome != null ? (netIncome / revenue) * 100 : null,
    }
  }, [incomeStatements])

  if (!data) {
    return (
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4 text-center text-muted-foreground text-xs">
        Brak danych do wygenerowania Sankey Chart
      </div>
    )
  }

  // ── Build Sankey layout ──────────────────────────────────

  const W = 900
  const H = 500
  const PAD = 20

  // Revenue is 100% of the flow
  const rev = data.revenue

  // Column positions (x)
  const cols = [80, 320, 560, 780] // Revenue, GrossProfit, OperatingProfit, NetProfit

  // Calculate proportions relative to revenue
  const pct = (v: number | null) => v != null && rev > 0 ? Math.max(v / rev, 0) : 0
  const h = (v: number | null) => Math.max(pct(v) * (H - PAD * 2), 8) // min 8px height

  // Colors
  const GREEN = "#22c55e"
  const GREEN_LIGHT = "rgba(34,197,94,0.15)"
  const RED = "#ef4444"
  const RED_LIGHT = "rgba(239,68,68,0.15)"
  const GRAY = "#6b7280"

  // ── Render helpers ──────────────────────────────────────

  function SankeyLink({ x1, y1, h1, x2, y2, h2, color }: {
    x1: number; y1: number; h1: number; x2: number; y2: number; h2: number; color: string
  }) {
    const cx1 = x1 + (x2 - x1) * 0.4
    const cx2 = x1 + (x2 - x1) * 0.6

    const d = `
      M ${x1} ${y1}
      C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}
      L ${x2} ${y2 + h2}
      C ${cx2} ${y2 + h2}, ${cx1} ${y1 + h1}, ${x1} ${y1 + h1}
      Z
    `
    return <path d={d} fill={color} opacity={0.7} />
  }

  function NodeBlock({ x, y, w, nodeH, label, value, color, yoyChange, subLabel, align = "left" }: {
    x: number; y: number; w: number; nodeH: number; label: string; value: number | null
    color: string; yoyChange?: number | null; subLabel?: string; align?: "left" | "right"
  }) {
    if (!value && value !== 0) return null
    const textX = align === "right" ? x + w + 6 : x - 6
    const anchor = align === "right" ? "start" : "end"

    return (
      <g>
        <rect x={x} y={y} width={w} height={Math.max(nodeH, 4)} rx={2} fill={color} />
        <text x={textX} y={y + Math.max(nodeH, 4) / 2 - 8} textAnchor={anchor} fill="#e5e7eb" fontSize={11} fontWeight="bold" fontFamily="monospace">
          {label}
        </text>
        <text x={textX} y={y + Math.max(nodeH, 4) / 2 + 4} textAnchor={anchor} fill="#9ca3af" fontSize={10} fontFamily="monospace">
          {formatValue(value, currency)}
        </text>
        {yoyChange != null && (
          <text x={textX} y={y + Math.max(nodeH, 4) / 2 + 16} textAnchor={anchor} fill={yoyChange >= 0 ? GREEN : RED} fontSize={9} fontFamily="monospace">
            {pctStr(yoyChange)}
          </text>
        )}
        {subLabel && (
          <text x={textX} y={y + Math.max(nodeH, 4) / 2 + (yoyChange != null ? 28 : 16)} textAnchor={anchor} fill="#6b7280" fontSize={8} fontFamily="monospace">
            {subLabel}
          </text>
        )}
      </g>
    )
  }

  // ── Calculate Y positions ──────────────────────────────

  const topPad = 30
  const totalH = H - PAD * 2 - topPad

  // Column 0: Revenue (full bar)
  const revH = totalH
  const revY = topPad + PAD

  // Column 1: COGS (top, red) + Gross Profit (bottom, green)
  const cogsH = h(data.cogs)
  const gpH = data.grossProfit != null ? totalH - cogsH : 0
  const cogsY = revY
  const gpY = cogsY + cogsH

  // Column 2: OpEx items (top, red) + Operating Profit (bottom, green)
  const sgaH = h(data.sga)
  const rdH = h(data.rd)
  const daH = h(data.depreciation)
  const otherOpExH = h(data.otherOpEx)
  const opExTotalH = sgaH + rdH + daH + otherOpExH
  const opIncH = data.operatingIncome != null ? Math.max(gpH - opExTotalH, 8) : 0
  const sgaY = gpY
  const rdY = sgaY + sgaH
  const daY = rdY + rdH
  const otherOpExY = daY + daH
  const opIncY = otherOpExY + otherOpExH

  // Column 3: Tax + Interest + Other (top, red) + Net Profit (bottom, green)
  const taxH = h(data.tax)
  const intH = h(data.interest)
  const otherNonOpH = h(data.otherNonOp != null ? Math.abs(data.otherNonOp) : null)
  const deductionsH = taxH + intH + otherNonOpH
  const niH = data.netIncome != null ? Math.max(opIncH - deductionsH, 8) : 0
  const taxY = opIncY
  const intY = taxY + taxH
  const otherNonOpY = intY + intH
  const niY = otherNonOpY + otherNonOpH

  const nodeW = 14

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-bloomberg-amber font-bold text-sm tracking-wider font-mono">SANKEY FLOW CHART</span>
        <span className="text-muted-foreground text-[10px]">TTM | {companyName}</span>
      </div>

      {/* Margin summary */}
      <div className="flex gap-4 mb-3 text-[10px] font-mono">
        {data.grossMargin != null && (
          <span className="text-muted-foreground">
            Marża brutto: <span className="text-bloomberg-green font-bold">{data.grossMargin.toFixed(1)}%</span>
          </span>
        )}
        {data.operatingMargin != null && (
          <span className="text-muted-foreground">
            Marża operacyjna: <span className={data.operatingMargin >= 0 ? "text-bloomberg-green font-bold" : "text-bloomberg-red font-bold"}>
              {data.operatingMargin.toFixed(1)}%
            </span>
          </span>
        )}
        {data.netMargin != null && (
          <span className="text-muted-foreground">
            Marża netto: <span className={data.netMargin >= 0 ? "text-bloomberg-green font-bold" : "text-bloomberg-red font-bold"}>
              {data.netMargin.toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* ── LINKS ── */}

          {/* Revenue → COGS */}
          {data.cogs != null && data.cogs > 0 && (
            <SankeyLink x1={cols[0] + nodeW} y1={revY} h1={cogsH} x2={cols[1]} y2={cogsY} h2={cogsH} color={RED_LIGHT} />
          )}

          {/* Revenue → Gross Profit */}
          {data.grossProfit != null && data.grossProfit > 0 && (
            <SankeyLink x1={cols[0] + nodeW} y1={revY + cogsH} h1={gpH} x2={cols[1]} y2={gpY} h2={gpH} color={GREEN_LIGHT} />
          )}

          {/* Gross Profit → SGA */}
          {data.sga != null && data.sga > 0 && (
            <SankeyLink x1={cols[1] + nodeW} y1={gpY} h1={sgaH} x2={cols[2]} y2={sgaY} h2={sgaH} color={RED_LIGHT} />
          )}

          {/* Gross Profit → R&D */}
          {data.rd != null && data.rd > 0 && (
            <SankeyLink x1={cols[1] + nodeW} y1={gpY + sgaH} h1={rdH} x2={cols[2]} y2={rdY} h2={rdH} color={RED_LIGHT} />
          )}

          {/* Gross Profit → D&A */}
          {data.depreciation != null && data.depreciation > 0 && (
            <SankeyLink x1={cols[1] + nodeW} y1={gpY + sgaH + rdH} h1={daH} x2={cols[2]} y2={daY} h2={daH} color={RED_LIGHT} />
          )}

          {/* Gross Profit → Other OpEx */}
          {data.otherOpEx != null && data.otherOpEx > 0 && (
            <SankeyLink x1={cols[1] + nodeW} y1={gpY + sgaH + rdH + daH} h1={otherOpExH} x2={cols[2]} y2={otherOpExY} h2={otherOpExH} color={RED_LIGHT} />
          )}

          {/* Gross Profit → Operating Income */}
          {data.operatingIncome != null && data.operatingIncome > 0 && (
            <SankeyLink x1={cols[1] + nodeW} y1={gpY + opExTotalH} h1={opIncH} x2={cols[2]} y2={opIncY} h2={opIncH} color={GREEN_LIGHT} />
          )}

          {/* Operating Income → Tax */}
          {data.tax != null && data.tax > 0 && (
            <SankeyLink x1={cols[2] + nodeW} y1={opIncY} h1={taxH} x2={cols[3]} y2={taxY} h2={taxH} color={RED_LIGHT} />
          )}

          {/* Operating Income → Interest */}
          {data.interest != null && data.interest > 0 && (
            <SankeyLink x1={cols[2] + nodeW} y1={opIncY + taxH} h1={intH} x2={cols[3]} y2={intY} h2={intH} color={RED_LIGHT} />
          )}

          {/* Operating Income → Other non-op */}
          {data.otherNonOp != null && Math.abs(data.otherNonOp) > 0 && (
            <SankeyLink x1={cols[2] + nodeW} y1={opIncY + taxH + intH} h1={otherNonOpH} x2={cols[3]} y2={otherNonOpY} h2={otherNonOpH} color={RED_LIGHT} />
          )}

          {/* Operating Income → Net Income */}
          {data.netIncome != null && data.netIncome > 0 && (
            <SankeyLink x1={cols[2] + nodeW} y1={opIncY + deductionsH} h1={niH} x2={cols[3]} y2={niY} h2={niH} color={GREEN_LIGHT} />
          )}

          {/* ── NODES ── */}

          {/* Revenue */}
          <NodeBlock x={cols[0]} y={revY} w={nodeW} nodeH={revH}
            label="Revenue" value={data.revenue} color={GRAY}
            yoyChange={data.yoy.revenue} align="left" />

          {/* COGS */}
          {data.cogs != null && data.cogs > 0 && (
            <NodeBlock x={cols[1]} y={cogsY} w={nodeW} nodeH={cogsH}
              label="Cost of Revenue" value={data.cogs} color={RED}
              yoyChange={data.yoy.cogs} align="right" />
          )}

          {/* Gross Profit */}
          {data.grossProfit != null && data.grossProfit > 0 && (
            <NodeBlock x={cols[1]} y={gpY} w={nodeW} nodeH={gpH}
              label="Gross Profit" value={data.grossProfit} color={GREEN}
              yoyChange={data.yoy.grossProfit}
              subLabel={data.grossMargin != null ? `${data.grossMargin.toFixed(0)}% margin` : undefined}
              align="right" />
          )}

          {/* SG&A */}
          {data.sga != null && data.sga > 0 && (
            <NodeBlock x={cols[2]} y={sgaY} w={nodeW} nodeH={sgaH}
              label="SG&A" value={data.sga} color={RED}
              yoyChange={data.yoy.sga} align="right" />
          )}

          {/* R&D */}
          {data.rd != null && data.rd > 0 && (
            <NodeBlock x={cols[2]} y={rdY} w={nodeW} nodeH={rdH}
              label="R&D" value={data.rd} color={RED}
              yoyChange={data.yoy.rd} align="right" />
          )}

          {/* D&A */}
          {data.depreciation != null && data.depreciation > 0 && (
            <NodeBlock x={cols[2]} y={daY} w={nodeW} nodeH={daH}
              label="D&A" value={data.depreciation} color="#b45309" align="right" />
          )}

          {/* Other OpEx */}
          {data.otherOpEx != null && data.otherOpEx > 0 && (
            <NodeBlock x={cols[2]} y={otherOpExY} w={nodeW} nodeH={otherOpExH}
              label="Other OpEx" value={data.otherOpEx} color="#991b1b" align="right" />
          )}

          {/* Operating Income */}
          {data.operatingIncome != null && data.operatingIncome > 0 && (
            <NodeBlock x={cols[2]} y={opIncY} w={nodeW} nodeH={opIncH}
              label="Operating Profit" value={data.operatingIncome} color={GREEN}
              yoyChange={data.yoy.operatingIncome}
              subLabel={data.operatingMargin != null ? `${data.operatingMargin.toFixed(0)}% margin` : undefined}
              align="right" />
          )}

          {/* Tax */}
          {data.tax != null && data.tax > 0 && (
            <NodeBlock x={cols[3]} y={taxY} w={nodeW} nodeH={taxH}
              label="Tax" value={data.tax} color={RED}
              yoyChange={data.yoy.tax} align="right" />
          )}

          {/* Interest */}
          {data.interest != null && data.interest > 0 && (
            <NodeBlock x={cols[3]} y={intY} w={nodeW} nodeH={intH}
              label="Interest" value={data.interest} color="#dc2626" align="right" />
          )}

          {/* Other non-operating */}
          {data.otherNonOp != null && Math.abs(data.otherNonOp) > 0 && (
            <NodeBlock x={cols[3]} y={otherNonOpY} w={nodeW} nodeH={otherNonOpH}
              label="Other" value={Math.abs(data.otherNonOp)} color="#7c2d12" align="right" />
          )}

          {/* Net Income */}
          {data.netIncome != null && data.netIncome > 0 && (
            <NodeBlock x={cols[3]} y={niY} w={nodeW} nodeH={niH}
              label="Net Profit" value={data.netIncome} color={GREEN}
              yoyChange={data.yoy.netIncome}
              subLabel={data.netMargin != null ? `${data.netMargin.toFixed(0)}% margin` : undefined}
              align="right" />
          )}
        </svg>
      </div>
    </div>
  )
}
