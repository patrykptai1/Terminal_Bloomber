// ============================================================
// Quantum Computing Valuation & Risk Engine
// Probabilistic scenario-based valuation for quantum stocks
// NOT applicable to regular stocks — use only for quantum sector
// ============================================================

import type { QuoteData, KeyStatistics, EarningsData } from "./yahoo"

// ── Known quantum companies and their profiles ──

interface QuantumProfile {
  architecture: string
  architecturePL: string
  trl: number  // NASA Technology Readiness Level 1-9
  focus: string[]  // e.g. ["hardware", "cloud", "software"]
  stackType: "full-stack" | "hardware" | "software" | "components"
  keyMetric?: string  // e.g. "32 logical qubits"
}

const QUANTUM_PROFILES: Record<string, QuantumProfile> = {
  "IONQ": {
    architecture: "Trapped Ions",
    architecturePL: "Pułapkowane jony",
    trl: 6,
    focus: ["hardware", "cloud", "enterprise"],
    stackType: "full-stack",
    keyMetric: "#AQ 35 algorithmic qubits",
  },
  "RGTI": {
    architecture: "Superconducting",
    architecturePL: "Nadprzewodnikowe kubity",
    trl: 5,
    focus: ["hardware", "cloud", "hybrid"],
    stackType: "full-stack",
    keyMetric: "84-qubit Ankaa system",
  },
  "QBTS": {
    architecture: "Quantum Annealing",
    architecturePL: "Wyżarzanie kwantowe",
    trl: 7,
    focus: ["optimization", "enterprise", "cloud"],
    stackType: "full-stack",
    keyMetric: "5000+ qubit Advantage2",
  },
  "QUBT": {
    architecture: "Photonic / Software",
    architecturePL: "Fotoniczne / Oprogramowanie",
    trl: 4,
    focus: ["software", "optimization", "sensing"],
    stackType: "software",
  },
  "ARQQ": {
    architecture: "Quantum Encryption (QKD)",
    architecturePL: "Szyfrowanie kwantowe (QKD)",
    trl: 6,
    focus: ["post-quantum crypto", "enterprise security"],
    stackType: "software",
    keyMetric: "QuantumCloud platform",
  },
  "FORM": {
    architecture: "Quantum Test Equipment",
    architecturePL: "Sprzęt testowy dla quantum",
    trl: 8,
    focus: ["components", "testing", "probing"],
    stackType: "components",
    keyMetric: "Quantum probe stations",
  },
  "CRI.WA": {
    architecture: "Quantum Instruments + Space",
    architecturePL: "Instrumenty kwantowe + Kosmos",
    trl: 5,
    focus: ["instruments", "space", "quantum sensing"],
    stackType: "components",
  },
  "INFQ": {
    architecture: "Neutral Atoms / Cold Atoms",
    architecturePL: "Neutralne atomy / Zimne atomy",
    trl: 5,
    focus: ["hardware", "quantum sensing", "quantum clocks", "software"],
    stackType: "full-stack",
    keyMetric: "Cold atom quantum computers + precision sensors",
  },
  "QMCO": {
    architecture: "Quantum Biology / Proteomics",
    architecturePL: "Biologia kwantowa / Proteomika",
    trl: 4,
    focus: ["quantum sensing", "proteomics", "semiconductor"],
    stackType: "hardware",
    keyMetric: "Quantum-Si protein sequencing",
  },
}

const QUANTUM_TICKERS = new Set(Object.keys(QUANTUM_PROFILES))

// Auto-detect quantum from Yahoo description/industry
const QUANTUM_KEYWORDS = [
  "quantum comput", "quantum software", "quantum sensor",
  "quantum encrypt", "quantum key", "qubit", "quantum process",
  "quantum network", "quantum clock", "quantum simulat",
  "post-quantum", "quantum-safe", "cold atom",
]

export function isQuantumStock(symbol: string, industry?: string | null, summary?: string | null): boolean {
  if (QUANTUM_TICKERS.has(symbol.toUpperCase())) return true
  // Fallback: check if description/industry mentions quantum
  const text = `${industry ?? ""} ${summary ?? ""}`.toLowerCase()
  return QUANTUM_KEYWORDS.some(kw => text.includes(kw))
}

// ── Interfaces ──

export interface QuantumScenario {
  name: string
  probability: number  // 0-100
  description: string
  exitRevenue: string  // e.g. "$500M-$2B"
  exitMultiple: string // e.g. "15-25x"
  impliedValue: number // per share or total $M
}

export interface QuantumRedFlag {
  category: "technology" | "financial" | "market"
  severity: "critical" | "high" | "medium"
  title: string
  description: string
  metric?: string
}

export interface QuantumValuation {
  // Profile
  profile: QuantumProfile
  isQuantum: true

  // TRL & Architecture
  trlScore: number
  trlDescription: string
  architectureRisk: string

  // Financial Survival
  cashRunwayQuarters: number | null
  runwayStatus: "comfortable" | "adequate" | "warning" | "critical"
  quarterlyBurn: number | null
  dilutionRisk: string
  revenueQuality: string

  // Scenario Valuation
  scenarios: QuantumScenario[]
  weightedFairValue: number  // $ per share
  currentVsWeighted: number  // % (positive = overvalued)
  impliedSuccessProbability: number  // what probability of success market implies

  // Moat & Position
  moatFactors: { name: string; score: number; description: string }[]
  competitivePosition: string

  // Red Flags
  redFlags: QuantumRedFlag[]

  // Overall
  overallScore: number  // 1-100
  riskLevel: string
  verdict: string
}

// ── Main computation ──

export function computeQuantumValuation(
  q: QuoteData,
  stats: KeyStatistics | null,
  earnings: EarningsData | null,
): QuantumValuation {
  const sym = q.symbol.toUpperCase()
  const profile = QUANTUM_PROFILES[sym] ?? {
    // Auto-generated profile for quantum stocks detected by keyword
    architecture: "Quantum (auto-detected)",
    architecturePL: "Quantum (wykryte automatycznie z opisu)",
    trl: 4,
    focus: ["quantum"],
    stackType: "hardware" as const,
    keyMetric: undefined,
  }
  const redFlags: QuantumRedFlag[] = []

  // ═══ TRL ASSESSMENT ═══
  const trl = profile.trl
  const trlDescription = trl >= 7
    ? `TRL ${trl}/9 — Technologia zwalidowana w warunkach operacyjnych. Spółka może generować przychody komercyjne.`
    : trl >= 5
    ? `TRL ${trl}/9 — Technologia zwalidowana w warunkach laboratoryjnych. Komercjalizacja w horyzoncie 3-7 lat.`
    : `TRL ${trl}/9 — Wczesna faza R&D. Komercjalizacja nie wcześniej niż 7-12 lat. Ryzyko technologiczne ekstremalnie wysokie.`

  const architectureRisk = profile.architecture.includes("Annealing")
    ? "Umiarkowane — wyżarzanie kwantowe to najbardziej dojrzała architektura, ale ograniczona do problemów optymalizacyjnych."
    : profile.architecture.includes("Trapped")
    ? "Umiarkowane — wysoka fidelity bramek, ale wyzwania ze skalowaniem fizycznym powyżej ~50 qubitów."
    : profile.architecture.includes("Superconducting")
    ? "Podwyższone — szybkie bramki ale wysokie error rates. Konkurencja z IBM/Google na tej samej architekturze."
    : profile.architecture.includes("Photonic")
    ? "Wysokie — działa w temp. pokojowej, ale trudna korekcja błędów. Wczesna komercjalizacja."
    : profile.architecture.includes("Encryption")
    ? "Niskie — post-quantum crypto to najbliższy komercjalizacji segment quantum. Popyt już istnieje."
    : profile.architecture.includes("Test")
    ? "Niskie — sprzęt testowy to picks-and-shovels play. Przychody niezależne od sukcesu konkretnej architektury."
    : "Podwyższone — profil ryzyka zależy od specyfiki technologii."

  // ═══ CASH RUNWAY ═══
  let cashRunwayQuarters: number | null = null
  let quarterlyBurn: number | null = null
  let runwayStatus: "comfortable" | "adequate" | "warning" | "critical" = "adequate"

  const totalCash = stats?.totalCash ?? null
  const ocf = stats?.operatingCashFlow ?? null

  if (totalCash != null && ocf != null && ocf < 0) {
    quarterlyBurn = Math.abs(ocf) / 4
    cashRunwayQuarters = quarterlyBurn > 0 ? Math.round(totalCash / quarterlyBurn) : null

    if (cashRunwayQuarters != null) {
      if (cashRunwayQuarters < 4) {
        runwayStatus = "critical"
        redFlags.push({ category: "financial", severity: "critical", title: `Krytyczny runway: ${cashRunwayQuarters} kwartałów`, description: `Przy obecnym burn rate (${(quarterlyBurn/1e6).toFixed(0)}M/kwartał) gotówka (${(totalCash/1e6).toFixed(0)}M) wystarczy na ${cashRunwayQuarters} kwartałów. Spółka potrzebuje natychmiastowego finansowania.`, metric: `${cashRunwayQuarters}Q runway` })
      } else if (cashRunwayQuarters < 8) {
        runwayStatus = "warning"
        redFlags.push({ category: "financial", severity: "high", title: `Ograniczony runway: ${cashRunwayQuarters} kwartałów`, description: `Gotówka (${(totalCash/1e6).toFixed(0)}M) przy burn ${(quarterlyBurn/1e6).toFixed(0)}M/Q wystarczy na ~${cashRunwayQuarters} kwartałów. Prawdopodobna emisja akcji w ciągu 12 miesięcy.`, metric: `${cashRunwayQuarters}Q runway` })
      } else if (cashRunwayQuarters >= 12) {
        runwayStatus = "comfortable"
      }
    }
  } else if (totalCash != null && ocf != null && ocf > 0) {
    runwayStatus = "comfortable"
    cashRunwayQuarters = 99 // cash flow positive
  }

  // ═══ DILUTION RISK ═══
  let dilutionRisk = "Brak danych o rozwodnieniu"
  if (earnings) {
    const bs = (earnings.balanceSheetAnnual ?? []).filter(b => b.sharesOutstanding != null)
    if (bs.length >= 2) {
      const s1 = bs[bs.length - 2].sharesOutstanding!
      const s2 = bs[bs.length - 1].sharesOutstanding!
      const dilPct = ((s2 - s1) / s1) * 100
      if (dilPct > 10) {
        dilutionRisk = `Wysokie ryzyko rozwodnienia: akcje wzrosły ${dilPct.toFixed(1)}% YoY. Capital-intensive model wymaga ciągłego finansowania.`
        redFlags.push({ category: "financial", severity: "high", title: `Rozwodnienie ${dilPct.toFixed(0)}% YoY`, description: dilutionRisk, metric: `Shares: +${dilPct.toFixed(1)}%` })
      } else if (dilPct > 3) {
        dilutionRisk = `Umiarkowane rozwodnienie (${dilPct.toFixed(1)}% YoY). Typowe dla pre-revenue quantum — monitoruj trend.`
      } else if (dilPct <= 0) {
        dilutionRisk = `Minimalne rozwodnienie (${dilPct.toFixed(1)}% YoY). Pozytywny sygnał kontroli kapitałowej.`
      }
    }
  }

  // ═══ REVENUE QUALITY ═══
  let revenueQuality = "Pre-revenue — brak przychodów do oceny"
  const totalRev = stats?.totalRevenue
  if (totalRev != null && totalRev > 1e6) {
    const revPerEmployee = stats?.fullTimeEmployees ? totalRev / stats.fullTimeEmployees : null
    revenueQuality = `Przychody: $${(totalRev/1e6).toFixed(0)}M. `
    if (revPerEmployee && revPerEmployee > 200000) {
      revenueQuality += `Wysoka produktywność ($${(revPerEmployee/1000).toFixed(0)}K/pracownik). `
    }
    // Revenue growth
    const rg = stats?.revenueGrowth
    if (rg != null) {
      revenueQuality += rg > 0.3 ? `Silny wzrost ${(rg*100).toFixed(0)}% YoY. ` : rg > 0 ? `Wzrost ${(rg*100).toFixed(0)}% YoY. ` : `Spadek ${(rg*100).toFixed(0)}% YoY — ⚠️ `
    }
  }

  // ═══ SCENARIO VALUATION ═══
  const mcap = q.marketCap
  const sharesOut = stats?.sharesOutstanding ?? (mcap / q.price)
  const currentPPS = q.price

  // Discount rate based on TRL
  const discountRate = trl >= 7 ? 0.22 : trl >= 5 ? 0.30 : 0.40
  const years = trl >= 7 ? 5 : trl >= 5 ? 8 : 12
  const discountFactor = Math.pow(1 + discountRate, years)

  // Scale scenarios by current MCap size
  const isLarge = mcap > 5e9
  const isMid = mcap > 1e9

  const scenarios: QuantumScenario[] = [
    {
      name: "Pełny sukces komercyjny",
      probability: trl >= 7 ? 15 : trl >= 5 ? 10 : 5,
      description: "Spółka osiąga quantum advantage, staje się platformą enterprise. Revenue $500M-$2B.",
      exitRevenue: "$500M–$2B",
      exitMultiple: "15–25x",
      impliedValue: ((isLarge ? 2e9 : isMid ? 1e9 : 500e6) * 20 / discountFactor) / sharesOut,
    },
    {
      name: "Sukces niszowy",
      probability: trl >= 7 ? 30 : trl >= 5 ? 25 : 15,
      description: "Spółka zajmuje konkretny vertical (pharma, crypto, optimization). Revenue $100-300M.",
      exitRevenue: "$100–$300M",
      exitMultiple: "8–12x",
      impliedValue: ((isLarge ? 300e6 : isMid ? 200e6 : 100e6) * 10 / discountFactor) / sharesOut,
    },
    {
      name: "Akwizycja przez BigTech",
      probability: 25,
      description: "IBM, Google, MSFT lub Amazon przejmuje spółkę dla IP i talentu. Exit 1-3x zainwestowanego kapitału.",
      exitRevenue: "N/A (akwizycja)",
      exitMultiple: "1–3x kapitału",
      impliedValue: (mcap * 1.5 / discountFactor) / sharesOut,
    },
    {
      name: "Pivot do pokrewnej tech",
      probability: trl >= 7 ? 15 : 10,
      description: "Quantum nie dojrzewa w czasie — spółka pivotuje do HPC, AI accelerators lub sensing.",
      exitRevenue: "$50–$100M",
      exitMultiple: "5–8x",
      impliedValue: ((isMid ? 100e6 : 50e6) * 6 / discountFactor) / sharesOut,
    },
    {
      name: "Upadłość / likwidacja",
      probability: runwayStatus === "critical" ? 35 : runwayStatus === "warning" ? 25 : trl < 5 ? 25 : 15,
      description: "Gotówka się kończy, technologia nie dojrzewa. Wartość dla akcjonariuszy: $0.",
      exitRevenue: "$0",
      exitMultiple: "0x",
      impliedValue: 0,
    },
  ]

  // Normalize probabilities to 100
  const totalProb = scenarios.reduce((s, sc) => s + sc.probability, 0)
  scenarios.forEach(sc => sc.probability = Math.round(sc.probability / totalProb * 100))

  const weightedFairValue = scenarios.reduce((s, sc) => s + (sc.probability / 100) * sc.impliedValue, 0)
  const currentVsWeighted = weightedFairValue > 0 ? ((currentPPS - weightedFairValue) / weightedFairValue) * 100 : 0

  // Implied success probability — what prob of full success does market price imply?
  const fullSuccessValue = scenarios[0].impliedValue
  const failValue = 0
  const impliedSuccessProbability = fullSuccessValue > 0
    ? Math.max(0, Math.min(100, Math.round(((currentPPS - failValue) / (fullSuccessValue - failValue)) * 100)))
    : 0

  // ═══ MOAT FACTORS (Quantum-specific) ═══
  const moatFactors = [
    {
      name: "Własność IP / Patenty",
      score: profile.stackType === "full-stack" ? 7 : profile.stackType === "components" ? 8 : 5,
      description: profile.stackType === "full-stack" ? "Pełny stack = silna ochrona IP, trudny do replikacji." : "Komponenty/software — umiarkowana ochrona IP.",
    },
    {
      name: "Partnerstwa BigTech/Rząd",
      score: sym === "IONQ" ? 8 : sym === "QBTS" ? 7 : sym === "RGTI" ? 6 : 4,
      description: "Kontrakty z AWS/Azure/GCP lub DoD/DARPA walidują technologię i dają stable revenue.",
    },
    {
      name: "Architektura i skalowanie",
      score: Math.min(10, trl + 1),
      description: `TRL ${trl}/9 — ${profile.architecturePL}. ${profile.keyMetric ?? ""}`,
    },
    {
      name: "Full-stack vs single-layer",
      score: profile.stackType === "full-stack" ? 8 : profile.stackType === "components" ? 6 : 4,
      description: profile.stackType === "full-stack" ? "Full-stack: wyższa marża, kontrola nad ekosystemem." : "Single-layer: zależność od partnerów, niższe capex.",
    },
  ]

  // ═══ ADDITIONAL RED FLAGS ═══
  // Revenue declining
  const rg = stats?.revenueGrowth
  if (rg != null && rg < -0.1) {
    redFlags.push({ category: "market", severity: "high", title: `Spadek przychodów ${(rg*100).toFixed(0)}% YoY`, description: "Spadające przychody w pre-komercyjnej fazie to sygnał utraty kontraktów lub klientów pilotażowych.", metric: `Rev: ${(rg*100).toFixed(0)}%` })
  }

  // Very high valuation vs zero/minimal revenue
  if (totalRev != null && totalRev > 0 && mcap / totalRev > 100) {
    redFlags.push({ category: "market", severity: "medium", title: `EV/Revenue > ${Math.round(mcap/totalRev)}x`, description: `Wycena ${Math.round(mcap/totalRev)}x przychodów jest ekstremalnie wysoka nawet dla quantum. Rynek wycenia pełny sukces z dużym prawdopodobieństwem.`, metric: `EV/Rev: ${Math.round(mcap/totalRev)}x` })
  }

  // Net income deeply negative
  const pm = stats?.profitMargin
  if (pm != null && pm < -1.0) {
    redFlags.push({ category: "financial", severity: "medium", title: "Strata netto > 100% przychodów", description: `Marża netto ${(pm*100).toFixed(0)}% — koszty wielokrotnie przewyższają przychody. Normalne dla pre-revenue quantum, ale monitoruj trend.`, metric: `NM: ${(pm*100).toFixed(0)}%` })
  }

  // ═══ COMPETITIVE POSITION ═══
  const competitivePosition = profile.stackType === "components"
    ? "Picks-and-shovels — dostarcza narzędzia dla całej branży. Mniejsze ryzyko ale mniejszy upside."
    : profile.architecture.includes("Encryption")
    ? "Post-quantum crypto — najbliżej komercjalizacji. Popyt regulacyjny napędza adopcję."
    : trl >= 7
    ? "Lider komercjalizacji — generuje przychody, walidacja rynkowa. Ryzyko: konkurencja BigTech."
    : trl >= 5
    ? "Faza pilotażowa — technologia potwierdzona lab, wchodzi w komercję. Kluczowe 2-4 lata."
    : "Wczesne R&D — wysoki potencjał ale ekstremalnie wysokie ryzyko. Inwestycja spekulacyjna."

  // ═══ OVERALL SCORE ═══
  // Weighted: TRL (25%), Runway (25%), Moat (20%), Revenue (15%), Red flags penalty (15%)
  const trlScore = Math.round((trl / 9) * 25)
  const runwayScore = runwayStatus === "comfortable" ? 25 : runwayStatus === "adequate" ? 18 : runwayStatus === "warning" ? 10 : 3
  const moatScore = Math.round(moatFactors.reduce((s, m) => s + m.score, 0) / moatFactors.length / 10 * 20)
  const revScore = totalRev && totalRev > 10e6 ? 15 : totalRev && totalRev > 1e6 ? 10 : 3
  const flagPenalty = redFlags.filter(f => f.severity === "critical").length * 10 + redFlags.filter(f => f.severity === "high").length * 5

  const overallScore = Math.max(1, Math.min(100, trlScore + runwayScore + moatScore + revScore - flagPenalty))

  const riskLevel = overallScore >= 70 ? "Umiarkowane (dla quantum)" : overallScore >= 45 ? "Podwyższone" : overallScore >= 25 ? "Wysokie" : "Krytyczne"

  const verdict = currentVsWeighted > 50
    ? `${q.name} jest wyceniana ${currentVsWeighted.toFixed(0)}% powyżej ważonej wartości scenariuszowej. Rynek implikuje ${impliedSuccessProbability}% prawdopodobieństwo pełnego sukcesu — to agresywne założenie.`
    : currentVsWeighted < -20
    ? `${q.name} handluje ${Math.abs(currentVsWeighted).toFixed(0)}% poniżej ważonej wartości scenariuszowej. Potencjalnie niedowartościowana jeśli timing komercjalizacji się potwierdzi.`
    : `${q.name} jest wyceniona zbliżenie do ważonej wartości scenariuszowej. Rynek implikuje ${impliedSuccessProbability}% szans na pełny sukces.`

  return {
    profile,
    isQuantum: true,
    trlScore: trl,
    trlDescription,
    architectureRisk,
    cashRunwayQuarters,
    runwayStatus,
    quarterlyBurn,
    dilutionRisk,
    revenueQuality,
    scenarios,
    weightedFairValue,
    currentVsWeighted,
    impliedSuccessProbability,
    moatFactors,
    competitivePosition,
    redFlags,
    overallScore,
    riskLevel,
    verdict,
  }
}
