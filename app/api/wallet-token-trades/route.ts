import { NextRequest, NextResponse } from 'next/server'
import { fetchWalletTokenTrades, GmgnTrade } from '@/lib/gmgn'

export interface WalletTokenTradesResponse {
  trades: Record<string, GmgnTrade[]>  // mint → trades
  errors: string[]
}

export async function POST(req: NextRequest) {
  let body: { wallet: string; mints: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { wallet, mints } = body
  if (!wallet || !mints?.length) {
    return NextResponse.json({ error: 'wallet and mints required' }, { status: 400 })
  }

  const trades: Record<string, GmgnTrade[]> = {}
  const errors: string[] = []

  for (const mint of mints) {
    try {
      const result = await fetchWalletTokenTrades(mint, wallet, 50)
      trades[mint] = result
    } catch (e) {
      errors.push(`${mint.slice(0, 8)}...: ${e instanceof Error ? e.message : 'error'}`)
    }
  }

  return NextResponse.json({ trades, errors } satisfies WalletTokenTradesResponse)
}
