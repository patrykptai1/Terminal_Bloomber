/**
 * In-memory cache for tab data that persists across tab switches.
 * Data is kept in memory (survives tab switches) but cleared on full page refresh.
 * This avoids re-fetching expensive API calls (like Grok analysis) when switching tabs.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, any>()

export function getTabCache<T>(key: string): T | null {
  return cache.has(key) ? (cache.get(key) as T) : null
}

export function setTabCache<T>(key: string, value: T): void {
  cache.set(key, value)
}

export function clearTabCache(key: string): void {
  cache.delete(key)
}

// Predefined cache keys
export const CACHE_KEYS = {
  // World News
  WORLD_NEWS_DATA: "worldnews:data",
  WORLD_NEWS_AI_RESPONSE: "worldnews:ai_response",

  // Stock Analysis (can extend later)
  ANALYSIS_DATA: "analysis:data",
  SCREENER_DATA: "screener:data",
  EARNINGS_DATA: "earnings:data",
} as const
