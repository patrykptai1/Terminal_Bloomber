"use client"

import type { TabId } from "@/types"

const TABS: { id: TabId; label: string; shortcut: string }[] = [
  { id: "analysis", label: "ANALYSIS", shortcut: "F1" },
  { id: "screener", label: "SCREENER", shortcut: "F2" },
  { id: "earnings", label: "EARNINGS", shortcut: "F3" },
  { id: "risk", label: "RISK", shortcut: "F4" },
  { id: "compare", label: "COMPARE", shortcut: "F5" },
  { id: "portfolio", label: "PORTFOLIO", shortcut: "F6" },
  { id: "entry", label: "ENTRY", shortcut: "F7" },
  { id: "analyst", label: "ANALYST", shortcut: "F8" },
  { id: "sectors", label: "SECTORS", shortcut: "F9" },
  { id: "worldnews", label: "WORLD NEWS", shortcut: "F10" },
]

export default function TerminalHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}) {
  return (
    <header className="border-b border-bloomberg-border bg-bloomberg-bg sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-bloomberg-green animate-pulse" />
            <span className="text-bloomberg-green font-bold text-lg tracking-wider">
              BLOOMBERG
            </span>
          </div>
          <span className="text-muted-foreground text-xs">TERMINAL v1.0</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date().toLocaleString("pl-PL", {
            weekday: "short",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      <nav className="flex overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 text-xs tracking-wide border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-bloomberg-amber text-bloomberg-amber bg-bloomberg-card"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-bloomberg-card/50"
            }`}
          >
            <span className="opacity-50 mr-1">{tab.shortcut}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
