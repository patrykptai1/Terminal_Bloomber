from .tools.helius_tool import Helius_Wallet_Tool
from .tools.gmgn_tool import GMGN_SmartMoney_Tool
from .tools.dexscreener_tool import DexScreener_Token_Tool
from .tools.conviction_tool import Conviction_Scorer_Tool

TOOL_REGISTRY = {
    "Helius_Wallet_Tool": Helius_Wallet_Tool(),
    "GMGN_SmartMoney_Tool": GMGN_SmartMoney_Tool(),
    "DexScreener_Token_Tool": DexScreener_Token_Tool(),
    "Conviction_Scorer_Tool": Conviction_Scorer_Tool(),
}


def execute_tool(tool_name: str, params: dict) -> dict:
    """Wywołuje narzędzie i zwraca wynik."""
    tool = TOOL_REGISTRY.get(tool_name)
    if not tool:
        return {"error": f"Narzędzie {tool_name} nie istnieje"}
    try:
        result = tool.execute(**params)
        return result
    except Exception as e:
        return {"error": f"Błąd wykonania {tool_name}: {str(e)}"}
