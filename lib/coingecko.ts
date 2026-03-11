// lib/coingecko.ts
// CoinGecko API — https://www.coingecko.com/api/documentation
// Darmowy bez klucza, limit: 30 req/min
// UŻYWAJ TYLKO dla wybranego tokena, NIE w pętlach bulk scan

const CG_BASE = 'https://api.coingecko.com/api/v3'

const cgCache = new Map<string, { data: unknown; ts: number }>()
const CG_TTL = 5 * 60 * 1000 // 5 min

async function cgFetch(path: string, ttl = CG_TTL): Promise<unknown> {
  const cached = cgCache.get(path)
  if (cached && Date.now() - cached.ts < ttl) return cached.data
  try {
    const res = await fetch(`${CG_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 429) {
      console.warn('[CoinGecko] Rate limit — returning cache or null')
      return cached?.data ?? null
    }
    if (!res.ok) return null
    const data = await res.json()
    cgCache.set(path, { data, ts: Date.now() })
    return data
  } catch {
    return cached?.data ?? null
  }
}

// Znajdź CoinGecko ID po adresie kontraktu Solana (cache 1h)
export async function getCoinGeckoIdByAddress(contractAddress: string): Promise<string | null> {
  const data = await cgFetch('/coins/list?include_platform=true', 60 * 60 * 1000) as Array<{
    id: string
    platforms?: Record<string, string>
  }> | null
  if (!Array.isArray(data)) return null
  const lower = contractAddress.toLowerCase()
  const coin = data.find(c => c.platforms?.solana?.toLowerCase() === lower)
  return coin?.id ?? null
}

interface CoinGeckoMarketData {
  current_price?: { usd?: number }
  total_volume?: { usd?: number }
  market_cap?: { usd?: number }
  fully_diluted_valuation?: { usd?: number }
  circulating_supply?: number
  total_supply?: number
  price_change_percentage_1h_in_currency?: { usd?: number }
  price_change_percentage_24h?: number
  price_change_percentage_7d?: number
  ath?: { usd?: number }
  ath_date?: { usd?: string }
  ath_change_percentage?: { usd?: number }
  atl?: { usd?: number }
}

interface CoinGeckoCommunityData {
  twitter_followers?: number
  telegram_channel_user_count?: number
  reddit_subscribers?: number
  reddit_average_posts_48h?: number
}

interface CoinGeckoDeveloperData {
  forks?: number
  stars?: number
  subscribers?: number
  commit_count_4_weeks?: number
  code_additions_deletions_4_weeks?: { additions?: number }
  closed_issues?: number
}

// Pełne dane tokena
export async function getCoinGeckoTokenData(coinId: string) {
  const data = await cgFetch(
    `/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`,
  ) as {
    market_data?: CoinGeckoMarketData
    community_data?: CoinGeckoCommunityData
    developer_data?: CoinGeckoDeveloperData
    sentiment_votes_up_percentage?: number
    sentiment_votes_down_percentage?: number
    watchlist_portfolio_users?: number
    public_interest_score?: number
    links?: {
      homepage?: string[]
      twitter_screen_name?: string
      telegram_channel_identifier?: string
      subreddit_url?: string
      repos_url?: { github?: string[] }
    }
    categories?: string[]
    description?: { en?: string }
    genesis_date?: string
    market_cap_rank?: number
    coingecko_score?: number
    developer_score?: number
    community_score?: number
    liquidity_score?: number
  } | null
  if (!data) return null

  const md = data.market_data
  const cd = data.community_data
  const dd = data.developer_data

  return {
    priceUsd: md?.current_price?.usd ?? null,
    marketCapUsd: md?.market_cap?.usd ?? null,
    volume24h: md?.total_volume?.usd ?? null,
    priceChange1h: md?.price_change_percentage_1h_in_currency?.usd ?? null,
    priceChange24h: md?.price_change_percentage_24h ?? null,
    priceChange7d: md?.price_change_percentage_7d ?? null,
    fullyDilutedValuation: md?.fully_diluted_valuation?.usd ?? null,
    circulatingSupply: md?.circulating_supply ?? null,
    totalSupply: md?.total_supply ?? null,
    athUsd: md?.ath?.usd ?? null,
    athDate: md?.ath_date?.usd ?? null,
    athChangePercent: md?.ath_change_percentage?.usd ?? null,
    atlUsd: md?.atl?.usd ?? null,
    twitterFollowers: cd?.twitter_followers ?? null,
    telegramUsers: cd?.telegram_channel_user_count ?? null,
    redditSubscribers: cd?.reddit_subscribers ?? null,
    redditPostsPerHour: cd?.reddit_average_posts_48h ?? null,
    githubForks: dd?.forks ?? null,
    githubStars: dd?.stars ?? null,
    githubSubscribers: dd?.subscribers ?? null,
    githubCommits4w: dd?.commit_count_4_weeks ?? null,
    githubContributors: dd?.code_additions_deletions_4_weeks?.additions ?? null,
    closedIssues: dd?.closed_issues ?? null,
    sentimentVotesUp: data.sentiment_votes_up_percentage ?? null,
    sentimentVotesDown: data.sentiment_votes_down_percentage ?? null,
    watchlistUsers: data.watchlist_portfolio_users ?? null,
    publicInterestScore: data.public_interest_score ?? null,
    homepage: data.links?.homepage?.[0] ?? null,
    twitterHandle: data.links?.twitter_screen_name ?? null,
    telegramChannel: data.links?.telegram_channel_identifier ?? null,
    subreddit: data.links?.subreddit_url ?? null,
    github: data.links?.repos_url?.github?.[0] ?? null,
    categories: data.categories ?? [],
    description: data.description?.en?.substring(0, 600) ?? null,
    genesisDate: data.genesis_date ?? null,
    marketCapRank: data.market_cap_rank ?? null,
    coingeckoScore: data.coingecko_score ?? null,
    developerScore: data.developer_score ?? null,
    communityScore: data.community_score ?? null,
    liquidityScore: data.liquidity_score ?? null,
  }
}

// Szybka cena — do walidacji
export async function getCoinGeckoPrice(coinId: string): Promise<number | null> {
  const data = await cgFetch(`/simple/price?ids=${coinId}&vs_currencies=usd`, 60 * 1000) as Record<string, { usd?: number }> | null
  return data?.[coinId]?.usd ?? null
}

// Trending coins
export async function getCoinGeckoTrending(): Promise<Array<{
  id: string; name: string; symbol: string; rank: number; priceChange24h: number
}>> {
  const data = await cgFetch('/search/trending', 15 * 60 * 1000) as {
    coins?: Array<{ item: { id: string; name: string; symbol: string; market_cap_rank?: number; data?: { price_change_percentage_24h?: { usd?: number } } } }>
  } | null
  if (!data?.coins) return []
  return data.coins.map(c => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    rank: c.item.market_cap_rank ?? 999,
    priceChange24h: c.item.data?.price_change_percentage_24h?.usd ?? 0,
  }))
}
