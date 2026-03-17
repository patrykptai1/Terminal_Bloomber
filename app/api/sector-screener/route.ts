import { NextRequest, NextResponse } from "next/server"
import { fetchQuote, fetchKeyStats } from "@/lib/yahoo"

// ── Comprehensive ticker lists by market ──────────────────────

const US_TICKERS = [
  // Technology
  "AAPL","MSFT","GOOGL","NVDA","META","AVGO","ADBE","CRM","ORCL","AMD",
  "INTC","TXN","QCOM","AMAT","MU","NOW","INTU","LRCX","KLAC","ADI",
  "SNPS","CDNS","MRVL","FTNT","PANW","CRWD","NXPI","MCHP","APH","TEL",
  "IT","MSI","ANSS","KEYS","ZBRA","EPAM","SMCI","PLTR","SNOW","DDOG",
  // Healthcare
  "UNH","JNJ","LLY","ABBV","MRK","TMO","PFE","ABT","DHR","AMGN",
  "BMY","GILD","ISRG","MDT","SYK","ELV","REGN","VRTX","ZTS","BDX",
  "BSX","HCA","CI","IDXX","A","DXCM","IQV","MTD","RMD","HOLX",
  // Financials
  "JPM","V","MA","BAC","WFC","GS","MS","SPGI","BLK","AXP",
  "C","SCHW","CME","ICE","MMC","AON","PGR","TRV","MET","AIG",
  "AFL","PRU","CB","MCO","FIS","MSCI","COF","DFS","ALL","AJG",
  // Consumer Discretionary
  "AMZN","TSLA","HD","MCD","NKE","LOW","SBUX","TJX","BKNG","ABNB",
  "CMG","MAR","RCL","DHI","LEN","GM","F","ROST","YUM","ORLY",
  "AZO","EBAY","ULTA","DRI","BBY","LVS","WYNN","MGM","HAS","POOL",
  // Consumer Staples
  "PG","PEP","KO","COST","WMT","PM","MO","CL","MDLZ","GIS",
  "KMB","KHC","SJM","HSY","STZ","TSN","CAG","CPB","CLX","CHD",
  "MKC","K","HRL","MNST","KDP","BF-B","TAP","SPC","CASY","USFD",
  // Energy
  "XOM","CVX","COP","EOG","SLB","MPC","PSX","OXY","VLO","HES",
  "PXD","DVN","FANG","HAL","BKR","TRGP","WMB","KMI","OKE","CTRA",
  // Industrials
  "GE","CAT","HON","UNP","UPS","RTX","DE","BA","LMT","GD",
  "NOC","MMM","ITW","EMR","PH","ETN","ROK","FTV","GWW","WAB",
  "FAST","IR","XYL","GNRC","CTAS","ODFL","CARR","OTIS","CSX","NSC",
  // Materials
  "LIN","APD","SHW","ECL","FCX","NEM","DOW","DD","NUE","VMC",
  "MLM","PPG","ALB","IFF","CE","CF","MOS","FMC","BALL","PKG",
  // Utilities
  "NEE","DUK","SO","D","AEP","EXC","SRE","XEL","WEC","ES",
  "ED","PEG","AWK","DTE","EIX","FE","AEE","CMS","CNP","PPL",
  // Real Estate
  "PLD","AMT","CCI","EQIX","PSA","SPG","O","DLR","WELL","VICI",
  "AVB","EQR","ARE","MAA","ESS","UDR","KIM","REG","VTR","HST",
  // Communication Services
  "NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR","EA","TTWO","WBD",
  "MTCH","PARA","RBLX","PINS","SNAP","ZM","LYV","OMC","IPG","GOOG",
]

const PL_TICKERS = [
  "CDR.WA","PKN.WA","PKO.WA","PZU.WA","KGH.WA","PEO.WA","DNP.WA","ALE.WA",
  "SPL.WA","CPS.WA","LPP.WA","MBK.WA","OPL.WA","ING.WA","BNP.WA","MIL.WA",
  "BDX.WA","ALR.WA","BFT.WA","CAR.WA","KRU.WA","DVL.WA","ASB.WA","APR.WA",
  "ECH.WA","RBW.WA","GEA.WA","WPL.WA","TOR.WA","VRG.WA","ENT.WA","ZEP.WA",
  "AMC.WA","MNC.WA","ATC.WA","PCR.WA","BIO.WA","VOX.WA","INK.WA","GPP.WA",
]

const NC_TICKERS = [
  "CRJ.WA","TEN.WA","BLO.WA","CIG.WA","CLN.WA","TXT.WA","PCF.WA","IMC.WA",
  "NVT.WA","DCR.WA","UNI.WA","ERB.WA","WTN.WA","PBX.WA","SES.WA","MAB.WA",
  "NTT.WA","MLG.WA","GRN.WA","MDG.WA","NVG.WA","SUN.WA","PHR.WA","HRP.WA",
]

// GICS sector mapping from Yahoo Finance sector names
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

function normalizeSector(raw: string | null): string | null {
  if (!raw) return null
  return SECTOR_MAP[raw] ?? null
}

export interface SectorStock {
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
  // Metrics
  peRatio: number | null
  forwardPE: number | null
  priceToSales: number | null
  evToEbitda: number | null
  dividendYield: number | null
  pegRatio: number | null
  ebitda: number | null // EV for EV/EBITDA calc
  enterpriseValue: number | null
  profitMargin: number | null
  revenueGrowth: number | null
}

export async function POST(req: NextRequest) {
  try {
    const { sector, market } = await req.json() as { sector?: string; market?: string }

    // Determine tickers based on market filter
    let tickers: { symbol: string; market: "US" | "GPW" | "NC" }[] = []
    if (!market || market === "ALL" || market === "US") {
      tickers.push(...US_TICKERS.map(s => ({ symbol: s, market: "US" as const })))
    }
    if (!market || market === "ALL" || market === "GPW") {
      tickers.push(...PL_TICKERS.map(s => ({ symbol: s, market: "GPW" as const })))
    }
    if (!market || market === "ALL" || market === "NC") {
      tickers.push(...NC_TICKERS.map(s => ({ symbol: s, market: "NC" as const })))
    }

    const results: SectorStock[] = []
    const sectorCounts: Record<string, number> = {}

    // Batch fetch — 15 at a time
    for (let i = 0; i < tickers.length; i += 15) {
      const batch = tickers.slice(i, i + 15)
      const batchResults = await Promise.allSettled(
        batch.map(async ({ symbol, market: mkt }) => {
          const [quote, stats] = await Promise.all([
            fetchQuote(symbol),
            fetchKeyStats(symbol).catch(() => null),
          ])

          const rawSector = stats?.sector ?? null
          const gicsSector = normalizeSector(rawSector)
          if (!gicsSector) return null // Skip if sector unknown

          // Track counts
          sectorCounts[gicsSector] = (sectorCounts[gicsSector] ?? 0) + 1

          // Filter by sector if specified
          if (sector && sector !== "ALL" && gicsSector !== sector) return null

          return {
            symbol: quote.symbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            marketCap: quote.marketCap,
            currency: quote.currency,
            exchange: quote.exchange,
            market: mkt,
            sector: gicsSector,
            industry: stats?.industry ?? null,
            peRatio: quote.peRatio,
            forwardPE: stats?.forwardPE ?? quote.forwardPE,
            priceToSales: stats?.priceToSales ?? null,
            evToEbitda: stats?.enterpriseToEbitda ?? null,
            dividendYield: quote.dividendYield != null ? quote.dividendYield * 100 : null,
            pegRatio: stats?.pegRatio ?? null,
            ebitda: stats?.freeCashFlow ?? null, // fallback
            enterpriseValue: stats?.enterpriseValue ?? null,
            profitMargin: stats?.profitMargin != null ? stats.profitMargin * 100 : null,
            revenueGrowth: stats?.revenueGrowth != null ? stats.revenueGrowth * 100 : null,
          } satisfies SectorStock
        })
      )

      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value) results.push(r.value)
      }
    }

    // Calculate sector medians for US stocks
    const usStocks = results.filter(s => s.market === "US")
    const sectorMedians: Record<string, Record<string, number | null>> = {}

    const metricKeys = ["peRatio", "forwardPE", "priceToSales", "evToEbitda", "dividendYield", "pegRatio", "profitMargin", "revenueGrowth"] as const

    // Group US stocks by sector
    const bySector: Record<string, SectorStock[]> = {}
    for (const s of usStocks) {
      if (!bySector[s.sector]) bySector[s.sector] = []
      bySector[s.sector].push(s)
    }

    for (const [sec, stocks] of Object.entries(bySector)) {
      sectorMedians[sec] = {}
      for (const key of metricKeys) {
        const vals = stocks
          .map(s => s[key])
          .filter((v): v is number => v != null && isFinite(v))
          .sort((a, b) => a - b)
        if (vals.length === 0) {
          sectorMedians[sec][key] = null
        } else {
          const mid = Math.floor(vals.length / 2)
          sectorMedians[sec][key] = vals.length % 2 === 0
            ? (vals[mid - 1] + vals[mid]) / 2
            : vals[mid]
        }
      }
    }

    return NextResponse.json({
      stocks: results,
      total: results.length,
      sectorCounts,
      sectorMedians,
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    console.error("[sector-screener] Error:", e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Sector screener error",
    }, { status: 500 })
  }
}
