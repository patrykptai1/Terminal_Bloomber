// ============================================================
// Google News RSS — Free news fetcher with sentiment detection
// ============================================================

export interface NewsItem {
  headline: string
  source: string
  date: string
  url: string
  sentiment: "positive" | "negative" | "neutral"
}

const BULLISH_WORDS = [
  "beat", "beats", "record", "growth", "upgrade", "upgrades", "surges", "surge",
  "soars", "soar", "rally", "rallies", "gains", "gain", "rises", "rise",
  "jumps", "jump", "strong", "bullish", "outperform", "exceeds", "profit",
  "positive", "boost", "boosts", "accelerate", "expands", "expansion",
  "breakthrough", "innovation", "raised", "raises", "buy", "optimism",
  "higher", "momentum", "upbeat", "recovery", "recover",
]

const BEARISH_WORDS = [
  "miss", "misses", "cut", "cuts", "downgrade", "downgrades", "loss", "losses",
  "decline", "declines", "falls", "fall", "drops", "drop", "plunge", "plunges",
  "crash", "crashes", "weak", "bearish", "underperform", "warning", "warns",
  "layoff", "layoffs", "debt", "slump", "slumps", "disappoints", "sell",
  "lower", "concern", "risk", "fears", "fear", "recession", "bankruptcy",
  "fraud", "investigation", "lawsuit", "negative", "shrinks", "shrink",
]

function detectSentiment(headline: string): "positive" | "negative" | "neutral" {
  const lower = headline.toLowerCase()
  let bullCount = 0
  let bearCount = 0

  for (const word of BULLISH_WORDS) {
    if (lower.includes(word)) bullCount++
  }
  for (const word of BEARISH_WORDS) {
    if (lower.includes(word)) bearCount++
  }

  if (bullCount > bearCount) return "positive"
  if (bearCount > bullCount) return "negative"
  return "neutral"
}

function extractSource(htmlSnippet: string): string {
  // Google News RSS wraps source in <font> or after " - "
  const match = htmlSnippet.match(/<font[^>]*>([^<]+)<\/font>/)
  if (match) return match[1].trim()

  const dashMatch = htmlSnippet.match(/ - ([^<]+)$/)
  if (dashMatch) return dashMatch[1].trim()

  return "Unknown"
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim()
}

export async function fetchNews(
  ticker: string,
  companyName: string
): Promise<NewsItem[]> {
  const query = `${ticker} stock ${companyName}`
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 300 }, // cache 5 min
    })

    if (!res.ok) return []

    const xml = await res.text()

    // Parse XML items manually (no external XML parser needed)
    const items: NewsItem[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null

    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const block = match[1]

      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/)
      const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/)
      const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
      const descMatch = block.match(/<description>([\s\S]*?)<\/description>/)

      const rawTitle = titleMatch ? titleMatch[1].trim() : ""
      const headline = stripHtml(rawTitle)
      if (!headline) continue

      // Source is often appended after " - " in Google News titles
      let source = "Unknown"
      const titleDash = headline.lastIndexOf(" - ")
      let cleanHeadline = headline
      if (titleDash > 0) {
        source = headline.slice(titleDash + 3).trim()
        cleanHeadline = headline.slice(0, titleDash).trim()
      }

      // Fallback: try description for source
      if (source === "Unknown" && descMatch) {
        source = extractSource(descMatch[1])
      }

      const link = linkMatch ? linkMatch[1].trim() : ""
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : ""

      // Format date
      let dateStr = ""
      if (pubDate) {
        try {
          const d = new Date(pubDate)
          dateStr = d.toISOString().split("T")[0]
        } catch {
          dateStr = pubDate
        }
      }

      items.push({
        headline: cleanHeadline || headline,
        source,
        date: dateStr,
        url: link,
        sentiment: detectSentiment(cleanHeadline || headline),
      })
    }

    return items
  } catch {
    return []
  }
}
