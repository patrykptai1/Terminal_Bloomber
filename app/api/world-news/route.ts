import { NextRequest, NextResponse } from "next/server"
import { fetchWorldNews, fetchCompanyNews } from "@/lib/worldnews"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get("category") || undefined
  const region = searchParams.get("region") || undefined
  const company = searchParams.get("company") || undefined

  try {
    if (company) {
      // Fetch company name from Yahoo Finance for better search
      let companyName = company
      try {
        const YahooFinanceModule = (await import("yahoo-finance2")).default
        const yf = new (YahooFinanceModule as any)({ suppressNotices: ["yahooSurvey"] })
        const quote = await yf.quote(company) as any
        if (quote?.shortName) companyName = quote.shortName.replace(/,?\s*(Inc\.?|Corp\.?|Ltd\.?|LLC|PLC|S\.A\.)$/i, "").trim()
      } catch { /* use ticker as fallback */ }

      const data = await fetchCompanyNews(company, companyName)
      return NextResponse.json(data)
    }

    const data = await fetchWorldNews(category, region)
    return NextResponse.json(data)
  } catch (e) {
    console.error("World news fetch error:", e)
    return NextResponse.json(
      { items: [], stats: { total: 0, byCategory: {}, byRegion: {}, bySentiment: {}, byImpact: {} }, lastUpdated: new Date().toISOString() },
      { status: 500 }
    )
  }
}
