from .base_tool import BaseTool


class Conviction_Scorer_Tool(BaseTool):
    tool_name = "Conviction_Scorer_Tool"
    tool_description = "Oblicza conviction score smart money walleta dla danego tokena na podstawie zebranych danych."
    input_types = {
        "wallet_pnl_30d": "float — PnL 30 dni w USD",
        "winrate": "float — winrate w %",
        "token_volume_24h": "float — volume tokena 24h",
        "token_liquidity": "float — liquidity tokena w USD",
        "is_early_buyer": "bool — czy wallet był w top 10 early buyers",
        "buy_count_30d": "int — liczba transakcji buy 30 dni",
    }
    output_types = {
        "conviction_score": "int — wynik 0-100",
        "conviction_label": "str — LOW/MEDIUM/HIGH/VERY HIGH",
        "reasoning": "str — uzasadnienie wyniku po polsku",
    }
    use_cases = [
        "Ocena wiarygodności pozycji smart money",
        "Ranking walletów według conviction",
        "Filtrowanie sygnałów high-conviction",
    ]
    limitations = ["Heurystyczny — nie jest modelem ML"]
    best_for = ["Priorytetyzacja sygnałów do śledzenia"]

    def execute(
        self,
        wallet_pnl_30d: float = 0,
        winrate: float = 0,
        token_volume_24h: float = 0,
        token_liquidity: float = 0,
        is_early_buyer: bool = False,
        buy_count_30d: int = 0,
    ) -> dict:
        score = 0
        reasons = []

        # PnL score (max 30 pkt)
        if wallet_pnl_30d > 100000:
            score += 30
            reasons.append("Bardzo wysokie PnL 30d (>100k USD)")
        elif wallet_pnl_30d > 50000:
            score += 20
            reasons.append("Wysokie PnL 30d (>50k USD)")
        elif wallet_pnl_30d > 10000:
            score += 10
            reasons.append("Dobre PnL 30d (>10k USD)")

        # Winrate (max 25 pkt)
        if winrate > 70:
            score += 25
            reasons.append(f"Bardzo wysoki winrate ({winrate:.0f}%)")
        elif winrate > 55:
            score += 15
            reasons.append(f"Dobry winrate ({winrate:.0f}%)")
        elif winrate > 40:
            score += 5
            reasons.append(f"Przeciętny winrate ({winrate:.0f}%)")

        # Early buyer bonus (20 pkt)
        if is_early_buyer:
            score += 20
            reasons.append("Early buyer — kupił w top 10 pierwszych transakcji")

        # Liquidity safety (max 15 pkt)
        if token_liquidity > 500000:
            score += 15
            reasons.append("Wysoka liquidity (>500k USD) — bezpieczny token")
        elif token_liquidity > 100000:
            score += 8
            reasons.append("Dobra liquidity (>100k USD)")
        elif token_liquidity < 10000:
            score -= 10
            reasons.append("Bardzo niska liquidity — ryzyko rug pull")

        # Activity (max 10 pkt)
        if buy_count_30d > 100:
            score += 10
            reasons.append(f"Bardzo aktywny trader ({buy_count_30d} buy/30d)")
        elif buy_count_30d > 30:
            score += 5
            reasons.append(f"Aktywny trader ({buy_count_30d} buy/30d)")

        score = max(0, min(100, score))

        if score >= 75:
            label = "VERY HIGH"
        elif score >= 55:
            label = "HIGH"
        elif score >= 35:
            label = "MEDIUM"
        else:
            label = "LOW"

        return {
            "conviction_score": score,
            "conviction_label": label,
            "reasoning": " | ".join(reasons) if reasons else "Brak wystarczających danych",
        }
