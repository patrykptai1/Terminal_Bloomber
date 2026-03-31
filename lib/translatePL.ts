// Lightweight EN→PL translation via free MyMemory API
// Cache persists in memory for the session

const cache = new Map<string, string>()

async function translateChunk(text: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|pl`
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

export async function translateToPL(text: string): Promise<string> {
  if (!text || text.length < 5) return text
  const cached = cache.get(text)
  if (cached) return cached

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

  const translated = await Promise.all(chunks.map(c => translateChunk(c)))
  const result = translated.join(" ")
  cache.set(text, result)
  return result
}
