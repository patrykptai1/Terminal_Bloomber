import { NextRequest, NextResponse } from "next/server"
import { fetchRevenueSegments, fetchIncomeStatements, fmpAvailable, type FMPSegmentYear, type FMPIncomeStatement } from "@/lib/fmp"

// ── Types ────────────────────────────────────────────────────

export interface SankeySegment {
  name: string
  revenue: number
  pctOfTotal: number
  yoyChange: number | null
}

export interface SankeyCosts {
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

export interface SankeyYearData {
  year: number
  date: string
  revenue: number
  segments: SankeySegment[]
  costs: SankeyCosts
  margins: { gross: number | null; operating: number | null; net: number | null }
}

// ── Handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { ticker } = await req.json() as { ticker: string }

    if (!ticker) {
      return NextResponse.json({ error: "Brak tickera" }, { status: 400 })
    }

    if (!fmpAvailable()) {
      return NextResponse.json({ error: "FMP API key not configured" }, { status: 500 })
    }

    // Fetch segments + income statements in parallel
    const [segmentYears, incomeStmts] = await Promise.all([
      fetchRevenueSegments(ticker),
      fetchIncomeStatements(ticker, 5),
    ])

    if (!incomeStmts.length) {
      return NextResponse.json({ error: "Brak danych finansowych" }, { status: 404 })
    }

    // Build segment lookup by fiscal year
    const segmentMap = new Map<number, FMPSegmentYear>()
    for (const s of segmentYears) {
      segmentMap.set(s.fiscalYear, s)
    }

    // Build previous year income for Y/Y calc on segments
    const incomeByYear = new Map<number, FMPIncomeStatement>()
    for (const is of incomeStmts) {
      const fy = parseInt(is.fiscalYear ?? is.date?.split("-")[0])
      if (fy) incomeByYear.set(fy, is)
    }

    // Build result for each year
    const years: SankeyYearData[] = []

    for (const is of incomeStmts) {
      const fy = parseInt(is.fiscalYear ?? is.date?.split("-")[0])
      if (!fy || is.revenue <= 0) continue

      // Segments
      const segData = segmentMap.get(fy)
      const prevSegData = segmentMap.get(fy - 1)
      const prevSegMap = prevSegData ? prevSegData.data : {}

      const segments: SankeySegment[] = []
      if (segData?.data) {
        const entries = Object.entries(segData.data)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)

        for (const [name, revenue] of entries) {
          // Find previous year segment (fuzzy match by name)
          const prevRevenue = findPrevSegment(name, prevSegMap)
          const yoyChange = prevRevenue != null && prevRevenue > 0
            ? ((revenue - prevRevenue) / prevRevenue) * 100
            : null

          segments.push({
            name: cleanSegmentName(name),
            revenue,
            pctOfTotal: (revenue / is.revenue) * 100,
            yoyChange,
          })
        }
      }

      // Cost breakdown
      const operatingIncome = is.operatingIncome ?? (is.ebit ?? null)
      const sm = is.sellingAndMarketingExpenses ?? null
      const ga = is.generalAndAdministrativeExpenses ?? null
      const sga = is.sellingGeneralAndAdministrativeExpenses ?? null

      // Calculate "other operating expenses" as plug
      const knownOpex = (is.researchAndDevelopmentExpenses ?? 0)
        + (sm ?? sga ?? 0)
        + (sm ? (ga ?? 0) : 0)
        + (is.depreciationAndAmortization ?? 0)
      const totalOpex = is.grossProfit - (operatingIncome ?? 0)
      const otherOpex = totalOpex - knownOpex

      // Non-operating items
      const interestNet = (is.interestExpense ?? 0) - (is.interestIncome ?? 0)
      const otherNonOp = is.nonOperatingIncomeExcludingInterest ?? null
      const preTaxIncome = (operatingIncome ?? 0) - interestNet + (otherNonOp ?? 0)
      const impliedTax = preTaxIncome - is.netIncome
      const tax = is.incomeTaxExpense ?? (impliedTax > 0 ? impliedTax : null)

      const costs: SankeyCosts = {
        costOfRevenue: is.costOfRevenue > 0 ? is.costOfRevenue : null,
        grossProfit: is.grossProfit > 0 ? is.grossProfit : null,
        researchAndDevelopment: is.researchAndDevelopmentExpenses > 0 ? is.researchAndDevelopmentExpenses : null,
        sellingAndMarketing: sm != null && sm > 0 ? sm : (sga != null && sga > 0 && !ga ? sga : null),
        generalAndAdmin: ga != null && ga > 0 ? ga : null,
        depreciationAmortization: is.depreciationAndAmortization > 0 ? is.depreciationAndAmortization : null,
        otherOpex: otherOpex > is.revenue * 0.01 ? otherOpex : null,
        operatingIncome: operatingIncome != null ? operatingIncome : null,
        interestExpense: is.interestExpense > 0 ? is.interestExpense : null,
        interestIncome: is.interestIncome > 0 ? is.interestIncome : null,
        otherNonOperating: otherNonOp != null && Math.abs(otherNonOp) > is.revenue * 0.005 ? otherNonOp : null,
        incomeTax: tax != null && tax > 0 ? tax : null,
        netIncome: is.netIncome,
      }

      years.push({
        year: fy,
        date: is.date,
        revenue: is.revenue,
        segments,
        costs,
        margins: {
          gross: is.grossProfit > 0 ? (is.grossProfit / is.revenue) * 100 : null,
          operating: operatingIncome != null ? (operatingIncome / is.revenue) * 100 : null,
          net: (is.netIncome / is.revenue) * 100,
        },
      })
    }

    // Sort by year descending
    years.sort((a, b) => b.year - a.year)

    return NextResponse.json({
      ticker,
      companyName: incomeStmts[0]?.symbol ?? ticker,
      years,
      availableYears: years.map(y => y.year),
      hasSegments: years.some(y => y.segments.length > 0),
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    console.error("[sankey] Error:", e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Sankey data error"
    }, { status: 500 })
  }
}

// ── Helpers ──────────────────────────────────────────────────

function cleanSegmentName(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → spaces
    .replace(/Three Six Five/gi, "365")
    .replace(/Corporation/gi, "")
    .replace(/Products And /gi, "")
    .replace(/And Cloud Services/gi, "& Cloud")
    .replace(/  +/g, " ")
    .trim()
}

function findPrevSegment(name: string, prevData: Record<string, number>): number | null {
  // Exact match
  if (prevData[name] != null) return prevData[name]

  // Fuzzy match: find the most similar key
  const nameLower = name.toLowerCase().replace(/\s+/g, "")
  for (const [k, v] of Object.entries(prevData)) {
    const kLower = k.toLowerCase().replace(/\s+/g, "")
    if (kLower === nameLower) return v
    // Partial match (e.g., "Office Products" matches "Office Products And Cloud Services")
    if (kLower.includes(nameLower) || nameLower.includes(kLower)) return v
  }

  return null
}
