'use client'

import { useState, useMemo } from 'react'
import { Search, ExternalLink, Loader2, ArrowUpDown, Star, Crosshair } from 'lucide-react'
import { addTokenToWatch, isTokenWatched } from '@/lib/tokenBook'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtMcap(n: number): string {
  if (!n || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtVol(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number): string {
  if (!n) return '0%'
  const sign = n > 0 ? '+' : ''
  if (Math.abs(n) >= 10000) return `${sign}${(n / 1000).toFixed(0)}K%`
  return `${sign}${n.toFixed(1)}%`
}

function timeAgo(ts: number): string {
  if (!ts) return '—'
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

// Slider steps for ATH mcap (non-linear scale)
const ATH_STEPS = [
  0, 100000, 250000, 500000, 1_000_000, 2_500_000, 5_000_000,
  10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000,
]

function athSliderToValue(idx: number): number {
  return ATH_STEPS[Math.min(idx, ATH_STEPS.length - 1)] ?? 0
}
function athValueToSlider(val: number): number {
  for (let i = ATH_STEPS.length - 1; i >= 0; i--) {
    if (val >= ATH_STEPS[i]) return i
  }
  return 0
}

const VOL_STEPS = [
  0, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000,
  1_000_000, 2_500_000, 5_000_000, 10_000_000,
]

function volSliderToValue(idx: number): number {
  return VOL_STEPS[Math.min(idx, VOL_STEPS.length - 1)] ?? 0
}
function volValueToSlider(val: number): number {
  for (let i = VOL_STEPS.length - 1; i >= 0; i--) {
    if (val >= VOL_STEPS[i]) return i
  }
  return 0
}

const LIQ_STEPS = [
  0, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000,
  1_000_000, 2_500_000, 5_000_000,
]

function liqSliderToValue(idx: number): number {
  return LIQ_STEPS[Math.min(idx, LIQ_STEPS.length - 1)] ?? 0
}
function liqValueToSlider(val: number): number {
  for (let i = LIQ_STEPS.length - 1; i >= 0; i--) {
    if (val >= LIQ_STEPS[i]) return i
  }
  return 0
}

// ── types ────────────────────────────────────────────────────────────────────

interface ScannedToken {
  address: string
  name: string
  symbol: string
  logo: string
  athMcap: number
  currentMcap: number
  currentPrice: number
  currentHolders: number
  volume24h: number
  liquidity: number
  swaps24h: number
  buys24h: number
  sells24h: number
  priceChange24h: number
  createdAt: number
  launchpad: string
  dexUrl: string
  gmgnUrl: string
}

type SortKey = 'athMcap' | 'currentMcap' | 'currentHolders' | 'volume24h' | 'liquidity' | 'swaps24h' | 'priceChange24h' | 'createdAt'

const AGE_OPTIONS = [
  { value: 'any', label: 'Dowolny' },
  { value: '1h', label: '< 1 godzina' },
  { value: '6h', label: '< 6 godzin' },
  { value: '12h', label: '< 12 godzin' },
  { value: '1d', label: '< 1 dzien' },
  { value: '7d', label: '< 7 dni' },
  { value: '30d', label: '< 30 dni' },
  { value: '90d', label: '< 90 dni' },
  { value: '180d', label: '< 180 dni' },
  { value: '365d', label: '< 365 dni' },
  { value: '>365d', label: '> 365 dni' },
]

const ORDER_OPTIONS = [
  { value: 'market_cap', label: 'Market Cap' },
  { value: 'volume', label: 'Wolumen' },
  { value: 'swaps', label: 'Liczba swapow' },
  { value: 'holder_count', label: 'Holderzy' },
  { value: 'price_change_percent', label: 'Zmiana ceny %' },
]

// ── Slider filter ───────────────────────────────────────────────────────────

function SliderFilter({
  label,
  description,
  value,
  sliderIdx,
  maxIdx,
  onSliderChange,
  onInputChange,
}: {
  label: string
  description: string
  value: number
  sliderIdx: number
  maxIdx: number
  onSliderChange: (idx: number) => void
  onInputChange: (val: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400">{label}</label>
        <span className="text-xs font-mono font-semibold text-gray-200">{fmtVol(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={maxIdx}
        step={1}
        value={sliderIdx}
        onChange={e => onSliderChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-orange-500"
      />
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => onInputChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full px-2.5 py-1.5 text-xs border border-gray-700 rounded-lg bg-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
      />
      <p className="text-[10px] text-gray-500">{description}</p>
    </div>
  )
}

// ── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-12 w-full" />
      ))}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

export default function TokenScanner() {
  // Filter state
  const [minAth, setMinAth] = useState(5_000_000)
  const [minHolders, setMinHolders] = useState(100)
  const [minVolume24h, setMinVolume24h] = useState(50_000)
  const [minLiquidity, setMinLiquidity] = useState(0)
  const [maxAge, setMaxAge] = useState('any')
  const [orderBy, setOrderBy] = useState('market_cap')
  const [sortDirApi, setSortDirApi] = useState<'desc' | 'asc'>('desc')

  // Results state
  const [tokens, setTokens] = useState<ScannedToken[]>([])
  const [total, setTotal] = useState(0)
  const [scanned, setScanned] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Local sort state
  const [sortKey, setSortKey] = useState<SortKey>('athMcap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sortedTokens = useMemo(() => {
    const copy = [...tokens]
    copy.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      return sortDir === 'desc' ? vb - va : va - vb
    })
    return copy
  }, [tokens, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown size={10} className="opacity-30 ml-0.5" />
    return <span className="text-orange-500 ml-0.5">{sortDir === 'desc' ? '\u2193' : '\u2191'}</span>
  }

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setTokens([])
    setHasSearched(true)

    try {
      // Handle ">365d" — send maxAge=any and filter client-side after
      const apiMaxAge = maxAge === '>365d' ? 'any' : maxAge

      const params = new URLSearchParams({
        minAth: String(minAth),
        minHolders: String(minHolders),
        minVolume24h: String(minVolume24h),
        minLiquidity: String(minLiquidity),
        maxAge: apiMaxAge,
        orderBy,
        sortDir: sortDirApi,
      })

      const res = await fetch(`/api/token-scanner?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as Record<string, string>).error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      let resultTokens: ScannedToken[] = data.tokens ?? []

      // Client-side filter for ">365d"
      if (maxAge === '>365d') {
        const cutoff = Math.floor(Date.now() / 1000) - 365 * 86400
        resultTokens = resultTokens.filter(t => t.createdAt > 0 && t.createdAt < cutoff)
      }

      setTokens(resultTokens)
      setTotal(resultTokens.length)
      setScanned(data.scanned ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nieznany blad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Filters panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-5">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Filtry wyszukiwania</div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <SliderFilter
            label="MIN ATH Market Cap"
            description="Minimalne ATH tokena (kiedykolwiek osiagnieta kapitalizacja)"
            value={minAth}
            sliderIdx={athValueToSlider(minAth)}
            maxIdx={ATH_STEPS.length - 1}
            onSliderChange={idx => setMinAth(athSliderToValue(idx))}
            onInputChange={setMinAth}
          />
          <SliderFilter
            label="MIN Wolumen 24h"
            description="Minimalny wolumen z ostatnich 24h"
            value={minVolume24h}
            sliderIdx={volValueToSlider(minVolume24h)}
            maxIdx={VOL_STEPS.length - 1}
            onSliderChange={idx => setMinVolume24h(volSliderToValue(idx))}
            onInputChange={setMinVolume24h}
          />
          <SliderFilter
            label="MIN Liquidity"
            description="Minimalna plynnosc (USD)"
            value={minLiquidity}
            sliderIdx={liqValueToSlider(minLiquidity)}
            maxIdx={LIQ_STEPS.length - 1}
            onSliderChange={idx => setMinLiquidity(liqSliderToValue(idx))}
            onInputChange={setMinLiquidity}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">MIN Holders</label>
              <span className="text-xs font-mono font-semibold text-gray-200">{minHolders.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={0}
              max={50000}
              step={100}
              value={minHolders}
              onChange={e => setMinHolders(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-orange-500"
            />
            <input
              type="number"
              min={0}
              max={100_000}
              value={minHolders}
              onChange={e => setMinHolders(Math.min(100_000, Math.max(0, Number(e.target.value) || 0)))}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-700 rounded-lg bg-gray-800 text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
            <p className="text-[10px] text-gray-500">Minimalna liczba holderow tokena</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Wiek tokena</label>
            <select
              value={maxAge}
              onChange={e => setMaxAge(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-700 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            >
              {AGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500">Filtruj po wieku tokena (w tym powyzej 365 dni)</p>
          </div>
        </div>

        {/* Order / Sort */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Sortuj wedlug</label>
            <select
              value={orderBy}
              onChange={e => setOrderBy(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-700 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            >
              {ORDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Kierunek</label>
            <select
              value={sortDirApi}
              onChange={e => setSortDirApi(e.target.value as 'asc' | 'desc')}
              className="px-2.5 py-1.5 text-xs border border-gray-700 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="desc">Malejaco</option>
              <option value="asc">Rosnaco</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Skanowanie (4 timeframe + ATH kline)...
            </>
          ) : (
            <>
              <Search size={16} />
              Szukaj tokenow
            </>
          )}
        </button>

        <p className="text-[10px] text-gray-600 text-center">
          Skanuje ranking GMGN z 4 timeframow (5m, 1h, 6h, 24h) — ~150 unikalnych tokenow.
          Dla kazdego pobiera ATH z danych kline (1d, 365 dni).
        </p>
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <SkeletonRows />
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {hasSearched && !loading && !error && tokens.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">Brak tokenow spelniajacych kryteria.</p>
          <p className="text-gray-500 text-xs mt-1">Sprobuj zmniejszyc MIN ATH lub inne filtry.</p>
        </div>
      )}

      {/* ── Results table ── */}
      {!loading && tokens.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            Znaleziono <span className="font-semibold text-gray-300">{total}</span> tokenow
            {' '}(przeskanowano <span className="font-semibold text-gray-300">{scanned}</span>)
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
            {/* Header */}
            <div className="grid grid-cols-[28px_minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.55fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.4fr)_56px] gap-1 items-center px-3 py-2 bg-gray-950 border-b border-gray-800 text-[10px] text-gray-500 uppercase tracking-wider font-medium min-w-[900px]">
              <div>#</div>
              <div>Token</div>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('athMcap')}>
                ATH Mcap{sortIcon('athMcap')}
              </button>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('currentMcap')}>
                Mcap{sortIcon('currentMcap')}
              </button>
              <div className="text-right text-[9px]">% od ATH</div>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('volume24h')}>
                Vol 24h{sortIcon('volume24h')}
              </button>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('liquidity')}>
                Liq{sortIcon('liquidity')}
              </button>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('currentHolders')}>
                Holders{sortIcon('currentHolders')}
              </button>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('priceChange24h')}>
                24h %{sortIcon('priceChange24h')}
              </button>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('createdAt')}>
                Wiek{sortIcon('createdAt')}
              </button>
              <div />
            </div>

            {/* Rows */}
            {sortedTokens.map((token, idx) => {
              const pctColor = token.priceChange24h > 0 ? 'text-green-400' : token.priceChange24h < 0 ? 'text-red-400' : 'text-gray-500'
              const athRatio = token.athMcap > 0 && token.currentMcap > 0
                ? ((token.currentMcap / token.athMcap) * 100)
                : 0
              const dropPct = athRatio > 0 && athRatio < 100
                ? -(100 - athRatio)
                : 0

              return (
                <div
                  key={token.address}
                  className="grid grid-cols-[28px_minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.55fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.4fr)_56px] gap-1 items-center px-3 py-2.5 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/50 transition-colors text-sm min-w-[900px]"
                >
                  <div className="text-xs text-gray-600 font-mono">{idx + 1}</div>

                  {/* Token */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => addTokenToWatch(token.address, token.symbol, token.name, token.logo, token.currentMcap, token.currentPrice)}
                      className={`transition-colors shrink-0 ${isTokenWatched(token.address) ? 'text-yellow-500' : 'text-gray-600 hover:text-yellow-500'}`}
                      title={isTokenWatched(token.address) ? 'Obserwowany' : 'Dodaj do obserwowanych'}
                    >
                      <Star size={11} fill={isTokenWatched(token.address) ? 'currentColor' : 'none'} />
                    </button>
                    {token.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={token.logo}
                        alt=""
                        className="w-6 h-6 rounded-full bg-gray-800 shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-400 shrink-0">
                        {token.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-gray-200 font-semibold text-xs leading-none truncate">{token.symbol}</div>
                      <div className="text-gray-500 text-[10px] truncate">{token.name}</div>
                    </div>
                  </div>

                  {/* ATH Mcap */}
                  <div className="text-right font-mono text-xs text-yellow-400 font-semibold">{fmtMcap(token.athMcap)}</div>

                  {/* Current Mcap */}
                  <div className="text-right font-mono text-xs text-gray-300 font-semibold">{fmtMcap(token.currentMcap)}</div>

                  {/* % from ATH */}
                  <div className="text-right">
                    {dropPct < 0 ? (
                      <span className="font-mono text-xs text-red-400 font-medium">{dropPct.toFixed(0)}%</span>
                    ) : athRatio >= 100 ? (
                      <span className="font-mono text-xs text-green-400 font-medium">ATH</span>
                    ) : (
                      <span className="font-mono text-xs text-gray-600">—</span>
                    )}
                  </div>

                  <div className="text-right font-mono text-xs text-gray-400">{fmtVol(token.volume24h)}</div>
                  <div className="text-right font-mono text-xs text-gray-500">{fmtVol(token.liquidity)}</div>
                  <div className="text-right text-xs text-gray-400">{token.currentHolders.toLocaleString()}</div>
                  <div className={`text-right font-mono text-xs font-medium ${pctColor}`}>
                    {fmtPct(token.priceChange24h)}
                  </div>
                  <div className="text-right text-xs text-gray-500">{timeAgo(token.createdAt)}</div>

                  <div className="flex justify-center gap-1.5">
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('send-to-analyzer', { detail: token.address }))
                      }}
                      className="text-gray-600 hover:text-orange-500 transition-colors"
                      title="Analizuj w Insider Analyzer"
                    >
                      <Crosshair size={12} />
                    </button>
                    <a
                      href={token.gmgnUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-orange-500 transition-colors"
                      title="GMGN"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
