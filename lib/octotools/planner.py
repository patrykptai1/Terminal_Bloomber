import os
import json
import requests

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

TOOL_CARDS_SUMMARY = """
Dostępne narzędzia:
1. Helius_Wallet_Tool — historia transakcji i holdings portfela Solana
2. GMGN_SmartMoney_Tool — etykiety KOL, PnL 30d, winrate, early buyers dla tokena
3. DexScreener_Token_Tool — cena, market cap, volume, liquidity tokena
4. Conviction_Scorer_Tool — oblicza conviction score na podstawie zebranych danych
"""


def _groq_call(prompt: str, max_tokens: int = 500, temperature: float = 0.1) -> str:
    """Call Groq API and return content string."""
    r = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def create_global_plan(user_query: str) -> dict:
    """High-level plan: rozkłada zapytanie na kroki i wybiera narzędzia."""
    prompt = f"""Jesteś planistą agenta AI analizującego smart money na Solanie.

{TOOL_CARDS_SUMMARY}

Zapytanie użytkownika: "{user_query}"

Odpowiedz TYLKO w JSON (bez markdown, bez ```):
{{
  "objective": "główny cel analizy",
  "steps": [
    {{
      "step_id": 1,
      "sub_goal": "co chcemy osiągnąć w tym kroku",
      "tool": "nazwa_narzędzia",
      "reason": "dlaczego to narzędzie"
    }}
  ],
  "expected_output": "co użytkownik otrzyma na końcu"
}}

Zasady:
- Maksymalnie 4 kroki
- Jeśli zapytanie dotyczy WALLET → użyj Helius_Wallet_Tool + GMGN_SmartMoney_Tool + Conviction_Scorer_Tool
- Jeśli dotyczy TOKEN → użyj DexScreener_Token_Tool + GMGN_SmartMoney_Tool
- Jeśli ogólne pytanie (trending, nowe pary) → 1-2 narzędzia
- Conviction_Scorer_Tool zawsze jako ostatni krok jeśli analizujesz wallet
- Odpowiedź MUSI być poprawnym JSON, bez żadnych komentarzy czy markdown"""

    content = _groq_call(prompt, max_tokens=500, temperature=0.1)
    # Clean markdown if LLM added it
    content = content.replace("```json", "").replace("```", "").strip()
    return json.loads(content)


def create_step_plan(step: dict, context: dict) -> dict:
    """Low-level plan: dokładne parametry dla konkretnego kroku."""
    # Truncate context to avoid token limit
    ctx_str = json.dumps(context, ensure_ascii=False, default=str)
    if len(ctx_str) > 2000:
        ctx_str = ctx_str[:2000] + "..."

    prompt = f"""Jesteś wykonawcą kroku w analizie smart money.

Aktualny kontekst (dane zebrane do tej pory):
{ctx_str}

Aktualny krok do wykonania:
{json.dumps(step, ensure_ascii=False)}

Odpowiedz TYLKO w JSON (bez markdown, bez ```):
{{
  "tool": "nazwa_narzędzia",
  "params": {{
    "klucz": "wartość"
  }}
}}

Wyciągnij potrzebne wartości z kontekstu (np. wallet_address, token_address) jeśli są dostępne.

Parametry narzędzi:
- GMGN_SmartMoney_Tool: mode (WYMAGANE) + dodatkowe parametry:
  - mode="wallet_info" → wymaga wallet_address
  - mode="token_traders" → wymaga token_address
  - mode="trending" → brak dodatkowych parametrów (zwraca top gainers)
  - mode="new_pairs" → brak dodatkowych parametrów (zwraca nowe pary)
- DexScreener_Token_Tool: mode (WYMAGANE) + dodatkowe parametry:
  - mode="token_info" → wymaga token_address (adres mint tokena)
  - mode="trending" → brak dodatkowych parametrów
- Helius_Wallet_Tool: wallet_address (WYMAGANE), limit (opcjonalnie, domyślnie 50)
- Conviction_Scorer_Tool: wallet_pnl_30d, winrate, token_volume_24h, token_liquidity, is_early_buyer, buy_count_30d — wyciągnij z kontekstu

WAŻNE: Jeśli krok dotyczy "trending" lub "nowe pary" — użyj mode="trending" lub mode="new_pairs".
Jeśli nie ma wallet_address/token_address w kontekście — NIE wymyślaj, użyj mode bez adresu.
Odpowiedź MUSI być poprawnym JSON, bez żadnych komentarzy czy markdown"""

    content = _groq_call(prompt, max_tokens=300, temperature=0.0)
    content = content.replace("```json", "").replace("```", "").strip()
    return json.loads(content)
