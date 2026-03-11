// lib/dataEnricher.ts
// Centralny orchestrator wzbogacania danych
// ZASADA: GMGN/DexScreener = PRIMARY — ten plik tylko wzbogaca i waliduje

import { getCoinGeckoIdByAddress, getCoinGeckoTokenData, getCoinGeckoPrice } from './coingecko'
import { findCoinpaprikaToken, getCoinpaprikaTickerData } from './coinpaprika'
import { getMessariMetrics } from './messari'
import { getJupiterTokenPrice, getJupiterSwapQuote } from './oneInch'
import { getTokenNews, type NewsArticle } from './newsApi'
import { analyzeTokenNarrative } from './meaningCloud'

// ━━━ WALIDACJA CENY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PriceValidation {
  isConsistent: boolean
  primaryPrice: number
  sources: { name: string; price: number; deviation: number }[]
  maxDeviation: number
  warning: string | null
}

export async function validateTokenPrice(
  gmgnPrice: number,
  mintAddress: string,
  cgId: string | null,
  cpId: string | null,
): Promise<PriceValidation> {
  const [cgResult, cpResult, jupResult] = await Promise.allSettled([
    cgId ? getCoinGeckoPrice(cgId) : Promise.resolve(null),
    cpId ? getCoinpaprikaTickerData(cpId).then(d => d?.priceUsd ?? null) : Promise.resolve(null),
    getJupiterTokenPrice(mintAddress).then(d => d?.price ?? null),
  ])

  const sources: PriceValidation['sources'] = []
  let maxDeviation = 0

  const addSource = (name: string, price: number | null) => {
    if (price === null || price === 0 || gmgnPrice === 0) return
    const deviation = Math.abs((price - gmgnPrice) / gmgnPrice) * 100
    if (deviation > maxDeviation) maxDeviation = deviation
    sources.push({ name, price, deviation })
  }

  addSource('CoinGecko', cgResult.status === 'fulfilled' ? cgResult.value : null)
  addSource('Coinpaprika', cpResult.status === 'fulfilled' ? cpResult.value : null)
  addSource('Jupiter', jupResult.status === 'fulfilled' ? jupResult.value : null)

  const warning =
    maxDeviation > 20
      ? `Odchylenie ceny ${maxDeviation.toFixed(1)}% miedzy GMGN ($${gmgnPrice.toFixed(6)}) a zewnetrznymi zrodlami`
      : null

  return { isConsistent: maxDeviation <= 20, primaryPrice: gmgnPrice, sources, maxDeviation, warning }
}

// ━━━ PEŁNE WZBOGACENIE TOKENA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TokenEnrichmentResult {
  coinGeckoId: string | null
  coinpaprikaId: string | null
  // Social
  twitterFollowers: number | null
  telegramUsers: number | null
  redditSubscribers: number | null
  twitterHandle: string | null
  telegramChannel: string | null
  // Developer
  githubStars: number | null
  githubCommits4w: number | null
  githubUrl: string | null
  developerScore: number | null
  // Sentiment
  sentimentVotesUp: number | null
  communityScore: number | null
  watchlistUsers: number | null
  narrativeSentiment: number | null
  // ATH / Market
  athUsd: number | null
  athDate: string | null
  athChangePercent: number | null
  allTimeRoi: number | null
  roi90d: number | null
  // Liquidity
  jupiterPrice: number | null
  liquidityWarning: boolean
  priceImpact5kUsd: number | null
  // Projekt
  categories: string[]
  description: string | null
  homepage: string | null
  genesisDate: string | null
  marketCapRank: number | null
  // Newsy
  recentNews: Array<{
    title: string
    url: string
    source: string
    publishedAt: string
    sentiment: string
  }>
  newsPositiveCount: number
  newsNegativeCount: number
  // Meta
  dataSources: string[]
  enrichedAt: number
  enrichmentDurationMs: number
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export async function enrichToken(
  mintAddress: string,
  symbol: string,
  name: string,
  description?: string,
  currentPriceUsd?: number,
): Promise<TokenEnrichmentResult> {
  const start = Date.now()

  // Krok 1: Znajdź ID w zewnętrznych bazach (równolegle)
  const [cgIdResult, cpIdResult] = await Promise.allSettled([
    getCoinGeckoIdByAddress(mintAddress),
    findCoinpaprikaToken(symbol),
  ])

  const cgId = cgIdResult.status === 'fulfilled' ? cgIdResult.value : null
  const cpId = cpIdResult.status === 'fulfilled' ? cpIdResult.value : null

  // Krok 2: Pobierz dane ze wszystkich API równolegle
  const [cgData, cpData, messariData, jupPrice, swapQuote, news, narrativeResult] =
    await Promise.allSettled([
      cgId ? getCoinGeckoTokenData(cgId) : Promise.resolve(null),
      cpId ? getCoinpaprikaTickerData(cpId) : Promise.resolve(null),
      getMessariMetrics(symbol.toLowerCase()),
      getJupiterTokenPrice(mintAddress),
      currentPriceUsd
        ? getJupiterSwapQuote(USDC_MINT, mintAddress, 5000, currentPriceUsd)
        : Promise.resolve(null),
      getTokenNews(name, symbol, 5),
      description
        ? analyzeTokenNarrative({ description, twitterBio: undefined })
        : Promise.resolve(null),
    ])

  const cg = cgData.status === 'fulfilled' ? cgData.value : null
  const cp = cpData.status === 'fulfilled' ? cpData.value : null
  const messari = messariData.status === 'fulfilled' ? messariData.value : null
  const jup = jupPrice.status === 'fulfilled' ? jupPrice.value : null
  const swap = swapQuote.status === 'fulfilled' ? swapQuote.value : null
  const newsItems: NewsArticle[] = news.status === 'fulfilled' ? news.value : []
  const narrative = narrativeResult.status === 'fulfilled' ? narrativeResult.value : null

  const dataSources: string[] = []
  if (cg) dataSources.push('CoinGecko')
  if (cp) dataSources.push('Coinpaprika')
  if (messari) dataSources.push('Messari')
  if (jup) dataSources.push('Jupiter')
  if (newsItems.length > 0) dataSources.push('NewsAPI')
  if (narrative) dataSources.push('MeaningCloud')

  return {
    coinGeckoId: cgId,
    coinpaprikaId: cpId,
    twitterFollowers: cg?.twitterFollowers ?? null,
    telegramUsers: cg?.telegramUsers ?? null,
    redditSubscribers: cg?.redditSubscribers ?? null,
    twitterHandle: cg?.twitterHandle ?? null,
    telegramChannel: cg?.telegramChannel ?? null,
    githubStars: cg?.githubStars ?? null,
    githubCommits4w: cg?.githubCommits4w ?? null,
    githubUrl: cg?.github ?? null,
    developerScore: cg?.developerScore ?? null,
    sentimentVotesUp: cg?.sentimentVotesUp ?? null,
    communityScore: cg?.communityScore ?? null,
    watchlistUsers: cg?.watchlistUsers ?? null,
    narrativeSentiment: narrative?.narrativeScore ?? null,
    athUsd: cg?.athUsd ?? cp?.ath ?? null,
    athDate: cg?.athDate ?? cp?.athDate ?? null,
    athChangePercent: cg?.athChangePercent ?? cp?.percentFromAth ?? null,
    allTimeRoi: messari?.roiAllTime ?? null,
    roi90d: messari?.roi90d ?? null,
    jupiterPrice: jup?.price ?? null,
    liquidityWarning: swap?.liquidityWarning ?? false,
    priceImpact5kUsd: swap?.priceImpactPct ?? null,
    categories: cg?.categories ?? [],
    description: cg?.description ?? messari?.projectSummary ?? null,
    homepage: cg?.homepage ?? null,
    genesisDate: cg?.genesisDate ?? null,
    marketCapRank: cg?.marketCapRank ?? null,
    recentNews: newsItems.map(n => ({
      title: n.title,
      url: n.url,
      source: n.source,
      publishedAt: n.publishedAt,
      sentiment: n.sentiment,
    })),
    newsPositiveCount: newsItems.filter(n => n.sentiment === 'positive').length,
    newsNegativeCount: newsItems.filter(n => n.sentiment === 'negative').length,
    dataSources,
    enrichedAt: Date.now(),
    enrichmentDurationMs: Date.now() - start,
  }
}
