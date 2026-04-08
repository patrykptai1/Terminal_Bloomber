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
    healthyFCFYield: boolean | null
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

// FIX #19: Updated sector PE benchmarks (2025-2026 forward PE estimates)
// Note: Real Estate uses P/FFO (~18x) not P/E; Financial Services better judged by P/Book
const SECTOR_PE: Record<string, number> = {
  Technology: 35.0,
  Healthcare: 24.0,
  "Financial Services": 16.0,
  "Consumer Cyclical": 26.0,
  "Consumer Defensive": 22.0,
  Energy: 13.0,
  Industrials: 23.0,
  "Basic Materials": 18.0,
  "Real Estate": 18.0,   // P/FFO equivalent, not trailing P/E
  Utilities: 19.0,
  "Communication Services": 22.0,
}

const DEFAULT_SECTOR_PE = 22.0

// --- Technical helpers ---

function computeSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function computeRSI(closes: number[], period: number = 14): number | null {
  // FIX #3: Wilder's smoothed RSI (EMA with alpha = 1/period)
  if (closes.length < period + 1) return null

  // Step 1: Initial SMA for first 'period' changes
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period

  // Step 2: Wilder's smoothing for remaining bars
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

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
  // FIX #4: Default sector is "Unknown" not "Technology" — avoids wrong PE benchmark
  const sector = sectorOverride || "Unknown"
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
  // FIX #1: Use real gross margins, not profit margin as proxy
  const grossMarginRaw = stats?.grossMargins != null ? stats.grossMargins * 100 : null
  const profitMargin = stats?.profitMargin != null ? stats.profitMargin * 100 : null
  const operatingMargin = stats?.operatingMargin != null ? stats.operatingMargin * 100 : null
  const fcfMargin =
    fcf != null && totalRev != null && totalRev > 0
      ? (fcf / totalRev) * 100
      : null
  // FIX #2: Compute real Debt/EBITDA from totalDebt and enterpriseToEbitda
  const totalDebt = stats?.totalDebt ?? null
  const ebitdaFromEV = stats?.enterpriseToEbitda != null && stats.enterpriseToEbitda > 0 && stats?.enterpriseValue != null
    ? stats.enterpriseValue / stats.enterpriseToEbitda
    : null
  const debtEbitda = totalDebt != null && ebitdaFromEV != null && ebitdaFromEV > 0
    ? totalDebt / ebitdaFromEV
    : null
  const roe = stats?.returnOnEquity != null ? stats.returnOnEquity * 100 : null
  const revenueGrowth = stats?.revenueGrowth != null ? stats.revenueGrowth * 100 : null

  // --- Checklist ---
  const valuationReasonable =
    peFwd != null ? peFwd < sectorPE * 1.5 : null
  const revenueGrowthPositive =
    revenueGrowth != null ? revenueGrowth > 0 : null
  // FIX #8: marginsStable now uses sector-aware thresholds
  const marginsStable =
    operatingMargin != null
      ? (sector === "Consumer Cyclical" || sector === "Consumer Defensive" || sector === "Energy")
        ? operatingMargin > 3  // low-margin sectors: 3%+ is stable
        : (sector === "Financial Services")
          ? operatingMargin > 15
          : operatingMargin > 8  // tech/healthcare: 8%+ is stable
      : null
  // FIX: balanceSheetHealthy must check BOTH currentRatio AND debtToEquity
  const balanceSheetHealthy = (() => {
    const crOk = stats?.currentRatio != null ? stats.currentRatio > 1.0 : null
    const deOk = stats?.debtToEquity != null ? stats.debtToEquity < 200 : null // D/E < 200% = healthy
    // If D/E is catastrophic (>500%), always fail regardless of CR
    if (stats?.debtToEquity != null && stats.debtToEquity > 500) return false
    // Both available: both must pass
    if (crOk != null && deOk != null) return crOk && deOk
    // One available: use it
    return crOk ?? deOk
  })()
  const aboveMA50 = ma50 != null ? price > ma50 : null
  const aboveMA200 = ma200 != null ? price > ma200 : null
  // FCF yield check — use OCF - CapEx when available (more reliable than Yahoo Levered FCF)
  const ocf = stats?.operatingCashFlow ?? null
  const capex = stats?.freeCashFlow != null && ocf != null ? ocf - (stats.freeCashFlow ?? 0) : null // derive capex
  const unleveredFCF = ocf != null ? (capex != null ? ocf - capex : stats?.freeCashFlow ?? null) : stats?.freeCashFlow ?? null
  const healthyFCFYield =
    fcf != null && quote.marketCap > 0 ? (fcf / quote.marketCap) > 0.015 : null  // FCF yield > 1.5%
  // FIX #7: sectorTailwind — use revenue growth relative to sector benchmark, not just own metrics
  const sectorGrowthBenchmark = sector === "Technology" ? 12 : sector === "Healthcare" ? 8 : sector === "Energy" ? 5 : sector === "Utilities" ? 3 : 6
  const sectorTailwind =
    revenueGrowth != null
      ? revenueGrowth > sectorGrowthBenchmark  // company growing faster than sector avg
      : null

  const checklist = {
    valuationReasonable,
    revenueGrowthPositive,
    marginsStable,
    balanceSheetHealthy,
    aboveMA50,
    aboveMA200,
    healthyFCFYield,  // FIX #9: replaced noExcessivePremium
    sectorTailwind,
  }

  // --- Verdict ---
  let checkScore = 0
  let trueCount = 0
  let falseCount = 0
  let nullCount = 0
  for (const v of Object.values(checklist)) {
    if (v === true) { checkScore++; trueCount++ }
    else if (v === false) { checkScore--; falseCount++ }
    else { nullCount++ }
  }

  let verdict: "BUY" | "HOLD" | "SELL" | "AVOID"
  if (checkScore >= 5) verdict = "BUY"
  else if (checkScore >= 2) verdict = "HOLD"
  else if (checkScore >= -1) verdict = "SELL"
  else verdict = "AVOID"

  // FIX #12: Confidence based on trueCount (positive signals), not aligned (true+false)
  // High = 6+ positive signals with data quality, Medium = 4+, Low = rest
  let confidence: "High" | "Medium" | "Low"
  const dataQuality = 8 - nullCount  // how many metrics have data
  if (trueCount >= 6 && dataQuality >= 6) confidence = "High"
  else if (trueCount >= 4 && dataQuality >= 5) confidence = "Medium"
  else confidence = "Low"

  // --- Entry / Stop / Targets ---
  const entry = price

  // FIX #5: Support = most common price cluster in recent lows, not absolute minimum
  const recentLows = lows.slice(-50)
  let nearestSupport = price * 0.9
  if (recentLows.length >= 10) {
    // Find price level where lows cluster (within 2% bands)
    const sorted = [...recentLows].sort((a, b) => a - b)
    let bestCluster = sorted[0]
    let bestCount = 0
    for (let i = 0; i < sorted.length; i++) {
      const band = sorted[i] * 0.02
      const count = sorted.filter(l => Math.abs(l - sorted[i]) <= band).length
      if (count > bestCount && sorted[i] < price) {
        bestCount = count
        bestCluster = sorted[i]
      }
    }
    if (bestCount >= 3) nearestSupport = bestCluster
  }
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

  // --- Thesis (PL) ---
  const thesisParts: string[] = []
  if (verdict === "BUY") {
    if (revenueGrowthPositive) thesisParts.push("silny wzrost przychodów")
    if (aboveMA50 && aboveMA200) thesisParts.push("solidny trend wzrostowy")
    if (valuationReasonable) thesisParts.push("rozsądna wycena")
    if (thesisParts.length === 0) thesisParts.push("pozytywne fundamenty")
    thesisParts.unshift(`${quote.name} wykazuje`)
  } else if (verdict === "HOLD") {
    thesisParts.push(`${quote.name} ma mieszane sygnały — utrzymuj pozycję`)
  } else if (verdict === "SELL") {
    thesisParts.push(`${quote.name} wykazuje pogarszające się wskaźniki`)
  } else {
    thesisParts.push(`${quote.name} ma zbyt wiele czerwonych flag — unikaj inwestycji`)
  }
  const thesis = thesisParts.join(", ") + "."

  // --- Main Risk (PL) ---
  let mainRisk = "Ogólne pogorszenie koniunktury rynkowej"
  if (peFwd != null && peFwd > sectorPE * 2)
    mainRisk = "Ekstremalnie wysoka wycena — ryzyko korekty"
  else if (stats?.debtToEquity != null && stats.debtToEquity > 200)
    mainRisk = "Wysoki poziom zadłużenia — wrażliwość na zmiany stóp procentowych"
  else if (revenueGrowth != null && revenueGrowth < -5)
    mainRisk = "Spadek przychodów — biznes może się kurczyć"
  else if (rsi != null && rsi > 75)
    mainRisk = "Wykupiony RSI — prawdopodobna krótkoterminowa korekta"
  else if (distanceFrom52High < -30)
    mainRisk = "Duży spadek od szczytów — trend może być złamany"
  else if (peFwd != null && peFwd > sectorPE * 1.3)
    mainRisk = `Wycena premium ${peFwd.toFixed(1)}x vs sektor ${sectorPE.toFixed(1)}x — ograniczony margines bezpieczeństwa`
  else if (stats?.debtToEquity != null && stats.debtToEquity > 100)
    mainRisk = "Podwyższona dźwignia — zyski wrażliwe na środowisko stóp procentowych"
  else if (rsi != null && rsi > 65)
    mainRisk = "Rozciągnięty momentum — możliwa konsolidacja"
  else if (distanceFrom52High < -15)
    mainRisk = "Korekta od szczytów — obserwuj potwierdzenie wsparcia"
  else if (profitMargin != null && (
    (sector === "Technology" && profitMargin < 10) ||
    (sector === "Healthcare" && profitMargin < 8) ||
    (sector === "Consumer Cyclical" && profitMargin < 3) ||
    (sector === "Energy" && profitMargin < 5) ||
    (profitMargin < 5)
  ))
    mainRisk = "Niskie marże względem sektora — wrażliwość na wzrost kosztów"
  else if (peFwd != null && peFwd > sectorPE)
    mainRisk = `Wycena powyżej średniej sektora (${peFwd.toFixed(1)}x vs ${sectorPE.toFixed(1)}x) — wzrost musi uzasadnić premię`
  else if (revenueGrowth != null && revenueGrowth > 30)
    mainRisk = "Szybki wzrost może przyciągnąć konkurencję i skompresować marże"
  else if (operatingMargin != null && operatingMargin > 30)
    mainRisk = "Wysoka rentowność przyciąga presję konkurencyjną i regulacyjną"
  else
    mainRisk = `Ryzyka sektorowe: spowolnienie makro, zmiany regulacyjne w sektorze ${sector}`

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
      name: "Ryzyko wyceny",
      probability: riskLevel(valScore),
      impact: riskLevel(Math.min(valScore + 1, 9)) as "Low" | "Medium" | "High",
      score: valScore,
      mitigation: "Monitoruj P/E vs sektor. Ustaw stop-loss na wsparciu.",
    },
    {
      name: "Disrupcja branżowa",
      probability: riskLevel(disruptScore),
      impact: "High" as const,
      score: disruptScore,
      mitigation: "Śledź krajobraz konkurencyjny i pipeline innowacji.",
    },
    {
      name: "Bilans / Zadłużenie",
      probability: riskLevel(bsScore),
      impact: riskLevel(bsScore) as "Low" | "Medium" | "High",
      score: bsScore,
      mitigation: "Monitoruj kowenanty długowe i harmonogram refinansowania.",
    },
    {
      name: "Makro / Stopy",
      probability: riskLevel(macroScore),
      impact: "Medium" as const,
      score: macroScore,
      mitigation: "Hedging przez rotację sektorową; obserwuj politykę Fed.",
    },
    {
      name: "Zagrożenie konkurencyjne",
      probability: riskLevel(compScore),
      impact: "Medium" as const,
      score: compScore,
      mitigation: "Monitoruj udział w rynku i trendy marż kwartalnie.",
    },
    {
      name: "Ryzyko egzekucji",
      probability: riskLevel(execScore),
      impact: "High" as const,
      score: execScore,
      mitigation: "Obserwuj guidance wynikowy i rotację zarządu.",
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

  // FIX #6: Bear case is fundamental downside (not stop-loss level)
  const bullPrice = target2
  const basePrice = target1
  const bearPctByRisk = overallRiskScore >= 7 ? -40 : overallRiskScore >= 5 ? -25 : -15
  const bearPrice = price * (1 + bearPctByRisk / 100)

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

    grossMargin: grossMarginRaw != null ? round2(grossMarginRaw) : (profitMargin != null ? round2(profitMargin) : null), // FIX #1: use real gross margin, fallback to profit margin
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
