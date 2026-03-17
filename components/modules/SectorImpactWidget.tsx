"use client"

import { useState, useMemo, useCallback } from "react"
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Zap, ExternalLink, Shield, Star, Brain, Loader2, Link2, ArrowRight } from "lucide-react"
import { analyzeNewsImpacts, GICS_SECTORS, type WorldNewsItemInput, type ImpactAnalysis, type GICSSector } from "@/lib/sectorImpact"

// ── Props ─────────────────────────────────────────────────────

interface SectorImpactWidgetProps {
  newsItems: WorldNewsItemInput[]
}

// ── AI Deep Research types ────────────────────────────────────

interface AITicker {
  symbol: string
  name: string
  index: "S&P500" | "NASDAQ" | "BOTH"
  why: string
  relevance?: "direct" | "indirect" | "hedge"
}

interface AITheme {
  themeName: string
  isAIRadar?: boolean
  primarySector: GICSSector
  affectedSectors: GICSSector[]
  impact: "bullish" | "bearish" | "mixed"
  deepAnalysis: string
  chainOfEffects: string[]
  topBullish: AITicker[]
  topBearish: AITicker[]
}

interface AIDeepAnalysis {
  themes: AITheme[]
  newsAnalyzed: number
  model: string
  mode: string
  timestamp: string
}

// Legacy format (backwards compat)
interface AISectorLegacy {
  sector: GICSSector
  impact: "bullish" | "bearish" | "mixed"
  eventName: string
  reason: string
  topBullish: AITicker[]
  topBearish: AITicker[]
}

interface AILegacyAnalysis {
  sectors: AISectorLegacy[]
  newsAnalyzed: number
  model: string
  mode: "legacy"
  timestamp: string
}

type AIResponse = AIDeepAnalysis | AILegacyAnalysis

function isDeepAnalysis(r: AIResponse): r is AIDeepAnalysis {
  return "themes" in r && Array.isArray(r.themes)
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
  "Information Technology": "Technologia",
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

const RELEVANCE_LABEL: Record<string, { label: string; color: string }> = {
  direct: { label: "BEZPOŚREDNI", color: "text-bloomberg-green" },
  indirect: { label: "POŚREDNI", color: "text-bloomberg-amber" },
  hedge: { label: "HEDGE", color: "text-bloomberg-blue" },
}

// ── Ticker Row with deep info ────────────────────────────────

function DeepTickerRow({ t, rank, color }: { t: AITicker; rank: number; color: "green" | "red" }) {
  const [open, setOpen] = useState(false)
  const c = color === "green" ? "text-bloomberg-green" : "text-bloomberg-red"
  const rel = t.relevance ? RELEVANCE_LABEL[t.relevance] : null

  return (
    <div className="mb-2 last:mb-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-start gap-2 text-left group">
        <span className={`text-[10px] font-bold ${c} w-4 shrink-0 pt-0.5`}>{rank}.</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] font-bold ${c}`}>{t.symbol}</span>
            <span className="text-[9px] text-muted-foreground">{t.name}</span>
            <span className="text-[7px] text-muted-foreground shrink-0 border border-bloomberg-border/50 px-1 rounded">{t.index}</span>
            {rel && <span className={`text-[7px] font-bold ${rel.color} border border-current/30 px-1 rounded`}>{rel.label}</span>}
          </div>
          <div className="text-[9px] text-muted-foreground leading-snug mt-0.5">{t.why}</div>
        </div>
        <ChevronDown className={`w-3 h-3 text-muted-foreground shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-6 mt-1.5 pl-2 border-l border-bloomberg-border/50">
          <div className="flex gap-1.5">
            <a href={`https://finance.yahoo.com/quote/${t.symbol}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded hover:bg-bloomberg-green/30 transition-colors">
              Yahoo Finance <ExternalLink className="w-2 h-2" />
            </a>
            <a href={`https://www.google.com/finance/quote/${t.symbol}:NASDAQ`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-bloomberg-blue/20 text-bloomberg-blue border border-bloomberg-blue/30 rounded hover:bg-bloomberg-blue/30 transition-colors">
              Google Finance <ExternalLink className="w-2 h-2" />
            </a>
            <a href={`https://stockanalysis.com/stocks/${t.symbol.toLowerCase()}/`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 bg-bloomberg-amber/20 text-bloomberg-amber border border-bloomberg-amber/30 rounded hover:bg-bloomberg-amber/30 transition-colors">
              StockAnalysis <ExternalLink className="w-2 h-2" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chain of Effects visualization ────────────────────────────

function ChainOfEffects({ chain }: { chain: string[] }) {
  return (
    <div className="space-y-1">
      {chain.map((step, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <div className="flex flex-col items-center shrink-0 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${
              i === 0 ? "bg-bloomberg-amber" : i === chain.length - 1 ? "bg-bloomberg-green" : "bg-bloomberg-border"
            }`} />
            {i < chain.length - 1 && <div className="w-px h-3 bg-bloomberg-border/50" />}
          </div>
          <div className="text-[9px] text-muted-foreground leading-snug flex-1">{step}</div>
        </div>
      ))}
    </div>
  )
}

// ── Theme Card (Deep Research) ────────────────────────────────

function ThemeCard({ theme, isExpanded, onToggle }: { theme: AITheme; isExpanded: boolean; onToggle: () => void }) {
  const isBullish = theme.impact === "bullish"
  const isBearish = theme.impact === "bearish"
  const impactColor = isBullish ? "text-bloomberg-green" : isBearish ? "text-bloomberg-red" : "text-bloomberg-amber"
  const impactBg = isBullish ? "bg-bloomberg-green/5" : isBearish ? "bg-bloomberg-red/5" : "bg-bloomberg-amber/5"
  const impactLabel = isBullish ? "BULLISH" : isBearish ? "BEARISH" : "MIXED"
  const impactArrow = isBullish ? "↑" : isBearish ? "↓" : "↕"

  return (
    <div className="border-b border-bloomberg-border/50 last:border-b-0">
      <button
        onClick={onToggle}
        className={`w-full px-3 py-2.5 flex items-start gap-2 text-left transition-colors hover:bg-bloomberg-card/80 ${isExpanded ? impactBg : ""}`}
      >
        <span className="text-sm mt-0.5">{SECTOR_ICON[theme.primarySector] ?? "📊"}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-foreground leading-tight">{theme.themeName}</div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {theme.affectedSectors.slice(0, 3).map(s => (
              <span key={s} className="text-[7px] text-muted-foreground border border-bloomberg-border/40 px-1 py-px rounded">
                {SECTOR_PL[s] ?? s}
              </span>
            ))}
            {theme.affectedSectors.length > 3 && (
              <span className="text-[7px] text-muted-foreground">+{theme.affectedSectors.length - 3}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[8px] font-bold ${impactColor} border border-current/30 px-1 py-px rounded`}>
            {impactArrow} {impactLabel}
          </span>
          {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {isExpanded && (
        <div className={`px-3 pb-3 ${impactBg}`}>
          {/* Deep Analysis */}
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Brain className="w-3 h-3 text-purple-400" />
              <span className="text-[9px] text-purple-400 font-bold">DEEP ANALYSIS</span>
            </div>
            <div className="text-[10px] text-foreground/80 leading-relaxed">{theme.deepAnalysis}</div>
          </div>

          {/* Chain of Effects */}
          {theme.chainOfEffects?.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1 mb-1.5">
                <Link2 className="w-3 h-3 text-bloomberg-amber" />
                <span className="text-[9px] text-bloomberg-amber font-bold">ŁAŃCUCH PRZYCZYNOWO-SKUTKOWY</span>
              </div>
              <ChainOfEffects chain={theme.chainOfEffects} />
            </div>
          )}

          {/* Affected Sectors */}
          <div className="mb-3">
            <div className="text-[9px] text-muted-foreground font-bold mb-1">DOTKNIĘTE SEKTORY GICS:</div>
            <div className="flex flex-wrap gap-1">
              {theme.affectedSectors.map(s => (
                <span key={s} className="text-[8px] px-1.5 py-0.5 bg-bloomberg-border/20 text-muted-foreground rounded border border-bloomberg-border/30">
                  {SECTOR_ICON[s]} {SECTOR_PL[s]}
                </span>
              ))}
            </div>
          </div>

          {/* TOP Bullish */}
          {theme.topBullish?.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Star className="w-3 h-3 text-bloomberg-green" />
                <span className="text-[9px] text-bloomberg-green font-bold">BENEFICJENCI ({theme.topBullish.length})</span>
              </div>
              {theme.topBullish.map((t, i) => (
                <DeepTickerRow key={t.symbol} t={t} rank={i + 1} color="green" />
              ))}
            </div>
          )}

          {/* TOP Bearish */}
          {theme.topBearish?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3 h-3 text-bloomberg-red" />
                <span className="text-[9px] text-bloomberg-red font-bold">ZAGROŻONE ({theme.topBearish.length})</span>
              </div>
              {theme.topBearish.map((t, i) => (
                <DeepTickerRow key={t.symbol} t={t} rank={i + 1} color="red" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── AI Radar Card (special prominent section) ────────────────

function AIRadarCard({ theme, isExpanded, onToggle }: { theme: AITheme; isExpanded: boolean; onToggle: () => void }) {
  // Strip emoji prefix from name for cleaner display
  const radarTitle = theme.themeName.replace(/^🤖\s*AI RADAR:\s*/i, "").trim()

  return (
    <div className="border-b-2 border-purple-500/30">
      {/* AI Radar Header */}
      <button
        onClick={onToggle}
        className={`w-full px-3 py-3 text-left transition-colors ${
          isExpanded ? "bg-purple-500/10" : "bg-purple-500/5 hover:bg-purple-500/8"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🤖</span>
            <span className="text-[11px] text-purple-400 font-bold tracking-wider">AI & TECH RADAR</span>
          </div>
          <div className="flex-1" />
          <span className={`text-[8px] font-bold border px-1.5 py-0.5 rounded ${
            theme.impact === "bullish"
              ? "text-bloomberg-green border-bloomberg-green/30"
              : theme.impact === "bearish"
                ? "text-bloomberg-red border-bloomberg-red/30"
                : "text-bloomberg-amber border-bloomberg-amber/30"
          }`}>
            {theme.impact === "bullish" ? "↑ BULLISH" : theme.impact === "bearish" ? "↓ BEARISH" : "↕ MIXED"}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-purple-400" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-400" />}
        </div>
        <div className="text-[10px] text-foreground font-medium leading-snug">{radarTitle}</div>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {theme.affectedSectors.slice(0, 4).map(s => (
            <span key={s} className="text-[7px] text-purple-300/70 border border-purple-500/20 px-1 py-px rounded bg-purple-500/5">
              {SECTOR_ICON[s]} {SECTOR_PL[s]}
            </span>
          ))}
          {theme.affectedSectors.length > 4 && (
            <span className="text-[7px] text-purple-300/50">+{theme.affectedSectors.length - 4}</span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 bg-purple-500/5">
          {/* Deep Analysis */}
          <div className="mb-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Brain className="w-3 h-3 text-purple-400" />
              <span className="text-[9px] text-purple-400 font-bold">DEEP ANALYSIS — TRENDY AI</span>
            </div>
            <div className="text-[10px] text-foreground/80 leading-relaxed">{theme.deepAnalysis}</div>
          </div>

          {/* Chain of Effects */}
          {theme.chainOfEffects?.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1 mb-1.5">
                <Link2 className="w-3 h-3 text-purple-400" />
                <span className="text-[9px] text-purple-400 font-bold">ŁAŃCUCH EFEKTÓW</span>
              </div>
              <div className="space-y-1">
                {theme.chainOfEffects.map((step, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <div className="flex flex-col items-center shrink-0 mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${
                        i === 0 ? "bg-purple-400" : i === theme.chainOfEffects.length - 1 ? "bg-bloomberg-green" : "bg-purple-400/40"
                      }`} />
                      {i < theme.chainOfEffects.length - 1 && <div className="w-px h-3 bg-purple-400/30" />}
                    </div>
                    <div className="text-[9px] text-muted-foreground leading-snug flex-1">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected Sectors */}
          <div className="mb-3">
            <div className="text-[9px] text-muted-foreground font-bold mb-1">DOTKNIĘTE SEKTORY:</div>
            <div className="flex flex-wrap gap-1">
              {theme.affectedSectors.map(s => (
                <span key={s} className="text-[8px] px-1.5 py-0.5 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20">
                  {SECTOR_ICON[s]} {SECTOR_PL[s]}
                </span>
              ))}
            </div>
          </div>

          {/* TOP Bullish */}
          {theme.topBullish?.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Star className="w-3 h-3 text-bloomberg-green" />
                <span className="text-[9px] text-bloomberg-green font-bold">BENEFICJENCI AI ({theme.topBullish.length})</span>
              </div>
              {theme.topBullish.map((t, i) => (
                <DeepTickerRow key={t.symbol} t={t} rank={i + 1} color="green" />
              ))}
            </div>
          )}

          {/* TOP Bearish */}
          {theme.topBearish?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3 h-3 text-bloomberg-red" />
                <span className="text-[9px] text-bloomberg-red font-bold">ZAGROŻONE ({theme.topBearish.length})</span>
              </div>
              {theme.topBearish.map((t, i) => (
                <DeepTickerRow key={t.symbol} t={t} rank={i + 1} color="red" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export default function SectorImpactWidget({ newsItems }: SectorImpactWidgetProps) {
  const [expandedTheme, setExpandedTheme] = useState<number | null>(null)
  const [aiRadarExpanded, setAiRadarExpanded] = useState(false)

  // AI state
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Static fallback analysis
  const staticAnalysis: ImpactAnalysis = useMemo(() => {
    if (newsItems.length === 0) return { bullish: [], bearish: [], mixed: [], totalNewsAnalyzed: 0, eventsDetected: 0 }
    return analyzeNewsImpacts(newsItems)
  }, [newsItems])

  const isAI = aiResponse != null
  const isDeep = aiResponse != null && isDeepAnalysis(aiResponse)

  // Theme list for deep mode
  const themes: AITheme[] = useMemo(() => {
    if (!aiResponse) return []
    if (isDeepAnalysis(aiResponse)) return aiResponse.themes
    // Convert legacy to theme-like
    return aiResponse.sectors.map(s => ({
      themeName: s.eventName,
      primarySector: s.sector,
      affectedSectors: [s.sector],
      impact: s.impact,
      deepAnalysis: s.reason,
      chainOfEffects: [],
      topBullish: s.topBullish,
      topBearish: s.topBearish,
    }))
  }, [aiResponse])

  // Separate AI Radar from other themes
  const aiRadarTheme = useMemo(() => themes.find(t => t.isAIRadar || t.themeName.includes("AI RADAR")), [themes])
  const otherThemes = useMemo(() => themes.filter(t => !t.isAIRadar && !t.themeName.includes("AI RADAR")), [themes])

  // Stats (exclude AI Radar from counts)
  const bullishThemes = otherThemes.filter(t => t.impact === "bullish" || t.impact === "mixed").length
  const bearishThemes = otherThemes.filter(t => t.impact === "bearish" || t.impact === "mixed").length
  const allAffectedSectors = useMemo(() => {
    const set = new Set<string>()
    themes.forEach(t => t.affectedSectors.forEach(s => set.add(s)))
    return set
  }, [themes])

  // Grok deep research handler
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
      setAiResponse(data)
      setExpandedTheme(null)
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "Błąd analizy Grok")
    } finally {
      setAiLoading(false)
    }
  }, [newsItems])

  if (newsItems.length === 0) return null

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded flex flex-col h-full">
      {/* HEADER */}
      <div className="px-3 py-2 border-b border-bloomberg-border">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-3 h-3 text-bloomberg-amber" />
          <span className="text-[10px] text-bloomberg-amber font-bold tracking-wider">WPŁYW NA RYNEK US</span>
          <span className="text-[9px] text-muted-foreground ml-auto">S&P 500 + NASDAQ</span>
        </div>
        {isAI ? (
          <div className="flex items-center gap-1.5">
            <Brain className="w-3 h-3 text-purple-400" />
            <span className="text-[8px] text-purple-400 font-bold">
              {isDeep ? "DEEP RESEARCH" : "ANALIZA AI"} • {aiResponse!.model}
            </span>
            <span className="text-[8px] text-muted-foreground">
              • {aiResponse!.newsAnalyzed} newsów → {themes.length} tematów → {allAffectedSectors.size} sektorów
            </span>
          </div>
        ) : (
          <div className="text-[9px] text-muted-foreground">
            {newsItems.length} newsów | Kliknij przycisk poniżej aby uruchomić głęboką analizę AI
          </div>
        )}
      </div>

      {/* GROK BUTTON */}
      <div className="px-3 py-2 border-b border-bloomberg-border">
        <button
          onClick={handleGrokAnalysis}
          disabled={aiLoading}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded text-[10px] font-bold tracking-wider transition-all ${
            aiLoading
              ? "bg-purple-500/10 text-purple-400 border border-purple-500/30 cursor-wait"
              : isAI
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30"
                : "bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 hover:text-purple-400 hover:border-purple-500/50"
          }`}
        >
          {aiLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>GROK DEEP RESEARCH...</span>
              <span className="text-[8px] font-normal opacity-60">(może potrwać ~30s)</span>
            </>
          ) : isAI ? (
            <><Brain className="w-3.5 h-3.5" /> PONOWNA ANALIZA GROK</>
          ) : (
            <><Brain className="w-3.5 h-3.5" /> 🔬 DEEP RESEARCH — ANALIZUJ PRZEZ GROK</>
          )}
        </button>
        {aiError && <div className="text-[9px] text-bloomberg-red mt-1 text-center">{aiError}</div>}
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto">
        {isAI && themes.length > 0 ? (
          /* ═══ DEEP RESEARCH THEMES ═══ */
          <>
            {/* Summary bar */}
            <div className="px-3 py-1.5 border-b border-bloomberg-border/50 bg-purple-500/5 flex items-center gap-3">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-bloomberg-green" />
                <span className="text-[9px] text-bloomberg-green font-bold">{bullishThemes} bullish</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-bloomberg-red" />
                <span className="text-[9px] text-bloomberg-red font-bold">{bearishThemes} bearish</span>
              </div>
              <span className="text-[8px] text-muted-foreground ml-auto">
                {new Date(aiResponse!.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* ═══ AI RADAR — always first ═══ */}
            {aiRadarTheme && (
              <AIRadarCard
                theme={aiRadarTheme}
                isExpanded={aiRadarExpanded}
                onToggle={() => setAiRadarExpanded(!aiRadarExpanded)}
              />
            )}

            {/* ═══ Other themes ═══ */}
            <div>
              {otherThemes.map((theme, idx) => (
                <ThemeCard
                  key={idx}
                  theme={theme}
                  isExpanded={expandedTheme === idx}
                  onToggle={() => setExpandedTheme(expandedTheme === idx ? null : idx)}
                />
              ))}
            </div>
          </>
        ) : !isAI ? (
          /* ═══ BEFORE AI — SECTOR OVERVIEW ═══ */
          <div className="px-3 py-3">
            <div className="text-[9px] text-muted-foreground mb-2 font-bold">SEKTORY GICS — PRZEGLĄD</div>
            <div className="grid grid-cols-2 gap-1">
              {GICS_SECTORS.map(s => {
                const hasBull = staticAnalysis.bullish.some(x => x.sector === s)
                const hasBear = staticAnalysis.bearish.some(x => x.sector === s)
                const hasMix = staticAnalysis.mixed.some(x => x.sector === s)
                const hasImpact = hasBull || hasBear || hasMix

                let indicator = "—"
                let indicatorColor = "text-muted-foreground/40"
                if (hasBull && hasBear) { indicator = "↕"; indicatorColor = "text-bloomberg-amber" }
                else if (hasBull) { indicator = "↑"; indicatorColor = "text-bloomberg-green" }
                else if (hasBear) { indicator = "↓"; indicatorColor = "text-bloomberg-red" }
                else if (hasMix) { indicator = "↕"; indicatorColor = "text-bloomberg-amber" }

                return (
                  <div
                    key={s}
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded border ${
                      hasImpact
                        ? "border-bloomberg-border/40 bg-bloomberg-card"
                        : "border-bloomberg-border/20 bg-bloomberg-bg/30 opacity-50"
                    }`}
                  >
                    <span className="text-[10px]">{SECTOR_ICON[s]}</span>
                    <span className="text-[8px] text-muted-foreground flex-1 truncate">{SECTOR_PL[s]}</span>
                    <span className={`text-[10px] font-bold ${indicatorColor}`}>{indicator}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-center">
              <div className="text-[9px] text-muted-foreground leading-relaxed">
                Powyżej: wstępna analiza statyczna.<br />
                Kliknij <span className="text-purple-400 font-bold">DEEP RESEARCH</span> aby Grok przeprowadził głęboką analizę z łańcuchem przyczynowo-skutkowym i wskazał konkretne spółki.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-muted-foreground text-[10px]">
            Brak tematów do wyświetlenia.
          </div>
        )}
      </div>

      {/* AFFECTED SECTORS STRIP (AI mode) */}
      {isAI && allAffectedSectors.size > 0 && (
        <div className="border-t border-bloomberg-border px-3 py-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[8px] text-muted-foreground font-bold shrink-0">SEKTORY:</span>
            {GICS_SECTORS.map(s => {
              const affected = allAffectedSectors.has(s)
              return (
                <span
                  key={s}
                  className={`text-[8px] px-1 py-px rounded ${
                    affected
                      ? "bg-bloomberg-amber/15 text-bloomberg-amber border border-bloomberg-amber/30"
                      : "text-muted-foreground/30"
                  }`}
                >
                  {SECTOR_ICON[s]}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
