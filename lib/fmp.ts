/**
 * Financial Modeling Prep API integration
 * Free tier: 250 requests/day
 * Used for: revenue segments, detailed income statement (S&M vs G&A split)
 */

const FMP_KEY = process.env.FMP_API_KEY ?? ""
const BASE = "https://financialmodelingprep.com/stable"

// ── Types ────────────────────────────────────────────────────

export interface FMPSegmentYear {
  symbol: string
  fiscalYear: number
  period: string
  date: string
  data: Record<string, number> // segment_name → revenue
}

export interface FMPIncomeStatement {
  date: string
  symbol: string
  fiscalYear: string
  period: string
  revenue: number
  costOfRevenue: number
  grossProfit: number
  researchAndDevelopmentExpenses: number
  sellingAndMarketingExpenses: number
  generalAndAdministrativeExpenses: number
  sellingGeneralAndAdministrativeExpenses: number
  otherExpenses: number
  operatingExpenses: number
  costAndExpenses: number
  operatingIncome: number
  interestIncome: number
  interestExpense: number
  depreciationAndAmortization: number
  ebitda: number
  ebit: number
  incomeTaxExpense: number
  netIncome: number
  nonOperatingIncomeExcludingInterest: number
}

// ── API calls ────────────────────────────────────────────────

async function fmpGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!FMP_KEY) return null

  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set("apikey", FMP_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  try {
    const res = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
    })
    if (!res.ok) {
      console.error(`[fmp] ${path}: ${res.status}`)
      return null
    }
    return await res.json()
  } catch (e) {
    console.error(`[fmp] ${path} error:`, e)
    return null
  }
}

/**
 * Revenue breakdown by product/service segment — multiple years
 */
export async function fetchRevenueSegments(symbol: string): Promise<FMPSegmentYear[]> {
  const data = await fmpGet<FMPSegmentYear[]>("revenue-product-segmentation", {
    symbol,
    period: "annual",
  })
  return data ?? []
}

/**
 * Geographic revenue segmentation
 */
export async function fetchGeoSegments(symbol: string): Promise<FMPSegmentYear[]> {
  const data = await fmpGet<FMPSegmentYear[]>("revenue-geographic-segmentation", {
    symbol,
    period: "annual",
  })
  return data ?? []
}

/**
 * Detailed annual income statements (with S&M and G&A split)
 */
export async function fetchIncomeStatements(symbol: string, limit = 5): Promise<FMPIncomeStatement[]> {
  const data = await fmpGet<FMPIncomeStatement[]>("income-statement", {
    symbol,
    period: "annual",
    limit: String(limit),
  })
  return data ?? []
}

/**
 * Quarterly income statements
 */
export async function fetchQuarterlyIncome(symbol: string, limit = 8): Promise<FMPIncomeStatement[]> {
  const data = await fmpGet<FMPIncomeStatement[]>("income-statement", {
    symbol,
    period: "quarter",
    limit: String(limit),
  })
  return data ?? []
}

/**
 * Check if FMP API key is configured
 */
export function fmpAvailable(): boolean {
  return !!FMP_KEY
}
