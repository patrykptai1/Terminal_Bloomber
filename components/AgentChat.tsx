'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent, ReactNode } from 'react'
import { Bot, Send, Trash2, RotateCw } from 'lucide-react'
import PlanStepsDisplay from './PlanStepsDisplay'

// ── Types ──────────────────────────────────────────────────────────────

interface PlanStep {
  step_id: number
  sub_goal: string
  tool: string
  reason?: string
}

interface Plan {
  objective?: string
  steps?: PlanStep[]
  expected_output?: string
}

interface TrajectoryItem {
  type: string
  step_id?: number
  tool?: string
  error?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  status?: 'loading' | 'done' | 'error'
  plan?: Plan | null
  trajectory?: TrajectoryItem[]
  stepsTaken?: number
  requiresTwitterConfirm?: boolean
  twitterMint?: string
  twitterSymbol?: string
}

// ── Helpers ────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'teraz'
  if (diff < 3600) return `${Math.floor(diff / 60)} min temu`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h temu`
  return `${Math.floor(diff / 86400)}d temu`
}

function renderMarkdown(text: string) {
  // **bold** → <strong>
  // `code` → <code>
  // \n → <br>
  const parts: (string | ReactNode)[] = []
  const lines = text.split('\n')

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) parts.push(<br key={`br-${lineIdx}`} />)

    // Process inline formatting
    const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index))
      }

      if (match[2]) {
        // **bold**
        parts.push(
          <strong key={`b-${lineIdx}-${match.index}`} className="font-semibold">
            {match[2]}
          </strong>
        )
      } else if (match[3]) {
        // `code`
        parts.push(
          <code
            key={`c-${lineIdx}-${match.index}`}
            className="bg-gray-100 text-orange-600 px-1 py-0.5 rounded text-xs font-mono"
          >
            {match[3]}
          </code>
        )
      }

      lastIndex = match.index + match[0].length
    }

    // Remaining text
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex))
    }
  })

  return parts
}

// ── Loading status messages ────────────────────────────────────────────

const LOADING_STEPS = [
  { text: 'Pobieram dane z GMGN...', icon: '📡', delay: 0 },
  { text: 'Pobieram dane z DexScreener...', icon: '📡', delay: 1500 },
  { text: 'Analizuję historię cen...', icon: '📊', delay: 5000 },
  { text: 'Weryfikuję dane...', icon: '🔍', delay: 10000 },
  { text: 'Składam odpowiedź...', icon: '⚙', delay: 20000 },
]

// ── Component ──────────────────────────────────────────────────────────

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [activePlan, setActivePlan] = useState<Plan | null>(null)
  const [activeTrajectory, setActiveTrajectory] = useState<TrajectoryItem[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastUserMsgRef = useRef('')

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingStep])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // Loading step animation
  useEffect(() => {
    if (!loading) return
    setLoadingStep(0)

    const timers = LOADING_STEPS.slice(1).map((step, idx) =>
      setTimeout(() => setLoadingStep(idx + 1), step.delay)
    )

    return () => timers.forEach(clearTimeout)
  }, [loading])

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim()
      if (!msg || loading) return

      lastUserMsgRef.current = msg
      setInput('')

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: msg,
        timestamp: Date.now(),
        status: 'done',
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'loading',
      }

      setMessages(prev => [...prev, userMsg, assistantMsg])
      setLoading(true)
      setActivePlan(null)
      setActiveTrajectory([])

      try {
        const res = await fetch('/api/agent-octo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage: msg }),
        })

        const data = await res.json()

        if (data.error) {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? { ...m, content: data.error, status: 'error' as const }
                : m
            )
          )
        } else {
          const plan = data.plan ?? null
          const trajectory = data.trajectory ?? []
          setActivePlan(plan)
          setActiveTrajectory(trajectory)
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content: data.message ?? '',
                    status: 'done' as const,
                    plan,
                    trajectory,
                    stepsTaken: data.steps_taken ?? 0,
                  }
                : m
            )
          )
        }
      } catch {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: 'Błąd połączenia z serwerem.', status: 'error' as const }
              : m
          )
        )
      } finally {
        setLoading(false)
      }
    },
    [input, loading, messages]
  )

  const handleTwitterConfirm = useCallback(
    async (msgId: string, mint: string, symbol: string, confirm: boolean) => {
      // Remove confirm buttons
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId ? { ...m, requiresTwitterConfirm: false } : m
        )
      )

      if (!confirm) {
        setMessages(prev =>
          prev.map(m =>
            m.id === msgId
              ? { ...m, content: 'Pominięto analizę Twittera.' }
              : m
          )
        )
        return
      }

      // Add loading message
      const loadingMsg: Message = {
        id: `a-tw-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'loading',
      }
      setMessages(prev => [...prev, loadingMsg])
      setLoading(true)

      try {
        const conversationHistory = messages
          .filter(m => m.status === 'done')
          .map(m => ({ role: m.role, content: m.content }))

        const res = await fetch('/api/agent-octo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: `Analiza Twittera dla ${symbol} (${mint})`,
          }),
        })

        const data = await res.json()

        setMessages(prev =>
          prev.map(m =>
            m.id === loadingMsg.id
              ? {
                  ...m,
                  content: data.message ?? data.error ?? 'Brak danych',
                  status: data.error ? ('error' as const) : ('done' as const),
                  plan: data.plan ?? null,
                  trajectory: data.trajectory ?? [],
                }
              : m
          )
        )
      } catch {
        setMessages(prev =>
          prev.map(m =>
            m.id === loadingMsg.id
              ? { ...m, content: 'Błąd połączenia.', status: 'error' as const }
              : m
          )
        )
      } finally {
        setLoading(false)
      }
    },
    [messages]
  )

  const retry = useCallback(() => {
    if (lastUserMsgRef.current) {
      // Remove last assistant message (error)
      setMessages(prev => prev.slice(0, -1))
      sendMessage(lastUserMsgRef.current)
    }
  }, [sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
  }

  const insertChip = (text: string) => {
    setInput(text)
    textareaRef.current?.focus()
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)]">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">Agent Krypto AI</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Online
          </span>
        </div>
        <button
          onClick={clearChat}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Wyczyść czat"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/50">
        {isEmpty ? (
          /* Welcome screen */
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
              <Bot size={32} className="text-white" />
            </div>
            <div className="space-y-2 max-w-md">
              <h2 className="text-lg font-bold text-gray-900">
                Witaj! Jestem Twoim agentem krypto.
              </h2>
              <p className="text-sm text-gray-500">
                Pobieram dane na żywo z GMGN i DexScreener. Zapytaj mnie o dowolny token, wallet lub trendy rynkowe.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {[
                { icon: '🔍', text: 'Przeanalizuj token [wklej adres]' },
                { icon: '👛', text: 'Sprawdź wallet [wklej adres]' },
                { icon: '📈', text: 'Jakie tokeny są teraz trending?' },
              ].map(chip => (
                <button
                  key={chip.text}
                  onClick={() => insertChip(chip.text)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors shadow-sm"
                >
                  <span>{chip.icon}</span>
                  <span>{chip.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] ${
                  msg.role === 'user' ? '' : 'flex gap-2'
                }`}
              >
                {/* Assistant avatar */}
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={14} className="text-white" />
                  </div>
                )}

                <div>
                  {/* Plan steps (above bubble for assistant messages) */}
                  {msg.role === 'assistant' && msg.plan?.steps?.length ? (
                    <div className="mb-2">
                      <PlanStepsDisplay
                        plan={msg.plan}
                        trajectory={msg.trajectory ?? []}
                        loading={msg.status === 'loading'}
                      />
                    </div>
                  ) : null}

                  {/* Active plan during loading */}
                  {msg.role === 'assistant' && msg.status === 'loading' && activePlan?.steps?.length ? (
                    <div className="mb-2">
                      <PlanStepsDisplay
                        plan={activePlan}
                        trajectory={activeTrajectory}
                        loading={true}
                      />
                    </div>
                  ) : null}

                  {/* Bubble */}
                  <div
                    className={`px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-orange-50 border border-orange-200 rounded-2xl rounded-tr-sm text-gray-800'
                        : 'bg-white border border-gray-200 rounded-2xl rounded-tl-sm text-gray-800'
                    }`}
                  >
                    {msg.status === 'loading' ? (
                      <div className="flex items-center gap-2 animate-pulse text-gray-500">
                        <span>{LOADING_STEPS[loadingStep]?.icon ?? '⚙'}</span>
                        <span>{LOADING_STEPS[loadingStep]?.text ?? 'Przetwarzam...'}</span>
                      </div>
                    ) : msg.status === 'error' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-red-600">
                          <span>⚠</span>
                          <span>{msg.content}</span>
                        </div>
                        <button
                          onClick={retry}
                          className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
                        >
                          <RotateCw size={12} />
                          Spróbuj ponownie
                        </button>
                      </div>
                    ) : (
                      <>{renderMarkdown(msg.content)}</>
                    )}

                    {/* Twitter confirmation buttons */}
                    {msg.requiresTwitterConfirm && (
                      <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                        <button
                          onClick={() =>
                            handleTwitterConfirm(
                              msg.id,
                              msg.twitterMint!,
                              msg.twitterSymbol!,
                              true
                            )
                          }
                          disabled={loading}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          ✓ Tak, analizuj Twitter
                        </button>
                        <button
                          onClick={() =>
                            handleTwitterConfirm(
                              msg.id,
                              msg.twitterMint!,
                              msg.twitterSymbol!,
                              false
                            )
                          }
                          disabled={loading}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          ✗ Nie, pomiń
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  {msg.status !== 'loading' && (
                    <span
                      className={`text-[10px] text-gray-400 mt-1 block ${
                        msg.role === 'user' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {timeAgo(msg.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-white rounded-b-xl">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Zapytaj o token, wallet, trendy rynkowe..."
            disabled={loading}
            rows={1}
            className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400 disabled:opacity-50 max-h-[120px]"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
