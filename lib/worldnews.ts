// ============================================================
// World News Radar — Multi-source news aggregator
// Sources: GDELT, Google News RSS, ReliefWeb, USGS
// ============================================================

export interface WorldNewsItem {
  id: string
  title: string
  description?: string
  source: string
  sourceType: "gdelt" | "google" | "reliefweb" | "usgs"
  category: "geopolitical" | "economic" | "market" | "energy" | "tech" | "crisis" | "environment"
  region: "americas" | "europe" | "asia" | "middle_east" | "africa" | "global"
  url: string
  date: string
  sentiment: "positive" | "negative" | "neutral"
  impact: "high" | "medium" | "low"
  country?: string
  image?: string
}

export interface WorldNewsData {
  items: WorldNewsItem[]
  stats: {
    total: number
    byCategory: Record<string, number>
    byRegion: Record<string, number>
    bySentiment: Record<string, number>
    byImpact: Record<string, number>
  }
  lastUpdated: string
}

// --- Sentiment detection (adapted from lib/news.ts) ---

const BULLISH_WORDS = [
  "beat", "beats", "record", "growth", "upgrade", "surges", "surge",
  "soars", "rally", "rallies", "gains", "gain", "rises", "rise",
  "jumps", "jump", "strong", "bullish", "outperform", "exceeds", "profit",
  "positive", "boost", "accelerate", "expands", "expansion",
  "breakthrough", "innovation", "recovery", "recover", "optimism",
  "momentum", "upbeat", "deal", "agreement", "peace", "cooperation",
]

const BEARISH_WORDS = [
  "miss", "misses", "cut", "cuts", "downgrade", "loss", "losses",
  "decline", "declines", "falls", "fall", "drops", "drop", "plunge",
  "crash", "crashes", "weak", "bearish", "underperform", "warning", "warns",
  "layoff", "layoffs", "debt", "slump", "disappoints", "sell",
  "concern", "risk", "fears", "fear", "recession", "bankruptcy",
  "fraud", "investigation", "lawsuit", "negative", "shrinks",
  "war", "conflict", "crisis", "sanctions", "attack", "threat",
  "disaster", "earthquake", "flood", "collapse", "killed", "deaths",
  "explosion", "terror", "shutdown", "default", "inflation",
]

function detectSentiment(title: string): "positive" | "negative" | "neutral" {
  const lower = title.toLowerCase()
  let bull = 0
  let bear = 0
  for (const w of BULLISH_WORDS) if (lower.includes(w)) bull++
  for (const w of BEARISH_WORDS) if (lower.includes(w)) bear++
  if (bull > bear) return "positive"
  if (bear > bull) return "negative"
  return "neutral"
}

// --- Category detection ---

const CATEGORY_KEYWORDS: Record<WorldNewsItem["category"], string[]> = {
  geopolitical: ["war", "conflict", "sanctions", "nato", "military", "troops", "diplomacy", "treaty", "alliance", "geopolit", "invasion", "missile", "nuclear", "territory", "border", "coup", "election", "vote", "protest", "rebel"],
  economic: ["economy", "gdp", "inflation", "interest rate", "federal reserve", "central bank", "unemployment", "jobs", "trade", "tariff", "fiscal", "monetary", "recession", "deficit", "debt", "imf", "world bank", "stimulus"],
  market: ["stock", "market", "s&p", "nasdaq", "dow", "ipo", "earnings", "shares", "investor", "rally", "bull", "bear", "trading", "index", "wall street", "bonds", "yield", "treasury"],
  energy: ["oil", "gas", "opec", "energy", "petroleum", "crude", "lng", "pipeline", "renewable", "solar", "wind", "nuclear energy", "coal", "commodity", "commodit"],
  tech: ["technology", "ai", "artificial intelligence", "semiconductor", "chip", "software", "cyber", "data", "cloud", "quantum", "robot", "automat", "startup", "silicon"],
  crisis: ["crisis", "humanitarian", "refugee", "famine", "drought", "epidemic", "pandemic", "emergency", "disaster", "casualties", "evacuat", "relief", "aid"],
  environment: ["climate", "environment", "carbon", "emission", "pollution", "deforestation", "biodiversity", "sustainability", "green", "ocean", "wildfire", "hurricane", "typhoon", "flood"],
}

function detectCategory(title: string): WorldNewsItem["category"] {
  const lower = title.toLowerCase()
  let best: WorldNewsItem["category"] = "economic"
  let bestCount = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [WorldNewsItem["category"], string[]][]) {
    let count = 0
    for (const kw of keywords) if (lower.includes(kw)) count++
    if (count > bestCount) { bestCount = count; best = cat }
  }
  return best
}

// --- Region detection ---

const REGION_MAP: Record<string, WorldNewsItem["region"]> = {
  // Americas
  "united states": "americas", "us": "americas", "usa": "americas", "canada": "americas", "brazil": "americas",
  "mexico": "americas", "argentina": "americas", "colombia": "americas", "chile": "americas", "peru": "americas",
  "venezuela": "americas", "cuba": "americas", "ecuador": "americas",
  // Europe
  "united kingdom": "europe", "uk": "europe", "france": "europe", "germany": "europe", "italy": "europe",
  "spain": "europe", "poland": "europe", "ukraine": "europe", "russia": "europe", "netherlands": "europe",
  "sweden": "europe", "norway": "europe", "switzerland": "europe", "austria": "europe", "belgium": "europe",
  "greece": "europe", "portugal": "europe", "czech": "europe", "romania": "europe", "hungary": "europe",
  "finland": "europe", "denmark": "europe", "eu": "europe", "europe": "europe", "nato": "europe",
  // Asia
  "china": "asia", "japan": "asia", "india": "asia", "south korea": "asia", "korea": "asia",
  "taiwan": "asia", "indonesia": "asia", "thailand": "asia", "vietnam": "asia", "philippines": "asia",
  "singapore": "asia", "malaysia": "asia", "bangladesh": "asia", "pakistan": "asia", "australia": "asia",
  "new zealand": "asia", "myanmar": "asia", "cambodia": "asia",
  // Middle East
  "iran": "middle_east", "iraq": "middle_east", "israel": "middle_east", "saudi": "middle_east",
  "turkey": "middle_east", "syria": "middle_east", "yemen": "middle_east", "jordan": "middle_east",
  "lebanon": "middle_east", "palestine": "middle_east", "gaza": "middle_east", "uae": "middle_east",
  "qatar": "middle_east", "kuwait": "middle_east", "oman": "middle_east", "bahrain": "middle_east",
  // Africa
  "nigeria": "africa", "south africa": "africa", "egypt": "africa", "kenya": "africa",
  "ethiopia": "africa", "ghana": "africa", "congo": "africa", "sudan": "africa",
  "morocco": "africa", "tanzania": "africa", "algeria": "africa", "libya": "africa",
  "somalia": "africa", "mozambique": "africa", "uganda": "africa",
}

function detectRegion(country: string | undefined, title: string): WorldNewsItem["region"] {
  const lower = (country || "").toLowerCase() + " " + title.toLowerCase()
  for (const [key, region] of Object.entries(REGION_MAP)) {
    if (lower.includes(key)) return region
  }
  return "global"
}

// --- Impact detection ---

const HIGH_IMPACT = [
  "war", "crash", "crisis", "collapse", "default", "sanctions", "attack", "invasion",
  "nuclear", "pandemic", "emergency", "explosion", "assassination", "coup", "earthquake",
  "tsunami", "hurricane", "record high", "record low", "plunge", "surge", "breaking",
]
const LOW_IMPACT = ["report", "update", "analysis", "review", "study", "survey", "minor", "slight"]

function detectImpact(title: string, sourceType: WorldNewsItem["sourceType"]): WorldNewsItem["impact"] {
  const lower = title.toLowerCase()
  if (sourceType === "usgs") return "high" // earthquakes are always significant
  for (const kw of HIGH_IMPACT) if (lower.includes(kw)) return "high"
  for (const kw of LOW_IMPACT) if (lower.includes(kw)) return "low"
  if (sourceType === "reliefweb") return "medium"
  return "medium"
}

// --- Fetch helpers ---

function makeId(sourceType: string, index: number, title: string): string {
  const hash = title.slice(0, 30).replace(/[^a-z0-9]/gi, "").toLowerCase()
  return `${sourceType}-${hash}-${index}`
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
      },
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// --- GDELT ---

interface GDELTArticle {
  url?: string
  title?: string
  seendate?: string
  socialimage?: string
  domain?: string
  language?: string
  sourcecountry?: string
}

async function fetchGDELTNews(): Promise<WorldNewsItem[]> {
  const queries = [
    { q: "market economy stock finance", hint: "economic" as const },
    { q: "geopolitics conflict sanctions war", hint: "geopolitical" as const },
    { q: "oil energy commodities opec", hint: "energy" as const },
    { q: "technology AI semiconductor", hint: "tech" as const },
  ]

  const items: WorldNewsItem[] = []

  const results = await Promise.allSettled(
    queries.map(async ({ q, hint }) => {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=25&format=json&timespan=24h`
      const res = await fetchWithTimeout(url)
      if (!res.ok) return []
      const data = await res.json()
      const articles: GDELTArticle[] = data?.articles || []
      return articles.map((a, i) => {
        const title = a.title || ""
        const cat = detectCategory(title) || hint
        return {
          id: makeId("gdelt", i, title),
          title,
          source: a.domain || "GDELT",
          sourceType: "gdelt" as const,
          category: cat,
          region: detectRegion(a.sourcecountry, title),
          url: a.url || "",
          date: a.seendate ? formatGDELTDate(a.seendate) : new Date().toISOString(),
          sentiment: detectSentiment(title),
          impact: detectImpact(title, "gdelt"),
          country: a.sourcecountry,
          image: a.socialimage,
        }
      })
    })
  )

  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value)
  }
  return items
}

function formatGDELTDate(d: string): string {
  // GDELT format: "20260316T120000Z" or similar
  try {
    if (d.length >= 15) {
      const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`
      return new Date(iso).toISOString()
    }
    return new Date(d).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

// --- Google News RSS ---

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim()
}

async function fetchGoogleNewsRSS(): Promise<WorldNewsItem[]> {
  const queries = ["world economy", "federal reserve", "geopolitics", "oil prices", "global markets"]
  const items: WorldNewsItem[] = []

  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
      const res = await fetchWithTimeout(url)
      if (!res.ok) return []
      const xml = await res.text()

      const parsed: WorldNewsItem[] = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let match: RegExpExecArray | null
      let idx = 0

      while ((match = itemRegex.exec(xml)) !== null && idx < 10) {
        const block = match[1]
        const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/)
        const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/)
        const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
        const descMatch = block.match(/<description>([\s\S]*?)<\/description>/)

        const rawTitle = titleMatch ? stripHtml(titleMatch[1]) : ""
        if (!rawTitle) continue

        let source = "Google News"
        let cleanTitle = rawTitle
        const dashIdx = rawTitle.lastIndexOf(" - ")
        if (dashIdx > 0) {
          source = rawTitle.slice(dashIdx + 3).trim()
          cleanTitle = rawTitle.slice(0, dashIdx).trim()
        }

        // Google News RSS descriptions are just links, not useful text — skip

        const link = linkMatch ? linkMatch[1].trim() : ""
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : ""
        let dateStr = new Date().toISOString()
        if (pubDate) {
          try { dateStr = new Date(pubDate).toISOString() } catch { /* keep default */ }
        }

        parsed.push({
          id: makeId("google", idx, cleanTitle),
          title: cleanTitle,
          source,
          sourceType: "google",
          category: detectCategory(cleanTitle),
          region: detectRegion(undefined, cleanTitle),
          url: link,
          date: dateStr,
          sentiment: detectSentiment(cleanTitle),
          impact: detectImpact(cleanTitle, "google"),
        })
        idx++
      }
      return parsed
    })
  )

  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value)
  }
  return items
}

// --- ReliefWeb ---

interface ReliefWebReport {
  fields?: {
    title?: string
    date?: { created?: string }
    source?: { name?: string }[]
    country?: { name?: string }[]
    primary_country?: { name?: string }
    disaster_type?: { name?: string }[]
  }
}

async function fetchReliefWebAlerts(): Promise<WorldNewsItem[]> {
  const url = `https://api.reliefweb.int/v1/reports?appname=terminal-bloomberg&limit=20&fields[include][]=title&fields[include][]=date.created&fields[include][]=source.name&fields[include][]=country.name&fields[include][]=primary_country.name&fields[include][]=disaster_type.name&filter[field]=date.created&filter[value][from]=now-24h`

  const res = await fetchWithTimeout(url)
  if (!res.ok) return []
  const data = await res.json()
  const reports: ReliefWebReport[] = data?.data || []

  return reports.map((r, i) => {
    const f = r.fields || {}
    const title = f.title || "Untitled"
    const country = f.primary_country?.name || f.country?.[0]?.name
    const source = f.source?.[0]?.name || "ReliefWeb"
    const date = f.date?.created || new Date().toISOString()
    const hasDisaster = (f.disaster_type || []).length > 0

    return {
      id: makeId("reliefweb", i, title),
      title,
      source,
      sourceType: "reliefweb" as const,
      category: hasDisaster ? "crisis" as const : "crisis" as const,
      region: detectRegion(country, title),
      url: `https://reliefweb.int`,
      date: new Date(date).toISOString(),
      sentiment: "negative" as const, // humanitarian alerts are generally negative
      impact: detectImpact(title, "reliefweb"),
      country,
    }
  })
}

// --- USGS Earthquakes ---

interface USGSFeature {
  properties?: {
    title?: string
    url?: string
    time?: number
    place?: string
    mag?: number
  }
}

async function fetchUSGSEarthquakes(): Promise<WorldNewsItem[]> {
  const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson"
  const res = await fetchWithTimeout(url)
  if (!res.ok) return []
  const data = await res.json()
  const features: USGSFeature[] = data?.features || []

  return features.slice(0, 10).map((f, i) => {
    const p = f.properties || {}
    const title = p.title || "Earthquake"
    const place = p.place || ""

    return {
      id: makeId("usgs", i, title),
      title,
      source: "USGS",
      sourceType: "usgs" as const,
      category: "environment" as const,
      region: detectRegion(undefined, place),
      url: p.url || "https://earthquake.usgs.gov",
      date: p.time ? new Date(p.time).toISOString() : new Date().toISOString(),
      sentiment: "negative" as const,
      impact: (p.mag || 0) >= 6 ? "high" as const : "medium" as const,
      country: place,
    }
  })
}

// --- Deduplication ---

function deduplicateByTitle(items: WorldNewsItem[]): WorldNewsItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    // Normalize: lowercase, remove punctuation, trim
    const key = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// --- Stats computation ---

function computeStats(items: WorldNewsItem[]): WorldNewsData["stats"] {
  const byCategory: Record<string, number> = {}
  const byRegion: Record<string, number> = {}
  const bySentiment: Record<string, number> = {}
  const byImpact: Record<string, number> = {}

  for (const item of items) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1
    byRegion[item.region] = (byRegion[item.region] || 0) + 1
    bySentiment[item.sentiment] = (bySentiment[item.sentiment] || 0) + 1
    byImpact[item.impact] = (byImpact[item.impact] || 0) + 1
  }

  return { total: items.length, byCategory, byRegion, bySentiment, byImpact }
}

// --- Company-specific news ---

async function fetchCompanyGDELT(ticker: string, companyName: string): Promise<WorldNewsItem[]> {
  const queries = [
    `"${ticker}" stock`,
    `"${companyName}" earnings revenue`,
    `"${companyName}" market`,
  ]
  const items: WorldNewsItem[] = []

  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=25&format=json&timespan=7d`
      const res = await fetchWithTimeout(url)
      if (!res.ok) return []
      const data = await res.json()
      const articles: GDELTArticle[] = data?.articles || []
      return articles.map((a, i) => {
        const title = a.title || ""
        return {
          id: makeId("gdelt", i, title),
          title,
          source: a.domain || "GDELT",
          sourceType: "gdelt" as const,
          category: detectCategory(title),
          region: detectRegion(a.sourcecountry, title),
          url: a.url || "",
          date: a.seendate ? formatGDELTDate(a.seendate) : new Date().toISOString(),
          sentiment: detectSentiment(title),
          impact: detectImpact(title, "gdelt"),
          country: a.sourcecountry,
          image: a.socialimage,
        }
      })
    })
  )

  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value)
  }
  return items
}

async function fetchCompanyGoogleNews(ticker: string, companyName: string): Promise<WorldNewsItem[]> {
  const queries = [
    `${ticker} stock`,
    `"${companyName}" earnings`,
    `"${companyName}" analyst`,
  ]
  const items: WorldNewsItem[] = []

  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
      const res = await fetchWithTimeout(url)
      if (!res.ok) return []
      const xml = await res.text()
      const parsed: WorldNewsItem[] = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let match: RegExpExecArray | null
      let idx = 0
      while ((match = itemRegex.exec(xml)) !== null && idx < 15) {
        const block = match[1]
        const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/)
        const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/)
        const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
        const descMatch = block.match(/<description>([\s\S]*?)<\/description>/)
        const rawTitle = titleMatch ? stripHtml(titleMatch[1]) : ""
        if (!rawTitle) continue
        let source = "Google News"
        let cleanTitle = rawTitle
        const dashIdx = rawTitle.lastIndexOf(" - ")
        if (dashIdx > 0) {
          source = rawTitle.slice(dashIdx + 3).trim()
          cleanTitle = rawTitle.slice(0, dashIdx).trim()
        }
        let description = ""
        if (descMatch) {
          const rawDesc = stripHtml(descMatch[1]).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
          const lines = rawDesc.split(/\n/).map(l => l.trim()).filter(l => l.length > 10)
          description = lines.slice(0, 3).join(". ")
        }
        const link = linkMatch ? linkMatch[1].trim() : ""
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : ""
        let dateStr = new Date().toISOString()
        if (pubDate) {
          try { dateStr = new Date(pubDate).toISOString() } catch { /* keep default */ }
        }
        parsed.push({
          id: makeId("google", idx, cleanTitle),
          title: cleanTitle,
          description: description || undefined,
          source,
          sourceType: "google",
          category: detectCategory(cleanTitle),
          region: detectRegion(undefined, cleanTitle),
          url: link,
          date: dateStr,
          sentiment: detectSentiment(cleanTitle),
          impact: detectImpact(cleanTitle, "google"),
        })
        idx++
      }
      return parsed
    })
  )

  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value)
  }
  return items
}

export async function fetchCompanyNews(ticker: string, companyName: string): Promise<WorldNewsData> {
  const [gdelt, google] = await Promise.allSettled([
    fetchCompanyGDELT(ticker, companyName),
    fetchCompanyGoogleNews(ticker, companyName),
  ])

  let items: WorldNewsItem[] = []
  if (gdelt.status === "fulfilled") items.push(...gdelt.value)
  if (google.status === "fulfilled") items.push(...google.value)

  items = deduplicateByTitle(items)
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const stats = computeStats(items)
  return { items, stats, lastUpdated: new Date().toISOString() }
}

// --- Main orchestrator ---

export async function fetchWorldNews(category?: string, region?: string): Promise<WorldNewsData> {
  const [gdelt, google, reliefweb, usgs] = await Promise.allSettled([
    fetchGDELTNews(),
    fetchGoogleNewsRSS(),
    fetchReliefWebAlerts(),
    fetchUSGSEarthquakes(),
  ])

  let items: WorldNewsItem[] = []
  if (gdelt.status === "fulfilled") items.push(...gdelt.value)
  if (google.status === "fulfilled") items.push(...google.value)
  if (reliefweb.status === "fulfilled") items.push(...reliefweb.value)
  if (usgs.status === "fulfilled") items.push(...usgs.value)

  // Deduplicate
  items = deduplicateByTitle(items)

  // Sort by date desc
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Apply filters
  if (category && category !== "all") {
    items = items.filter((i) => i.category === category)
  }
  if (region && region !== "all") {
    items = items.filter((i) => i.region === region)
  }

  const stats = computeStats(items)

  return {
    items,
    stats,
    lastUpdated: new Date().toISOString(),
  }
}
