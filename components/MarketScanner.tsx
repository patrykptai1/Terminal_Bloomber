'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { ScanToken } from '@/app/api/scan/route'
import { addTokenToWatch, isTokenWatched } from '@/lib/tokenBook'

interface MarketScannerProps {
  onAnalyzeToken: (address: string) => void
}

const PERIODS = [
  { value: 1,   label: '1d' },
  { value: 5,   label: '5d' },
  { value: 10,  label: '10d' },
  { value: 30,  label: '30d' },
  { value: 60,  label: '60d' },
  { value: 120, label: '120d' },
  { value: 180, label: '180d' },
]

const MIN_GAIN_OPTIONS = [
  { value: 500,   label: '5x+' },
  { value: 1000,  label: '10x+' },
  { value: 2000,  label: '20x+' },
  { value: 5000,  label: '50x+' },
  { value: 10000, label: '100x+' },
]

function formatMcap(usd: number) {
  if (!usd || usd <= 0) return 'N/A'
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`
  return `$${usd.toFixed(0)}`
}

function formatGain(pct: number) {
  if (pct >= 10000) return `${(pct / 100).toFixed(0)}x`
  if (pct >= 1000) return `${(pct / 100).toFixed(1)}x`
  return `+${pct.toFixed(0)}%`
}

function formatAge(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export default function MarketScanner({ onAnalyzeToken }: MarketScannerProps) {
  const [period, setPeriod] = useState(1)
  const [minGain, setMinGain] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [tokens, setTokens] = useState<ScanToken[]>([])
  const [scannedTotal, setScannedTotal] = useState(0)
  const [scanned, setScanned] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const runScan = async () => {
    setLoading(true)
    setError(null)
    setTokens([])
    setScanned(false)

    try {
      const res = await fetch(`/api/scan?period=${period}&minGain=${minGain}`)
      if (!res.ok) throw new Error('Scan failed')
      const data = await res.json()
      setTokens(data.tokens)
      setScannedTotal(data.scannedTotal)
      setScanned(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const copyAddress = (addr: string) => {
    const fallback = () => {
      const el = document.createElement('textarea')
      el.value = addr; el.style.position = 'fixed'; el.style.opacity = '0'
      document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(addr).catch(fallback)
    } else {
      fallback()
    }
    setCopied(addr)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">

          {/* Period selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-medium">Time Period</label>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    period === p.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Min gain selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-500 font-medium">Min Gain</label>
            <div className="flex gap-1">
              {MIN_GAIN_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setMinGain(o.value)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    minGain === o.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scan button */}
          <button
            onClick={runScan}
            disabled={loading}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Scanning...
              </>
            ) : (
              'Scan'
            )}
          </button>
        </div>

        {/* Info row */}
        <p className="text-xs text-gray-500">
          Scans tokens launched in the last <span className="text-gray-700">{period === 1 ? '24 hours' : `${period} days`}</span> with at least <span className="text-gray-700">{formatGain(minGain)}</span> gain since launch · Data from GMGN
        </p>
      </div>

      {/* ── Loading spinner ── */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-orange-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-gray-600 text-sm">Scanning GMGN for top gainers...</p>
          <p className="text-gray-500 text-xs">Fetching top {period <= 1 ? 1 : period <= 5 ? 2 : period <= 10 ? 3 : period <= 30 ? 5 : 8} pages of token rankings</p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* ── Results ── */}
      {scanned && !loading && (
        <>
          {/* Summary */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              Found <span className="text-orange-600 font-bold text-base">{tokens.length}</span> tokens
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500">
              Scanned {scannedTotal} tokens from GMGN · Period: last {period === 1 ? '24h' : `${period}d`} · Min gain: {formatGain(minGain)}
            </span>
          </div>

          {tokens.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-gray-500">
              No tokens found matching the criteria. Try a longer period or lower minimum gain.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">#</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Token</th>
                    <th className="text-right px-3 py-2.5 text-gray-400 font-medium text-xs">Gain</th>
                    <th className="text-right px-3 py-2.5 text-gray-400 font-medium text-xs">Mcap</th>
                    <th className="text-right px-3 py-2.5 text-gray-400 font-medium text-xs">Volume 24h</th>
                    <th className="text-right px-3 py-2.5 text-gray-400 font-medium text-xs">Holders</th>
                    <th className="text-right px-3 py-2.5 text-gray-400 font-medium text-xs">Age</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Address</th>
                    <th className="text-center px-3 py-2.5 text-gray-400 font-medium text-xs">Links</th>
                    <th className="text-center px-3 py-2.5 text-gray-400 font-medium text-xs">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tokens.map((t, idx) => {
                    const gainX = t.priceChangePercent / 100
                    const isHuge = gainX >= 100
                    const isBig = gainX >= 10

                    return (
                      <tr key={t.address} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{idx + 1}</td>

                        {/* Token name */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {t.logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.logo} alt="" className="w-6 h-6 rounded-full shrink-0 bg-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); addTokenToWatch(t.address, t.symbol, t.name, t.logo) }}
                              className={`transition-colors ${isTokenWatched(t.address) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}
                              title={isTokenWatched(t.address) ? 'Obserwowany' : 'Dodaj do obserwowanych'}
                            >
                              <Star size={11} fill={isTokenWatched(t.address) ? 'currentColor' : 'none'} />
                            </button>
                            <div>
                              <div className="font-semibold text-gray-800">{t.symbol}</div>
                              <div className="text-xs text-gray-500 truncate max-w-[120px]">{t.name}</div>
                            </div>
                          </div>
                          {t.launchpad && (
                            <div className="text-[10px] text-gray-400 mt-0.5 ml-8">{t.launchpad}</div>
                          )}
                        </td>

                        {/* Gain */}
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-bold font-mono ${isHuge ? 'text-orange-600' : isBig ? 'text-emerald-700' : 'text-yellow-600'}`}>
                            {formatGain(t.priceChangePercent)}
                          </span>
                        </td>

                        {/* Mcap */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs">
                          {formatMcap(t.marketCap)}
                        </td>

                        {/* Volume */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-500 text-xs">
                          {formatMcap(t.volume)}
                        </td>

                        {/* Holders */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-500 text-xs">
                          {t.holderCount > 0 ? t.holderCount.toLocaleString() : '—'}
                        </td>

                        {/* Age */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-500 text-xs">
                          {formatAge(t.ageHours)}
                        </td>

                        {/* Address */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-blue-600">{shortenAddress(t.address)}</span>
                            <button
                              onClick={() => copyAddress(t.address)}
                              className="text-gray-400 hover:text-gray-700 text-xs transition-colors"
                              title="Copy address"
                            >
                              {copied === t.address ? '✓' : '⧉'}
                            </button>
                          </div>
                        </td>

                        {/* Links */}
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center gap-1">
                            <a
                              href={`https://dexscreener.com/solana/${t.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded border border-gray-200 transition-colors"
                            >
                              DEX
                            </a>
                            <a
                              href={`https://gmgn.ai/sol/token/${t.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded border border-gray-200 transition-colors"
                            >
                              GMGN
                            </a>
                          </div>
                        </td>

                        {/* Analyze button */}
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => onAnalyzeToken(t.address)}
                            className="text-xs px-2.5 py-1 bg-orange-100 hover:bg-orange-500 text-orange-700 hover:text-white border border-orange-300 hover:border-orange-500 rounded transition-colors font-medium whitespace-nowrap"
                          >
                            Analyze Wallets
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
