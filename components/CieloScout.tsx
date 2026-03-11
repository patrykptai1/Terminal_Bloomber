'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Eye, Loader2, AlertTriangle, ArrowUpRight, RefreshCw, Star,
  ExternalLink, Copy, Check, Zap, TrendingUp, Users, Clock,
  ChevronDown, ChevronRight, Filter,
} from 'lucide-react'

// ━━━ TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CieloTx {
  tx_hash: string
  timestamp: number
  wallet: string
  token_address: string
  token_symbol: string
  token_name: string
  tx_type: string
  is_buy: boolean
  amount_token: number
  amount_usd: number
  price_usd: number
  chain: string
  first_interaction: boolean
  token_logo?: string
  dex?: string
  sold_token_symbol?: string
  sold_amount_usd?: number
}

interface ConvergenceToken {
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  firstBuyerCount: number
  totalUsd: number
  wallets: string[]
  latestTx: CieloTx
}

interface ScoutResult {
  transactions: CieloTx[]
  firstBuyers: CieloTx[]
  convergence: ConvergenceToken[]
  walletCount: number
  chain: string
  updatedAt: number
  error?: string
}

interface FeedResult {
  items: CieloTx[]
  count: number
  chain: string
  updatedAt: number
  error?: string
}

// ━━━ HELPERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WK = 'smwd_wallet_book'

function loadWalletBook(): Array<{ address: string; label: string }> {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(WK)
    if (!raw) return []
    return JSON.parse(raw) as Array<{ address: string; label: string }>
  } catch { return [] }
}

function shortAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  if (v >= 1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(6)}`
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return 'teraz'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m temu`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h temu`
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ━━━ SHARED UI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <button onClick={copy} className="text-gray-400 hover:text-orange-500 transition-colors" title="Kopiuj CA">
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
      accent ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
    }`}>
      <div className={`p-2 rounded-lg ${accent ? 'bg-orange-100' : 'bg-gray-100'}`}>
        <Icon size={14} className={accent ? 'text-orange-600' : 'text-gray-500'} />
      </div>
      <div>
        <div className={`text-lg font-bold leading-tight ${accent ? 'text-orange-600' : 'text-gray-900'}`}>
          {value}
        </div>
        <div className="text-[11px] text-gray-500">{label}</div>
      </div>
    </div>
  )
}

function TokenLink({ address, symbol }: { address: string; symbol: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-semibold text-gray-900">{symbol}</span>
      <CopyButton text={address} />
      <a
        href={`https://gmgn.ai/sol/token/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-orange-500 hover:text-orange-600"
        title="GMGN"
      >
        <ExternalLink size={10} />
      </a>
    </span>
  )
}

function EmptyState({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
        <Icon size={20} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{subtitle}</p>
    </div>
  )
}

function LoadingPulse() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100" />)}
      </div>
      <div className="h-48 rounded-xl bg-gray-100" />
    </div>
  )
}

// ━━━ SUBTAB: SCOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ScoutTab() {
  const [wallets, setWallets] = useState<Array<{ address: string; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScoutResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [minUsd, setMinUsd] = useState(100)
  const [limit, setLimit] = useState(100)
  const [showFilters, setShowFilters] = useState(false)
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set())

  useEffect(() => {
    setWallets(loadWalletBook())
  }, [])

  const runScout = useCallback(async () => {
    if (wallets.length === 0) {
      setError('Brak walletów w My Wallets. Dodaj wallety smart money.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const addrs = wallets.map(w => w.address).join(',')
      const res = await fetch(
        `/api/cielo-scout?wallets=${addrs}&chain=solana&limit=${limit}&minUsd=${minUsd}`,
      )
      const data = (await res.json()) as ScoutResult

      if (data.error && !data.transactions?.length) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd sieciowy')
    } finally {
      setLoading(false)
    }
  }, [wallets, minUsd, limit])

  const walletLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of wallets) map.set(w.address, w.label)
    return map
  }, [wallets])

  const toggleToken = (addr: string) => {
    setExpandedTokens(prev => {
      const next = new Set(prev)
      if (next.has(addr)) next.delete(addr)
      else next.add(addr)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={runScout}
          disabled={loading || wallets.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-all shadow-sm shadow-orange-200"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Skanuj {wallets.length} walletów
        </button>

        <button
          onClick={() => setShowFilters(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-xl border transition-colors ${
            showFilters ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          <Filter size={12} />
          Filtry
          {showFilters ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {result && (
          <span className="ml-auto text-[10px] text-gray-400">
            {new Date(result.updatedAt).toLocaleTimeString('pl-PL')}
          </span>
        )}
      </div>

      {/* ── Filters (collapsible) ── */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 p-3 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Min USD</label>
            <input
              type="number"
              value={minUsd}
              onChange={e => setMinUsd(Number(e.target.value))}
              className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:border-orange-300 focus:outline-none transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Max TX</label>
            <input
              type="number"
              value={limit}
              onChange={e => setLimit(Math.min(200, Number(e.target.value)))}
              className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:border-orange-300 focus:outline-none transition"
            />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <LoadingPulse />}

      {/* ── Results ── */}
      {result && !result.error && !loading && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Transakcje" value={result.transactions.length} icon={TrendingUp} />
            <StatCard label="First Buys" value={result.firstBuyers.length} icon={Star} accent={result.firstBuyers.length > 0} />
            <StatCard label="Convergence" value={result.convergence.length} icon={Users} accent={result.convergence.length > 0} />
          </div>

          {/* ── Convergence tokens ── */}
          {result.convergence.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Star size={14} className="text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-800">Convergence Tokens</h3>
                <span className="ml-auto text-[10px] text-gray-400">
                  Ten sam token kupowany przez wielu walletów
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {result.convergence.map(token => (
                  <div key={token.tokenAddress} className="px-4 py-3 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Token info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TokenLink address={token.tokenAddress} symbol={token.tokenSymbol} />
                          <span className="text-xs text-gray-400 truncate">{token.tokenName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                          {shortAddr(token.tokenAddress)}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">{fmtUsd(token.totalUsd)}</div>
                          <div className="text-[10px] text-gray-400">total</div>
                        </div>
                        <div className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg text-center">
                          <div className="text-sm font-bold leading-tight">{token.firstBuyerCount}</div>
                          <div className="text-[9px] leading-tight">buyers</div>
                        </div>
                      </div>
                    </div>

                    {/* Wallets */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {token.wallets.map(w => (
                        <span
                          key={w}
                          className="px-2 py-0.5 bg-gray-100 rounded-md text-[10px] text-gray-600 font-mono"
                          title={walletLabelMap.get(w) ?? w}
                        >
                          {walletLabelMap.get(w) || shortAddr(w)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── All first buys ── */}
          {result.firstBuyers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Zap size={14} className="text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-800">First Buys</h3>
                <span className="text-xs text-gray-400 ml-1">({result.firstBuyers.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[11px] text-gray-400 uppercase tracking-wider">
                      <th className="text-left py-2.5 px-4 font-medium">Czas</th>
                      <th className="text-left py-2.5 px-4 font-medium">Wallet</th>
                      <th className="text-left py-2.5 px-4 font-medium">Token</th>
                      <th className="text-right py-2.5 px-4 font-medium">Wartość</th>
                      <th className="text-right py-2.5 px-4 font-medium">Cena</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.firstBuyers.map((tx, i) => (
                      <tr key={`${tx.tx_hash}-${i}`} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock size={10} className="text-gray-400" />
                            {fmtTime(tx.timestamp)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-gray-700 text-[11px]" title={tx.wallet}>
                            {walletLabelMap.get(tx.wallet) || shortAddr(tx.wallet)}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <TokenLink address={tx.token_address} symbol={tx.token_symbol} />
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-gray-800">
                          {fmtUsd(tx.amount_usd)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-gray-500">
                          {fmtUsd(tx.price_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── All transactions (collapsible) ── */}
          {result.transactions.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-sm text-gray-600">
                <ChevronRight size={14} className="text-gray-400 group-open:rotate-90 transition-transform" />
                Wszystkie transakcje
                <span className="text-xs text-gray-400">({result.transactions.length})</span>
              </summary>
              <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[11px] text-gray-400 uppercase tracking-wider bg-gray-50">
                        <th className="text-left py-2 px-4 font-medium">Czas</th>
                        <th className="text-left py-2 px-4 font-medium">Wallet</th>
                        <th className="text-center py-2 px-4 font-medium">Typ</th>
                        <th className="text-left py-2 px-4 font-medium">Token</th>
                        <th className="text-right py-2 px-4 font-medium">USD</th>
                        <th className="text-center py-2 px-4 font-medium">1st</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {result.transactions.map((tx, i) => (
                        <tr key={`${tx.tx_hash}-${i}`} className="hover:bg-gray-50/70">
                          <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{fmtTime(tx.timestamp)}</td>
                          <td className="py-2 px-4 font-mono text-gray-700 text-[11px]">
                            {walletLabelMap.get(tx.wallet) || shortAddr(tx.wallet)}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              tx.is_buy
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-600'
                            }`}>
                              {tx.is_buy ? 'BUY' : 'SELL'}
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <TokenLink address={tx.token_address} symbol={tx.token_symbol} />
                          </td>
                          <td className="py-2 px-4 text-right font-medium text-gray-800">{fmtUsd(tx.amount_usd)}</td>
                          <td className="py-2 px-4 text-center">
                            {tx.first_interaction && (
                              <span className="inline-block w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold leading-5">
                                1
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}

          {/* No first buys */}
          {result.firstBuyers.length === 0 && result.transactions.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <Eye size={16} className="text-gray-400 shrink-0" />
              <div>
                <p className="text-sm text-gray-600">
                  <b>{result.transactions.length}</b> transakcji, ale brak first buys
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Spróbuj obniżyć Min USD lub zwiększyć limit TX</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!result && !loading && !error && (
        <EmptyState
          icon={Eye}
          title="Cielo Scout"
          subtitle="Skanuj transakcje walletów z My Wallets i znajdź tokeny kupowane po raz pierwszy (first buys)"
        />
      )}
    </div>
  )
}

// ━━━ SUBTAB: FEED ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function FeedTab() {
  const [wallets, setWallets] = useState<Array<{ address: string; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CieloTx[]>([])
  const [error, setError] = useState<string | null>(null)
  const [minUsd, setMinUsd] = useState(50)
  const [useMyWallets, setUseMyWallets] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filterBuysOnly, setFilterBuysOnly] = useState(false)

  useEffect(() => {
    setWallets(loadWalletBook())
  }, [])

  const fetchFeed = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let url = `/api/cielo-feed?chain=solana&limit=50&minUsd=${minUsd}`
      if (useMyWallets && wallets.length > 0) {
        url += `&wallets=${wallets.map(w => w.address).join(',')}`
      }

      const res = await fetch(url)
      const data = (await res.json()) as FeedResult

      if (data.error && !data.items?.length) {
        setError(data.error)
      } else {
        setItems(data.items ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd sieciowy')
    } finally {
      setLoading(false)
    }
  }, [wallets, minUsd, useMyWallets])

  const walletLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of wallets) map.set(w.address, w.label)
    return map
  }, [wallets])

  const filtered = useMemo(() => {
    if (!filterBuysOnly) return items
    return items.filter(tx => tx.is_buy)
  }, [items, filterBuysOnly])

  const stats = useMemo(() => {
    const buys = items.filter(tx => tx.is_buy)
    const sells = items.filter(tx => !tx.is_buy)
    const firstInteractions = items.filter(tx => tx.first_interaction)
    const totalUsd = items.reduce((s, tx) => s + tx.amount_usd, 0)
    return { buys: buys.length, sells: sells.length, firstInteractions: firstInteractions.length, totalUsd }
  }, [items])

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={fetchFeed}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-all shadow-sm shadow-orange-200"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Pobierz Feed
        </button>

        <button
          onClick={() => setShowFilters(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-xl border transition-colors ${
            showFilters ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          <Filter size={12} />
          Filtry
        </button>
      </div>

      {/* ── Filters ── */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 p-3 bg-white border border-gray-200 rounded-xl">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={useMyWallets}
              onChange={e => setUseMyWallets(e.target.checked)}
              className="accent-orange-500 rounded"
            />
            My Wallets ({wallets.length})
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={filterBuysOnly}
              onChange={e => setFilterBuysOnly(e.target.checked)}
              className="accent-orange-500 rounded"
            />
            Tylko BUY
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Min USD</label>
            <input
              type="number"
              value={minUsd}
              onChange={e => setMinUsd(Number(e.target.value))}
              className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white focus:border-orange-300 focus:outline-none transition"
            />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <LoadingPulse />}

      {/* ── Stats + Table ── */}
      {items.length > 0 && !loading && (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Łącznie" value={fmtUsd(stats.totalUsd)} icon={TrendingUp} />
            <StatCard label="Buys" value={stats.buys} icon={ArrowUpRight} accent={stats.buys > 0} />
            <StatCard label="Sells" value={stats.sells} icon={TrendingUp} />
            <StatCard label="First Touch" value={stats.firstInteractions} icon={Star} accent={stats.firstInteractions > 0} />
          </div>

          {/* Feed table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wider bg-gray-50/80">
                    <th className="text-left py-2.5 px-4 font-medium">Czas</th>
                    <th className="text-left py-2.5 px-4 font-medium">Wallet</th>
                    <th className="text-center py-2.5 px-4 font-medium">Typ</th>
                    <th className="text-left py-2.5 px-4 font-medium">Token</th>
                    <th className="text-right py-2.5 px-4 font-medium">Wartość</th>
                    <th className="text-right py-2.5 px-4 font-medium">Cena</th>
                    <th className="text-center py-2.5 px-4 font-medium">1st</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((tx, i) => (
                    <tr key={`${tx.tx_hash}-${i}`} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock size={10} className="text-gray-300" />
                          {fmtTime(tx.timestamp)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-mono text-gray-700 text-[11px]" title={tx.wallet}>
                          {walletLabelMap.get(tx.wallet) || shortAddr(tx.wallet)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          tx.is_buy
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-600'
                        }`}>
                          {tx.is_buy ? 'BUY' : 'SELL'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <TokenLink address={tx.token_address} symbol={tx.token_symbol} />
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-gray-800">{fmtUsd(tx.amount_usd)}</td>
                      <td className="py-2.5 px-4 text-right text-gray-500">{fmtUsd(tx.price_usd)}</td>
                      <td className="py-2.5 px-4 text-center">
                        {tx.first_interaction && (
                          <span className="inline-block w-5 h-5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold leading-5">
                            1
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {items.length === 0 && !loading && !error && (
        <EmptyState
          icon={ArrowUpRight}
          title="Transaction Feed"
          subtitle="Pobierz live feed transakcji z Cielo Finance — swapy, transfery, first interactions"
        />
      )}
    </div>
  )
}

// ━━━ MAIN COMPONENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SubTab = 'scout' | 'feed'

export default function CieloScout() {
  const [subTab, setSubTab] = useState<SubTab>('scout')

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cielo Scout</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Monitoruj first buys i convergence smart money walletów
          </p>
        </div>

        {/* Sub-tab toggle */}
        <div className="flex p-0.5 bg-gray-100 rounded-lg">
          <button
            onClick={() => setSubTab('scout')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              subTab === 'scout'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye size={12} />
            Scout
          </button>
          <button
            onClick={() => setSubTab('feed')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              subTab === 'feed'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowUpRight size={12} />
            Feed
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className={subTab === 'scout' ? '' : 'hidden'}>
        <ScoutTab />
      </div>
      <div className={subTab === 'feed' ? '' : 'hidden'}>
        <FeedTab />
      </div>
    </div>
  )
}
