"use client"

import { useState, useEffect, useCallback } from "react"
import TerminalHeader from "@/components/TerminalHeader"
import StockAnalysis from "@/components/modules/StockAnalysis"
import StockScreener from "@/components/modules/StockScreener"
import EarningsReport from "@/components/modules/EarningsReport"
import RiskAssessment from "@/components/modules/RiskAssessment"
import StockCompare from "@/components/modules/StockCompare"
import PortfolioBuilder from "@/components/modules/PortfolioBuilder"
import EntryTiming from "@/components/modules/EntryTiming"
import AnalystRecommendations from "@/components/modules/AnalystRecommendations"
import SectorScreener from "@/components/modules/SectorScreener"
import WorldNewsRadar from "@/components/modules/WorldNewsRadar"
import SankeyModule from "@/components/modules/SankeyModule"
import type { TabId } from "@/types"

const TAB_TITLES: Record<TabId, string> = {
  analysis: "FULL STOCK ANALYSIS",
  screener: "STOCK SCREENER",
  earnings: "EARNINGS REPORT",
  risk: "RISK ASSESSMENT",
  compare: "HEAD-TO-HEAD COMPARE",
  portfolio: "PORTFOLIO BUILDER",
  entry: "ENTRY TIMING",
  analyst: "ANALYST RECOMMENDATIONS",
  sectors: "SECTORS",
  worldnews: "WORLD NEWS RADAR",
  sankey: "SANKEY CHART",
}

const TAB_KEYS: TabId[] = ["analysis", "screener", "earnings", "risk", "compare", "portfolio", "entry", "analyst", "sectors", "worldnews", "sankey"]

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("analysis")

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const fKey = e.key.match(/^F(\d+)$/)
    if (fKey) {
      const idx = parseInt(fKey[1]) - 1
      if (idx >= 0 && idx < TAB_KEYS.length) {
        e.preventDefault()
        setActiveTab(TAB_KEYS[idx])
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="min-h-screen flex flex-col">
      <TerminalHeader activeTab={activeTab} onTabChange={setActiveTab} />
      <main className={`flex-1 p-4 w-full mx-auto ${activeTab === "sankey" ? "max-w-7xl" : "max-w-5xl"}`}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-bloomberg-green rounded-full" />
          <h1 className="text-sm text-bloomberg-amber font-bold tracking-wider">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>

        {activeTab === "analysis" && <StockAnalysis />}
        {activeTab === "screener" && <StockScreener />}
        {activeTab === "earnings" && <EarningsReport />}
        {activeTab === "risk" && <RiskAssessment />}
        {activeTab === "compare" && <StockCompare />}
        {activeTab === "portfolio" && <PortfolioBuilder />}
        {activeTab === "entry" && <EntryTiming />}
        {activeTab === "analyst" && <AnalystRecommendations />}
        {activeTab === "sectors" && <SectorScreener />}
        {activeTab === "worldnews" && <WorldNewsRadar />}
        {activeTab === "sankey" && <SankeyModule />}
      </main>

      <footer className="border-t border-bloomberg-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>TERMINAL BLOOMBERG v1.0</span>
        <span>US + GPW | AI-Powered Analysis</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-bloomberg-green rounded-full animate-pulse" />
          CONNECTED
        </span>
      </footer>
    </div>
  )
}
