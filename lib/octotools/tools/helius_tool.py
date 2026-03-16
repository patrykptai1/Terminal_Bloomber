import os
import requests
from .base_tool import BaseTool


class Helius_Wallet_Tool(BaseTool):
    tool_name = "Helius_Wallet_Tool"
    tool_description = "Pobiera historię transakcji portfela Solana i aktualne holdings przez Helius API."
    input_types = {
        "wallet_address": "str — adres portfela Solana (base58)",
        "limit": "int — liczba transakcji (domyślnie 50)",
    }
    output_types = {
        "transactions": "list — lista transakcji z tokenAmount, type, timestamp",
        "token_holdings": "list — aktualne tokeny w portfelu",
        "error": "str — komunikat błędu jeśli wystąpił",
    }
    use_cases = [
        "Analiza historii tradingowej portfela",
        "Sprawdzenie aktualnych holdings",
        "Wykrycie wzorców buy/sell",
        "Identyfikacja kiedy wallet kupił token",
    ]
    limitations = ["Ograniczony do Solana mainnet", "Rate limit: 10 req/s na free tier"]
    best_for = ["Szczegółowa analiza konkretnego walleta"]

    def execute(self, wallet_address: str, limit: int = 50) -> dict:
        api_key = os.getenv("HELIUS_API_KEY")
        if not api_key:
            return {"transactions": [], "token_holdings": [], "error": "Brak HELIUS_API_KEY"}

        try:
            # Transakcje
            url_tx = f"https://api.helius.xyz/v0/addresses/{wallet_address}/transactions"
            r_tx = requests.get(
                url_tx,
                params={"api-key": api_key, "limit": limit},
                timeout=10,
            )
            transactions = r_tx.json() if r_tx.status_code == 200 else []

            # Token accounts
            url_rpc = f"https://mainnet.helius-rpc.com/?api-key={api_key}"
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getTokenAccountsByOwner",
                "params": [
                    wallet_address,
                    {"programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
                    {"encoding": "jsonParsed"},
                ],
            }
            r_holdings = requests.post(url_rpc, json=payload, timeout=10)
            holdings_raw = r_holdings.json().get("result", {}).get("value", [])
            token_holdings = [
                {
                    "mint": h["account"]["data"]["parsed"]["info"]["mint"],
                    "amount": h["account"]["data"]["parsed"]["info"]["tokenAmount"][
                        "uiAmount"
                    ],
                }
                for h in holdings_raw
                if h["account"]["data"]["parsed"]["info"]["tokenAmount"]["uiAmount"] > 0
            ]

            return {
                "transactions": transactions[:limit],
                "token_holdings": token_holdings,
            }
        except Exception as e:
            return {"transactions": [], "token_holdings": [], "error": str(e)}
