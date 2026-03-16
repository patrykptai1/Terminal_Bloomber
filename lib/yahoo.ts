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
  sector: string | null
  industry: string | null
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
    modules: ["financialData", "defaultKeyStatistics", "assetProfile"],
  })

  const fd: any = result.financialData ?? {}
  const ks: any = result.defaultKeyStatistics ?? {}
  const ap: any = result.assetProfile ?? {}

  return {
    sector: ap.sector ?? null,
    industry: ap.industry ?? null,
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

export interface ForwardEstimate {
  period: string
  endDate: string
  epsEstimate: number | null
  revEstimate: number | null
  revLow: number | null
  revHigh: number | null
  epsLow: number | null
  epsHigh: number | null
  yearAgoEps: number | null
  yearAgoRev: number | null
  // Revision data
  epsTrendCurrent: number | null
  epsTrend7d: number | null
  epsTrend30d: number | null
  epsTrend60d: number | null
  epsTrend90d: number | null
  epsRevisionsUp7d: number
  epsRevisionsUp30d: number
  epsRevisionsDown7d: number
  epsRevisionsDown30d: number
  revAnalysts: number
  epsAnalysts: number
}

export interface IncomeStatementEntry {
  date: string
  revenue: number | null
  ebitda: number | null
  netIncome: number | null
  grossProfit: number | null
  operatingIncome: number | null
  totalExpenses: number | null
  dilutedEPS: number | null
}

export interface AnnualIncomeEntry {
  date: string
  revenue: number | null
  ebitda: number | null
  netIncome: number | null
}

export interface CashFlowEntry {
  date: string
  operatingCashFlow: number | null
  capitalExpenditure: number | null
  freeCashFlow: number | null
  stockBasedCompensation: number | null
}

export interface BalanceSheetEntry {
  date: string
  cashAndEquivalents: number | null
  sharesOutstanding: number | null
}

export interface EarningsData {
  quarterly: EarningsEntry[]
  financials: FinancialsEntry[]
  forwardEstimates: ForwardEstimate[]
  incomeStatements: IncomeStatementEntry[]
  annualStatements: AnnualIncomeEntry[]
  cashFlowQuarterly: CashFlowEntry[]
  cashFlowAnnual: CashFlowEntry[]
  balanceSheetQuarterly: BalanceSheetEntry[]
  balanceSheetAnnual: BalanceSheetEntry[]
  gaapEpsTTM: number | null
}

export async function fetchEarnings(symbol: string): Promise<EarningsData> {
  const result: any = await yf.quoteSummary(symbol, {
    modules: [
      "earningsHistory",
      "earnings",
      "earningsTrend",
      "incomeStatementHistory",
      "incomeStatementHistoryQuarterly",
    ],
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

  // Forward estimates from earningsTrend (includes revision data)
  const et: any[] = result.earningsTrend?.trend ?? []
  const forwardEstimates: ForwardEstimate[] = et.map((e: any) => ({
    period: e.period ?? "",
    endDate: e.endDate
      ? (typeof e.endDate === "string" ? e.endDate : (e.endDate instanceof Date ? e.endDate.toISOString().split("T")[0] : new Date(e.endDate).toISOString().split("T")[0]))
      : "",
    epsEstimate: num(e.earningsEstimate?.avg),
    revEstimate: num(e.revenueEstimate?.avg),
    revLow: num(e.revenueEstimate?.low),
    revHigh: num(e.revenueEstimate?.high),
    epsLow: num(e.earningsEstimate?.low),
    epsHigh: num(e.earningsEstimate?.high),
    yearAgoEps: num(e.earningsEstimate?.yearAgoEps),
    yearAgoRev: num(e.revenueEstimate?.yearAgoRevenue),
    epsTrendCurrent: num(e.epsTrend?.current),
    epsTrend7d: num(e.epsTrend?.["7daysAgo"]),
    epsTrend30d: num(e.epsTrend?.["30daysAgo"]),
    epsTrend60d: num(e.epsTrend?.["60daysAgo"]),
    epsTrend90d: num(e.epsTrend?.["90daysAgo"]),
    epsRevisionsUp7d: e.epsRevisions?.upLast7days ?? 0,
    epsRevisionsUp30d: e.epsRevisions?.upLast30days ?? 0,
    epsRevisionsDown7d: e.epsRevisions?.downLast7Days ?? 0,
    epsRevisionsDown30d: e.epsRevisions?.downLast30days ?? 0,
    revAnalysts: e.revenueEstimate?.numberOfAnalysts ?? 0,
    epsAnalysts: e.earningsEstimate?.numberOfAnalysts ?? 0,
  }))

  // GAAP EPS TTM from earnings module
  const gaapEpsTTM = num(result.earnings?.financialsChart?.yearly?.slice(-1)?.[0]?.earnings)
    ?? (earningsChart.length >= 4
      ? earningsChart.slice(-4).reduce((s: number, e: any) => s + (e.earnings ?? 0), 0) / (num(result.earnings?.financialsChart?.yearly?.[0]?.revenue) ? 1 : 1)
      : null)

  // Income statements (quarterly) for Revenue & Net Income from quoteSummary
  const qStmts: any[] = result.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? []
  const basicQuarterly: IncomeStatementEntry[] = qStmts
    .slice(0, 8)
    .map((s: any) => ({
      date: s.endDate ? (s.endDate instanceof Date ? formatDate(s.endDate) : typeof s.endDate === "string" ? s.endDate.split("T")[0] : formatDate(new Date(s.endDate))) : "",
      revenue: num(s.totalRevenue),
      ebitda: num(s.ebitda),
      netIncome: num(s.netIncome),
      grossProfit: num(s.grossProfit),
      operatingIncome: num(s.operatingIncome),
      totalExpenses: num(s.totalExpenses ?? s.totalOperatingExpenses),
      dilutedEPS: num(s.dilutedEPS),
    }))
    .reverse()

  // Enrich with fundamentalsTimeSeries for EBITDA (quoteSummary doesn't return it since Nov 2024)
  let incomeStatements = basicQuarterly
  try {
    const fts: any[] = await yf.fundamentalsTimeSeries(symbol, {
      period1: "2020-01-01",
      type: "quarterly",
      module: "financials",
    })
    if (fts && fts.length > 0) {
      // Build map of FTS data by date
      const ftsMap = new Map<string, any>()
      for (const item of fts) {
        const d = item.date instanceof Date ? formatDate(item.date) : typeof item.date === "string" ? item.date.split("T")[0] : ""
        if (d) ftsMap.set(d, item)
      }

      // Merge: FTS has EBITDA + possibly more quarters
      const allDates = new Set([...basicQuarterly.map((s) => s.date), ...ftsMap.keys()])
      const merged: IncomeStatementEntry[] = []
      for (const d of allDates) {
        const basic = basicQuarterly.find((s) => s.date === d)
        const ftsItem = ftsMap.get(d)
        merged.push({
          date: d,
          revenue: basic?.revenue ?? num(ftsItem?.totalRevenue) ?? null,
          ebitda: num(ftsItem?.EBITDA) ?? basic?.ebitda ?? null,
          netIncome: basic?.netIncome ?? num(ftsItem?.netIncome) ?? null,
          grossProfit: basic?.grossProfit ?? num(ftsItem?.grossProfit) ?? null,
          operatingIncome: basic?.operatingIncome ?? num(ftsItem?.operatingIncome) ?? null,
          totalExpenses: basic?.totalExpenses ?? num(ftsItem?.totalExpenses) ?? null,
          dilutedEPS: basic?.dilutedEPS ?? num(ftsItem?.dilutedEPS) ?? null,
        })
      }
      incomeStatements = merged.sort((a, b) => a.date.localeCompare(b.date))
    }
  } catch {
    // fundamentalsTimeSeries may fail for some tickers — graceful fallback
  }

  // Annual income statements for long-term TTM trend
  const aStmts: any[] = result.incomeStatementHistory?.incomeStatementHistory ?? []
  const basicAnnual: AnnualIncomeEntry[] = aStmts
    .map((s: any) => ({
      date: s.endDate ? (s.endDate instanceof Date ? formatDate(s.endDate) : typeof s.endDate === "string" ? s.endDate.split("T")[0] : formatDate(new Date(s.endDate))) : "",
      revenue: num(s.totalRevenue),
      ebitda: num(s.ebitda),
      netIncome: num(s.netIncome),
    }))
    .reverse()

  // Enrich annual with fundamentalsTimeSeries for EBITDA (quoteSummary returns N/A)
  let annualStatements = basicAnnual
  try {
    const ftsAnnual: any[] = await yf.fundamentalsTimeSeries(symbol, {
      period1: "2018-01-01",
      type: "annual",
      module: "financials",
    })
    if (ftsAnnual && ftsAnnual.length > 0) {
      const ftsMap = new Map<string, any>()
      for (const item of ftsAnnual) {
        const d = item.date instanceof Date ? formatDate(item.date) : typeof item.date === "string" ? item.date.split("T")[0] : ""
        if (d) ftsMap.set(d, item)
      }
      const allDates = new Set([...basicAnnual.map((s) => s.date), ...ftsMap.keys()])
      const merged: AnnualIncomeEntry[] = []
      for (const d of allDates) {
        const basic = basicAnnual.find((s) => s.date === d)
        const ftsItem = ftsMap.get(d)
        merged.push({
          date: d,
          revenue: basic?.revenue ?? num(ftsItem?.totalRevenue) ?? null,
          ebitda: num(ftsItem?.EBITDA) ?? basic?.ebitda ?? null,
          netIncome: basic?.netIncome ?? num(ftsItem?.netIncome) ?? null,
        })
      }
      annualStatements = merged.sort((a, b) => a.date.localeCompare(b.date))
    }
  } catch {
    // graceful fallback
  }

  // Cash flow statements via fundamentalsTimeSeries
  let cashFlowQuarterly: CashFlowEntry[] = []
  let cashFlowAnnual: CashFlowEntry[] = []
  try {
    const cfQ: any[] = await yf.fundamentalsTimeSeries(symbol, { period1: "2020-01-01", type: "quarterly", module: "cash-flow" })
    cashFlowQuarterly = (cfQ ?? []).map((item: any) => ({
      date: item.date instanceof Date ? formatDate(item.date) : typeof item.date === "string" ? item.date.split("T")[0] : "",
      operatingCashFlow: num(item.operatingCashFlow) ?? num(item.cashFlowFromContinuingOperatingActivities),
      capitalExpenditure: num(item.capitalExpenditure) ?? num(item.purchaseOfPPE),
      freeCashFlow: num(item.freeCashFlow),
      stockBasedCompensation: num(item.stockBasedCompensation),
    })).sort((a: CashFlowEntry, b: CashFlowEntry) => a.date.localeCompare(b.date))
  } catch { /* graceful */ }
  try {
    const cfA: any[] = await yf.fundamentalsTimeSeries(symbol, { period1: "2018-01-01", type: "annual", module: "cash-flow" })
    cashFlowAnnual = (cfA ?? []).map((item: any) => ({
      date: item.date instanceof Date ? formatDate(item.date) : typeof item.date === "string" ? item.date.split("T")[0] : "",
      operatingCashFlow: num(item.operatingCashFlow) ?? num(item.cashFlowFromContinuingOperatingActivities),
      capitalExpenditure: num(item.capitalExpenditure) ?? num(item.purchaseOfPPE),
      freeCashFlow: num(item.freeCashFlow),
      stockBasedCompensation: num(item.stockBasedCompensation),
    })).sort((a: CashFlowEntry, b: CashFlowEntry) => a.date.localeCompare(b.date))
  } catch { /* graceful */ }

  // Balance sheet via fundamentalsTimeSeries
  let balanceSheetQuarterly: BalanceSheetEntry[] = []
  let balanceSheetAnnual: BalanceSheetEntry[] = []
  try {
    const bsQ: any[] = await yf.fundamentalsTimeSeries(symbol, { period1: "2020-01-01", type: "quarterly", module: "balance-sheet" })
    balanceSheetQuarterly = (bsQ ?? []).map((item: any) => ({
      date: item.date instanceof Date ? formatDate(item.date) : typeof item.date === "string" ? item.date.split("T")[0] : "",
      cashAndEquivalents: num(item.cashAndCashEquivalents) ?? num(item.cashCashEquivalentsAndShortTermInvestments),
      sharesOutstanding: num(item.ordinarySharesNumber) ?? num(item.shareIssued),
    })).filter((b: BalanceSheetEntry) => b.cashAndEquivalents != null || b.sharesOutstanding != null)
      .sort((a: BalanceSheetEntry, b: BalanceSheetEntry) => a.date.localeCompare(b.date))
  } catch { /* graceful */ }
  try {
    const bsA: any[] = await yf.fundamentalsTimeSeries(symbol, { period1: "2018-01-01", type: "annual", module: "balance-sheet" })
    balanceSheetAnnual = (bsA ?? []).map((item: any) => ({
      date: item.date instanceof Date ? formatDate(item.date) : typeof item.date === "string" ? item.date.split("T")[0] : "",
      cashAndEquivalents: num(item.cashAndCashEquivalents) ?? num(item.cashCashEquivalentsAndShortTermInvestments),
      sharesOutstanding: num(item.ordinarySharesNumber) ?? num(item.shareIssued),
    })).filter((b: BalanceSheetEntry) => b.cashAndEquivalents != null || b.sharesOutstanding != null)
      .sort((a: BalanceSheetEntry, b: BalanceSheetEntry) => a.date.localeCompare(b.date))
  } catch { /* graceful */ }

  return { quarterly, financials, forwardEstimates, incomeStatements, annualStatements, cashFlowQuarterly, cashFlowAnnual, balanceSheetQuarterly, balanceSheetAnnual, gaapEpsTTM }
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

// ── Analyst Recommendations ──────────────────────────────────

export interface AnalystUpgrade {
  date: string
  firm: string
  toGrade: string
  fromGrade: string
  action: string
  priceTargetAction: string
  currentPriceTarget: number | null
  priorPriceTarget: number | null
}

export interface RecommendationPeriod {
  period: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

export interface EarningsForecast {
  period: string
  endDate: string
  growth: number | null
  epsAvg: number | null
  epsLow: number | null
  epsHigh: number | null
  yearAgoEps: number | null
  epsAnalysts: number
  revAvg: number | null
  revLow: number | null
  revHigh: number | null
  revAnalysts: number
  yearAgoRev: number | null
  revGrowth: number | null
  epsTrend: { current: number | null; d7: number | null; d30: number | null; d60: number | null; d90: number | null }
  epsRevisions: { upLast7d: number; upLast30d: number; downLast7d: number; downLast30d: number }
}

export interface AnalystData {
  upgrades: AnalystUpgrade[]
  recommendations: RecommendationPeriod[]
  forecasts: EarningsForecast[]
  targetHigh: number | null
  targetLow: number | null
  targetMean: number | null
  targetMedian: number | null
  recommendationMean: number | null
  recommendationKey: string | null
  numberOfAnalysts: number
  currentPrice: number
}

export async function fetchAnalystData(symbol: string): Promise<AnalystData> {
  const result: any = await yf.quoteSummary(symbol, {
    modules: ["recommendationTrend", "upgradeDowngradeHistory", "financialData", "earningsTrend"],
  })

  const fd: any = result.financialData ?? {}
  const udh: any[] = result.upgradeDowngradeHistory?.history ?? []
  const rt: any[] = result.recommendationTrend?.trend ?? []
  const et: any[] = result.earningsTrend?.trend ?? []

  const upgrades: AnalystUpgrade[] = udh.slice(0, 20).map((u: any) => ({
    date: u.epochGradeDate
      ? (u.epochGradeDate instanceof Date
          ? u.epochGradeDate.toISOString().split("T")[0]
          : typeof u.epochGradeDate === "string"
            ? u.epochGradeDate.split("T")[0]
            : new Date(u.epochGradeDate * 1000).toISOString().split("T")[0])
      : "",
    firm: u.firm ?? "",
    toGrade: u.toGrade ?? "",
    fromGrade: u.fromGrade ?? "",
    action: u.action ?? "",
    priceTargetAction: u.priceTargetAction ?? "",
    currentPriceTarget: num(u.currentPriceTarget),
    priorPriceTarget: num(u.priorPriceTarget),
  }))

  const recommendations: RecommendationPeriod[] = rt.map((r: any) => ({
    period: r.period ?? "",
    strongBuy: r.strongBuy ?? 0,
    buy: r.buy ?? 0,
    hold: r.hold ?? 0,
    sell: r.sell ?? 0,
    strongSell: r.strongSell ?? 0,
  }))

  const forecasts: EarningsForecast[] = et.map((e: any) => ({
    period: e.period ?? "",
    endDate: e.endDate ? (typeof e.endDate === "string" ? e.endDate : new Date(e.endDate).toISOString().split("T")[0]) : "",
    growth: num(e.growth),
    epsAvg: num(e.earningsEstimate?.avg),
    epsLow: num(e.earningsEstimate?.low),
    epsHigh: num(e.earningsEstimate?.high),
    yearAgoEps: num(e.earningsEstimate?.yearAgoEps),
    epsAnalysts: e.earningsEstimate?.numberOfAnalysts ?? 0,
    revAvg: num(e.revenueEstimate?.avg),
    revLow: num(e.revenueEstimate?.low),
    revHigh: num(e.revenueEstimate?.high),
    revAnalysts: e.revenueEstimate?.numberOfAnalysts ?? 0,
    yearAgoRev: num(e.revenueEstimate?.yearAgoRevenue),
    revGrowth: num(e.revenueEstimate?.growth),
    epsTrend: {
      current: num(e.epsTrend?.current),
      d7: num(e.epsTrend?.["7daysAgo"]),
      d30: num(e.epsTrend?.["30daysAgo"]),
      d60: num(e.epsTrend?.["60daysAgo"]),
      d90: num(e.epsTrend?.["90daysAgo"]),
    },
    epsRevisions: {
      upLast7d: e.epsRevisions?.upLast7days ?? 0,
      upLast30d: e.epsRevisions?.upLast30days ?? 0,
      downLast7d: e.epsRevisions?.downLast7Days ?? 0,
      downLast30d: e.epsRevisions?.downLast30days ?? 0,
    },
  }))

  return {
    upgrades,
    recommendations,
    forecasts,
    targetHigh: num(fd.targetHighPrice),
    targetLow: num(fd.targetLowPrice),
    targetMean: num(fd.targetMeanPrice),
    targetMedian: num(fd.targetMedianPrice),
    recommendationMean: num(fd.recommendationMean),
    recommendationKey: fd.recommendationKey ?? null,
    numberOfAnalysts: fd.numberOfAnalystOpinions ?? 0,
    currentPrice: fd.currentPrice ?? 0,
  }
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
