#!/usr/bin/env python3
"""CLI wrapper: reads query from argv, runs agent, prints JSON to stdout."""
import sys
import json
import os

# Ensure project root is in path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
os.chdir(project_root)

from lib.octotools.agent import run_agent

if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    if not query:
        print(json.dumps({"error": "Brak zapytania"}))
        sys.exit(1)

    result = run_agent(query)
    print(json.dumps(result, ensure_ascii=False, default=str))
