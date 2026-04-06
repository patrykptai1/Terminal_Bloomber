// ============================================================
// Fundamental Product & Strategic Analysis Engine
// Covers: Product DNA, Porter's 5 Forces, PESTEL, Economic Moat
// ============================================================

export interface PorterForce {
  name: string
  namePL: string
  score: number        // 1-10 (10 = ideal for company)
  description: string  // Polish
}

export interface PestelFactor {
  code: string
  name: string
  impact: "positive" | "negative" | "neutral"
  description: string  // Polish
}

export interface MoatType {
  type: string
  strength: "strong" | "moderate" | "weak" | "none"
  description: string
}

export interface ProductInfo {
  name: string
  description: string
}

export interface FundamentalReport {
  // 1. Product DNA
  productType: "Painkiller" | "Vitamin" | "Platform" | "Infrastructure"
  revenueModel: string
  lifecycle: "Wprowadzenie" | "Wzrost" | "Dojrzałość" | "Schyłek"
  usp: string
  // NEW: detailed product info
  mainProducts: ProductInfo[]
  targetCustomer: string    // B2B, B2C, B2B2C, Government
  customerSegments: string[]
  geographicReach: string
  employees: number | null
  competitivePosition: string
  // 2. Porter's 5 Forces
  porter: PorterForce[]
  porterAvg: number
  // 3. PESTEL
  pestel: PestelFactor[]
  // 4. Economic Moat
  moatTypes: MoatType[]
  moatRating: "Wide" | "Narrow" | "None"
  moatScore: number // 0-100
  // 5. Overall fundamental score (1-100)
  fundamentalScore: number
  scoreBreakdown: {
    productDNA: number        // max 20
    porterScore: number       // max 25
    pestelScore: number       // max 15
    moatComponent: number     // max 25
    financialFit: number      // max 15
  }
  scoreTier: "Elita" | "Silna" | "Solidna" | "Przeciętna" | "Słaba"
  // Summary
  verdict: string
}

// ── Industry classification helpers ──

const PAINKILLER_INDUSTRIES = [
  "cybersecurity", "security", "insurance", "healthcare", "medical", "pharma",
  "defense", "utilities", "waste", "water", "infrastructure",
]

const PLATFORM_INDUSTRIES = [
  "marketplace", "exchange", "social", "network", "payment", "fintech",
  "cloud", "saas", "platform", "advertising",
]

const INFRA_INDUSTRIES = [
  "semiconductor", "data center", "telecom", "broadband", "hosting",
  "cloud infrastructure", "networking",
]

function classifyProduct(industry: string, sector: string, summary: string): "Painkiller" | "Vitamin" | "Platform" | "Infrastructure" {
  const text = `${industry} ${sector} ${summary}`.toLowerCase()
  if (PAINKILLER_INDUSTRIES.some(k => text.includes(k))) return "Painkiller"
  if (PLATFORM_INDUSTRIES.some(k => text.includes(k))) return "Platform"
  if (INFRA_INDUSTRIES.some(k => text.includes(k))) return "Infrastructure"
  return "Vitamin"
}

function classifyRevenueModel(industry: string, summary: string): string {
  const text = `${industry} ${summary}`.toLowerCase()
  if (text.includes("subscri") || text.includes("saas") || text.includes("recurring") || text.includes("cloud")) return "Subskrypcja (SaaS / przychody cykliczne)"
  if (text.includes("licens")) return "Licencjonowanie IP / oprogramowania"
  if (text.includes("advertis") || text.includes("ad-based")) return "Model reklamowy (ad-based)"
  if (text.includes("transact") || text.includes("payment") || text.includes("processing")) return "Model transakcyjny (prowizja od transakcji)"
  if (text.includes("marketplace") || text.includes("commission")) return "Marketplace (prowizja od sprzedaży)"
  if (text.includes("hardware") || text.includes("device") || text.includes("equip")) return "Sprzedaż sprzętu / urządzeń"
  if (text.includes("consult") || text.includes("services") || text.includes("professional")) return "Usługi profesjonalne / konsulting"
  return "Model mieszany (wiele strumieni)"
}

function classifyLifecycle(revenueGrowth: number | null, grossMargin: number | null, marketCap: number): "Wprowadzenie" | "Wzrost" | "Dojrzałość" | "Schyłek" {
  // FIX #15: "Wprowadzenie" is now reachable for pre-revenue/early companies
  // FIX #20: "Schyłek" requires significantly negative growth, not just -0.1%
  if (revenueGrowth == null) return marketCap < 500e6 ? "Wprowadzenie" : "Dojrzałość"
  if (marketCap < 1e9 && revenueGrowth > 50) return "Wprowadzenie"
  if (revenueGrowth > 30) return "Wzrost"
  if (revenueGrowth > 10) return marketCap < 10e9 ? "Wzrost" : "Dojrzałość"
  if (revenueGrowth > -5) return "Dojrzałość"  // -5% to 10% = mature, not decline
  return "Schyłek"  // Only < -5% = true structural decline
}

// ── Porter's 5 Forces ──

function computePorter(
  grossMargin: number | null,
  profitMargin: number | null,
  revenueGrowth: number | null,
  marketCap: number,
  industry: string,
  summary: string,
): PorterForce[] {
  const gm = grossMargin ?? 30
  const pm = profitMargin ?? 5
  const rg = revenueGrowth ?? 5
  const text = `${industry} ${summary}`.toLowerCase()

  // FIX #16: Rivalry score uses multiple factors, not just gross margin
  const hasPatents = text.includes("patent") || text.includes("proprietary") || text.includes("ip ")
  const isNiche = marketCap < 20e9
  const highGrowth = rg > 15  // fast-growing market = less rivalry pressure
  const concentrated = marketCap > 50e9  // large player = likely oligopoly
  let rivalry = 3  // base: moderate
  rivalry += gm > 60 ? 2 : gm > 40 ? 1 : 0  // margin as ONE factor (not sole)
  rivalry += hasPatents ? 2 : 0
  rivalry += isNiche ? 1 : 0
  rivalry += highGrowth ? 1 : 0  // growing market reduces direct rivalry
  rivalry += concentrated ? 1 : 0  // scale = competitive moat
  rivalry = Math.max(1, Math.min(10, rivalry))

  // 2. Barriers to entry
  const isRegulated = text.includes("fda") || text.includes("regulat") || text.includes("certif") || text.includes("compliance") || text.includes("licensed")
  const hasIPMoat = text.includes("patent") || text.includes("proprietary") || text.includes("trade secret")
  let barriers = Math.round(3 + (gm > 60 ? 2 : gm > 40 ? 1 : 0) + (isRegulated ? 2 : 0) + (hasIPMoat ? 2 : 0) + (marketCap > 50e9 ? 1 : 0))
  barriers = Math.max(1, Math.min(10, barriers))

  // 3. Supplier power (lower is better for company, we invert)
  const isAssetLight = text.includes("software") || text.includes("saas") || text.includes("cloud") || text.includes("digital")
  const dependsOnChips = text.includes("semiconductor") || text.includes("chip") || text.includes("fab")
  let supplierScore = isAssetLight ? 8 : dependsOnChips ? 4 : 6
  supplierScore = Math.max(1, Math.min(10, supplierScore))

  // 4. Buyer power (switching costs)
  const hasLockIn = text.includes("platform") || text.includes("ecosystem") || text.includes("integrat") || text.includes("enterprise") || text.includes("mission-critical")
  const isConsumer = text.includes("consumer") || text.includes("retail") || text.includes("e-commerce")
  let buyerScore = hasLockIn ? 8 : isConsumer ? 4 : 6
  if (rg > 20) buyerScore += 1 // high growth = strong demand
  buyerScore = Math.max(1, Math.min(10, buyerScore))

  // 5. Substitutes
  const isUnique = hasPatents || text.includes("only ") || text.includes("first-mover") || text.includes("unique")
  let substScore = 5 + (isUnique ? 2 : 0) + (gm > 60 ? 1 : 0) + (hasLockIn ? 1 : 0)
  substScore = Math.max(1, Math.min(10, substScore))

  return [
    {
      name: "Rivalry",
      namePL: "Rywalizacja wewnątrzsektorowa",
      score: rivalry,
      description: gm > 60
        ? "Wysoka marża brutto sugeruje silną pozycję konkurencyjną i zdolność do utrzymania cen."
        : gm > 35
        ? "Umiarkowana konkurencja — marże pozwalają na inwestycje w rozwój."
        : "Intensywna konkurencja cenowa — niskie marże ograniczają pole manewru.",
    },
    {
      name: "Barriers",
      namePL: "Bariery wejścia",
      score: barriers,
      description: isRegulated && hasIPMoat
        ? "Silne bariery: regulacje branżowe + ochrona IP (patenty/know-how)."
        : isRegulated
        ? "Bariery regulacyjne chronią przed nową konkurencją."
        : hasIPMoat
        ? "Własność intelektualna tworzy barierę technologiczną."
        : "Relatywnie niskie bariery — ryzyko nowych graczy.",
    },
    {
      name: "Suppliers",
      namePL: "Siła dostawców",
      score: supplierScore,
      description: isAssetLight
        ? "Model asset-light (software) — minimalna zależność od dostawców fizycznych."
        : dependsOnChips
        ? "Zależność od łańcucha dostaw półprzewodników — ryzyko niedoborów."
        : "Umiarkowana zależność od dostawców.",
    },
    {
      name: "Buyers",
      namePL: "Siła nabywców (Switching Costs)",
      score: buyerScore,
      description: hasLockIn
        ? "Wysokie koszty zmiany — integracja z ekosystemem klienta tworzy lock-in."
        : isConsumer
        ? "Niskie koszty zmiany — konsumenci łatwo przechodzą do konkurencji."
        : "Umiarkowane koszty zmiany dostawcy.",
    },
    {
      name: "Substitutes",
      namePL: "Zagrożenie substytutami",
      score: substScore,
      description: isUnique
        ? "Unikalna oferta z ograniczoną liczbą bezpośrednich substytutów."
        : "Istnieją alternatywne sposoby zaspokojenia podobnej potrzeby.",
    },
  ]
}

// ── PESTEL ──

function computePestel(sector: string, industry: string, summary: string): PestelFactor[] {
  const text = `${sector} ${industry} ${summary}`.toLowerCase()
  const factors: PestelFactor[] = []

  // Political/Legal
  if (text.includes("defense") || text.includes("government")) {
    factors.push({ code: "P", name: "Polityczny", impact: "positive", description: "Wzrost wydatków obronnych/rządowych sprzyja popytowi." })
  } else if (text.includes("china") || text.includes("export") || text.includes("tariff")) {
    factors.push({ code: "P", name: "Polityczny", impact: "negative", description: "Ryzyko geopolityczne: cła, bany eksportowe, napięcia handlowe." })
  } else if (text.includes("regulat") || text.includes("fda") || text.includes("compliance")) {
    factors.push({ code: "L", name: "Prawny", impact: "neutral", description: "Regulacje branżowe tworzą barierę wejścia, ale zwiększają koszty compliance." })
  } else {
    factors.push({ code: "P/L", name: "Polityczno-prawny", impact: "neutral", description: "Standardowe otoczenie regulacyjne bez istotnych ryzyk." })
  }

  // Economic
  if (text.includes("enterprise") || text.includes("b2b")) {
    factors.push({ code: "E", name: "Ekonomiczny", impact: "neutral", description: "Popyt B2B zależy od budżetów IT przedsiębiorstw — wrażliwość na recesję." })
  } else if (text.includes("consumer") || text.includes("retail")) {
    factors.push({ code: "E", name: "Ekonomiczny", impact: "negative", description: "Popyt konsumencki wrażliwy na inflację i stopy procentowe." })
  } else {
    factors.push({ code: "E", name: "Ekonomiczny", impact: "neutral", description: "Umiarkowana cykliczność — popyt stabilny w większości scenariuszy." })
  }

  // Social
  if (text.includes("ai ") || text.includes("artificial intelligence") || text.includes("machine learn")) {
    factors.push({ code: "S", name: "Społeczny", impact: "positive", description: "Trend adopcji AI napędza popyt — rosnąca akceptacja społeczna technologii." })
  } else if (text.includes("health") || text.includes("medical") || text.includes("aging")) {
    factors.push({ code: "S", name: "Społeczny", impact: "positive", description: "Starzenie się społeczeństwa i rosnące wydatki na zdrowie." })
  } else {
    factors.push({ code: "S", name: "Społeczny", impact: "neutral", description: "Brak istotnych trendów społecznych bezpośrednio wpływających na produkt." })
  }

  // Technological
  if (text.includes("ai ") || text.includes("cloud") || text.includes("saas")) {
    factors.push({ code: "T", name: "Technologiczny", impact: "positive", description: "Spółka na fali transformacji cyfrowej — AI i cloud jako katalizator wzrostu." })
  } else if (text.includes("legacy") || text.includes("traditional")) {
    factors.push({ code: "T", name: "Technologiczny", impact: "negative", description: "Ryzyko dezaktualizacji technologicznej — AI/automatyzacja mogą wyprzeć model." })
  } else {
    factors.push({ code: "T", name: "Technologiczny", impact: "neutral", description: "Technologia stabilna, bez bezpośredniego zagrożenia disrupcji." })
  }

  // Environmental
  if (text.includes("energy") || text.includes("oil") || text.includes("mining") || text.includes("carbon")) {
    factors.push({ code: "Env", name: "Środowiskowy", impact: "negative", description: "Wysokie wymagania ESG i regulacje emisyjne mogą zwiększyć koszty." })
  } else if (text.includes("software") || text.includes("digital") || text.includes("saas")) {
    factors.push({ code: "Env", name: "Środowiskowy", impact: "positive", description: "Niski ślad węglowy produktu cyfrowego — zgodność z trendami ESG." })
  } else {
    factors.push({ code: "Env", name: "Środowiskowy", impact: "neutral", description: "Standardowy wpływ środowiskowy — brak istotnych ryzyk ESG." })
  }

  return factors
}

// ── Economic Moat ──

function computeMoat(
  grossMargin: number | null,
  profitMargin: number | null,
  revenueGrowth: number | null,
  marketCap: number,
  industry: string,
  summary: string,
  porterAvg: number,
): { moatTypes: MoatType[]; moatRating: "Wide" | "Narrow" | "None"; moatScore: number } {
  const gm = grossMargin ?? 30
  const rg = revenueGrowth ?? 0
  const text = `${industry} ${summary}`.toLowerCase()
  const moatTypes: MoatType[] = []
  let score = 0

  // Network Effect
  const hasNetwork = text.includes("platform") || text.includes("marketplace") || text.includes("network") || text.includes("ecosystem")
  if (hasNetwork && rg > 15) {
    moatTypes.push({ type: "Efekt sieciowy", strength: "strong", description: "Platforma zyskuje na wartości z każdym nowym użytkownikiem — silny efekt sieciowy." })
    score += 25
  } else if (hasNetwork) {
    moatTypes.push({ type: "Efekt sieciowy", strength: "moderate", description: "Elementy efektu sieciowego, ale wzrost spowalnia." })
    score += 15
  } else {
    moatTypes.push({ type: "Efekt sieciowy", strength: "none", description: "Brak istotnego efektu sieciowego w modelu biznesowym." })
  }

  // Switching Costs
  const hasLockIn = text.includes("enterprise") || text.includes("mission-critical") || text.includes("integrat") || text.includes("platform") || text.includes("workflow")
  if (hasLockIn && gm > 60) {
    moatTypes.push({ type: "Koszty zmiany", strength: "strong", description: "Wysokie koszty migracji — produkt głęboko zintegrowany z procesami klienta." })
    score += 25
  } else if (hasLockIn) {
    moatTypes.push({ type: "Koszty zmiany", strength: "moderate", description: "Umiarkowane koszty zmiany — integracja z istniejącą infrastrukturą klienta." })
    score += 15
  } else {
    moatTypes.push({ type: "Koszty zmiany", strength: "weak", description: "Niskie koszty zmiany — klient może łatwo przejść do konkurencji." })
    score += 5
  }

  // Cost Advantage
  if (gm > 70 && marketCap > 50e9) {
    moatTypes.push({ type: "Przewaga kosztowa", strength: "strong", description: "Skala i wysoka marża brutto wskazują na strukturalną przewagę kosztową." })
    score += 25
  } else if (gm > 50) {
    moatTypes.push({ type: "Przewaga kosztowa", strength: "moderate", description: "Dobra marża sugeruje pewną przewagę kosztową lub pricing power." })
    score += 15
  } else {
    moatTypes.push({ type: "Przewaga kosztowa", strength: "weak", description: "Brak wyraźnej przewagi kosztowej — marże pod presją." })
    score += 5
  }

  // Intangible Assets
  const hasBrand = marketCap > 100e9
  const hasIP = text.includes("patent") || text.includes("proprietary") || text.includes("trade secret")
  if (hasBrand || hasIP) {
    moatTypes.push({ type: "Aktywa niematerialne", strength: hasIP && hasBrand ? "strong" : "moderate", description: hasIP ? "Ochrona patentowa i/lub know-how technologiczny." : "Silna rozpoznawalność marki na rynku." })
    score += hasIP && hasBrand ? 25 : 15
  } else {
    moatTypes.push({ type: "Aktywa niematerialne", strength: "weak", description: "Brak silnej ochrony IP lub dominującej marki." })
    score += 5
  }

  // FIX #17: Symmetric Porter adjustment — good Porter rewards as much as bad punishes
  // porterAvg 5 = neutral (1.0x), porterAvg 1 = 0.8x, porterAvg 10 = 1.2x
  const porterMultiplier = 0.8 + (porterAvg / 10) * 0.4  // range: 0.8 to 1.2
  score = Math.round(score * porterMultiplier)

  const moatRating: "Wide" | "Narrow" | "None" = score >= 65 ? "Wide" : score >= 40 ? "Narrow" : "None"

  return { moatTypes, moatRating, moatScore: Math.min(100, score) }
}

// ── Main export ──

// ── Extract products from business summary ──

// Translate common English product descriptions to Polish
const EN_PL_PRODUCT: Record<string, string> = {
  "platform": "platforma", "software": "oprogramowanie", "solution": "rozwiązanie",
  "service": "usługa", "system": "system", "product": "produkt", "tool": "narzędzie",
  "cloud": "chmura", "subscription": "subskrypcja", "marketplace": "rynek",
  "analytics": "analityka", "automation": "automatyzacja", "security": "bezpieczeństwo",
  "infrastructure": "infrastruktura", "database": "baza danych", "network": "sieć",
  "hardware": "sprzęt", "device": "urządzenie", "chip": "procesor/chip",
  "semiconductor": "półprzewodnik", "sensor": "czujnik", "module": "moduł",
  "enterprise": "korporacyjny", "consumer": "konsumencki",
}

function translateProductDesc(engDesc: string): string {
  if (!engDesc || engDesc === "—") return "—"
  // Simple keyword-based translation for product type classification
  const lower = engDesc.toLowerCase()
  const parts: string[] = []

  if (lower.includes("platform") || lower.includes("software")) parts.push("Platforma / oprogramowanie")
  else if (lower.includes("service provider") || lower.includes("service")) parts.push("Usługa")
  else if (lower.includes("hardware") || lower.includes("device") || lower.includes("equipment")) parts.push("Sprzęt / urządzenie")
  else if (lower.includes("chip") || lower.includes("semiconductor") || lower.includes("processor")) parts.push("Półprzewodnik / chip")
  else parts.push("Produkt / usługa")

  if (lower.includes("ai") || lower.includes("artificial intelligence") || lower.includes("machine learn")) parts.push("AI")
  if (lower.includes("cloud")) parts.push("chmura")
  if (lower.includes("automat")) parts.push("automatyzacja")
  if (lower.includes("security") || lower.includes("cyber")) parts.push("bezpieczeństwo")
  if (lower.includes("data") || lower.includes("analytics")) parts.push("dane/analityka")
  if (lower.includes("marketing") || lower.includes("advertising")) parts.push("marketing/reklama")
  if (lower.includes("enterprise")) parts.push("dla przedsiębiorstw")
  if (lower.includes("consumer")) parts.push("dla konsumentów")
  if (lower.includes("healthcare") || lower.includes("medical")) parts.push("medycyna")
  if (lower.includes("financial") || lower.includes("payment")) parts.push("finanse/płatności")

  return parts.join(" — ")
}

function extractProducts(summary: string): ProductInfo[] {
  const products: ProductInfo[] = []
  const seen = new Set<string>()

  // Strategy: find branded product names (2-4 capitalized words before keywords)
  // Pattern: "BrandName Product" or "Brand Name Platform"
  const patterns = [
    // "Company operates/offers ProductName, a/an ..."
    /(?:operates?|offers?|provides?)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})\s*(?:platform|product|system|suite|service|solution)/gi,
    // "ProductName, an/a ..."
    /([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){1,3})\s*,\s+(?:a|an|the|its)\s/g,
    // "The ProductName segment/division"
    /(?:The|Its)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,3})\s+(?:segment|division|business)/gi,
  ]

  const sentences = summary.split(/\.\s+/)

  for (const pattern of patterns) {
    for (const sent of sentences) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(sent)) !== null) {
        let name = match[1].trim().replace(/\s+/g, " ")
        // Skip generic words, company name fragments, articles
        if (name.length < 3 || name.length > 50) continue
        if (/^(The|Its|This|That|These|Inc|Corp|Ltd|LLC|Company|Also|In addition)$/i.test(name)) continue
        // Deduplicate
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        // Get context from sentence for Polish description
        const desc = translateProductDesc(sent)
        products.push({ name, description: desc })
      }
    }
  }

  // Fallback: if no products found, extract segment names
  if (products.length === 0) {
    const segPattern = /(?:segment|division)\s+(?:offers?|includes?|provides?)\s+(.+?)(?:\.|;)/gi
    let match: RegExpExecArray | null
    while ((match = segPattern.exec(summary)) !== null) {
      const desc = translateProductDesc(match[1])
      products.push({ name: "Segment biznesowy", description: desc })
      if (products.length >= 3) break
    }
  }

  // If still nothing, create single entry from industry
  if (products.length === 0) {
    products.push({ name: "Główna działalność", description: translateProductDesc(summary.slice(0, 200)) })
  }

  return products.slice(0, 5)
}

function classifyTargetCustomer(summary: string, industry: string): string {
  const text = `${summary} ${industry}`.toLowerCase()
  const b2bSignals = ["enterprise", "businesses", "companies", "commercial", "corporate", "organizations", "clients"]
  const b2cSignals = ["consumer", "individual", "personal", "retail", "users", "customers purchase"]
  const govSignals = ["government", "federal", "military", "defense", "public sector", "agency", "agencies"]

  const b2b = b2bSignals.filter(s => text.includes(s)).length
  const b2c = b2cSignals.filter(s => text.includes(s)).length
  const gov = govSignals.filter(s => text.includes(s)).length

  if (gov >= 2) return "🏛️ B2G (Rząd / Obronność)"
  if (b2b > b2c && b2b >= 2) return "🏢 B2B (Przedsiębiorstwa)"
  if (b2c > b2b && b2c >= 2) return "👤 B2C (Konsumenci)"
  if (b2b > 0 && b2c > 0) return "🔄 B2B2C (Mieszany)"
  if (b2b > 0) return "🏢 B2B (Przedsiębiorstwa)"
  return "🔄 B2B/B2C (Mieszany)"
}

function extractCustomerSegments(summary: string, industry: string): string[] {
  const segments: string[] = []
  const text = `${summary} ${industry}`.toLowerCase()

  const segmentMap: Record<string, string> = {
    "healthcare": "Ochrona zdrowia",
    "financial": "Finanse i bankowość",
    "retail": "Handel detaliczny",
    "e-commerce": "E-commerce",
    "manufacturing": "Produkcja przemysłowa",
    "automotive": "Motoryzacja",
    "telecommunication": "Telekomunikacja",
    "education": "Edukacja",
    "energy": "Energia",
    "government": "Sektor publiczny",
    "defense": "Obronność",
    "media": "Media i rozrywka",
    "pharma": "Farmaceutyka",
    "insurance": "Ubezpieczenia",
    "real estate": "Nieruchomości",
    "travel": "Podróże i turystyka",
    "food": "Żywność i napoje",
    "agriculture": "Rolnictwo",
    "logistics": "Logistyka",
    "construction": "Budownictwo",
    "small and medium": "Małe i średnie firmy (SMB)",
    "enterprise": "Duże przedsiębiorstwa",
  }

  for (const [key, label] of Object.entries(segmentMap)) {
    if (text.includes(key)) segments.push(label)
  }

  return segments.length > 0 ? segments.slice(0, 5) : ["Szerokie spektrum branż"]
}

function extractGeography(summary: string): string {
  const text = summary.toLowerCase()
  if (text.includes("worldwide") || text.includes("globally")) return "🌍 Globalnie (cały świat)"
  if (text.includes("united states") && text.includes("international")) return "🇺🇸🌍 USA + rynki międzynarodowe"
  if (text.includes("united states") || text.includes("north america")) return "🇺🇸 Głównie USA / Ameryka Północna"
  if (text.includes("europe")) return "🇺🇸🇪🇺 USA + Europa"
  if (text.includes("asia")) return "🇺🇸🌏 USA + Azja"
  if (text.includes("poland") || text.includes("polska")) return "🇵🇱 Polska"
  return "Brak danych o zasięgu"
}

function buildCompetitivePosition(grossMargin: number | null, revenueGrowth: number | null, marketCap: number, _industry: string): string {
  const gm = grossMargin ?? 0
  const rg = revenueGrowth ?? 0

  if (marketCap > 200e9 && gm > 60) return "Dominujący lider rynku — skala, marża i rozpoznawalność marki tworzą trwałą przewagę."
  if (marketCap > 50e9 && gm > 50) return "Silny gracz z ugruntowaną pozycją — wysoka marża świadczy o sile cenowej i lojalności klientów."
  if (rg > 30 && gm > 50) return "Szybko rosnący pretendent — dynamiczny wzrost przy zachowaniu wysokich marż. Potencjalny przyszły lider."
  if (rg > 20 && marketCap < 20e9) return "Wschodzący gracz w fazie wzrostu — zdobywa udział w rynku, ale musi udowodnić skalowalność."
  if (gm > 40 && rg > 0) return "Stabilny gracz z dobrą pozycją — wzrost organiczny, ale bez dominacji rynkowej."
  if (rg < -5) return "Spółka w defensywie — spadające przychody sygnalizują utratę udziałów w rynku lub cykliczny dołek."
  if (gm <= 0) return "Brak wystarczających danych do oceny pozycji konkurencyjnej."
  return "Pozycja umiarkowana — firma konkuruje ceną lub skalą, bez wyraźnej przewagi produktowej."
}

export function computeFundamentalAnalysis(
  sector: string | null,
  industry: string | null,
  summary: string | null,
  grossMargin: number | null,
  profitMargin: number | null,
  revenueGrowth: number | null,
  fcfMargin: number | null,
  marketCap: number,
  employees?: number | null,
): FundamentalReport {
  const sec = sector ?? "Unknown"
  const ind = industry ?? "Unknown"
  const sum = summary ?? ""

  const productType = classifyProduct(ind, sec, sum)
  const revenueModel = classifyRevenueModel(ind, sum)
  const lifecycle = classifyLifecycle(revenueGrowth, grossMargin, marketCap)

  // NEW: Extract product details from summary
  const mainProducts = extractProducts(sum)
  const targetCustomer = classifyTargetCustomer(sum, ind)
  const customerSegments = extractCustomerSegments(sum, ind)
  const geographicReach = extractGeography(sum)
  const competitivePosition = buildCompetitivePosition(grossMargin, revenueGrowth, marketCap, ind)

  // FIX #18: USP clearly states when data is unavailable instead of showing fake 30%
  const gm = grossMargin ?? null
  let usp: string
  if (gm == null) {
    usp = "Brak danych o marży brutto — nie można ocenić pricing power produktu."
  } else if (gm > 70) {
    usp = "Wyjątkowo wysoka marża brutto (" + gm.toFixed(0) + "%) wskazuje na unikalny produkt z silnym pricing power."
  } else if (gm > 50) {
    usp = "Dobra marża brutto (" + gm.toFixed(0) + "%) — produkt ma wartość trudną do zastąpienia."
  } else if (gm > 30) {
    usp = "Umiarkowana marża (" + gm.toFixed(0) + "%) — konkurencja cenowa jest istotnym czynnikiem."
  } else {
    usp = "Niska marża brutto (" + gm.toFixed(0) + "%) — produkt jest towarem (commodity) z ograniczonym pricing power."
  }

  const porter = computePorter(grossMargin, profitMargin, revenueGrowth, marketCap, ind, sum)
  const porterAvg = Math.round(porter.reduce((acc, p) => acc + p.score, 0) / porter.length * 10) / 10

  const pestel = computePestel(sec, ind, sum)

  const { moatTypes, moatRating, moatScore } = computeMoat(grossMargin, profitMargin, revenueGrowth, marketCap, ind, sum, porterAvg)

  // ══════════════════════════════════════════════════════════
  // 5. FUNDAMENTAL SCORE (1-100)
  // ══════════════════════════════════════════════════════════
  const rg = revenueGrowth ?? 0
  const fm = fcfMargin ?? 0

  // A) Product DNA Score (max 20)
  let productDNA = 0
  // Product type: Painkiller/Platform > Infrastructure > Vitamin
  productDNA += productType === "Painkiller" ? 5 : productType === "Platform" ? 5 : productType === "Infrastructure" ? 4 : 2
  // Revenue model: recurring > transactional > one-time
  productDNA += revenueModel.includes("Subskrypcja") ? 5 : revenueModel.includes("Transakcyjny") || revenueModel.includes("Marketplace") ? 4 : revenueModel.includes("Licencj") ? 3 : 2
  // Lifecycle: Growth best, Maturity ok, Decline bad
  productDNA += lifecycle === "Wzrost" ? 5 : lifecycle === "Dojrzałość" ? 3 : lifecycle === "Wprowadzenie" ? 4 : 1
  // Product count & diversity
  productDNA += mainProducts.length >= 3 ? 5 : mainProducts.length >= 1 ? 3 : 1
  productDNA = Math.min(20, productDNA)

  // B) Porter Score (max 25) — rescale from avg 1-10 to 0-25
  const porterScore = Math.round((porterAvg / 10) * 25)

  // C) PESTEL Score (max 15)
  const pestelPositive = pestel.filter(p => p.impact === "positive").length
  const pestelNegative = pestel.filter(p => p.impact === "negative").length
  const pestelScore = Math.min(15, Math.max(0, Math.round(7.5 + pestelPositive * 2.5 - pestelNegative * 2.5)))

  // D) Moat Component (max 25) — rescale moatScore (0-100) to 0-25
  const moatComponent = Math.round(moatScore / 4)

  // E) Financial Fit (max 15) — how well financials support the product story
  let financialFit = 0
  // Gross margin fit
  const gmVal = gm ?? 0
  financialFit += gmVal > 70 ? 5 : gmVal > 50 ? 4 : gmVal > 30 ? 2 : 1
  // Revenue growth
  financialFit += rg > 25 ? 5 : rg > 10 ? 4 : rg > 0 ? 2 : 0
  // FCF margin
  financialFit += fm > 20 ? 5 : fm > 10 ? 4 : fm > 0 ? 2 : 0
  financialFit = Math.min(15, financialFit)

  const fundamentalScore = Math.max(1, Math.min(100, productDNA + porterScore + pestelScore + moatComponent + financialFit))

  const scoreTier: "Elita" | "Silna" | "Solidna" | "Przeciętna" | "Słaba" =
    fundamentalScore >= 80 ? "Elita" :
    fundamentalScore >= 65 ? "Silna" :
    fundamentalScore >= 50 ? "Solidna" :
    fundamentalScore >= 35 ? "Przeciętna" : "Słaba"

  // Verdict
  let verdict: string
  if (moatRating === "Wide" && fundamentalScore >= 70) {
    verdict = `Ocena ${fundamentalScore}/100 (${scoreTier}). Spółka posiada szeroką fosę ekonomiczną — silna pozycja konkurencyjna, wysokie bariery wejścia i trwała przewaga produktowa.`
  } else if (moatRating === "Narrow" || fundamentalScore >= 50) {
    verdict = `Ocena ${fundamentalScore}/100 (${scoreTier}). Spółka posiada wąską fosę ekonomiczną — pewna przewaga konkurencyjna, ale wymaga ciągłych inwestycji w produkt aby ją utrzymać.`
  } else {
    verdict = `Ocena ${fundamentalScore}/100 (${scoreTier}). Brak istotnej fosy ekonomicznej — produkt narażony na presję konkurencyjną. Kluczowe jest tempo innowacji.`
  }

  return {
    productType,
    revenueModel,
    lifecycle,
    usp,
    mainProducts,
    targetCustomer,
    customerSegments,
    geographicReach,
    employees: employees ?? null,
    competitivePosition,
    porter,
    porterAvg,
    pestel,
    moatTypes,
    moatRating,
    moatScore,
    fundamentalScore,
    scoreBreakdown: { productDNA, porterScore, pestelScore, moatComponent, financialFit },
    scoreTier,
    verdict,
  }
}
