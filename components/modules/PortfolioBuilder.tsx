"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import type { QuoteData } from "@/lib/yahoo"
import { fmtPrice as fmtCurrencyPrice, currencySymbol } from "@/lib/currency"

interface PortfolioEntry {
  ticker: string
  shares: number
  avgPrice: number
}

const STORAGE_KEY = "bloomberg_portfolio"

function loadPortfolio(): PortfolioEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePortfolio(entries: PortfolioEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export default function PortfolioBuilder() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({})
  const [fxRates, setFxRates] = useState<Record<string, number>>({ USD: 1 })
  const [newTicker, setNewTicker] = useState("")
  const [newShares, setNewShares] = useState("")
  const [newAvgPrice, setNewAvgPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setEntries(loadPortfolio())
  }, [])

  useEffect(() => {
    if (entries.length > 0) {
      refreshQuotes()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length])

  const refreshQuotes = async () => {
    if (entries.length === 0) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: entries.map((e) => e.ticker) }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const map: Record<string, QuoteData> = {}
      for (const q of json.quotes) {
        map[q.symbol] = q
      }
      setQuotes(map)
      if (json.fxRates) setFxRates(json.fxRates)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch quotes")
    } finally {
      setLoading(false)
    }
  }

  // Convert amount from any currency to the portfolio base currency
  const toBase = (amount: number, currency: string, baseCurrency: string): number => {
    if (currency === baseCurrency) return amount
    // Convert to USD first, then to base
    const toUsd = fxRates[currency] ?? 1
    const fromUsd = fxRates[baseCurrency] ?? 1
    if (fromUsd === 0) return amount
    return (amount * toUsd) / fromUsd
  }

  const addEntry = () => {
    if (!newTicker) return
    const entry: PortfolioEntry = {
      ticker: newTicker.toUpperCase(),
      shares: parseFloat(newShares) || 0,
      avgPrice: parseFloat(newAvgPrice) || 0,
    }
    const updated = [...entries, entry]
    setEntries(updated)
    savePortfolio(updated)
    setNewTicker("")
    setNewShares("")
    setNewAvgPrice("")
  }

  const removeEntry = (idx: number) => {
    const updated = entries.filter((_, i) => i !== idx)
    setEntries(updated)
    savePortfolio(updated)
  }

  // Determine base currency: use the currency of the largest position by value
  const currencies = new Set<string>()
  entries.forEach((e) => {
    const q = quotes[e.ticker]
    if (q?.currency) currencies.add(q.currency)
  })
  const portfolioCurrency = (() => {
    if (currencies.size <= 1) return [...currencies][0] ?? "USD"
    // Pick currency of the largest position (by value in USD)
    let maxVal = 0, maxCur = "USD"
    entries.forEach((e) => {
      const q = quotes[e.ticker]
      if (!q) return
      const valUsd = e.shares * q.price * (fxRates[q.currency] ?? 1)
      if (valUsd > maxVal) { maxVal = valUsd; maxCur = q.currency }
    })
    return maxCur
  })()

  // Calculate totals with currency conversion
  let totalCost = 0
  let totalValue = 0
  entries.forEach((e) => {
    const q = quotes[e.ticker]
    const cur = q?.currency ?? "USD"
    totalCost += toBase(e.shares * e.avgPrice, cur, portfolioCurrency)
    totalValue += toBase(e.shares * (q?.price ?? e.avgPrice), cur, portfolioCurrency)
  })
  const totalPnl = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost * 100) : 0

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground mb-2">
        Portfolio tracker — add your positions, track P&L with live Yahoo Finance prices
      </div>

      {/* Add position form */}
      <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
        <div className="text-xs text-bloomberg-amber font-bold mb-3">ADD POSITION</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[12px] text-muted-foreground block">TICKER</label>
            <input
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-24 bg-bloomberg-bg border border-bloomberg-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-bloomberg-green/50"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block">SHARES</label>
            <input
              value={newShares}
              onChange={(e) => setNewShares(e.target.value)}
              type="number"
              placeholder="10"
              className="w-20 bg-bloomberg-bg border border-bloomberg-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-bloomberg-green/50"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block">AVG PRICE</label>
            <input
              value={newAvgPrice}
              onChange={(e) => setNewAvgPrice(e.target.value)}
              type="number"
              placeholder="150.00"
              className="w-24 bg-bloomberg-bg border border-bloomberg-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-bloomberg-green/50"
            />
          </div>
          <button
            onClick={addEntry}
            disabled={!newTicker}
            className="px-3 py-1.5 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded text-xs font-bold hover:bg-bloomberg-green/30 disabled:opacity-40 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> ADD
          </button>
          {entries.length > 0 && (
            <button
              onClick={refreshQuotes}
              disabled={loading}
              className="px-3 py-1.5 bg-bloomberg-amber/20 text-bloomberg-amber border border-bloomberg-amber/30 rounded text-xs font-bold hover:bg-bloomberg-amber/30 disabled:opacity-40 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-bloomberg-red text-sm p-3 bg-bloomberg-red/10 border border-bloomberg-red/20 rounded">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Portfolio summary */}
      {entries.length > 0 && (
        <>
          <div className="bg-bloomberg-card border border-bloomberg-border rounded p-4">
            {currencies.size > 1 && (
              <div className="text-[13px] text-muted-foreground mb-2 text-right">
                Wartości przeliczone na {portfolioCurrency}
                {fxRates["PLN"] ? ` | 1 PLN = ${fxRates["PLN"].toFixed(4)} USD` : ""}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">TOTAL COST</div>
                <div className="text-lg font-bold">{fmtCurrencyPrice(totalCost, portfolioCurrency)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">MARKET VALUE</div>
                <div className="text-lg font-bold">{fmtCurrencyPrice(totalValue, portfolioCurrency)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">TOTAL P&L</div>
                <div className={`text-lg font-bold ${totalPnl >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                  {totalPnl >= 0 ? "+" : "-"}{fmtCurrencyPrice(Math.abs(totalPnl), portfolioCurrency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">RETURN</div>
                <div className={`text-lg font-bold ${totalPnlPct >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                  {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* Positions table */}
          <div className="bg-bloomberg-card border border-bloomberg-border rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-bloomberg-border bg-bloomberg-bg">
                    <th className="text-left py-2 px-3 text-muted-foreground">TICKER</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">SHARES</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">AVG PRICE</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">CURRENT</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">CHG%</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">VALUE</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">P&L</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">P&L %</th>
                    <th className="text-center py-2 px-3 text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const q = quotes[entry.ticker]
                    const cur = q?.currency ?? "USD"
                    const currentPrice = q?.price ?? entry.avgPrice
                    const value = entry.shares * currentPrice
                    const cost = entry.shares * entry.avgPrice
                    const pnl = value - cost
                    const pnlPct = cost > 0 ? (pnl / cost * 100) : 0
                    // Convert everything to portfolio base currency
                    const valueInBase = toBase(value, cur, portfolioCurrency)
                    const costInBase = toBase(cost, cur, portfolioCurrency)
                    const pnlInBase = valueInBase - costInBase
                    const alloc = totalValue > 0 ? (valueInBase / totalValue * 100) : 0
                    return (
                      <tr key={i} className="border-b border-bloomberg-border/30 hover:bg-bloomberg-bg/50">
                        <td className="py-2 px-3">
                          <span className="font-bold text-bloomberg-green">{entry.ticker}</span>
                          {q && <span className="text-muted-foreground ml-1 text-[12px]">{alloc.toFixed(1)}%</span>}
                        </td>
                        <td className="py-2 px-3 text-right">{entry.shares}</td>
                        <td className="py-2 px-3 text-right">
                          {q ? fmtCurrencyPrice(entry.avgPrice, q.currency) : `$${entry.avgPrice.toFixed(2)}`}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          {q ? fmtCurrencyPrice(q.price, q.currency) : "..."}
                        </td>
                        <td className={`py-2 px-3 text-right ${(q?.changePercent ?? 0) >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                          {q ? (
                            <span className="inline-flex items-center gap-0.5">
                              {q.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {q.changePercent.toFixed(2)}%
                            </span>
                          ) : "..."}
                        </td>
                        <td className="py-2 px-3 text-right">{fmtCurrencyPrice(valueInBase, portfolioCurrency)}</td>
                        <td className={`py-2 px-3 text-right font-bold ${pnlInBase >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                          {pnlInBase >= 0 ? "+" : "-"}{fmtCurrencyPrice(Math.abs(pnlInBase), portfolioCurrency)}
                        </td>
                        <td className={`py-2 px-3 text-right ${pnlPct >= 0 ? "text-bloomberg-green" : "text-bloomberg-red"}`}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button onClick={() => removeEntry(i)} className="text-muted-foreground hover:text-bloomberg-red">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {entries.length === 0 && (
        <div className="bg-bloomberg-card border border-bloomberg-border rounded p-8 text-center text-muted-foreground text-sm">
          No positions yet. Add your first stock above to start tracking.
        </div>
      )}
    </div>
  )
}
