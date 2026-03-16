export const TOKEN_BOOK_KEY = 'smwd_token_book'

export interface WatchedToken {
  mint: string
  symbol: string
  name: string
  logo: string
  mcapAtAdd: number
  priceAtAdd: number
  addedAt: number
}

export function loadTokenBook(): WatchedToken[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(TOKEN_BOOK_KEY) || '[]')
  } catch { return [] }
}

export function saveTokenBook(tokens: WatchedToken[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_BOOK_KEY, JSON.stringify(tokens))
  window.dispatchEvent(new Event('token-book-updated'))
}

export function addTokenToWatch(
  mint: string, symbol: string, name: string,
  logo = '', mcap = 0, price = 0,
): void {
  const book = loadTokenBook()
  if (book.some(t => t.mint === mint)) return
  saveTokenBook([...book, { mint, symbol, name, logo, mcapAtAdd: mcap, priceAtAdd: price, addedAt: Date.now() }])
}

export function removeTokenFromWatch(mint: string): void {
  saveTokenBook(loadTokenBook().filter(t => t.mint !== mint))
}

export function isTokenWatched(mint: string): boolean {
  return loadTokenBook().some(t => t.mint === mint)
}
