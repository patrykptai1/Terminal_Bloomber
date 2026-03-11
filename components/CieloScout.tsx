'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Eye, Loader2, AlertTriangle, ArrowUpRight, RefreshCw, Star,
  ExternalLink, Copy, Check,
} from 'lucide-react'

// ━━━ TYPES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CieloTx {
  tx_hash: string
  timestamp: number
  wallet: string
  token_address: string
  token_symbol: string
  token_name: string
  action: string
  amount_token: number
  amount_usd: number
  price_usd: number
  chain: string
  first_interaction: boolean
  token_logo?: string
  dex?: string
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])
  return (
    <button onClick={copy} className="text-gray-400 hover:text-orange-500 transition-colors" title="Kopiuj">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runScout}
          disabled={loading || wallets.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          Scout ({wallets.length} walletów)
        </button>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Min USD:</span>
          <input
            type="number"
            value={minUsd}
            onChange={e => setMinUsd(Number(e.target.value))}
            className="w-20 px-2 py-1 border border-gray-200 rounded text-xs bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Limit TX:</span>
          <input
            type="number"
            value={limit}
            onChange={e => setLimit(Math.min(200, Number(e.target.value)))}
            className="w-20 px-2 py-1 border border-gray-200 rounded text-xs bg-white"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* No API key warning */}
      {!error && result?.error?.includes('not configured') && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
          <AlertTriangle size={14} />
          Brak CIELO_API_KEY w .env.local — dodaj klucz z app.cielo.finance
        </div>
      )}

      {/* Results */}
      {result && !result.error && (
        <div className="space-y-5">
          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>Transakcje: <b className="text-gray-700">{result.transactions.length}</b></span>
            <span>First Buyers: <b className="text-orange-600">{result.firstBuyers.length}</b></span>
            <span>Convergence Tokens: <b className="text-orange-600">{result.convergence.length}</b></span>
          </div>

          {/* ── Convergence tokens ── */}
          {result.convergence.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Star size={14} className="text-orange-500" />
                Convergence — tokeny kupowane przez wielu walletów po raz pierwszy
              </h3>
              <div className="space-y-2">
                {result.convergence.map(token => (
                  <div
                    key={token.tokenAddress}
                    className="p-3 bg-orange-50/50 border border-orange-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{token.tokenSymbol}</span>
                        <span className="text-xs text-gray-500">{token.tokenName}</span>
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded">
                          {token.firstBuyerCount} first buyers
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{fmtUsd(token.totalUsd)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1">
                      <span className="font-mono">{shortAddr(token.tokenAddress)}</span>
                      <CopyButton text={token.tokenAddress} />
                      <a
                        href={`https://gmgn.ai/sol/token/${token.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:text-orange-600"
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      {token.wallets.map(w => (
                        <span
                          key={w}
                          className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-600 font-mono"
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

          {/* ── First buyers list ── */}
          {result.firstBuyers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Wszystkie First Buys ({result.firstBuyers.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="text-left py-1.5 pr-3 font-medium">Czas</th>
                      <th className="text-left py-1.5 pr-3 font-medium">Wallet</th>
                      <th className="text-left py-1.5 pr-3 font-medium">Token</th>
                      <th className="text-right py-1.5 pr-3 font-medium">USD</th>
                      <th className="text-right py-1.5 font-medium">Cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.firstBuyers.map((tx, i) => (
                      <tr key={`${tx.tx_hash}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{fmtTime(tx.timestamp)}</td>
                        <td className="py-1.5 pr-3">
                          <span className="font-mono text-gray-700" title={tx.wallet}>
                            {walletLabelMap.get(tx.wallet) || shortAddr(tx.wallet)}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-gray-900">{tx.token_symbol}</span>
                            <CopyButton text={tx.token_address} />
                            <a
                              href={`https://gmgn.ai/sol/token/${tx.token_address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-500 hover:text-orange-600"
                            >
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </td>
                        <td className="py-1.5 pr-3 text-right font-medium text-gray-700">{fmtUsd(tx.amount_usd)}</td>
                        <td className="py-1.5 text-right text-gray-500">{fmtUsd(tx.price_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No results */}
          {result.firstBuyers.length === 0 && result.transactions.length > 0 && (
            <div className="text-center py-6 text-gray-400 text-sm">
              {result.transactions.length} transakcji, ale brak first_interaction — spróbuj obniżyć Min USD
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Kliknij <b>Scout</b> aby przeskanować transakcje Twoich walletów z Cielo Finance
        </div>
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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={fetchFeed}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Pobierz Feed
        </button>

        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={useMyWallets}
            onChange={e => setUseMyWallets(e.target.checked)}
            className="accent-orange-500"
          />
          Tylko My Wallets ({wallets.length})
        </label>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Min USD:</span>
          <input
            type="number"
            value={minUsd}
            onChange={e => setMinUsd(Number(e.target.value))}
            className="w-20 px-2 py-1 border border-gray-200 rounded text-xs bg-white"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Feed table */}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="text-left py-1.5 pr-3 font-medium">Czas</th>
                <th className="text-left py-1.5 pr-3 font-medium">Wallet</th>
                <th className="text-left py-1.5 pr-3 font-medium">Akcja</th>
                <th className="text-left py-1.5 pr-3 font-medium">Token</th>
                <th className="text-right py-1.5 pr-3 font-medium">USD</th>
                <th className="text-right py-1.5 pr-3 font-medium">Cena</th>
                <th className="text-center py-1.5 font-medium">1st</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx, i) => (
                <tr key={`${tx.tx_hash}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{fmtTime(tx.timestamp)}</td>
                  <td className="py-1.5 pr-3">
                    <span className="font-mono text-gray-700" title={tx.wallet}>
                      {walletLabelMap.get(tx.wallet) || shortAddr(tx.wallet)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        tx.action === 'buy'
                          ? 'bg-green-50 text-green-700'
                          : tx.action === 'sell'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tx.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-gray-900">{tx.token_symbol}</span>
                      <CopyButton text={tx.token_address} />
                      <a
                        href={`https://gmgn.ai/sol/token/${tx.token_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-500 hover:text-orange-600"
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-medium text-gray-700">{fmtUsd(tx.amount_usd)}</td>
                  <td className="py-1.5 pr-3 text-right text-gray-500">{fmtUsd(tx.price_usd)}</td>
                  <td className="py-1.5 text-center">
                    {tx.first_interaction && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded">
                        1st
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-gray-400 text-sm">
          Kliknij <b>Pobierz Feed</b> aby zobaczyć ostatnie transakcje z Cielo Finance
        </div>
      )}
    </div>
  )
}

// ━━━ MAIN COMPONENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SubTab = 'scout' | 'feed'

export default function CieloScout() {
  const [subTab, setSubTab] = useState<SubTab>('scout')

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setSubTab('scout')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'scout'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Eye size={13} />
            Scout
          </span>
        </button>
        <button
          onClick={() => setSubTab('feed')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'feed'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ArrowUpRight size={13} />
            Feed
          </span>
        </button>
      </div>

      {/* Content */}
      <div className={subTab === 'scout' ? '' : 'hidden'}>
        <ScoutTab />
      </div>
      <div className={subTab === 'feed' ? '' : 'hidden'}>
        <FeedTab />
      </div>
    </div>
  )
}
