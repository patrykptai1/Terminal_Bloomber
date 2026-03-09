import { NextRequest, NextResponse } from 'next/server'
import { gmgnGet, fetchTopTraders, fetchTokenHolders } from '@/lib/gmgn'
import { fetchTokenInfoBatch } from '@/lib/dexscreener'

const SOLANA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// ── Types ────────────────────────────────────────────────────────────────

export interface Step1Result {
  pass: boolean
  volume: number
  mcap: number
  migrated: boolean
  twitterNameChanged: boolean
  verdict: string
  tokenName: string
  tokenSymbol: string
}

export interface Step2Result {
  pass: boolean
  freshWalletsPct: number
  bundlersPct: number
  insiderPct: number
  riskFlags: string[]
}

export interface Step3Result {
  pass: boolean
  mentions: number
  kols: string[]
  narrative: string
  isLeader: boolean
  competitors: string[]
  summary: string
}

export interface Step4Result {
  smartWalletCount: number
  accumulatingClusters: number
  distributingClusters: number
  confirmationStrength: 'strong' | 'weak' | 'none'
}

export interface Step5Result {
  entrySignal: boolean
  smma33: number
  smma144: number
  currentMcap: number
  optimalRange: boolean
}

export interface Step6Result {
  holdSignal: boolean
  exitWarnings: string[]
  clusterStatus: 'accumulating' | 'holding' | 'distributing'
}

export interface StepStatus<T> {
  status: 'ok' | 'error'
  data: T | null
  error?: string
}

export interface BarryAnalyzeResponse {
  tokenAddress: string
  step1: StepStatus<Step1Result>
  step2: StepStatus<Step2Result>
  step3: StepStatus<Step3Result>
  step4: StepStatus<Step4Result>
  step5: StepStatus<Step5Result>
  step6: StepStatus<Step6Result>
}

// ── Helpers ──────────────────────────────────────────────────────────────

function smma(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(0)
  if (data.length < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) sum += data[i]
  result[period - 1] = sum / period
  for (let i = period; i < data.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + data[i]) / period
  }
  return result
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
  )
  return Promise.race([promise, timer])
}

function wrapStep<T>(fn: () => Promise<T>): Promise<StepStatus<T>> {
  return fn()
    .then(data => ({ status: 'ok' as const, data }))
    .catch(e => ({
      status: 'error' as const,
      data: null,
      error: e instanceof Error ? e.message : String(e),
    }))
}

// ── STEP 1: Token Filtering ─────────────────────────────────────────────

async function step1(tokenAddress: string): Promise<Step1Result> {
  // DexScreener data
  const dexMap = await withTimeout(
    fetchTokenInfoBatch([tokenAddress]),
    10000,
    'DexScreener'
  )
  const dexInfo = dexMap.get(tokenAddress)

  // GMGN token info for additional data
  let gmgnTokenData: Record<string, unknown> = {}
  try {
    const raw = await withTimeout(
      gmgnGet(`https://gmgn.ai/defi/quotation/v1/tokens/sol/${tokenAddress}`),
      10000,
      'GMGN token info'
    )
    gmgnTokenData = (raw.data as Record<string, unknown>)?.token as Record<string, unknown> ?? {}
  } catch { /* fallback to dex only */ }

  const volume = (gmgnTokenData.volume_24h as number) ??
    (dexInfo ? dexInfo.fdv * 0.1 : 0) // rough estimate if no gmgn
  const mcap = (gmgnTokenData.market_cap as number) ?? dexInfo?.fdv ?? 0
  const tokenName = (gmgnTokenData.name as string) ?? dexInfo?.name ?? 'Unknown'
  const tokenSymbol = (gmgnTokenData.symbol as string) ?? dexInfo?.symbol ?? '???'

  // Migration check — if pair exists on DexScreener it's post-migration
  const migrated = !!dexInfo

  // Twitter name change check via GMGN
  const twitterNameChanged = (gmgnTokenData.twitter_name_change as boolean) ?? false

  const volumePass = volume >= 400_000
  const mcapPass = mcap >= 250_000

  let verdict = ''
  if (twitterNameChanged) {
    verdict = 'AUTO-SKIP: Nazwa tokena na Twitterze się zmieniła'
  } else if (!migrated) {
    verdict = 'FAIL: Token nie przeszedł migracji (brak pary na DEX)'
  } else if (!volumePass && !mcapPass) {
    verdict = `FAIL: Niski volume ($${(volume / 1000).toFixed(0)}K) i mcap ($${(mcap / 1000).toFixed(0)}K)`
  } else if (!volumePass) {
    verdict = `FAIL: Niski volume 24h ($${(volume / 1000).toFixed(0)}K < $400K)`
  } else if (!mcapPass) {
    verdict = `FAIL: Niski mcap ($${(mcap / 1000).toFixed(0)}K < $250K)`
  } else {
    verdict = 'PASS: Token spełnia kryteria filtrowania'
  }

  return {
    pass: volumePass && mcapPass && migrated && !twitterNameChanged,
    volume,
    mcap,
    migrated,
    twitterNameChanged,
    verdict,
    tokenName,
    tokenSymbol,
  }
}

// ── STEP 2: Holder Structure Analysis ────────────────────────────────────

async function step2(tokenAddress: string): Promise<Step2Result> {
  const holders = await withTimeout(
    fetchTokenHolders(tokenAddress, 100),
    10000,
    'GMGN holders'
  )

  const riskFlags: string[] = []
  const total = holders.length
  if (total === 0) {
    return {
      pass: false,
      freshWalletsPct: 0,
      bundlersPct: 0,
      insiderPct: 0,
      riskFlags: ['Brak danych o holderach'],
    }
  }

  // Fresh wallets: wallets with very low SOL balance (< 0.05 SOL = 50M lamports)
  const freshCount = holders.filter(h => h.nativeBalance < 50_000_000).length
  const freshWalletsPct = Math.round((freshCount / total) * 100)

  // Bundle detection: look for holders that started holding at the same second
  const holdingTimes = holders
    .map(h => h.startHoldingAt)
    .filter((t): t is number => t !== null && t > 0)

  const timeCounts = new Map<number, number>()
  for (const t of holdingTimes) {
    // Round to 2-second window for bundle detection
    const bucket = Math.floor(t / 2)
    timeCounts.set(bucket, (timeCounts.get(bucket) ?? 0) + 1)
  }
  const bundledCount = [...timeCounts.values()]
    .filter(count => count >= 3) // 3+ buys in same 2s window = bundle
    .reduce((sum, c) => sum + c, 0)
  const bundlersPct = Math.round((bundledCount / total) * 100)

  // Insider concentration: check if top 2 holders have > 10% combined
  // We use GMGN which sorts by amount_percentage desc
  // Estimate from realized + unrealized profit as proxy for holding size
  const topHolderProfits = holders.slice(0, 2)
  const totalProfit = holders.reduce((s, h) =>
    s + Math.abs(h.realizedProfit) + Math.abs(h.unrealizedProfit), 0) || 1
  const top2Profit = topHolderProfits.reduce((s, h) =>
    s + Math.abs(h.realizedProfit) + Math.abs(h.unrealizedProfit), 0)
  const insiderPct = Math.round((top2Profit / totalProfit) * 100)

  if (freshWalletsPct >= 40) riskFlags.push(`${freshWalletsPct}% fresh wallets (próg: <40%)`)
  if (bundlersPct >= 15) riskFlags.push(`${bundlersPct}% bundled adresy (próg: <15%)`)
  if (insiderPct >= 10) riskFlags.push(`${insiderPct}% koncentracja top 2 (próg: <10%)`)

  return {
    pass: freshWalletsPct < 40 && bundlersPct < 15 && insiderPct < 10,
    freshWalletsPct,
    bundlersPct,
    insiderPct,
    riskFlags,
  }
}

// ── STEP 3: Narrative & KOL Analysis (Grok with X search) ───────────────

async function step3(tokenAddress: string, tokenName: string, tokenSymbol: string): Promise<Step3Result> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return {
      pass: false,
      mentions: 0,
      kols: [],
      narrative: 'Brak klucza XAI_API_KEY',
      isLeader: false,
      competitors: [],
      summary: 'Brak klucza API — nie można przeanalizować narracji',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  const res = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    cache: 'no-store',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-fast-non-reasoning',
      input: [
        {
          role: 'system',
          content: 'You are a crypto Twitter analyst. Use the x_search tool to find real posts. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: `Search X/Twitter for token "${tokenName}" ($${tokenSymbol}) with address ${tokenAddress} in the last 24 hours.

Search queries: "$${tokenSymbol}", "${tokenSymbol} crypto", "${tokenSymbol} Solana"

Answer in this exact JSON format:
{
  "mentions": <number of unique posts found>,
  "kols": ["@handle1", "@handle2"],
  "narrative": "<what is the theme/narrative of this token>",
  "isLeader": <true if this token leads a new narrative, false if it copies another>,
  "competitors": ["$TICKER1", "$TICKER2"],
  "summary": "<1-2 sentence summary of KOL sentiment and narrative strength>"
}

Rules:
- kols = crypto accounts with 10K+ followers mentioning it
- isLeader = true only if this appears to be the FIRST token with this theme
- competitors = other tokens competing for the same narrative`,
        },
      ],
      tools: [{ type: 'x_search' as const }],
      text: { format: { type: 'json_object' } },
      temperature: 0.2,
    }),
  })

  clearTimeout(timeout)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`xAI API ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  let textContent = ''
  for (const item of (data.output ?? [])) {
    if (item.type === 'message') {
      for (const block of (item.content ?? [])) {
        if (block.type === 'output_text' && block.text) textContent = block.text
      }
    }
  }

  if (!textContent) throw new Error('Brak odpowiedzi z xAI')

  const cleaned = textContent
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  const parsed = JSON.parse(cleaned)

  const mentions = parsed.mentions ?? 0
  const kols = Array.isArray(parsed.kols) ? parsed.kols : []
  const hasKols = kols.length > 0
  const pass = mentions >= 5 && (hasKols || parsed.isLeader)

  return {
    pass,
    mentions,
    kols,
    narrative: parsed.narrative ?? 'Brak danych',
    isLeader: parsed.isLeader ?? false,
    competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
    summary: parsed.summary ?? '',
  }
}

// ── STEP 4: Smart Money Confirmation ────────────────────────────────────

async function step4(tokenAddress: string): Promise<Step4Result> {
  const traders = await withTimeout(
    fetchTopTraders(tokenAddress, 100),
    10000,
    'GMGN traders'
  )

  // Smart wallet: realized profit > 0, multiple trades, good win signals
  const smartWallets = traders.filter(t => {
    const hasProfit = t.realizedProfit > 1000
    const hasActivity = t.buyCount >= 2
    const notBot = !t.tags.some(tag =>
      ['bundler', 'sniper', 'sandwich_bot'].includes(tag)
    )
    const notCex = !t.exchange
    return hasProfit && hasActivity && notBot && notCex
  })

  // Cluster analysis: accumulating vs distributing
  const accumulating = smartWallets.filter(w => w.buyCount > w.sellCount).length
  const distributing = smartWallets.filter(w => w.sellCount > w.buyCount).length

  let confirmationStrength: Step4Result['confirmationStrength'] = 'none'
  if (smartWallets.length >= 5 && accumulating > distributing) {
    confirmationStrength = 'strong'
  } else if (smartWallets.length >= 2) {
    confirmationStrength = 'weak'
  }

  return {
    smartWalletCount: smartWallets.length,
    accumulatingClusters: accumulating,
    distributingClusters: distributing,
    confirmationStrength,
  }
}

// ── STEP 5: SMMA 33/144 Timing ─────────────────────────────────────────

async function step5(tokenAddress: string, currentMcap: number): Promise<Step5Result> {
  // Fetch OHLCV from GMGN kline (1m candles, last 200)
  const now = Math.floor(Date.now() / 1000)
  const from = now - 200 * 60 // 200 minutes ago

  const klineData = await withTimeout(
    gmgnGet(
      `https://gmgn.ai/api/v1/token_kline/sol/${tokenAddress}?resolution=1m&from=${from}&to=${now}`
    ),
    10000,
    'GMGN kline'
  )

  const candles = ((klineData.data as Record<string, unknown>)?.list as Record<string, unknown>[]) ?? []

  if (candles.length < 144) {
    return {
      entrySignal: false,
      smma33: 0,
      smma144: 0,
      currentMcap,
      optimalRange: currentMcap >= 1_000_000 && currentMcap <= 3_000_000,
    }
  }

  const highs = candles.map(c => parseFloat(String(c.high ?? c.close ?? 0)))
  const lows = candles.map(c => parseFloat(String(c.low ?? c.close ?? 0)))

  const smma33High = smma(highs, 33)
  const smma33Low = smma(lows, 33)
  const smma144High = smma(highs, 144)
  const smma144Low = smma(lows, 144)

  const lastIdx = candles.length - 1
  const s33h = smma33High[lastIdx] || 0
  const s33l = smma33Low[lastIdx] || 0
  const s144h = smma144High[lastIdx] || 0
  const s144l = smma144Low[lastIdx] || 0

  const entrySignal = s33h > s144h && s33l > s144l

  return {
    entrySignal,
    smma33: s33h,
    smma144: s144h,
    currentMcap,
    optimalRange: currentMcap >= 1_000_000 && currentMcap <= 3_000_000,
  }
}

// ── STEP 6: Exit Strategy ───────────────────────────────────────────────

async function step6(
  tokenAddress: string,
  step4Data: Step4Result | null,
  step5Data: Step5Result | null,
): Promise<Step6Result> {
  const exitWarnings: string[] = []

  // Check SMMA crossover (bearish)
  if (step5Data && step5Data.smma33 > 0 && step5Data.smma144 > 0) {
    if (step5Data.smma33 < step5Data.smma144) {
      exitWarnings.push('SMMA 33 poniżej SMMA 144 — sygnał niedźwiedzi')
    }
  }

  // Check cluster distribution
  let clusterStatus: Step6Result['clusterStatus'] = 'holding'
  if (step4Data) {
    if (step4Data.distributingClusters > step4Data.accumulatingClusters) {
      clusterStatus = 'distributing'
      exitWarnings.push(
        `Klastry dystrybuują (${step4Data.distributingClusters} sprzedaje vs ${step4Data.accumulatingClusters} kupuje)`
      )
    } else if (step4Data.accumulatingClusters > step4Data.distributingClusters) {
      clusterStatus = 'accumulating'
    }
  }

  // Check for coordinated selling from top traders
  const traders = await withTimeout(
    fetchTopTraders(tokenAddress, 50),
    10000,
    'GMGN traders step6'
  ).catch(() => [])

  const recentSellers = traders.filter(t => {
    const recentlySold = t.sellCount > 0 && t.realizedProfit > 500
    return recentlySold && t.sellCount >= t.buyCount
  })

  if (recentSellers.length >= 5) {
    exitWarnings.push(`${recentSellers.length} smart wallets aktywnie sprzedaje`)
  }

  const holdSignal = exitWarnings.length === 0

  return { holdSignal, exitWarnings, clusterStatus }
}

// ── Main handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { tokenAddress?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tokenAddress = body.tokenAddress?.trim()
  if (!tokenAddress || !SOLANA_REGEX.test(tokenAddress)) {
    return NextResponse.json({ error: 'Nieprawidłowy adres tokena' }, { status: 400 })
  }

  // Step 1 first — we need token name/symbol for step 3
  const s1 = await wrapStep(() => step1(tokenAddress))

  const tokenName = s1.data?.tokenName ?? 'Unknown'
  const tokenSymbol = s1.data?.tokenSymbol ?? '???'
  const currentMcap = s1.data?.mcap ?? 0

  // Steps 2-5 can run in parallel
  const [s2, s3, s4, s5] = await Promise.all([
    wrapStep(() => step2(tokenAddress)),
    wrapStep(() => step3(tokenAddress, tokenName, tokenSymbol)),
    wrapStep(() => step4(tokenAddress)),
    wrapStep(() => step5(tokenAddress, currentMcap)),
  ])

  // Step 6 depends on step 4 and 5
  const s6 = await wrapStep(() => step6(tokenAddress, s4.data, s5.data))

  const response: BarryAnalyzeResponse = {
    tokenAddress,
    step1: s1,
    step2: s2,
    step3: s3,
    step4: s4,
    step5: s5,
    step6: s6,
  }

  return NextResponse.json(response)
}
