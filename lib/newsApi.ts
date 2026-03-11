// lib/newsApi.ts
// NewsAPI — https://newsapi.org/docs
// Darmowy plan: 100 req/dzień, wyniki do 1 miesiąca wstecz
// API KEY: NEWSAPI_KEY w .env.local

const NEWS_BASE = 'https://newsapi.org/v2'
const newsCache = new Map<string, { data: unknown; ts: number }>()
const NEWS_TTL = 30 * 60 * 1000 // 30 min

export interface NewsArticle {
  title: string
  description: string | null
  url: string
  source: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

function quickSentiment(title: string): 'positive' | 'negative' | 'neutral' {
  const lower = title.toLowerCase()
  const positive = ['surge', 'rally', 'pump', 'ath', 'bullish', 'gain', 'up', 'rise', 'moon', 'breakout', 'launch', 'partnership']
  const negative = ['crash', 'dump', 'bear', 'drop', 'hack', 'scam', 'rug', 'sell', 'down', 'fear', 'ban', 'fraud']
  const posScore = positive.filter(w => lower.includes(w)).length
  const negScore = negative.filter(w => lower.includes(w)).length
  if (posScore > negScore) return 'positive'
  if (negScore > posScore) return 'negative'
  return 'neutral'
}

export async function getTokenNews(
  tokenName: string,
  tokenSymbol: string,
  limit = 5,
): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY
  if (!apiKey) {
    console.warn('[NewsAPI] No NEWSAPI_KEY in .env.local')
    return []
  }

  const query = encodeURIComponent(`"${tokenName}" OR "${tokenSymbol}" crypto`)
  const cacheKey = `news_${tokenName}_${tokenSymbol}`
  const cached = newsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data as NewsArticle[]

  try {
    const url = `${NEWS_BASE}/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      console.warn('[NewsAPI] HTTP', res.status)
      return []
    }
    const data = await res.json() as {
      status?: string
      articles?: Array<{
        title?: string; description?: string; url?: string
        source?: { name?: string }; publishedAt?: string
      }>
    }
    if (data.status !== 'ok' || !data.articles) return []

    const articles: NewsArticle[] = data.articles.map(a => ({
      title: a.title ?? '',
      description: a.description ?? null,
      url: a.url ?? '',
      source: a.source?.name ?? 'Unknown',
      publishedAt: a.publishedAt ?? '',
      sentiment: quickSentiment(a.title ?? ''),
    }))

    newsCache.set(cacheKey, { data: articles, ts: Date.now() })
    return articles
  } catch (err) {
    console.error('[NewsAPI] Error:', err)
    return []
  }
}

// Ogólne crypto newsy
export async function getCryptoMarketNews(limit = 8): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY
  if (!apiKey) return []

  const cacheKey = 'news_market_general'
  const cached = newsCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data as NewsArticle[]

  try {
    const url = `${NEWS_BASE}/everything?q=solana+crypto+blockchain&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json() as {
      status?: string
      articles?: Array<{
        title?: string; description?: string; url?: string
        source?: { name?: string }; publishedAt?: string
      }>
    }
    if (data.status !== 'ok' || !data.articles) return []

    const articles: NewsArticle[] = data.articles.map(a => ({
      title: a.title ?? '',
      description: a.description ?? null,
      url: a.url ?? '',
      source: a.source?.name ?? 'Unknown',
      publishedAt: a.publishedAt ?? '',
      sentiment: quickSentiment(a.title ?? ''),
    }))

    newsCache.set(cacheKey, { data: articles, ts: Date.now() })
    return articles
  } catch {
    return []
  }
}
