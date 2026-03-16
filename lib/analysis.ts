// ============================================================
// WallStreet AI Terminal — Full Analysis Engine
// Computes MARKET_DATA block from yahoo-finance2 data
// ============================================================

import type { QuoteData, KeyStatistics, HistoricalPrice } from "@/lib/yahoo"

// --- Interfaces ---

export interface FullAnalysis {
  verdict: "BUY" | "HOLD" | "SELL" | "AVOID"
  thesis: string
  confidence: "High" | "Medium" | "Low"

  entry: number
  stopLoss: number
  stopLossPct: number
  target1: number
  target1Pct: number
  target2: number
  target2Pct: number
  riskReward: number

  checklist: {
    valuationReasonable: boolean | null
    revenueGrowthPositive: boolean | null
    marginsStable: boolean | null
    balanceSheetHealthy: boolean | null
    aboveMA50: boolean | null
    aboveMA200: boolean | null
    noExcessivePremium: boolean | null
    sectorTailwind: boolean | null
  }

  mainRisk: string

  ma50: number | null
  ma200: number | null
  rsi: number | null
  distanceFromMA50Pct: number | null
  distanceFromMA200Pct: number | null
  distanceFrom52High: number
  distanceFrom52Low: number

  peFwd: number | null
  evEbitda: number | null
  pfcf: number | null
  sectorPE: number
  premiumToSectorPE: number | null

  grossMargin: number | null
  operatingMargin: number | null
  fcfMargin: number | null
  debtEbitda: number | null
  roe: number | null
  revenueGrowth: number | null

  riskMatrix: {
    name: string
    probability: "Low" | "Medium" | "High"
    impact: "Low" | "Medium" | "High"
    score: number
    mitigation: string
  }[]
  overallRiskScore: number

  bullCase: { probability: number; returnPct: number; price: number }
  baseCase: { probability: number; returnPct: number; price: number }
  bearCase: { probability: number; returnPct: number; price: number }
  expectedReturn: number

  sector: string
}

// --- Sector PE Map ---

const SECTOR_PE: Record<string, number> = {
  Technology: 28.5,
  Healthcare: 22.1,
  "Financial Services": 14.8,
  "Consumer Cyclical": 24.3,
  "Consumer Defensive": 21.7,
  Energy: 12.4,
  Industrials: 21.9,
  "Basic Materials": 17.2,
  "Real Estate": 35.4,
  Utilities: 18.6,
  "Communication Services": 20.1,
}

const DEFAULT_SECTOR_PE = 21.0

// --- Technical helpers ---

function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null

  let gains = 0
  let losses = 0

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }

  const avgGain = gains / period
  const avgLoss = losses / period

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function pctDiff(price: number, ref: number): number {
  if (ref === 0) return 0
  return ((price - ref) / ref) * 100
}

function riskLevel(score: number): "Low" | "Medium" | "High" {
  if (score <= 3) return "Low"
  if (score <= 6) return "Medium"
  return "High"
}

function clampScore(v: number): number {
  return Math.max(1, Math.min(9, Math.round(v)))
}

// --- Main function ---

export function computeFullAnalysis(
  quote: QuoteData,
  stats: KeyStatistics | null,
  history: HistoricalPrice[],
  sectorOverride?: string
): FullAnalysis {
  const price = quote.price
  const closes = history.filter((h) => h.close > 0).map((h) => h.close)
  const lows = history.filter((h) => h.low > 0).map((h) => h.low)

  // --- Technicals ---
  const ma50 = computeSMA(closes, 50)
  const ma200 = computeSMA(closes, 200)
  const rsi = computeRSI(closes, 14)

  const distanceFromMA50Pct = ma50 != null ? pctDiff(price, ma50) : null
  const distanceFromMA200Pct = ma200 != null ? pctDiff(price, ma200) : null
  const distanceFrom52High = quote.high52 > 0 ? pctDiff(price, quote.high52) : 0
  const distanceFrom52Low = quote.low52 > 0 ? pctDiff(price, quote.low52) : 0

  // --- Sector ---
  // yahoo-finance2 quote doesn't expose sector directly; use a heuristic
  // We'll try to infer from the exchange name or default
  const sector = sectorOverride || "Technology"
  const sectorPE = SECTOR_PE[sector] ?? DEFAULT_SECTOR_PE

  // --- Valuation ---
  const peFwd = quote.forwardPE
  const evEbitda = stats?.enterpriseToEbitda ?? null
  const fcf = stats?.freeCashFlow
  const totalRev = stats?.totalRevenue
  const pfcf =
    fcf != null && fcf > 0 && quote.marketCap > 0
      ? quote.marketCap / fcf
      : null
  const premiumToSectorPE =
    peFwd != null ? ((peFwd - sectorPE) / sectorPE) * 100 : null

  // --- Fundamentals ---
  const profitMargin = stats?.profitMargin != null ? stats.profitMargin * 100 : null
  const operatingMargin = stats?.operatingMargin != null ? stats.operatingMargin * 100 : null
  const fcfMargin =
    fcf != null && totalRev != null && totalRev > 0
      ? (fcf / totalRev) * 100
      : null
  const debtEbitda = stats?.enterpriseToEbitda ?? null
  const roe = stats?.returnOnEquity != null ? stats.returnOnEquity * 100 : null
  const revenueGrowth = stats?.revenueGrowth != null ? stats.revenueGrowth * 100 : null

  // --- Checklist ---
  const valuationReasonable =
    peFwd != null ? peFwd < sectorPE * 1.5 : null
  const revenueGrowthPositive =
    revenueGrowth != null ? revenueGrowth > 0 : null
  const marginsStable =
    operatingMargin != null ? operatingMargin > 0 : null
  const balanceSheetHealthy =
    stats?.currentRatio != null
      ? stats.currentRatio > 1.0
      : stats?.debtToEquity != null
        ? stats.debtToEquity < 150
        : null
  const aboveMA50 = ma50 != null ? price > ma50 : null
  const aboveMA200 = ma200 != null ? price > ma200 : null
  const noExcessivePremium =
    premiumToSectorPE != null ? premiumToSectorPE < 50 : null
  // Sector tailwind: positive revenue growth + price trending up
  const sectorTailwind =
    revenueGrowth != null && ma50 != null
      ? revenueGrowth > 5 && price > ma50
      : null

  const checklist = {
    valuationReasonable,
    revenueGrowthPositive,
    marginsStable,
    balanceSheetHealthy,
    aboveMA50,
    aboveMA200,
    noExcessivePremium,
    sectorTailwind,
  }

  // --- Verdict ---
  let checkScore = 0
  let aligned = 0
  for (const v of Object.values(checklist)) {
    if (v === true) {
      checkScore++
      aligned++
    } else if (v === false) {
      checkScore--
      aligned++
    }
  }

  let verdict: "BUY" | "HOLD" | "SELL" | "AVOID"
  if (checkScore >= 5) verdict = "BUY"
  else if (checkScore >= 2) verdict = "HOLD"
  else if (checkScore >= -1) verdict = "SELL"
  else verdict = "AVOID"

  let confidence: "High" | "Medium" | "Low"
  if (aligned >= 6) confidence = "High"
  else if (aligned >= 4) confidence = "Medium"
  else confidence = "Low"

  // --- Entry / Stop / Targets ---
  const entry = price

  // Support: min of recent lows or 90% of price
  const recentLows = lows.slice(-50)
  const nearestSupport =
    recentLows.length > 0 ? Math.min(...recentLows) : price * 0.9
  const stopFromMA200 = ma200 != null ? ma200 : price * 0.9
  const stopLoss = Math.max(
    Math.min(stopFromMA200, price * 0.95),
    nearestSupport,
    price * 0.85 // hard floor: max 15% loss
  )
  // But stopLoss must be below price
  const finalStopLoss = Math.min(stopLoss, price * 0.95)
  const stopLossPct = pctDiff(finalStopLoss, price)

  const target1Raw = quote.targetMeanPrice ?? price * 1.15
  const target1 = Math.min(target1Raw, price * 1.5) // cap at 50% upside
  const target1Pct = pctDiff(target1, price)

  const target2Raw = quote.targetHighPrice ?? price * 1.3
  const target2 = Math.min(target2Raw, price * 2.0) // cap at 100% upside
  const target2Pct = pctDiff(target2, price)

  const downside = price - finalStopLoss
  const riskReward = downside > 0 ? (target1 - price) / downside : 0

  // --- Thesis ---
  const thesisParts: string[] = []
  if (verdict === "BUY") {
    if (revenueGrowthPositive) thesisParts.push("strong revenue growth")
    if (aboveMA50 && aboveMA200) thesisParts.push("solid uptrend")
    if (valuationReasonable) thesisParts.push("reasonable valuation")
    if (thesisParts.length === 0) thesisParts.push("positive fundamentals")
    thesisParts.unshift(`${quote.name} shows`)
  } else if (verdict === "HOLD") {
    thesisParts.push(`${quote.name} has mixed signals — hold for now`)
  } else if (verdict === "SELL") {
    thesisParts.push(`${quote.name} shows deteriorating metrics`)
  } else {
    thesisParts.push(`${quote.name} has too many red flags to invest`)
  }
  const thesis = thesisParts.join(", ") + "."

  // --- Main Risk ---
  let mainRisk = "General market downturn"
  if (peFwd != null && peFwd > sectorPE * 2)
    mainRisk = "Extremely high valuation — vulnerable to correction"
  else if (stats?.debtToEquity != null && stats.debtToEquity > 200)
    mainRisk = "High debt levels — sensitive to interest rate changes"
  else if (revenueGrowth != null && revenueGrowth < -5)
    mainRisk = "Revenue decline — business may be shrinking"
  else if (rsi != null && rsi > 75)
    mainRisk = "Overbought on RSI — short-term pullback likely"
  else if (distanceFrom52High < -30)
    mainRisk = "Significant drawdown from highs — trend may be broken"
  else if (peFwd != null && peFwd > sectorPE * 1.3)
    mainRisk = `Premium valuation at ${peFwd.toFixed(1)}x vs sector ${sectorPE.toFixed(1)}x — limited margin of safety`
  else if (stats?.debtToEquity != null && stats.debtToEquity > 100)
    mainRisk = "Elevated leverage — earnings sensitive to interest rate environment"
  else if (rsi != null && rsi > 65)
    mainRisk = "Momentum stretched — near-term consolidation possible"
  else if (distanceFrom52High < -15)
    mainRisk = "Pullback from highs — watch for support confirmation"
  else if (profitMargin != null && profitMargin < 30)
    mainRisk = "Low margins — vulnerable to input cost inflation"
  else if (peFwd != null && peFwd > sectorPE)
    mainRisk = `Trading above sector average (${peFwd.toFixed(1)}x vs ${sectorPE.toFixed(1)}x) — growth must justify premium`
  else if (revenueGrowth != null && revenueGrowth > 30)
    mainRisk = "Rapid growth may attract competition and compress margins over time"
  else if (operatingMargin != null && operatingMargin > 30)
    mainRisk = "High profitability invites competitive pressure and regulatory scrutiny"
  else
    mainRisk = `Sector-wide risks: macroeconomic slowdown, regulatory changes in ${sector}`

  // --- Risk Matrix ---
  // Valuation Risk
  const valScore = clampScore(
    peFwd != null
      ? peFwd > sectorPE * 2
        ? 8
        : peFwd > sectorPE * 1.5
          ? 6
          : peFwd > sectorPE
            ? 4
            : 2
      : 5
  )

  // Industry Disruption
  const disruptScore = clampScore(
    revenueGrowth != null
      ? revenueGrowth < 0
        ? 7
        : revenueGrowth < 5
          ? 5
          : 3
      : 5
  )

  // Balance Sheet
  const bsScore = clampScore(
    stats?.debtToEquity != null
      ? stats.debtToEquity > 200
        ? 8
        : stats.debtToEquity > 100
          ? 6
          : stats.debtToEquity > 50
            ? 4
            : 2
      : 5
  )

  // Macro/Rates
  const macroScore = clampScore(
    quote.beta != null
      ? Math.abs(quote.beta) > 1.5
        ? 7
        : Math.abs(quote.beta) > 1.0
          ? 5
          : 3
      : 5
  )

  // Competitive Threat
  const compScore = clampScore(
    operatingMargin != null
      ? operatingMargin < 5
        ? 7
        : operatingMargin < 15
          ? 5
          : 3
      : 5
  )

  // Execution Risk
  const execScore = clampScore(
    revenueGrowth != null && operatingMargin != null
      ? revenueGrowth < 0 && operatingMargin < 10
        ? 8
        : revenueGrowth < 0 || operatingMargin < 10
          ? 6
          : 3
      : 5
  )

  const riskMatrix = [
    {
      name: "Valuation Risk",
      probability: riskLevel(valScore),
      impact: riskLevel(Math.min(valScore + 1, 9)) as "Low" | "Medium" | "High",
      score: valScore,
      mitigation: "Monitor P/E vs sector. Set stop-loss at support.",
    },
    {
      name: "Industry Disruption",
      probability: riskLevel(disruptScore),
      impact: "High" as const,
      score: disruptScore,
      mitigation: "Track competitive landscape and innovation pipeline.",
    },
    {
      name: "Balance Sheet",
      probability: riskLevel(bsScore),
      impact: riskLevel(bsScore) as "Low" | "Medium" | "High",
      score: bsScore,
      mitigation: "Monitor debt covenants and refinancing schedule.",
    },
    {
      name: "Macro / Rates",
      probability: riskLevel(macroScore),
      impact: "Medium" as const,
      score: macroScore,
      mitigation: "Hedge with sector rotation; watch Fed policy.",
    },
    {
      name: "Competitive Threat",
      probability: riskLevel(compScore),
      impact: "Medium" as const,
      score: compScore,
      mitigation: "Monitor market share and margin trends quarterly.",
    },
    {
      name: "Execution Risk",
      probability: riskLevel(execScore),
      impact: "High" as const,
      score: execScore,
      mitigation: "Watch earnings guidance and management turnover.",
    },
  ]

  const overallRiskScore = Math.round(
    riskMatrix.reduce((s, r) => s + r.score, 0) / riskMatrix.length
  )

  // --- Bull / Base / Bear ---
  const momentumPositive = aboveMA50 === true && aboveMA200 === true
  const bullProb = momentumPositive ? 35 : 25
  const bearProb = momentumPositive ? 20 : 30
  const baseProb = 100 - bullProb - bearProb

  const bullPrice = target2
  const basePrice = target1
  const bearPrice = finalStopLoss

  const bullReturn = pctDiff(bullPrice, price)
  const baseReturn = pctDiff(basePrice, price)
  const bearReturn = pctDiff(bearPrice, price)

  const expectedReturn =
    (bullProb * bullReturn + baseProb * baseReturn + bearProb * bearReturn) / 100

  return {
    verdict,
    thesis,
    confidence,

    entry,
    stopLoss: round2(finalStopLoss),
    stopLossPct: round2(stopLossPct),
    target1: round2(target1),
    target1Pct: round2(target1Pct),
    target2: round2(target2),
    target2Pct: round2(target2Pct),
    riskReward: round2(riskReward),

    checklist,
    mainRisk,

    ma50: ma50 != null ? round2(ma50) : null,
    ma200: ma200 != null ? round2(ma200) : null,
    rsi: rsi != null ? round2(rsi) : null,
    distanceFromMA50Pct: distanceFromMA50Pct != null ? round2(distanceFromMA50Pct) : null,
    distanceFromMA200Pct: distanceFromMA200Pct != null ? round2(distanceFromMA200Pct) : null,
    distanceFrom52High: round2(distanceFrom52High),
    distanceFrom52Low: round2(distanceFrom52Low),

    peFwd,
    evEbitda,
    pfcf: pfcf != null ? round2(pfcf) : null,
    sectorPE,
    premiumToSectorPE: premiumToSectorPE != null ? round2(premiumToSectorPE) : null,

    grossMargin: profitMargin, // profit margin as proxy for gross margin
    operatingMargin: operatingMargin != null ? round2(operatingMargin) : null,
    fcfMargin: fcfMargin != null ? round2(fcfMargin) : null,
    debtEbitda: debtEbitda != null ? round2(debtEbitda) : null,
    roe: roe != null ? round2(roe) : null,
    revenueGrowth: revenueGrowth != null ? round2(revenueGrowth) : null,

    riskMatrix,
    overallRiskScore,

    bullCase: {
      probability: bullProb,
      returnPct: round2(bullReturn),
      price: round2(bullPrice),
    },
    baseCase: {
      probability: baseProb,
      returnPct: round2(baseReturn),
      price: round2(basePrice),
    },
    bearCase: {
      probability: bearProb,
      returnPct: round2(bearReturn),
      price: round2(bearPrice),
    },
    expectedReturn: round2(expectedReturn),

    sector,
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
