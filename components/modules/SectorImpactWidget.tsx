"use client"

import { useState, useMemo } from "react"
import { TrendingUp, TrendingDown, ArrowRight, ChevronDown, ChevronUp, Zap, Shield, AlertTriangle, BarChart3, Target } from "lucide-react"
import { analyzeNewsImpacts, type WorldNewsItemInput, type SectorSummary, type ImpactAnalysis, type CompanyTicker } from "@/lib/sectorImpact"

// ── Types ─────────────────────────────────────────────────────

interface SectorImpactWidgetProps {
  newsItems: WorldNewsItemInput[]
}

// ── Helpers ───────────────────────────────────────────────────

const IMPACT_COLORS = {
  bullish: { bg: "bg-bloomberg-green/10", border: "border-bloomberg-green/30", text: "text-bloomberg-green", icon: TrendingUp },
  bearish: { bg: "bg-bloomberg-red/10", border: "border-bloomberg-red/30", text: "text-bloomberg-red", icon: TrendingDown },
  mixed: { bg: "bg-bloomberg-amber/10", border: "border-bloomberg-amber/30", text: "text-bloomberg-amber", icon: BarChart3 },
}

const CONF_BADGE = {
  high: { bg: "bg-red-500/20 text-red-400", label: "HIGH" },
  medium: { bg: "bg-amber-500/20 text-amber-400", label: "MED" },
  low: { bg: "bg-gray-500/20 text-gray-400", label: "LOW" },
}

// ── Main Component ────────────────────────────────────────────

export default function SectorImpactWidget({ newsItems }: SectorImpactWidgetProps) {
  const [activeTab, setActiveTab] = useState<"bullish" | "bearish" | "mixed">("bearish")
  const [expandedSector, setExpandedSector] = useState<string | null>(null)
  const [selectedTicker, setSelectedTicker] = useState<CompanyTicker | null>(null)

  // Run analysis
  const analysis: ImpactAnalysis = useMemo(() => {
    if (newsItems.length === 0) return { positive: [], negative: [], mixed: [], totalNewsAnalyzed: 0, eventsDetected: 0 }
    return analyzeNewsImpacts(newsItems)
  }, [newsItems])

  const sectors = activeTab === "bullish" ? analysis.positive : activeTab === "bearish" ? analysis.negative : analysis.mixed
  const totalEvents = analysis.eventsDetected
  const totalSectors = analysis.positive.length + analysis.negative.length + analysis.mixed.length

  if (newsItems.length === 0) return null

  return (
    <div className="bg-bloomberg-card border border-bloomberg-border rounded">
      {/* ═══ HEADER ═══ */}
      <div className="p-4 border-b border-bloomberg-border">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-bloomberg-amber" />
          <h3 className="text-xs text-bloomberg-amber font-bold tracking-wider">GEOPOLITICAL SECTOR IMPACT</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Analiza wpływu wydarzeń globalnych na sektory gospodarki. Wykryte wydarzenia: <span className="text-bloomberg-green font-bold">{totalEvents}</span> | Dotknięte sektory: <span className="text-bloomberg-green font-bold">{totalSectors}</span> | Analizowane artykuły: {analysis.totalNewsAnalyzed}
        </p>
      </div>

      {/* ═══ TAB BUTTONS ═══ */}
      <div className="flex border-b border-bloomberg-border">
        <button
          onClick={() => { setActiveTab("bearish"); setExpandedSector(null); setSelectedTicker(null) }}
          className={`flex-1 px-4 py-3 text-xs font-bold tracking-wider transition-colors flex items-center justify-center gap-2 ${
            activeTab === "bearish"
              ? "bg-bloomberg-red/15 text-bloomberg-red border-b-2 border-bloomberg-red"
              : "text-muted-foreground hover:text-bloomberg-red/70"
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          NEGATYWNE ({analysis.negative.length})
        </button>
        <button
          onClick={() => { setActiveTab("bullish"); setExpandedSector(null); setSelectedTicker(null) }}
          className={`flex-1 px-4 py-3 text-xs font-bold tracking-wider transition-colors flex items-center justify-center gap-2 ${
            activeTab === "bullish"
              ? "bg-bloomberg-green/15 text-bloomberg-green border-b-2 border-bloomberg-green"
              : "text-muted-foreground hover:text-bloomberg-green/70"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          POZYTYWNE ({analysis.positive.length})
        </button>
        <button
          onClick={() => { setActiveTab("mixed"); setExpandedSector(null); setSelectedTicker(null) }}
          className={`flex-1 px-4 py-3 text-xs font-bold tracking-wider transition-colors flex items-center justify-center gap-2 ${
            activeTab === "mixed"
              ? "bg-bloomberg-amber/15 text-bloomberg-amber border-b-2 border-bloomberg-amber"
              : "text-muted-foreground hover:text-bloomberg-amber/70"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          MIESZANE ({analysis.mixed.length})
        </button>
      </div>

      {/* ═══ SECTOR LIST ═══ */}
      <div className="max-h-[600px] overflow-y-auto">
        {sectors.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {activeTab === "bullish" ? "Brak sektorów z pozytywnym wpływem w bieżących newsach." :
             activeTab === "bearish" ? "Brak sektorów z negatywnym wpływem w bieżących newsach." :
             "Brak sektorów z mieszanym wpływem."}
          </div>
        ) : (
          <div className="divide-y divide-bloomberg-border">
            {sectors.map((sector) => {
              const sectorKey = sector.subsector ? `${sector.sector}|${sector.subsector}` : sector.sector
              const isExpanded = expandedSector === sectorKey
              const colors = IMPACT_COLORS[sector.impact]
              const conf = CONF_BADGE[sector.confidence]
              const Icon = colors.icon

              return (
                <div key={sectorKey}>
                  {/* Sector row */}
                  <button
                    onClick={() => { setExpandedSector(isExpanded ? null : sectorKey); setSelectedTicker(null) }}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-bloomberg-card/80 ${isExpanded ? colors.bg : ""}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${colors.text}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{sector.sector}</span>
                        {sector.subsector && (
                          <>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{sector.subsector}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {sector.reasons[0]}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${conf.bg}`}>{conf.label}</span>
                      <span className="text-xs text-muted-foreground">{sector.newsCount} news</span>
                      <span className={`text-xs font-bold ${colors.text}`}>
                        {sector.tickers.length} spółek
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className={`px-4 pb-4 ${colors.bg}`}>
                      {/* Reasons */}
                      <div className="mb-3">
                        <div className="text-[10px] text-bloomberg-amber font-bold tracking-wider mb-1.5">DLACZEGO?</div>
                        {sector.reasons.map((reason, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground mb-1">
                            <span className="text-bloomberg-amber mt-0.5">▸</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>

                      {/* News items driving this */}
                      <div className="mb-3">
                        <div className="text-[10px] text-bloomberg-amber font-bold tracking-wider mb-1.5">POWIĄZANE NEWSY</div>
                        {sector.newsItems.map((ni) => (
                          <div key={ni.id} className="flex items-center gap-2 text-xs mb-1">
                            <span className={ni.sentiment === "positive" ? "text-bloomberg-green" : ni.sentiment === "negative" ? "text-bloomberg-red" : "text-bloomberg-amber"}>
                              {ni.sentiment === "positive" ? "▲" : ni.sentiment === "negative" ? "▼" : "●"}
                            </span>
                            <span className="text-foreground truncate">{ni.title}</span>
                          </div>
                        ))}
                      </div>

                      {/* Company tickers */}
                      <div>
                        <div className="text-[10px] text-bloomberg-amber font-bold tracking-wider mb-1.5">
                          <Target className="w-3 h-3 inline mr-1" />
                          SPÓŁKI DO ZBADANIA ({sector.tickers.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sector.tickers.map((ticker) => {
                            const isSelected = selectedTicker?.symbol === ticker.symbol
                            return (
                              <button
                                key={ticker.symbol}
                                onClick={() => setSelectedTicker(isSelected ? null : ticker)}
                                className={`text-left rounded border p-2 transition-colors ${
                                  isSelected
                                    ? `${colors.border} ${colors.bg}`
                                    : "border-bloomberg-border hover:border-bloomberg-green/40"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-bloomberg-green">{ticker.symbol}</span>
                                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${colors.text} ${colors.bg}`}>
                                    {sector.impact === "bullish" ? "↑ BULLISH" : sector.impact === "bearish" ? "↓ BEARISH" : "↕ MIXED"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{ticker.name}</div>
                                {isSelected && (
                                  <div className="mt-2 pt-2 border-t border-bloomberg-border">
                                    <div className="text-[10px] text-bloomberg-amber font-bold mb-1">INVESTMENT THESIS:</div>
                                    <div className="text-xs text-foreground">{ticker.why}</div>
                                    <div className="mt-2 flex gap-2">
                                      <a
                                        href={`https://finance.yahoo.com/quote/${ticker.symbol}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] px-2 py-1 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded hover:bg-bloomberg-green/30 transition-colors"
                                      >
                                        Yahoo Finance →
                                      </a>
                                      <a
                                        href={`https://www.google.com/finance/quote/${ticker.symbol}:${ticker.symbol.includes(".") ? "" : "NYSE"}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] px-2 py-1 bg-bloomberg-blue/20 text-bloomberg-blue border border-bloomberg-blue/30 rounded hover:bg-bloomberg-blue/30 transition-colors"
                                      >
                                        Google Finance →
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </button>
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

      {/* ═══ FOOTER LEGEND ═══ */}
      <div className="px-4 py-2 border-t border-bloomberg-border">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-bloomberg-green" /> BULLISH = sektor zyskuje</span>
          <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-bloomberg-red" /> BEARISH = sektor traci</span>
          <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3 text-bloomberg-amber" /> MIXED = zależne od spółki</span>
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Confidence: pewność analizy</span>
        </div>
      </div>
    </div>
  )
}
