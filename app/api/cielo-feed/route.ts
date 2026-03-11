// app/api/cielo-feed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getWalletsFeed, getGeneralFeed } from '@/lib/cielo'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const walletsParam = searchParams.get('wallets')
  const chain = searchParams.get('chain') ?? 'solana'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const minUsd = parseFloat(searchParams.get('minUsd') ?? '0')

  if (!process.env.CIELO_API_KEY) {
    return NextResponse.json(
      { error: 'CIELO_API_KEY not configured', items: [] },
      { status: 200 },
    )
  }

  try {
    const options = {
      chains: [chain],
      limit,
      minUsd: minUsd > 0 ? minUsd : undefined,
    }

    let items
    if (walletsParam) {
      const wallets = walletsParam.split(',').map(w => w.trim()).filter(Boolean)
      if (wallets.length === 0) {
        return NextResponse.json({ error: 'No valid wallets', items: [] })
      }
      items = await getWalletsFeed(wallets, options)
    } else {
      items = await getGeneralFeed(options)
    }

    return NextResponse.json({
      items,
      count: items.length,
      chain,
      updatedAt: Date.now(),
    })
  } catch (err) {
    console.error('[cielo-feed] Error:', err)
    return NextResponse.json(
      { error: 'Feed fetch failed', items: [] },
      { status: 500 },
    )
  }
}
