'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronRight, UserPlus, Copy, Check, ExternalLink, Trophy, Zap, TrendingUp, Crown, Loader2, Star, Target, Shield, Search, ArrowRight } from 'lucide-react'
import { addToBook, removeFromBook, isInBook } from '@/lib/walletBook'
import { addTokenToWatch, isTokenWatched } from '@/lib/tokenBook'

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

interface ScoreBreakdown {
  earlyEntry: number
  holdDuration: number
  pnlScore: number
  consistency: number
}

interface InsiderWallet {
  address: string
  tokensHit: number
  tokens: TokenHit[]
  totalRealizedPnl: number
  totalUnrealizedPnl: number
  avgEntryMcap: number
  avgEntryUsd: number
  solBalanceUsd: number
  insiderScore: number
  scoreBreakdown: ScoreBreakdown
  walletType: 'HOLDER' | 'TRADER'
  tags: string[]
  labels: string[]
  // New fields
  smartScore: number
  coverageRatio: number
  earlyEntryRatio: number
  earlyEntryCount: number
  botRatio: number
  botWarning: boolean
  weightedWinRate: number
  lateEntryWarning: boolean
  lastActiveTimestamp: number
}

interface AnalyzerResponse {
  wallets: InsiderWallet[]
  processedTokens: number
  totalTokensAnalyzed: number
  totalEarlyBuyers: number
  elapsedMs: number
  errors: string[]
}

interface TransferDestination {
  address: string
  totalSolReceived: number
  transferCount: number
  lastTransferAt: number
  currentSolBalance: number
}

interface WalletTraceResult {
  wallet: string
  destinations: TransferDestination[]
  totalSolTransferred: number
  txScanned: number
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

function fmtMcap(n: number): string {
  if (!n || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function pnlColor(n: number): string {
  return n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-gray-500'
}

function tokenEntryBadge(mcap: number): { text: string; cls: string } | null {
  if (mcap <= 0) return null
  if (mcap < 500_000) return { text: 'EARLY', cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' }
  if (mcap <= 2_000_000) return { text: 'MID', cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' }
  return { text: 'LATE', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' }
}

function tokenEarlyLabel(entryMcap: number, currentMcap: number): { text: string; bg: string } | null {
  if (entryMcap <= 0 || currentMcap <= 0) return null
  const ratio = entryMcap / currentMcap
  if (ratio <= 0.01) return { text: 'SNIPER', bg: 'bg-purple-500/20 text-purple-400' }
  if (ratio <= 0.05) return { text: 'VERY EARLY', bg: 'bg-emerald-500/20 text-emerald-400' }
  if (ratio <= 0.15) return { text: 'EARLY', bg: 'bg-sky-500/20 text-sky-400' }
  return null
}

function hunterBadge(earlyRatio: number): { text: string; icon: 'target' | 'zap' | 'shield'; cls: string } | null {
  if (earlyRatio >= 0.80) return { text: 'Early Hunter', icon: 'target', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
  if (earlyRatio >= 0.50) return { text: 'Early Buyer', icon: 'zap', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' }
  if (earlyRatio < 0.30 && earlyRatio >= 0) return { text: 'Late Entry', icon: 'shield', cls: 'bg-red-500/20 text-red-400 border-red-500/30' }
  return null
}

const LABEL_STYLES: Record<string, string> = {
  'MULTI-TOKEN': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'WHALE PROFIT': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'HIGH PROFIT': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'PROFIT': 'bg-green-500/15 text-green-400 border-green-500/25',
  'SNIPER': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'VERY EARLY': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'EARLY': 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  'CONSISTENT': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'DIAMOND HANDS': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'DCA': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
}

function activityStatus(lastActiveTs: number): { label: string; cls: string; dotCls: string } {
  if (!lastActiveTs) return { label: 'Brak danych', cls: 'text-gray-500', dotCls: 'bg-gray-500' }
  const nowSec = Math.floor(Date.now() / 1000)
  const diffDays = (nowSec - lastActiveTs) / 86400
  if (diffDays <= 3) return { label: `${diffDays < 1 ? 'Dziś' : Math.floor(diffDays) + 'd temu'}`, cls: 'text-emerald-400', dotCls: 'bg-emerald-400' }
  if (diffDays <= 14) return { label: `${Math.floor(diffDays)}d temu`, cls: 'text-amber-400', dotCls: 'bg-amber-400' }
  if (diffDays <= 60) return { label: `${Math.floor(diffDays)}d temu`, cls: 'text-orange-400', dotCls: 'bg-orange-400' }
  return { label: `${Math.floor(diffDays)}d temu`, cls: 'text-red-400', dotCls: 'bg-red-400' }
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

// ── Computed wallet metrics ──────────────────────────────────────────

function getEarliestEntryMcap(w: InsiderWallet): number {
  const entries = w.tokens.filter(t => t.entryMcapUsd > 0).map(t => t.entryMcapUsd)
  return entries.length > 0 ? Math.min(...entries) : w.avgEntryMcap
}

function getFirstBuyInfo(w: InsiderWallet): { mcap: number; currentMcap: number; symbol: string; timestamp: number; growthPct: number } | null {
  const withTime = w.tokens.filter(t => t.holdingSince && t.holdingSince > 0 && t.entryMcapUsd > 0)
  let earliest: TokenHit
  if (withTime.length === 0) {
    const withMcap = w.tokens.filter(t => t.entryMcapUsd > 0)
    if (withMcap.length === 0) return null
    earliest = withMcap.reduce((a, b) => a.entryMcapUsd < b.entryMcapUsd ? a : b)
  } else {
    earliest = withTime.reduce((a, b) => (a.holdingSince as number) < (b.holdingSince as number) ? a : b)
  }
  const growthPct = earliest.entryMcapUsd > 0 && earliest.currentMcapUsd > 0
    ? ((earliest.currentMcapUsd - earliest.entryMcapUsd) / earliest.entryMcapUsd) * 100
    : 0
  return {
    mcap: earliest.entryMcapUsd,
    currentMcap: earliest.currentMcapUsd,
    symbol: earliest.symbol,
    timestamp: (earliest.holdingSince as number) || 0,
    growthPct,
  }
}

function getHoldDurationSec(w: InsiderWallet): number {
  const holdTimes = w.tokens
    .filter(t => t.holdingSince && t.holdingSince > 0)
    .map(t => t.holdingSince as number)
  if (holdTimes.length === 0) return 0
  const earliest = Math.min(...holdTimes)
  return Math.floor(Date.now() / 1000) - earliest
}

function getStillHolding(w: InsiderWallet): boolean {
  return w.tokens.some(t => {
    if (!t.holdingSince || t.holdingSince <= 0) return false
    return t.sellCount === 0 || t.buyCount > t.sellCount
  })
}

function getPnlPercent(w: InsiderWallet): number | null {
  const totalCost = w.tokens.reduce((s, t) => s + t.totalCostUsd, 0)
  if (totalCost <= 0) return null
  return ((w.totalRealizedPnl + w.totalUnrealizedPnl) / totalCost) * 100
}

function formatHoldDuration(sec: number): string {
  if (sec <= 0) return '—'
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return `${hours}h`
  const mins = Math.floor(sec / 60)
  return `${mins}m`
}

function isSmartMoney(w: InsiderWallet): boolean {
  // Based on smartScore > 0 (computed server-side with all criteria)
  return w.smartScore > 0
}

function smartScoreColor(score: number): string {
  const pct = score * 100
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-gray-600'
}

function smartScoreBadgeColor(score: number, lateEntry: boolean): string {
  if (lateEntry) return 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  const pct = score * 100
  if (pct >= 70) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
  if (pct >= 40) return 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  return 'text-gray-400 bg-gray-700/50 border-gray-600'
}

function avgEntryMcapColor(mcap: number): string {
  if (mcap <= 0) return 'text-gray-500'
  if (mcap < 500_000) return 'text-emerald-400'
  if (mcap <= 2_000_000) return 'text-amber-400'
  return 'text-red-400'
}

function mcapEntryColor(mcap: number): string {
  if (mcap <= 0) return 'text-gray-500'
  if (mcap < 500_000) return 'text-emerald-400'
  if (mcap <= 2_000_000) return 'text-amber-400'
  return 'text-gray-400'
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

      {error && <p className="text-[11px] text-red-400 py-1">{error}</p>}

      {trades && tokens.map(token => {
        const tokenTrades = trades[token.mint] ?? []
        const buys = tokenTrades.filter(t => t.type === 'buy')
        const sells = tokenTrades.filter(t => t.type === 'sell')
        const firstBuy = buys[0]
        const lastSell = sells[sells.length - 1]
        const totalBuyUsd = buys.reduce((s, t) => s + t.costUsd, 0)
        const totalSellUsd = sells.reduce((s, t) => s + t.costUsd, 0)
        const totalBuyTokens = buys.reduce((s, t) => s + t.tokenAmount, 0)
        const isOpen = expandedToken.has(token.mint)

        const weightedAvgEntry = totalBuyTokens > 0
          ? buys.reduce((s, t) => s + t.priceUsd * t.tokenAmount, 0) / totalBuyTokens
          : 0

        const firstBuyTs = firstBuy?.timestamp ?? token.holdingSince ?? 0
        const lastActionTs = lastSell?.timestamp ?? (Date.now() / 1000)
        const holdDays = firstBuyTs > 0 ? (lastActionTs - firstBuyTs) / 86400 : 0
        const holdLabel = holdDays >= 1
          ? `${holdDays.toFixed(1)} dni`
          : holdDays > 0 ? `${(holdDays * 24).toFixed(1)} godz.` : '—'
        const stillHolding = sells.length === 0 || (buys.length > 0 && sells.length < buys.length)
        const entryBadge = tokenEntryBadge(token.entryMcapUsd)

        return (
          <div key={token.mint} className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
            <div
              className="cursor-pointer hover:bg-gray-700/30 transition-colors"
              onClick={() => toggleToken(token.mint)}
            >
              <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <button
                  onClick={e => { e.stopPropagation(); addTokenToWatch(token.mint, token.symbol, '', '', token.currentMcapUsd, 0) }}
                  className={`transition-colors ${isTokenWatched(token.mint) ? 'text-yellow-500' : 'text-gray-500 hover:text-yellow-500'}`}
                  title={isTokenWatched(token.mint) ? 'Obserwowany' : 'Dodaj do obserwowanych'}
                >
                  <Star size={11} fill={isTokenWatched(token.mint) ? 'currentColor' : 'none'} />
                </button>
                <a
                  href={`https://gmgn.ai/sol/token/${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="font-bold text-xs text-gray-200 hover:text-orange-400"
                >
                  {token.symbol}
                </a>
                {entryBadge && (
                  <span className={`text-[9px] font-bold px-1.5 py-0 rounded ${entryBadge.cls}`}>
                    {entryBadge.text}
                  </span>
                )}
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
                    <span className="text-[9px] font-bold text-orange-400 bg-orange-500/15 px-1.5 py-0 rounded">
                      {multiplier}x
                    </span>
                  ) : null
                })()}
                <span className="text-[9px] text-gray-500 ml-auto flex items-center gap-1.5">
                  {token.buyCount}B / {token.sellCount}S
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </div>

              <div className="flex gap-1.5 px-3 pb-2 flex-wrap text-[10px]">
                {firstBuy ? (
                  <>
                    <span className="bg-violet-500/15 text-violet-400 font-medium px-2 py-0.5 rounded">
                      Wejscie: {formatDate(firstBuy.timestamp)}
                    </span>
                    <span className="bg-violet-500/15 text-violet-400 font-bold px-2 py-0.5 rounded">
                      @ {formatUsd(firstBuy.mcapUsd)}
                    </span>
                  </>
                ) : token.holdingSince ? (
                  <span className="bg-violet-500/15 text-violet-400 font-medium px-2 py-0.5 rounded">
                    ~{formatDate(token.holdingSince)}
                  </span>
                ) : null}
                {!firstBuy && (
                  <span className="bg-violet-500/15 text-violet-400 font-bold px-2 py-0.5 rounded">
                    Entry: {formatUsd(token.entryMcapUsd)}
                  </span>
                )}
                <span className="bg-gray-700/50 text-gray-400 font-medium px-2 py-0.5 rounded">
                  Now: {formatUsd(token.currentMcapUsd)}
                </span>
                <span className={`font-bold px-2 py-0.5 rounded ${pnlColor(token.realizedPnlUsd)} ${token.realizedPnlUsd >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  R: {token.realizedPnlUsd > 0 ? '+' : ''}{formatUsd(token.realizedPnlUsd)}
                </span>
                <span className={`font-bold px-2 py-0.5 rounded ${pnlColor(token.unrealizedPnlUsd)} ${token.unrealizedPnlUsd >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                  U: {token.unrealizedPnlUsd > 0 ? '+' : ''}{formatUsd(token.unrealizedPnlUsd)}
                </span>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-gray-700/50 bg-gray-900/50 px-3 py-2">
                {tokenTrades.length === 0 ? (
                  <p className="text-[11px] text-gray-500 py-1">Brak danych o transakcjach z GMGN</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 mb-2 text-[10px]">
                      <div className="bg-gray-800/70 rounded border border-gray-700/50 px-2 py-1.5">
                        <div className="text-[9px] text-gray-500 font-medium">Pierwszy zakup</div>
                        <div className="font-bold text-gray-200">{firstBuy ? formatDate(firstBuy.timestamp) : '—'}</div>
                        <div className="text-violet-400 font-medium">{firstBuy ? `Mcap: ${formatUsd(firstBuy.mcapUsd)}` : '—'}</div>
                      </div>
                      <div className="bg-gray-800/70 rounded border border-gray-700/50 px-2 py-1.5">
                        <div className="text-[9px] text-gray-500 font-medium">Ostatnia sprzedaz</div>
                        <div className="font-bold text-gray-200">{lastSell ? formatDate(lastSell.timestamp) : '—'}</div>
                        <div className="text-amber-400 font-medium">{lastSell ? `Mcap: ${formatUsd(lastSell.mcapUsd)}` : '—'}</div>
                      </div>
                      <div className="bg-gray-800/70 rounded border border-gray-700/50 px-2 py-1.5">
                        <div className="text-[9px] text-gray-500 font-medium">Avg Entry (weighted)</div>
                        <div className="font-bold text-violet-400">{weightedAvgEntry > 0 ? `$${formatNum(weightedAvgEntry)}` : '—'}</div>
                      </div>
                      <div className="bg-gray-800/70 rounded border border-gray-700/50 px-2 py-1.5">
                        <div className="text-[9px] text-gray-500 font-medium">Czas trzymania</div>
                        <div className="font-bold text-gray-200">{holdLabel}</div>
                        <div className="text-[9px] text-gray-500">{stillHolding ? 'nadal trzyma' : 'zamknieta'}</div>
                      </div>
                      <div className="bg-gray-800/70 rounded border border-gray-700/50 px-2 py-1.5">
                        <div className="text-[9px] text-gray-500 font-medium">Realized PnL</div>
                        <div className={`font-bold ${pnlColor(token.realizedPnlUsd)}`}>
                          {token.realizedPnlUsd > 0 ? '+' : ''}{formatUsd(token.realizedPnlUsd)}
                        </div>
                      </div>
                      <div className="bg-gray-800/70 rounded border border-gray-700/50 px-2 py-1.5">
                        <div className="text-[9px] text-gray-500 font-medium">Unrealized PnL</div>
                        <div className={`font-bold ${pnlColor(token.unrealizedPnlUsd)}`}>
                          {token.unrealizedPnlUsd > 0 ? '+' : ''}{formatUsd(token.unrealizedPnlUsd)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mb-2 text-[10px]">
                      <span className="bg-emerald-500/15 text-emerald-400 font-medium px-2 py-0.5 rounded">
                        Wolumen BUY: {formatUsd(totalBuyUsd)} ({buys.length} tx)
                      </span>
                      <span className="bg-red-500/15 text-red-400 font-medium px-2 py-0.5 rounded">
                        Wolumen SELL: {formatUsd(totalSellUsd)} ({sells.length} tx)
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-gray-500 border-b border-gray-700/50 text-[9px] uppercase">
                            <th className="text-left py-1 pr-2 font-medium">Data</th>
                            <th className="text-left py-1 pr-2 font-medium">Typ</th>
                            <th className="text-right py-1 pr-2 font-medium">Cena USD</th>
                            <th className="text-right py-1 pr-2 font-medium">Mcap</th>
                            <th className="text-right py-1 pr-2 font-medium">SOL</th>
                            <th className="text-right py-1 pr-2 font-medium">USD</th>
                            <th className="text-right py-1 pr-2 font-medium">Tokeny</th>
                            <th className="text-center py-1 font-medium">TX</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokenTrades.map((t, i) => (
                            <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${
                              i === 0 && t.type === 'buy' ? 'bg-violet-500/5' : ''
                            }`}>
                              <td className="py-1 pr-2 text-gray-400 whitespace-nowrap">{formatDate(t.timestamp)}</td>
                              <td className="py-1 pr-2">
                                <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                                  t.type === 'buy'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {t.type === 'buy' ? 'BUY' : 'SELL'}
                                </span>
                              </td>
                              <td className="py-1 pr-2 text-right text-gray-300 font-medium">{t.priceUsd > 0 ? `$${formatNum(t.priceUsd)}` : '—'}</td>
                              <td className="py-1 pr-2 text-right text-violet-400 font-medium">{formatUsd(t.mcapUsd)}</td>
                              <td className="py-1 pr-2 text-right text-gray-400">{formatNum(t.quoteAmount)}</td>
                              <td className="py-1 pr-2 text-right font-medium text-gray-200">{formatUsd(t.costUsd)}</td>
                              <td className="py-1 pr-2 text-right text-gray-400">{formatNum(t.tokenAmount)}</td>
                              <td className="py-1 text-center">
                                {t.txHash && (
                                  <a
                                    href={`https://solscan.io/tx/${t.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-500 hover:text-blue-400"
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

// ── Filter options ───────────────────────────────────────────────────

const MCAP_ENTRY_OPTIONS = [
  { value: 0, label: 'Wszystkie' },
  { value: 100_000, label: '< $100K' },
  { value: 250_000, label: '< $250K' },
  { value: 500_000, label: '< $500K' },
  { value: 1_000_000, label: '< $1M' },
  { value: 2_000_000, label: '< $2M' },
]

const HOLD_TIME_OPTIONS = [
  { value: 0, label: 'Wszystkie' },
  { value: 3600, label: '> 1h' },
  { value: 21600, label: '> 6h' },
  { value: 86400, label: '> 24h' },
  { value: 259200, label: '> 72h' },
  { value: 604800, label: '> 7 dni' },
]

const PNL_OPTIONS = [
  { value: -Infinity, label: 'Wszystkie' },
  { value: 0, label: '> 0%' },
  { value: 50, label: '> 50%' },
  { value: 100, label: '> 100%' },
  { value: 500, label: '> 500%' },
  { value: 1000, label: '> 1000%' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'HOLDER', label: 'Tylko HOLDER' },
  { value: 'TRADER', label: 'Tylko TRADER' },
]

// ── Sort column type ─────────────────────────────────────────────────

type SortCol = 'score' | 'smartScore' | 'entryMcap' | 'holdDuration' | 'pnl' | 'realized' | 'unrealized' | 'balance' | 'avgEntry' | 'earlyRatio' | 'coverage' | 'activity'

// ── Main Table Component ──────────────────────────────────────────────

function WalletTable({ wallets, totalTokensAnalyzed, onCopy, onBookmark, bookmarks, copiedAddr, expanded, onToggleExpand }: {
  wallets: InsiderWallet[]
  totalTokensAnalyzed: number
  onCopy: (a: string) => void
  onBookmark: (a: string) => void
  bookmarks: Set<string>
  copiedAddr: string | null
  expanded: Set<string>
  onToggleExpand: (a: string) => void
}) {
  const [tab, setTab] = useState<SummaryTab>('smart')

  // Wallet trace state
  const [traceResults, setTraceResults] = useState<Map<string, WalletTraceResult>>(new Map())
  const [traceLoading, setTraceLoading] = useState<Set<string>>(new Set())

  const traceWallet = useCallback(async (address: string) => {
    setTraceLoading(prev => new Set(prev).add(address))
    // Auto-expand wallet card to show trace results (only if not already expanded)
    if (!expanded.has(address)) onToggleExpand(address)
    try {
      const res = await fetch(`/api/wallet-trace?address=${address}`)
      const data: WalletTraceResult = await res.json()
      setTraceResults(prev => new Map(prev).set(address, data))
    } catch (e) {
      setTraceResults(prev => new Map(prev).set(address, {
        wallet: address,
        destinations: [],
        totalSolTransferred: 0,
        txScanned: 0,
        error: (e as Error).message,
      }))
    } finally {
      setTraceLoading(prev => { const n = new Set(prev); n.delete(address); return n })
    }
  }, [onToggleExpand, expanded])

  // Filters
  const [maxMcapEntry, setMaxMcapEntry] = useState(0)
  const [minHoldTime, setMinHoldTime] = useState(3600)
  const [minPnl, setMinPnl] = useState(-Infinity)
  const [typeFilter, setTypeFilter] = useState('HOLDER')

  // Sort
  const [sortCol, setSortCol] = useState<SortCol>('smartScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleColSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortCol(col)
      setSortDir(col === 'entryMcap' ? 'asc' : 'desc')
    }
  }

  const colSortIcon = (col: SortCol) => {
    if (sortCol !== col) return null
    return <span className="text-orange-500 ml-0.5 text-[8px]">{sortDir === 'desc' ? '▼' : '▲'}</span>
  }

  const filtered = useMemo(() => {
    let arr = [...wallets]

    // Tab-based pre-sort
    switch (tab) {
      case 'profit':
        arr.sort((a, b) =>
          (b.totalRealizedPnl + b.totalUnrealizedPnl) - (a.totalRealizedPnl + a.totalUnrealizedPnl)
        )
        break
      case 'early':
        arr = arr.filter(w => w.avgEntryMcap > 0)
        arr.sort((a, b) => a.avgEntryMcap - b.avgEntryMcap)
        break
    }

    // Apply filters
    if (maxMcapEntry > 0) {
      arr = arr.filter(w => {
        const mcap = getEarliestEntryMcap(w)
        return mcap > 0 && mcap <= maxMcapEntry
      })
    }

    if (minHoldTime > 0) {
      arr = arr.filter(w => getHoldDurationSec(w) >= minHoldTime)
    }

    if (minPnl > -Infinity) {
      arr = arr.filter(w => {
        const pnl = getPnlPercent(w)
        return pnl === null || pnl >= minPnl
      })
    }

    if (typeFilter !== 'all') {
      arr = arr.filter(w => w.walletType === typeFilter)
    }

    // Column sort
    const getSortVal = (w: InsiderWallet): number => {
      switch (sortCol) {
        case 'score': return w.insiderScore
        case 'smartScore': return w.smartScore
        case 'entryMcap': return getEarliestEntryMcap(w)
        case 'holdDuration': return getHoldDurationSec(w)
        case 'pnl': return getPnlPercent(w) ?? -Infinity
        case 'realized': return w.totalRealizedPnl
        case 'unrealized': return w.totalUnrealizedPnl
        case 'balance': return w.solBalanceUsd
        case 'avgEntry': return w.avgEntryMcap
        case 'earlyRatio': return w.earlyEntryRatio
        case 'coverage': return w.coverageRatio
        case 'activity': return w.lastActiveTimestamp
        default: return 0
      }
    }

    // Smart badge wallets always on top, then sort by column
    arr.sort((a, b) => {
      const aS = isSmartMoney(a) ? 1 : 0
      const bS = isSmartMoney(b) ? 1 : 0
      if (aS !== bS) return bS - aS
      const va = getSortVal(a)
      const vb = getSortVal(b)
      return sortDir === 'desc' ? vb - va : va - vb
    })

    return arr
  }, [wallets, tab, maxMcapEntry, minHoldTime, minPnl, typeFilter, sortCol, sortDir])

  const tabs: { key: SummaryTab; label: string; icon: typeof Crown }[] = [
    { key: 'smart', label: 'Smart Money', icon: Crown },
    { key: 'profit', label: 'Top Profit', icon: TrendingUp },
    { key: 'early', label: 'Najwczesniejsze wejscia', icon: Zap },
  ]

  return (
    <div className="space-y-3">
      {/* ── Header + tabs + filters ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={14} className="text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-200">Wyniki — Top {wallets.length}</h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-full transition-colors ${
                  tab === t.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                <t.icon size={11} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3">
          <div className="p-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-0.5">
                <label className="text-[9px] text-gray-500 font-medium uppercase">Maks. mcap przy wejściu</label>
                <select
                  value={maxMcapEntry}
                  onChange={e => setMaxMcapEntry(Number(e.target.value))}
                  className="block px-2 py-1 text-[11px] border border-gray-700 rounded-md bg-gray-900 text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {MCAP_ENTRY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-gray-500 font-medium uppercase">Min. czas trzymania</label>
                <select
                  value={minHoldTime}
                  onChange={e => setMinHoldTime(Number(e.target.value))}
                  className="block px-2 py-1 text-[11px] border border-gray-700 rounded-md bg-gray-900 text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {HOLD_TIME_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-gray-500 font-medium uppercase">Min. PnL%</label>
                <select
                  value={minPnl}
                  onChange={e => setMinPnl(Number(e.target.value))}
                  className="block px-2 py-1 text-[11px] border border-gray-700 rounded-md bg-gray-900 text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {PNL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] text-gray-500 font-medium uppercase">Typ walletu</label>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="block px-2 py-1 text-[11px] border border-gray-700 rounded-md bg-gray-900 text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-1.5 text-[10px] text-gray-500">
              Pokazuję <span className="font-semibold text-gray-300">{filtered.length}</span> z <span className="font-semibold text-gray-300">{wallets.length}</span> walletów
            </div>
          </div>
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-1 px-4 pb-3 flex-wrap">
          <span className="text-[9px] text-gray-500 uppercase font-medium mr-1">Sortuj:</span>
          {([
            ['smartScore', 'Smart Score'],
            ['score', 'Insider'],
            ['earlyRatio', 'Early %'],
            ['coverage', 'Coverage'],
            ['entryMcap', 'Mcap wej.'],
            ['holdDuration', 'Trzyma'],
            ['realized', 'Realized'],
            ['unrealized', 'Unrealized'],
            ['balance', 'Saldo'],
            ['activity', 'Aktywność'],
          ] as [SortCol, string][]).map(([col, label]) => (
            <button
              key={col}
              onClick={() => handleColSort(col)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                sortCol === col
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-400'
              }`}
            >
              {label}{colSortIcon(col)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Wallet cards ── */}
      <div className="space-y-2">
        {filtered.map((w, i) => {
          const isSaved = bookmarks.has(w.address)
          const isExpanded = expanded.has(w.address)
          const isCopied = copiedAddr === w.address
          const smart = isSmartMoney(w)
          const holdSec = getHoldDurationSec(w)
          const stillHolding = getStillHolding(w)
          const pnlPct = getPnlPercent(w)
          const totalPnl = w.totalRealizedPnl + w.totalUnrealizedPnl
          const firstBuyInfo = getFirstBuyInfo(w)
          const hunter = hunterBadge(w.earlyEntryRatio)

          return (
            <div key={w.address} className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
              smart ? 'border-orange-500/30' : 'border-gray-800'
            }`}>
              {/* ── Card header ── */}
              <div
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  isExpanded ? 'bg-gray-800/30' : 'hover:bg-gray-800/20'
                }`}
                onClick={() => onToggleExpand(w.address)}
              >
                {/* Row 1: rank + address + badges + score bar */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-600 font-bold text-xs w-5 text-right shrink-0">{i + 1}</span>

                  {smart && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${smartScoreBadgeColor(w.smartScore, w.lateEntryWarning)}`}>
                      {w.lateEntryWarning ? '⚠ Smart' : '★ Smart'}
                    </span>
                  )}
                  {w.botWarning && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 shrink-0"
                      title={`Bot activity: ${(w.botRatio * 100).toFixed(0)}% pozycji`}>
                      ⚠ Bot
                    </span>
                  )}
                  {hunter && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${hunter.cls}`}>
                      {hunter.icon === 'target' ? <Target size={9} /> : hunter.icon === 'zap' ? <Zap size={9} /> : <Shield size={9} />}
                      {hunter.text}
                    </span>
                  )}

                  <span className="font-mono text-gray-300 text-[11px] font-medium">{shortAddr(w.address)}</span>

                  <button
                    onClick={e => { e.stopPropagation(); onCopy(w.address) }}
                    className={`shrink-0 transition-colors ${isCopied ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-400'}`}
                    title="Kopiuj adres"
                  >
                    {isCopied ? <Check size={10} /> : <Copy size={10} />}
                  </button>

                  {/* Labels (hidden on mobile) */}
                  <div className="hidden sm:flex flex-wrap gap-0.5 min-w-0">
                    {w.labels.slice(0, 3).map(l => (
                      <span key={l} className={`text-[8px] font-bold px-1.5 py-0 rounded border ${LABEL_STYLES[l] || 'bg-gray-700/50 text-gray-400 border-gray-600'}`}>
                        {l}
                      </span>
                    ))}
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                      w.walletType === 'HOLDER'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-orange-500/15 text-orange-400'
                    }`}>
                      {w.walletType}
                    </span>
                    {w.lastActiveTimestamp > 0 && (Date.now() / 1000 - w.lastActiveTimestamp) > 30 * 86400 && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25">
                        INACTIVE {Math.floor((Date.now() / 1000 - w.lastActiveTimestamp) / 86400)}d
                      </span>
                    )}
                  </div>

                  {/* Score bar + actions (right) */}
                  <div className="ml-auto flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5" title={`Smart Score: ${(w.smartScore * 100).toFixed(1)}% | Coverage: ${(w.coverageRatio * 100).toFixed(0)}% | WinRate: ${w.weightedWinRate.toFixed(0)}% | Early: ${(w.earlyEntryRatio * 100).toFixed(0)}%`}>
                      <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${smartScoreColor(w.smartScore)}`} style={{ width: `${Math.min(w.smartScore * 100, 100)}%` }} />
                      </div>
                      <span className={`font-bold text-[11px] ${w.smartScore >= 0.7 ? 'text-emerald-400' : w.smartScore >= 0.4 ? 'text-amber-400' : 'text-gray-500'}`}>
                        {(w.smartScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <a
                      href={`https://gmgn.ai/sol/address/${w.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-blue-400 transition-colors"
                      title="GMGN"
                    >
                      <ExternalLink size={11} />
                    </a>
                    <button
                      onClick={() => onBookmark(w.address)}
                      className={`transition-colors ${isSaved ? 'text-emerald-400' : 'text-gray-600 hover:text-orange-400'}`}
                      title={isSaved ? 'Już obserwowany' : 'Dodaj do obserwowanych'}
                    >
                      {isSaved ? <Check size={12} /> : <UserPlus size={12} />}
                    </button>
                    {isExpanded ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
                  </div>
                </div>

                {/* Row 2: 4-stat grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-7">
                  <div className="bg-gray-800/60 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-gray-500 font-medium">Avg Entry MCap</div>
                    <div className={`font-bold text-sm ${avgEntryMcapColor(w.avgEntryMcap)}`}>{fmtMcap(w.avgEntryMcap)}</div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-gray-500 font-medium">Coverage</div>
                    <div className="font-bold text-sm text-indigo-400">{w.tokensHit}/{totalTokensAnalyzed}
                      <span className="text-gray-500 font-normal text-[10px] ml-1">({(w.coverageRatio * 100).toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-gray-500 font-medium">Realized PnL</div>
                    <div className={`font-bold text-sm ${pnlColor(w.totalRealizedPnl)}`}>
                      {w.totalRealizedPnl > 0 ? '+' : ''}{formatUsd(w.totalRealizedPnl)}
                    </div>
                  </div>
                  <div className="bg-gray-800/60 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-gray-500 font-medium">Saldo SOL</div>
                    <div className="font-bold text-sm text-sky-400">{formatUsd(w.solBalanceUsd)}</div>
                    {(() => {
                      const act = activityStatus(w.lastActiveTimestamp)
                      return (
                        <div className={`flex items-center gap-1 mt-0.5 ${act.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${act.dotCls} inline-block`} />
                          <span className="text-[9px] font-medium">{act.label}</span>
                        </div>
                      )
                    })()}
                    {/* Trace button — available for every wallet */}
                    <button
                      onClick={e => { e.stopPropagation(); traceWallet(w.address) }}
                      disabled={traceLoading.has(w.address)}
                      className="mt-1 flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                      title="Śledź gdzie poszły środki"
                    >
                      {traceLoading.has(w.address) ? <Loader2 size={8} className="animate-spin" /> : <Search size={8} />}
                      {traceResults.has(w.address) ? 'Traced' : 'Trace'}
                    </button>
                  </div>
                </div>

                {/* Row 3: tokens + quick metrics */}
                <div className="flex items-center gap-3 ml-7 mt-2 flex-wrap">
                  <div className="flex items-center gap-0.5">
                    {w.tokens.slice(0, 4).map(t => (
                      <span key={t.mint} className="text-[9px] font-bold text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded">
                        {t.symbol}
                      </span>
                    ))}
                    {w.tokens.length > 4 && (
                      <span className="text-[9px] text-gray-500">+{w.tokens.length - 4}</span>
                    )}
                  </div>

                  <span className="text-gray-700">|</span>

                  {firstBuyInfo && (
                    <div className="text-[10px]">
                      <span className="text-gray-500">1. zakup:</span>
                      <span className={`ml-0.5 font-semibold ${mcapEntryColor(firstBuyInfo.mcap)}`}>{fmtMcap(firstBuyInfo.mcap)}</span>
                      <span className="text-gray-600 mx-0.5">&rarr;</span>
                      <span className="font-medium text-gray-400">{fmtMcap(firstBuyInfo.currentMcap)}</span>
                      {firstBuyInfo.growthPct !== 0 && (
                        <span className={`ml-0.5 font-bold ${firstBuyInfo.growthPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          ({firstBuyInfo.growthPct > 0 ? '+' : ''}{firstBuyInfo.growthPct >= 1000 ? `${(firstBuyInfo.growthPct / 100).toFixed(0)}x` : `${firstBuyInfo.growthPct.toFixed(0)}%`})
                        </span>
                      )}
                      <span className="text-gray-500 ml-0.5 text-[9px]">{firstBuyInfo.symbol}</span>
                    </div>
                  )}

                  <div className="text-[10px]">
                    <span className="text-gray-500">Hold:</span>
                    <span className="ml-0.5 font-medium text-gray-400">{formatHoldDuration(holdSec)}</span>
                    {stillHolding && <span className="text-emerald-400 ml-0.5 text-[8px]">aktywny</span>}
                  </div>

                  <div className="text-[10px]">
                    <span className="text-gray-500">PnL:</span>
                    <span className={`ml-0.5 font-bold ${pnlColor(totalPnl)}`}>
                      {totalPnl > 0 ? '+' : ''}{formatUsd(totalPnl)}
                    </span>
                    {pnlPct !== null && (
                      <span className={`ml-0.5 text-[9px] ${pnlColor(pnlPct)}`}>
                        ({pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(0)}%)
                      </span>
                    )}
                  </div>

                  {w.earlyEntryRatio > 0 && (
                    <div className="text-[10px]">
                      <span className="text-gray-500">Early:</span>
                      <span className={`ml-0.5 font-bold ${w.earlyEntryRatio >= 0.50 ? 'text-emerald-400' : 'text-gray-400'}`}>
                        {(w.earlyEntryRatio * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                  <div className="text-[10px] hidden sm:flex items-center gap-1.5">
                    <span className={`${pnlColor(w.totalUnrealizedPnl)}`}>
                      U: {w.totalUnrealizedPnl > 0 ? '+' : ''}{formatUsd(w.totalUnrealizedPnl)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Expanded card body ── */}
              {isExpanded && (
                <div className="border-t border-gray-800 bg-gray-950/50 px-4 py-3 space-y-3">
                  {/* Smart Score breakdown */}
                  <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5 text-[10px]">
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Smart Score</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${smartScoreColor(w.smartScore)}`} style={{ width: `${w.smartScore * 100}%` }} />
                        </div>
                        <span className="font-bold text-gray-200">{(w.smartScore * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Coverage</div>
                      <div className="font-bold text-indigo-400">{w.tokensHit}/{totalTokensAnalyzed}</div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Win Rate (ważony)</div>
                      <div className="font-bold text-gray-200">{w.weightedWinRate.toFixed(0)}%</div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Early Ratio</div>
                      <div className={`font-bold ${w.earlyEntryRatio >= 0.50 ? 'text-emerald-400' : 'text-gray-200'}`}>
                        {(w.earlyEntryRatio * 100).toFixed(0)}% <span className="text-gray-500 font-normal">({w.earlyEntryCount}/{w.tokensHit})</span>
                      </div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Avg Entry MCap</div>
                      <div className={`font-bold ${avgEntryMcapColor(w.avgEntryMcap)}`}>{fmtMcap(w.avgEntryMcap)}</div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Bot Ratio</div>
                      <div className={`font-bold ${w.botRatio > 0.30 ? 'text-yellow-400' : 'text-gray-200'}`}>
                        {(w.botRatio * 100).toFixed(0)}%
                      </div>
                    </div>
                    {(() => {
                      const act = activityStatus(w.lastActiveTimestamp)
                      return (
                        <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                          <div className="text-[9px] text-gray-500 font-medium">Ostatnia aktywność</div>
                          <div className={`font-bold flex items-center gap-1 ${act.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${act.dotCls} inline-block`} />
                            {w.lastActiveTimestamp > 0
                              ? new Date(w.lastActiveTimestamp * 1000).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })
                              : '—'}
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Insider Score breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px]">
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Insider Score</div>
                      <div className="font-bold text-gray-200">{w.insiderScore}<span className="text-gray-500 font-normal">/100</span></div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Wczesne wejscie</div>
                      <div className="font-bold text-gray-200">{w.scoreBreakdown.earlyEntry}<span className="text-gray-500 font-normal">/30</span></div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">Czas trzymania</div>
                      <div className="font-bold text-gray-200">{w.scoreBreakdown.holdDuration}<span className="text-gray-500 font-normal">/35</span></div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">PnL Score</div>
                      <div className="font-bold text-gray-200">{w.scoreBreakdown.pnlScore}<span className="text-gray-500 font-normal">/25</span></div>
                    </div>
                    <div className="bg-gray-800/70 rounded-lg border border-gray-700/50 px-2.5 py-1.5">
                      <div className="text-[9px] text-gray-500 font-medium">PnL %</div>
                      <div className={`font-bold ${pnlPct !== null && pnlPct > 0 ? 'text-emerald-400' : pnlPct !== null && pnlPct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                        {pnlPct !== null ? `${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(0)}%` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* PnL detailed */}
                  <div className="flex gap-2 text-[10px]">
                    <span className={`font-bold px-2.5 py-1 rounded-lg ${pnlColor(w.totalRealizedPnl)} ${w.totalRealizedPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      Realized: {w.totalRealizedPnl > 0 ? '+' : ''}{formatUsd(w.totalRealizedPnl)}
                    </span>
                    <span className={`font-bold px-2.5 py-1 rounded-lg ${pnlColor(w.totalUnrealizedPnl)} ${w.totalUnrealizedPnl >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                      Unrealized: {w.totalUnrealizedPnl > 0 ? '+' : ''}{formatUsd(w.totalUnrealizedPnl)}
                    </span>
                  </div>

                  {/* Wallet Trace Results */}
                  {traceLoading.has(w.address) && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <Loader2 size={14} className="animate-spin text-amber-400" />
                      <span className="text-[11px] text-amber-400">Śledzenie transferów SOL... (skanowanie ~200 transakcji)</span>
                    </div>
                  )}
                  {traceResults.has(w.address) && (() => {
                    const trace = traceResults.get(w.address)!
                    if (trace.error) return (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">
                        Błąd trace: {trace.error}
                      </div>
                    )
                    if (trace.destinations.length === 0) return (
                      <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-[11px] text-gray-400">
                        Brak wykrytych transferów SOL &gt; 0.01 w ostatnich {trace.txScanned} transakcjach
                      </div>
                    )
                    return (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 border-b border-amber-500/10 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ArrowRight size={12} className="text-amber-400" />
                            <span className="text-[11px] font-semibold text-amber-400">
                              Profit wysłany do {trace.destinations.length} wallet{trace.destinations.length > 1 ? 'ów' : 'a'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500">
                            Łącznie: <span className="text-amber-400 font-bold">{trace.totalSolTransferred.toFixed(1)} SOL</span>
                            {' · '}{trace.txScanned} tx przeskanowanych
                          </span>
                        </div>
                        <div className="divide-y divide-gray-800/50">
                          {trace.destinations.map((dest, di) => (
                            <div key={dest.address} className="px-3 py-2 flex items-center gap-3 hover:bg-gray-800/30 transition-colors">
                              <span className="text-gray-600 text-[10px] font-bold w-4 text-right">{di + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] text-gray-300">{shortAddr(dest.address)}</span>
                                  <button
                                    onClick={e => { e.stopPropagation(); onCopy(dest.address) }}
                                    className="text-gray-600 hover:text-gray-400 transition-colors"
                                    title="Kopiuj adres"
                                  >
                                    <Copy size={9} />
                                  </button>
                                  <a href={`https://gmgn.ai/sol/address/${dest.address}`} target="_blank" rel="noopener noreferrer"
                                    className="text-gray-600 hover:text-blue-400 transition-colors" title="GMGN">
                                    <ExternalLink size={9} />
                                  </a>
                                  <button
                                    onClick={e => { e.stopPropagation(); onBookmark(dest.address) }}
                                    className={`transition-colors ${bookmarks.has(dest.address) ? 'text-emerald-400' : 'text-gray-600 hover:text-orange-400'}`}
                                    title={bookmarks.has(dest.address) ? 'Już obserwowany' : 'Dodaj do My Wallets'}
                                  >
                                    {bookmarks.has(dest.address) ? <Check size={10} /> : <UserPlus size={10} />}
                                  </button>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px]">
                                  <span className="text-amber-400 font-bold">
                                    +{dest.totalSolReceived.toFixed(2)} SOL
                                  </span>
                                  <span className="text-gray-500">
                                    {dest.transferCount} transfer{dest.transferCount > 1 ? 'ów' : ''}
                                  </span>
                                  <span className="text-gray-500">
                                    ostatni: {new Date(dest.lastTransferAt * 1000).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[9px] text-gray-500">Saldo teraz</div>
                                <div className={`font-bold text-[11px] ${dest.currentSolBalance > 10 ? 'text-emerald-400' : 'text-gray-400'}`}>
                                  {dest.currentSolBalance.toFixed(2)} SOL
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Links */}
                  <div className="flex items-center justify-between text-[10px] pb-1">
                    <div className="flex items-center gap-3">
                      <a href={`https://gmgn.ai/sol/address/${w.address}`} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-medium">GMGN</a>
                      <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-medium">Solscan</a>
                    </div>
                    <span className="text-gray-500">Transakcje dla {w.tokens.length} token{w.tokens.length > 1 ? 'ow' : 'a'}</span>
                  </div>
                  <TradeHistory wallet={w.address} tokens={w.tokens} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enrichment, setEnrichment] = useState<any>(null)
  const [enrichLoading, setEnrichLoading] = useState(false)

  // Listen for prefill from TokenScanner
  useEffect(() => {
    const handler = (e: Event) => {
      const ca = (e as CustomEvent).detail as string
      if (ca) {
        setInput(prev => {
          const existing = prev.trim()
          if (existing.includes(ca)) return prev
          return existing ? `${existing}\n${ca}` : ca
        })
      }
    }
    window.addEventListener('analyzer-prefill', handler)
    return () => window.removeEventListener('analyzer-prefill', handler)
  }, [])

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

  const fetchEnrichment = useCallback(async (
    address: string, symbol: string, name: string, priceUsd: number,
  ) => {
    setEnrichLoading(true)
    try {
      const params = new URLSearchParams({
        address, symbol, name,
        price: priceUsd.toString(),
        validatePrice: 'true',
      })
      const res = await fetch(`/api/enrich-token?${params}`, { signal: AbortSignal.timeout(25000) })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      setEnrichment(data)
    } catch {
      setEnrichment(null)
    } finally {
      setEnrichLoading(false)
    }
  }, [])

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

  // Auto-enrich first token when analysis completes
  useEffect(() => {
    if (!result || result.wallets.length === 0) { setEnrichment(null); return }
    // Find the first token from the input
    const firstMint = input.split(/[\n,\s]+/).map(s => s.trim()).filter(s => s.length >= 20)[0]
    if (!firstMint) return
    // Try to find symbol/name from result wallets
    const hit = result.wallets[0]?.tokens?.[0]
    const symbol = hit?.symbol ?? 'UNKNOWN'
    const mcap = hit?.currentMcapUsd ?? 0
    // Estimate price from mcap (rough)
    fetchEnrichment(firstMint, symbol, symbol, mcap > 0 ? mcap / 1e9 : 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  return (
    <div className="space-y-3">
      {/* Input */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-sm font-semibold text-gray-200">Insider Wallet Analyzer</h2>
        </div>
        <div className="px-4 pb-3 space-y-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={"Wklej adresy mint tokenow (jeden na linie lub po przecinku)\nnp.:\nSo11111111111111111111111111111111111111112\nEPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
            className="w-full h-24 px-3 py-2 text-xs bg-gray-950 border border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 font-mono text-gray-300 placeholder:text-gray-600"
            disabled={loading}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500">Top 50 walletow | min. saldo $1K | bez botow i gield</p>
            <button
              onClick={analyze}
              disabled={loading || !input.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Analizuje...' : 'Analizuj'}
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-400">{statusText}</span>
            <span className="text-gray-500">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1 bg-gray-800" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 text-xs">{error}</p>
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
              <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-orange-500">{s.value}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Errors from processing */}
          {result.errors.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-2.5">
              <p className="text-yellow-400 text-[11px] font-medium mb-0.5">Ostrzezenia:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-yellow-400/80 text-[11px]">{e}</p>
              ))}
            </div>
          )}

          {/* Enrichment Panel */}
          {enrichLoading && (
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-1/3 mb-3" />
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-800 rounded" />)}
              </div>
            </div>
          )}

          {enrichment && !enrichLoading && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {enrichment.priceValidation?.warning && (
                <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-xs">
                  {enrichment.priceValidation.warning}
                </div>
              )}
              {enrichment.liquidityWarning && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs">
                  Niska likwidnosc — price impact przy $5k: {enrichment.priceImpact5kUsd?.toFixed(1)}%
                </div>
              )}

              {enrichment.isNewToken && (
                <div className="px-4 py-6 text-center text-gray-500 text-xs">
                  Token zbyt nowy — brak danych w zewnetrznych bazach
                </div>
              )}

              {enrichment.hasData && (
                <div className="divide-y divide-gray-800">
                  {(enrichment.twitterFollowers != null || enrichment.telegramUsers != null || enrichment.sentimentVotesUp != null) && (
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Social & Sentiment</h3>
                        <span className="text-[10px] text-gray-600">via {enrichment.dataSources?.join(', ')}</span>
                      </div>
                      <div className="flex gap-6">
                        {enrichment.twitterFollowers != null && (
                          <div>
                            <div className="text-sm font-bold text-gray-200 font-mono">
                              {enrichment.twitterFollowers >= 1000
                                ? `${(enrichment.twitterFollowers / 1000).toFixed(1)}K`
                                : String(enrichment.twitterFollowers)}
                            </div>
                            <div className="text-[10px] text-gray-500">Twitter</div>
                          </div>
                        )}
                        {enrichment.telegramUsers != null && (
                          <div>
                            <div className="text-sm font-bold text-gray-200 font-mono">
                              {enrichment.telegramUsers >= 1000
                                ? `${(enrichment.telegramUsers / 1000).toFixed(1)}K`
                                : String(enrichment.telegramUsers)}
                            </div>
                            <div className="text-[10px] text-gray-500">Telegram</div>
                          </div>
                        )}
                        {enrichment.sentimentVotesUp != null && (
                          <div>
                            <div className={`text-sm font-bold font-mono ${
                              enrichment.sentimentVotesUp > 60 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {enrichment.sentimentVotesUp.toFixed(0)}%
                            </div>
                            <div className="text-[10px] text-gray-500">Bullish</div>
                          </div>
                        )}
                      </div>
                      {enrichment.narrativeSentiment != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 shrink-0">Narracja</span>
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                enrichment.narrativeSentiment > 60 ? 'bg-emerald-500' :
                                enrichment.narrativeSentiment > 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${enrichment.narrativeSentiment}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">{enrichment.narrativeSentiment}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(Number(enrichment.githubStars) > 0 || Number(enrichment.githubCommits4w) > 0) && (
                    <div className="px-4 py-3">
                      <h3 className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Developer</h3>
                      <div className="flex gap-4 text-xs">
                        {Number(enrichment.githubStars) > 0 && (
                          <span className="text-gray-400">{enrichment.githubStars} stars</span>
                        )}
                        {Number(enrichment.githubCommits4w) > 0 && (
                          <span className={enrichment.githubCommits4w > 10 ? 'text-emerald-400' : 'text-gray-500'}>
                            {enrichment.githubCommits4w} commits/4w
                          </span>
                        )}
                        {enrichment.githubUrl && (
                          <a href={enrichment.githubUrl} target="_blank" rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300">GitHub</a>
                        )}
                      </div>
                    </div>
                  )}

                  {(enrichment.athUsd != null || enrichment.roi90d != null) && (
                    <div className="px-4 py-3">
                      <h3 className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">ATH & ROI</h3>
                      <div className="flex gap-4 text-xs flex-wrap items-center">
                        {enrichment.athUsd != null && (
                          <span className="text-gray-400">
                            ATH: <span className="text-gray-200 font-mono font-semibold">${enrichment.athUsd.toFixed(6)}</span>
                            {enrichment.athDate && (
                              <span className="text-gray-600 ml-1">({enrichment.athDate.split('T')[0]})</span>
                            )}
                          </span>
                        )}
                        {enrichment.athChangePercent != null && (
                          <span className={`font-medium ${enrichment.athChangePercent > -50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {enrichment.athChangePercent.toFixed(1)}% od ATH
                          </span>
                        )}
                        {enrichment.roi90d != null && (
                          <span className={`font-medium ${enrichment.roi90d > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ROI 90d: {enrichment.roi90d > 0 ? '+' : ''}{enrichment.roi90d.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {enrichment.recentNews?.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Newsy</h3>
                        <span className="text-[10px]">
                          <span className="text-emerald-400">{enrichment.newsPositiveCount}+</span>
                          {' / '}
                          <span className="text-red-400">{enrichment.newsNegativeCount}-</span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {enrichment.recentNews.slice(0, 3).map((n: any, i: number) => (
                          <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-start gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                            <span className={`shrink-0 mt-0.5 ${
                              n.sentiment === 'positive' ? 'text-emerald-400' :
                              n.sentiment === 'negative' ? 'text-red-400' : 'text-gray-600'
                            }`}>
                              {n.sentiment === 'positive' ? '+' : n.sentiment === 'negative' ? '-' : '~'}
                            </span>
                            <span className="line-clamp-1">{n.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {enrichment.categories?.slice(0, 4).map((cat: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] rounded-full">
                          {cat}
                        </span>
                      ))}
                    </div>
                    {enrichment.enrichmentDurationMs != null && (
                      <span className="text-[10px] text-gray-600 shrink-0 ml-2">
                        {enrichment.enrichmentDurationMs}ms · {enrichment.dataSources?.length ?? 0} src
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {result.wallets.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center text-gray-500 text-xs">
              Nie znaleziono walletow spelniajacych kryteria.
            </div>
          ) : (
            <WalletTable
              wallets={result.wallets}
              totalTokensAnalyzed={result.totalTokensAnalyzed ?? result.processedTokens}
              onCopy={copyAddr}
              onBookmark={toggleBookmark}
              bookmarks={bookmarks}
              copiedAddr={copiedAddr}
              expanded={expanded}
              onToggleExpand={toggleExpand}
            />
          )}

          <p className="text-[9px] text-gray-500 text-center">
            Dane z GMGN + DexScreener. Entry mcap to szacunek na podstawie avg cost. Nie jest to porada inwestycyjna.
          </p>
        </>
      )}
    </div>
  )
}
