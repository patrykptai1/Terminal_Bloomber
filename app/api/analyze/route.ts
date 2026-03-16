import { NextRequest, NextResponse } from 'next/server'
import { fetchTokenInfoBatch, fetchSolPrice } from '@/lib/dexscreener'
import { fetchTopTraders, fetchTokenHolders, findSeedWalletsInTrades } from '@/lib/gmgn'
import { aggregateWallets, buildGraphData } from '@/lib/analysis'
import { fetchTokenPriceHistory, lookupPrice } from '@/lib/gmgn'
import { enrichWithVybe, vybeDisplayLabel } from '@/lib/vybe'
import { WalletTrade, TokenInfo, TokenEntry } from '@/types'

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_TOKENS = 50
const MAX_SEED_WALLETS = 20

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await req.json()
    const rawTokens: string[] = body.tokens ?? []
    const rawSeeds: string[] = body.seedWallets ?? []

    const tokens = [
      ...new Set(rawTokens.map((t: string) => t.trim()).filter((t: string) => SOLANA_ADDRESS_REGEX.test(t))),
    ].slice(0, MAX_TOKENS)

    const seedWallets = [
      ...new Set(rawSeeds.map((t: string) => t.trim()).filter((t: string) => SOLANA_ADDRESS_REGEX.test(t))),
    ].slice(0, MAX_SEED_WALLETS)

    if (tokens.length === 0) {
      return NextResponse.json({ error: 'No valid Solana token addresses provided' }, { status: 400 })
    }

    const [tokenInfoMap, solPrice] = await Promise.all([
      fetchTokenInfoBatch(tokens),
      fetchSolPrice(),
    ])
    console.log(`[analyze] ${tokens.length} tokens, ${seedWallets.length} seed wallets`)

    const perTokenTrades = new Map<string, Map<string, WalletTrade>>()
    const resolvedTokens: TokenInfo[] = []

    // ── PHASE 1: GMGN top traders + top holders per token ─────────────────────
    for (let i = 0; i < tokens.length; i++) {
      const tokenAddress = tokens[i]
      const tokenInfo = tokenInfoMap.get(tokenAddress)
      if (!tokenInfo?.symbol) {
        console.log(`[analyze] ${i + 1}/${tokens.length}: skip (no token info)`)
        continue
      }

      resolvedTokens.push(tokenInfo)
      const walletTrades = new Map<string, WalletTrade>()
      perTokenTrades.set(tokenAddress, walletTrades)

      console.log(`[analyze] ${i + 1}/${tokens.length}: ${tokenInfo.symbol}`)

      // Source A — GMGN top traders: all-time PnL, not limited to recent txs
      try {
        const traders = await fetchTopTraders(tokenAddress, 100)
        let skippedCex = 0
        for (const t of traders) {
          // Skip known CEX/exchange wallets (GMGN exchange label)
          if (t.exchange) { skippedCex++; continue }
          // Skip high-frequency market makers (>200 trades on a single token = exchange/MM)
          if (t.buyCount + t.sellCount > 200) { skippedCex++; continue }
          walletTrades.set(t.address, {
            solSpent: 0,
            solReceived: 0,
            tradeCount: t.buyCount + t.sellCount,
            pnlUsd: t.realizedProfit + (t.unrealizedProfit ?? 0),
            unrealizedPnlUsd: t.unrealizedProfit ?? 0,
            buyCount: t.buyCount,
            sellCount: t.sellCount,
            tags: t.tags,
            startHoldingAt: t.startHoldingAt,
            avgCostUsd: t.avgCostUsd,
            nativeBalance: t.nativeBalance,
          })
        }
        console.log(`  traders: ${traders.length - skippedCex} (skipped ${skippedCex} CEX/MM)`)
      } catch (e) {
        console.error(`  traders error:`, e)
      }

      // Source B — GMGN top holders: current holders with PnL
      // ── Zmiana 5: Ulepszony filtr holderów ──────────────────────────────────
      try {
        const holders = await fetchTokenHolders(tokenAddress, 100)
        let added = 0
        let skippedFilter = 0
        for (const h of holders) {
          // Zmiana 5: Warunek CEX — skip if tagged as exchange
          const isCexTagged = h.tags?.some((t: string) => {
            const lower = t.toLowerCase()
            return lower === 'cex' || lower === 'exchange' || lower === 'binance' || lower === 'okx' || lower === 'bybit' || lower === 'coinbase'
          })
          if (isCexTagged) { skippedFilter++; continue }

          // Zmiana 5: Raised SOL threshold to $50K (was $10K) as fallback for whale detection
          if (h.nativeBalance > 50_000 * 1e9) {
            skippedFilter++; continue
          }

          if (!walletTrades.has(h.owner)) {
            walletTrades.set(h.owner, {
              solSpent: 0,
              solReceived: 0,
              tradeCount: 0,
              pnlUsd: h.realizedProfit + (h.unrealizedProfit ?? 0),
              unrealizedPnlUsd: h.unrealizedProfit ?? 0,
              buyCount: 0,
              sellCount: 0,
              tags: h.tags,
              startHoldingAt: h.startHoldingAt,
              avgCostUsd: 0,
              nativeBalance: h.nativeBalance,
            })
            added++
          }
        }
        console.log(`  holders: ${holders.length} (+${added} new, skipped ${skippedFilter} CEX/dust)`)
      } catch (e) {
        console.error(`  holders error:`, e)
      }
    }

    // ── PHASE 2: Find seed wallets in recent token trades ──────────────────────
    if (seedWallets.length > 0) {
      const seedSet = new Set(seedWallets)
      console.log(`[analyze] Phase 2: ${seedWallets.length} seed wallets × ${resolvedTokens.length} tokens`)

      for (const tokenInfo of resolvedTokens) {
        const existing = perTokenTrades.get(tokenInfo.address)
        if (!existing) continue

        // Seed wallets already found via top traders/holders — skip scan
        const missing = new Set([...seedSet].filter(w => !existing.has(w)))
        if (missing.size === 0) continue

        try {
          const found = await findSeedWalletsInTrades(tokenInfo.address, missing, 8)
          let added = 0
          for (const [wallet, trade] of found) {
            existing.set(wallet, {
              solSpent: 0,
              solReceived: 0,
              tradeCount: trade.tradeCount,
              pnlUsd: trade.realizedProfit + trade.unrealizedProfit,
              unrealizedPnlUsd: trade.unrealizedProfit,
              buyCount: 0,
              sellCount: 0,
              tags: [],
              startHoldingAt: null,
              avgCostUsd: 0,
              nativeBalance: 0,
            })
            added++
          }
          if (added > 0) console.log(`  ${tokenInfo.symbol}: found ${added} seed wallets in trades`)
        } catch (e) {
          console.error(`  Phase 2 error for ${tokenInfo.symbol}:`, e)
        }
      }
    }

    // ── PHASE 3: Aggregate across tokens ──────────────────────────────────────
    const tokenResults = resolvedTokens
      .filter(t => perTokenTrades.has(t.address) && perTokenTrades.get(t.address)!.size > 0)
      .map(t => ({
        tokenAddress: t.address,
        tokenInfo: t,
        walletTrades: perTokenTrades.get(t.address)!,
      }))

    // Zmiana 1: pass totalTokensAnalyzed for coverage ratio
    let wallets = aggregateWallets(tokenResults, resolvedTokens.length)

    // ── PHASE 3b: Filter wallets with small estimated portfolio ──────────────
    // ── Zmiana 6: Obniżone progi ─────────────────────────────────────────────
    const MIN_SOL_USD     =  30_000   // (było $100K)
    const MIN_UNREALIZED  =  30_000   // (było $100K)
    const MIN_HIST_PNL    =   5_000   // (było $10K)

    // Populate solBalanceUsd from GMGN native_balance
    for (const w of wallets) {
      w.solBalanceUsd = (w.solBalanceLamports / 1e9) * solPrice
    }

    let filteredByBalance = 0
    wallets = wallets.filter(w => {
      if (w.isSmartMoney) return true
      if (w.solBalanceUsd >= MIN_SOL_USD) return true
      if (Math.max(0, w.totalUnrealizedUsd) >= MIN_UNREALIZED) return true
      if (w.totalPnlUsd >= MIN_HIST_PNL) return true
      filteredByBalance++
      return false
    })
    console.log(`[analyze] Filtered ${filteredByBalance} wallets below portfolio threshold`)

    // ── PHASE 4: Enrich with entry prices and market caps ────────────────────
    const NOW = Math.floor(Date.now() / 1000)
    const HISTORY_START = NOW - 2 * 365 * 86400

    // Only fetch kline for tokens where at least one wallet lacks avgCostUsd but has startHoldingAt
    const tokensNeedingKline = new Set<string>()
    for (const wallet of wallets) {
      for (let i = 0; i < wallet.tokens.length; i++) {
        const tokenAddress = wallet.tokens[i]
        const trade = perTokenTrades.get(tokenAddress)?.get(wallet.address)
        if (trade && trade.avgCostUsd === 0 && trade.startHoldingAt) {
          tokensNeedingKline.add(tokenAddress)
        }
      }
    }

    const priceHistories = new Map<string, Map<number, number>>()
    if (tokensNeedingKline.size > 0) {
      await Promise.all(
        [...tokensNeedingKline].map(async tokenAddress => {
          const tokenWallets = perTokenTrades.get(tokenAddress)
          if (!tokenWallets) return
          let fromTs = NOW
          for (const trade of tokenWallets.values()) {
            if (trade.startHoldingAt && trade.startHoldingAt < fromTs) fromTs = trade.startHoldingAt
          }
          fromTs = Math.max(fromTs - 86400, HISTORY_START)
          const history = await fetchTokenPriceHistory(tokenAddress, fromTs, NOW)
          if (history.size > 0) priceHistories.set(tokenAddress, history)
        })
      )
    }

    for (const wallet of wallets) {
      const entries: TokenEntry[] = []
      for (let i = 0; i < wallet.tokens.length; i++) {
        const tokenAddress = wallet.tokens[i]
        const tokenSymbol = wallet.tokenSymbols[i]
        const firstSeenAt = wallet.tokenFirstSeen[i] ?? 0
        const tokenInfo = tokenInfoMap.get(tokenAddress)
        const trade = perTokenTrades.get(tokenAddress)?.get(wallet.address)

        let entryPriceUsd = 0
        let mcapAtEntryUsd = 0

        if (tokenInfo && tokenInfo.fdv > 0 && tokenInfo.priceUsd > 0) {
          const totalSupply = tokenInfo.fdv / tokenInfo.priceUsd

          // Primary: use GMGN avg_cost directly — exact average buy price
          if (trade?.avgCostUsd && trade.avgCostUsd > 0) {
            entryPriceUsd = trade.avgCostUsd
            mcapAtEntryUsd = entryPriceUsd * totalSupply
          }
          // Fallback: kline price at startHoldingAt (for holders/seeds)
          else if (firstSeenAt) {
            const history = priceHistories.get(tokenAddress)
            if (history) {
              entryPriceUsd = lookupPrice(history, firstSeenAt)
              if (entryPriceUsd > 0) mcapAtEntryUsd = entryPriceUsd * totalSupply
            }
          }
        }

        entries.push({ tokenAddress, tokenSymbol, firstSeenAt, entryPriceUsd, mcapAtEntryUsd })
      }
      wallet.tokenEntries = entries
    }

    // ── PHASE 4b: Early entry analysis (Zmiana 3) + Final Smart Score ────────
    const EARLY_MCAP_THRESHOLD = 500_000

    for (const wallet of wallets) {
      // Count early entries (mcap < $500K), skip tokens with no entry data
      let earlyCount = 0
      let entryCount = 0
      let mcapSum = 0

      for (const entry of wallet.tokenEntries) {
        if (entry.mcapAtEntryUsd > 0) {
          entryCount++
          mcapSum += entry.mcapAtEntryUsd
          if (entry.mcapAtEntryUsd < EARLY_MCAP_THRESHOLD) earlyCount++
        }
      }

      wallet.earlyEntryCount = earlyCount
      wallet.earlyEntryRatio = entryCount > 0 ? earlyCount / entryCount : 0
      wallet.avgEntryMcap = entryCount > 0 ? mcapSum / entryCount : 0

      // Zmiana 1: Add early bonus to smart score
      if (wallet.isSmartMoney) {
        const earlyBonus = wallet.earlyEntryRatio * 0.15
        wallet.smartScore = Math.min(
          Math.round((wallet.smartScore + earlyBonus) * 10000) / 10000,
          1.0
        )
      }

      // Zmiana 9: Late entry warning
      wallet.lateEntryWarning = wallet.isSmartMoney && wallet.earlyEntryRatio < 0.30
    }

    // Re-sort after score updates
    wallets.sort((a, b) => {
      if (a.isSmartMoney !== b.isSmartMoney) return a.isSmartMoney ? -1 : 1
      if (a.isSmartMoney) return b.smartScore - a.smartScore
      return b.totalPnlUsd - a.totalPnlUsd
    })

    // ── PHASE 5: Vybe enrichment — add named entity labels ────────────────────
    try {
      const vybeMap = await enrichWithVybe(wallets.map(w => w.address))
      if (vybeMap.size > 0) {
        console.log(`[analyze] Vybe: enriched ${vybeMap.size} wallets with named entities`)
        for (const w of wallets) {
          const acc = vybeMap.get(w.address)
          if (acc) {
            w.vybeName   = vybeDisplayLabel(acc)
            w.vybeLabels = acc.labels
          }
        }
      }
    } catch (e) {
      console.warn('[analyze] Vybe enrichment failed (non-fatal):', e)
    }

    const graphData = buildGraphData(wallets, tokenInfoMap)

    const elapsedMs = Date.now() - startTime
    const smartMoneyCount = wallets.filter(w => w.isSmartMoney).length

    console.log(`[analyze] Done: ${wallets.length} wallets, ${smartMoneyCount} smart money, ${(elapsedMs / 1000).toFixed(1)}s`)

    return NextResponse.json({
      wallets,
      graphData,
      processedTokens: tokenResults.length,
      totalTokensAnalyzed: resolvedTokens.length,
      stats: { totalWallets: wallets.length, smartMoneyCount, elapsedMs },
    })
  } catch (e) {
    console.error('[analyze] Error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
