import os
import json
import requests
from .planner import create_global_plan, create_step_plan
from .executor import execute_tool

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


def run_agent(user_query: str, context_from_ui: dict = None) -> dict:
    """
    Główna funkcja agenta OctoTools.
    Zwraca: { answer, trajectory, steps_taken, global_plan }
    """
    if context_from_ui is None:
        context_from_ui = {}

    trajectory = []
    context = {**context_from_ui}

    # 1. HIGH-LEVEL PLAN
    try:
        global_plan = create_global_plan(user_query)
        trajectory.append({"type": "plan", "content": global_plan})
    except Exception as e:
        return {
            "answer": f"Nie udało się stworzyć planu analizy: {str(e)}",
            "trajectory": [],
            "steps_taken": 0,
            "global_plan": None,
        }

    steps = global_plan.get("steps", [])

    # 2. EXECUTOR — krok po kroku
    for step in steps:
        try:
            # Low-level plan dla tego kroku
            step_params = create_step_plan(step, context)
            tool_name = step_params.get("tool", step.get("tool"))
            params = step_params.get("params", {})

            # Wykonaj narzędzie
            result = execute_tool(tool_name, params)

            # Zapisz do trajektorii i kontekstu
            trajectory.append(
                {
                    "type": "tool_call",
                    "step_id": step.get("step_id"),
                    "tool": tool_name,
                    "params": _sanitize_params(params),
                    "result": _truncate_result(result),
                    "sub_goal": step.get("sub_goal"),
                }
            )

            # Dodaj wyniki do kontekstu dla kolejnych kroków
            context[f"step_{step.get('step_id')}_result"] = result
            context["last_tool_result"] = result

            # Propaguj kluczowe dane
            if "wallet_address" in params:
                context["wallet_address"] = params["wallet_address"]
            if "token_address" in params:
                context["token_address"] = params["token_address"]
            if "pnl_30d" in result:
                context["wallet_pnl_30d"] = result.get("pnl_30d", 0)
            if "winrate" in result:
                context["winrate"] = result.get("winrate", 0)
            if "volume_24h" in result:
                context["token_volume_24h"] = result.get("volume_24h", 0)
            if "liquidity" in result:
                context["token_liquidity"] = result.get("liquidity", 0)

        except Exception as e:
            trajectory.append(
                {
                    "type": "error",
                    "step_id": step.get("step_id"),
                    "error": str(e),
                }
            )

    # 3. FINAL ANSWER — LLM składa odpowiedź po polsku
    final_answer = summarize_trajectory(user_query, trajectory, global_plan)

    return {
        "answer": final_answer,
        "trajectory": trajectory,
        "steps_taken": len(steps),
        "global_plan": global_plan,
    }


def summarize_trajectory(user_query: str, trajectory: list, plan: dict) -> str:
    """LLM składa końcową odpowiedź po polsku z pełnej trajektorii."""
    # Skondensuj trajektorię
    traj_summary = json.dumps(trajectory, ensure_ascii=False, default=str)
    if len(traj_summary) > 3000:
        traj_summary = traj_summary[:3000] + "..."

    prompt = f"""Jesteś analitykiem smart money na Solanie. Odpowiadasz PO POLSKU.

Użytkownik zapytał: "{user_query}"

Plan który wykonałeś:
Cel: {plan.get('objective', '')}

Zebrane dane (trajektoria kroków):
{traj_summary}

Na podstawie TYLKO zebranych danych powyżej, napisz czytelną odpowiedź po polsku.

Zasady:
- Używaj konkretnych liczb z danych (PnL, winrate, ceny, market cap)
- Jeśli brakuje danych — powiedz to wprost
- Nie wymyślaj liczb których nie ma w danych
- Używaj emoji dla czytelności
- Strukturyzuj odpowiedź: nagłówek → dane → ocena → wniosek
- Conviction score podaj jeśli był obliczony
- Odpowiedź powinna być przydatna dla tradera, nie techniczna
- Formatuj używając **bold** i `code` dla czytelności"""

    try:
        r = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "max_tokens": 800,
                "temperature": 0.3,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=25,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        # Fallback: return raw data summary
        return f"Analiza zakończona, ale nie udało się wygenerować podsumowania: {str(e)}"


def _sanitize_params(params: dict) -> dict:
    """Remove sensitive data from params for trajectory display."""
    return {k: v for k, v in params.items() if k not in ("api_key",)}


def _truncate_result(result: dict) -> dict:
    """Truncate large lists in results for trajectory display."""
    truncated = {}
    for k, v in result.items():
        if isinstance(v, list) and len(v) > 5:
            truncated[k] = v[:5]
            truncated[f"{k}_count"] = len(v)
            truncated[f"{k}_truncated"] = True
        else:
            truncated[k] = v
    return truncated
