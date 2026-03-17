"use client"

import { useState, useMemo } from "react"
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Zap, Target, ExternalLink, Shield, Star, X } from "lucide-react"
import { analyzeNewsImpacts, GICS_SECTORS, type WorldNewsItemInput, type SectorSummary, type ImpactAnalysis, type GICSSector, type ScoredTicker } from "@/lib/sectorImpact"

// ── Props ─────────────────────────────────────────────────────

interface SectorImpactWidgetProps {
  newsItems: WorldNewsItemInput[]
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

// ── Scored Ticker Row ─────────────────────────────────────────

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
            {open ? <ChevronUp className="w-2.5 h-2.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground shrink-0" />}
          </div>
          <div className="text-[9px] text-muted-foreground leading-snug mt-0.5 truncate">
            {t.why[0]}
          </div>
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

  const analysis: ImpactAnalysis = useMemo(() => {
    if (newsItems.length === 0) return { bullish: [], bearish: [], mixed: [], totalNewsAnalyzed: 0, eventsDetected: 0 }
    return analyzeNewsImpacts(newsItems)
  }, [newsItems])

  const sectors = activeTab === "bullish"
    ? [...analysis.bullish, ...analysis.mixed]
    : [...analysis.bearish, ...analysis.mixed]

  const totalSectors = new Set([
    ...analysis.bullish.map(s => s.sector),
    ...analysis.bearish.map(s => s.sector),
    ...analysis.mixed.map(s => s.sector),
  ]).size

  // Find sector summary for selected GICS sector
  const selectedSectorData: SectorSummary | null = useMemo(() => {
    if (!selectedGICSSector) return null
    return [...analysis.bullish, ...analysis.bearish, ...analysis.mixed].find(s => s.sector === selectedGICSSector) ?? null
  }, [selectedGICSSector, analysis])

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
          {analysis.eventsDetected} wydarzeń | {totalSectors} sektorów | S&P 500 + NASDAQ
        </div>
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
          NEGATYWNE ({analysis.bearish.length + analysis.mixed.length})
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
          POZYTYWNE ({analysis.bullish.length + analysis.mixed.length})
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

                      <div>
                        <div className="text-[9px] text-bloomberg-amber font-bold mb-1 flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          SPÓŁKI ({sector.tickers.length})
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
            })}
          </div>
        )}
      </div>

      {/* ═══ SEKTORY GICS — KLIKALNE ═══ */}
      <div className="border-t border-bloomberg-border px-3 py-2">
        <div className="text-[9px] text-bloomberg-amber font-bold mb-1.5">SEKTORY GICS — KLIKNIJ SEKTOR PO SZCZEGÓŁY</div>
        <div className="grid grid-cols-3 gap-1">
          {GICS_SECTORS.map((s) => {
            const bull = analysis.bullish.find(x => x.sector === s)
            const bear = analysis.bearish.find(x => x.sector === s)
            const mix = analysis.mixed.find(x => x.sector === s)
            const hasImpact = bull || bear || mix
            const isSelected = selectedGICSSector === s
            const label = hasImpact
              ? bull && bear ? "↕" : bull ? "↑" : bear ? "↓" : mix ? "↕" : "—"
              : "—"
            const labelColor = hasImpact
              ? bull && bear ? "text-bloomberg-amber" : bull ? "text-bloomberg-green" : bear ? "text-bloomberg-red" : mix ? "text-bloomberg-amber" : "text-muted-foreground"
              : "text-muted-foreground/50"

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

      {/* ═══ PANEL TOP 3 — WYŚWIETLA SIĘ PO KLIKNIĘCIU SEKTORA GICS ═══ */}
      {selectedGICSSector && selectedSectorData && (
        <div className="border-t-2 border-bloomberg-amber/50 px-3 py-2 bg-bloomberg-amber/5">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{SECTOR_ICON[selectedGICSSector]}</span>
            <div className="flex-1">
              <div className="text-[11px] font-bold text-bloomberg-amber">{SECTOR_PL_FULL[selectedGICSSector]}</div>
              <div className="text-[8px] text-muted-foreground">
                {selectedSectorData.newsCount} newsów | {selectedSectorData.eventNames.map(e => EVENT_PL[e] ?? e).join(", ")}
              </div>
            </div>
            <button onClick={() => setSelectedGICSSector(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* TOP 3 BENEFICJENCI */}
          {selectedSectorData.topBullish.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Star className="w-3 h-3 text-bloomberg-green" />
                <span className="text-[9px] text-bloomberg-green font-bold tracking-wider">TOP {selectedSectorData.topBullish.length} — BENEFICJENCI</span>
              </div>
              <div className="text-[8px] text-muted-foreground mb-1">Spółki z sektora, które mogą zyskać na obecnych wydarzeniach</div>
              {selectedSectorData.topBullish.map((t, i) => (
                <ScoredTickerRow key={t.symbol} t={t} rank={i + 1} color="green" />
              ))}
            </div>
          )}

          {/* TOP 3 ZAGROŻONE */}
          {selectedSectorData.topBearish.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3 h-3 text-bloomberg-red" />
                <span className="text-[9px] text-bloomberg-red font-bold tracking-wider">TOP {selectedSectorData.topBearish.length} — UWAGA</span>
              </div>
              <div className="text-[8px] text-muted-foreground mb-1">Spółki zagrożone — ostrożność jeśli masz je w portfelu</div>
              {selectedSectorData.topBearish.map((t, i) => (
                <ScoredTickerRow key={t.symbol} t={t} rank={i + 1} color="red" />
              ))}
            </div>
          )}

          {/* Jeśli brak danych */}
          {selectedSectorData.topBullish.length === 0 && selectedSectorData.topBearish.length === 0 && (
            <div className="text-[10px] text-muted-foreground text-center py-2">
              Brak wystarczających danych do rankingu spółek w tym sektorze.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
