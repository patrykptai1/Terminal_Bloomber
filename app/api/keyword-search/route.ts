import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats, searchTickers } from "@/lib/yahoo"

export const dynamic = "force-dynamic"

// ── Thematic ticker map ─────────────────────────────────────
// Maps popular investment themes/keywords to known tickers.
// This supplements Yahoo search which only matches by company name.

const THEMATIC_TICKERS: Record<string, string[]> = {
  // Quantum Computing
  "quantum": ["QUBT", "IONQ", "RGTI", "ARQQ", "IBM", "GOOGL", "MSFT", "HON", "QBTS", "FORM"],
  "quantum computing": ["QUBT", "IONQ", "RGTI", "ARQQ", "IBM", "GOOGL", "MSFT", "HON", "QBTS", "FORM"],

  // Artificial Intelligence
  "ai": ["NVDA", "MSFT", "GOOGL", "META", "PLTR", "AI", "PATH", "BBAI", "SOUN", "UPST", "SMCI", "AMD", "AVGO", "CRM", "NOW", "SNOW", "DDOG", "MDB", "CRWD", "ARM", "ORCL", "ADBE", "HUBS", "VEEV", "ESTC"],
  "artificial intelligence": ["NVDA", "MSFT", "GOOGL", "META", "PLTR", "AI", "PATH", "BBAI", "SOUN", "UPST", "SMCI", "AMD", "AVGO", "CRM", "NOW", "SNOW", "ARM"],
  "machine learning": ["NVDA", "GOOGL", "MSFT", "META", "PLTR", "AI", "PATH", "SNOW", "DDOG", "MDB", "ESTC"],

  // Cybersecurity
  "cybersecurity": ["CRWD", "PANW", "ZS", "FTNT", "S", "CYBR", "QLYS", "TENB", "RPD", "VRNS", "NET", "OKTA", "SAIL"],
  "cyber": ["CRWD", "PANW", "ZS", "FTNT", "S", "CYBR", "QLYS", "TENB", "RPD", "VRNS", "NET", "OKTA"],
  "security": ["CRWD", "PANW", "ZS", "FTNT", "S", "CYBR", "QLYS", "TENB", "RPD", "VRNS"],

  // Solar / Renewable Energy
  "solar": ["FSLR", "ENPH", "SEDG", "RUN", "NOVA", "ARRY", "CSIQ", "JKS", "SHLS", "MAXN", "SPWR"],
  "renewable": ["FSLR", "ENPH", "SEDG", "NEE", "AES", "PLUG", "BE", "RUN", "NOVA", "CSIQ", "CWEN"],
  "clean energy": ["FSLR", "ENPH", "SEDG", "NEE", "AES", "PLUG", "BE", "RUN", "ICLN"],
  "wind": ["NEE", "AES", "GE", "CWEN", "VWDRY"],
  "hydrogen": ["PLUG", "BE", "FCEL", "BLDP", "APD", "LIN"],

  // Blockchain / Crypto
  "blockchain": ["COIN", "MSTR", "MARA", "RIOT", "CLSK", "HUT", "BITF", "SQ", "PYPL", "CME"],
  "crypto": ["COIN", "MSTR", "MARA", "RIOT", "CLSK", "HUT", "BITF", "SQ", "PYPL", "CME"],
  "bitcoin": ["COIN", "MSTR", "MARA", "RIOT", "CLSK", "HUT", "BITF"],

  // Electric Vehicles
  "ev": ["TSLA", "RIVN", "LCID", "NIO", "LI", "XPEV", "GM", "F", "CHPT", "BLNK", "EVGO", "QS"],
  "electric vehicle": ["TSLA", "RIVN", "LCID", "NIO", "LI", "XPEV", "GM", "F", "CHPT", "BLNK"],

  // Semiconductors
  "semiconductor": ["NVDA", "AMD", "INTC", "AVGO", "QCOM", "TXN", "MRVL", "LRCX", "AMAT", "KLAC", "ASML", "TSM", "MU", "ON", "NXPI", "MCHP", "ADI", "SWKS", "ARM", "SMCI"],
  "chip": ["NVDA", "AMD", "INTC", "AVGO", "QCOM", "TXN", "MRVL", "TSM", "MU", "ARM", "SMCI"],
  "gpu": ["NVDA", "AMD", "INTC", "SMCI", "ARM"],

  // Cloud Computing
  "cloud": ["AMZN", "MSFT", "GOOGL", "CRM", "NOW", "SNOW", "DDOG", "NET", "MDB", "ESTC", "CFLT", "WDAY", "VEEV", "ZS", "OKTA", "TWLO"],

  // Robotics
  "robotics": ["ISRG", "ROK", "ABB", "IRBT", "RWLK", "TER", "FANUY", "PATH", "NVDA"],
  "robot": ["ISRG", "ROK", "ABB", "IRBT", "RWLK", "TER", "FANUY", "PATH", "NVDA"],
  "automation": ["ROK", "ABB", "EMR", "HON", "TER", "KEYS", "CGNX", "PATH"],

  // Space
  "space": ["RKLB", "ASTS", "LUNR", "SPIR", "MNTS", "BA", "LMT", "NOC", "RTX", "BKSY", "ASTR"],

  // Biotech
  "biotech": ["AMGN", "GILD", "REGN", "VRTX", "MRNA", "BIIB", "ILMN", "ALNY", "BMRN", "SGEN", "JAZZ", "NBIX", "SRPT", "IONS", "RARE"],
  "genomics": ["ILMN", "CRSP", "NTLA", "BEAM", "EDIT", "TWST", "PACB", "NTRA", "TXG", "EXAS"],
  "crispr": ["CRSP", "NTLA", "BEAM", "EDIT"],

  // Cannabis
  "cannabis": ["TLRY", "CGC", "ACB", "SNDL", "OGI", "CRON", "HEXO", "VFF"],
  "marijuana": ["TLRY", "CGC", "ACB", "SNDL", "OGI", "CRON"],

  // Fintech
  "fintech": ["SQ", "PYPL", "AFRM", "SOFI", "UPST", "NU", "COIN", "BILL", "FOUR", "TOST", "HOOD", "MELI"],
  "payments": ["V", "MA", "PYPL", "SQ", "FOUR", "GPN", "FIS", "FISV", "AFRM"],

  // Metaverse / VR / AR
  "metaverse": ["META", "RBLX", "U", "NVDA", "MSFT", "AAPL", "SNAP", "MRVL"],
  "virtual reality": ["META", "AAPL", "U", "RBLX", "SNAP", "IMMR"],
  "vr": ["META", "AAPL", "U", "RBLX", "SNAP", "IMMR"],

  // 3D Printing
  "3d printing": ["DDD", "SSYS", "DM", "XONE", "MKFG", "NNDM"],

  // Drones
  "drone": ["AVAV", "JOBY", "ACHR", "RKLB", "LMT", "NOC", "BA"],
  "drones": ["AVAV", "JOBY", "ACHR", "RKLB", "LMT", "NOC", "BA"],

  // Data Center
  "data center": ["EQIX", "DLR", "AMT", "SMCI", "NVDA", "VRT", "ANET", "DELL", "HPE", "CSCO"],

  // Lithium / Batteries
  "lithium": ["ALB", "SQM", "LTHM", "LAC", "PLL", "QS"],
  "battery": ["QS", "ALB", "LTHM", "ENVX", "MVST", "TSLA", "PCRFY"],

  // Nuclear
  "nuclear": ["CCJ", "UEC", "NNE", "LEU", "DNN", "UUUU", "SMR", "OKLO"],
  "uranium": ["CCJ", "UEC", "DNN", "UUUU", "LEU", "NNE"],

  // Defense
  "defense": ["LMT", "RTX", "NOC", "GD", "BA", "LHX", "HII", "TDG", "AXON", "PLTR", "LDOS", "BAH", "KTOS"],
  "military": ["LMT", "RTX", "NOC", "GD", "BA", "LHX", "HII", "AXON", "PLTR", "KTOS"],
  "weapons": ["LMT", "RTX", "NOC", "GD", "BA", "SWBI", "RGR"],

  // Obesity / GLP-1
  "obesity": ["LLY", "NVO", "AMGN", "VKTX", "GPCR", "ALT", "TVTX"],
  "glp-1": ["LLY", "NVO", "AMGN", "VKTX"],
  "weight loss": ["LLY", "NVO", "AMGN", "VKTX", "HIMS"],

  // Gaming
  "gaming": ["NVDA", "AMD", "ATVI", "EA", "TTWO", "RBLX", "U", "SE", "DKNG"],
  "esports": ["DKNG", "RBLX", "U", "SE"],

  // Streaming
  "streaming": ["NFLX", "DIS", "ROKU", "PARA", "WBD", "SPOT", "FUBO"],

  // Food delivery
  "food delivery": ["DASH", "UBER", "GRUB", "DNUT"],

  // Autonomous driving
  "autonomous": ["TSLA", "GOOGL", "GM", "MBLY", "LAZR", "INVZ", "OUST", "AEVA", "LIDR"],
  "self driving": ["TSLA", "GOOGL", "GM", "MBLY", "LAZR", "INVZ"],
  "lidar": ["LAZR", "INVZ", "OUST", "AEVA", "LIDR", "MBLY"],

  // Rare earth / Mining
  "rare earth": ["MP", "UUUU", "LAC", "ALB"],
  "mining": ["NEM", "GOLD", "FCX", "BHP", "RIO", "VALE", "SCCO", "AA"],
  "gold": ["NEM", "GOLD", "AEM", "KGC", "WPM", "FNV", "RGLD", "GFI"],
  "silver": ["WPM", "PAAS", "AG", "HL", "CDE", "MAG"],
  "copper": ["FCX", "SCCO", "TECK", "HBM"],

  // Insurance / Insurtech
  "insurtech": ["LMND", "ROOT", "HIPO", "KNSL", "OSCR"],
  "insurance": ["PGR", "ALL", "TRV", "MET", "AIG", "AFL", "PRU", "CB", "LMND", "ROOT"],

  // Real estate tech
  "proptech": ["RDFN", "Z", "ZG", "OPEN", "COMP", "EXPI"],

  // Aging / Senior care
  "aging": ["ABBV", "JNJ", "MDT", "SYK", "ABT", "BAX", "BDX", "ISRG"],

  // Water
  "water": ["AWK", "WTR", "WTRG", "XYL", "ECL", "FBIN"],

  // Agriculture / AgTech
  "agriculture": ["DE", "ADM", "BG", "CTVA", "FMC", "MOS", "NTR", "CF"],
  "agtech": ["DE", "CTVA", "FMC", "AGFY"],

  // Edge computing / IoT
  "iot": ["ANET", "CSCO", "KEYS", "CEVA", "SLAB", "LITE"],
  "edge computing": ["ANET", "CSCO", "NET", "CEVA", "SLAB"],
}

// ── GICS sector mapping ────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  "Technology": "Information Technology",
  "Information Technology": "Information Technology",
  "Healthcare": "Healthcare",
  "Health Care": "Healthcare",
  "Financial Services": "Financials",
  "Financials": "Financials",
  "Financial": "Financials",
  "Consumer Cyclical": "Consumer Discretionary",
  "Consumer Discretionary": "Consumer Discretionary",
  "Consumer Defensive": "Consumer Staples",
  "Consumer Staples": "Consumer Staples",
  "Energy": "Energy",
  "Industrials": "Industrials",
  "Basic Materials": "Materials",
  "Materials": "Materials",
  "Utilities": "Utilities",
  "Real Estate": "Real Estate",
  "Communication Services": "Communication Services",
  "Telecommunication Services": "Communication Services",
}

function normalizeSector(raw: string | null): string {
  if (!raw) return "Unknown"
  return SECTOR_MAP[raw] ?? raw
}

// ── Fetch stock data ────────────────────────────────────────

interface StockResult {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap: number
  currency: string
  exchange: string
  market: "US" | "GPW" | "NC"
  sector: string
  industry: string | null
  source: "KEYWORD"
  peRatio: number | null
  forwardPE: number | null
  evToEbitda: number | null
  dividendYield: number | null
  pegRatio: number | null
  ebitda: number | null
  netIncome: number | null
  enterpriseValue: number | null
  totalDebt: number | null
  totalCash: number | null
  profitMargin: number | null
  revenueGrowth: number | null
  businessSummary: string | null
  keywordMatch: "name" | "industry" | "description" | "theme"
  valuation: null
}

async function fetchStockData(
  symbol: string,
  keyword: string,
  isThematic: boolean,
): Promise<StockResult | null> {
  try {
    const [quote, stats] = await Promise.all([
      fetchQuote(symbol),
      fetchKeyStats(symbol).catch(() => null),
    ])

    if (!quote || quote.marketCap <= 0) return null

    const sector = normalizeSector(stats?.sector ?? null)
    const industry = stats?.industry ?? null
    const summary = stats?.longBusinessSummary ?? null

    // Determine match type
    const kw = keyword.toLowerCase()
    const nameMatch = quote.name.toLowerCase().includes(kw) || symbol.toLowerCase().includes(kw)
    const industryMatch = industry?.toLowerCase().includes(kw) ?? false
    const descMatch = summary?.toLowerCase().includes(kw) ?? false

    let matchType: StockResult["keywordMatch"]
    if (nameMatch) matchType = "name"
    else if (industryMatch) matchType = "industry"
    else if (descMatch) matchType = "description"
    else matchType = "theme" // From thematic map or Yahoo search relevance

    // Detect market
    const exch = (quote.exchange ?? "").toUpperCase()
    const isGPW = exch.includes("WAR") || symbol.endsWith(".WA")
    const market: "US" | "GPW" | "NC" = isGPW ? "GPW" : "US"

    // Calculate EBITDA
    const ev = stats?.enterpriseValue ?? null
    const evToEbitda = stats?.enterpriseToEbitda ?? null
    let ebitda: number | null = null
    if (ev && evToEbitda && evToEbitda > 0) {
      ebitda = ev / evToEbitda
    }

    // Net Income from P/E
    let netIncome: number | null = null
    if (quote.marketCap && quote.peRatio && quote.peRatio > 0) {
      netIncome = quote.marketCap / quote.peRatio
    }

    return {
      symbol: quote.symbol,
      name: quote.name,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      marketCap: quote.marketCap,
      currency: quote.currency,
      exchange: quote.exchange,
      market,
      sector,
      industry,
      source: "KEYWORD",
      peRatio: quote.peRatio,
      forwardPE: stats?.forwardPE ?? quote.forwardPE,
      evToEbitda,
      dividendYield: quote.dividendYield,
      pegRatio: stats?.pegRatio ?? null,
      ebitda,
      netIncome,
      enterpriseValue: ev,
      totalDebt: stats?.totalDebt ?? null,
      totalCash: stats?.totalCash ?? null,
      profitMargin: stats?.profitMargin != null ? stats.profitMargin * 100 : null,
      revenueGrowth: stats?.revenueGrowth != null ? stats.revenueGrowth * 100 : null,
      businessSummary: summary ? summary.slice(0, 300) : null,
      keywordMatch: matchType,
      valuation: null,
    }
  } catch {
    return null
  }
}

// ── Find thematic tickers ───────────────────────────────────

function findThematicTickers(keyword: string): string[] {
  const kw = keyword.toLowerCase().trim()

  // Exact match first
  if (THEMATIC_TICKERS[kw]) return THEMATIC_TICKERS[kw]

  // Partial match — check if keyword contains or is contained by any theme key
  const matches: string[] = []
  for (const [theme, tickers] of Object.entries(THEMATIC_TICKERS)) {
    if (kw.includes(theme) || theme.includes(kw)) {
      for (const t of tickers) {
        if (!matches.includes(t)) matches.push(t)
      }
    }
  }
  return matches
}

// ── Main handler ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { keyword } = (await req.json()) as { keyword: string }

    if (!keyword || keyword.trim().length < 2) {
      return NextResponse.json({ error: "Keyword must be at least 2 characters" }, { status: 400 })
    }

    const kw = keyword.trim()

    // 1. Get thematic tickers (instant, pre-mapped)
    const thematicSymbols = findThematicTickers(kw)

    // 2. Search Yahoo Finance for matching tickers
    const searchQueries = [
      kw,
      `${kw} stock`,
      `${kw} company`,
      `${kw} technology`,
    ]

    const searchResults = await Promise.allSettled(
      searchQueries.map(q => searchTickers(q))
    )

    // Collect unique symbols from Yahoo search
    const symbolSet = new Set<string>(thematicSymbols)
    for (const r of searchResults) {
      if (r.status === "fulfilled") {
        for (const s of r.value) {
          // Only US equities (skip foreign stocks, ETFs, etc)
          if (s.type === "Equity" && !s.symbol.includes(".") && symbolSet.size < 60) {
            symbolSet.add(s.symbol)
          }
        }
      }
    }

    const symbols = Array.from(symbolSet)

    if (symbols.length === 0) {
      return NextResponse.json({
        stocks: [],
        total: 0,
        keyword: kw,
        timestamp: new Date().toISOString(),
      })
    }

    // 3. Fetch data for all stocks in batches of 10
    const stocks: StockResult[] = []
    const batchSize = 10

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(sym => fetchStockData(sym, kw, thematicSymbols.includes(sym)))
      )
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          stocks.push(r.value)
        }
      }
    }

    // 4. Sort: name matches first, then industry, then description, then theme; within each group by marketCap desc
    const matchOrder = { name: 0, industry: 1, description: 2, theme: 3 }
    stocks.sort((a, b) => {
      const mDiff = matchOrder[a.keywordMatch] - matchOrder[b.keywordMatch]
      if (mDiff !== 0) return mDiff
      return b.marketCap - a.marketCap
    })

    return NextResponse.json({
      stocks,
      total: stocks.length,
      keyword: kw,
      thematicMatch: thematicSymbols.length > 0,
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    console.error("[keyword-search] Error:", e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Keyword search error",
    }, { status: 500 })
  }
}
