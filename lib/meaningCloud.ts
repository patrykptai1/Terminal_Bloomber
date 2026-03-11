// lib/meaningCloud.ts
// MeaningCloud Sentiment Analysis — https://www.meaningcloud.com/developer/sentiment-analysis
// Darmowy plan: 40,000 wywołań/miesiąc
// API KEY: MEANINGCLOUD_API_KEY w .env.local

const MC_BASE = 'https://api.meaningcloud.com'
const mcCache = new Map<string, { data: unknown; ts: number }>()
const MC_TTL = 60 * 60 * 1000 // 1h

const SENTIMENT_MAP: Record<string, string> = {
  P: 'Pozytywny',
  'P+': 'Bardzo pozytywny',
  NEU: 'Neutralny',
  N: 'Negatywny',
  'N+': 'Bardzo negatywny',
  NONE: 'Brak sentymentu',
}

export interface SentimentResult {
  score: string
  scoreLabel: string
  confidence: number
  confidenceLabel: string
  irony: boolean
  subjectivity: 'SUBJECTIVE' | 'OBJECTIVE'
  bullishScore: number
  topics: string[]
}

export async function analyzeSentiment(
  text: string,
  language = 'en',
): Promise<SentimentResult | null> {
  const apiKey = process.env.MEANINGCLOUD_API_KEY
  if (!apiKey) {
    console.warn('[MeaningCloud] No MEANINGCLOUD_API_KEY in .env.local')
    return null
  }

  const cacheKey = `mc_${language}_${text.substring(0, 100)}`
  const cached = mcCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < MC_TTL) return cached.data as SentimentResult

  try {
    const body = new URLSearchParams({
      key: apiKey,
      txt: text.substring(0, 10000),
      lang: language,
      model: 'general',
    })

    const res = await fetch(`${MC_BASE}/sentiment-2.1`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return null
    const data = await res.json() as {
      status?: { code?: string; msg?: string }
      score_tag?: string
      confidence?: string
      irony?: string
      subjectivity?: string
      sentimented_concept_list?: Array<{ form: string }>
    }

    if (data.status?.code !== '0') {
      console.error('[MeaningCloud] API error:', data.status?.msg)
      return null
    }

    const score = data.score_tag ?? 'NONE'
    const bullishMap: Record<string, number> = {
      'P+': 95, P: 80, NEU: 50, N: 20, 'N+': 5, NONE: 50,
    }
    const confidence = parseInt(data.confidence ?? '0')

    const result: SentimentResult = {
      score,
      scoreLabel: SENTIMENT_MAP[score] ?? 'Neutralny',
      confidence,
      confidenceLabel: confidence >= 80 ? 'wysoka' : confidence >= 50 ? 'średnia' : 'niska',
      irony: data.irony === 'IRONIC',
      subjectivity: (data.subjectivity as SentimentResult['subjectivity']) ?? 'OBJECTIVE',
      bullishScore: bullishMap[score] ?? 50,
      topics: data.sentimented_concept_list?.map(c => c.form) ?? [],
    }

    mcCache.set(cacheKey, { data: result, ts: Date.now() })
    return result
  } catch (err) {
    console.error('[MeaningCloud] Fetch error:', err)
    return null
  }
}

// Analiza narracji tokena
export async function analyzeTokenNarrative(texts: {
  description?: string
  whitepaper?: string
  twitterBio?: string
}): Promise<{
  overallSentiment: SentimentResult | null
  descriptionSentiment: SentimentResult | null
  narrativeScore: number
} | null> {
  const combined = [texts.description, texts.twitterBio]
    .filter(Boolean)
    .join(' ')
    .substring(0, 5000)

  if (!combined.trim()) return null

  const [overall, descResult] = await Promise.allSettled([
    analyzeSentiment(combined),
    texts.description ? analyzeSentiment(texts.description) : Promise.resolve(null),
  ])

  const overallResult = overall.status === 'fulfilled' ? overall.value : null
  const descSentiment = descResult.status === 'fulfilled' ? descResult.value : null

  const scores = [overallResult?.bullishScore, descSentiment?.bullishScore].filter(
    (s): s is number => s !== null && s !== undefined,
  )
  const narrativeScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50

  return {
    overallSentiment: overallResult,
    descriptionSentiment: descSentiment,
    narrativeScore: Math.round(narrativeScore),
  }
}
