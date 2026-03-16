'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, X, RefreshCw, Loader2, ExternalLink, Wallet } from 'lucide-react'
import { loadTokenBook, saveTokenBook, WatchedToken } from '@/lib/tokenBook'
import { loadBook } from '@/lib/walletBook'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtMcap(n: number): string {
  if (!n || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtPrice(n: number): string {
  if (!n || n <= 0) return '—'
  if (n < 0.000001) return `$${n.toExponential(2)}`
  if (n < 0.01) return `$${n.toPrecision(3)}`
  if (n < 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function pctChange(from: number, to: number): { text: string; color: string } {
  if (!from || !to) return { text: '—', color: 'text-gray-500' }
  const pct = ((to - from) / from) * 100
  const sign = pct > 0 ? '+' : ''
  const color = pct > 0 ? 'text-green-500' : pct < 0 ? 'text-red-500' : 'text-gray-500'
  if (Math.abs(pct) >= 10000) return { text: `${sign}${(pct / 100).toFixed(0)}x`, color }
  return { text: `${sign}${pct.toFixed(1)}%`, color }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m temu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h temu`
  return `${Math.floor(hrs / 24)}d temu`
}

interface EnrichedToken extends WatchedToken {
  currentMcap: number
  currentPrice: number
  walletHolders: { address: string; label: string }[]
}

// ── main component ───────────────────────────────────────────────────────────

export default function WatchedTokens() {
  const [tokens, setTokens] = useState<WatchedToken[]>([])
  const [enriched, setEnriched] = useState<EnrichedToken[]>([])
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<number>(0)

  // Load token book + listen for changes
  useEffect(() => {
    setTokens(loadTokenBook())
    const handler = () => setTokens(loadTokenBook())
    window.addEventListener('token-book-updated', handler)
    return () => window.removeEventListener('token-book-updated', handler)
  }, [])

  // Auto-refresh on mount when tokens exist
  useEffect(() => {
    if (tokens.length > 0 && enriched.length === 0 && !loading) {
      refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length])

  const refresh = useCallback(async () => {
    const book = loadTokenBook()
    if (book.length === 0) return
    setLoading(true)

    try {
      // Step 1: Fetch current prices from DexScreener via our API
      const mints = book.map(t => t.mint)
      const batchSize = 30
      const tokenInfoMap = new Map<string, { fdv: number; priceUsd: number }>()

      for (let i = 0; i < mints.length; i += batchSize) {
        const batch = mints.slice(i, i + batchSize)
        try {
          const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`)
          if (res.ok) {
            const data = await res.json()
            const pairs = Array.isArray(data) ? data : data.pairs ?? []
            // Group by base token, pick highest liquidity pair
            const best = new Map<string, Record<string, unknown>>()
            for (const p of pairs) {
              const addr = p.baseToken?.address
              if (!addr) continue
              const existing = best.get(addr)
              const liq = parseFloat(p.liquidity?.usd ?? '0')
              const eLiq = parseFloat((existing?.liquidity as Record<string, string>)?.usd ?? '0')
              if (!existing || liq > eLiq) best.set(addr, p)
            }
            for (const [addr, p] of best) {
              tokenInfoMap.set(addr, {
                fdv: (p.fdv as number) ?? 0,
                priceUsd: parseFloat((p.priceUsd as string) ?? '0'),
              })
            }
          }
        } catch { /* skip batch */ }
        if (i + batchSize < mints.length) await new Promise(r => setTimeout(r, 300))
      }

      // Step 2: Check which of user's wallets hold each token
      const wallets = loadBook()
      const walletHoldingsMap = new Map<string, { address: string; label: string }[]>()

      if (wallets.length > 0) {
        // Fetch positions for each wallet (max 5 concurrent)
        const CONCURRENT = 5
        for (let i = 0; i < wallets.length; i += CONCURRENT) {
          const batch = wallets.slice(i, i + CONCURRENT)
          const results = await Promise.allSettled(
            batch.map(async w => {
              const res = await fetch(`/api/wallet-positions?addresses=${w.address}`)
              if (!res.ok) return null
              const data = await res.json()
              return { wallet: w, data }
            })
          )

          for (const result of results) {
            if (result.status !== 'fulfilled' || !result.value) continue
            const { wallet, data } = result.value
            const walletResults = data.wallets ?? []
            for (const wr of walletResults) {
              for (const pos of (wr.positions ?? [])) {
                const mint = pos.tokenAddress
                if (!mints.includes(mint)) continue
                if (!walletHoldingsMap.has(mint)) walletHoldingsMap.set(mint, [])
                const arr = walletHoldingsMap.get(mint)!
                if (!arr.some(x => x.address === wallet.address)) {
                  arr.push({ address: wallet.address, label: wallet.label || wallet.address.slice(0, 6) })
                }
              }
            }
          }
        }
      }

      // Step 3: Merge
      const enrichedResult: EnrichedToken[] = book.map(t => {
        const info = tokenInfoMap.get(t.mint)
        return {
          ...t,
          currentMcap: info?.fdv ?? 0,
          currentPrice: info?.priceUsd ?? 0,
          walletHolders: walletHoldingsMap.get(t.mint) ?? [],
        }
      })

      setEnriched(enrichedResult)
      setLastRefresh(Date.now())
    } catch (e) {
      console.error('WatchedTokens refresh error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const removeToken = (mint: string) => {
    const updated = tokens.filter(t => t.mint !== mint)
    saveTokenBook(updated)
    setEnriched(prev => prev.filter(t => t.mint !== mint))
  }

  // Display data: use enriched if available, otherwise raw tokens
  const displayTokens = enriched.length > 0 ? enriched : tokens.map(t => ({
    ...t,
    currentMcap: 0,
    currentPrice: 0,
    walletHolders: [] as { address: string; label: string }[],
  }))

  return (
    <div className="space-y-5">
      {/* Header + refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-500" />
          <span className="text-sm font-semibold text-gray-700">
            {tokens.length} {tokens.length === 1 ? 'token' : 'tokenow'} obserwowanych
          </span>
          {lastRefresh > 0 && (
            <span className="text-[10px] text-gray-400 ml-2">
              Odswiezono {timeAgo(lastRefresh)}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading || tokens.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loading ? 'Odswiezanie...' : 'Odswiez'}
        </button>
      </div>

      {/* Empty state */}
      {tokens.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Star size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Brak obserwowanych tokenow.</p>
          <p className="text-gray-400 text-xs mt-1">
            Kliknij gwiazdke przy tokenie w dowolnej zakladce aby dodac go tutaj.
          </p>
        </div>
      )}

      {/* Token cards */}
      {displayTokens.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayTokens.map(token => {
            const mcapChange = pctChange(token.mcapAtAdd, token.currentMcap)
            const priceChange = pctChange(token.priceAtAdd, token.currentPrice)

            return (
              <div
                key={token.mint}
                className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 hover:border-gray-300 transition-colors"
              >
                {/* Row 1: Token header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {token.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={token.logo}
                        alt=""
                        className="w-7 h-7 rounded-full bg-gray-100 shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">
                        {token.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-gray-900 truncate">{token.symbol}</span>
                        <a
                          href={`https://gmgn.ai/sol/token/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-orange-500"
                        >
                          <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{token.name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeToken(token.mint)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    title="Usun z obserwowanych"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Row 2: Mcap comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Mcap przy dodaniu</div>
                    <div className="text-sm font-semibold text-gray-600">{fmtMcap(token.mcapAtAdd)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Obecna mcap</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900">{fmtMcap(token.currentMcap)}</span>
                      {token.currentMcap > 0 && (
                        <span className={`text-xs font-medium ${mcapChange.color}`}>{mcapChange.text}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 3: Price comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Cena przy dodaniu</div>
                    <div className="text-xs font-mono text-gray-500">{fmtPrice(token.priceAtAdd)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Obecna cena</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-gray-700">{fmtPrice(token.currentPrice)}</span>
                      {token.currentPrice > 0 && (
                        <span className={`text-[10px] font-medium ${priceChange.color}`}>{priceChange.text}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 4: Wallet holders */}
                {token.walletHolders.length > 0 && (
                  <div className="border-t border-gray-100 pt-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Wallet size={10} className="text-gray-400" />
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                        Twoje wallety ({token.walletHolders.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {token.walletHolders.map(w => (
                        <span
                          key={w.address}
                          className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-200 font-medium"
                        >
                          {w.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Row 5: Added date */}
                <div className="text-[9px] text-gray-400">
                  Dodano {new Date(token.addedAt).toLocaleDateString('pl-PL')} · {timeAgo(token.addedAt)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
