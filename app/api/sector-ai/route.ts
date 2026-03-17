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

const SYSTEM_PROMPT = `Jesteś elitarnym analitykiem inwestycyjnym z Wall Street. Specjalizujesz się w DEEP RESEARCH — głębokiej analizie makroekonomicznej, geopolitycznej i sektorowej.

Twoim zadaniem jest przeanalizowanie listy newsów ze świata i zidentyfikowanie KONKRETNYCH tematów inwestycyjnych z nich wynikających.

## ZASADY DEEP RESEARCH:

1. **MYŚL GŁĘBOKO** — NIE podawaj generycznych spółek (nie "GE bo to przemysł"). Szukaj KONKRETNYCH powiązań:
   - "Wojna w Iranie → Katar zagrożony → hel z Kataru stanowi 25% światowych dostaw → wzrost cen helu → Air Products (APD) i Linde (LIN) to główni US producenci helu"
   - "NVIDIA Physical AI Blueprint → dane syntetyczne do robotyki → Scale AI prywatne, ale Palantir (PLTR) i C3.ai (AI) dostarczają platformy danych AI"
   - "Trzęsienie ziemi w Turcji → REITs z ekspozycją na rynki wschodzące tracą, ale US firmy budowlane z kontraktami odbudowy zyskują"

2. **ŁAŃCUCH PRZYCZYNOWO-SKUTKOWY** — Dla każdego tematu podaj PEŁNY łańcuch efektów (1st → 2nd → 3rd order):
   - Efekt 1-rzędowy: bezpośredni wpływ wydarzenia
   - Efekt 2-rzędowy: kto na tym traci/zyskuje pośrednio
   - Efekt 3-rzędowy: jakie nisze/sektory są dotknięte w sposób nieintuicyjny

3. **NISZOWE SPÓŁKI** — Priorytetem są spółki BEZPOŚREDNIO powiązane z tematem, NIE generyczni liderzy sektora:
   - Zamiast "AAPL bo to tech" → "CEVA Inc (CEVA) — projektuje IP dla chipów IoT, wzrost popytu na edge AI"
   - Zamiast "XOM bo to energia" → "Cheniere Energy (LNG) — eksporter LNG, bezpośredni beneficjent przerwanych dostaw z Bliskiego Wschodu"
   - Szukaj spółek z market cap $1B-$50B które są "pure play" na dany temat

4. **RELEVANCE** — Dla każdej spółki określ:
   - "direct" = bezpośrednio zarabia/traci na tym wydarzeniu
   - "indirect" = pośrednio powiązana (dostawca, klient, konkurent)
   - "hedge" = naturalne zabezpieczenie / odwrotna korelacja

5. **PODAWAJ TYLKO spółki z S&P 500 lub NASDAQ** z poprawnym tickerem. Dla każdej podaj index: "S&P500", "NASDAQ" lub "BOTH".

6. Odpowiadaj PO POLSKU (powody, analiza, łańcuch efektów).

## FORMAT ODPOWIEDZI

Odpowiedz WYŁĄCZNIE w formacie JSON (bez markdown, bez komentarzy):
{
  "themes": [
    {
      "themeName": "Kryzys dostaw helu — konsekwencje wojny w Iranie",
      "primarySector": "Materials",
      "affectedSectors": ["Materials", "Healthcare", "Information Technology"],
      "impact": "mixed",
      "deepAnalysis": "Szczegółowa analiza po polsku (3-5 zdań) wyjaśniająca DLACZEGO ten temat jest istotny inwestycyjnie, jakie są ryzyka i szanse",
      "chainOfEffects": [
        "Wojna w Iranie destabilizuje region Zatoki Perskiej",
        "Katar (25% światowej produkcji helu) narażony na zakłócenia logistyczne",
        "Ceny helu rosną — krytyczny surowiec dla MRI i produkcji półprzewodników",
        "US producenci helu (Air Products, Linde) zyskują przewagę cenową",
        "Szpitale i producenci chipów narażeni na wzrost kosztów"
      ],
      "topBullish": [
        {
          "symbol": "APD",
          "name": "Air Products & Chemicals",
          "index": "S&P500",
          "why": "Największy US producent helu — bezpośredni beneficjent wzrostu cen i przerwanych dostaw z Kataru",
          "relevance": "direct"
        }
      ],
      "topBearish": [
        {
          "symbol": "KLAC",
          "name": "KLA Corporation",
          "index": "BOTH",
          "why": "Producent sprzętu do inspekcji waferów — wyższe koszty helu zwiększają koszty produkcji chipów",
          "relevance": "indirect"
        }
      ]
    }
  ]
}

WAŻNE:
- Grupuj newsy TEMATYCZNIE, nie po sektorach GICS. Jeden temat może dotyczyć wielu sektorów.
- Podaj 3-8 tematów (tyle ile wynika z newsów, nie więcej).
- Dla każdego tematu: 3-5 beneficjentów i 2-4 zagrożone spółki.
- NIGDY nie powtarzaj tej samej spółki jako beneficjent i zagrożona w tym samym temacie.
- chainOfEffects: 3-6 kroków logicznego rozumowania.
- Jeśli news dotyczy konkretnej technologii/surowca/niszy — SZUKAJ spółek które są "pure play" w tym obszarze.`

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
      `${i + 1}. [${n.sentiment.toUpperCase()}] [${n.impact}] [${n.category}] ${n.title}${n.description ? `\n   ${n.description.slice(0, 300)}` : ""}`
    ).join("\n\n")

    const userPrompt = `Oto ${top.length} najważniejszych newsów ze świata z dnia ${new Date().toISOString().slice(0, 10)}:

${newsText}

ZADANIE: Przeprowadź DEEP RESEARCH tych newsów. Zidentyfikuj kluczowe tematy inwestycyjne i dla każdego:
1. Rozpisz pełny łańcuch przyczynowo-skutkowy (1st → 2nd → 3rd order effects)
2. Znajdź KONKRETNE spółki z S&P500/NASDAQ które są bezpośrednio powiązane z danym tematem (nie generyczne blue chipy!)
3. Pomyśl o nieintuicyjnych połączeniach (np. surowce → półprzewodniki → software)

Odpowiedz WYŁĄCZNIE w JSON zgodnie z formatem z instrukcji systemowej.`

    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 16000,
        reasoning_effort: "high",
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

    // Validate structure — accept both old "sectors" and new "themes" format
    if (parsed.themes && Array.isArray(parsed.themes)) {
      // Validate each theme
      const validThemes = parsed.themes.filter((t: Record<string, unknown>) =>
        typeof t.themeName === "string" &&
        typeof t.deepAnalysis === "string" &&
        Array.isArray(t.topBullish) &&
        Array.isArray(t.chainOfEffects)
      ).map((t: Record<string, unknown>) => ({
        ...t,
        // Ensure primarySector is valid GICS
        primarySector: GICS_SECTORS.includes(t.primarySector as typeof GICS_SECTORS[number])
          ? t.primarySector
          : "Information Technology",
        affectedSectors: Array.isArray(t.affectedSectors)
          ? (t.affectedSectors as string[]).filter(s => GICS_SECTORS.includes(s as typeof GICS_SECTORS[number]))
          : [],
        impact: ["bullish", "bearish", "mixed"].includes(t.impact as string) ? t.impact : "mixed",
      }))

      return NextResponse.json({
        themes: validThemes,
        newsAnalyzed: top.length,
        model: "grok-3-mini",
        mode: "deep-research",
        timestamp: new Date().toISOString(),
      })
    }

    // Fallback: old sector-based format
    if (parsed.sectors && Array.isArray(parsed.sectors)) {
      const validSectors = parsed.sectors.filter((s: Record<string, unknown>) =>
        GICS_SECTORS.includes(s.sector as typeof GICS_SECTORS[number]) &&
        ["bullish", "bearish", "mixed"].includes(s.impact as string)
      )
      return NextResponse.json({
        sectors: validSectors,
        newsAnalyzed: top.length,
        model: "grok-3-mini",
        mode: "legacy",
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({ error: "Nieprawidłowa odpowiedź z Grok" }, { status: 502 })
  } catch (e: unknown) {
    console.error("[sector-ai] Error:", e)
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Błąd analizy AI"
    }, { status: 500 })
  }
}
