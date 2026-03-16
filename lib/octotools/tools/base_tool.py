from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseTool(ABC):
    tool_name: str = ""
    tool_description: str = ""
    input_types: Dict[str, str] = {}
    output_types: Dict[str, str] = {}
    use_cases: list = []
    limitations: list = []
    best_for: list = []

    @abstractmethod
    def execute(self, **kwargs) -> Dict[str, Any]:
        pass

    def get_card(self) -> Dict:
        return {
            "tool_name": self.tool_name,
            "tool_description": self.tool_description,
            "input_types": self.input_types,
            "output_types": self.output_types,
            "use_cases": self.use_cases,
            "limitations": self.limitations,
            "best_for": self.best_for,
        }
