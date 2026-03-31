import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

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

## ⚡ OBOWIĄZKOWA SEKCJA: AI & TECHNOLOGY RADAR

ZAWSZE — niezależnie od newsów — musisz wygenerować OSOBNY, DEDYKOWANY temat o nazwie zaczynającej się od "🤖 AI RADAR:" w polu "themeName".
Ten temat MUSI być pierwszy w tablicy "themes" i musi mieć flagę "isAIRadar": true.

W tym temacie przeanalizuj WSZYSTKIE newsy pod kątem AI i technologii. Szukaj:

a) **TRENDY AI** — w jakim kierunku zmierza rozwój AI? Jakie modele/architektury dominują? (np. multimodal, agentic AI, physical AI, on-device AI, reasoning models)
b) **DANE** — na jakie rodzaje danych jest teraz zapotrzebowanie? (syntetyczne, video, 3D, medyczne, robotyczne, finansowe) Kto je dostarcza?
c) **HARDWARE** — jakie chipy/GPU/TPU/akceleratory są w centrum uwagi? Kto ma przewagę? Jakie nowe architektury się pojawiają? (np. custom ASICs, photonic chips, neuromorphic)
d) **INFRASTRUKTURA** — data centers, cooling, energy for AI, networking (InfiniBand, ethernet AI fabrics)
e) **KONTRAKTY I PARTNERSTWA** — kto z kim podpisuje umowy? Kto staje się liderem w danej niszy AI? Jakie przejęcia/inwestycje się pojawiły?
f) **NOWE ZASTOSOWANIA** — robotyka, autonomiczne pojazdy, AI w medycynie, AI w finansach, AI coding, AI agents — co się zmienia?
g) **RYZYKA** — regulacje AI, ban na eksport chipów, obawy o AGI safety, pozwy o prawa autorskie

Dla AI RADAR:
- Podaj 5-8 beneficjentów (szukaj NISZOWYCH spółek, nie tylko NVDA/MSFT/GOOGL — np. producenci cooling systemów, dostawcy danych treningowych, firmy od edge AI)
- Podaj 3-5 zagrożonych spółek (kto traci w wyścigu AI? Czyj model biznesowy jest zagrożony?)
- chainOfEffects powinien pokazywać: trend → zapotrzebowanie → kto dostarcza → kto zyskuje
- deepAnalysis: 5-8 zdań, głęboka analiza DOKĄD zmierza AI i jakie to ma implikacje inwestycyjne

## ⚡ OBOWIĄZKOWA SEKCJA: NOWINKI TECHNICZNE

ZAWSZE — niezależnie od newsów — musisz wygenerować OSOBNY temat o nazwie zaczynającej się od "🔬 TECH BREAKTHROUGHS:" w polu "themeName".
Ten temat MUSI być DRUGI w tablicy "themes" (zaraz po AI RADAR) i musi mieć flagę "isTechBreakthroughs": true.

W tym temacie przeanalizuj WSZYSTKIE newsy pod kątem PRZEŁOMOWYCH technologii i produktów ogłoszonych w ostatnich 24h. Szukaj:

a) **NOWE PRODUKTY/CHIPY** — jakie firmy ogłosiły nowe procesory, chipy, akceleratory, urządzenia? (np. ARM ogłasza nowy chip AGI CPU, NVIDIA prezentuje nową architekturę GPU, Apple nowy M-chip)
b) **PATENTY I ODKRYCIA** — jakie patenty zostały złożone? Jakie przełomowe odkrycia naukowe mają zastosowanie komercyjne? (np. nowy materiał nadprzewodnikowy, przełom w bateriach solid-state, nowa metoda produkcji chipów)
c) **PRZEJĘCIA TECHNOLOGICZNE** — jakie firmy kupiły/inwestują w nowe technologie? (np. AMD kupuje startup AI, Broadcom przejmuje firmę od quantum)
d) **KONTRAKTY & PARTNERSTWA** — kluczowe umowy technologiczne: kto z kim, co dostarczają, jaka wartość? (np. OpenAI podpisuje kontrakt z ARM, Meta zamawia chipy od TSMC)
e) **INFRASTRUKTURA** — nowe centra danych, fabryki chipów (fabs), sieci energetyczne dla tech, nowe linie produkcyjne
f) **PRZEŁOMY W SEKTORACH** — biotechnologia (nowe leki, terapie genowe), energia (fuzja, perovskity), materiały (grafen, metamateriały), quantum (nowe kubity, korekcja błędów), robotyka (nowe platformy)
g) **REGULACJE TECH** — nowe prawo wpływające na tech: bany eksportowe, regulacje AI, zmiany patentowe, antitrust

Dla TECH BREAKTHROUGHS:
- Podaj 4-6 spółek które BEZPOŚREDNIO ogłosiły nowinkę lub są jej głównym beneficjentem
- Podaj 2-3 spółki zagrożone (czyj produkt staje się przestarzały? kto traci przewagę?)
- chainOfEffects: pokaż KONKRETNIE co zostało ogłoszone → jaki to ma wpływ na rynek → kto zarabia/traci
- deepAnalysis: 5-8 zdań, opisz KONKRETNE produkty/technologie z nazwami, parametrami, datami premier
- WAŻNE: Nie powtarzaj spółek z AI RADAR. Skup się na HARDWARE, MATERIAŁACH, INFRASTRUKTURZE, BIOTECH — nie na czystym AI/software

## ⚡ OBOWIĄZKOWA SEKCJA: QUANTUM RADAR

ZAWSZE — niezależnie od newsów — musisz wygenerować OSOBNY temat o nazwie zaczynającej się od "⚛️ QUANTUM RADAR:" w polu "themeName".
Ten temat MUSI być TRZECI w tablicy "themes" (po AI RADAR i TECH BREAKTHROUGHS) i musi mieć flagę "isQuantumRadar": true.

Quantum computing i quantum technology to jeden z najszybciej rozwijających się sektorów na najbliższe 5 lat. Przeanalizuj WSZYSTKIE dostępne newsy i swoją wiedzę o aktualnych wydarzeniach w quantum. Szukaj:

a) **QUANTUM COMPUTING** — nowe procesory kwantowe, rekordy kubitów, korekcja błędów kwantowych, quantum advantage/supremacy. Kto buduje najlepsze komputery kwantowe? (IonQ, Rigetti, D-Wave, IBM, Google, Quantinuum). Jakie nowe milestones osiągnięto?
b) **QUANTUM NETWORKING & INTERNET** — quantum key distribution (QKD), quantum repeaters, quantum internet. Kto buduje infrastrukturę? (Arqit, Toshiba QKD, ID Quantique)
c) **QUANTUM SENSING** — quantum sensors w medycynie, nawigacji, geologii. Nowe zastosowania komercyjne.
d) **QUANTUM SOFTWARE** — algorytmy kwantowe, quantum-as-a-service, cloud quantum platforms. Kto oferuje dostęp? (IBM Quantum, Amazon Braket, Azure Quantum)
e) **KONTRAKTY I FINANSOWANIE** — rządowe programy quantum (US CHIPS Act, EU Quantum Flagship), kontrakty z DoD/NASA/NSA, finansowanie startupów quantum
f) **MATERIAŁY I KOMPONENTY** — nadprzewodniki, kriogenika, lasery do pułapkowania jonów, chipy fotoniczne — kto dostarcza krytyczne komponenty?
g) **QUANTUM-SAFE CRYPTO** — post-quantum cryptography, migracja na quantum-resistant algorytmy (NIST standards). Kto jest liderem?
h) **QUANTUM + AI** — quantum machine learning, optymalizacja kwantowa dla AI, hybrydowe algorytmy kwantowo-klasyczne

Kluczowe spółki quantum do monitorowania:
- Pure-play: IONQ, RGTI, QBTS, QUBT, ARQQ
- Komponenty: FORM (probe stations), COHR (lasery), AMSC (nadprzewodniki)
- Big tech z quantum divisions: IBM (Quantum), GOOGL (Willow), MSFT (Azure Quantum), HON (Quantinuum)
- Polska: CRI.WA (Creotech — quantum instruments)

Dla QUANTUM RADAR:
- Podaj 4-6 beneficjentów z konkretnymi powodami (szukaj pure-play quantum + dostawców komponentów)
- Podaj 2-3 zagrożone spółki (kto przegrywa wyścig quantum? Czyja technologia staje się przestarzała?)
- chainOfEffects: pokaż trend quantum → jakie problemy rozwiązuje → kto zarabia
- deepAnalysis: 5-8 zdań, opisz AKTUALNY stan wyścigu quantum — kto prowadzi, jakie milestones osiągnięto, co dalej

## FORMAT ODPOWIEDZI

Odpowiedz WYŁĄCZNIE w formacie JSON (bez markdown, bez komentarzy):
{
  "themes": [
    {
      "themeName": "🤖 AI RADAR: [tytuł opisujący główny trend AI z dzisiejszych newsów]",
      "isAIRadar": true,
      "primarySector": "Information Technology",
      "affectedSectors": ["Information Technology", "Healthcare", "Industrials"],
      "impact": "bullish",
      "deepAnalysis": "Szczegółowa analiza trendów AI po polsku (5-8 zdań)",
      "chainOfEffects": [
        "Trend w AI → zapotrzebowanie na X → dostawcy Y zyskują",
        "..."
      ],
      "topBullish": [
        {
          "symbol": "SMCI",
          "name": "Super Micro Computer",
          "index": "NASDAQ",
          "why": "Główny dostawca serwerów GPU-optimized dla data centers AI — wzrost popytu na inference infrastructure",
          "relevance": "direct"
        }
      ],
      "topBearish": [
        {
          "symbol": "...",
          "name": "...",
          "index": "...",
          "why": "...",
          "relevance": "..."
        }
      ]
    },
    {
      "themeName": "🔬 TECH BREAKTHROUGHS: [tytuł opisujący główne nowinki technologiczne]",
      "isTechBreakthroughs": true,
      "primarySector": "Information Technology",
      "affectedSectors": ["Information Technology", "Industrials", "Healthcare"],
      "impact": "bullish",
      "deepAnalysis": "Konkretny opis nowinek: co ogłoszono, jakie parametry, kiedy premiera, jaki wpływ na rynek (5-8 zdań)",
      "chainOfEffects": [
        "Firma X ogłasza produkt Y → zwiększa konkurencję w segmencie Z → dostawca A zyskuje zamówienia",
        "..."
      ],
      "topBullish": [{"symbol": "ARM", "name": "Arm Holdings", "index": "NASDAQ", "why": "Ogłoszenie nowego chipu AGI CPU z 136 rdzeniami Neoverse V3 — pivot z licencjonowania na bezpośrednią sprzedaż chipów", "relevance": "direct"}],
      "topBearish": [{"symbol": "...", "name": "...", "index": "...", "why": "...", "relevance": "..."}]
    },
    {
      "themeName": "⚛️ QUANTUM RADAR: [tytuł opisujący główne wydarzenia w quantum]",
      "isQuantumRadar": true,
      "primarySector": "Information Technology",
      "affectedSectors": ["Information Technology", "Industrials", "Financials"],
      "impact": "bullish",
      "deepAnalysis": "Stan wyścigu quantum: kto prowadzi, jakie milestones, co dalej (5-8 zdań)",
      "chainOfEffects": ["Postęp w korekcji błędów → quantum advantage bliżej → wzrost popytu na hardware quantum → IONQ i RGTI zyskują zamówienia"],
      "topBullish": [{"symbol": "IONQ", "name": "IonQ", "index": "NASDAQ", "why": "Lider trapped-ion quantum computing — nowe kontrakty z DoD i enterprise", "relevance": "direct"}],
      "topBearish": [{"symbol": "...", "name": "...", "index": "...", "why": "...", "relevance": "..."}]
    },
    {
      "themeName": "Kryzys dostaw helu — konsekwencje wojny w Iranie",
      "primarySector": "Materials",
      "affectedSectors": ["Materials", "Healthcare", "Information Technology"],
      "impact": "mixed",
      "deepAnalysis": "Szczegółowa analiza po polsku (3-5 zdań)",
      "chainOfEffects": ["..."],
      "topBullish": [{"symbol": "APD", "name": "Air Products & Chemicals", "index": "S&P500", "why": "...", "relevance": "direct"}],
      "topBearish": [{"symbol": "KLAC", "name": "KLA Corporation", "index": "BOTH", "why": "...", "relevance": "indirect"}]
    }
  ]
}

WAŻNE:
- PIERWSZY temat ZAWSZE musi być AI RADAR z "isAIRadar": true.
- DRUGI temat ZAWSZE musi być TECH BREAKTHROUGHS z "isTechBreakthroughs": true.
- TRZECI temat ZAWSZE musi być QUANTUM RADAR z "isQuantumRadar": true.
- Pozostałe tematy: 3-5 (tyle ile wynika z newsów, nie więcej).
- Grupuj newsy TEMATYCZNIE, nie po sektorach GICS. Jeden temat może dotyczyć wielu sektorów.
- Dla każdego tematu: 3-5 beneficjentów i 2-4 zagrożone spółki (AI RADAR: 5-8 beneficjentów, 3-5 zagrożonych).
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

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = now.toISOString().slice(11, 16)

    const userPrompt = `Oto ${top.length} najważniejszych newsów ze świata. Data: ${dateStr}, godzina: ${timeStr} UTC.

${newsText}

ZADANIE: Przeprowadź DEEP RESEARCH tych KONKRETNYCH newsów powyżej. Zidentyfikuj kluczowe tematy inwestycyjne i dla każdego:
1. Rozpisz pełny łańcuch przyczynowo-skutkowy (1st → 2nd → 3rd order effects)
2. Znajdź KONKRETNE spółki z S&P500/NASDAQ które są bezpośrednio powiązane z danym tematem (nie generyczne blue chipy!)
3. Pomyśl o nieintuicyjnych połączeniach (np. surowce → półprzewodniki → software)

WAŻNE: Bazuj WYŁĄCZNIE na powyższych newsach. Twoja analiza musi bezpośrednio odnosić się do treści tych konkretnych artykułów. Nie generuj ogólnych analiz — każdy temat musi być zakotwiczony w co najmniej jednym z powyższych newsów.

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
