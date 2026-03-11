// app/api/enrich-token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { enrichToken, validateTokenPrice } from '@/lib/dataEnricher'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const address = searchParams.get('address')
  const symbol = searchParams.get('symbol')
  const name = searchParams.get('name') ?? symbol ?? ''
  const description = searchParams.get('description') ?? undefined
  const price = searchParams.get('price')
  const shouldValidatePrice = searchParams.get('validatePrice') === 'true'

  if (!address || !symbol) {
    return NextResponse.json(
      { error: 'Required params: address, symbol' },
      { status: 400 },
    )
  }

  try {
    const enrichment = await enrichToken(
      address,
      symbol,
      name,
      description,
      price ? parseFloat(price) : undefined,
    )

    let priceValidation = null
    if (shouldValidatePrice && price) {
      priceValidation = await validateTokenPrice(
        parseFloat(price),
        address,
        enrichment.coinGeckoId,
        enrichment.coinpaprikaId,
      )
    }

    return NextResponse.json({
      ...enrichment,
      priceValidation,
      hasData: enrichment.dataSources.length > 0,
      isNewToken: enrichment.dataSources.length === 0,
    })
  } catch (err) {
    console.error('[enrich-token] Error:', err)
    return NextResponse.json(
      { error: 'Enrichment failed', hasData: false, isNewToken: true },
      { status: 500 },
    )
  }
}
