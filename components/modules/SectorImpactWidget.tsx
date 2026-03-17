"use client"

import { useState, useMemo } from "react"
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Zap, BarChart3, Target, ExternalLink } from "lucide-react"
import { analyzeNewsImpacts, GICS_SECTORS, type WorldNewsItemInput, type SectorSummary, type ImpactAnalysis, type CompanyTicker, type GICSSector } from "@/lib/sectorImpact"

// ── Props ─────────────────────────────────────────────────────

interface SectorImpactWidgetProps {
  newsItems: WorldNewsItemInput[]
}

// ── Sector Icons (emoji) ──────────────────────────────────────

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

const SECTOR_SHORT: Record<string, string> = {
  "Information Technology": "IT / Tech",
  "Healthcare": "Healthcare",
  "Financials": "Financials",
  "Consumer Discretionary": "Cons. Disc.",
  "Consumer Staples": "Cons. Staples",
  "Energy": "Energy",
  "Industrials": "Industrials",
  "Materials": "Materials",
  "Utilities": "Utilities",
  "Real Estate": "Real Estate",
  "Communication Services": "Comm. Serv.",
}

// ── Main Component ────────────────────────────────────────────

export default function SectorImpactWidget({ newsItems }: SectorImpactWidgetProps) {
  const [activeTab, setActiveTab] = useState<"bearish" | "bullish">("bearish")
  const [expandedSector, setExpandedSector] = useState<GICSSector | null>(null)
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)

  const analysis: ImpactAnalysis = useMemo(() => {
    if (newsItems.length === 0) return { bullish: [], bearish: [], mixed: [], totalNewsAnalyzed: 0, eventsDetected: 0 }
    return analyzeNewsImpacts(newsItems)
  }, [newsItems])

  // Merge mixed into both bullish and bearish views
  const sectors = activeTab === "bullish"
    ? [...analysis.bullish, ...analysis.mixed]
    : [...analysis.bearish, ...analysis.mixed]

  const totalSectors = new Set([
    ...analysis.bullish.map(s => s.sector),
    ...analysis.bearish.map(s => s.sector),
    ...analysis.mixed.map(s => s.sector),
  ]).size

  if (newsItems.length === 0) return null

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded flex flex-col h-full">
      {/* HEADER */}
      <div className="px-3 py-2 border-b border-bloomberg-border">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="w-3 h-3 text-bloomberg-amber" />
          <span className="text-[10px] text-bloomberg-amber font-bold tracking-wider">SECTOR IMPACT</span>
          <span className="text-[9px] text-muted-foreground ml-auto">US MARKET</span>
        </div>
        <div className="text-[9px] text-muted-foreground">
          {analysis.eventsDetected} events | {totalSectors} sectors | S&P 500 + NASDAQ
        </div>
      </div>

      {/* TAB BUTTONS */}
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
          NEGATIVE ({analysis.bearish.length + analysis.mixed.length})
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
          POSITIVE ({analysis.bullish.length + analysis.mixed.length})
        </button>
      </div>

      {/* SECTOR LIST */}
      <div className="flex-1 overflow-y-auto">
        {sectors.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-[10px]">
            Brak wykrytych wydarzeń wpływających na US sektory.
          </div>
        ) : (
          <div className="divide-y divide-bloomberg-border/50">
            {sectors.map((sector) => {
              const isExpanded = expandedSector === sector.sector
              const isBullish = sector.impact === "bullish"
              const isBearish = sector.impact === "bearish"
              const color = isBullish ? "text-bloomberg-green" : isBearish ? "text-bloomberg-red" : "text-bloomberg-amber"
              const bgColor = isBullish ? "bg-bloomberg-green/5" : isBearish ? "bg-bloomberg-red/5" : "bg-bloomberg-amber/5"
              const arrow = isBullish ? "↑" : isBearish ? "↓" : "↕"
              const confDot = sector.confidence === "high" ? "bg-red-500" : sector.confidence === "medium" ? "bg-amber-500" : "bg-gray-500"

              return (
                <div key={sector.sector}>
                  {/* Sector Row */}
                  <button
                    onClick={() => { setExpandedSector(isExpanded ? null : sector.sector); setExpandedTicker(null) }}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:bg-bloomberg-card/80 ${isExpanded ? bgColor : ""}`}
                  >
                    <span className="text-sm">{SECTOR_ICON[sector.sector] ?? "📊"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-foreground leading-tight">{SECTOR_SHORT[sector.sector] ?? sector.sector}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{sector.eventNames[0]}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${confDot}`} />
                      <span className={`text-[11px] font-bold ${color}`}>{arrow}</span>
                      <span className="text-[9px] text-muted-foreground">{sector.tickers.length}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className={`px-3 pb-3 ${bgColor}`}>
                      {/* Event trigger */}
                      <div className="mb-2">
                        <div className="text-[9px] text-bloomberg-amber font-bold mb-1">TRIGGER</div>
                        {sector.eventNames.map((en, i) => (
                          <div key={i} className="text-[10px] text-muted-foreground">▸ {en}</div>
                        ))}
                      </div>

                      {/* Why */}
                      <div className="mb-2">
                        <div className="text-[9px] text-bloomberg-amber font-bold mb-1">WPŁYW NA SEKTOR</div>
                        {sector.reasons.map((r, i) => (
                          <div key={i} className="text-[10px] text-muted-foreground mb-1 leading-snug">{r}</div>
                        ))}
                      </div>

                      {/* Related news */}
                      <div className="mb-2">
                        <div className="text-[9px] text-bloomberg-amber font-bold mb-1">POWIĄZANE NEWSY ({sector.newsCount})</div>
                        {sector.newsItems.slice(0, 3).map((ni) => (
                          <div key={ni.id} className="flex items-start gap-1 text-[10px] mb-0.5">
                            <span className={ni.sentiment === "positive" ? "text-bloomberg-green" : ni.sentiment === "negative" ? "text-bloomberg-red" : "text-bloomberg-amber"}>
                              {ni.sentiment === "positive" ? "▲" : ni.sentiment === "negative" ? "▼" : "●"}
                            </span>
                            <span className="text-foreground leading-snug truncate">{ni.title}</span>
                          </div>
                        ))}
                        {sector.newsItems.length > 3 && (
                          <div className="text-[9px] text-muted-foreground">+{sector.newsItems.length - 3} więcej...</div>
                        )}
                      </div>

                      {/* Tickers */}
                      <div>
                        <div className="text-[9px] text-bloomberg-amber font-bold mb-1 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          SPÓŁKI ({sector.tickers.length})
                        </div>
                        <div className="space-y-1">
                          {sector.tickers.map((t) => {
                            const isTickerExpanded = expandedTicker === t.symbol
                            return (
                              <div key={t.symbol}>
                                <button
                                  onClick={() => setExpandedTicker(isTickerExpanded ? null : t.symbol)}
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
                                      <a
                                        href={`https://finance.yahoo.com/quote/${t.symbol}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded hover:bg-bloomberg-green/30 transition-colors"
                                      >
                                        Yahoo <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                      <a
                                        href={`https://www.google.com/finance/quote/${t.symbol}:NASDAQ`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-bloomberg-blue/20 text-bloomberg-blue border border-bloomberg-blue/30 rounded hover:bg-bloomberg-blue/30 transition-colors"
                                      >
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
            })}
          </div>
        )}
      </div>

      {/* GICS OVERVIEW GRID — all 11 sectors status */}
      <div className="border-t border-bloomberg-border px-3 py-2">
        <div className="text-[9px] text-bloomberg-amber font-bold mb-1.5">GICS SECTORS — STATUS</div>
        <div className="grid grid-cols-3 gap-1">
          {GICS_SECTORS.map((s) => {
            const bull = analysis.bullish.find(x => x.sector === s)
            const bear = analysis.bearish.find(x => x.sector === s)
            const mix = analysis.mixed.find(x => x.sector === s)
            const hasImpact = bull || bear || mix
            const label = hasImpact
              ? bull && bear ? "↕" : bull ? "↑" : bear ? "↓" : mix ? "↕" : "—"
              : "—"
            const labelColor = hasImpact
              ? bull && bear ? "text-bloomberg-amber" : bull ? "text-bloomberg-green" : bear ? "text-bloomberg-red" : mix ? "text-bloomberg-amber" : "text-muted-foreground"
              : "text-muted-foreground/50"
            const bgClass = hasImpact ? "bg-bloomberg-card" : "bg-bloomberg-bg/50 opacity-50"

            return (
              <div key={s} className={`flex items-center gap-1 px-1 py-0.5 rounded border border-bloomberg-border/30 ${bgClass}`}>
                <span className="text-[10px]">{SECTOR_ICON[s]}</span>
                <span className="text-[8px] text-muted-foreground flex-1 truncate">{SECTOR_SHORT[s]}</span>
                <span className={`text-[10px] font-bold ${labelColor}`}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
