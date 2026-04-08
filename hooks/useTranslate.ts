"use client"

import { useState, useEffect } from "react"

// In-memory cache shared across all hook instances (client-side)
const translationCache = new Map<string, string>()

export function useTranslatePL(text: string | undefined | null): string {
  const [translated, setTranslated] = useState<string>("")

  useEffect(() => {
    if (!text) { setTranslated(""); return }

    // Check client cache first
    const cached = translationCache.get(text)
    if (cached) { setTranslated(cached); return }

    // Set loading state — show "Tłumaczenie..." briefly
    setTranslated("")

    let cancelled = false

    // Use our server-side translation endpoint (no CORS issues, server-side caching)
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.translated) {
          translationCache.set(text, data.translated)
          setTranslated(data.translated)
        }
      })
      .catch(() => {
        // On error, show original text
        if (!cancelled) setTranslated(text)
      })

    return () => { cancelled = true }
  }, [text])

  // While loading, show "Tłumaczenie..." then original, then translated
  return translated || (text ? "Tłumaczenie..." : "")
}
