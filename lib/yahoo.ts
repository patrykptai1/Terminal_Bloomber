// ============================================================
// Yahoo Finance data fetching via yahoo-finance2 (v3)
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import YahooFinanceModule from "yahoo-finance2"

// v3 requires instantiation
const yf = new (YahooFinanceModule as any)({ suppressNotices: ["yahooSurvey"] })

export interface QuoteData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  avgVolume: number
  marketCap: number
  peRatio: number | null
  forwardPE: number | null
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
  beta: number | null
  targetMeanPrice: number | null
  targetHighPrice: number | null
  targetLowPrice: number | null
  recommendationMean: number | null
  recommendationKey: string | null
  numberOfAnalysts: number | null
}

export async function fetchQuote(symbol: string): Promise<QuoteData> {
  const q: any = await yf.quote(symbol)
  if (!q) throw new Error(`No data for ${symbol}`)

  return {
    symbol: q.symbol ?? symbol,
    name: q.longName ?? q.shortName ?? symbol,
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    volume: q.regularMarketVolume ?? 0,
    avgVolume: q.averageDailyVolume3Month ?? 0,
    marketCap: q.marketCap ?? 0,
    peRatio: num(q.trailingPE),
    forwardPE: num(q.forwardPE),
    eps: num(q.epsTrailingTwelveMonths),
    dividend: num(q.dividendRate),
    dividendYield: num(q.dividendYield),
    high52: q.fiftyTwoWeekHigh ?? 0,
    low52: q.fiftyTwoWeekLow ?? 0,
    dayHigh: q.regularMarketDayHigh ?? 0,
    dayLow: q.regularMarketDayLow ?? 0,
    open: q.regularMarketOpen ?? 0,
    previousClose: q.regularMarketPreviousClose ?? 0,
    exchange: q.fullExchangeName ?? q.exchange ?? "",
    currency: q.currency ?? "USD",
    beta: num(q.beta),
    targetMeanPrice: num(q.targetMeanPrice),
    targetHighPrice: num(q.targetHighPrice),
    targetLowPrice: num(q.targetLowPrice),
    recommendationMean: num(q.recommendationMean),
    recommendationKey: q.recommendationKey ?? null,
    numberOfAnalysts: num(q.numberOfAnalystOpinions),
  }
}

export interface KeyStatistics {
  enterpriseValue: number | null
  forwardPE: number | null
  pegRatio: number | null
  priceToBook: number | null
  priceToSales: number | null
  enterpriseToRevenue: number | null
  enterpriseToEbitda: number | null
  profitMargin: number | null
  operatingMargin: number | null
  returnOnEquity: number | null
  returnOnAssets: number | null
  revenueGrowth: number | null
  earningsGrowth: number | null
  currentRatio: number | null
  debtToEquity: number | null
  freeCashFlow: number | null
  operatingCashFlow: number | null
  totalRevenue: number | null
  totalDebt: number | null
  totalCash: number | null
  bookValue: number | null
  sharesOutstanding: number | null
  shortRatio: number | null
  shortPercentOfFloat: number | null
  heldByInstitutions: number | null
  heldByInsiders: number | null
}

export async function fetchKeyStats(symbol: string): Promise<KeyStatistics> {
  const result: any = await yf.quoteSummary(symbol, {
    modules: ["financialData", "defaultKeyStatistics"],
  })

  const fd: any = result.financialData ?? {}
  const ks: any = result.defaultKeyStatistics ?? {}

  return {
    enterpriseValue: num(ks.enterpriseValue),
    forwardPE: num(ks.forwardPE),
    pegRatio: num(ks.pegRatio),
    priceToBook: num(ks.priceToBook),
    priceToSales: num(ks.priceToSalesTrailing12Months),
    enterpriseToRevenue: num(ks.enterpriseToRevenue),
    enterpriseToEbitda: num(ks.enterpriseToEbitda),
    profitMargin: num(ks.profitMargins),
    operatingMargin: num(fd.operatingMargins),
    returnOnEquity: num(fd.returnOnEquity),
    returnOnAssets: num(fd.returnOnAssets),
    revenueGrowth: num(fd.revenueGrowth),
    earningsGrowth: num(fd.earningsGrowth),
    currentRatio: num(fd.currentRatio),
    debtToEquity: num(fd.debtToEquity),
    freeCashFlow: num(fd.freeCashflow),
    operatingCashFlow: num(fd.operatingCashflow),
    totalRevenue: num(fd.totalRevenue),
    totalDebt: num(fd.totalDebt),
    totalCash: num(fd.totalCash),
    bookValue: num(ks.bookValue),
    sharesOutstanding: num(ks.sharesOutstanding),
    shortRatio: num(ks.shortRatio),
    shortPercentOfFloat: num(ks.shortPercentOfFloat),
    heldByInstitutions: num(ks.heldPercentInstitutions),
    heldByInsiders: num(ks.heldPercentInsiders),
  }
}

export interface EarningsEntry {
  date: string
  actual: number | null
  estimate: number | null
  surprise: number | null
  surprisePercent: number | null
}

export interface FinancialsEntry {
  date: string
  revenue: number | null
  earnings: number | null
}

export interface EarningsData {
  quarterly: EarningsEntry[]
  financials: FinancialsEntry[]
}

export async function fetchEarnings(symbol: string): Promise<EarningsData> {
  const result: any = await yf.quoteSummary(symbol, {
    modules: ["earningsHistory", "earnings"],
  })

  const history: any[] = result.earningsHistory?.history ?? []
  const quarterly: EarningsEntry[] = history.map((h: any) => ({
    date: h.quarter ? formatDate(new Date(h.quarter)) : "",
    actual: num(h.epsActual),
    estimate: num(h.epsEstimate),
    surprise: num(h.epsDifference),
    surprisePercent: h.surprisePercent != null ? h.surprisePercent * 100 : null,
  }))

  const earningsChart: any[] = result.earnings?.financialsChart?.quarterly ?? []
  const financials: FinancialsEntry[] = earningsChart.map((e: any) => ({
    date: e.date ?? "",
    revenue: num(e.revenue),
    earnings: num(e.earnings),
  }))

  return { quarterly, financials }
}

export interface HistoricalPrice {
  date: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export async function fetchHistory(
  symbol: string,
  period: "1mo" | "3mo" | "6mo" | "1y" | "5y" = "6mo"
): Promise<HistoricalPrice[]> {
  const result: any = await yf.chart(symbol, {
    period1: periodToDate(period),
    interval: period === "5y" ? "1wk" : period === "1y" ? "1wk" : "1d",
  })

  return (result.quotes ?? []).map((q: any) => ({
    date: q.date,
    open: q.open ?? 0,
    high: q.high ?? 0,
    low: q.low ?? 0,
    close: q.close ?? 0,
    volume: q.volume ?? 0,
  }))
}

export async function searchTickers(
  query: string
): Promise<{ symbol: string; name: string; exchange: string; type: string }[]> {
  const result: any = await yf.search(query)
  return (result.quotes ?? [])
    .filter((q: any) => q.quoteType === "EQUITY")
    .map((q: any) => ({
      symbol: q.symbol ?? "",
      name: q.shortname ?? q.longname ?? q.symbol ?? "",
      exchange: q.exchDisp ?? "",
      type: q.typeDisp ?? "Equity",
    }))
}

export async function fetchMultipleQuotes(symbols: string[]): Promise<QuoteData[]> {
  const results = await Promise.allSettled(symbols.map((s) => fetchQuote(s)))
  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<QuoteData>).value)
}

// --- helpers ---

function num(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v
  return null
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function periodToDate(period: string): Date {
  const d = new Date()
  switch (period) {
    case "1mo": d.setMonth(d.getMonth() - 1); break
    case "3mo": d.setMonth(d.getMonth() - 3); break
    case "6mo": d.setMonth(d.getMonth() - 6); break
    case "1y": d.setFullYear(d.getFullYear() - 1); break
    case "5y": d.setFullYear(d.getFullYear() - 5); break
  }
  return d
}
