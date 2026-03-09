'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronRight, BookmarkPlus, BookmarkCheck, Copy, Check, ExternalLink, Trophy, Zap, TrendingUp, Crown, Loader2, History } from 'lucide-react'
import { addToBook, removeFromBook, isInBook } from '@/lib/walletBook'

// ── Types matching API response ────────────────────────────────────────

interface TokenHit {
  mint: string
  symbol: string
  entryMcapUsd: number
  currentMcapUsd: number
  totalCostUsd: number
  realizedPnlUsd: number
  unrealizedPnlUsd: number
  buyCount: number
  sellCount: number
  tags: string[]
  holdingSince: number | null
}

interface InsiderWallet {
  address: string
  tokensHit: number
  tokens: TokenHit[]
  totalRealizedPnl: number
  totalUnrealizedPnl: number
  avgEntryMcap: number
  solBalanceUsd: number
  insiderScore: number
  walletType: 'HOLDER' | 'TRADER'
  tags: string[]
  labels: string[]
}

interface AnalyzerResponse {
  wallets: InsiderWallet[]
  processedTokens: number
  totalEarlyBuyers: number
  elapsedMs: number
  errors: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-700 bg-emerald-50 border-emerald-300'
  if (score >= 45) return 'text-amber-700 bg-amber-50 border-amber-300'
  return 'text-gray-600 bg-gray-50 border-gray-300'
}

function pnlColor(n: number): string {
  return n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-500' : 'text-gray-500'
}

function tokenEarlyLabel(entryMcap: number, currentMcap: number): { text: string; bg: string } | null {
  if (entryMcap <= 0 || currentMcap <= 0) return null
  const ratio = entryMcap / currentMcap
  if (ratio <= 0.01) return { text: 'SNIPER', bg: 'bg-purple-100 text-purple-700' }
  if (ratio <= 0.05) return { text: 'VERY EARLY', bg: 'bg-emerald-100 text-emerald-700' }
  if (ratio <= 0.15) return { text: 'EARLY', bg: 'bg-sky-100 text-sky-700' }
  return null
}

const LABEL_STYLES: Record<string, string> = {
  'MULTI-TOKEN': 'bg-indigo-100 text-indigo-700 border-indigo-300',
  'WHALE PROFIT': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  'HIGH PROFIT': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'PROFIT': 'bg-green-50 text-green-600 border-green-200',
  'SNIPER': 'bg-purple-100 text-purple-700 border-purple-300',
  'VERY EARLY': 'bg-teal-100 text-teal-700 border-teal-300',
  'EARLY': 'bg-sky-100 text-sky-700 border-sky-300',
  'CONSISTENT': 'bg-blue-100 text-blue-700 border-blue-300',
  'DIAMOND HANDS': 'bg-orange-100 text-orange-700 border-orange-300',
}

interface GmgnTrade {
  timestamp: number
  type: 'buy' | 'sell'
  tokenAmount: number
  quoteAmount: number
  priceUsd: number
  costUsd: number
  txHash: string
  mcapUsd: number
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(6)
}

// ── Trade History Component (auto-loads on mount) ───────────────────

function TradeHistory({ wallet, tokens }: { wallet: string; tokens: TokenHit[] }) {
  const [trades, setTrades] = useState<Record<string, GmgnTrade[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedToken, setExpandedToken] = useState<Set<string>>(new Set())

  const fetchTrades = useCallback(async () => {
    if (trades) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wallet-token-trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, mints: tokens.map(t => t.mint) }),
      })
      if (!res.ok) throw new Error('Failed to fetch trades')
      const data = await res.json()
      setTrades(data.trades)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [wallet, tokens, trades])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  const toggleToken = (mint: string) => {
    setExpandedToken(prev => {
      const next = new Set(prev)
      next.has(mint) ? next.delete(mint) : next.add(mint)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 py-2">
          <Loader2 size={12} className="animate-spin" />
          Laduje historie transakcji...
        </div>
      )}

      {error && <p className="text-[11px] text-red-500 py-1">{error}</p>}

      {trades && tokens.map(token => {
        const tokenTrades = trades[token.mint] ?? []
        const buys = tokenTrades.filter(t => t.type === 'buy')
        const sells = tokenTrades.filter(t => t.type === 'sell')
        const firstBuy = buys[0]
        const lastSell = sells[sells.length - 1]
        const totalBuyUsd = buys.reduce((s, t) => s + t.costUsd, 0)
        const totalSellUsd = sells.reduce((s, t) => s + t.costUsd, 0)
        const isOpen = expandedToken.has(token.mint)

        return (
          <div key={token.mint} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div
              className="cursor-pointer hover:bg-gray-50/80 transition-colors"
              onClick={() => toggleToken(token.mint)}
            >
              <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <a
                  href={`https://gmgn.ai/sol/token/${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="font-bold text-xs text-gray-800 hover:text-orange-600"
                >
                  {token.symbol}
                </a>
                {(() => {
                  const earlyLabel = tokenEarlyLabel(token.entryMcapUsd, token.currentMcapUsd)
                  return earlyLabel ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0 rounded ${earlyLabel.bg}`}>
                      {earlyLabel.text}
                    </span>
                  ) : null
                })()}
                {(() => {
                  const multiplier = token.entryMcapUsd > 0 ? Math.round(token.currentMcapUsd / token.entryMcapUsd) : 0
                  return multiplier >= 2 ? (
                    <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0 rounded">
                      {multiplier}x
                    </span>
                  ) : null
                })()}
                <span className="text-[9px] text-gray-400 ml-auto flex items-center gap-1.5">
                  {token.buyCount}B / {token.sellCount}S
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </div>

              <div className="flex gap-1.5 px-3 pb-2 flex-wrap text-[10px]">
                {firstBuy ? (
                  <>
                    <span className="bg-violet-50 text-violet-700 font-medium px-2 py-0.5 rounded">
                      Wejscie: {formatDate(firstBuy.timestamp)}
                    </span>
                    <span className="bg-violet-50 text-violet-700 font-bold px-2 py-0.5 rounded">
                      @ {formatUsd(firstBuy.mcapUsd)}
                    </span>
                  </>
                ) : token.holdingSince ? (
                  <span className="bg-violet-50 text-violet-600 font-medium px-2 py-0.5 rounded">
                    ~{formatDate(token.holdingSince)}
                  </span>
                ) : null}
                {!firstBuy && (
                  <span className="bg-violet-50 text-violet-700 font-bold px-2 py-0.5 rounded">
                    Entry: {formatUsd(token.entryMcapUsd)}
                  </span>
                )}
                <span className="bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded">
                  Now: {formatUsd(token.currentMcapUsd)}
                </span>
                <span className={`font-bold px-2 py-0.5 rounded ${
                  token.realizedPnlUsd + token.unrealizedPnlUsd > 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-500'
                }`}>
                  PnL: {token.realizedPnlUsd + token.unrealizedPnlUsd > 0 ? '+' : ''}{formatUsd(token.realizedPnlUsd + token.unrealizedPnlUsd)}
                </span>
                {totalBuyUsd > 0 && (
                  <span className="bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded">
                    Kupiono: {formatUsd(totalBuyUsd)}
                  </span>
                )}
                {totalSellUsd > 0 && (
                  <span className="bg-amber-50 text-amber-600 font-medium px-2 py-0.5 rounded">
                    Sprzedano: {formatUsd(totalSellUsd)}
                  </span>
                )}
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2">
                {tokenTrades.length === 0 ? (
                  <p className="text-[11px] text-gray-400 py-1">Brak danych o transakcjach z GMGN</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2 text-[10px]">
                      <div className="bg-white rounded border border-gray-200 px-2 py-1.5">
                        <div className="text-[9px] text-gray-400 font-medium">Pierwszy zakup</div>
                        <div className="font-bold text-gray-700">{firstBuy ? formatDate(firstBuy.timestamp) : '—'}</div>
                        <div className="text-violet-600 font-medium">{firstBuy ? `@ ${formatUsd(firstBuy.mcapUsd)}` : '—'}</div>
                      </div>
                      <div className="bg-white rounded border border-gray-200 px-2 py-1.5">
                        <div className="text-[9px] text-gray-400 font-medium">Ostatnia sprzedaz</div>
                        <div className="font-bold text-gray-700">{lastSell ? formatDate(lastSell.timestamp) : '—'}</div>
                        <div className="text-amber-600 font-medium">{lastSell ? `@ ${formatUsd(lastSell.mcapUsd)}` : '—'}</div>
                      </div>
                      <div className="bg-white rounded border border-gray-200 px-2 py-1.5">
                        <div className="text-[9px] text-gray-400 font-medium">Realized PnL</div>
                        <div className={`font-bold ${pnlColor(token.realizedPnlUsd)}`}>
                          {token.realizedPnlUsd > 0 ? '+' : ''}{formatUsd(token.realizedPnlUsd)}
                        </div>
                      </div>
                      <div className="bg-white rounded border border-gray-200 px-2 py-1.5">
                        <div className="text-[9px] text-gray-400 font-medium">Unrealized PnL</div>
                        <div className={`font-bold ${pnlColor(token.unrealizedPnlUsd)}`}>
                          {token.unrealizedPnlUsd > 0 ? '+' : ''}{formatUsd(token.unrealizedPnlUsd)}
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-200 text-[9px] uppercase">
                            <th className="text-left py-1 pr-2 font-medium">Data</th>
                            <th className="text-left py-1 pr-2 font-medium">Typ</th>
                            <th className="text-right py-1 pr-2 font-medium">Mcap</th>
                            <th className="text-right py-1 pr-2 font-medium">SOL</th>
                            <th className="text-right py-1 pr-2 font-medium">USD</th>
                            <th className="text-right py-1 pr-2 font-medium">Tokeny</th>
                            <th className="text-center py-1 font-medium">TX</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokenTrades.map((t, i) => (
                            <tr key={i} className={`border-b border-gray-50 hover:bg-white/80 ${
                              i === 0 && t.type === 'buy' ? 'bg-violet-50/50' : ''
                            }`}>
                              <td className="py-1 pr-2 text-gray-500 whitespace-nowrap">{formatDate(t.timestamp)}</td>
                              <td className="py-1 pr-2">
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                                  t.type === 'buy'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-600'
                                }`}>
                                  {t.type === 'buy' ? 'BUY' : 'SELL'}
                                </span>
                              </td>
                              <td className="py-1 pr-2 text-right text-violet-600 font-medium">{formatUsd(t.mcapUsd)}</td>
                              <td className="py-1 pr-2 text-right text-gray-600">{formatNum(t.quoteAmount)}</td>
                              <td className="py-1 pr-2 text-right font-medium text-gray-700">{formatUsd(t.costUsd)}</td>
                              <td className="py-1 pr-2 text-right text-gray-500">{formatNum(t.tokenAmount)}</td>
                              <td className="py-1 text-center">
                                {t.txHash && (
                                  <a
                                    href={`https://solscan.io/tx/${t.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-600"
                                  >
                                    <ExternalLink size={10} />
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

type SummaryTab = 'smart' | 'profit' | 'early'

// ── Main Table Component ──────────────────────────────────────────────

function WalletTable({ wallets, onCopy, onBookmark, bookmarks, copiedAddr, expanded, onToggleExpand }: {
  wallets: InsiderWallet[]
  onCopy: (a: string) => void
  onBookmark: (a: string) => void
  bookmarks: Set<string>
  copiedAddr: string | null
  expanded: Set<string>
  onToggleExpand: (a: string) => void
}) {
  const [tab, setTab] = useState<SummaryTab>('smart')

  const sorted = useMemo(() => {
    const arr = [...wallets]
    switch (tab) {
      case 'smart':
        return arr.sort((a, b) => b.insiderScore - a.insiderScore)
      case 'profit':
        return arr.sort((a, b) =>
          (b.totalRealizedPnl + b.totalUnrealizedPnl) - (a.totalRealizedPnl + a.totalUnrealizedPnl)
        )
      case 'early':
        return arr
          .filter(w => w.avgEntryMcap > 0)
          .sort((a, b) => a.avgEntryMcap - b.avgEntryMcap)
    }
  }, [wallets, tab])

  const tabs: { key: SummaryTab; label: string; icon: typeof Crown }[] = [
    { key: 'smart', label: 'Smart Money', icon: Crown },
    { key: 'profit', label: 'Top Profit', icon: TrendingUp },
    { key: 'early', label: 'Najwczesniejsze wejscia', icon: Zap },
  ]

  return (
    <Card className="bg-white border-gray-200 rounded-xl shadow-sm">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center gap-1">
          <Trophy size={14} className="text-orange-500" />
          <CardTitle className="text-xs font-semibold text-gray-700">Wyniki — Top {sorted.length}</CardTitle>
        </div>
        <div className="flex gap-1 mt-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <t.icon size={11} />
              {t.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2 pt-1">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 uppercase text-[10px]">
                <th className="text-left pl-3 pr-1 py-1.5 font-medium">#</th>
                <th className="text-left px-1 py-1.5 font-medium">Wallet</th>
                <th className="text-left px-1 py-1.5 font-medium">Tokeny</th>
                <th className="text-left px-1 py-1.5 font-medium">Labels</th>
                <th className="text-center px-1 py-1.5 font-medium">Typ</th>
                <th className="text-right px-1 py-1.5 font-medium">Score</th>
                <th className="text-right px-1 py-1.5 font-medium">Saldo</th>
                <th className="text-right px-1 py-1.5 font-medium">Total PnL</th>
                <th className="text-right px-1 py-1.5 font-medium">Avg Entry</th>
                <th className="text-center px-1 pr-3 py-1.5 font-medium">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((w, i) => {
                const totalPnl = w.totalRealizedPnl + w.totalUnrealizedPnl
                const isSaved = bookmarks.has(w.address)
                const isExpanded = expanded.has(w.address)
                const isCopied = copiedAddr === w.address
                return (
                  <tr key={w.address} className="group">
                    <td colSpan={10} className="p-0">
                      {/* Main row */}
                      <div
                        className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto_auto_auto] items-center cursor-pointer hover:bg-gray-50/50 border-b border-gray-50 ${isExpanded ? 'bg-orange-50/30' : ''}`}
                        onClick={() => onToggleExpand(w.address)}
                      >
                        <div className="pl-3 pr-1 py-1.5 text-gray-400 font-medium text-[11px]">{i + 1}</div>
                        <div className="px-1 py-1.5">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-gray-700 text-[11px]">{shortAddr(w.address)}</span>
                            <button
                              onClick={e => { e.stopPropagation(); onCopy(w.address) }}
                              className={`shrink-0 transition-colors ${isCopied ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-500'}`}
                              title="Kopiuj adres"
                            >
                              {isCopied ? <Check size={10} /> : <Copy size={10} />}
                            </button>
                          </div>
                        </div>
                        <div className="px-1 py-1.5">
                          <div className="flex flex-wrap gap-0.5 max-w-[120px]">
                            {w.tokens.slice(0, 3).map(t => (
                              <span key={t.mint} className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0 rounded">
                                {t.symbol}
                              </span>
                            ))}
                            {w.tokens.length > 3 && (
                              <span className="text-[9px] text-gray-400">+{w.tokens.length - 3}</span>
                            )}
                          </div>
                        </div>
                        <div className="px-1 py-1.5">
                          <div className="flex flex-wrap gap-0.5">
                            {w.labels.slice(0, 2).map(l => (
                              <span key={l} className={`text-[9px] font-bold px-1.5 py-0 rounded border ${LABEL_STYLES[l] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                {l}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="px-1 py-1.5 text-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                            w.walletType === 'HOLDER'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {w.walletType}
                          </span>
                        </div>
                        <div className="px-1 py-1.5 text-right">
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${scoreColor(w.insiderScore)}`}>
                            {w.insiderScore}
                          </span>
                        </div>
                        <div className="px-1 py-1.5 text-right text-[11px] text-sky-600 font-medium">
                          {formatUsd(w.solBalanceUsd)}
                        </div>
                        <div className={`px-1 py-1.5 text-right text-[11px] font-bold ${pnlColor(totalPnl)}`}>
                          {totalPnl > 0 ? '+' : ''}{formatUsd(totalPnl)}
                        </div>
                        <div className="px-1 py-1.5 text-right text-[11px] text-violet-600 font-medium">
                          {formatUsd(w.avgEntryMcap)}
                        </div>
                        <div className="px-1 pr-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                            <a
                              href={`https://gmgn.ai/sol/address/${w.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-300 hover:text-blue-500"
                              title="GMGN"
                            >
                              <ExternalLink size={11} />
                            </a>
                            <button
                              onClick={() => onBookmark(w.address)}
                              className={`${isSaved ? 'text-orange-500' : 'text-gray-300 hover:text-orange-400'}`}
                              title={isSaved ? 'Usun' : 'Dodaj'}
                            >
                              {isSaved ? <BookmarkCheck size={12} /> : <BookmarkPlus size={12} />}
                            </button>
                            {isExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded: trade history */}
                      {isExpanded && (
                        <div className="border-b border-gray-100 bg-gray-50/50 px-3 py-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] pb-1">
                            <div className="flex items-center gap-2">
                              <a
                                href={`https://gmgn.ai/sol/address/${w.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 font-medium"
                              >
                                GMGN
                              </a>
                              <a
                                href={`https://solscan.io/account/${w.address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 font-medium"
                              >
                                Solscan
                              </a>
                            </div>
                            <span className="text-gray-400">Transakcje dla {w.tokens.length} token{w.tokens.length > 1 ? 'ow' : 'a'}</span>
                          </div>
                          <TradeHistory wallet={w.address} tokens={w.tokens} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export default function TokenAnalyzer() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [result, setResult] = useState<AnalyzerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null)

  const toggleExpand = (addr: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(addr) ? next.delete(addr) : next.add(addr)
      return next
    })
  }

  const toggleBookmark = (addr: string) => {
    if (isInBook(addr)) {
      removeFromBook(addr)
      setBookmarks(prev => { const n = new Set(prev); n.delete(addr); return n })
    } else {
      addToBook(addr, 'Insider', 'Found by Token Analyzer')
      setBookmarks(prev => new Set(prev).add(addr))
    }
  }

  const copyAddr = useCallback((addr: string) => {
    const doCopy = () => {
      setCopiedAddr(addr)
      setTimeout(() => setCopiedAddr(null), 2000)
    }

    // Try clipboard API first (works on HTTPS and localhost)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(addr).then(doCopy).catch(() => {
        // Fallback for HTTP
        fallbackCopy(addr)
        doCopy()
      })
    } else {
      fallbackCopy(addr)
      doCopy()
    }
  }, [])

  const fallbackCopy = (text: string) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  const analyze = useCallback(async () => {
    const mints = input
      .split(/[\n,\s]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 20)

    if (mints.length === 0) {
      setError('Wklej co najmniej 1 adres mint tokena')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(5)
    setStatusText(`Analizuje ${mints.length} token${mints.length > 1 ? 'ow' : ''}...`)

    const estimatedMs = mints.length * 8000 + 3000
    const interval = setInterval(() => {
      setProgress(prev => prev >= 90 ? prev : Math.min(90, prev + (85 / (estimatedMs / 500))))
    }, 500)

    const messages = [
      'Pobieram dane tokenow z DexScreener...',
      'Szukam early buyers na GMGN...',
      'Filtruje boty i gieldy...',
      'Analizuje wszystkie wallety...',
      'Obliczam InsiderScore...',
    ]
    let msgIdx = 0
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length
      setStatusText(messages[msgIdx])
    }, 3000)

    try {
      const res = await fetch('/api/token-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mints }),
      })

      clearInterval(interval)
      clearInterval(msgInterval)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Analysis failed')
      }

      const data: AnalyzerResponse = await res.json()
      setProgress(100)

      const holderCount = data.wallets.filter(w => w.walletType === 'HOLDER').length
      setStatusText(
        `Gotowe! ${data.wallets.length} walletow (${holderCount} holderow) w ${(data.elapsedMs / 1000).toFixed(1)}s`
      )
      setResult(data)

      const bm = new Set<string>()
      data.wallets.forEach(w => { if (isInBook(w.address)) bm.add(w.address) })
      setBookmarks(bm)
    } catch (e) {
      clearInterval(interval)
      clearInterval(msgInterval)
      setError(e instanceof Error ? e.message : 'Unknown error')
      setProgress(0)
      setStatusText('')
    } finally {
      setLoading(false)
    }
  }, [input])

  return (
    <div className="space-y-3">
      {/* Input */}
      <Card className="bg-white border-gray-200 rounded-xl shadow-sm">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-xs font-semibold text-gray-700">Insider Wallet Analyzer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={"Wklej adresy mint tokenow (jeden na linie lub po przecinku)\nnp.:\nSo11111111111111111111111111111111111111112\nEPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
            className="w-full h-24 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 font-mono"
            disabled={loading}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-400">Top 50 walletow | min. saldo $15K | bez botow i gield</p>
            <button
              onClick={analyze}
              disabled={loading || !input.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Analizuje...' : 'Analizuj'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {loading && (
        <Card className="bg-white border-gray-200 rounded-xl shadow-sm">
          <CardContent className="pt-3 pb-3 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-600">{statusText}</span>
              <span className="text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1 bg-gray-100" />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-600 text-xs">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Tokeny', value: result.processedTokens },
              { label: 'Traderzy', value: result.totalEarlyBuyers },
              { label: 'Wyniki', value: result.wallets.length },
              { label: 'Czas', value: `${(result.elapsedMs / 1000).toFixed(1)}s` },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-2.5 text-center shadow-sm">
                <div className="text-lg font-bold text-orange-600">{s.value}</div>
                <div className="text-[9px] text-gray-400 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Errors from processing */}
          {result.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-2.5">
              <p className="text-yellow-700 text-[11px] font-medium mb-0.5">Ostrzezenia:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-yellow-600 text-[11px]">{e}</p>
              ))}
            </div>
          )}

          {result.wallets.length === 0 ? (
            <Card className="bg-white border-gray-200 rounded-xl shadow-sm">
              <CardContent className="pt-5 pb-5 text-center text-gray-500 text-xs">
                Nie znaleziono walletow spelniajacych kryteria (saldo &gt;= $15K, bez botow/gield).
              </CardContent>
            </Card>
          ) : (
            <WalletTable
              wallets={result.wallets}
              onCopy={copyAddr}
              onBookmark={toggleBookmark}
              bookmarks={bookmarks}
              copiedAddr={copiedAddr}
              expanded={expanded}
              onToggleExpand={toggleExpand}
            />
          )}

          <p className="text-[9px] text-gray-400 text-center">
            Dane z GMGN + DexScreener. Entry mcap to szacunek na podstawie avg cost. Nie jest to porada inwestycyjna.
          </p>
        </>
      )}
    </div>
  )
}
