'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, ExternalLink, Wallet, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Loader2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { loadBook, SavedWallet } from '@/lib/walletBook'
import type { WalletPositionsResult, WalletPosition } from '@/app/api/wallet-positions/route'
import { EnrichedTransaction, WalletTransactionsResult } from '@/app/api/wallet-transactions/route'

// ── Stablecoin / wrapped SOL addresses to exclude ───────────────────────────
const EXCLUDED_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'So11111111111111111111111111111111111111112',      // Wrapped SOL
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', // stSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1',  // bSOL
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF (wrapped)
  'USDhTjkUXFfigLELiFpbBQ6XUQN9Fnt2qWFBz9SUQr',   // USDh
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo', // PYUSD
])

const EXCLUDED_SYMBOLS = new Set([
  'USDC', 'USDT', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FRAX', 'LUSD', 'USDD',
  'USDe', 'USDh', 'PYUSD', 'GUSD', 'sUSD', 'cUSD', 'WBTC', 'WSOL',
])

function isStablecoinOrWrapped(tokenAddress: string, symbol: string): boolean {
  if (EXCLUDED_MINTS.has(tokenAddress)) return true
  const upper = symbol.toUpperCase()
  if (EXCLUDED_SYMBOLS.has(upper)) return true
  return false
}

// ── helpers ──────────────────────────────────────────────────────────────────

function avatarColor(address: string): string {
  let hash = 0
  for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 42%)`
}

function avatarInitials(wallet: SavedWallet): string {
  if (wallet.label) return wallet.label.slice(0, 2).toUpperCase()
  return wallet.address.slice(0, 2).toUpperCase()
}

function walletLabel(wallet: SavedWallet | undefined, address: string): string {
  if (wallet?.label) return wallet.label
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function fmtSol(n: number): string {
  return `${n.toFixed(3)} ◎`
}

function fmtMcap(n: number): string {
  if (!n || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function lastUpdatedLabel(ts: number | null): string {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'przed chwilą'
  if (diff < 3600) return `${Math.floor(diff / 60)} min temu`
  return `${Math.floor(diff / 3600)}h temu`
}

// ── sessionStorage cache ──────────────────────────────────────────────────
const CACHE_KEY = 'smwd_radar_data'

interface CachedRadarData {
  positionsEntries: [string, WalletPositionsResult][]
  txResults: WalletTransactionsResult[]
  lastUpdated: number
}

function saveRadarCache(
  positionsMap: Map<string, WalletPositionsResult>,
  txResults: WalletTransactionsResult[],
  lastUpdated: number,
): void {
  try {
    const data: CachedRadarData = {
      positionsEntries: [...positionsMap.entries()],
      txResults,
      lastUpdated,
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[radar-cache] save failed:', e)
  }
}

function loadRadarCache(): CachedRadarData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CachedRadarData
    if (!data.positionsEntries || !data.txResults || !data.lastUpdated) return null
    return data
  } catch {
    return null
  }
}

function clearRadarCache(): void {
  try { sessionStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

// Performance color for heat map tile
function perfColor(valueUsd: number): string {
  if (valueUsd >= 50_000) return 'bg-emerald-600 text-white'
  if (valueUsd >= 10_000) return 'bg-emerald-500 text-white'
  if (valueUsd >= 5_000) return 'bg-emerald-400 text-white'
  if (valueUsd >= 1_000) return 'bg-emerald-300 text-emerald-900'
  if (valueUsd >= 100) return 'bg-emerald-100 text-emerald-800'
  if (valueUsd > 0) return 'bg-gray-100 text-gray-600'
  return 'bg-gray-50 text-gray-400'
}

// ── types ────────────────────────────────────────────────────────────────────

interface AggregatedToken {
  tokenAddress: string
  symbol: string
  name: string
  logo: string
  totalValueUsd: number
  totalBalance: number
  lastPrice: number
  holdersCount: number
  holders: string[] // wallet addresses
}

interface WalletSummary {
  address: string
  label: string
  totalValueUsd: number
  solBalance: number
  solValueUsd: number
  positionsCount: number
  recentBuys: number
  topToken: string
  topTokenValue: number
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon }: { title: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{title}</span>
        <span className="text-gray-300">{icon}</span>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Heat Map Tile ────────────────────────────────────────────────────────────

function HeatMapTile({
  wallet,
  savedWallet,
  onClick,
  selected,
}: {
  wallet: WalletSummary
  savedWallet: SavedWallet | undefined
  onClick: () => void
  selected: boolean
}) {
  const color = perfColor(wallet.totalValueUsd)
  const initials = savedWallet ? avatarInitials(savedWallet) : wallet.address.slice(0, 2).toUpperCase()

  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl p-3 text-left transition-all duration-150 hover:scale-[1.02] hover:shadow-md ${color} ${
        selected ? 'ring-2 ring-orange-500 ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 border border-white/30"
          style={{ backgroundColor: avatarColor(wallet.address) }}
        >
          {initials}
        </div>
        <span className="text-xs font-semibold truncate">{wallet.label}</span>
      </div>
      <div className="text-sm font-bold">{fmtUsd(wallet.totalValueUsd)}</div>
      <div className="text-[10px] opacity-75 mt-0.5">
        {wallet.positionsCount} tokenów · {fmtSol(wallet.solBalance)}
      </div>
      {wallet.recentBuys > 0 && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange-500 text-white text-[8px] font-bold flex items-center justify-center">
          {wallet.recentBuys}
        </div>
      )}
    </button>
  )
}

// ── Activity Bar Chart ───────────────────────────────────────────────────────

interface ActivityDayData {
  label: string
  buys: number
  tokens: { symbol: string; solAmount: number; marketCapAtBuy: number; tokenAddress: string }[]
}

function ActivityChart({ data }: { data: ActivityDayData[] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  if (data.length === 0) return null

  const selected = selectedIdx !== null ? data[selectedIdx] : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-3">Aktywność zakupowa (ostatnie 7 dni)</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8 }}
            formatter={(value: number | undefined) => [`${value ?? 0} zakupów`, 'Zakupy']}
          />
          <Bar
            dataKey="buys"
            radius={[4, 4, 0, 0]}
            onClick={(_: unknown, idx: number) => setSelectedIdx(prev => prev === idx ? null : idx)}
            className="cursor-pointer"
          >
            {data.map((entry, idx) => (
              <Cell key={idx} fill={selectedIdx === idx ? '#ea580c' : entry.buys > 0 ? '#f97316' : '#e5e7eb'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Day detail popup */}
      {selected && selected.tokens.length > 0 && (
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-gray-400 uppercase font-medium">{selected.label} — {selected.tokens.length} zakupów</div>
            <button onClick={() => setSelectedIdx(null)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">✕</button>
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {selected.tokens.map((tok, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 bg-white rounded-md">
                <div>
                  <span className="font-medium text-gray-700">{tok.symbol}</span>
                  <span className="text-gray-400 ml-1.5">{fmtMcap(tok.marketCapAtBuy)}</span>
                </div>
                <span className="font-mono text-gray-600">{tok.solAmount.toFixed(2)} SOL</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Portfolio Balance Chart ──────────────────────────────────────────────────

function PortfolioChart({ wallets }: { wallets: WalletSummary[] }) {
  // Simple breakdown by wallet for stacked display
  const sorted = [...wallets].sort((a, b) => b.totalValueUsd - a.totalValueUsd).slice(0, 10)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-3">Rozkład portfela</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtUsd(v)} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} width={80} />
          <Tooltip
            contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 8 }}
            formatter={(value: number | undefined) => [fmtUsd(value ?? 0), 'Wartość']}
          />
          <Bar dataKey="totalValueUsd" radius={[0, 4, 4, 0]}>
            {sorted.map((_, idx) => (
              <Cell key={idx} fill={`hsl(${160 + idx * 15}, 50%, ${45 + idx * 3}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Top Tokens Table ─────────────────────────────────────────────────────────

function TopTokensTable({
  tokens,
  walletMap,
}: {
  tokens: AggregatedToken[]
  walletMap: Map<string, SavedWallet>
}) {
  if (tokens.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Aktualnie trzymane tokeny (Top 15)</span>
      </div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,1fr)] gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div>Token</div>
        <div className="text-right">Wartość</div>
        <div className="text-right">Cena</div>
        <div className="text-right">Holdery</div>
        <div>Kto trzyma</div>
      </div>
      {tokens.map(token => (
        <div
          key={token.tokenAddress}
          className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,1fr)] gap-2 items-center px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            {token.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={token.logo} alt="" className="w-6 h-6 rounded-full bg-gray-100 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500 shrink-0">
                {token.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-gray-900 font-semibold text-xs leading-none">{token.symbol}</div>
              <div className="text-gray-400 text-[10px] truncate">{token.name}</div>
            </div>
          </div>
          <div className="text-right font-mono text-xs font-semibold text-gray-800">{fmtUsd(token.totalValueUsd)}</div>
          <div className="text-right font-mono text-[11px] text-gray-500">{token.lastPrice >= 0.01 ? `$${token.lastPrice.toFixed(4)}` : `$${token.lastPrice.toExponential(2)}`}</div>
          <div className="text-right text-xs text-gray-600 font-medium">{token.holdersCount}</div>
          <div className="flex items-center -space-x-1">
            {token.holders.slice(0, 4).map(addr => {
              const w = walletMap.get(addr)
              return (
                <div
                  key={addr}
                  className="w-5 h-5 rounded-full border border-white flex items-center justify-center text-white text-[8px] font-bold shrink-0"
                  style={{ backgroundColor: avatarColor(addr) }}
                  title={walletLabel(w, addr)}
                >
                  {w ? avatarInitials(w) : addr.slice(0, 2).toUpperCase()}
                </div>
              )
            })}
            {token.holders.length > 4 && (
              <div className="w-5 h-5 rounded-full border border-white bg-gray-200 flex items-center justify-center text-gray-500 text-[8px] font-bold shrink-0">
                +{token.holders.length - 4}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Wallet Detail Panel ──────────────────────────────────────────────────────

function WalletDetailPanel({
  address,
  positions,
  transactions,
  walletMap,
  onClose,
}: {
  address: string
  positions: WalletPositionsResult | undefined
  transactions: EnrichedTransaction[]
  walletMap: Map<string, SavedWallet>
  onClose: () => void
}) {
  const w = walletMap.get(address)
  const label = walletLabel(w, address)
  const [expandedTxIdx, setExpandedTxIdx] = useState<number | null>(null)

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ backgroundColor: avatarColor(address) }}
          >
            {w ? avatarInitials(w) : address.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">{label}</div>
            <div className="text-[10px] text-gray-400 font-mono">{address.slice(0, 8)}…{address.slice(-6)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://solscan.io/account/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-orange-500 transition-colors"
          >
            <ExternalLink size={14} />
          </a>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm font-bold">✕</button>
        </div>
      </div>

      {positions && (
        <div className="p-4 space-y-3">
          {/* Balance summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-[10px] text-gray-400 uppercase">Portfolio</div>
              <div className="text-sm font-bold text-gray-900">{fmtUsd(positions.totalValueUsd)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-[10px] text-gray-400 uppercase">SOL</div>
              <div className="text-sm font-bold text-gray-900">{fmtSol(positions.solBalance)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-[10px] text-gray-400 uppercase">Tokeny</div>
              <div className="text-sm font-bold text-gray-900">{positions.positions.length}</div>
            </div>
          </div>

          {/* Top positions (≥$500, no stablecoins) */}
          {positions.positions.filter(p => p.usdValue >= 500 && !isStablecoinOrWrapped(p.tokenAddress, p.symbol)).length > 0 && (
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Pozycje (&ge;$500)</div>
              <div className="space-y-1">
                {positions.positions.filter(p => p.usdValue >= 500 && !isStablecoinOrWrapped(p.tokenAddress, p.symbol)).slice(0, 8).map(pos => (
                  <div key={pos.tokenAddress} className="text-xs px-2 py-1.5 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{pos.symbol}</span>
                      <span className="font-mono text-gray-800 font-semibold">{fmtUsd(pos.usdValue)}</span>
                    </div>
                    <button
                      className="text-[9px] font-mono text-gray-400 hover:text-orange-500 transition-colors mt-0.5"
                      onClick={() => navigator.clipboard.writeText(pos.tokenAddress)}
                      title="Kliknij aby skopiować CA"
                    >
                      CA: {pos.tokenAddress.slice(0, 6)}…{pos.tokenAddress.slice(-4)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions (no stablecoins) */}
          {transactions.filter(tx => !isStablecoinOrWrapped(tx.tokenAddress, tx.tokenSymbol)).length > 0 && (
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Ostatnie zakupy</div>
              <div className="space-y-1">
                {transactions.filter(tx => !isStablecoinOrWrapped(tx.tokenAddress, tx.tokenSymbol)).slice(0, 5).map((tx, i) => (
                  <div key={i}>
                    <div
                      className="flex items-center justify-between text-xs px-2 py-1.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setExpandedTxIdx(prev => prev === i ? null : i)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-700">{tx.tokenSymbol}</span>
                        <span className="text-gray-400">{timeAgo(tx.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-500">{fmtMcap(tx.marketCapAtBuy)}</span>
                        {tx.pnlPercent !== 0 && (
                          <span className={`font-mono font-semibold ${tx.pnlPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.pnlPercent >= 0 ? '+' : ''}{tx.pnlPercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {expandedTxIdx === i && (
                      <button
                        className="w-full text-left text-[9px] font-mono text-gray-400 hover:text-orange-500 transition-colors px-2 py-1 bg-gray-100 rounded-b-lg -mt-0.5"
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(tx.tokenAddress) }}
                        title="Kliknij aby skopiować CA"
                      >
                        CA: {tx.tokenAddress}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!positions && (
        <div className="p-6 text-center text-gray-400 text-sm">Ładowanie danych…</div>
      )}
    </div>
  )
}

// ── Top Movers ───────────────────────────────────────────────────────────────

function TopMovers({ transactions }: { transactions: EnrichedTransaction[] }) {
  // Group transactions by token and find best/worst performers
  const byToken = new Map<string, { symbol: string; logo: string; pnlPercent: number; pnlUsd: number; wallets: Set<string> }>()
  for (const tx of transactions) {
    const existing = byToken.get(tx.tokenAddress)
    if (existing) {
      if (Math.abs(tx.pnlPercent) > Math.abs(existing.pnlPercent)) {
        existing.pnlPercent = tx.pnlPercent
        existing.pnlUsd = tx.pnlUsd
      }
      existing.wallets.add(tx.walletAddress)
    } else {
      byToken.set(tx.tokenAddress, {
        symbol: tx.tokenSymbol,
        logo: tx.tokenLogo,
        pnlPercent: tx.pnlPercent,
        pnlUsd: tx.pnlUsd,
        wallets: new Set([tx.walletAddress]),
      })
    }
  }

  const sorted = [...byToken.values()]
    .filter(t => t.pnlPercent !== 0)
    .sort((a, b) => b.pnlPercent - a.pnlPercent)

  const gainers = sorted.filter(t => t.pnlPercent > 0).slice(0, 5)
  const losers = sorted.filter(t => t.pnlPercent < 0).reverse().slice(0, 5)

  if (gainers.length === 0 && losers.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {gainers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowUpRight size={14} className="text-emerald-500" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Top Gainers</span>
          </div>
          <div className="space-y-1.5">
            {gainers.map(t => (
              <div key={t.symbol} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo} alt="" className="w-5 h-5 rounded-full bg-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500">{t.symbol.slice(0, 2)}</div>
                  )}
                  <span className="font-medium text-gray-700">{t.symbol}</span>
                  <span className="text-gray-400 text-[10px]">{t.wallets.size} wallet{t.wallets.size > 1 ? 'ów' : ''}</span>
                </div>
                <span className="font-mono font-bold text-emerald-600">+{t.pnlPercent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {losers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <ArrowDownRight size={14} className="text-red-500" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Top Losers</span>
          </div>
          <div className="space-y-1.5">
            {losers.map(t => (
              <div key={t.symbol} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo} alt="" className="w-5 h-5 rounded-full bg-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500">{t.symbol.slice(0, 2)}</div>
                  )}
                  <span className="font-medium text-gray-700">{t.symbol}</span>
                  <span className="text-gray-400 text-[10px]">{t.wallets.size} wallet{t.wallets.size > 1 ? 'ów' : ''}</span>
                </div>
                <span className="font-mono font-bold text-red-500">{t.pnlPercent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compact Wallet Table ─────────────────────────────────────────────────────

function WalletTable({
  wallets,
  walletMap,
  selectedAddress,
  onSelect,
  sortKey,
  onSort,
}: {
  wallets: WalletSummary[]
  walletMap: Map<string, SavedWallet>
  selectedAddress: string | null
  onSelect: (address: string) => void
  sortKey: string
  onSort: (key: string) => void
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Wszystkie wallety</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.6fr)] gap-2 items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wider font-medium">
        <div>Wallet</div>
        <button className="text-right hover:text-gray-600" onClick={() => onSort('value')}>
          Wartość {sortKey === 'value' && '↓'}
        </button>
        <button className="text-right hover:text-gray-600" onClick={() => onSort('sol')}>
          SOL {sortKey === 'sol' && '↓'}
        </button>
        <button className="text-right hover:text-gray-600" onClick={() => onSort('tokens')}>
          Tokeny {sortKey === 'tokens' && '↓'}
        </button>
        <div className="text-right">Top token</div>
        <button className="text-right hover:text-gray-600" onClick={() => onSort('buys')}>
          Zakupy {sortKey === 'buys' && '↓'}
        </button>
      </div>
      {wallets.map(ws => {
        const sw = walletMap.get(ws.address)
        return (
          <button
            key={ws.address}
            onClick={() => onSelect(ws.address)}
            className={`w-full grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.6fr)] gap-2 items-center px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-sm text-left ${
              selectedAddress === ws.address ? 'bg-orange-50' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                style={{ backgroundColor: avatarColor(ws.address) }}
              >
                {sw ? avatarInitials(sw) : ws.address.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-gray-700 truncate">{ws.label}</span>
            </div>
            <div className="text-right font-mono text-xs font-semibold text-gray-800">{fmtUsd(ws.totalValueUsd)}</div>
            <div className="text-right font-mono text-xs text-gray-500">{fmtSol(ws.solBalance)}</div>
            <div className="text-right text-xs text-gray-600">{ws.positionsCount}</div>
            <div className="text-right text-xs text-gray-500 truncate">{ws.topToken || '—'} {ws.topTokenValue > 0 ? <span className="text-gray-400">({fmtUsd(ws.topTokenValue)})</span> : ''}</div>
            <div className="text-right">
              {ws.recentBuys > 0 ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                  {ws.recentBuys}
                </span>
              ) : (
                <span className="text-gray-300 text-xs">0</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

export default function WalletActivityDashboard() {
  const [wallets, setWallets] = useState<SavedWallet[]>([])
  const [positionsMap, setPositionsMap] = useState<Map<string, WalletPositionsResult>>(new Map())
  const [txResults, setTxResults] = useState<WalletTransactionsResult[]>([])
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('value')

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [fromCache, setFromCache] = useState(false)

  useEffect(() => {
    setWallets(loadBook())

    // Restore cached radar data on mount
    const cached = loadRadarCache()
    if (cached) {
      setPositionsMap(new Map(cached.positionsEntries))
      setTxResults(cached.txResults)
      setLastUpdated(cached.lastUpdated)
      setFromCache(true)
    }

    const onUpdate = () => {
      const newWallets = loadBook()
      setWallets(newWallets)
      // If wallet list changed, invalidate cache
      const c = loadRadarCache()
      if (c) {
        const cachedAddrs = new Set(c.positionsEntries.map(([addr]) => addr))
        const currentAddrs = new Set(newWallets.map(w => w.address))
        if (cachedAddrs.size !== currentAddrs.size || [...cachedAddrs].some(a => !currentAddrs.has(a))) {
          clearRadarCache()
        }
      }
    }
    window.addEventListener('wallet-book-updated', onUpdate)
    return () => window.removeEventListener('wallet-book-updated', onUpdate)
  }, [])

  const walletMap = useMemo(
    () => new Map(wallets.map(w => [w.address, w])),
    [wallets],
  )

  // ── Aggregated data ──────────────────────────────────────────────────────

  const walletSummaries = useMemo<WalletSummary[]>(() => {
    const txByWallet = new Map<string, EnrichedTransaction[]>()
    for (const r of txResults) {
      txByWallet.set(r.address, r.transactions)
    }

    return wallets.map(w => {
      const pos = positionsMap.get(w.address)
      const txs = (txByWallet.get(w.address) ?? []).filter(tx => !isStablecoinOrWrapped(tx.tokenAddress, tx.tokenSymbol))
      const filteredPositions = pos?.positions?.filter(p => !isStablecoinOrWrapped(p.tokenAddress, p.symbol) && p.usdValue >= 500) ?? []
      const topPos = filteredPositions[0]

      return {
        address: w.address,
        label: walletLabel(w, w.address),
        totalValueUsd: pos?.totalValueUsd ?? 0,
        solBalance: pos?.solBalance ?? 0,
        solValueUsd: pos?.solValueUsd ?? 0,
        positionsCount: filteredPositions.length,
        recentBuys: txs.length,
        topToken: topPos?.symbol ?? '',
        topTokenValue: topPos?.usdValue ?? 0,
      }
    })
  }, [wallets, positionsMap, txResults, walletMap])

  const sortedWalletSummaries = useMemo(() => {
    const copy = [...walletSummaries]
    switch (sortKey) {
      case 'value': return copy.sort((a, b) => b.totalValueUsd - a.totalValueUsd)
      case 'sol': return copy.sort((a, b) => b.solBalance - a.solBalance)
      case 'tokens': return copy.sort((a, b) => b.positionsCount - a.positionsCount)
      case 'buys': return copy.sort((a, b) => b.recentBuys - a.recentBuys)
      default: return copy
    }
  }, [walletSummaries, sortKey])

  const aggregatedTokens = useMemo<AggregatedToken[]>(() => {
    const byToken = new Map<string, AggregatedToken>()
    for (const [addr, posResult] of positionsMap.entries()) {
      for (const pos of posResult.positions) {
        // Skip stablecoins and positions < $500
        if (isStablecoinOrWrapped(pos.tokenAddress, pos.symbol)) continue
        if (pos.usdValue < 500) continue
        const existing = byToken.get(pos.tokenAddress)
        if (existing) {
          existing.totalValueUsd += pos.usdValue
          existing.totalBalance += pos.balance
          existing.holdersCount++
          existing.holders.push(addr)
        } else {
          byToken.set(pos.tokenAddress, {
            tokenAddress: pos.tokenAddress,
            symbol: pos.symbol,
            name: pos.name,
            logo: pos.logo,
            totalValueUsd: pos.usdValue,
            totalBalance: pos.balance,
            lastPrice: pos.lastPrice,
            holdersCount: 1,
            holders: [addr],
          })
        }
      }
    }
    return [...byToken.values()]
      .sort((a, b) => b.totalValueUsd - a.totalValueUsd)
      .slice(0, 15)
  }, [positionsMap])

  const allTransactions = useMemo(
    () => txResults
      .flatMap(r => r.transactions)
      .filter(tx => !isStablecoinOrWrapped(tx.tokenAddress, tx.tokenSymbol))
      .sort((a, b) => b.timestamp - a.timestamp),
    [txResults],
  )

  // Activity chart: group buys by day (with token details for click popup)
  const activityData = useMemo(() => {
    const days: { label: string; buys: number; tokens: { symbol: string; solAmount: number; marketCapAtBuy: number; tokenAddress: string }[] }[] = []
    const now = Date.now()
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 86400_000)
      const dayLabel = dayStart.toLocaleDateString('pl-PL', { weekday: 'short' })
      const dayStartTs = Math.floor(dayStart.setHours(0, 0, 0, 0) / 1000)
      const dayEndTs = dayStartTs + 86400
      const dayTxs = allTransactions.filter(tx => tx.timestamp >= dayStartTs && tx.timestamp < dayEndTs)
      days.push({
        label: dayLabel,
        buys: dayTxs.length,
        tokens: dayTxs.map(tx => ({
          symbol: tx.tokenSymbol,
          solAmount: tx.solAmount,
          marketCapAtBuy: tx.marketCapAtBuy,
          tokenAddress: tx.tokenAddress,
        })),
      })
    }
    return days
  }, [allTransactions])

  // Stats
  const totalPortfolioValue = useMemo(() => walletSummaries.reduce((s, w) => s + w.totalValueUsd, 0), [walletSummaries])
  const totalBuys = allTransactions.length
  const activeWallets = walletSummaries.filter(w => w.recentBuys > 0).length

  // ── Fetch data ───────────────────────────────────────────────────────────

  const runFetch = useCallback(async () => {
    if (wallets.length === 0) return

    setLoading(true)
    setProgress(0)
    setProgressLabel('Pobieranie pozycji…')
    setSelectedWallet(null)

    const total = wallets.length
    const newPositions = new Map<string, WalletPositionsResult>()
    const newTx: WalletTransactionsResult[] = []

    // ── Phase 1 (0-40%): Fetch positions in batches of 5 ──
    for (let i = 0; i < wallets.length; i += 5) {
      const batch = wallets.slice(i, i + 5)
      const addrs = batch.map(w => w.address).join(',')
      setProgressLabel(`Pozycje ${Math.min(i + 5, total)}/${total}…`)
      setProgress(Math.round(((Math.min(i + 5, total)) / total) * 40))

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30_000)
        const res = await fetch(`/api/wallet-positions?addresses=${addrs}`, { signal: controller.signal })
        clearTimeout(timeoutId)
        const data = await res.json()
        if (res.ok && data.wallets) {
          for (const wr of data.wallets as WalletPositionsResult[]) {
            newPositions.set(wr.address, wr)
          }
        }
      } catch (e) {
        console.warn('[radar] positions batch failed:', e)
      }
    }
    setPositionsMap(newPositions)

    // ── Phase 2 (40-100%): Fetch transactions in parallel batches of 3 ──
    const TX_BATCH = 3
    let completedTx = 0

    for (let i = 0; i < wallets.length; i += TX_BATCH) {
      const batch = wallets.slice(i, i + TX_BATCH)

      const promises = batch.map(async (w) => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 45_000)
          const res = await fetch(
            `/api/wallet-transactions?addresses=${w.address}&period=7d`,
            { signal: controller.signal },
          )
          clearTimeout(timeoutId)
          const data = await res.json()
          if (res.ok && data.wallets) {
            return data.wallets as WalletTransactionsResult[]
          }
        } catch (e) {
          console.warn(`[radar] tx fetch failed for ${w.label || w.address.slice(0, 8)}:`, e)
        }
        return [] as WalletTransactionsResult[]
      })

      const results = await Promise.allSettled(promises)
      for (const result of results) {
        if (result.status === 'fulfilled') {
          newTx.push(...result.value)
        }
        completedTx++
      }

      setProgressLabel(`Transakcje ${Math.min(completedTx, total)}/${total}…`)
      setProgress(40 + Math.round((completedTx / total) * 60))
      setTxResults([...newTx])
    }

    // ── Done: save to cache ──
    const now = Date.now()
    setProgress(100)
    setProgressLabel('Gotowe!')
    setLastUpdated(now)
    setFromCache(false)
    setLoading(false)
    saveRadarCache(newPositions, newTx, now)
  }, [wallets])

  // ── EMPTY STATE ──────────────────────────────────────────────────────────

  if (wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Wallet size={48} className="text-gray-200" />
        <p className="text-gray-500 text-sm">Brak walletów do śledzenia</p>
        <p className="text-gray-400 text-xs">Dodaj wallety w zakładce My Wallets</p>
      </div>
    )
  }

  const hasData = positionsMap.size > 0

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Wallet Radar</h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Przegląd portfeli, aktywności i trzymanych tokenów · {wallets.length} walletów
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated && !loading && (
            <span className="text-gray-400 text-xs hidden sm:inline">
              {lastUpdatedLabel(lastUpdated)}{fromCache ? ' (z cache)' : ''}
            </span>
          )}
          <button
            onClick={runFetch}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Skanuj
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">{progressLabel}</span>
            <span className="text-gray-400 font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-orange-400 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Not loaded yet ── */}
      {!hasData && !loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">
            Kliknij <span className="font-semibold text-orange-600">Skanuj</span> aby załadować dane portfeli
          </p>
        </div>
      )}

      {/* ── Dashboard content ── */}
      {hasData && (
        <div className="space-y-5">

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              title="Łączna wartość"
              value={fmtUsd(totalPortfolioValue)}
              sub={`${wallets.length} walletów`}
              icon={<Wallet size={16} />}
            />
            <StatCard
              title="Aktywne wallety"
              value={`${activeWallets}/${wallets.length}`}
              sub="z zakupami w 7d"
              icon={<TrendingUp size={16} />}
            />
            <StatCard
              title="Zakupy (7d)"
              value={`${totalBuys}`}
              sub={`${aggregatedTokens.length} unikalnych tokenów`}
              icon={<TrendingUp size={16} />}
            />
            <StatCard
              title="Unikalne tokeny"
              value={`${aggregatedTokens.length}`}
              sub="trzymane przez wallety"
              icon={<TrendingDown size={16} />}
            />
          </div>

          {/* Heat map */}
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-2">Heat mapa portfeli</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {sortedWalletSummaries.map(ws => (
                <HeatMapTile
                  key={ws.address}
                  wallet={ws}
                  savedWallet={walletMap.get(ws.address)}
                  onClick={() => setSelectedWallet(selectedWallet === ws.address ? null : ws.address)}
                  selected={selectedWallet === ws.address}
                />
              ))}
            </div>
          </div>

          {/* Selected wallet detail */}
          {selectedWallet && (
            <WalletDetailPanel
              address={selectedWallet}
              positions={positionsMap.get(selectedWallet)}
              transactions={allTransactions.filter(tx => tx.walletAddress === selectedWallet)}
              walletMap={walletMap}
              onClose={() => setSelectedWallet(null)}
            />
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActivityChart data={activityData} />
            <PortfolioChart wallets={sortedWalletSummaries} />
          </div>

          {/* Top Movers */}
          <TopMovers transactions={allTransactions} />

          {/* Top tokens held */}
          <TopTokensTable tokens={aggregatedTokens} walletMap={walletMap} />

          {/* Full wallet table */}
          <WalletTable
            wallets={sortedWalletSummaries}
            walletMap={walletMap}
            selectedAddress={selectedWallet}
            onSelect={(addr) => setSelectedWallet(selectedWallet === addr ? null : addr)}
            sortKey={sortKey}
            onSort={setSortKey}
          />

        </div>
      )}

    </div>
  )
}
