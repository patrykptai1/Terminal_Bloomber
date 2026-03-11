'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ExternalLink, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface WalletToken {
  mint: string
  symbol: string
  name: string
  balance: number
  priceUsd: number
  valueUsd: number
  fdv: number
  pairAddress: string
}

interface GmgnStats {
  realizedProfit: number
  unrealizedProfit: number
  pnl7d: number
  pnl30d: number
  winRate: number | null
  buy30d: number
  sell30d: number
  totalProfit: number
  tags: string[]
}

interface WalletData {
  address: string
  solBalance: number
  solPrice: number
  solValueUsd: number
  tokensValueUsd: number
  totalValueUsd: number
  tokenCount: number
  tokens: WalletToken[]
  gmgn: GmgnStats | null
}

interface TxItem {
  txHash: string
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  tokenLogo: string
  tokenAmount: number
  timestamp: number
  walletAddress: string
  solAmount: number
  marketCapAtBuy: number
  priceAtBuy: number
  marketCapNow: number
  priceNow: number
  pnlPercent: number
  pnlUsd: number
  dexUrl: string
  gmgnUrl: string
}

function fmt(n: number, decimals = 2) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(decimals)}`
}

function fmtPnl(n: number) {
  const s = fmt(Math.abs(n))
  return n >= 0 ? `+${s}` : `-${s}`
}

function fmtBalance(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(2)}K`
  if (n >= 1)             return n.toFixed(2)
  return n.toPrecision(3)
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
  if (diff < 60) return `${diff}s temu`
  if (diff < 3600) return `${Math.floor(diff / 60)}m temu`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h temu`
  return `${Math.floor(diff / 86400)}d temu`
}

type SubTab = 'holdings' | 'transactions'

const MIN_TOKEN_VALUE = 1000

export default function WalletInspector() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<WalletData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Sub-tab state
  const [subTab, setSubTab] = useState<SubTab>('holdings')

  // Transactions state
  const [txLoading, setTxLoading] = useState(false)
  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [txError, setTxError] = useState<string | null>(null)
  const [txFetched, setTxFetched] = useState(false)

  const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  const isValid = SOLANA_RE.test(input.trim())

  const analyze = async () => {
    const address = input.trim()
    if (!isValid) return
    setLoading(true)
    setError(null)
    setData(null)
    setTransactions([])
    setTxFetched(false)
    setTxError(null)
    setSubTab('holdings')
    try {
      const res = await fetch(`/api/wallet?address=${address}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async () => {
    if (!data || txFetched) return
    setTxLoading(true)
    setTxError(null)
    try {
      const res = await fetch(`/api/wallet-transactions?addresses=${data.address}&period=1d`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      const wallets = json.wallets ?? []
      const allTx: TxItem[] = wallets.flatMap((w: { transactions: TxItem[] }) => w.transactions ?? [])
      allTx.sort((a: TxItem, b: TxItem) => b.timestamp - a.timestamp)
      setTransactions(allTx)
      setTxFetched(true)
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setTxLoading(false)
    }
  }

  const handleSubTab = (tab: SubTab) => {
    setSubTab(tab)
    if (tab === 'transactions' && !txFetched && !txLoading) {
      fetchTransactions()
    }
  }

  // Filter tokens >$1K
  const filteredTokens = useMemo(() => {
    if (!data) return []
    return data.tokens.filter(t => t.valueUsd >= MIN_TOKEN_VALUE)
  }, [data])

  const hiddenCount = data ? data.tokens.length - filteredTokens.length : 0

  const copyAddress = (addr: string) => {
    const copy = (text: string) => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => fallback(text))
      } else {
        fallback(text)
      }
    }
    const fallback = (text: string) => {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    copy(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Input */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm text-gray-600">
            Wklej adres portfela Solana aby sprawdzić jego aktualne holdings i wartość.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isValid && !loading && analyze()}
              placeholder="Adres portfela Solana (np. ABC...XYZ)"
              className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500"
            />
            <Button
              onClick={analyze}
              disabled={!isValid || loading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? 'Ładowanie...' : 'Sprawdź'}
            </Button>
          </div>
          {input && !isValid && (
            <p className="text-xs text-red-600">Nieprawidłowy adres Solana</p>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <p className="text-red-600 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Wallet header */}
          <div className="flex items-center gap-3 px-1">
            <a
              href={`https://solscan.io/account/${data.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-blue-600 hover:underline"
            >
              {data.address.slice(0, 6)}...{data.address.slice(-6)}
            </a>
            <button
              onClick={() => copyAddress(data.address)}
              className="text-gray-400 hover:text-gray-700 text-xs transition-colors"
            >
              {copied ? '✓' : '⧉'}
            </button>
            {data.gmgn?.tags?.map(tag => (
              <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {tag}
              </span>
            ))}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-xl font-bold text-orange-600">{fmt(data.totalValueUsd)}</div>
                <div className="text-xs text-gray-500 mt-0.5">Łączna wartość portfela</div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-4 pb-3">
                <div className="text-xl font-bold text-blue-600">
                  {data.solBalance.toFixed(3)} SOL
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{fmt(data.solValueUsd)} · ${data.solPrice.toFixed(2)}/SOL</div>
              </CardContent>
            </Card>
            {data.gmgn && (
              <>
                <Card className="bg-white border-gray-200">
                  <CardContent className="pt-4 pb-3">
                    <div className={`text-xl font-bold ${data.gmgn.realizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtPnl(data.gmgn.realizedProfit)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Realized PnL (all-time)</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-200">
                  <CardContent className="pt-4 pb-3">
                    <div className={`text-xl font-bold ${data.gmgn.pnl30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtPnl(data.gmgn.pnl30d)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      PnL 30d · {data.gmgn.winRate != null ? `wr ${(data.gmgn.winRate * 100).toFixed(0)}%` : 'wr N/A'}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Sub-tabs: Holdings / Transakcje */}
          <div className="flex gap-1 px-1">
            <button
              onClick={() => handleSubTab('holdings')}
              className={`px-4 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                subTab === 'holdings'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Holdings ({filteredTokens.length})
            </button>
            <button
              onClick={() => handleSubTab('transactions')}
              className={`px-4 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                subTab === 'transactions'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Transakcje (24h)
              {txFetched && <span className="ml-1 opacity-80">({transactions.length})</span>}
            </button>
          </div>

          {/* ── Holdings Tab ── */}
          {subTab === 'holdings' && (
            <Card className="bg-white border-gray-200">
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Tokeny w portfelu ({filteredTokens.length})
                  </span>
                  <span className="text-xs text-gray-400">
                    Ukryto {hiddenCount} tokenów &lt;${MIN_TOKEN_VALUE.toLocaleString()} · ceny: DexScreener
                  </span>
                </div>

                {filteredTokens.length === 0 && data.solBalance <= 0 ? (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    Brak tokenów powyżej ${MIN_TOKEN_VALUE.toLocaleString()}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-200 hover:bg-transparent">
                          <TableHead className="text-gray-500">#</TableHead>
                          <TableHead className="text-gray-500">Token</TableHead>
                          <TableHead className="text-gray-500 text-right">Saldo</TableHead>
                          <TableHead className="text-gray-500 text-right">Cena</TableHead>
                          <TableHead className="text-gray-500 text-right">Wartość USD</TableHead>
                          <TableHead className="text-gray-500 text-right">% portfela</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* SOL row first — only if >=1K */}
                        {data.solValueUsd >= MIN_TOKEN_VALUE && (
                          <TableRow className="border-gray-200 hover:bg-gray-50">
                            <TableCell className="text-gray-500 text-sm">—</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">SOL</span>
                                <span className="text-xs text-gray-500">Solana</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-gray-700">
                              {data.solBalance.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-gray-500 text-sm">
                              ${data.solPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-gray-800">
                              {fmt(data.solValueUsd)}
                            </TableCell>
                            <TableCell className="text-right text-gray-500 text-sm">
                              {data.totalValueUsd > 0
                                ? `${((data.solValueUsd / data.totalValueUsd) * 100).toFixed(1)}%`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        )}
                        {filteredTokens.map((token, i) => (
                          <TableRow key={token.mint} className="border-gray-200 hover:bg-gray-50">
                            <TableCell className="text-gray-500 text-sm">{i + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <a
                                  href={`https://dexscreener.com/solana/${token.pairAddress || token.mint}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-gray-800 hover:text-blue-600"
                                >
                                  {token.symbol}
                                </a>
                                <span className="text-xs text-gray-400 hidden sm:inline truncate max-w-[120px]">
                                  {token.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-gray-700">
                              {fmtBalance(token.balance)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-gray-500 text-sm">
                              {token.priceUsd > 0
                                ? token.priceUsd < 0.000001
                                  ? `$${token.priceUsd.toExponential(2)}`
                                  : `$${token.priceUsd.toPrecision(4)}`
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-gray-800">
                              {fmt(token.valueUsd)}
                            </TableCell>
                            <TableCell className="text-right text-gray-500 text-sm">
                              {data.totalValueUsd > 0
                                ? `${((token.valueUsd / data.totalValueUsd) * 100).toFixed(1)}%`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Transactions Tab ── */}
          {subTab === 'transactions' && (
            <Card className="bg-white border-gray-200">
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-700">
                    Zakupy — ostatnie 24h
                  </span>
                  {txFetched && (
                    <span className="text-xs text-gray-400">
                      {transactions.length} transakcji · tylko tokeny nadal trzymane
                    </span>
                  )}
                </div>

                {/* Loading state */}
                {txLoading && (
                  <div className="flex items-center justify-center gap-2 py-12">
                    <Loader2 size={18} className="animate-spin text-orange-500" />
                    <span className="text-sm text-gray-500">Pobieranie transakcji z Solana RPC...</span>
                  </div>
                )}

                {/* Error */}
                {txError && (
                  <div className="px-4 py-6 text-center text-red-500 text-sm">{txError}</div>
                )}

                {/* Empty */}
                {txFetched && !txLoading && transactions.length === 0 && (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    Brak zakupów w ostatnich 24h (lub wszystkie tokeny zostały sprzedane)
                  </div>
                )}

                {/* Transaction list */}
                {txFetched && transactions.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {transactions.map((tx) => {
                      const isProfit = tx.pnlPercent > 0
                      return (
                        <div key={tx.txHash} className="px-4 py-2.5 hover:bg-gray-50/50 transition-colors">
                          {/* Row 1: token + time + links */}
                          <div className="flex items-center gap-2 mb-1">
                            {tx.tokenLogo && (
                              <img src={tx.tokenLogo} alt="" className="w-5 h-5 rounded-full shrink-0" />
                            )}
                            <span className="font-semibold text-gray-800 text-sm">{tx.tokenSymbol}</span>
                            <span className="text-xs text-gray-400 truncate max-w-[120px]">{tx.tokenName}</span>
                            <span className="text-[10px] text-gray-400 ml-auto shrink-0">{timeAgo(tx.timestamp)}</span>
                            <div className="flex items-center gap-1 shrink-0" >
                              <a
                                href={`https://solscan.io/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-300 hover:text-blue-500"
                                title="Solscan TX"
                              >
                                <ExternalLink size={11} />
                              </a>
                              {tx.dexUrl && (
                                <a
                                  href={tx.dexUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-gray-400 hover:text-blue-500 font-medium"
                                >
                                  DEX
                                </a>
                              )}
                              {tx.gmgnUrl && (
                                <a
                                  href={tx.gmgnUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-gray-400 hover:text-blue-500 font-medium"
                                >
                                  GMGN
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Row 2: metrics */}
                          <div className="flex items-center gap-3 ml-7 flex-wrap text-[10px]">
                            <div>
                              <span className="text-gray-400">Wydano:</span>
                              <span className="ml-0.5 font-semibold text-gray-700">{tx.solAmount.toFixed(3)} SOL</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Mcap przy zakupie:</span>
                              <span className="ml-0.5 font-semibold text-violet-600">{fmtMcap(tx.marketCapAtBuy)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Mcap teraz:</span>
                              <span className="ml-0.5 font-medium text-gray-600">{fmtMcap(tx.marketCapNow)}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <span className="text-gray-400">PnL:</span>
                              {isProfit ? (
                                <ArrowUpRight size={10} className="text-emerald-500" />
                              ) : tx.pnlPercent < 0 ? (
                                <ArrowDownRight size={10} className="text-red-500" />
                              ) : null}
                              <span className={`font-bold ${isProfit ? 'text-emerald-600' : tx.pnlPercent < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                {tx.pnlPercent > 0 ? '+' : ''}{tx.pnlPercent.toFixed(0)}%
                              </span>
                              <span className={`ml-0.5 ${isProfit ? 'text-emerald-600' : tx.pnlPercent < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                ({tx.pnlUsd > 0 ? '+' : ''}{fmt(tx.pnlUsd)})
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400">Ilość:</span>
                              <span className="ml-0.5 font-medium text-gray-600">{fmtBalance(tx.tokenAmount)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!data.gmgn && (
            <p className="text-xs text-gray-400 text-center">
              GMGN stats niedostępne dla tego portfela
            </p>
          )}
        </div>
      )}
    </div>
  )
}
