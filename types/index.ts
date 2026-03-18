// ============================================================
// Terminal Bloomberg — Types
// ============================================================

export interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  marketCap: number
  peRatio: number | null
  eps: number | null
  dividend: number | null
  dividendYield: number | null
  high52: number
  low52: number
  dayHigh: number
  dayLow: number
  open: number
  previousClose: number
  exchange: string
  currency: string
}

export interface StockFinancials {
  revenue: number[]
  revenueGrowth: number[]
  netIncome: number[]
  profitMargin: number[]
  operatingMargin: number[]
  debtToEquity: number | null
  currentRatio: number | null
  quickRatio: number | null
  roe: number | null
  roa: number | null
  freeCashFlow: number | null
  periods: string[]
}

export interface StockAnalysis {
  ticker: string
  recommendation: "BUY" | "HOLD" | "SELL"
  confidence: number
  summary: string
  sections: {
    title: string
    content: string
    sentiment: "positive" | "neutral" | "negative"
  }[]
  risks: string[]
  catalysts: string[]
  priceTarget?: { low: number; mid: number; high: number }
}

export interface ScreenerCriteria {
  strategy: string
  metrics: {
    name: string
    threshold: string
    description: string
  }[]
  explanation: string
}

export interface EarningsAnalysis {
  company: string
  quarter: string
  beats: string[]
  misses: string[]
  guidance: string
  investmentImpact: string
  keyMetrics: { name: string; actual: string; expected: string; status: "beat" | "miss" | "inline" }[]
}

export interface RiskAssessment {
  ticker: string
  overallRisk: "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH"
  riskScore: number
  categories: {
    name: string
    level: "LOW" | "MEDIUM" | "HIGH"
    description: string
  }[]
  worstCase: string
  mitigants: string[]
}

export interface StockComparison {
  stockA: string
  stockB: string
  winner: string
  comparison: {
    category: string
    stockAScore: number
    stockBScore: number
    analysis: string
  }[]
  verdict: string
}

export interface PortfolioPick {
  ticker: string
  name: string
  allocation: number
  thesis: string
  sector: string
  type: string
}

export interface Portfolio {
  strategy: string
  totalAmount: number
  horizon: string
  picks: PortfolioPick[]
  diversificationNote: string
}

export interface EntryAnalysis {
  ticker: string
  currentPrice: number
  recommendation: "BUY_NOW" | "WAIT" | "SET_LIMIT"
  targetEntry?: number
  supportLevels: number[]
  resistanceLevels: number[]
  analysis: string
  technicalSignals: { name: string; signal: "bullish" | "bearish" | "neutral" }[]
}

export type TabId =
  | "analysis"
  | "screener"
  | "earnings"
  | "risk"
  | "compare"
  | "portfolio"
  | "entry"
  | "analyst"
  | "sectors"
  | "worldnews"
  | "sankey"
