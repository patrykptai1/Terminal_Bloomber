"use client"

import { useState, useEffect } from "react"
import { translateToPL } from "@/lib/translatePL"

// In-memory cache shared across all hook instances
const translationCache = new Map<string, string>()

export function useTranslatePL(text: string | undefined | null): string {
  const [translated, setTranslated] = useState<string>("")

  useEffect(() => {
    if (!text) { setTranslated(""); return }

    // Check cache first
    const cached = translationCache.get(text)
    if (cached) { setTranslated(cached); return }

    let cancelled = false
    translateToPL(text).then(result => {
      if (!cancelled) {
        translationCache.set(text, result)
        setTranslated(result)
      }
    })
    return () => { cancelled = true }
  }, [text])

  return translated || text || ""
}
