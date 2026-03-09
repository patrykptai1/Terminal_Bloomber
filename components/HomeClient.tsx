'use client'

import { useState, useCallback } from 'react'
import { LayoutDashboard, Wallet, ScanLine, BarChart2, Activity, Crosshair } from 'lucide-react'
import TokenAnalyzer from '@/components/TokenAnalyzer'
import WalletInspector from '@/components/WalletInspector'
import MyWallets from '@/components/MyWallets'
import MarketScanner from '@/components/MarketScanner'
import WalletActivityDashboard from '@/components/WalletActivityDashboard'
import BarryStrategy from '@/components/BarryStrategy'

const NAV_ITEMS = [
  { tab: 'dashboard',  label: 'Wallet Radar',           Icon: LayoutDashboard },
  { tab: 'tracking',   label: 'Insider Analyzer',        Icon: Activity        },
  { tab: 'mywallets',  label: 'My Wallets',             Icon: Wallet          },
  { tab: 'wallet',     label: 'Wallet Scanner',         Icon: ScanLine        },
  { tab: 'scanner',    label: 'Market',                 Icon: BarChart2       },
  { tab: 'barry',      label: 'Barry Strategy',         Icon: Crosshair       },
]

export default function HomeClient() {
  const [activeTab, setActiveTab] = useState('dashboard')

  // Called from MarketScanner — switches to analyzer tab
  const handleAnalyzeToken = useCallback((address: string) => {
    void address
    setActiveTab('tracking')
  }, [])

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">

      {/* ── Left Sidebar (desktop) ── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-[220px] bg-white border-r border-gray-200 z-40">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-200 shrink-0">
          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          <span className="text-gray-900 font-bold text-sm tracking-widest">SMD</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ tab, label, Icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all duration-150 text-left border-l-2 ${
                activeTab === tab
                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Version */}
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          <span className="text-[10px] text-gray-400">v0.2</span>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-[220px]">
        {/* Decorative top gradient */}
        <div className="pointer-events-none fixed top-0 left-0 md:left-[220px] right-0 h-48 bg-gradient-to-b from-gray-100/50 to-transparent z-10" />

        <div className="relative max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-10">

          {/* All tabs rendered but only active one visible — preserves state when switching */}

          <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
            <WalletActivityDashboard />
          </div>

          <div className={activeTab === 'tracking' ? '' : 'hidden'}>
            <div className="space-y-6">
              <div className="space-y-0.5">
                <h1 className="text-xl font-bold text-gray-900">Insider Wallet Analyzer</h1>
                <p className="text-gray-500 text-xs">
                  Znajdź wallety które kupowały wiele tokenów przy niskim mcap · GMGN + DexScreener
                </p>
              </div>
              <TokenAnalyzer />
            </div>
          </div>

          <div className={activeTab === 'mywallets' ? '' : 'hidden'}>
            <div className="space-y-0.5 mb-6">
              <h1 className="text-xl font-bold text-gray-900">My Wallets</h1>
              <p className="text-gray-500 text-xs">Zarządzaj listą smart money walletów i skanuj aktywność</p>
            </div>
            <MyWallets />
          </div>

          <div className={activeTab === 'wallet' ? '' : 'hidden'}>
            <div className="space-y-0.5 mb-6">
              <h1 className="text-xl font-bold text-gray-900">Wallet Scanner</h1>
              <p className="text-gray-500 text-xs">Analizuj portfele i historię transakcji</p>
            </div>
            <WalletInspector />
          </div>

          <div className={activeTab === 'scanner' ? '' : 'hidden'}>
            <div className="space-y-0.5 mb-6">
              <h1 className="text-xl font-bold text-gray-900">Market</h1>
              <p className="text-gray-500 text-xs">Przeglądaj tokeny według wolumenu i aktywności</p>
            </div>
            <MarketScanner onAnalyzeToken={handleAnalyzeToken} />
          </div>

          <div className={activeTab === 'barry' ? '' : 'hidden'}>
            <div className="space-y-0.5 mb-6">
              <h1 className="text-xl font-bold text-gray-900">Barry Strategy</h1>
              <p className="text-gray-500 text-xs">6-krokowy pipeline analizy tokena wg strategii 0xBarrry</p>
            </div>
            <BarryStrategy />
          </div>

        </div>
      </main>

      {/* ── Bottom Tab Bar (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-40">
        <div className="flex">
          {NAV_ITEMS.map(({ tab, Icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center py-3.5 transition-colors ${
                activeTab === tab ? 'text-orange-500' : 'text-gray-400'
              }`}
            >
              <Icon size={20} />
            </button>
          ))}
        </div>
      </nav>

    </div>
  )
}
