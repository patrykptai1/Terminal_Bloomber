import requests
from .base_tool import BaseTool


class DexScreener_Token_Tool(BaseTool):
    tool_name = "DexScreener_Token_Tool"
    tool_description = "Pobiera dane rynkowe tokena z DexScreener: cena, market cap, volume, liquidity, age, top holders."
    input_types = {
        "token_address": "str — adres mint tokena Solana",
        "mode": "str — 'token_info' | 'trending' | 'search'",
    }
    output_types = {
        "price_usd": "float",
        "market_cap": "float",
        "volume_24h": "float",
        "liquidity": "float",
        "price_change_24h": "float",
        "symbol": "str",
        "name": "str",
        "dex": "str",
        "pair_address": "str",
        "created_at": "str",
        "trending": "list",
        "error": "str",
    }
    use_cases = [
        "Sprawdzenie ceny i market cap tokena",
        "Ocena liquidity i volume",
        "Trending tokeny na Solanie",
        "Wiek tokena (kiedy był stworzony)",
    ]
    limitations = ["Dane opóźnione o ~30 sekund", "Nie pokazuje historii PnL"]
    best_for = ["Szybka weryfikacja tokenów", "Screening nowych gemów"]

    def execute(self, token_address: str = "", mode: str = "token_info") -> dict:
        try:
            if mode == "token_info" and token_address:
                url = f"https://api.dexscreener.com/tokens/v1/solana/{token_address}"
                r = requests.get(url, timeout=10)
                data = r.json()
                pairs = data if isinstance(data, list) else data.get("pairs", [])
                if not pairs:
                    return {"error": "Brak danych dla tego tokena"}
                p = pairs[0]
                return {
                    "symbol": p.get("baseToken", {}).get("symbol", ""),
                    "name": p.get("baseToken", {}).get("name", ""),
                    "price_usd": float(p.get("priceUsd") or 0),
                    "market_cap": p.get("marketCap", 0),
                    "fdv": p.get("fdv", 0),
                    "volume_24h": (p.get("volume") or {}).get("h24", 0),
                    "volume_1h": (p.get("volume") or {}).get("h1", 0),
                    "liquidity": (p.get("liquidity") or {}).get("usd", 0),
                    "price_change_24h": (p.get("priceChange") or {}).get("h24", 0),
                    "price_change_1h": (p.get("priceChange") or {}).get("h1", 0),
                    "dex": p.get("dexId", ""),
                    "pair_address": p.get("pairAddress", ""),
                    "created_at": p.get("pairCreatedAt", ""),
                    "buys_24h": (p.get("txns") or {}).get("h24", {}).get("buys", 0),
                    "sells_24h": (p.get("txns") or {}).get("h24", {}).get("sells", 0),
                    "dex_url": p.get("url", ""),
                }

            elif mode == "trending":
                url = "https://api.dexscreener.com/token-boosts/top/v1"
                r = requests.get(url, timeout=10)
                data = r.json()
                items = data[:20] if isinstance(data, list) else []
                return {"trending": items}

            return {"error": "Nieprawidłowy tryb lub brak parametrów"}
        except Exception as e:
            return {"error": str(e)}
