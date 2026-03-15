export function currencySymbol(currency: string): string {
  switch (currency) {
    case "USD": return "$"
    case "PLN": return "zł"
    case "EUR": return "€"
    case "GBP": return "£"
    case "CHF": return "CHF "
    case "JPY": return "¥"
    default: return currency + " "
  }
}

export function fmtPrice(value: number, currency: string): string {
  const sym = currencySymbol(currency)
  if (sym === "zł") return `${value.toFixed(2)} zł`
  return `${sym}${value.toFixed(2)}`
}

export function fmtBigValue(value: number, currency: string): string {
  const sym = currencySymbol(currency)
  const prefix = sym === "zł" ? "" : sym
  const suffix = sym === "zł" ? " zł" : ""
  if (Math.abs(value) >= 1e12) return `${prefix}${(value / 1e12).toFixed(1)}T${suffix}`
  if (Math.abs(value) >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B${suffix}`
  if (Math.abs(value) >= 1e6) return `${prefix}${(value / 1e6).toFixed(0)}M${suffix}`
  return `${prefix}${value.toLocaleString()}${suffix}`
}
