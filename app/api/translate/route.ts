import { NextRequest, NextResponse } from "next/server"

// Server-side cache — persists across requests in the same process
const cache = new Map<string, string>()

async function translateChunk(text: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pl`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return text
    const data = await res.json()
    const t = data?.responseData?.translatedText || text
    // MyMemory returns ALL CAPS when confidence is low — fallback
    return t === t.toUpperCase() && t.length > 20 ? text : t
  } catch {
    return text
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== "string" || text.length < 5) {
      return NextResponse.json({ translated: text ?? "" })
    }

    // Check cache
    const cached = cache.get(text)
    if (cached) {
      return NextResponse.json({ translated: cached })
    }

    // Split into ~480 char chunks at sentence boundaries
    const chunks: string[] = []
    let remaining = text
    while (remaining.length > 0) {
      if (remaining.length <= 480) {
        chunks.push(remaining)
        break
      }
      const slice = remaining.slice(0, 480)
      const lastDot = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "))
      const splitAt = lastDot > 100 ? lastDot + 2 : 480
      chunks.push(remaining.slice(0, splitAt))
      remaining = remaining.slice(splitAt)
    }

    // Translate sequentially (avoid rate limit)
    const results: string[] = []
    for (const chunk of chunks) {
      const chunkCached = cache.get(chunk)
      if (chunkCached) {
        results.push(chunkCached)
      } else {
        const translated = await translateChunk(chunk)
        cache.set(chunk, translated)
        results.push(translated)
        // Small delay between chunks to avoid rate limit
        if (chunks.length > 1) await new Promise(r => setTimeout(r, 300))
      }
    }

    const result = results.join(" ")
    cache.set(text, result)
    return NextResponse.json({ translated: result })
  } catch {
    return NextResponse.json({ translated: "" })
  }
}
