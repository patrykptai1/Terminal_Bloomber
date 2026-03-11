// app/api/market-news/route.ts
import { NextResponse } from 'next/server'
import { getCryptoMarketNews } from '@/lib/newsApi'
import { getCoinGeckoTrending } from '@/lib/coingecko'
import { getCryptoGlobalStats } from '@/lib/coinpaprika'

export async function GET() {
  const [news, trending, globalStats] = await Promise.allSettled([
    getCryptoMarketNews(8),
    getCoinGeckoTrending(),
    getCryptoGlobalStats(),
  ])

  return NextResponse.json({
    news: news.status === 'fulfilled' ? news.value : [],
    trending: trending.status === 'fulfilled' ? trending.value : [],
    globalStats: globalStats.status === 'fulfilled' ? globalStats.value : null,
    updatedAt: Date.now(),
  })
}
