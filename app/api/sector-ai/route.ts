import { NextRequest, NextResponse } from "next/server"

const XAI_API_KEY = process.env.XAI_API_KEY ?? ""
const XAI_BASE_URL = "https://api.x.ai/v1"

const GICS_SECTORS = [
  "Information Technology",
  "Healthcare",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Industrials",
  "Materials",
  "Utilities",
  "Real Estate",
  "Communication Services",
] as const

interface NewsInput {
  id: string
  title: string
  description?: string
  sentiment: string
  category: string
  impact: string
}

const SYSTEM_PROMPT = `Jesteś ekspertem od makroekonomii, geopolityki i rynków finansowych US (S&P 500, NASDAQ).

Twoim zadaniem jest przeanalizowanie listy newsów ze świata i określenie ich wpływu na 11 sektorów GICS:
Information Technology, Healthcare, Financials, Consumer Discretionary, Consumer Staples, Energy, Industrials, Materials, Utilities, Real Estate, Communication Services

Dla KAŻDEGO sektora który jest dotknięty przez te newsy, musisz:
1. Określić wpływ: "bullish" (pozytywny), "bearish" (negatywny) lub "mixed"
2. Podać KONKRETNY powód po polsku (1-2 zdania)
3. Podać TOP 3 spółki-beneficjentów (które ZYSKAJĄ) z S&P500/NASDAQ z uzasadnieniem po polsku
4. Podać TOP 3 spółki zagrożone (które STRACĄ) z S&P500/NASDAQ z uzasadnieniem po polsku
5. Nazwę wydarzenia/zjawiska po polsku

WAŻNE:
- Myśl o drugorzędnych i trzeciorzędnych efektach (np. wojna w Iranie → hel z Kataru zagrożony → półprzewodniki → US chip stocks)
- Negatywna wiadomość globalna może być POZYTYWNA dla US spółek (np. kryzys w Europie → kapitał ucieka do US)
- Podawaj TYLKO spółki z S&P 500 lub NASDAQ, z tickerem
- Dla każdej spółki podaj czy jest w "S&P500", "NASDAQ" lub "BOTH"

Odpowiedz WYŁĄCZNIE w formacie JSON (bez markdown):
{
  "sectors": [
    {
      "sector": "Energy",
      "impact": "bullish",
      "eventName": "Konflikt na Bliskim Wschodzie",
      "reason": "Wyjaśnienie po polsku dlaczego ten sektor jest dotknięty",
      "topBullish": [
        { "symbol": "XOM", "name": "ExxonMobil", "index": "S&P500", "why": "Powód po polsku" }
      ],
      "topBearish": [
        { "symbol": "DAL", "name": "Delta Air Lines", "index": "S&P500", "why": "Powód po polsku" }
      ]
    }
  ]
}`

export async function POST(req: NextRequest) {
  if (!XAI_API_KEY) {
    return NextResponse.json({ error: "Brak klucza XAI_API_KEY" }, { status: 500 })
  }

  try {
    const { newsItems } = (await req.json()) as { newsItems: NewsInput[] }

    if (!newsItems?.length) {
      return NextResponse.json({ error: "Brak newsów do analizy" }, { status: 400 })
    }

    // Prepare news summary for Grok (limit to top 30 most impactful)
    const sorted = [...newsItems].sort((a, b) => {
      const ord: Record<string, number> = { high: 0, medium: 1, low: 2 }
      return (ord[a.impact] ?? 2) - (ord[b.impact] ?? 2)
    })
    const top = sorted.slice(0, 30)

    const newsText = top.map((n, i) =>
      `${i + 1}. [${n.sentiment.toUpperCase()}] [${n.impact}] ${n.title}${n.description ? ` — ${n.description.slice(0, 150)}` : ""}`
    ).join("\n")

    const userPrompt = `Oto ${top.length} najważniejszych newsów ze świata z dzisiejszego dnia:\n\n${newsText}\n\nPrzeanalizuj wpływ tych wydarzeń na sektory GICS rynku US (S&P 500 + NASDAQ). Podaj TYLKO sektory które SĄ DOTKNIĘTE. Odpowiedz w JSON.`

    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini-fast",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("[sector-ai] Grok error:", response.status, errText)
      return NextResponse.json({ error: `Grok API error: ${response.status}` }, { status: 502 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ""

    // Parse JSON from response (handle potential markdown wrapping)
    let jsonStr = content.trim()
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
    }

    const parsed = JSON.parse(jsonStr)

    // Validate structure
    if (!parsed.sectors || !Array.isArray(parsed.sectors)) {
      return NextResponse.json({ error: "Nieprawidłowa odpowiedź z Grok" }, { status: 502 })
    }

    // Validate each sector
    const validSectors = parsed.sectors.filter((s: Record<string, unknown>) =>
      GICS_SECTORS.includes(s.sector as typeof GICS_SECTORS[number]) &&
      ["bullish", "bearish", "mixed"].includes(s.impact as string)
    )

    return NextResponse.json({
      sectors: validSectors,
      newsAnalyzed: top.length,
      model: "grok-3-mini-fast",
      timestamp: new Date().toISOString(),
    })
  } catch (e: unknown) {
    console.error("[sector-ai] Error:", e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Błąd analizy AI"
    }, { status: 500 })
  }
}
