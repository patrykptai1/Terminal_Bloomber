// ============================================================
// AI Analysis Engine — uses OpenAI-compatible API
// ============================================================

const OPENAI_API_KEY = () => process.env.OPENAI_API_KEY ?? ""
const OPENAI_BASE_URL = () => process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
const AI_MODEL = () => process.env.AI_MODEL ?? "gpt-4o-mini"

export async function aiAnalyze(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = OPENAI_API_KEY()
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured. Add it to .env.local")
  }

  const res = await fetch(`${OPENAI_BASE_URL()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ""
}

export async function aiAnalyzeJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
  const raw = await aiAnalyze(
    systemPrompt + "\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown code blocks.",
    userPrompt
  )

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${cleaned.slice(0, 200)}...`)
  }
}
