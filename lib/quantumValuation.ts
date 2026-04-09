// ============================================================
// Quantum Computing Valuation & Risk Engine v2
// 10-module architecture per quantum investment methodology
// NOT applicable to regular stocks — separate asset class
// ============================================================

import type { QuoteData, KeyStatistics, EarningsData } from "./yahoo"

// ── Known quantum companies and their profiles ──

export interface QuantumProfile {
  architecture: string
  architecturePL: string
  trl: number
  focus: string[]
  stackType: "full-stack" | "hardware" | "software" | "components"
  hardwareIntensity: boolean  // MOD7: true = physical hardware, false = software/cloud
  hasSensing: boolean         // MOD8: diversified with sensing business
  keyMetric?: string
}

const QUANTUM_PROFILES: Record<string, QuantumProfile> = {
  "IONQ": { architecture: "Trapped Ions", architecturePL: "Pułapkowane jony", trl: 6, focus: ["hardware","cloud","enterprise"], stackType: "full-stack", hardwareIntensity: true, hasSensing: false, keyMetric: "#AQ 35 algorithmic qubits" },
  "RGTI": { architecture: "Superconducting", architecturePL: "Nadprzewodnikowe kubity", trl: 5, focus: ["hardware","cloud","hybrid"], stackType: "full-stack", hardwareIntensity: true, hasSensing: false, keyMetric: "84-qubit Ankaa system" },
  "QBTS": { architecture: "Quantum Annealing", architecturePL: "Wyżarzanie kwantowe", trl: 7, focus: ["optimization","enterprise","cloud"], stackType: "full-stack", hardwareIntensity: true, hasSensing: false, keyMetric: "5000+ qubit Advantage2" },
  "QUBT": { architecture: "Photonic / Software", architecturePL: "Fotoniczne / Oprogramowanie", trl: 4, focus: ["software","optimization","sensing"], stackType: "software", hardwareIntensity: false, hasSensing: false },
  "ARQQ": { architecture: "Quantum Encryption (QKD)", architecturePL: "Szyfrowanie kwantowe (QKD)", trl: 6, focus: ["post-quantum crypto","enterprise security"], stackType: "software", hardwareIntensity: false, hasSensing: false, keyMetric: "QuantumCloud platform" },
  "FORM": { architecture: "Quantum Test Equipment", architecturePL: "Sprzęt testowy dla quantum", trl: 8, focus: ["components","testing","probing"], stackType: "components", hardwareIntensity: true, hasSensing: false, keyMetric: "Quantum probe stations" },
  "CRI.WA": { architecture: "Quantum Instruments + Space", architecturePL: "Instrumenty kwantowe + Kosmos", trl: 5, focus: ["instruments","space","quantum sensing"], stackType: "components", hardwareIntensity: true, hasSensing: true },
  "INFQ": { architecture: "Neutral Atoms / Cold Atoms", architecturePL: "Neutralne atomy / Zimne atomy", trl: 5, focus: ["hardware","quantum sensing","quantum clocks","software"], stackType: "full-stack", hardwareIntensity: true, hasSensing: true, keyMetric: "Cold atom QC + precision sensors" },
  "QMCO": { architecture: "Quantum Biology / Proteomics", architecturePL: "Biologia kwantowa / Proteomika", trl: 4, focus: ["quantum sensing","proteomics","semiconductor"], stackType: "hardware", hardwareIntensity: true, hasSensing: true },
}

const QUANTUM_TICKERS = new Set(Object.keys(QUANTUM_PROFILES))
const QUANTUM_KEYWORDS = ["quantum comput","quantum software","quantum sensor","quantum encrypt","quantum key","qubit","quantum process","quantum network","quantum clock","quantum simulat","post-quantum","quantum-safe","cold atom"]

export function isQuantumStock(symbol: string, industry?: string | null, summary?: string | null): boolean {
  if (QUANTUM_TICKERS.has(symbol.toUpperCase())) return true
  const text = `${industry ?? ""} ${summary ?? ""}`.toLowerCase()
  return QUANTUM_KEYWORDS.some(kw => text.includes(kw))
}

// ── Interfaces ──

export interface QuantumScenario {
  name: string
  probability: number
  description: string
  exitRevenue: string
  exitMultiple: string
  impliedValue: number       // per share, DISCOUNTED to today
  nominalValue: number       // per share, NOT discounted
  discountRate: number       // e.g. 0.30
  horizon: number            // years
  pvFactor: number           // 1/(1+r)^n
}

export interface QuantumRedFlag {
  category: "technology" | "financial" | "market" | "quantum"
  severity: "critical" | "high" | "medium"
  title: string
  description: string
  metric?: string
}

export interface QuantumChecklistItem {
  label: string
  status: "pass" | "fail" | "nodata"
  reason: string
}

export interface QuantumValuation {
  profile: QuantumProfile
  isQuantum: true

  // MOD1: Relative valuation (NOT P/E based)
  evForwardRevenue: number | null
  evRPO: number | null

  // MOD2: Quantum checklist (not standard)
  checklist: QuantumChecklistItem[]

  // MOD3: Revenue Acceleration (replaces Rule of 40)
  revenueAcceleration: { q1: string; q2: string; q1growth: number | null; q2growth: number | null; accelerating: boolean | null } | null

  // MOD4: Implied Probability (correct formula)
  impliedSuccessProb: number
  modelSuccessProb: number
  probDelta: number  // implied - model (positive = market more optimistic)

  // MOD5: Scenarios with explicit discount
  scenarios: QuantumScenario[]
  weightedFairValue: number
  currentVsWeighted: number
  discountRate: number
  horizon: number

  // MOD6: Tech moat (6 data-driven criteria)
  techMoat: { name: string; score: number; maxScore: number; description: string; source: string }[]
  techMoatTotal: number

  // MOD7: Porter quantum-context (computed in UI from profile)

  // MOD8: Sensing segment (if applicable)
  sensingValuation: { revenue: string; description: string } | null

  // MOD9: Quantum-specific risks
  quantumRisks: QuantumRedFlag[]

  // MOD10: Runway widget
  runway: {
    cashM: number
    burnPerQuarterM: number
    quarters: number
    status: "BEZPIECZNY" | "KOMFORT MINIMALNY" | "UWAGA" | "ALARM"
    nextFundingEstimate: string
    dilutionRisk: string
  } | null

  // Red Flags (all)
  redFlags: QuantumRedFlag[]

  // Overall
  overallScore: number
  riskLevel: string
  verdict: string
}

// ── Helpers ──
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }
function fmtM(v: number) { return v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M` }

// ── Main computation ──

export function computeQuantumValuation(
  q: QuoteData,
  stats: KeyStatistics | null,
  earnings: EarningsData | null,
): QuantumValuation {
  const sym = q.symbol.toUpperCase()
  const profile = QUANTUM_PROFILES[sym] ?? {
    architecture: "Quantum (auto-detected)", architecturePL: "Quantum (auto)", trl: 4,
    focus: ["quantum"], stackType: "hardware" as const, hardwareIntensity: true, hasSensing: false,
  }
  const redFlags: QuantumRedFlag[] = []

  const mcap = q.marketCap
  const price = q.price
  const sharesOut = stats?.sharesOutstanding ?? (mcap > 0 && price > 0 ? mcap / price : 1)
  const totalCash = stats?.totalCash ?? null
  const totalRev = stats?.totalRevenue ?? null
  const ocf = stats?.operatingCashFlow ?? null
  const trl = profile.trl
  const ev = stats?.enterpriseValue ?? mcap

  // ═══ MOD10: RUNWAY — central metric ═══
  let runway: QuantumValuation["runway"] = null
  if (totalCash != null && ocf != null && ocf < 0) {
    const burnQ = Math.abs(ocf) / 4
    const quarters = burnQ > 0 ? Math.round(totalCash / burnQ) : 0
    const status = quarters >= 16 ? "BEZPIECZNY" as const : quarters >= 8 ? "KOMFORT MINIMALNY" as const : quarters >= 4 ? "UWAGA" as const : "ALARM" as const
    const yearsLeft = quarters / 4
    const nextFunding = quarters >= 16 ? `~${(2026 + yearsLeft * 0.6).toFixed(0)}+` : quarters >= 8 ? `~${(2026 + yearsLeft * 0.5).toFixed(0)}` : "W ciągu 12 miesięcy"

    // Dilution check from earnings
    let dilutionRisk = "Brak danych historycznych"
    if (earnings) {
      const bs = (earnings.balanceSheetAnnual ?? []).filter(b => b.sharesOutstanding != null)
      if (bs.length >= 2) {
        const dilPct = ((bs[bs.length-1].sharesOutstanding! - bs[bs.length-2].sharesOutstanding!) / bs[bs.length-2].sharesOutstanding!) * 100
        dilutionRisk = dilPct > 10 ? `WYSOKIE — akcje +${dilPct.toFixed(0)}% YoY` : dilPct > 3 ? `UMIARKOWANE — akcje +${dilPct.toFixed(1)}% YoY` : `NISKIE — akcje ${dilPct.toFixed(1)}% YoY`
        if (dilPct > 10) redFlags.push({ category: "financial", severity: "high", title: `Rozwodnienie ${dilPct.toFixed(0)}% YoY`, description: `Liczba akcji wzrosła o ${dilPct.toFixed(1)}% rok do roku. Źródło: Yahoo balanceSheetAnnual.sharesOutstanding.`, metric: `+${dilPct.toFixed(1)}%` })
      }
    }

    runway = { cashM: totalCash / 1e6, burnPerQuarterM: burnQ / 1e6, quarters, status, nextFundingEstimate: nextFunding, dilutionRisk }

    if (quarters < 4) redFlags.push({ category: "financial", severity: "critical", title: `ALARM: ${quarters} kwartałów runway`, description: `Gotówka ${fmtM(totalCash)} przy burn ${fmtM(burnQ)}/Q. Źródło: Yahoo totalCash, operatingCashFlow.`, metric: `${quarters}Q` })
    else if (quarters < 8) redFlags.push({ category: "financial", severity: "high", title: `Runway: ${quarters} kwartałów`, description: `Gotówka ${fmtM(totalCash)}, burn ${fmtM(burnQ)}/Q. Prawdopodobna emisja akcji w 12-18 mies.`, metric: `${quarters}Q` })
  } else if (totalCash != null && ocf != null && ocf >= 0) {
    runway = { cashM: totalCash / 1e6, burnPerQuarterM: 0, quarters: 99, status: "BEZPIECZNY", nextFundingEstimate: "Nie wymagane (OCF+)", dilutionRisk: "NISKIE — cash flow dodatni" }
  }

  // ═══ MOD1: RELATIVE VALUATION (replaces P/E fair value) ═══
  // EV/Forward Revenue N+2
  const fwd = earnings?.forwardEstimates ?? []
  const fwdNextYear = fwd.find(f => f.period === "+1y")
  const fwdRev = fwdNextYear?.revEstimate ?? null
  const evForwardRevenue = fwdRev != null && fwdRev > 0 ? ev / fwdRev : null
  const evRPO: number | null = null // RPO not available from Yahoo — show as N/A

  // ═══ MOD3: REVENUE ACCELERATION (replaces Rule of 40) ═══
  let revenueAcceleration: QuantumValuation["revenueAcceleration"] = null
  if (earnings) {
    const qStmts = (earnings.incomeStatements ?? []).filter(s => s.revenue != null && s.revenue > 0).sort((a,b) => a.date.localeCompare(b.date))
    if (qStmts.length >= 6) {
      const latest = qStmts[qStmts.length - 1]
      const prev = qStmts[qStmts.length - 2]
      const yoyLatest = qStmts.find(s => s.date.slice(5) === latest.date.slice(5) && s.date < latest.date)
      const yoyPrev = qStmts.find(s => s.date.slice(5) === prev.date.slice(5) && s.date < prev.date)
      if (yoyLatest && yoyPrev && yoyLatest.revenue && yoyPrev.revenue) {
        const g1 = ((prev.revenue! - yoyPrev.revenue) / Math.abs(yoyPrev.revenue)) * 100
        const g2 = ((latest.revenue! - yoyLatest.revenue) / Math.abs(yoyLatest.revenue)) * 100
        revenueAcceleration = { q1: prev.date, q2: latest.date, q1growth: g1, q2growth: g2, accelerating: g2 > g1 }
      }
    }
  }

  // ═══ MOD5: SCENARIO VALUATION with explicit discount ═══
  const discountRate = trl >= 7 ? 0.22 : trl >= 5 ? 0.30 : 0.40
  const horizon = trl >= 7 ? 5 : trl >= 5 ? 7 : 12
  const pvFactor = 1 / Math.pow(1 + discountRate, horizon)
  const currentRev = totalRev ?? 0

  const exitRevFull = Math.max(currentRev * 8, 500e6)
  const exitRevNiche = Math.max(currentRev * 3, 200e6)
  const exitRevPivot = Math.max(currentRev * 1.5, 50e6)

  // Bankruptcy prob adjusted by runway
  const bankruptcyProb = !runway ? 20 : runway.quarters >= 20 ? 5 : runway.quarters >= 12 ? 8 : runway.quarters >= 6 ? 15 : 30

  const rawScenarios = [
    { name: "Pełny sukces komercyjny", prob: trl >= 7 ? 15 : trl >= 5 ? 10 : 5, exitRev: exitRevFull, mult: 20 },
    { name: "Sukces niszowy", prob: trl >= 7 ? 30 : trl >= 5 ? 25 : 15, exitRev: exitRevNiche, mult: 10 },
    { name: "Akwizycja przez BigTech", prob: 25, exitRev: 0, mult: 0 },  // special
    { name: "Pivot do pokrewnej tech", prob: trl >= 7 ? 15 : 10, exitRev: exitRevPivot, mult: 6 },
    { name: "Upadłość / likwidacja", prob: bankruptcyProb, exitRev: 0, mult: 0 },
  ]

  const scenarios: QuantumScenario[] = rawScenarios.map(s => {
    let nominalPerShare: number
    if (s.name.includes("Akwizycja")) {
      nominalPerShare = (mcap * 2.0) / sharesOut  // 2x current MCap
    } else if (s.name.includes("Upadłość")) {
      nominalPerShare = 0
    } else {
      nominalPerShare = (s.exitRev * s.mult) / sharesOut
    }
    const discounted = nominalPerShare * pvFactor
    return {
      name: s.name, probability: s.prob,
      description: `Revenue: ${s.exitRev > 0 ? fmtM(s.exitRev) : "N/A"} × ${s.mult > 0 ? s.mult + "x" : "N/A"} → zdyskontowane ${(discountRate*100).toFixed(0)}%/${horizon}lat (PV=${pvFactor.toFixed(3)})`,
      exitRevenue: s.exitRev > 0 ? fmtM(s.exitRev) : s.name.includes("Akwizycja") ? "2× MCap" : "$0",
      exitMultiple: s.mult > 0 ? `${s.mult}x` : s.name.includes("Akwizycja") ? "2× MCap" : "0x",
      impliedValue: discounted, nominalValue: nominalPerShare,
      discountRate, horizon, pvFactor,
    }
  })

  // MOD5 validation: full success MUST be > acquisition
  if (scenarios[0].impliedValue < scenarios[2].impliedValue) {
    redFlags.push({ category: "market", severity: "medium", title: "Błąd kalibracji scenariuszy", description: `Wartość 'Pełny sukces' ($${scenarios[0].impliedValue.toFixed(2)}) < 'Akwizycja' ($${scenarios[2].impliedValue.toFixed(2)}). Mnożniki exit mogą być za niskie.`, metric: "Kalibracja" })
  }

  // Normalize probabilities
  const totalProb = scenarios.reduce((s, sc) => s + sc.probability, 0)
  scenarios.forEach(sc => sc.probability = Math.round(sc.probability / totalProb * 100))

  const weightedFairValue = scenarios.reduce((s, sc) => s + (sc.probability / 100) * sc.impliedValue, 0)
  const currentVsWeighted = weightedFairValue > 0 ? ((price - weightedFairValue) / weightedFairValue) * 100 : 0

  // ═══ MOD4: IMPLIED PROBABILITY (correct math) ═══
  const vBull = scenarios[0].impliedValue
  const otherScenarios = scenarios.slice(1)
  const otherProbTotal = otherScenarios.reduce((s, sc) => s + sc.probability, 0)
  const vRest = otherProbTotal > 0 ? otherScenarios.reduce((s, sc) => s + (sc.probability / otherProbTotal) * sc.impliedValue, 0) : 0
  const impliedSuccessProb = vBull > vRest ? clamp(Math.round(((price - vRest) / (vBull - vRest)) * 100), 0, 100) : 0
  const modelSuccessProb = scenarios[0].probability
  const probDelta = impliedSuccessProb - modelSuccessProb

  // ═══ MOD2: QUANTUM CHECKLIST ═══
  const checklist: QuantumChecklistItem[] = []

  // 1. Runway > 8 kwartałów
  checklist.push(runway != null
    ? { label: "Runway > 8 kwartałów", status: runway.quarters >= 8 ? "pass" : "fail", reason: `${runway.quarters}Q runway (gotówka ${fmtM(runway.cashM * 1e6)}, burn ${fmtM(runway.burnPerQuarterM * 1e6)}/Q). Źródło: Yahoo totalCash / operatingCashFlow.` }
    : { label: "Runway > 8 kwartałów", status: "nodata", reason: "Brak danych o cash flow." })

  // 2. Revenue trend rosnący
  const rg = stats?.revenueGrowth
  checklist.push(rg != null
    ? { label: "Revenue trend rosnący YoY", status: rg > 0 ? "pass" : "fail", reason: `Revenue growth: ${(rg*100).toFixed(1)}% YoY. Źródło: Yahoo revenueGrowth.` }
    : { label: "Revenue trend rosnący YoY", status: "nodata", reason: "Brak danych o wzroście przychodów." })

  // 3. RPO / backlog > 2x TTM rev (not available from Yahoo)
  checklist.push({ label: "RPO / backlog > 2× TTM revenue", status: "nodata", reason: "RPO niedostępne z Yahoo Finance. Sprawdź 10-K/10-Q ręcznie." })

  // 4. Partner BigTech LUB kontrakt rządowy
  const analystCount = q.numberOfAnalysts ?? 0
  const instHeld = stats?.heldByInstitutions ?? null
  checklist.push(analystCount >= 5 && instHeld != null && instHeld > 0.3
    ? { label: "Walidacja zewnętrzna (analitycy/instytucje)", status: "pass", reason: `${analystCount} analityków, ${((instHeld ?? 0)*100).toFixed(0)}% instytucji. Proxy dla partnerstw. Źródło: Yahoo.` }
    : { label: "Walidacja zewnętrzna (analitycy/instytucje)", status: analystCount > 0 ? "pass" : "fail", reason: `${analystCount} analityków. Ograniczone pokrycie.` })

  // 5. TRL ≥ 5
  checklist.push({ label: "TRL ≥ 5", status: trl >= 5 ? "pass" : "fail", reason: `TRL ${trl}/9. Źródło: profil architektoniczny spółki.` })

  // 6. Własne IP / patenty
  checklist.push({ label: "Własne IP / patenty w core tech", status: profile.hardwareIntensity || profile.stackType === "full-stack" ? "pass" : "nodata", reason: profile.hardwareIntensity ? `Spółka buduje własny hardware (${profile.architecturePL}) — implikuje istotne IP.` : "Brak danych o patentach z Yahoo. Sprawdź 10-K." })

  // 7. Implied probability < 40%
  checklist.push({ label: "Implied P(sukces) < 40%", status: impliedSuccessProb <= 40 ? "pass" : "fail", reason: `Rynek implikuje ${impliedSuccessProb}% prawdopodobieństwo sukcesu. ${impliedSuccessProb > 40 ? "Wycena już dyskontuje sukces." : "Margin of safety obecny."} Obliczenie: (cena - V_rest) / (V_bull - V_rest).` })

  // 8. Brak koncentracji >50% u 1 klienta
  checklist.push({ label: "Brak koncentracji >50% u 1 klienta", status: "nodata", reason: "Szczegóły klientów niedostępne z Yahoo. Sprawdź 10-K risk factors." })

  // ═══ MOD6: TECH MOAT — 100% data-driven from Yahoo ═══
  const employees = stats?.fullTimeEmployees ?? null
  const shortPct = stats?.shortPercentOfFloat ?? null
  const cr = stats?.currentRatio ?? null
  const grossMargins = stats?.grossMargins ?? null

  const techMoat = [
    { name: "Skala R&D (pracownicy)", maxScore: 10,
      score: employees ? clamp(Math.round(Math.log10(Math.max(employees, 10)) * 2.5), 1, 10) : 3,
      description: employees ? `${employees.toLocaleString()} pracowników. ${employees > 500 ? "Duży zespół R&D." : "Mały zespół."}` : "Brak danych.",
      source: "Yahoo: fullTimeEmployees" },
    { name: "Wsparcie instytucjonalne", maxScore: 10,
      score: instHeld != null ? clamp(Math.round(instHeld * 12), 1, 10) : 3,
      description: instHeld != null ? `${(instHeld*100).toFixed(1)}% akcji u instytucji.` : "Brak danych.",
      source: "Yahoo: heldPercentInstitutions" },
    { name: "Pokrycie analityków", maxScore: 10,
      score: clamp(Math.round(analystCount * 0.7), 0, 10),
      description: `${analystCount} analityków. Rec: ${q.recommendationKey ?? "N/A"}. Target: $${q.targetMeanPrice?.toFixed(0) ?? "N/A"}.`,
      source: "Yahoo: numberOfAnalystOpinions, recommendationKey" },
    { name: "Marża brutto (dojrzałość produktu)", maxScore: 10,
      score: grossMargins != null && grossMargins > 0 ? clamp(Math.round(grossMargins * 12), 1, 10) : 1,
      description: grossMargins != null ? `Marża brutto: ${(grossMargins*100).toFixed(1)}%. ${grossMargins > 0.5 ? "Silna — produkt ma pricing power." : grossMargins > 0 ? "Dodatnia — wczesna monetyzacja." : "Ujemna — pre-commercial."}` : "Brak danych.",
      source: "Yahoo: grossMargins" },
    { name: "Sentyment (short interest)", maxScore: 10,
      score: shortPct != null ? clamp(10 - Math.round(shortPct * 30), 1, 10) : 5,
      description: shortPct != null ? `Short: ${(shortPct*100).toFixed(1)}% float. ${shortPct > 0.15 ? "Wysoki — rynek sceptyczny." : shortPct > 0.05 ? "Umiarkowany." : "Niski."}` : "Brak danych.",
      source: "Yahoo: shortPercentOfFloat" },
    { name: "Bufor gotówkowy", maxScore: 10,
      score: cr != null ? clamp(Math.round(Math.min(cr, 10)), 1, 10) : 3,
      description: cr != null ? `Current Ratio: ${cr.toFixed(1)}x. ${cr > 10 ? "Ekstremalnie silny bufor." : cr > 3 ? "Solidny." : cr > 1 ? "Adekwatny." : "Niska płynność."}` : "Brak danych.",
      source: "Yahoo: currentRatio" },
  ]

  const techMoatTotal = Math.round(techMoat.reduce((s, m) => s + m.score, 0) / techMoat.reduce((s, m) => s + m.maxScore, 0) * 100)

  // ═══ MOD8: SENSING VALUATION ═══
  const sensingValuation = profile.hasSensing ? {
    revenue: totalRev && totalRev > 0 ? `Total revenue: ${fmtM(totalRev)} (w tym sensing — brak podziału z Yahoo)` : "Pre-revenue",
    description: `Spółka posiada segment sensing (${profile.focus.filter(f => f.includes("sensing") || f.includes("clock")).join(", ")}). Yahoo nie dostarcza podziału revenue na segmenty. Sprawdź 10-K/10-Q dla wyodrębnienia wyceny sensing (typowy mnożnik: EV/Rev 8-12x dla dojrzałego hardware defense).`,
  } : null

  // ═══ MOD9: QUANTUM-SPECIFIC RISKS ═══
  const quantumRisks: QuantumRedFlag[] = [
    { category: "quantum", severity: "high", title: "Timeline risk — opóźnienie komercjalizacji", description: `TRL ${trl}/9. Komercjalizacja może się przesunąć o 3+ lat. Historia branży quantum pokazuje systematyczne niedoszacowanie czasu.`, metric: `TRL ${trl}` },
    { category: "quantum", severity: "medium", title: "BigTech displacement", description: "Google (Willow), IBM (Quantum), Microsoft (topological) mają nieograniczone budżety R&D. Ogłoszenie przełomu przez BigTech może zdominować rynek.", metric: "Konkurencja" },
    { category: "quantum", severity: runway && runway.quarters < 16 ? "high" : "medium", title: "Dilution risk — kolejna emisja przed przychodami", description: `Runway: ${runway?.quarters ?? "?"}Q. ${runway && runway.quarters < 12 ? "Prawdopodobna emisja w ciągu 12-24 mies." : "Runway komfortowy, ale monitoruj ATM programs."}`, metric: `${runway?.quarters ?? "?"}Q` },
  ]
  redFlags.push(...quantumRisks)

  // Additional red flags from data
  if (rg != null && rg < -0.1) redFlags.push({ category: "market", severity: "high", title: `Spadek przychodów ${(rg*100).toFixed(0)}% YoY`, description: `Źródło: Yahoo revenueGrowth.`, metric: `${(rg*100).toFixed(0)}%` })
  if (totalRev != null && totalRev > 0 && mcap / totalRev > 100) redFlags.push({ category: "market", severity: "medium", title: `EV/Revenue: ${Math.round(mcap/totalRev)}×`, description: `Ekstremalnie wysoka wycena. Źródło: Yahoo marketCap / totalRevenue.`, metric: `${Math.round(mcap/totalRev)}×` })

  // ═══ OVERALL SCORE ═══
  const runwayPts = !runway ? 10 : runway.quarters >= 16 ? 25 : runway.quarters >= 8 ? 18 : runway.quarters >= 4 ? 8 : 2
  const moatPts = Math.round(techMoatTotal * 0.25)
  const trlPts = Math.round((trl / 9) * 20)
  const revPts = totalRev && totalRev > 10e6 ? 15 : totalRev && totalRev > 1e6 ? 8 : 2
  const flagPenalty = redFlags.filter(f => f.severity === "critical").length * 10 + redFlags.filter(f => f.severity === "high").length * 3
  const overallScore = clamp(runwayPts + moatPts + trlPts + revPts - flagPenalty, 1, 100)
  const riskLevel = overallScore >= 65 ? "Umiarkowane (dla quantum)" : overallScore >= 40 ? "Podwyższone" : overallScore >= 20 ? "Wysokie" : "Krytyczne"

  const evRevNote = evForwardRevenue != null ? ` EV/Fwd Revenue (N+2): ${evForwardRevenue.toFixed(1)}x.` : ""
  const verdict = impliedSuccessProb > 50
    ? `${q.name}: rynek implikuje ${impliedSuccessProb}% P(sukces) — wycena dyskontuje sukces jako scenariusz bazowy.${evRevNote} Stopa dyskontowa: ${(discountRate*100).toFixed(0)}%, horyzont: ${horizon} lat.`
    : impliedSuccessProb > 30
    ? `${q.name}: rynek implikuje ${impliedSuccessProb}% P(sukces) — agresywne ale nie ekstremalne.${evRevNote} Model sugeruje ${modelSuccessProb}%.`
    : `${q.name}: rynek implikuje ${impliedSuccessProb}% P(sukces) — zbliżone do modelu (${modelSuccessProb}%).${evRevNote} Potencjalny margin of safety.`

  return {
    profile, isQuantum: true,
    evForwardRevenue, evRPO,
    checklist, revenueAcceleration,
    impliedSuccessProb, modelSuccessProb, probDelta,
    scenarios, weightedFairValue, currentVsWeighted, discountRate, horizon,
    techMoat, techMoatTotal,
    sensingValuation, quantumRisks,
    runway, redFlags, overallScore, riskLevel, verdict,
  }
}
