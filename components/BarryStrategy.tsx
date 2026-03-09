'use client'

import { useState, useCallback } from 'react'
import {
  Search, CheckCircle2, XCircle, AlertTriangle, Loader2,
  TrendingUp, TrendingDown, Users, Brain, BarChart3, Shield, Target,
} from 'lucide-react'

// ── Types (mirrored from API) ───────────────────────────────────────────

interface Step1Result {
  pass: boolean; volume: number; mcap: number; migrated: boolean
  twitterNameChanged: boolean; verdict: string; tokenName: string; tokenSymbol: string
}
interface Step2Result {
  pass: boolean; freshWalletsPct: number; bundlersPct: number
  insiderPct: number; riskFlags: string[]
}
interface Step3Result {
  pass: boolean; mentions: number; kols: string[]; narrative: string
  isLeader: boolean; competitors: string[]; summary: string
}
interface Step4Result {
  smartWalletCount: number; accumulatingClusters: number
  distributingClusters: number; confirmationStrength: 'strong' | 'weak' | 'none'
}
interface Step5Result {
  entrySignal: boolean; smma33: number; smma144: number
  currentMcap: number; optimalRange: boolean
}
interface Step6Result {
  holdSignal: boolean; exitWarnings: string[]
  clusterStatus: 'accumulating' | 'holding' | 'distributing'
}

interface StepStatus<T> { status: 'ok' | 'error'; data: T | null; error?: string }

interface BarryResponse {
  tokenAddress: string
  step1: StepStatus<Step1Result>
  step2: StepStatus<Step2Result>
  step3: StepStatus<Step3Result>
  step4: StepStatus<Step4Result>
  step5: StepStatus<Step5Result>
  step6: StepStatus<Step6Result>
}

// ── Helpers ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

type BadgeType = 'pass' | 'fail' | 'warn' | 'loading' | 'error'

function StatusBadge({ type }: { type: BadgeType }) {
  switch (type) {
    case 'pass':
      return <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"><CheckCircle2 size={12} /> PASS</span>
    case 'fail':
      return <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={12} /> FAIL</span>
    case 'warn':
      return <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><AlertTriangle size={12} /> UWAGA</span>
    case 'loading':
      return <span className="flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full"><Loader2 size={12} className="animate-spin" /> Analiza...</span>
    case 'error':
      return <span className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><XCircle size={12} /> Błąd</span>
  }
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-gray-800">{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  )
}

function StepCard({
  step, title, icon: Icon, children, badge,
}: {
  step: number; title: string; icon: React.ElementType
  children: React.ReactNode; badge: BadgeType
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Icon size={16} className="text-gray-500" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Krok {step}</div>
            <div className="text-sm font-semibold text-gray-800">{title}</div>
          </div>
        </div>
        <StatusBadge type={badge} />
      </div>
      <div className="border-t border-gray-100 pt-3">
        {children}
      </div>
    </div>
  )
}

// ── Checklist ───────────────────────────────────────────────────────────

interface CheckItem { label: string; pass: boolean | null }

function Checklist({ items }: { items: CheckItem[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Checklist Barry&apos;ego</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            {item.pass === null ? (
              <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
            ) : item.pass ? (
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-400 shrink-0" />
            )}
            <span className={item.pass === null ? 'text-gray-400' : item.pass ? 'text-gray-700' : 'text-gray-500'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Final Verdict ───────────────────────────────────────────────────────

function Verdict({ result }: { result: BarryResponse }) {
  const steps = [result.step1, result.step2, result.step3, result.step4, result.step5, result.step6]
  const okSteps = steps.filter(s => s.status === 'ok' && s.data)

  // Auto-skip conditions
  if (result.step1.data?.twitterNameChanged) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
        <div className="text-2xl mb-1">🔴</div>
        <div className="text-lg font-bold text-red-700">POMINĄĆ</div>
        <div className="text-sm text-red-600 mt-1">Nazwa Twittera się zmieniła — auto-skip</div>
      </div>
    )
  }

  const passCount = okSteps.filter(s => {
    const d = s.data as unknown as Record<string, unknown>
    return d && ('pass' in d ? d.pass : true)
  }).length

  const hasSmmaSignal = result.step5.data?.entrySignal
  const hasStrongSm = result.step4.data?.confirmationStrength === 'strong'

  if (passCount >= 5 && hasSmmaSignal) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
        <div className="text-2xl mb-1">🟢</div>
        <div className="text-lg font-bold text-emerald-700">WCHODZIĆ</div>
        <div className="text-sm text-emerald-600 mt-1">
          Wszystkie kroki zaliczone, SMMA sygnał aktywny
        </div>
      </div>
    )
  }

  if (passCount >= 3 || hasStrongSm) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
        <div className="text-2xl mb-1">🟡</div>
        <div className="text-lg font-bold text-amber-700">OBSERWOWAĆ</div>
        <div className="text-sm text-amber-600 mt-1">
          {passCount}/6 kroków zaliczonych{!hasSmmaSignal ? ' — brak sygnału SMMA' : ''}{!hasStrongSm ? ' — słabe smart money' : ''}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
      <div className="text-2xl mb-1">🔴</div>
      <div className="text-lg font-bold text-red-700">POMINĄĆ</div>
      <div className="text-sm text-red-600 mt-1">
        Tylko {passCount}/6 kroków zaliczonych — za duże ryzyko
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────

export default function BarryStrategy() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BarryResponse | null>(null)
  const [error, setError] = useState('')

  const analyze = useCallback(async () => {
    const trimmed = address.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/barry-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: BarryResponse = await res.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nieznany błąd')
    } finally {
      setLoading(false)
    }
  }, [address])

  // Build checklist items
  const checklistItems: CheckItem[] = result ? [
    { label: 'Volume 24h ≥ $400K', pass: result.step1.data?.volume != null ? result.step1.data.volume >= 400_000 : null },
    { label: 'Market cap ≥ $250K', pass: result.step1.data?.mcap != null ? result.step1.data.mcap >= 250_000 : null },
    { label: 'Po migracji na DEX', pass: result.step1.data?.migrated ?? null },
    { label: 'Nazwa Twittera nie zmieniona', pass: result.step1.data?.twitterNameChanged != null ? !result.step1.data.twitterNameChanged : null },
    { label: 'Fresh wallets < 40%', pass: result.step2.data?.freshWalletsPct != null ? result.step2.data.freshWalletsPct < 40 : null },
    { label: 'Bundled adresy < 15%', pass: result.step2.data?.bundlersPct != null ? result.step2.data.bundlersPct < 15 : null },
    { label: 'Insider holding < 10%', pass: result.step2.data?.insiderPct != null ? result.step2.data.insiderPct < 10 : null },
    { label: 'Wsparcie KOLów / narracja', pass: result.step3.data ? result.step3.data.pass : null },
    { label: 'Smart money potwierdzenie', pass: result.step4.data ? result.step4.data.confirmationStrength !== 'none' : null },
    { label: 'SMMA 33 > SMMA 144', pass: result.step5.data ? result.step5.data.entrySignal : null },
    { label: 'Mcap w strefie optymalnej ($1M-$3M)', pass: result.step5.data ? result.step5.data.optimalRange : null },
    { label: 'Brak sygnałów wyjścia', pass: result.step6.data ? result.step6.data.holdSignal : null },
  ] : []

  function stepBadge(step: StepStatus<unknown> | undefined, passCheck?: (data: unknown) => boolean): BadgeType {
    if (!step) return 'loading'
    if (step.status === 'error') return 'error'
    if (!step.data) return 'error'
    if (passCheck) return passCheck(step.data) ? 'pass' : 'fail'
    const d = step.data as Record<string, unknown>
    if ('pass' in d) return d.pass ? 'pass' : 'fail'
    return 'pass'
  }

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex gap-3">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
            placeholder="Wklej adres tokena (CA)..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          />
          <button
            onClick={analyze}
            disabled={loading || !address.trim()}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? 'Analizuję...' : 'Analizuj'}
          </button>
        </div>
        {result?.step1.data && (
          <div className="mt-3 text-sm text-gray-500">
            Token: <span className="font-semibold text-gray-800">{result.step1.data.tokenName}</span>
            {' '}({result.step1.data.tokenSymbol})
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-sm">Analiza pipeline Barry&apos;ego — to może potrwać ~30s...</span>
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: Steps 1-6 */}
          <div className="lg:col-span-2 space-y-4">
            {/* Step 1 */}
            <StepCard step={1} title="Filtrowanie tokena" icon={Target} badge={stepBadge(result.step1)}>
              {result.step1.status === 'error' ? (
                <p className="text-sm text-red-500">{result.step1.error}</p>
              ) : result.step1.data ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <Metric label="Volume 24h" value={fmt(result.step1.data.volume)} sub={result.step1.data.volume >= 400_000 ? '≥ $400K ✓' : '< $400K ✗'} />
                    <Metric label="Market Cap" value={fmt(result.step1.data.mcap)} sub={result.step1.data.mcap >= 250_000 ? '≥ $250K ✓' : '< $250K ✗'} />
                    <Metric label="Migracja" value={result.step1.data.migrated ? 'Tak' : 'Nie'} />
                  </div>
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">{result.step1.data.verdict}</p>
                </div>
              ) : null}
            </StepCard>

            {/* Step 2 */}
            <StepCard step={2} title="Struktura holderów" icon={Users} badge={stepBadge(result.step2)}>
              {result.step2.status === 'error' ? (
                <p className="text-sm text-red-500">{result.step2.error}</p>
              ) : result.step2.data ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <Metric label="Fresh wallets" value={`${result.step2.data.freshWalletsPct}%`} sub={`próg: < 40%`} />
                    <Metric label="Bundled" value={`${result.step2.data.bundlersPct}%`} sub={`próg: < 15%`} />
                    <Metric label="Insider top 2" value={`${result.step2.data.insiderPct}%`} sub={`próg: < 10%`} />
                  </div>
                  {result.step2.data.riskFlags.length > 0 && (
                    <div className="space-y-1">
                      {result.step2.data.riskFlags.map((flag, i) => (
                        <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle size={10} /> {flag}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </StepCard>

            {/* Step 3 */}
            <StepCard step={3} title="Narracja i KOLe" icon={Brain} badge={stepBadge(result.step3)}>
              {result.step3.status === 'error' ? (
                <p className="text-sm text-red-500">{result.step3.error}</p>
              ) : result.step3.data ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <Metric label="Wzmianki" value={String(result.step3.data.mentions)} />
                    <Metric label="Lider narracji" value={result.step3.data.isLeader ? 'Tak' : 'Nie'} />
                  </div>
                  {result.step3.data.narrative && (
                    <p className="text-xs text-gray-600"><span className="text-gray-400">Narracja:</span> {result.step3.data.narrative}</p>
                  )}
                  {result.step3.data.kols.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.step3.data.kols.map((kol, i) => (
                        <span key={i} className="text-[11px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">{kol}</span>
                      ))}
                    </div>
                  )}
                  {result.step3.data.competitors.length > 0 && (
                    <p className="text-xs text-gray-500">
                      <span className="text-gray-400">Konkurencja:</span> {result.step3.data.competitors.join(', ')}
                    </p>
                  )}
                  {result.step3.data.summary && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">{result.step3.data.summary}</p>
                  )}
                </div>
              ) : null}
            </StepCard>

            {/* Step 4 */}
            <StepCard step={4} title="Smart money potwierdzenie" icon={TrendingUp} badge={stepBadge(result.step4, d => (d as Step4Result).confirmationStrength !== 'none')}>
              {result.step4.status === 'error' ? (
                <p className="text-sm text-red-500">{result.step4.error}</p>
              ) : result.step4.data ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    <Metric label="Smart wallets" value={String(result.step4.data.smartWalletCount)} />
                    <Metric label="Akumulujące" value={String(result.step4.data.accumulatingClusters)} />
                    <Metric label="Dystrybuujące" value={String(result.step4.data.distributingClusters)} />
                  </div>
                  <p className={`text-xs font-medium ${
                    result.step4.data.confirmationStrength === 'strong' ? 'text-emerald-600' :
                    result.step4.data.confirmationStrength === 'weak' ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    Potwierdzenie: {
                      result.step4.data.confirmationStrength === 'strong' ? 'Silne' :
                      result.step4.data.confirmationStrength === 'weak' ? 'Słabe' : 'Brak'
                    }
                  </p>
                </div>
              ) : null}
            </StepCard>

            {/* Step 5 */}
            <StepCard step={5} title="SMMA 33/144 Timing" icon={BarChart3} badge={stepBadge(result.step5, d => (d as Step5Result).entrySignal)}>
              {result.step5.status === 'error' ? (
                <p className="text-sm text-red-500">{result.step5.error}</p>
              ) : result.step5.data ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Metric label="SMMA 33" value={result.step5.data.smma33 > 0 ? result.step5.data.smma33.toExponential(2) : 'N/A'} />
                    <Metric label="SMMA 144" value={result.step5.data.smma144 > 0 ? result.step5.data.smma144.toExponential(2) : 'N/A'} />
                    <Metric label="Mcap" value={fmt(result.step5.data.currentMcap)} />
                    <Metric label="Strefa opt." value={result.step5.data.optimalRange ? '$1M-$3M ✓' : 'Poza zakresem'} />
                  </div>
                  <p className={`text-xs font-medium ${result.step5.data.entrySignal ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {result.step5.data.entrySignal
                      ? 'Sygnał wejścia aktywny — SMMA33 > SMMA144'
                      : result.step5.data.smma33 === 0
                        ? 'Za mało danych (potrzeba 144+ świec 1min)'
                        : 'Brak sygnału — SMMA33 ≤ SMMA144'}
                  </p>
                </div>
              ) : null}
            </StepCard>

            {/* Step 6 */}
            <StepCard step={6} title="Strategia wyjścia" icon={Shield} badge={stepBadge(result.step6, d => (d as Step6Result).holdSignal)}>
              {result.step6.status === 'error' ? (
                <p className="text-sm text-red-500">{result.step6.error}</p>
              ) : result.step6.data ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Metric label="Status klastrów" value={
                      result.step6.data.clusterStatus === 'accumulating' ? 'Akumulacja' :
                      result.step6.data.clusterStatus === 'distributing' ? 'Dystrybucja' : 'Trzymanie'
                    } />
                    <div className="ml-auto">
                      {result.step6.data.holdSignal ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <TrendingUp size={14} /> Trzymaj
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <TrendingDown size={14} /> Ostrożnie
                        </span>
                      )}
                    </div>
                  </div>
                  {result.step6.data.exitWarnings.length > 0 && (
                    <div className="space-y-1">
                      {result.step6.data.exitWarnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle size={10} /> {w}
                        </p>
                      ))}
                    </div>
                  )}
                  {result.step6.data.exitWarnings.length === 0 && (
                    <p className="text-xs text-gray-400">Brak sygnałów ostrzegawczych</p>
                  )}
                </div>
              ) : null}
            </StepCard>
          </div>

          {/* Right column: Checklist + Verdict */}
          <div className="space-y-4">
            <Checklist items={checklistItems} />
            <Verdict result={result} />
          </div>
        </div>
      )}
    </div>
  )
}
