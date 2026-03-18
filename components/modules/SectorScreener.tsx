"use client"

import { useState, useMemo, useCallback } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Filter, Loader2, TrendingUp, TrendingDown, ChevronDown, ExternalLink } from "lucide-react"
import { fmtBigValue } from "@/lib/currency"
import { getTabCache, setTabCache } from "@/lib/tabCache"

// ── Types ────────────────────────────────────────────────────

interface StockValuation {
  peValuation: number | null
  evEbitdaValuation: number | null
  avgValuation: number | null
  upside: number | null
  premiumDiscount: string | null
}

interface SectorStock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap: number
  currency: string
  exchange: string
  market: "US" | "GPW" | "NC"
  sector: string
  industry: string | null
  source: "S&P500" | "NASDAQ" | "GPW" | "NC"
  peRatio: number | null
  forwardPE: number | null
  evToEbitda: number | null
  dividendYield: number | null
  pegRatio: number | null
  ebitda: number | null
  netIncome: number | null
  enterpriseValue: number | null
  totalDebt: number | null
  totalCash: number | null
  profitMargin: number | null
  revenueGrowth: number | null
  valuation: StockValuation | null
}

interface SectorData {
  stocks: SectorStock[]
  total: number
  sectorCounts: Record<string, number>
  sectorMedians: Record<string, Record<string, number | null>>
  indexInfo?: { sp500: number; nasdaq: number; fetchedSP500: number; fetchedNASDAQ: number }
  errors?: number
  timestamp: string
}

type SortDir = "asc" | "desc" | null
type MetricKey = "marketCap" | "peRatio" | "forwardPE" | "evToEbitda" | "dividendYield" | "pegRatio" | "profitMargin" | "revenueGrowth" | "changePercent" | "upside"

interface RangeFilter {
  min: string
  max: string
}

// ── Constants ────────────────────────────────────────────────

const GICS_SECTORS = [
  { key: "Information Technology", icon: "💻", label: "Technologia (IT)" },
  { key: "Healthcare", icon: "🏥", label: "Ochrona zdrowia" },
  { key: "Financials", icon: "🏦", label: "Finanse" },
  { key: "Consumer Discretionary", icon: "🛍️", label: "Dobra uznaniowe" },
  { key: "Consumer Staples", icon: "🛒", label: "Dobra podstawowe" },
  { key: "Energy", icon: "⚡", label: "Energetyka" },
  { key: "Industrials", icon: "🏭", label: "Przemysł" },
  { key: "Materials", icon: "⛏️", label: "Surowce" },
  { key: "Utilities", icon: "💡", label: "Użytkowe" },
  { key: "Real Estate", icon: "🏠", label: "Nieruchomości (REITs)" },
  { key: "Communication Services", icon: "📡", label: "Komunikacja" },
] as const

const MARKETS = [
  { key: "ALL", label: "WSZYSTKIE" },
  { key: "US", label: "US" },
  { key: "GPW", label: "GPW" },
  { key: "NC", label: "NewConnect" },
] as const

const COLUMNS: { key: MetricKey; label: string; short: string; suffix?: string; pct?: boolean }[] = [
  { key: "marketCap", label: "Kapitalizacja", short: "MCap" },
  { key: "changePercent", label: "Zmiana %", short: "Chg%", pct: true },
  { key: "peRatio", label: "P/E", short: "P/E" },
  { key: "evToEbitda", label: "EV/EBITDA", short: "EV/EB" },
  { key: "dividendYield", label: "Div Yield", short: "Div%", suffix: "%", pct: true },
  { key: "pegRatio", label: "PEG", short: "PEG" },
  { key: "profitMargin", label: "Marża zysku", short: "Marża%", suffix: "%", pct: true },
  { key: "revenueGrowth", label: "Wzrost przych.", short: "Rev Gr%", suffix: "%", pct: true },
  { key: "upside", label: "Wycena mnożn.", short: "Upside", suffix: "%", pct: true },
]

const CACHE_KEY = "sectors:data"

// ── Helpers ──────────────────────────────────────────────────

/** Get metric value from stock, including computed "upside" */
function getMetric(stock: SectorStock, key: MetricKey): number | null {
  if (key === "upside") return stock.valuation?.upside ?? null
  return stock[key] as number | null
}

function fmtMetric(val: number | null, key: MetricKey, currency?: string): string {
  if (val == null || !isFinite(val)) return "—"
  if (key === "marketCap") return fmtBigValue(val, currency ?? "USD")
  if (key === "changePercent" || key === "dividendYield" || key === "profitMargin" || key === "revenueGrowth") return `${val.toFixed(2)}%`
  if (key === "upside") {
    const sign = val > 0 ? "+" : ""
    return `${sign}${val.toFixed(1)}%`
  }
  return val.toFixed(2)
}

function valuation(val: number | null, median: number | null): "over" | "under" | "fair" | null {
  if (val == null || median == null || !isFinite(val) || !isFinite(median) || median === 0) return null
  const ratio = val / median
  if (ratio > 1.25) return "over"
  if (ratio < 0.75) return "under"
  return "fair"
}

function valuationColor(v: "over" | "under" | "fair" | null, inverse?: boolean): string {
  if (!v) return ""
  // For P/E, P/S, EV/EBITDA: lower is "better" (undervalued)
  // For Div Yield, Margin: higher is "better"
  if (inverse) {
    if (v === "over") return "text-bloomberg-green"
    if (v === "under") return "text-bloomberg-red"
  } else {
    if (v === "over") return "text-bloomberg-red"
    if (v === "under") return "text-bloomberg-green"
  }
  return "text-bloomberg-amber"
}

const INVERSE_METRICS: MetricKey[] = ["dividendYield", "profitMargin", "revenueGrowth", "upside"]

// ── Component ────────────────────────────────────────────────

export default function SectorScreener() {
  // Data
  const [data, setData] = useState<SectorData | null>(() => getTabCache<SectorData>(CACHE_KEY))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [selectedSector, setSelectedSector] = useState<string>("ALL")
  const [selectedMarket, setSelectedMarket] = useState<string>("US")
  const [includeNasdaq, setIncludeNasdaq] = useState(false)
  const [sortKey, setSortKey] = useState<MetricKey | "symbol">("marketCap")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({})
  const [showFilters, setShowFilters] = useState(false)

  // Fetch
  const fetchSector = useCallback(async (sector: string, market: string, withNasdaq?: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/sector-screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector: sector === "ALL" ? undefined : sector,
          market,
          includeNasdaq: withNasdaq ?? false,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setTabCache(CACHE_KEY, json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Błąd")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSectorSelect = useCallback((sectorKey: string) => {
    setSelectedSector(sectorKey)
    fetchSector(sectorKey, selectedMarket, includeNasdaq)
  }, [fetchSector, selectedMarket, includeNasdaq])

  const handleMarketSelect = useCallback((mkt: string) => {
    setSelectedMarket(mkt)
    fetchSector(selectedSector, mkt, includeNasdaq)
  }, [fetchSector, selectedSector, includeNasdaq])

  const handleNasdaqToggle = useCallback(() => {
    const next = !includeNasdaq
    setIncludeNasdaq(next)
    if (data) fetchSector(selectedSector, selectedMarket, next)
  }, [includeNasdaq, data, fetchSector, selectedSector, selectedMarket])

  // Sort toggle
  const handleSort = useCallback((key: MetricKey | "symbol") => {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : d === "asc" ? null : "desc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }, [sortKey])

  // Range filter update
  const updateRange = useCallback((key: string, field: "min" | "max", value: string) => {
    setRangeFilters(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }, [])

  // Reset
  const resetFilters = useCallback(() => {
    setRangeFilters({})
    setSortKey("marketCap")
    setSortDir("desc")
  }, [])

  // Get sector medians for current sector
  const currentMedians = useMemo(() => {
    if (!data || selectedSector === "ALL") return null
    return data.sectorMedians[selectedSector] ?? null
  }, [data, selectedSector])

  // Filtered + sorted stocks
  const displayStocks = useMemo(() => {
    if (!data) return []
    let stocks = [...data.stocks]

    // Apply range filters
    for (const [key, range] of Object.entries(rangeFilters)) {
      const minVal = range.min ? parseFloat(range.min) : null
      const maxVal = range.max ? parseFloat(range.max) : null
      if (minVal == null && maxVal == null) continue

      stocks = stocks.filter(s => {
        const val = getMetric(s, key as MetricKey)
        if (val == null) return false
        // For marketCap, allow input in millions
        const v = key === "marketCap" ? val / 1e6 : val
        if (minVal != null && v < minVal) return false
        if (maxVal != null && v > maxVal) return false
        return true
      })
    }

    // Sort
    if (sortDir && sortKey) {
      stocks.sort((a, b) => {
        let va: number | string | null
        let vb: number | string | null
        if (sortKey === "symbol") {
          va = a.symbol
          vb = b.symbol
        } else {
          va = getMetric(a, sortKey)
          vb = getMetric(b, sortKey)
        }
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        if (typeof va === "string" && typeof vb === "string") {
          return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va)
        }
        return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number)
      })
    }

    return stocks
  }, [data, rangeFilters, sortKey, sortDir])

  // Current sector info
  const sectorInfo = GICS_SECTORS.find(s => s.key === selectedSector)

  return (
    <div className="font-mono space-y-3">
      {/* SECTOR SELECTOR */}
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] text-bloomberg-amber font-bold tracking-wider">WYBIERZ SEKTOR GICS</span>
          {data?.indexInfo && (
            <span className="text-[8px] text-muted-foreground ml-auto">
              S&P 500: {data.indexInfo.sp500} | NASDAQ: {data.indexInfo.nasdaq}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
          <button
            onClick={() => handleSectorSelect("ALL")}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-bold border transition-colors ${
              selectedSector === "ALL"
                ? "bg-bloomberg-amber/20 text-bloomberg-amber border-bloomberg-amber/50"
                : "border-bloomberg-border/50 text-muted-foreground hover:border-bloomberg-amber/30 hover:text-bloomberg-amber/70"
            }`}
          >
            <span>🌐</span>
            <span>WSZYSTKIE</span>
            {data?.total != null && selectedSector === "ALL" && (
              <span className="text-[7px] opacity-60">({data.total})</span>
            )}
          </button>
          {GICS_SECTORS.map(s => {
            const count = data?.sectorCounts[s.key]
            return (
              <button
                key={s.key}
                onClick={() => handleSectorSelect(s.key)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-bold border transition-colors ${
                  selectedSector === s.key
                    ? "bg-bloomberg-amber/20 text-bloomberg-amber border-bloomberg-amber/50"
                    : "border-bloomberg-border/50 text-muted-foreground hover:border-bloomberg-amber/30 hover:text-bloomberg-amber/70"
                }`}
              >
                <span className="text-xs">{s.icon}</span>
                <span className="truncate">{s.label.split(" (")[0]}</span>
                {count != null && <span className="text-[7px] opacity-50">({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* MARKET + CONTROLS BAR */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Market selector */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-muted-foreground font-bold mr-1">RYNEK:</span>
          {MARKETS.map(m => (
            <button
              key={m.key}
              onClick={() => handleMarketSelect(m.key)}
              className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors ${
                selectedMarket === m.key
                  ? "bg-bloomberg-green/20 text-bloomberg-green border-bloomberg-green/50"
                  : "border-bloomberg-border/50 text-muted-foreground hover:border-bloomberg-green/30"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* NASDAQ-only toggle */}
        {(selectedMarket === "US" || selectedMarket === "ALL") && (
          <button
            onClick={handleNasdaqToggle}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold border transition-colors ${
              includeNasdaq
                ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                : "border-bloomberg-border/50 text-muted-foreground hover:border-blue-500/30"
            }`}
          >
            + NASDAQ
            <span className="text-[7px] font-normal opacity-70">(poza S&P 500)</span>
          </button>
        )}

        <div className="flex-1" />

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] border transition-colors ${
            showFilters || Object.values(rangeFilters).some(r => r.min || r.max)
              ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
              : "border-bloomberg-border/50 text-muted-foreground hover:border-purple-500/30"
          }`}
        >
          <Filter className="w-3 h-3" />
          <span>FILTRY</span>
          {Object.values(rangeFilters).filter(r => r.min || r.max).length > 0 && (
            <span className="text-[7px] bg-purple-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
              {Object.values(rangeFilters).filter(r => r.min || r.max).length}
            </span>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 px-2 py-1 rounded text-[9px] border border-bloomberg-border/50 text-muted-foreground hover:border-bloomberg-red/30 hover:text-bloomberg-red transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>RESET</span>
        </button>

        {/* Scan button (initial load) */}
        {!data && !loading && (
          <button
            onClick={() => fetchSector(selectedSector, selectedMarket)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/50 hover:bg-bloomberg-green/30 transition-colors"
          >
            SKANUJ
          </button>
        )}
      </div>

      {/* RANGE FILTERS PANEL */}
      {showFilters && (
        <div className="bg-bloomberg-card border border-purple-500/30 rounded p-3">
          <div className="text-[9px] text-purple-400 font-bold tracking-wider mb-2">FILTRY ZAKRESOWE</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {/* Market cap in millions */}
            <div className="space-y-1">
              <div className="text-[8px] text-muted-foreground font-bold">MCap (mln)</div>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="od"
                  value={rangeFilters.marketCap?.min ?? ""}
                  onChange={e => updateRange("marketCap", "min", e.target.value)}
                  className="w-full bg-bloomberg-bg border border-bloomberg-border rounded px-1.5 py-0.5 text-[9px] text-foreground placeholder:text-muted-foreground/40"
                />
                <input
                  type="number"
                  placeholder="do"
                  value={rangeFilters.marketCap?.max ?? ""}
                  onChange={e => updateRange("marketCap", "max", e.target.value)}
                  className="w-full bg-bloomberg-bg border border-bloomberg-border rounded px-1.5 py-0.5 text-[9px] text-foreground placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
            {COLUMNS.filter(c => c.key !== "marketCap" && c.key !== "changePercent").map(col => (
              <div key={col.key} className="space-y-1">
                <div className="text-[8px] text-muted-foreground font-bold">{col.short}</div>
                <div className="flex gap-1">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="od"
                    value={rangeFilters[col.key]?.min ?? ""}
                    onChange={e => updateRange(col.key, "min", e.target.value)}
                    className="w-full bg-bloomberg-bg border border-bloomberg-border rounded px-1.5 py-0.5 text-[9px] text-foreground placeholder:text-muted-foreground/40"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="do"
                    value={rangeFilters[col.key]?.max ?? ""}
                    onChange={e => updateRange(col.key, "max", e.target.value)}
                    className="w-full bg-bloomberg-bg border border-bloomberg-border rounded px-1.5 py-0.5 text-[9px] text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTOR MEDIANS BAR */}
      {currentMedians && selectedSector !== "ALL" && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[8px] text-bloomberg-amber font-bold shrink-0">
              {sectorInfo?.icon} MEDIANA SEKTORA:
            </span>
            {COLUMNS.filter(c => c.key !== "marketCap" && c.key !== "changePercent").map(col => {
              const val = currentMedians[col.key]
              return (
                <div key={col.key} className="flex items-center gap-0.5">
                  <span className="text-[8px] text-muted-foreground">{col.short}:</span>
                  <span className="text-[8px] text-bloomberg-amber font-bold">
                    {val != null ? `${val.toFixed(2)}${col.suffix ?? ""}` : "—"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-bloomberg-amber animate-spin" />
          <div className="text-[10px] text-muted-foreground">
            Pobieranie danych dla {selectedSector === "ALL" ? "wszystkich sektorów" : sectorInfo?.label}...
          </div>
          <div className="text-[8px] text-muted-foreground/60">
            To może potrwać ~30-60s (zależnie od liczby spółek)
          </div>
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-bloomberg-red/10 border border-bloomberg-red/30 rounded p-3 text-[10px] text-bloomberg-red">
          {error}
        </div>
      )}

      {/* NO DATA YET */}
      {!data && !loading && !error && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded p-8 text-center">
          <div className="text-[11px] text-muted-foreground mb-2">
            Wybierz sektor i rynek, aby rozpocząć skanowanie.
          </div>
          <div className="text-[9px] text-muted-foreground/60">
            Dane zostaną pobrane z Yahoo Finance dla wybranych spółek.
          </div>
        </div>
      )}

      {/* RESULTS TABLE */}
      {data && !loading && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded overflow-hidden">
          {/* Table header */}
          <div className="px-3 py-1.5 border-b border-bloomberg-border flex items-center gap-2">
            <span className="text-[9px] text-bloomberg-amber font-bold">
              {selectedSector === "ALL" ? "🌐 WSZYSTKIE SEKTORY" : `${sectorInfo?.icon} ${sectorInfo?.label}`}
            </span>
            <span className="text-[8px] text-muted-foreground">
              {displayStocks.length} spółek
              {displayStocks.length !== data.stocks.length && ` (z ${data.stocks.length})`}
              {data.indexInfo && ` | S&P 500: ${data.indexInfo.fetchedSP500}`}
              {data.indexInfo && data.indexInfo.fetchedNASDAQ > 0 && ` + NASDAQ: ${data.indexInfo.fetchedNASDAQ}`}
            </span>
            <span className="text-[8px] text-muted-foreground ml-auto">
              {new Date(data.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b border-bloomberg-border bg-bloomberg-bg/50">
                  {/* Ticker + Name */}
                  <th className="text-left px-2 py-1.5 sticky left-0 bg-bloomberg-bg/90 z-10">
                    <button onClick={() => handleSort("symbol")} className="flex items-center gap-0.5 text-muted-foreground hover:text-bloomberg-amber transition-colors">
                      TICKER
                      <SortIcon active={sortKey === "symbol"} dir={sortKey === "symbol" ? sortDir : null} />
                    </button>
                  </th>
                  <th className="text-left px-2 py-1.5 min-w-[120px]">
                    <span className="text-muted-foreground">NAZWA</span>
                  </th>
                  {COLUMNS.map(col => (
                    <th key={col.key} className="text-right px-2 py-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-0.5 ml-auto text-muted-foreground hover:text-bloomberg-amber transition-colors"
                      >
                        {col.short}
                        <SortIcon active={sortKey === col.key} dir={sortKey === col.key ? sortDir : null} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayStocks.map(stock => (
                  <StockRow
                    key={stock.symbol}
                    stock={stock}
                    medians={currentMedians}
                    sector={selectedSector}
                  />
                ))}
                {displayStocks.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="px-4 py-6 text-center text-muted-foreground text-[10px]">
                      Brak spółek spełniających kryteria filtrowania.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sort Icon ────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active || !dir) return <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
  return dir === "desc"
    ? <ArrowDown className="w-2.5 h-2.5 text-bloomberg-amber" />
    : <ArrowUp className="w-2.5 h-2.5 text-bloomberg-amber" />
}

// ── Stock Row ────────────────────────────────────────────────

function StockRow({ stock, medians, sector }: {
  stock: SectorStock
  medians: Record<string, number | null> | null
  sector: string
}) {
  const [expanded, setExpanded] = useState(false)
  const changeColor = stock.changePercent > 0 ? "text-bloomberg-green" : stock.changePercent < 0 ? "text-bloomberg-red" : "text-muted-foreground"
  const srcColor = stock.source === "S&P500" ? "text-bloomberg-green" : stock.source === "NASDAQ" ? "text-blue-400" : stock.source === "GPW" ? "text-red-400" : "text-purple-400"

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="border-b border-bloomberg-border/30 hover:bg-bloomberg-card/80 cursor-pointer transition-colors"
      >
        {/* Ticker */}
        <td className="px-2 py-1.5 sticky left-0 bg-bloomberg-card/95 z-10">
          <div className="flex items-center gap-1">
            <span className="font-bold text-foreground">{stock.symbol.replace(".WA", "")}</span>
            <span className={`text-[7px] ${srcColor}`}>{stock.source}</span>
          </div>
        </td>
        {/* Name */}
        <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">
          {stock.name}
        </td>
        {/* Columns */}
        {COLUMNS.map(col => {
          const val = getMetric(stock, col.key)
          const med = medians?.[col.key] ?? null
          const isInverse = INVERSE_METRICS.includes(col.key)
          const valu = sector !== "ALL" ? valuation(val, med) : null
          const vc = valuationColor(valu, isInverse)

          if (col.key === "changePercent") {
            return (
              <td key={col.key} className={`px-2 py-1.5 text-right font-bold ${changeColor}`}>
                {val != null ? `${val > 0 ? "+" : ""}${val.toFixed(2)}%` : "—"}
              </td>
            )
          }

          // Upside column — special coloring
          if (col.key === "upside") {
            const upsideColor = val != null
              ? val > 10 ? "text-bloomberg-green font-bold" : val < -10 ? "text-bloomberg-red font-bold" : "text-bloomberg-amber"
              : "text-muted-foreground"
            return (
              <td key={col.key} className={`px-2 py-1.5 text-right ${upsideColor}`}>
                {fmtMetric(val, col.key, stock.currency)}
              </td>
            )
          }

          return (
            <td key={col.key} className={`px-2 py-1.5 text-right ${vc || "text-foreground"}`}>
              <div className="flex items-center justify-end gap-0.5">
                {fmtMetric(val, col.key, stock.currency)}
                {valu === "over" && <TrendingUp className="w-2.5 h-2.5 inline-block opacity-60" />}
                {valu === "under" && <TrendingDown className="w-2.5 h-2.5 inline-block opacity-60" />}
              </div>
            </td>
          )
        })}
      </tr>
      {expanded && (
        <tr className="bg-bloomberg-bg/50">
          <td colSpan={COLUMNS.length + 2} className="px-3 py-2">
            <div className="flex items-center gap-3 flex-wrap text-[8px]">
              <span className="text-muted-foreground">Branża: <span className="text-foreground">{stock.industry ?? "—"}</span></span>
              <span className="text-muted-foreground">Giełda: <span className="text-foreground">{stock.exchange}</span></span>
              <span className="text-muted-foreground">Cena: <span className="text-foreground">{stock.currency === "PLN" ? `${stock.price.toFixed(2)} zł` : `$${stock.price.toFixed(2)}`}</span></span>
              {stock.enterpriseValue != null && (
                <span className="text-muted-foreground">EV: <span className="text-foreground">{fmtBigValue(stock.enterpriseValue, stock.currency)}</span></span>
              )}
              {stock.forwardPE != null && (
                <span className="text-muted-foreground">Fwd P/E: <span className="text-foreground">{stock.forwardPE.toFixed(2)}</span></span>
              )}
              <div className="flex gap-1.5 ml-auto">
                <a href={`https://finance.yahoo.com/quote/${stock.symbol}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-bloomberg-green/15 text-bloomberg-green border border-bloomberg-green/30 rounded hover:bg-bloomberg-green/25 transition-colors">
                  Yahoo <ExternalLink className="w-2 h-2" />
                </a>
                <a href={`https://stockanalysis.com/stocks/${stock.symbol.toLowerCase().replace(".wa", "")}/`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-bloomberg-amber/15 text-bloomberg-amber border border-bloomberg-amber/30 rounded hover:bg-bloomberg-amber/25 transition-colors">
                  StockAnalysis <ExternalLink className="w-2 h-2" />
                </a>
              </div>
            </div>
            {/* Valuation vs sector median */}
            {medians && sector !== "ALL" && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[8px] text-bloomberg-amber font-bold">VS MEDIANA:</span>
                {COLUMNS.filter(c => c.key !== "marketCap" && c.key !== "changePercent" && c.key !== "upside").map(col => {
                  const val = getMetric(stock, col.key)
                  const med = medians[col.key]
                  if (val == null || med == null || !isFinite(val) || med === 0) return null
                  const pctDiff = ((val - med) / Math.abs(med)) * 100
                  const isInverse = INVERSE_METRICS.includes(col.key)
                  const diffColor = isInverse
                    ? (pctDiff > 0 ? "text-bloomberg-green" : "text-bloomberg-red")
                    : (pctDiff > 0 ? "text-bloomberg-red" : "text-bloomberg-green")
                  return (
                    <span key={col.key} className="text-[7px]">
                      <span className="text-muted-foreground">{col.short}: </span>
                      <span className={`font-bold ${Math.abs(pctDiff) < 10 ? "text-bloomberg-amber" : diffColor}`}>
                        {pctDiff > 0 ? "+" : ""}{pctDiff.toFixed(0)}%
                      </span>
                    </span>
                  )
                })}
              </div>
            )}
            {/* Multiplier Valuation Details */}
            {stock.valuation && (stock.valuation.peValuation || stock.valuation.evEbitdaValuation) && (
              <div className="mt-2 pt-2 border-t border-bloomberg-border/30">
                <span className="text-[8px] text-purple-400 font-bold">WYCENA MNOŻNIKOWA:</span>
                <div className="flex items-center gap-3 flex-wrap mt-1">
                  {stock.valuation.peValuation != null && (
                    <span className="text-[7px]">
                      <span className="text-muted-foreground">P/E → </span>
                      <span className="text-foreground font-bold">{fmtBigValue(stock.valuation.peValuation, stock.currency)}</span>
                      <span className="text-muted-foreground"> (Zysk netto × mediana P/E sektora)</span>
                    </span>
                  )}
                  {stock.valuation.evEbitdaValuation != null && (
                    <span className="text-[7px]">
                      <span className="text-muted-foreground">EV/EBITDA → </span>
                      <span className="text-foreground font-bold">{fmtBigValue(stock.valuation.evEbitdaValuation, stock.currency)}</span>
                      <span className="text-muted-foreground"> (EBITDA × mediana EV/EBITDA − dług netto)</span>
                    </span>
                  )}
                  {stock.valuation.avgValuation != null && (
                    <span className="text-[7px]">
                      <span className="text-muted-foreground">Średnia → </span>
                      <span className="text-foreground font-bold">{fmtBigValue(stock.valuation.avgValuation, stock.currency)}</span>
                    </span>
                  )}
                  {stock.valuation.upside != null && (
                    <span className={`text-[7px] font-bold ${stock.valuation.upside > 10 ? "text-bloomberg-green" : stock.valuation.upside < -10 ? "text-bloomberg-red" : "text-bloomberg-amber"}`}>
                      Potencjał: {stock.valuation.upside > 0 ? "+" : ""}{stock.valuation.upside.toFixed(1)}%
                    </span>
                  )}
                  {stock.valuation.premiumDiscount && (
                    <span className={`text-[7px] font-bold border px-1 py-px rounded ${
                      stock.valuation.premiumDiscount === "PREMIUM" ? "text-bloomberg-green border-bloomberg-green/30" :
                      stock.valuation.premiumDiscount === "DISCOUNT" ? "text-bloomberg-red border-bloomberg-red/30" :
                      "text-bloomberg-amber border-bloomberg-amber/30"
                    }`}>
                      {stock.valuation.premiumDiscount === "PREMIUM" ? "PREMIA (wyższe marże)" :
                       stock.valuation.premiumDiscount === "DISCOUNT" ? "DYSKONTO (niższe marże)" :
                       "FAIR VALUE (marże = mediana)"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
