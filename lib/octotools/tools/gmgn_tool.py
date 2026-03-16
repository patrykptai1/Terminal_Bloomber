import json
import asyncio
import subprocess
from .base_tool import BaseTool

GMGN_CURL_FLAGS = [
    "curl",
    "--silent",
    "--compressed",
    "--tlsv1.3",
    "--max-time", "15",
    "-H", "accept: application/json, text/plain, */*",
    "-H", "accept-encoding: gzip, deflate, br",
    "-H", "accept-language: en-US,en;q=0.9",
    "-H", "referer: https://gmgn.ai/",
    "-H", "user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
]


def _gmgn_get(url: str) -> dict:
    """Execute curl request to GMGN and parse JSON (TLS bypass)."""
    try:
        result = subprocess.run(
            GMGN_CURL_FLAGS + [url],
            capture_output=True,
            text=True,
            timeout=20,
        )
        text = result.stdout.strip()
        if not text or text.startswith("<"):
            return {}
        return json.loads(text)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
        return {}


def _extract_list(resp: dict) -> list:
    """Extract list from GMGN nested response."""
    if not resp:
        return []
    inner = resp.get("data", {})
    if isinstance(inner, list):
        return inner
    if isinstance(inner, dict):
        return inner.get("list", inner.get("history", inner.get("rank", [])))
    return []


class GMGN_SmartMoney_Tool(BaseTool):
    tool_name = "GMGN_SmartMoney_Tool"
    tool_description = "Pobiera dane smart money z GMGN: etykiety KOL, PnL 30d, winrate, top traderów tokena, trending."
    input_types = {
        "wallet_address": "str — adres portfela Solana (opcjonalnie)",
        "token_address": "str — adres tokena Solana (opcjonalnie)",
        "mode": "str — 'wallet_info' | 'token_traders' | 'trending' | 'new_pairs'",
    }
    output_types = {
        "label": "str — etykieta KOL (jeśli istnieje)",
        "pnl_30d": "float — PnL 30 dni w USD",
        "winrate": "float — winrate w %",
        "traders": "list — lista top traderów dla tokena",
        "trending": "list — trending tokeny",
        "error": "str",
    }
    use_cases = [
        "Sprawdzenie czy wallet jest KOL/smart money",
        "Znalezienie top traderów dla danego tokena",
        "Trending tokeny na Solanie",
        "Early buy detection — kto kupił token jako pierwszy",
    ]
    limitations = [
        "Wymaga curl z TLS fingerprint bypass (nie działa z requests)",
        "Rate limiting przy zbyt wielu requestach",
    ]
    best_for = ["Identyfikacja smart money walletów", "Wykrywanie early buyers"]

    def execute(
        self,
        wallet_address: str = "",
        token_address: str = "",
        mode: str = "wallet_info",
    ) -> dict:
        base = "https://gmgn.ai"
        try:
            if mode == "wallet_info" and wallet_address:
                url = f"{base}/defi/quotation/v1/smartmoney/sol/walletNew/{wallet_address}?period=30d"
                data = _gmgn_get(url).get("data", {})
                if not data:
                    return {"error": "Brak danych GMGN dla tego walleta"}
                return {
                    "label": data.get("tags", []),
                    "pnl_30d": data.get("realized_profit_30d", 0),
                    "winrate": data.get("winrate", 0),
                    "buy_30d": data.get("buy_30d", 0),
                    "sell_30d": data.get("sell_30d", 0),
                }

            elif mode == "token_traders" and token_address:
                url = f"{base}/vas/api/v1/token_traders/sol/{token_address}?orderby=realized_profit&direction=desc&limit=20"
                traders = _extract_list(_gmgn_get(url))
                return {"traders": traders[:20]}

            elif mode == "trending":
                url = f"{base}/defi/quotation/v1/rank/sol/swaps/24h?limit=20&offset=0&orderby=price_change_percent&direction=desc"
                rank = _gmgn_get(url).get("data", {}).get("rank", [])
                return {"trending": rank[:20]}

            elif mode == "new_pairs":
                url = f"{base}/defi/quotation/v1/pairs/sol/new_pairs?limit=20&orderby=open_timestamp&direction=desc"
                pairs = _gmgn_get(url).get("data", {}).get("pairs", [])
                return {"new_pairs": pairs[:20]}

            return {"error": "Nieprawidłowy tryb lub brak parametrów"}
        except Exception as e:
            return {"error": str(e)}
