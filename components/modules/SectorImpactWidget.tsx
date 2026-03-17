"use client"

import { useState, useMemo, useCallback } from "react"
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Zap, Target, ExternalLink, Shield, Star, X, Brain, Loader2 } from "lucide-react"
import { analyzeNewsImpacts, GICS_SECTORS, type WorldNewsItemInput, type SectorSummary, type ImpactAnalysis, type GICSSector, type ScoredTicker } from "@/lib/sectorImpact"

// ── Props ─────────────────────────────────────────────────────

interface SectorImpactWidgetProps {
  newsItems: WorldNewsItemInput[]
}

// ── AI response types ─────────────────────────────────────────

interface AITicker {
  symbol: string
  name: string
  index: "S&P500" | "NASDAQ" | "BOTH"
  why: string
}

interface AISector {
  sector: GICSSector
  impact: "bullish" | "bearish" | "mixed"
  eventName: string
  reason: string
  topBullish: AITicker[]
  topBearish: AITicker[]
}

interface AIAnalysis {
  sectors: AISector[]
  newsAnalyzed: number
  model: string
  timestamp: string
}

// ── Polish translations ───────────────────────────────────────

const SECTOR_ICON: Record<string, string> = {
  "Information Technology": "💻",
  "Healthcare": "🏥",
  "Financials": "🏦",
  "Consumer Discretionary": "🛍️",
  "Consumer Staples": "🛒",
  "Energy": "⚡",
  "Industrials": "🏭",
  "Materials": "⛏️",
  "Utilities": "💡",
  "Real Estate": "🏠",
  "Communication Services": "📡",
}

const SECTOR_PL: Record<string, string> = {
  "Information Technology": "Technologia (IT)",
  "Healthcare": "Ochrona zdrowia",
  "Financials": "Finanse",
  "Consumer Discretionary": "Dobra uznaniowe",
  "Consumer Staples": "Dobra podstawowe",
  "Energy": "Energetyka",
  "Industrials": "Przemysł",
  "Materials": "Surowce",
  "Utilities": "Użytkowe",
  "Real Estate": "Nieruchomości",
  "Communication Services": "Komunikacja",
}

const SECTOR_PL_FULL: Record<string, string> = {
  "Information Technology": "Technologia (IT)",
  "Healthcare": "Ochrona zdrowia",
  "Financials": "Finanse",
  "Consumer Discretionary": "Dobra uznaniowe (Consumer Discretionary)",
  "Consumer Staples": "Dobra podstawowe (Consumer Staples)",
  "Energy": "Energetyka",
  "Industrials": "Przemysł",
  "Materials": "Surowce (Materials)",
  "Utilities": "Użytkowe (Utilities)",
  "Real Estate": "Nieruchomości (REITs)",
  "Communication Services": "Komunikacja (Communication Services)",
}

const EVENT_PL: Record<string, string> = {
  "Middle East Conflict": "Konflikt na Bliskim Wschodzie",
  "Persian Gulf / Hormuz Disruption": "Zagrożenie Zatoki Perskiej / Hormuz",
  "China-Taiwan Tensions": "Napięcia Chiny-Tajwan",
  "Ukraine-Russia Conflict": "Konflikt Ukraina-Rosja",
  "US-China Trade War / Tariffs": "Wojna handlowa USA-Chiny / Cła",
  "Fed Rate Hike / Hawkish": "Podwyżka stóp Fed / Jastrzębia polityka",
  "Fed Rate Cut / Dovish": "Obniżka stóp Fed / Gołębia polityka",
  "Inflation Surge": "Wzrost inflacji",
  "Oil Price Spike / OPEC Cuts": "Skok cen ropy / Cięcia OPEC",
  "AI / Technology Breakthrough": "Przełom AI / Technologiczny",
  "Pandemic / Disease Outbreak": "Pandemia / Epidemia",
  "Natural Disaster": "Klęska żywiołowa",
  "Recession / Economic Downturn": "Recesja / Spowolnienie gospodarcze",
  "Supply Chain Disruption": "Zakłócenie łańcucha dostaw",
  "International Sanctions": "Sankcje międzynarodowe",
  "Climate Policy / Green Push": "Polityka klimatyczna / Zielony zwrot",
  "Peace / De-escalation": "Pokój / Deeskalacja",
}

// ── AI Ticker Row ─────────────────────────────────────────────

function AITickerRow({ t, rank, color }: { t: AITicker; rank: number; color: "green" | "red" }) {
  const [open, setOpen] = useState(false)
  const c = color === "green" ? "text-bloomberg-green" : "text-bloomberg-red"
  return (
    <div className="mb-1.5 last:mb-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-2 text-left">
        <span className={`text-[10px] font-bold ${c} w-4 shrink-0`}>{rank}.</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold ${c}`}>{t.symbol}</span>
            <span className="text-[9px] text-muted-foreground truncate">{t.name}</span>
            <span className="text-[7px] text-muted-foreground shrink-0 border border-bloomberg-border/50 px-1 rounded">{t.index}</span>
          </div>
        </div>
      </button>
      {open && (
        <div className="ml-6 mt-1 pl-2 border-l border-bloomberg-border/50">
          <div className="text-[9px] text-muted-foreground leading-snug mb-1">• {t.why}</div>
          <div className="flex gap-1.5 mt-1">
            <a href={`https://finance.yahoo.com/quote/${t.symbol}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded hover:bg-bloomberg-green/30 transition-colors">
              Yahoo <ExternalLink className="w-2 h-2" />
            </a>
            <a href={`https://www.google.com/finance/quote/${t.symbol}:NASDAQ`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-bloomberg-blue/20 text-bloomberg-blue border border-bloomberg-blue/30 rounded hover:bg-bloomberg-blue/30 transition-colors">
              Google <ExternalLink className="w-2 h-2" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scored Ticker Row (fallback static) ───────────────────────

function ScoredTickerRow({ t, rank, color }: { t: ScoredTicker; rank: number; color: "green" | "red" }) {
  const [open, setOpen] = useState(false)
  const c = color === "green" ? "text-bloomberg-green" : "text-bloomberg-red"
  return (
    <div className="mb-1.5 last:mb-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-2 text-left">
        <span className={`text-[10px] font-bold ${c} w-4 shrink-0`}>{rank}.</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold ${c}`}>{t.symbol}</span>
            <span className="text-[9px] text-muted-foreground truncate">{t.name}</span>
            <span className="text-[7px] text-muted-foreground shrink-0 border border-bloomberg-border/50 px-1 rounded">{t.index}</span>
          </div>
          <div className="text-[9px] text-muted-foreground leading-snug mt-0.5 truncate">{t.why[0]}</div>
        </div>
      </button>
      {open && (
        <div className="ml-6 mt-1 pl-2 border-l border-bloomberg-border/50">
          {t.why.slice(0, 3).map((w, i) => (
            <div key={i} className="text-[9px] text-muted-foreground leading-snug mb-0.5">• {w}</div>
          ))}
          <div className="text-[8px] text-bloomberg-amber/70 mt-1">
            {t.events.map(e => EVENT_PL[e] ?? e).join(", ")}
          </div>
          <div className="flex gap-1.5 mt-1">
            <a href={`https://finance.yahoo.com/quote/${t.symbol}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded hover:bg-bloomberg-green/30 transition-colors">
              Yahoo <ExternalLink className="w-2 h-2" />
            </a>
            <a href={`https://www.google.com/finance/quote/${t.symbol}:NASDAQ`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-bloomberg-blue/20 text-bloomberg-blue border border-bloomberg-blue/30 rounded hover:bg-bloomberg-blue/30 transition-colors">
              Google <ExternalLink className="w-2 h-2" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export default function SectorImpactWidget({ newsItems }: SectorImpactWidgetProps) {
  const [activeTab, setActiveTab] = useState<"bearish" | "bullish">("bearish")
  const [expandedSector, setExpandedSector] = useState<GICSSector | null>(null)
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)
  const [selectedGICSSector, setSelectedGICSSector] = useState<GICSSector | null>(null)

  // AI state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Static fallback analysis
  const staticAnalysis: ImpactAnalysis = useMemo(() => {
    if (newsItems.length === 0) return { bullish: [], bearish: [], mixed: [], totalNewsAnalyzed: 0, eventsDetected: 0 }
    return analyzeNewsImpacts(newsItems)
  }, [newsItems])

  // Use AI data if available, otherwise static
  const isAI = aiAnalysis != null

  // AI sectors grouped
  const aiSectorMap = useMemo(() => {
    if (!aiAnalysis) return new Map<GICSSector, AISector>()
    const map = new Map<GICSSector, AISector>()
    for (const s of aiAnalysis.sectors) map.set(s.sector, s)
    return map
  }, [aiAnalysis])

  // For sector list display
  const sectors = useMemo(() => {
    if (isAI) {
      const all = aiAnalysis!.sectors
      if (activeTab === "bullish") return all.filter(s => s.impact === "bullish" || s.impact === "mixed")
      return all.filter(s => s.impact === "bearish" || s.impact === "mixed")
    }
    return activeTab === "bullish"
      ? [...staticAnalysis.bullish, ...staticAnalysis.mixed]
      : [...staticAnalysis.bearish, ...staticAnalysis.mixed]
  }, [isAI, aiAnalysis, staticAnalysis, activeTab])

  const totalSectors = isAI
    ? aiAnalysis!.sectors.length
    : new Set([
        ...staticAnalysis.bullish.map(s => s.sector),
        ...staticAnalysis.bearish.map(s => s.sector),
        ...staticAnalysis.mixed.map(s => s.sector),
      ]).size

  const bullishCount = isAI
    ? aiAnalysis!.sectors.filter(s => s.impact === "bullish" || s.impact === "mixed").length
    : staticAnalysis.bullish.length + staticAnalysis.mixed.length

  const bearishCount = isAI
    ? aiAnalysis!.sectors.filter(s => s.impact === "bearish" || s.impact === "mixed").length
    : staticAnalysis.bearish.length + staticAnalysis.mixed.length

  // Find selected sector data (AI or static)
  const selectedAISector = selectedGICSSector ? aiSectorMap.get(selectedGICSSector) ?? null : null
  const selectedStaticSector: SectorSummary | null = useMemo(() => {
    if (!selectedGICSSector || isAI) return null
    return [...staticAnalysis.bullish, ...staticAnalysis.bearish, ...staticAnalysis.mixed].find(s => s.sector === selectedGICSSector) ?? null
  }, [selectedGICSSector, staticAnalysis, isAI])

  // Grok analysis handler
  const handleGrokAnalysis = useCallback(async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const payload = newsItems.map(n => ({
        id: n.id,
        title: n.title,
        description: n.description,
        sentiment: n.sentiment,
        category: n.category,
        impact: n.impact,
      }))
      const res = await fetch("/api/sector-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsItems: payload }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiAnalysis(data)
      setSelectedGICSSector(null)
      setExpandedSector(null)
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Błąd analizy Grok")
    } finally {
      setAiLoading(false)
    }
  }, [newsItems])

  if (newsItems.length === 0) return null

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded flex flex-col h-full">
      {/* NAGŁÓWEK */}
      <div className="px-3 py-2 border-b border-bloomberg-border">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-3 h-3 text-bloomberg-amber" />
          <span className="text-[10px] text-bloomberg-amber font-bold tracking-wider">WPŁYW NA SEKTORY</span>
          <span className="text-[9px] text-muted-foreground ml-auto">RYNEK US</span>
        </div>
        <div className="text-[9px] text-muted-foreground">
          {isAI ? `${aiAnalysis!.newsAnalyzed} newsów` : `${staticAnalysis.eventsDetected} wydarzeń`} | {totalSectors} sektorów | S&P 500 + NASDAQ
        </div>
        {isAI && (
          <div className="flex items-center gap-1 mt-1">
            <Brain className="w-3 h-3 text-purple-400" />
            <span className="text-[8px] text-purple-400 font-bold">GROK AI</span>
            <span className="text-[8px] text-muted-foreground">• {new Date(aiAnalysis!.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
      </div>

      {/* PRZYCISK GROK */}
      <div className="px-3 py-2 border-b border-bloomberg-border">
        <button
          onClick={handleGrokAnalysis}
          disabled={aiLoading}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[10px] font-bold tracking-wider transition-colors ${
            aiLoading
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/30 cursor-wait"
              : isAI
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30"
                : "bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-400"
          }`}
        >
          {aiLoading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> GROK ANALIZUJE...</>
          ) : isAI ? (
            <><Brain className="w-3.5 h-3.5" /> PONOWNA ANALIZA GROK</>
          ) : (
            <><Brain className="w-3.5 h-3.5" /> ANALIZUJ PRZEZ GROK</>
          )}
        </button>
        {aiError && <div className="text-[9px] text-bloomberg-red mt-1">{aiError}</div>}
        {!isAI && <div className="text-[8px] text-muted-foreground mt-1 text-center">Teraz: analiza statyczna. Kliknij aby uruchomić AI.</div>}
      </div>

      {/* PRZYCISKI ZAKŁADEK */}
      <div className="flex border-b border-bloomberg-border">
        <button
          onClick={() => { setActiveTab("bearish"); setExpandedSector(null); setExpandedTicker(null) }}
          className={`flex-1 px-2 py-1.5 text-[10px] font-bold tracking-wider transition-colors flex items-center justify-center gap-1 ${
            activeTab === "bearish"
              ? "bg-bloomberg-red/15 text-bloomberg-red border-b-2 border-bloomberg-red"
              : "text-muted-foreground hover:text-bloomberg-red/70"
          }`}
        >
          <TrendingDown className="w-3 h-3" />
          NEGATYWNE ({bearishCount})
        </button>
        <button
          onClick={() => { setActiveTab("bullish"); setExpandedSector(null); setExpandedTicker(null) }}
          className={`flex-1 px-2 py-1.5 text-[10px] font-bold tracking-wider transition-colors flex items-center justify-center gap-1 ${
            activeTab === "bullish"
              ? "bg-bloomberg-green/15 text-bloomberg-green border-b-2 border-bloomberg-green"
              : "text-muted-foreground hover:text-bloomberg-green/70"
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          POZYTYWNE ({bullishCount})
        </button>
      </div>

      {/* LISTA SEKTORÓW */}
      <div className="flex-1 overflow-y-auto">
        {sectors.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-[10px]">
            Brak wykrytych wydarzeń wpływających na US sektory.
          </div>
        ) : (
          <div className="divide-y divide-bloomberg-border/50">
            {isAI ? (
              /* ═══ AI MODE ═══ */
              (sectors as AISector[]).map((sector) => {
                const isExpanded = expandedSector === sector.sector
                const isBullish = sector.impact === "bullish"
                const isBearish = sector.impact === "bearish"
                const color = isBullish ? "text-bloomberg-green" : isBearish ? "text-bloomberg-red" : "text-bloomberg-amber"
                const bgColor = isBullish ? "bg-bloomberg-green/5" : isBearish ? "bg-bloomberg-red/5" : "bg-bloomberg-amber/5"
                const arrow = isBullish ? "↑" : isBearish ? "↓" : "↕"
                const tickerCount = (sector.topBullish?.length ?? 0) + (sector.topBearish?.length ?? 0)

                return (
                  <div key={sector.sector}>
                    <button
                      onClick={() => { setExpandedSector(isExpanded ? null : sector.sector); setExpandedTicker(null) }}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:bg-bloomberg-card/80 ${isExpanded ? bgColor : ""}`}
                    >
                      <span className="text-sm">{SECTOR_ICON[sector.sector] ?? "📊"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-foreground leading-tight">{SECTOR_PL[sector.sector] ?? sector.sector}</div>
                        <div className="text-[9px] text-muted-foreground truncate">{sector.eventName}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Brain className="w-3 h-3 text-purple-400" />
                        <span className={`text-[11px] font-bold ${color}`}>{arrow}</span>
                        <span className="text-[9px] text-muted-foreground">{tickerCount}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className={`px-3 pb-3 ${bgColor}`}>
                        <div className="mb-2">
                          <div className="text-[9px] text-bloomberg-amber font-bold mb-1">ANALIZA AI</div>
                          <div className="text-[10px] text-muted-foreground leading-snug">{sector.reason}</div>
                        </div>

                        {sector.topBullish?.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Star className="w-3 h-3 text-bloomberg-green" />
                              <span className="text-[9px] text-bloomberg-green font-bold">BENEFICJENCI</span>
                            </div>
                            {sector.topBullish.map((t, i) => (
                              <AITickerRow key={t.symbol} t={t} rank={i + 1} color="green" />
                            ))}
                          </div>
                        )}

                        {sector.topBearish?.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Shield className="w-3 h-3 text-bloomberg-red" />
                              <span className="text-[9px] text-bloomberg-red font-bold">ZAGROŻONE</span>
                            </div>
                            {sector.topBearish.map((t, i) => (
                              <AITickerRow key={t.symbol} t={t} rank={i + 1} color="red" />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              /* ═══ STATIC FALLBACK MODE ═══ */
              (sectors as SectorSummary[]).map((sector) => {
                const isExpanded = expandedSector === sector.sector
                const isBullish = sector.impact === "bullish"
                const isBearish = sector.impact === "bearish"
                const color = isBullish ? "text-bloomberg-green" : isBearish ? "text-bloomberg-red" : "text-bloomberg-amber"
                const bgColor = isBullish ? "bg-bloomberg-green/5" : isBearish ? "bg-bloomberg-red/5" : "bg-bloomberg-amber/5"
                const arrow = isBullish ? "↑" : isBearish ? "↓" : "↕"
                const confDot = sector.confidence === "high" ? "bg-red-500" : sector.confidence === "medium" ? "bg-amber-500" : "bg-gray-500"

                return (
                  <div key={sector.sector}>
                    <button
                      onClick={() => { setExpandedSector(isExpanded ? null : sector.sector); setExpandedTicker(null) }}
                      className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:bg-bloomberg-card/80 ${isExpanded ? bgColor : ""}`}
                    >
                      <span className="text-sm">{SECTOR_ICON[sector.sector] ?? "📊"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-foreground leading-tight">{SECTOR_PL[sector.sector] ?? sector.sector}</div>
                        <div className="text-[9px] text-muted-foreground truncate">{EVENT_PL[sector.eventNames[0]] ?? sector.eventNames[0]}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${confDot}`} />
                        <span className={`text-[11px] font-bold ${color}`}>{arrow}</span>
                        <span className="text-[9px] text-muted-foreground">{sector.tickers.length}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className={`px-3 pb-3 ${bgColor}`}>
                        <div className="mb-2">
                          <div className="text-[9px] text-bloomberg-amber font-bold mb-1">WYZWALACZ</div>
                          {sector.eventNames.map((en, i) => (
                            <div key={i} className="text-[10px] text-muted-foreground">▸ {EVENT_PL[en] ?? en}</div>
                          ))}
                        </div>
                        <div className="mb-2">
                          <div className="text-[9px] text-bloomberg-amber font-bold mb-1">WPŁYW NA SEKTOR</div>
                          {sector.reasons.map((r, i) => (
                            <div key={i} className="text-[10px] text-muted-foreground mb-1 leading-snug">{r}</div>
                          ))}
                        </div>
                        <div>
                          <div className="text-[9px] text-bloomberg-amber font-bold mb-1 flex items-center gap-1">
                            <Target className="w-3 h-3" /> SPÓŁKI ({sector.tickers.length})
                          </div>
                          <div className="space-y-1">
                            {sector.tickers.map((t) => {
                              const isTickerExpanded = expandedTicker === `${sector.sector}_${t.symbol}`
                              return (
                                <div key={t.symbol}>
                                  <button
                                    onClick={() => setExpandedTicker(isTickerExpanded ? null : `${sector.sector}_${t.symbol}`)}
                                    className={`w-full flex items-center gap-2 px-2 py-1 rounded border text-left transition-colors ${
                                      isTickerExpanded ? "border-bloomberg-green/40 bg-bloomberg-green/5" : "border-bloomberg-border/50 hover:border-bloomberg-green/30"
                                    }`}
                                  >
                                    <span className="text-[11px] font-bold text-bloomberg-green w-12">{t.symbol}</span>
                                    <span className="text-[10px] text-muted-foreground flex-1 truncate">{t.name}</span>
                                    <span className="text-[8px] text-muted-foreground shrink-0">{t.index}</span>
                                  </button>
                                  {isTickerExpanded && (
                                    <div className="ml-2 mt-1 mb-1 pl-2 border-l border-bloomberg-green/30">
                                      <div className="text-[10px] text-foreground leading-snug mb-1.5">{t.why}</div>
                                      <div className="flex gap-1.5">
                                        <a href={`https://finance.yahoo.com/quote/${t.symbol}`} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded hover:bg-bloomberg-green/30 transition-colors">
                                          Yahoo <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                        <a href={`https://www.google.com/finance/quote/${t.symbol}:NASDAQ`} target="_blank" rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-bloomberg-blue/20 text-bloomberg-blue border border-bloomberg-blue/30 rounded hover:bg-bloomberg-blue/30 transition-colors">
                                          Google <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* ═══ SEKTORY GICS — KLIKALNE ═══ */}
      <div className="border-t border-bloomberg-border px-3 py-2">
        <div className="text-[9px] text-bloomberg-amber font-bold mb-1.5">SEKTORY GICS — KLIKNIJ PO TOP 3</div>
        <div className="grid grid-cols-3 gap-1">
          {GICS_SECTORS.map((s) => {
            const hasImpact = isAI
              ? aiSectorMap.has(s)
              : !!(staticAnalysis.bullish.find(x => x.sector === s) || staticAnalysis.bearish.find(x => x.sector === s) || staticAnalysis.mixed.find(x => x.sector === s))

            const isSelected = selectedGICSSector === s

            let label = "—"
            let labelColor = "text-muted-foreground/50"
            if (hasImpact) {
              if (isAI) {
                const as2 = aiSectorMap.get(s)!
                label = as2.impact === "bullish" ? "↑" : as2.impact === "bearish" ? "↓" : "↕"
                labelColor = as2.impact === "bullish" ? "text-bloomberg-green" : as2.impact === "bearish" ? "text-bloomberg-red" : "text-bloomberg-amber"
              } else {
                const bull = staticAnalysis.bullish.find(x => x.sector === s)
                const bear = staticAnalysis.bearish.find(x => x.sector === s)
                const mix = staticAnalysis.mixed.find(x => x.sector === s)
                label = bull && bear ? "↕" : bull ? "↑" : bear ? "↓" : mix ? "↕" : "—"
                labelColor = bull && bear ? "text-bloomberg-amber" : bull ? "text-bloomberg-green" : bear ? "text-bloomberg-red" : mix ? "text-bloomberg-amber" : "text-muted-foreground"
              }
            }

            return (
              <button
                key={s}
                onClick={() => hasImpact && setSelectedGICSSector(isSelected ? null : s)}
                disabled={!hasImpact}
                className={`flex items-center gap-1 px-1 py-0.5 rounded border text-left transition-colors ${
                  isSelected
                    ? "border-bloomberg-amber bg-bloomberg-amber/10"
                    : hasImpact
                      ? "border-bloomberg-border/30 bg-bloomberg-card hover:border-bloomberg-amber/50 cursor-pointer"
                      : "border-bloomberg-border/30 bg-bloomberg-bg/50 opacity-40 cursor-default"
                }`}
              >
                <span className="text-[10px]">{SECTOR_ICON[s]}</span>
                <span className="text-[8px] text-muted-foreground flex-1 truncate">{SECTOR_PL[s]}</span>
                <span className={`text-[10px] font-bold ${labelColor}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ PANEL TOP 3 — PO KLIKNIĘCIU SEKTORA ═══ */}
      {selectedGICSSector && (isAI ? selectedAISector : selectedStaticSector) && (
        <div className="border-t-2 border-bloomberg-amber/50 px-3 py-2 bg-bloomberg-amber/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{SECTOR_ICON[selectedGICSSector]}</span>
            <div className="flex-1">
              <div className="text-[11px] font-bold text-bloomberg-amber">{SECTOR_PL_FULL[selectedGICSSector]}</div>
              {isAI && selectedAISector && (
                <div className="text-[8px] text-purple-400 flex items-center gap-1"><Brain className="w-2.5 h-2.5" /> Analiza Grok</div>
              )}
            </div>
            <button onClick={() => setSelectedGICSSector(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {isAI && selectedAISector ? (
            /* AI TOP 3 */
            <>
              <div className="text-[9px] text-muted-foreground mb-2 leading-snug">{selectedAISector.reason}</div>
              {selectedAISector.topBullish?.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Star className="w-3 h-3 text-bloomberg-green" />
                    <span className="text-[9px] text-bloomberg-green font-bold">TOP {selectedAISector.topBullish.length} — BENEFICJENCI</span>
                  </div>
                  {selectedAISector.topBullish.map((t, i) => (
                    <AITickerRow key={t.symbol} t={t} rank={i + 1} color="green" />
                  ))}
                </div>
              )}
              {selectedAISector.topBearish?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="w-3 h-3 text-bloomberg-red" />
                    <span className="text-[9px] text-bloomberg-red font-bold">TOP {selectedAISector.topBearish.length} — UWAGA</span>
                  </div>
                  {selectedAISector.topBearish.map((t, i) => (
                    <AITickerRow key={t.symbol} t={t} rank={i + 1} color="red" />
                  ))}
                </div>
              )}
            </>
          ) : selectedStaticSector ? (
            /* Static TOP 3 */
            <>
              {selectedStaticSector.topBullish.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Star className="w-3 h-3 text-bloomberg-green" />
                    <span className="text-[9px] text-bloomberg-green font-bold">TOP {selectedStaticSector.topBullish.length} — BENEFICJENCI</span>
                  </div>
                  <div className="text-[8px] text-muted-foreground mb-1">Analiza statyczna — kliknij „Analizuj przez Grok" po AI</div>
                  {selectedStaticSector.topBullish.map((t, i) => (
                    <ScoredTickerRow key={t.symbol} t={t} rank={i + 1} color="green" />
                  ))}
                </div>
              )}
              {selectedStaticSector.topBearish.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="w-3 h-3 text-bloomberg-red" />
                    <span className="text-[9px] text-bloomberg-red font-bold">TOP {selectedStaticSector.topBearish.length} — UWAGA</span>
                  </div>
                  {selectedStaticSector.topBearish.map((t, i) => (
                    <ScoredTickerRow key={t.symbol} t={t} rank={i + 1} color="red" />
                  ))}
                </div>
              )}
              {selectedStaticSector.topBullish.length === 0 && selectedStaticSector.topBearish.length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-2">Brak danych — uruchom analizę Grok.</div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
