// lib/oneInch.ts
// Jupiter DEX Aggregator — natywny Solana DEX, darmowy bez klucza
// Cena tokena, slippage, liquidity depth

const JUPITER_PRICE_BASE = 'https://api.jup.ag/price/v2'
const JUPITER_QUOTE_BASE = 'https://quote-api.jup.ag/v6'

const jupCache = new Map<string, { data: unknown; ts: number }>()
const JUP_TTL = 30 * 1000 // 30s — ceny się szybko zmieniają

// Jupiter Price API — cena tokena Solana z agregacji DEX
export async function getJupiterTokenPrice(mintAddress: string): Promise<{
  price: number | null
  vsToken: string
  confidence: string | null
} | null> {
  const cacheKey = `jupiter_price_${mintAddress}`
  const cached = jupCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < JUP_TTL) return cached.data as ReturnType<typeof getJupiterTokenPrice> extends Promise<infer T> ? T : never

  try {
    const res = await fetch(
      `${JUPITER_PRICE_BASE}?ids=${mintAddress}`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const json = await res.json() as {
      data?: Record<string, { price?: string; mintSymbol?: string }>
    }
    const tokenData = json.data?.[mintAddress]
    if (!tokenData) return null

    const result = {
      price: tokenData.price ? parseFloat(tokenData.price) : null,
      vsToken: 'USDC',
      confidence: tokenData.mintSymbol ?? null,
    }
    jupCache.set(cacheKey, { data: result, ts: Date.now() })
    return result
  } catch {
    return null
  }
}

// Jupiter Quote — symulacja swap, pokazuje realny slippage
export async function getJupiterSwapQuote(
  inputMint: string,
  outputMint: string,
  amountUsd: number,
  _inputPriceUsd: number,
): Promise<{
  estimatedOutput: number | null
  priceImpactPct: number | null
  routeLabel: string | null
  liquidityWarning: boolean
} | null> {
  const amountLamports = Math.floor(amountUsd * 1_000_000) // USDC 6 decimals

  try {
    const url = `${JUPITER_QUOTE_BASE}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=100`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json() as {
      outAmount?: string
      priceImpactPct?: string
      routePlan?: Array<{ swapInfo?: { label?: string } }>
    }

    const priceImpact = parseFloat(data.priceImpactPct ?? '0')
    return {
      estimatedOutput: data.outAmount ? parseInt(data.outAmount) : null,
      priceImpactPct: priceImpact,
      routeLabel: data.routePlan?.[0]?.swapInfo?.label ?? null,
      liquidityWarning: priceImpact > 5,
    }
  } catch {
    return null
  }
}
