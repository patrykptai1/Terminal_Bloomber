// ============================================================
// Financial Scoring Engine v2 — sector & sub-industry aware
// Scale: 1–100 (sum of 7 categories = exactly 100 max)
//
// FIXES v2:
//  1. Growth YoY: TTM vs previous FY (not adjacent TTM)
//  2. Sub-industry benchmarks (not broad sector)
//  3. Insider activity: only Open Market Purchase/Sale
//  4. Weights sum to exactly 100, no multipliers
// ============================================================

import type { QuoteData, EarningsData } from "./yahoo"

interface TTMPoint { date: string; value: number }

function computeTTMForScore(quarters: { date: string; value: number | null }[]): TTMPoint[] {
  const sorted = [...quarters].filter(q => q.value != null).sort((a, b) => a.date.localeCompare(b.date))
  const results: TTMPoint[] = []
  for (let i = 3; i < sorted.length; i++) {
    const window = sorted.slice(i - 3, i + 1)
    if (window.length === 4 && window.every(q => q.value != null)) {
      results.push({ date: window[3].date, value: window.reduce((acc, q) => acc + (q.value ?? 0), 0) })
    }
  }
  return results
}

function yearFromDate(d: string): string {
  const m = d.match(/^(\d{4})/)
  return m ? m[1] : d
}

// ── Sub-industry benchmark profiles ─────────────────────────
// Each profile defines what "good" and "great" look like for
// companies in that specific sub-industry and phase.

interface SubIndustryProfile {
  name: string
  // Growth
  revGrowthGood: number      // Revenue YoY % — solid performance
  revGrowthGreat: number     // Revenue YoY % — top quartile
  // Profitability
  ebitdaMarginGood: number   // EBITDA margin % — peer median
  ebitdaMarginGreat: number  // EBITDA margin % — top quartile
  netMarginGood: number
  fcfMarginGood: number
  // Dilution
  sbcNorm: number            // SBC as % of revenue — peer median
  sbcHigh: number            // SBC as % of revenue — concerning
  dilutionNorm: number       // Annual share dilution % — normal
  // Category weights (MUST sum to 100)
  wGrowth: number            // Growth Momentum
  wProfit: number            // Profitability
  wEarningsQ: number         // Earnings Quality
  wForward: number           // Forward Outlook
  wDilution: number          // Dilution Risk
  wCapital: number           // Capital Structure
  wOwnership: number         // Ownership/Sentiment
}

// Default profile for unknown sub-industries
const DEFAULT_PROFILE: SubIndustryProfile = {
  name: "Default",
  revGrowthGood: 10, revGrowthGreat: 25,
  ebitdaMarginGood: 20, ebitdaMarginGreat: 35,
  netMarginGood: 10, fcfMarginGood: 10,
  sbcNorm: 5, sbcHigh: 12, dilutionNorm: 2,
  wGrowth: 25, wProfit: 20, wEarningsQ: 15, wForward: 15, wDilution: 10, wCapital: 10, wOwnership: 5,
}

// Sub-industry profiles with peer-calibrated benchmarks
const SUB_INDUSTRY_PROFILES: Record<string, SubIndustryProfile> = {
  // ── Technology sub-industries ──
  "MarTech/AdTech": {
    // Peers: TTD, RAMP, BRZE, KVYO, PUBM, MGNI, DV, IAS
    name: "MarTech/AdTech",
    revGrowthGood: 20, revGrowthGreat: 35,
    ebitdaMarginGood: 15, ebitdaMarginGreat: 30,
    netMarginGood: 5, fcfMarginGood: 12,
    sbcNorm: 12, sbcHigh: 20, dilutionNorm: 3,
    wGrowth: 28, wProfit: 18, wEarningsQ: 14, wForward: 17, wDilution: 10, wCapital: 8, wOwnership: 5,
  },
  "SaaS Growth": {
    // Peers: SNOW, DDOG, NET, CRWD, ZS, MDB, BILL
    name: "SaaS Growth",
    revGrowthGood: 25, revGrowthGreat: 40,
    ebitdaMarginGood: 10, ebitdaMarginGreat: 25,
    netMarginGood: 0, fcfMarginGood: 15,
    sbcNorm: 15, sbcHigh: 25, dilutionNorm: 3,
    wGrowth: 30, wProfit: 15, wEarningsQ: 12, wForward: 18, wDilution: 12, wCapital: 8, wOwnership: 5,
  },
  "SaaS Mature": {
    // Peers: CRM, ADBE, INTU, NOW, WDAY
    name: "SaaS Mature",
    revGrowthGood: 12, revGrowthGreat: 22,
    ebitdaMarginGood: 25, ebitdaMarginGreat: 40,
    netMarginGood: 18, fcfMarginGood: 25,
    sbcNorm: 10, sbcHigh: 18, dilutionNorm: 2,
    wGrowth: 22, wProfit: 22, wEarningsQ: 15, wForward: 15, wDilution: 10, wCapital: 11, wOwnership: 5,
  },
  "Semiconductors": {
    // Peers: NVDA, AMD, AVGO, MRVL, QCOM, TXN, INTC
    name: "Semiconductors",
    revGrowthGood: 12, revGrowthGreat: 30,
    ebitdaMarginGood: 30, ebitdaMarginGreat: 50,
    netMarginGood: 20, fcfMarginGood: 20,
    sbcNorm: 6, sbcHigh: 12, dilutionNorm: 1.5,
    wGrowth: 25, wProfit: 22, wEarningsQ: 13, wForward: 15, wDilution: 8, wCapital: 12, wOwnership: 5,
  },
  "Big Tech / FAANG": {
    // Peers: AAPL, GOOGL, MSFT, META, AMZN
    name: "Big Tech / FAANG",
    revGrowthGood: 10, revGrowthGreat: 20,
    ebitdaMarginGood: 30, ebitdaMarginGreat: 45,
    netMarginGood: 22, fcfMarginGood: 25,
    sbcNorm: 8, sbcHigh: 15, dilutionNorm: 1,
    wGrowth: 20, wProfit: 24, wEarningsQ: 15, wForward: 14, wDilution: 8, wCapital: 14, wOwnership: 5,
  },
  "Payments/FinTech": {
    // Peers: V, MA, PYPL, SQ, AFRM, ADYEN
    name: "Payments/FinTech",
    revGrowthGood: 12, revGrowthGreat: 25,
    ebitdaMarginGood: 25, ebitdaMarginGreat: 45,
    netMarginGood: 18, fcfMarginGood: 20,
    sbcNorm: 5, sbcHigh: 12, dilutionNorm: 1.5,
    wGrowth: 23, wProfit: 22, wEarningsQ: 15, wForward: 15, wDilution: 8, wCapital: 12, wOwnership: 5,
  },
  "Cybersecurity": {
    // Peers: CRWD, PANW, ZS, FTNT, S
    name: "Cybersecurity",
    revGrowthGood: 20, revGrowthGreat: 35,
    ebitdaMarginGood: 15, ebitdaMarginGreat: 30,
    netMarginGood: 5, fcfMarginGood: 20,
    sbcNorm: 12, sbcHigh: 20, dilutionNorm: 2.5,
    wGrowth: 28, wProfit: 17, wEarningsQ: 13, wForward: 18, wDilution: 11, wCapital: 8, wOwnership: 5,
  },
  "E-commerce": {
    // Peers: AMZN, SHOP, MELI, SE, ETSY, W
    name: "E-commerce",
    revGrowthGood: 12, revGrowthGreat: 25,
    ebitdaMarginGood: 10, ebitdaMarginGreat: 20,
    netMarginGood: 5, fcfMarginGood: 8,
    sbcNorm: 5, sbcHigh: 12, dilutionNorm: 2,
    wGrowth: 26, wProfit: 20, wEarningsQ: 14, wForward: 16, wDilution: 8, wCapital: 11, wOwnership: 5,
  },

  // ── Healthcare sub-industries ──
  "Biotech Early": {
    name: "Biotech Early",
    revGrowthGood: 30, revGrowthGreat: 100,
    ebitdaMarginGood: -20, ebitdaMarginGreat: 5,
    netMarginGood: -30, fcfMarginGood: -10,
    sbcNorm: 15, sbcHigh: 30, dilutionNorm: 5,
    wGrowth: 20, wProfit: 8, wEarningsQ: 10, wForward: 25, wDilution: 15, wCapital: 17, wOwnership: 5,
  },
  "Pharma Mature": {
    // Peers: JNJ, PFE, MRK, ABBV, LLY
    name: "Pharma Mature",
    revGrowthGood: 5, revGrowthGreat: 15,
    ebitdaMarginGood: 30, ebitdaMarginGreat: 45,
    netMarginGood: 20, fcfMarginGood: 20,
    sbcNorm: 3, sbcHigh: 8, dilutionNorm: 1,
    wGrowth: 18, wProfit: 25, wEarningsQ: 15, wForward: 15, wDilution: 7, wCapital: 15, wOwnership: 5,
  },
  "MedTech": {
    name: "MedTech",
    revGrowthGood: 8, revGrowthGreat: 18,
    ebitdaMarginGood: 22, ebitdaMarginGreat: 35,
    netMarginGood: 15, fcfMarginGood: 15,
    sbcNorm: 4, sbcHigh: 10, dilutionNorm: 1.5,
    wGrowth: 22, wProfit: 23, wEarningsQ: 15, wForward: 15, wDilution: 8, wCapital: 12, wOwnership: 5,
  },

  // ── Financial Services ──
  "Banks": {
    name: "Banks",
    revGrowthGood: 6, revGrowthGreat: 12,
    ebitdaMarginGood: 35, ebitdaMarginGreat: 50,
    netMarginGood: 25, fcfMarginGood: 20,
    sbcNorm: 2, sbcHigh: 5, dilutionNorm: 1,
    wGrowth: 18, wProfit: 25, wEarningsQ: 15, wForward: 12, wDilution: 5, wCapital: 20, wOwnership: 5,
  },
  "Insurance": {
    name: "Insurance",
    revGrowthGood: 8, revGrowthGreat: 15,
    ebitdaMarginGood: 15, ebitdaMarginGreat: 25,
    netMarginGood: 10, fcfMarginGood: 10,
    sbcNorm: 2, sbcHigh: 5, dilutionNorm: 1,
    wGrowth: 20, wProfit: 22, wEarningsQ: 15, wForward: 13, wDilution: 5, wCapital: 20, wOwnership: 5,
  },
  "Asset Management": {
    name: "Asset Management",
    revGrowthGood: 8, revGrowthGreat: 18,
    ebitdaMarginGood: 30, ebitdaMarginGreat: 45,
    netMarginGood: 25, fcfMarginGood: 25,
    sbcNorm: 5, sbcHigh: 12, dilutionNorm: 1.5,
    wGrowth: 20, wProfit: 24, wEarningsQ: 15, wForward: 14, wDilution: 7, wCapital: 15, wOwnership: 5,
  },

  // ── Energy ──
  "Oil & Gas": {
    name: "Oil & Gas",
    revGrowthGood: 5, revGrowthGreat: 15,
    ebitdaMarginGood: 25, ebitdaMarginGreat: 40,
    netMarginGood: 10, fcfMarginGood: 12,
    sbcNorm: 1, sbcHigh: 4, dilutionNorm: 1,
    wGrowth: 15, wProfit: 25, wEarningsQ: 13, wForward: 12, wDilution: 5, wCapital: 25, wOwnership: 5,
  },
  "Clean Energy / Solar": {
    name: "Clean Energy / Solar",
    revGrowthGood: 15, revGrowthGreat: 35,
    ebitdaMarginGood: 10, ebitdaMarginGreat: 22,
    netMarginGood: 3, fcfMarginGood: 5,
    sbcNorm: 5, sbcHigh: 12, dilutionNorm: 3,
    wGrowth: 28, wProfit: 18, wEarningsQ: 12, wForward: 18, wDilution: 10, wCapital: 9, wOwnership: 5,
  },

  // ── Consumer ──
  "Retail": {
    name: "Retail",
    revGrowthGood: 5, revGrowthGreat: 12,
    ebitdaMarginGood: 10, ebitdaMarginGreat: 18,
    netMarginGood: 5, fcfMarginGood: 6,
    sbcNorm: 2, sbcHigh: 5, dilutionNorm: 1,
    wGrowth: 20, wProfit: 25, wEarningsQ: 15, wForward: 13, wDilution: 5, wCapital: 17, wOwnership: 5,
  },
  "Consumer Staples": {
    name: "Consumer Staples",
    revGrowthGood: 4, revGrowthGreat: 10,
    ebitdaMarginGood: 18, ebitdaMarginGreat: 28,
    netMarginGood: 10, fcfMarginGood: 10,
    sbcNorm: 2, sbcHigh: 5, dilutionNorm: 1,
    wGrowth: 15, wProfit: 28, wEarningsQ: 15, wForward: 12, wDilution: 5, wCapital: 20, wOwnership: 5,
  },

  // ── Industrials ──
  "Aerospace & Defense": {
    name: "Aerospace & Defense",
    revGrowthGood: 6, revGrowthGreat: 15,
    ebitdaMarginGood: 15, ebitdaMarginGreat: 22,
    netMarginGood: 8, fcfMarginGood: 8,
    sbcNorm: 2, sbcHigh: 5, dilutionNorm: 1,
    wGrowth: 20, wProfit: 22, wEarningsQ: 15, wForward: 15, wDilution: 5, wCapital: 18, wOwnership: 5,
  },
  "Manufacturing": {
    name: "Manufacturing",
    revGrowthGood: 6, revGrowthGreat: 14,
    ebitdaMarginGood: 15, ebitdaMarginGreat: 25,
    netMarginGood: 8, fcfMarginGood: 8,
    sbcNorm: 2, sbcHigh: 5, dilutionNorm: 1,
    wGrowth: 20, wProfit: 24, wEarningsQ: 15, wForward: 13, wDilution: 5, wCapital: 18, wOwnership: 5,
  },

  // ── Real Estate ──
  "REIT": {
    name: "REIT",
    revGrowthGood: 5, revGrowthGreat: 12,
    ebitdaMarginGood: 40, ebitdaMarginGreat: 60,
    netMarginGood: 15, fcfMarginGood: 20,
    sbcNorm: 1, sbcHigh: 3, dilutionNorm: 3,
    wGrowth: 15, wProfit: 25, wEarningsQ: 12, wForward: 13, wDilution: 7, wCapital: 23, wOwnership: 5,
  },

  // ── Utilities ──
  "Utilities": {
    name: "Utilities",
    revGrowthGood: 4, revGrowthGreat: 10,
    ebitdaMarginGood: 30, ebitdaMarginGreat: 42,
    netMarginGood: 12, fcfMarginGood: 8,
    sbcNorm: 1, sbcHigh: 3, dilutionNorm: 1,
    wGrowth: 12, wProfit: 28, wEarningsQ: 15, wForward: 12, wDilution: 5, wCapital: 23, wOwnership: 5,
  },

  // ── Communication Services ──
  "Social Media / Digital Ads": {
    name: "Social Media / Digital Ads",
    revGrowthGood: 12, revGrowthGreat: 25,
    ebitdaMarginGood: 30, ebitdaMarginGreat: 45,
    netMarginGood: 20, fcfMarginGood: 25,
    sbcNorm: 8, sbcHigh: 15, dilutionNorm: 1.5,
    wGrowth: 23, wProfit: 22, wEarningsQ: 15, wForward: 15, wDilution: 8, wCapital: 12, wOwnership: 5,
  },
  "Telecom": {
    name: "Telecom",
    revGrowthGood: 3, revGrowthGreat: 8,
    ebitdaMarginGood: 30, ebitdaMarginGreat: 42,
    netMarginGood: 10, fcfMarginGood: 10,
    sbcNorm: 2, sbcHigh: 5, dilutionNorm: 1,
    wGrowth: 12, wProfit: 28, wEarningsQ: 15, wForward: 12, wDilution: 5, wCapital: 23, wOwnership: 5,
  },
}

// ── Industry → sub-industry mapping ─────────────────────────
// Maps Yahoo Finance industry strings to our sub-industry profile keys

const INDUSTRY_MAP: Record<string, string> = {
  // MarTech/AdTech
  "Internet Content & Information": "MarTech/AdTech",
  "Advertising Agencies": "MarTech/AdTech",
  "Marketing Services": "MarTech/AdTech",
  // SaaS
  "Software—Infrastructure": "SaaS Growth",
  "Software—Application": "SaaS Mature",
  "Information Technology Services": "SaaS Mature",
  // Semiconductors
  "Semiconductors": "Semiconductors",
  "Semiconductor Equipment & Materials": "Semiconductors",
  // Big Tech
  "Consumer Electronics": "Big Tech / FAANG",
  // Payments/FinTech
  "Credit Services": "Payments/FinTech",
  "Financial Data & Stock Exchanges": "Payments/FinTech",
  // Cybersecurity
  "Software—Cybersecurity": "Cybersecurity",
  // E-commerce
  "Internet Retail": "E-commerce",
  "Specialty Retail": "Retail",
  // Biotech
  "Biotechnology": "Biotech Early",
  "Drug Manufacturers—General": "Pharma Mature",
  "Drug Manufacturers—Specialty & Generic": "Pharma Mature",
  // MedTech
  "Medical Devices": "MedTech",
  "Medical Instruments & Supplies": "MedTech",
  "Diagnostics & Research": "MedTech",
  "Health Information Services": "MedTech",
  // Banks
  "Banks—Diversified": "Banks",
  "Banks—Regional": "Banks",
  // Insurance
  "Insurance—Diversified": "Insurance",
  "Insurance—Life": "Insurance",
  "Insurance—Property & Casualty": "Insurance",
  "Insurance Brokers": "Insurance",
  // Asset Management
  "Asset Management": "Asset Management",
  "Capital Markets": "Asset Management",
  // Oil & Gas
  "Oil & Gas E&P": "Oil & Gas",
  "Oil & Gas Integrated": "Oil & Gas",
  "Oil & Gas Midstream": "Oil & Gas",
  "Oil & Gas Refining & Marketing": "Oil & Gas",
  "Oil & Gas Equipment & Services": "Oil & Gas",
  // Clean Energy
  "Solar": "Clean Energy / Solar",
  "Utilities—Renewable": "Clean Energy / Solar",
  // Retail
  "Discount Stores": "Retail",
  "Home Improvement Retail": "Retail",
  "Department Stores": "Retail",
  "Apparel Retail": "Retail",
  "Grocery Stores": "Consumer Staples",
  // Consumer Staples
  "Packaged Foods": "Consumer Staples",
  "Beverages—Non-Alcoholic": "Consumer Staples",
  "Beverages—Wineries & Distilleries": "Consumer Staples",
  "Household & Personal Products": "Consumer Staples",
  "Tobacco": "Consumer Staples",
  // Aerospace & Defense
  "Aerospace & Defense": "Aerospace & Defense",
  // Manufacturing
  "Specialty Industrial Machinery": "Manufacturing",
  "Farm & Heavy Construction Machinery": "Manufacturing",
  "Industrial Distribution": "Manufacturing",
  "Conglomerates": "Manufacturing",
  // REIT
  "REIT—Diversified": "REIT",
  "REIT—Industrial": "REIT",
  "REIT—Residential": "REIT",
  "REIT—Retail": "REIT",
  "REIT—Office": "REIT",
  "REIT—Healthcare Facilities": "REIT",
  "REIT—Specialty": "REIT",
  // Utilities
  "Utilities—Regulated Electric": "Utilities",
  "Utilities—Regulated Gas": "Utilities",
  "Utilities—Diversified": "Utilities",
  "Utilities—Independent Power Producers": "Utilities",
  // Communication
  "Entertainment": "Social Media / Digital Ads",
  "Electronic Gaming & Multimedia": "Social Media / Digital Ads",
  "Telecom Services": "Telecom",
}

// Sector-level fallback mapping
const SECTOR_FALLBACK: Record<string, string> = {
  "Technology": "SaaS Mature",
  "Healthcare": "MedTech",
  "Financial Services": "Asset Management",
  "Energy": "Oil & Gas",
  "Consumer Cyclical": "Retail",
  "Consumer Defensive": "Consumer Staples",
  "Industrials": "Manufacturing",
  "Real Estate": "REIT",
  "Utilities": "Utilities",
  "Communication Services": "Social Media / Digital Ads",
  "Basic Materials": "Manufacturing",
}

// Normalize dashes (em-dash ↔ regular dash ↔ en-dash) for matching
function normDash(s: string): string {
  return s.replace(/[—–\-]/g, "-").toLowerCase().trim()
}

function getProfile(sector: string | null, industry: string | null): SubIndustryProfile {
  // 1. Try exact industry match (with dash normalization)
  if (industry) {
    const normIndustry = normDash(industry)

    for (const [indName, profKey] of Object.entries(INDUSTRY_MAP)) {
      if (normDash(indName) === normIndustry) {
        if (SUB_INDUSTRY_PROFILES[profKey]) return SUB_INDUSTRY_PROFILES[profKey]
      }
    }

    // Try partial match on industry name
    for (const [indName, profKey] of Object.entries(INDUSTRY_MAP)) {
      if (normIndustry.includes(normDash(indName)) || normDash(indName).includes(normIndustry)) {
        if (SUB_INDUSTRY_PROFILES[profKey]) return SUB_INDUSTRY_PROFILES[profKey]
      }
    }
  }

  // 2. Fall back to sector
  if (sector) {
    const key = SECTOR_FALLBACK[sector]
    if (key && SUB_INDUSTRY_PROFILES[key]) return SUB_INDUSTRY_PROFILES[key]
  }

  return DEFAULT_PROFILE
}

// ── Helpers ──────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function linearScore(value: number, low: number, high: number, maxPts: number): number {
  if (high === low) return value >= high ? maxPts : 0
  return clamp(((value - low) / (high - low)) * maxPts, 0, maxPts)
}

// Check if transaction is Open Market
function isOpenMarketPurchase(txType: string): boolean {
  const t = txType.toLowerCase()
  return t.includes("purchase") || (t.includes("buy") && !t.includes("buyback"))
}

function isOpenMarketSale(txType: string): boolean {
  const t = txType.toLowerCase()
  return (t.startsWith("sale") || t.includes("sale at price"))
    && !t.includes("gift") && !t.includes("award") && !t.includes("exercise")
}

// ── Exported types ──────────────────────────────────────────

export interface ScoreBreakdown {
  total: number
  growth: number
  profitability: number
  earningsQuality: number
  forwardOutlook: number
  dilutionRisk: number
  capitalStructure: number
  ownership: number
  // Max points per category (from sub-industry weights)
  maxGrowth: number
  maxProfit: number
  maxEarningsQ: number
  maxForward: number
  maxDilution: number
  maxCapital: number
  maxOwnership: number
  sector: string | null
  subIndustry: string
  details: string[]
}

// ── Main scoring function ───────────────────────────────────

export function calculateFinancialScore(q: QuoteData, e: EarningsData): ScoreBreakdown {
  const sector = e.sector ?? null
  // We need industry info — extract from earnings data if available
  // The industry is available in the income statements or we derive from sector
  const industry = (e as any).industry ?? null
  const prof = getProfile(sector, industry)
  const details: string[] = []
  details.push(`Profil: ${prof.name}`)

  // ── PREPARE TTM DATA ──
  const revenueQ = (e.incomeStatements ?? []).map(s => ({ date: s.date, value: s.revenue }))
  const ebitdaQ = (e.incomeStatements ?? []).map(s => ({ date: s.date, value: s.ebitdaNormalized ?? s.ebitda }))
  const netIncomeQ = (e.incomeStatements ?? []).map(s => ({ date: s.date, value: s.netIncome }))
  const fcfQ = (e.cashFlowQuarterly ?? []).map(c => ({ date: c.date, value: c.freeCashFlow }))
  const sbcQ = (e.cashFlowQuarterly ?? []).map(c => ({ date: c.date, value: c.stockBasedCompensation }))
  const opCfQ = (e.cashFlowQuarterly ?? []).map(c => ({ date: c.date, value: c.operatingCashFlow }))

  const revenueTTM = computeTTMForScore(revenueQ)
  const ebitdaTTM = computeTTMForScore(ebitdaQ)
  const netIncomeTTM = computeTTMForScore(netIncomeQ)
  const fcfTTM = computeTTMForScore(fcfQ)
  const sbcTTM = computeTTMForScore(sbcQ)
  const opCfTTM = computeTTMForScore(opCfQ)

  const annualRevenue = (e.annualStatements ?? []).filter(a => a.revenue != null).map(a => ({ date: a.date, value: a.revenue! }))
  const annualEbitda = (e.annualStatements ?? []).filter(a => (a.ebitdaNormalized ?? a.ebitda) != null).map(a => ({ date: a.date, value: (a.ebitdaNormalized ?? a.ebitda)! }))
  const annualNetIncome = (e.annualStatements ?? []).filter(a => a.netIncome != null).map(a => ({ date: a.date, value: a.netIncome! }))
  const annualFCF = (e.cashFlowAnnual ?? []).filter(c => c.freeCashFlow != null).map(c => ({ date: c.date, value: c.freeCashFlow! }))

  // ══════════════════════════════════════════════════════════
  // POPRAWKA 1: Growth YoY = TTM bieżący vs FY poprzedniego roku
  // ══════════════════════════════════════════════════════════

  // Find the latest TTM and the previous FY to compare against
  function calcYoYGrowth(ttmData: TTMPoint[], annualData: { date: string; value: number }[]): number | null {
    if (ttmData.length === 0) return null
    const latestTTM = ttmData[ttmData.length - 1]
    const latestTTMYear = parseInt(yearFromDate(latestTTM.date))

    // Find previous FY (the FY before the year that contains the latest TTM quarter)
    // If TTM ends in 2025, compare vs FY2024
    const prevFY = annualData
      .filter(a => parseInt(yearFromDate(a.date)) < latestTTMYear)
      .sort((a, b) => b.date.localeCompare(a.date))[0]

    // If TTM end quarter is Q4 (Dec), TTM = the full year, so compare vs FY of year before
    // If TTM end quarter is e.g. Q3, compare vs most recent complete FY
    if (prevFY && prevFY.value !== 0) {
      return ((latestTTM.value - prevFY.value) / Math.abs(prevFY.value)) * 100
    }

    // Fallback: use two most recent annual statements
    if (annualData.length >= 2) {
      const l = annualData[annualData.length - 1]
      const p = annualData[annualData.length - 2]
      if (p.value !== 0) return ((l.value - p.value) / Math.abs(p.value)) * 100
    }
    return null
  }

  // ══════════════════════════════════════════════════════════
  // 1. GROWTH MOMENTUM (wGrowth pts)
  // ══════════════════════════════════════════════════════════
  let growthScore = 0
  const W_GROWTH = prof.wGrowth

  const revenueGrowthPct = calcYoYGrowth(revenueTTM, annualRevenue)
  if (revenueGrowthPct != null) {
    const maxRevPts = W_GROWTH * 0.7 // 70% of growth points from revenue
    if (revenueGrowthPct < 0) {
      growthScore += linearScore(revenueGrowthPct, -30, 0, maxRevPts * 0.15)
    } else if (revenueGrowthPct <= prof.revGrowthGood) {
      growthScore += maxRevPts * 0.15 + linearScore(revenueGrowthPct, 0, prof.revGrowthGood, maxRevPts * 0.45)
    } else if (revenueGrowthPct <= prof.revGrowthGreat) {
      growthScore += maxRevPts * 0.6 + linearScore(revenueGrowthPct, prof.revGrowthGood, prof.revGrowthGreat, maxRevPts * 0.25)
    } else {
      growthScore += maxRevPts * 0.85 + linearScore(revenueGrowthPct, prof.revGrowthGreat, prof.revGrowthGreat * 2, maxRevPts * 0.15)
    }
    details.push(`Rev YoY: ${revenueGrowthPct >= 0 ? "+" : ""}${revenueGrowthPct.toFixed(1)}%`)
  }

  // EBITDA/FCF growth as secondary growth signal (30% of growth points)
  const ebitdaGrowthPct = calcYoYGrowth(ebitdaTTM, annualEbitda)
  const fcfGrowthPct = calcYoYGrowth(fcfTTM, annualFCF)
  const secondaryGrowth = ebitdaGrowthPct ?? fcfGrowthPct
  if (secondaryGrowth != null) {
    const maxSecPts = W_GROWTH * 0.3
    growthScore += linearScore(secondaryGrowth, -20, 50, maxSecPts)
  }

  growthScore = clamp(growthScore, 0, W_GROWTH)

  // ══════════════════════════════════════════════════════════
  // 2. PROFITABILITY (wProfit pts)
  // ══════════════════════════════════════════════════════════
  let profitScore = 0
  const W_PROFIT = prof.wProfit
  const latestRev = revenueTTM.length > 0 ? revenueTTM[revenueTTM.length - 1].value : null

  // EBITDA Margin (40% of profit pts)
  if (latestRev && latestRev > 0 && ebitdaTTM.length > 0) {
    const ebitdaMargin = (ebitdaTTM[ebitdaTTM.length - 1].value / latestRev) * 100
    const maxEbPts = W_PROFIT * 0.4
    if (ebitdaMargin < 0) {
      profitScore += linearScore(ebitdaMargin, -30, 0, maxEbPts * 0.1)
    } else {
      profitScore += maxEbPts * 0.1 + linearScore(ebitdaMargin, 0, prof.ebitdaMarginGreat, maxEbPts * 0.9)
    }
    details.push(`EBITDA Margin: ${ebitdaMargin.toFixed(1)}%`)
  }

  // Net Margin (30% of profit pts)
  if (latestRev && latestRev > 0 && netIncomeTTM.length > 0) {
    const netMargin = (netIncomeTTM[netIncomeTTM.length - 1].value / latestRev) * 100
    const maxNiPts = W_PROFIT * 0.3
    if (netMargin < 0) {
      profitScore += linearScore(netMargin, -30, 0, maxNiPts * 0.1)
    } else {
      profitScore += maxNiPts * 0.1 + linearScore(netMargin, 0, prof.netMarginGood * 2, maxNiPts * 0.9)
    }
    details.push(`Net Margin: ${netMargin.toFixed(1)}%`)
  }

  // FCF Margin (30% of profit pts)
  if (latestRev && latestRev > 0 && fcfTTM.length > 0) {
    const fcfMargin = (fcfTTM[fcfTTM.length - 1].value / latestRev) * 100
    const maxFcfPts = W_PROFIT * 0.3
    if (fcfMargin < 0) {
      profitScore += linearScore(fcfMargin, -20, 0, maxFcfPts * 0.1)
    } else {
      profitScore += maxFcfPts * 0.1 + linearScore(fcfMargin, 0, prof.fcfMarginGood * 2, maxFcfPts * 0.9)
    }
    details.push(`FCF Margin: ${fcfMargin.toFixed(1)}%`)
  }

  profitScore = clamp(profitScore, 0, W_PROFIT)

  // ══════════════════════════════════════════════════════════
  // 3. EARNINGS QUALITY (wEarningsQ pts)
  // ══════════════════════════════════════════════════════════
  let earningsQScore = 0
  const W_EQ = prof.wEarningsQ

  // EPS Beat Rate (50% of EQ pts)
  const qWithActual = (e.quarterly ?? []).filter(q => q.actual != null && q.estimate != null)
  if (qWithActual.length > 0) {
    const beats = qWithActual.filter(q => (q.surprise ?? 0) > 0).length
    const beatRate = (beats / qWithActual.length) * 100
    earningsQScore += linearScore(beatRate, 25, 100, W_EQ * 0.5)
    details.push(`Beat Rate: ${beatRate.toFixed(0)}% (${beats}/${qWithActual.length})`)
  }

  // FCF Conversion (25% of EQ pts)
  if (fcfTTM.length > 0 && netIncomeTTM.length > 0) {
    const fcfVal = fcfTTM[fcfTTM.length - 1].value
    const niVal = netIncomeTTM[netIncomeTTM.length - 1].value
    if (niVal > 0) {
      const conversion = (fcfVal / niVal) * 100
      earningsQScore += linearScore(conversion, 0, 120, W_EQ * 0.25)
    } else if (fcfVal > 0) {
      earningsQScore += W_EQ * 0.15 // FCF+ but NI- = decent
    }
  }

  // Operating Cash Flow strength (25% of EQ pts)
  if (opCfTTM.length > 0 && latestRev && latestRev > 0) {
    const opCf = opCfTTM[opCfTTM.length - 1].value
    if (opCf > 0) {
      earningsQScore += linearScore((opCf / latestRev) * 100, 0, 30, W_EQ * 0.25)
    }
  }

  earningsQScore = clamp(earningsQScore, 0, W_EQ)

  // ══════════════════════════════════════════════════════════
  // 4. FORWARD OUTLOOK (wForward pts)
  // ══════════════════════════════════════════════════════════
  let forwardScore = 0
  const W_FWD = prof.wForward
  const fwdY = (e.forwardEstimates ?? []).filter(f => f.period === "0y" || f.period === "+1y")

  // Forward Revenue Growth (35% of fwd pts)
  if (fwdY.length > 0 && fwdY[0].revEstimate != null && fwdY[0].yearAgoRev != null && fwdY[0].yearAgoRev !== 0) {
    const fwdRevGrowth = ((fwdY[0].revEstimate - fwdY[0].yearAgoRev) / Math.abs(fwdY[0].yearAgoRev)) * 100
    forwardScore += linearScore(fwdRevGrowth, -5, prof.revGrowthGreat, W_FWD * 0.35)
    details.push(`Fwd Rev: +${fwdRevGrowth.toFixed(1)}%`)
  }

  // Forward EPS Growth (35% of fwd pts)
  if (fwdY.length > 0 && fwdY[0].epsEstimate != null && fwdY[0].yearAgoEps != null && fwdY[0].yearAgoEps !== 0) {
    const fwdEpsGrowth = ((fwdY[0].epsEstimate - fwdY[0].yearAgoEps) / Math.abs(fwdY[0].yearAgoEps)) * 100
    forwardScore += linearScore(fwdEpsGrowth, -10, 40, W_FWD * 0.35)
  }

  // Analyst Revision Momentum (30% of fwd pts)
  const fwd0y = (e.forwardEstimates ?? []).find(f => f.period === "0y")
  if (fwd0y) {
    const revisionsUp = fwd0y.epsRevisionsUp30d ?? 0
    const revisionsDown = fwd0y.epsRevisionsDown30d ?? 0
    const totalRevisions = revisionsUp + revisionsDown
    if (totalRevisions > 0) {
      const upRatio = revisionsUp / totalRevisions
      forwardScore += linearScore(upRatio * 100, 20, 80, W_FWD * 0.2)
    }
    if (fwd0y.epsTrendCurrent != null && fwd0y.epsTrend30d != null && fwd0y.epsTrend30d !== 0) {
      const trendChange = ((fwd0y.epsTrendCurrent - fwd0y.epsTrend30d) / Math.abs(fwd0y.epsTrend30d)) * 100
      forwardScore += trendChange > 0 ? linearScore(trendChange, 0, 10, W_FWD * 0.1) : 0
    }
  }

  forwardScore = clamp(forwardScore, 0, W_FWD)

  // ══════════════════════════════════════════════════════════
  // 5. DILUTION RISK (wDilution pts — higher = less dilution)
  // ══════════════════════════════════════════════════════════
  let dilutionScore = 0
  const W_DIL = prof.wDilution

  // SBC as % of Revenue (50% of dilution pts)
  if (latestRev && latestRev > 0 && sbcTTM.length > 0) {
    const sbcPct = (sbcTTM[sbcTTM.length - 1].value / latestRev) * 100
    const maxSbcPts = W_DIL * 0.5
    // Lower is better: below norm = full pts, above sbcHigh = 0 pts
    dilutionScore += clamp(maxSbcPts - linearScore(sbcPct, prof.sbcNorm * 0.5, prof.sbcHigh, maxSbcPts), 0, maxSbcPts)
    details.push(`SBC/Rev: ${sbcPct.toFixed(1)}%`)
  } else {
    dilutionScore += W_DIL * 0.3 // No data = neutral
  }

  // Share Dilution YoY (50% of dilution pts)
  const bsA = (e.balanceSheetAnnual ?? []).filter(b => b.sharesOutstanding != null)
  if (bsA.length >= 2) {
    const latest = bsA[bsA.length - 1].sharesOutstanding!
    const prev = bsA[bsA.length - 2].sharesOutstanding!
    if (prev > 0) {
      const dilutionPct = ((latest - prev) / prev) * 100
      const maxDilPts = W_DIL * 0.5
      if (dilutionPct <= 0) {
        dilutionScore += maxDilPts // Buyback or stable
      } else {
        dilutionScore += clamp(maxDilPts - linearScore(dilutionPct, 0, prof.dilutionNorm * 3, maxDilPts), 0, maxDilPts)
      }
      details.push(`Dilution: ${dilutionPct >= 0 ? "+" : ""}${dilutionPct.toFixed(1)}%`)
    }
  } else {
    dilutionScore += W_DIL * 0.3 // No data = neutral
  }

  dilutionScore = clamp(dilutionScore, 0, W_DIL)

  // ══════════════════════════════════════════════════════════
  // 6. CAPITAL STRUCTURE (wCapital pts)
  // ══════════════════════════════════════════════════════════
  let capitalScore = 0
  const W_CAP = prof.wCapital

  // Valuation: P/E reasonableness (50% of capital pts)
  const maxPePts = W_CAP * 0.5
  if (q.forwardPE != null && q.forwardPE > 0) {
    // Forward P/E is more useful than trailing for growth companies
    if (q.forwardPE < 12) capitalScore += maxPePts * 0.9
    else if (q.forwardPE < 20) capitalScore += maxPePts
    else if (q.forwardPE < 35) capitalScore += maxPePts * 0.7
    else if (q.forwardPE < 60) capitalScore += maxPePts * 0.4
    else capitalScore += maxPePts * 0.15
  } else if (q.peRatio != null && q.peRatio > 0) {
    if (q.peRatio < 12) capitalScore += maxPePts * 0.8
    else if (q.peRatio < 20) capitalScore += maxPePts
    else if (q.peRatio < 35) capitalScore += maxPePts * 0.65
    else if (q.peRatio < 60) capitalScore += maxPePts * 0.35
    else capitalScore += maxPePts * 0.1
  } else {
    capitalScore += maxPePts * 0.2 // No P/E (negative earnings)
  }

  // Cash position (25% of capital pts)
  const latestCash = (e.balanceSheetQuarterly ?? []).length > 0
    ? e.balanceSheetQuarterly[e.balanceSheetQuarterly.length - 1].cashAndEquivalents
    : null
  if (latestCash != null && q.marketCap > 0) {
    const cashPctMcap = (latestCash / q.marketCap) * 100
    capitalScore += linearScore(cashPctMcap, 0, 20, W_CAP * 0.25)
  }

  // FCF Yield (25% of capital pts)
  if (fcfTTM.length > 0 && q.marketCap > 0) {
    const fcfYield = (fcfTTM[fcfTTM.length - 1].value / q.marketCap) * 100
    if (fcfYield > 0) {
      capitalScore += linearScore(fcfYield, 0, 8, W_CAP * 0.25)
    }
  }

  capitalScore = clamp(capitalScore, 0, W_CAP)

  // ══════════════════════════════════════════════════════════
  // 7. OWNERSHIP/SENTIMENT (wOwnership pts)
  //    POPRAWKA 3: Only count Open Market transactions
  // ══════════════════════════════════════════════════════════
  let ownershipScore = 0
  const W_OWN = prof.wOwnership
  const ow = e.ownership

  if (ow) {
    // Institutional ownership (40% of ownership pts)
    if (ow.institutionsPercentHeld != null) {
      const instPct = ow.institutionsPercentHeld * 100
      if (instPct >= 40 && instPct <= 85) ownershipScore += W_OWN * 0.4
      else if (instPct >= 20) ownershipScore += W_OWN * 0.2
    }

    // Insider ownership (30% of ownership pts)
    if (ow.insidersPercentHeld != null) {
      const insPct = ow.insidersPercentHeld * 100
      if (insPct >= 1 && insPct <= 30) ownershipScore += W_OWN * 0.3
      else if (insPct > 0) ownershipScore += W_OWN * 0.1
    }

    // Net insider Open Market activity (30% of ownership pts)
    // ONLY count Purchase and Sale — ignore Stock Award, Stock Gift, Option Exercise, RSU
    const txs = ow.insiderTransactions ?? []
    let openMarketBuys = 0
    let openMarketSells = 0
    for (const tx of txs) {
      if (isOpenMarketPurchase(tx.transactionType)) openMarketBuys++
      else if (isOpenMarketSale(tx.transactionType)) openMarketSells++
    }

    if (openMarketBuys > openMarketSells) {
      ownershipScore += W_OWN * 0.3 // Net buying
    } else if (openMarketBuys > 0 && openMarketBuys === openMarketSells) {
      ownershipScore += W_OWN * 0.15 // Neutral
    } else if (openMarketSells > 0 && openMarketBuys === 0) {
      ownershipScore += 0 // Only selling — no points
    } else {
      ownershipScore += W_OWN * 0.15 // No open market activity = neutral
    }

    details.push(`Insider OM: ${openMarketBuys} buy / ${openMarketSells} sell`)
  } else {
    ownershipScore = W_OWN * 0.5 // No data = neutral
  }

  ownershipScore = clamp(ownershipScore, 0, W_OWN)

  // ══════════════════════════════════════════════════════════
  // POPRAWKA 4: Final score = direct sum (weights sum to 100)
  // ══════════════════════════════════════════════════════════
  const total = clamp(
    Math.round(growthScore + profitScore + earningsQScore + forwardScore + dilutionScore + capitalScore + ownershipScore),
    1,
    100
  )

  return {
    total,
    growth: Math.round(growthScore),
    profitability: Math.round(profitScore),
    earningsQuality: Math.round(earningsQScore),
    forwardOutlook: Math.round(forwardScore),
    dilutionRisk: Math.round(dilutionScore),
    capitalStructure: Math.round(capitalScore),
    ownership: Math.round(ownershipScore * 10) / 10,
    maxGrowth: W_GROWTH,
    maxProfit: W_PROFIT,
    maxEarningsQ: W_EQ,
    maxForward: W_FWD,
    maxDilution: W_DIL,
    maxCapital: W_CAP,
    maxOwnership: W_OWN,
    sector,
    subIndustry: prof.name,
    details,
  }
}
