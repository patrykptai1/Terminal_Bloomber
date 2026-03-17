"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import DonutChart from "@/components/charts/DonutChart"
import HorizontalBar from "@/components/charts/HorizontalBar"
import SectorImpactWidget from "@/components/modules/SectorImpactWidget"
import type { WorldNewsItem, WorldNewsData } from "@/lib/worldnews"
import type { WorldNewsItemInput } from "@/lib/sectorImpact"

// --- Constants ---

const CATEGORIES = ["all", "geopolitical", "economic", "market", "energy", "tech", "crisis", "environment", "company"] as const
const REGIONS = ["all", "americas", "europe", "asia", "middle_east", "africa", "global"] as const
const IMPACTS = ["all", "high", "medium", "low"] as const

const CATEGORY_COLORS: Record<string, string> = {
  geopolitical: "border-red-500",
  economic: "border-blue-500",
  market: "border-green-500",
  energy: "border-amber-500",
  tech: "border-purple-500",
  crisis: "border-red-600",
  environment: "border-teal-500",
}

const CATEGORY_BG: Record<string, string> = {
  geopolitical: "bg-red-500/20 text-red-400",
  economic: "bg-blue-500/20 text-blue-400",
  market: "bg-green-500/20 text-green-400",
  energy: "bg-amber-500/20 text-amber-400",
  tech: "bg-purple-500/20 text-purple-400",
  crisis: "bg-red-600/20 text-red-400",
  environment: "bg-teal-500/20 text-teal-400",
  company: "bg-cyan-500/20 text-cyan-400",
}

const CATEGORY_BAR_COLORS: Record<string, string> = {
  geopolitical: "oklch(0.6 0.2 25)",
  economic: "oklch(0.65 0.15 250)",
  market: "oklch(0.75 0.15 145)",
  energy: "oklch(0.7 0.12 60)",
  tech: "oklch(0.7 0.1 300)",
  crisis: "oklch(0.55 0.2 25)",
  environment: "oklch(0.6 0.12 180)",
  company: "oklch(0.65 0.12 200)",
}

const REGION_LABELS: Record<string, string> = {
  americas: "Americas",
  europe: "Europe",
  asia: "Asia-Pacific",
  middle_east: "Middle East",
  africa: "Africa",
  global: "Global",
}

const SENTIMENT_COLORS = {
  positive: "oklch(0.75 0.15 145)",
  neutral: "oklch(0.7 0.12 60)",
  negative: "oklch(0.6 0.2 25)",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function WorldNewsRadar() {
  const [data, setData] = useState<WorldNewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [impactFilter, setImpactFilter] = useState<string>("all")
  const [companyTicker, setCompanyTicker] = useState("")
  const [companyInput, setCompanyInput] = useState("")
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const isCompanyMode = categoryFilter === "company" && companyTicker
      const url = isCompanyMode
        ? `/api/world-news?company=${encodeURIComponent(companyTicker)}`
        : "/api/world-news"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch")
      const json: WorldNewsData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, companyTicker])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 5 * 60 * 1000) // 5 min
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchData])

  // Client-side filtering
  const filteredItems = (data?.items || []).filter((item) => {
    // In company mode, all items are already company-specific from API
    if (categoryFilter !== "all" && categoryFilter !== "company" && item.category !== categoryFilter) return false
    if (regionFilter !== "all" && item.region !== regionFilter) return false
    if (impactFilter !== "all" && item.impact !== impactFilter) return false
    return true
  })

  const highImpactItems = filteredItems.filter((i) => i.impact === "high").slice(0, 5)

  // Stats from unfiltered data
  const stats = data?.stats

  // Prepare news items for sector impact analysis
  const sectorNewsItems: WorldNewsItemInput[] = (data?.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    sentiment: item.sentiment,
    category: item.category,
    region: item.region,
    date: item.date,
    impact: item.impact,
  }))

  // --- Render ---
  return (
    <div className="font-mono">
      {/* SECTION 1: RADAR HEADER (full width) */}
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-bloomberg-green animate-pulse" />
            <h2 className="text-bloomberg-green font-bold text-sm tracking-widest">WORLD NEWS RADAR</h2>
            <span className="text-xs text-muted-foreground">
              {categoryFilter === "company" && companyTicker
                ? `COMPANY INTEL: ${companyTicker}`
                : "MULTI-SOURCE OSINT FEED"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {data?.lastUpdated && (
              <span className="text-xs text-muted-foreground">
                UPD {new Date(data.lastUpdated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-xs px-3 py-1 border border-bloomberg-border hover:border-bloomberg-green hover:text-bloomberg-green text-muted-foreground transition-colors disabled:opacity-50"
            >
              {loading ? "LOADING..." : "REFRESH"}
            </button>
          </div>
        </div>
        {error && <p className="text-bloomberg-red text-xs mt-2">ERROR: {error}</p>}
      </div>

      {/* 2-COLUMN LAYOUT: News (left) + Sector Impact (right) */}
      <div className="flex gap-4 mt-4">

      {/* LEFT COLUMN — News content */}
      <div className="flex-1 min-w-0 space-y-4">

      {/* SECTION 2: STATS DASHBOARD */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">TOTAL ARTICLES</div>
            <div className="text-2xl font-bold text-bloomberg-green">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {Object.keys(stats.byCategory).length} categories
            </div>
          </div>

          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">SENTIMENT</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-bloomberg-green text-xs">+{stats.bySentiment.positive || 0}</span>
              <span className="text-bloomberg-amber text-xs">~{stats.bySentiment.neutral || 0}</span>
              <span className="text-bloomberg-red text-xs">-{stats.bySentiment.negative || 0}</span>
            </div>
            <DonutChart
              data={[
                { name: "Positive", value: stats.bySentiment.positive || 0, color: SENTIMENT_COLORS.positive },
                { name: "Neutral", value: stats.bySentiment.neutral || 0, color: SENTIMENT_COLORS.neutral },
                { name: "Negative", value: stats.bySentiment.negative || 0, color: SENTIMENT_COLORS.negative },
              ]}
              size={120}
            />
          </div>

          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">IMPACT LEVEL</div>
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />HIGH</span>
                <span className="text-bloomberg-red text-sm font-bold">{stats.byImpact.high || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />MEDIUM</span>
                <span className="text-bloomberg-amber text-sm font-bold">{stats.byImpact.medium || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />LOW</span>
                <span className="text-bloomberg-green text-sm font-bold">{stats.byImpact.low || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
            <div className="text-xs text-muted-foreground mb-1">ACTIVE REGIONS</div>
            <div className="text-2xl font-bold text-bloomberg-amber">{Object.keys(stats.byRegion).length}</div>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {Object.entries(stats.byRegion).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, c]) => (
                <div key={r}>{REGION_LABELS[r] || r}: {c}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: FILTER BAR */}
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">CATEGORY:</span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategoryFilter(c)
                if (c !== "company") setCompanyTicker("")
              }}
              className={`text-xs px-2 py-0.5 border rounded transition-colors ${
                categoryFilter === c
                  ? "border-bloomberg-green text-bloomberg-green bg-bloomberg-green/10"
                  : "border-bloomberg-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "company" ? "🏢 COMPANY" : c.toUpperCase().replace("_", " ")}
            </button>
          ))}
          {categoryFilter === "company" && (
            <form
              className="flex items-center gap-1 ml-2"
              onSubmit={(e) => {
                e.preventDefault()
                const v = companyInput.trim().toUpperCase()
                if (v) setCompanyTicker(v)
              }}
            >
              <input
                type="text"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                placeholder="TICKER (e.g. NVDA)"
                className="text-xs px-2 py-0.5 bg-bloomberg-bg border border-bloomberg-border rounded text-foreground placeholder:text-muted-foreground focus:border-bloomberg-green focus:outline-none w-36 font-mono"
              />
              <button
                type="submit"
                className="text-xs px-2 py-0.5 border border-bloomberg-green text-bloomberg-green rounded hover:bg-bloomberg-green/10 transition-colors"
              >
                SCAN
              </button>
              {companyTicker && (
                <span className="text-xs text-bloomberg-amber font-bold ml-1">
                  {companyTicker}
                </span>
              )}
            </form>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">REGION:</span>
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={`text-xs px-2 py-0.5 border rounded transition-colors ${
                regionFilter === r
                  ? "border-bloomberg-green text-bloomberg-green bg-bloomberg-green/10"
                  : "border-bloomberg-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {(REGION_LABELS[r] || r).toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">IMPACT:</span>
          {IMPACTS.map((imp) => (
            <button
              key={imp}
              onClick={() => setImpactFilter(imp)}
              className={`text-xs px-2 py-0.5 border rounded transition-colors ${
                impactFilter === imp
                  ? "border-bloomberg-green text-bloomberg-green bg-bloomberg-green/10"
                  : "border-bloomberg-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {imp.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 4: HIGH IMPACT ALERTS */}
      {highImpactItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs text-bloomberg-red font-bold tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            HIGH IMPACT ALERTS
          </h3>
          <div className="space-y-2">
            {highImpactItems.map((item) => (
              <AlertItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: NEWS FEED */}
      <div className="bg-bloomberg-card border border-bloomberg-border rounded">
        <div className="p-3 border-b border-bloomberg-border flex items-center justify-between">
          <h3 className="text-xs text-bloomberg-amber font-bold tracking-wider">NEWS FEED</h3>
          <span className="text-xs text-muted-foreground">{filteredItems.length} articles</span>
        </div>
        <div className="max-h-[600px] overflow-y-auto divide-y divide-bloomberg-border">
          {loading && !data && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Loading world news from multiple sources...
            </div>
          )}
          {!loading && filteredItems.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No articles match current filters.
            </div>
          )}
          {filteredItems.map((item) => (
            <NewsFeedItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* SECTION 6 & 7 & 8: Bottom analytics row */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* CATEGORY BREAKDOWN */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
            <h3 className="text-xs text-bloomberg-amber font-bold tracking-wider mb-2">CATEGORY BREAKDOWN</h3>
            <HorizontalBar
              data={Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => ({
                  label: cat.toUpperCase(),
                  value: count,
                  color: CATEGORY_BAR_COLORS[cat] || "oklch(0.6 0.01 200)",
                }))}
            />
          </div>

          {/* REGION HEATMAP */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
            <h3 className="text-xs text-bloomberg-amber font-bold tracking-wider mb-2">REGION ACTIVITY</h3>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(REGION_LABELS).map(([key, label]) => {
                const count = stats.byRegion[key] || 0
                const intensity = stats.total > 0 ? Math.min(count / stats.total, 1) : 0
                return (
                  <div
                    key={key}
                    className="border border-bloomberg-border rounded p-2 text-center"
                    style={{ backgroundColor: `rgba(34, 197, 94, ${0.05 + intensity * 0.3})` }}
                  >
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-sm font-bold text-foreground">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SENTIMENT SUMMARY */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
            <h3 className="text-xs text-bloomberg-amber font-bold tracking-wider mb-2">SENTIMENT OVERVIEW</h3>
            <DonutChart
              data={[
                { name: "Positive", value: stats.bySentiment.positive || 0, color: SENTIMENT_COLORS.positive },
                { name: "Neutral", value: stats.bySentiment.neutral || 0, color: SENTIMENT_COLORS.neutral },
                { name: "Negative", value: stats.bySentiment.negative || 0, color: SENTIMENT_COLORS.negative },
              ]}
              size={180}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Market sentiment is predominantly{" "}
              <span className={
                (stats.bySentiment.negative || 0) > (stats.bySentiment.positive || 0)
                  ? "text-bloomberg-red"
                  : (stats.bySentiment.positive || 0) > (stats.bySentiment.negative || 0)
                    ? "text-bloomberg-green"
                    : "text-bloomberg-amber"
              }>
                {(stats.bySentiment.negative || 0) > (stats.bySentiment.positive || 0)
                  ? "NEGATIVE"
                  : (stats.bySentiment.positive || 0) > (stats.bySentiment.negative || 0)
                    ? "POSITIVE"
                    : "NEUTRAL"}
              </span>
            </p>
          </div>
        </div>
      )}

      </div>{/* END LEFT COLUMN */}

      {/* RIGHT COLUMN — Sector Impact Widget */}
      <div className="w-80 shrink-0 sticky top-4 self-start">
        {sectorNewsItems.length > 0 && (
          <SectorImpactWidget newsItems={sectorNewsItems} />
        )}
      </div>

      </div>{/* END 2-COLUMN LAYOUT */}
    </div>
  )
}

// --- Translation cache (persists across re-renders) ---
const translationCache = new Map<string, string>()

async function translateToPL(text: string): Promise<string> {
  const cached = translationCache.get(text)
  if (cached) return cached
  try {
    // MyMemory allows up to 500 chars per request
    const chunk = text.slice(0, 500)
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|pl`
    )
    if (!res.ok) return text
    const data = await res.json()
    const translated = data?.responseData?.translatedText || text
    // MyMemory returns UPPERCASE when low confidence — normalize
    const result = translated === translated.toUpperCase() && translated.length > 20
      ? text // fallback to original if all caps (bad translation)
      : translated
    translationCache.set(text, result)
    return result
  } catch {
    return text
  }
}

// Build full text for translation: title + context for ~3x longer output
function buildTranslationText(item: WorldNewsItem): string {
  const catEN: Record<string, string> = {
    geopolitical: "geopolitics and international relations",
    economic: "economy and macroeconomics",
    market: "financial markets and stocks",
    energy: "energy and commodities",
    tech: "technology and innovation",
    crisis: "humanitarian crisis",
    environment: "environment and climate",
  }
  const sentEN = item.sentiment === "positive" ? "positive outlook" : item.sentiment === "negative" ? "negative outlook, potential risk" : "neutral development"
  const impactEN = item.impact === "high" ? "High market impact expected" : item.impact === "medium" ? "Moderate market impact" : "Low direct market impact"
  const region = REGION_LABELS[item.region] || item.region

  return `${item.title}. This news relates to ${catEN[item.category] || item.category} in the ${region} region. Source: ${item.source}. Analyst assessment: ${sentEN}. ${impactEN}. Investors should monitor this development closely.`
}

// --- Shared tooltip hook ---
function useNewsTooltip(item: WorldNewsItem) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const fullText = buildTranslationText(item)

  const handleMouseEnter = () => {
    const rect = rowRef.current?.getBoundingClientRect()
    if (rect) {
      const x = Math.min(rect.left + 32, window.innerWidth - 380)
      // Show above if enough space, otherwise below
      const above = rect.top > 180
      const y = above ? rect.top - 10 : rect.bottom + 10
      setTooltipPos({ x, y: y > window.innerHeight - 180 ? rect.top - 160 : y })
    }
    hoverTimer.current = setTimeout(async () => {
      setShow(true)
      if (translationCache.has(fullText)) {
        setTooltip(translationCache.get(fullText)!)
      } else {
        setLoading(true)
        const translated = await translateToPL(fullText)
        setTooltip(translated)
        setLoading(false)
      }
    }, 300)
  }

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShow(false)
    setTooltipPos(null)
  }

  return { tooltip, loading, show, tooltipPos, rowRef, handleMouseEnter, handleMouseLeave }
}

// --- Tooltip portal component ---
function TooltipPortal({ show, tooltipPos, loading, tooltip, item }: {
  show: boolean
  tooltipPos: { x: number; y: number } | null
  loading: boolean
  tooltip: string | null
  item: WorldNewsItem
}) {
  const sentimentColor = item.sentiment === "positive" ? "text-bloomberg-green" : item.sentiment === "negative" ? "text-bloomberg-red" : "text-bloomberg-amber"
  const sentimentPL = item.sentiment === "positive" ? "Pozytywny" : item.sentiment === "negative" ? "Negatywny" : "Neutralny"
  const impactPL = item.impact === "high" ? "Wysoki" : item.impact === "medium" ? "Średni" : "Niski"

  if (!show || !tooltipPos) return null

  return createPortal(
    <div
      className="fixed z-[9999] w-[360px] bg-gray-900 border border-bloomberg-green/40 rounded-lg p-3 shadow-lg shadow-black/50 pointer-events-none font-mono"
      style={{ left: tooltipPos.x, top: tooltipPos.y }}
    >
      <div className="text-xs text-bloomberg-green font-bold mb-1.5 tracking-wider">PODSUMOWANIE</div>
      {loading ? (
        <div className="text-xs text-muted-foreground animate-pulse">Tłumaczenie...</div>
      ) : (
        <p className="text-sm text-foreground leading-relaxed">{tooltip}</p>
      )}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-bloomberg-border text-xs">
        <span className={sentimentColor}>Sentyment: {sentimentPL}</span>
        <span className="text-muted-foreground">|</span>
        <span className={item.impact === "high" ? "text-bloomberg-red" : item.impact === "medium" ? "text-bloomberg-amber" : "text-bloomberg-green"}>
          Wpływ: {impactPL}
        </span>
      </div>
    </div>,
    document.body
  )
}

// --- Sub-component: HIGH IMPACT ALERT item with tooltip ---

function AlertItem({ item }: { item: WorldNewsItem }) {
  const { tooltip, loading, show, tooltipPos, rowRef, handleMouseEnter, handleMouseLeave } = useNewsTooltip(item)

  return (
    <div
      ref={rowRef}
      className="bg-bloomberg-card border border-red-500/40 rounded p-3 flex items-start gap-3 cursor-default"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TooltipPortal show={show} tooltipPos={tooltipPos} loading={loading} tooltip={tooltip} item={item} />
      <span className="text-red-500 text-lg mt-0.5">&#9889;</span>
      <div className="flex-1 min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground hover:text-bloomberg-green transition-colors block truncate"
        >
          {item.title}
        </a>
        <div className="flex items-center gap-2 mt-1 text-xs">
          <span className="text-muted-foreground">{item.source}</span>
          <span className="text-muted-foreground">{timeAgo(item.date)}</span>
          <span className={`px-1.5 py-0.5 rounded ${CATEGORY_BG[item.category] || "bg-gray-500/20 text-gray-400"}`}>
            {item.category}
          </span>
          <span className="text-muted-foreground">{REGION_LABELS[item.region] || item.region}</span>
        </div>
      </div>
    </div>
  )
}

// --- Sub-component: single news feed item with hover tooltip ---

function NewsFeedItem({ item }: { item: WorldNewsItem }) {
  const { tooltip, loading, show, tooltipPos, rowRef, handleMouseEnter, handleMouseLeave } = useNewsTooltip(item)

  const sentimentIcon = item.sentiment === "positive" ? "\u25B2" : item.sentiment === "negative" ? "\u25BC" : "\u25CF"
  const sentimentColor = item.sentiment === "positive" ? "text-bloomberg-green" : item.sentiment === "negative" ? "text-bloomberg-red" : "text-bloomberg-amber"
  const impactDot = item.impact === "high" ? "bg-red-500" : item.impact === "medium" ? "bg-amber-500" : "bg-green-500"

  return (
    <div
      ref={rowRef}
      className={`p-3 flex items-start gap-3 border-l-2 ${CATEGORY_COLORS[item.category] || "border-gray-500"} hover:bg-bloomberg-card/80 transition-colors relative cursor-default`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TooltipPortal show={show} tooltipPos={tooltipPos} loading={loading} tooltip={tooltip} item={item} />
      <div className="flex-1 min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-foreground hover:text-bloomberg-green transition-colors block"
        >
          {item.title}
        </a>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
          <span className="text-muted-foreground bg-bloomberg-card px-1.5 py-0.5 rounded border border-bloomberg-border">
            {item.source}
          </span>
          <span className="text-muted-foreground">{timeAgo(item.date)}</span>
          <span className={`px-1.5 py-0.5 rounded ${CATEGORY_BG[item.category] || "bg-gray-500/20 text-gray-400"}`}>
            {item.category}
          </span>
          <span className="text-muted-foreground">{REGION_LABELS[item.region] || item.region}</span>
          <span className={sentimentColor}>{sentimentIcon}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${impactDot}`} title={`${item.impact} impact`} />
          <span className="text-muted-foreground opacity-60">{item.sourceType.toUpperCase()}</span>
        </div>
      </div>
    </div>
  )
}
