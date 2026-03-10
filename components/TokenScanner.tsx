'use client'

import { useState, useMemo } from 'react'
import { Search, ExternalLink, Loader2, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react'

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

// ── types ────────────────────────────────────────────────────────────────────

interface ScannedToken {
  address: string
  name: string
  symbol: string
  logo: string
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

type SortKey = 'currentMcap' | 'currentHolders' | 'volume24h' | 'liquidity' | 'swaps24h' | 'priceChange24h' | 'createdAt'

const AGE_OPTIONS = [
  { value: 'any', label: 'Dowolny' },
  { value: '1h', label: '1 godzina' },
  { value: '6h', label: '6 godzin' },
  { value: '12h', label: '12 godzin' },
  { value: '1d', label: '1 dzień' },
  { value: '7d', label: '7 dni' },
  { value: '30d', label: '30 dni' },
  { value: '90d', label: '90 dni' },
  { value: '180d', label: '180 dni' },
  { value: '365d', label: '365 dni' },
]

const ORDER_OPTIONS = [
  { value: 'market_cap', label: 'Market Cap' },
  { value: 'volume', label: 'Wolumen' },
  { value: 'swaps', label: 'Liczba swapów' },
  { value: 'holder_count', label: 'Holderzy' },
  { value: 'price_change_percent', label: 'Zmiana ceny %' },
]

// ── Filter input ────────────────────────────────────────────────────────────

function FilterInput({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 999_999_999,
  format,
}: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  format?: (v: number) => string
}) {
  const display = format ? format(value) : fmtVol(value)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-400">{label}</label>
        <span className="text-xs font-mono font-semibold text-gray-200">{display}</span>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
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
  const [minMcap, setMinMcap] = useState(0)
  const [maxMcap, setMaxMcap] = useState(100_000_000)
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

  // Local sort state (post-fetch re-sorting)
  const [sortKey, setSortKey] = useState<SortKey>('currentMcap')
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
    return <span className="text-orange-500 ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setTokens([])
    setHasSearched(true)

    try {
      const params = new URLSearchParams({
        minMcap: String(minMcap),
        maxMcap: String(maxMcap),
        minHolders: String(minHolders),
        minVolume24h: String(minVolume24h),
        minLiquidity: String(minLiquidity),
        maxAge,
        orderBy,
        sortDir: sortDirApi,
      })

      const res = await fetch(`/api/token-scanner?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as Record<string, string>).error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      setTokens(data.tokens ?? [])
      setTotal(data.total ?? 0)
      setScanned(data.scanned ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nieznany błąd')
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
          <FilterInput
            label="MIN Market Cap"
            description="Minimalna obecna kapitalizacja"
            value={minMcap}
            onChange={setMinMcap}
          />
          <FilterInput
            label="MAX Market Cap"
            description="Maksymalna obecna kapitalizacja"
            value={maxMcap}
            onChange={setMaxMcap}
          />
          <FilterInput
            label="MIN Wolumen 24h"
            description="Minimalny wolumen z ostatnich 24h"
            value={minVolume24h}
            onChange={setMinVolume24h}
          />
          <FilterInput
            label="MIN Liquidity"
            description="Minimalna płynność (USD)"
            value={minLiquidity}
            onChange={setMinLiquidity}
          />
          <FilterInput
            label="MIN Holders"
            description="Minimalna liczba holderów"
            value={minHolders}
            onChange={setMinHolders}
            format={v => v.toLocaleString()}
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Wiek tokena (max)</label>
            <select
              value={maxAge}
              onChange={e => setMaxAge(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-700 rounded-lg bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            >
              {AGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500">Token powstał nie wcześniej niż wybrany okres temu</p>
          </div>
        </div>

        {/* Order / Sort */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-400">Sortuj według</label>
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
              <option value="desc">Malejąco</option>
              <option value="asc">Rosnąco</option>
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
              Skanowanie tokenów…
            </>
          ) : (
            <>
              <Search size={16} />
              Szukaj tokenów
            </>
          )}
        </button>
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
          <p className="text-gray-400 text-sm">Brak tokenów spełniających wszystkie kryteria.</p>
          <p className="text-gray-500 text-xs mt-1">Spróbuj zmienić filtry — zwiększ MAX Market Cap lub zmniejsz MIN wartości.</p>
        </div>
      )}

      {/* ── Results table ── */}
      {!loading && tokens.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            Znaleziono <span className="font-semibold text-gray-300">{total}</span> tokenów
            {' '}(przeskanowano <span className="font-semibold text-gray-300">{scanned}</span>)
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-[28px_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_36px] gap-1.5 items-center px-3 py-2 bg-gray-950 border-b border-gray-800 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
              <div>#</div>
              <div>Token</div>
              <button className="text-right flex items-center justify-end gap-0.5 hover:text-gray-300 transition-colors" onClick={() => handleSort('currentMcap')}>
                Mcap{sortIcon('currentMcap')}
              </button>
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

              return (
                <div
                  key={token.address}
                  className="grid grid-cols-[28px_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_36px] gap-1.5 items-center px-3 py-2.5 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/50 transition-colors text-sm"
                >
                  <div className="text-xs text-gray-600 font-mono">{idx + 1}</div>

                  {/* Token */}
                  <div className="flex items-center gap-2 min-w-0">
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
                    {token.launchpad && (
                      <span className="text-[8px] px-1 py-0.5 rounded bg-gray-800 text-gray-500 shrink-0 hidden lg:inline">
                        {token.launchpad}
                      </span>
                    )}
                  </div>

                  <div className="text-right font-mono text-xs text-gray-300 font-semibold">{fmtMcap(token.currentMcap)}</div>
                  <div className="text-right font-mono text-xs text-gray-400">{fmtVol(token.volume24h)}</div>
                  <div className="text-right font-mono text-xs text-gray-500">{fmtVol(token.liquidity)}</div>
                  <div className="text-right text-xs text-gray-400">{token.currentHolders.toLocaleString()}</div>
                  <div className={`text-right font-mono text-xs font-medium ${pctColor}`}>
                    {fmtPct(token.priceChange24h)}
                  </div>
                  <div className="text-right text-xs text-gray-500">{timeAgo(token.createdAt)}</div>

                  <div className="flex justify-center gap-1">
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
