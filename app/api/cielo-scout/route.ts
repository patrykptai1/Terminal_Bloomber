// app/api/cielo-scout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { scoutFirstBuyers } from '@/lib/cielo'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const walletsParam = searchParams.get('wallets')
  const chain = searchParams.get('chain') ?? 'solana'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200)
  const minUsd = parseFloat(searchParams.get('minUsd') ?? '0')

  if (!process.env.CIELO_API_KEY) {
    return NextResponse.json(
      { error: 'CIELO_API_KEY not configured', transactions: [], firstBuyers: [], convergence: [] },
      { status: 200 },
    )
  }

  if (!walletsParam) {
    return NextResponse.json(
      { error: 'Required param: wallets (comma-separated)', transactions: [], firstBuyers: [], convergence: [] },
      { status: 400 },
    )
  }

  const wallets = walletsParam.split(',').map(w => w.trim()).filter(Boolean)
  if (wallets.length === 0) {
    return NextResponse.json(
      { error: 'No valid wallets', transactions: [], firstBuyers: [], convergence: [] },
      { status: 400 },
    )
  }

  try {
    const result = await scoutFirstBuyers(wallets, {
      chains: [chain],
      limit,
      minUsd: minUsd > 0 ? minUsd : undefined,
    })

    return NextResponse.json({
      ...result,
      walletCount: wallets.length,
      chain,
      updatedAt: Date.now(),
    })
  } catch (err) {
    console.error('[cielo-scout] Error:', err)
    return NextResponse.json(
      { error: 'Scout failed', transactions: [], firstBuyers: [], convergence: [] },
      { status: 500 },
    )
  }
}
