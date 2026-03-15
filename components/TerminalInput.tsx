"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Loader2 } from "lucide-react"

interface TerminalInputProps {
  placeholder: string
  onSubmit: (value: string) => void
  loading?: boolean
  label?: string
}

export default function TerminalInput({ placeholder, onSubmit, loading, label }: TerminalInputProps) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !loading) {
      onSubmit(value.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      {label && <span className="text-bloomberg-amber text-xs shrink-0">{label}</span>}
      <div className="flex-1 flex items-center gap-2 bg-bloomberg-card border border-bloomberg-border rounded px-3 py-2">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {loading && <Loader2 className="w-4 h-4 text-bloomberg-amber animate-spin shrink-0" />}
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="px-4 py-2 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded text-xs font-bold hover:bg-bloomberg-green/30 disabled:opacity-40 transition-colors"
      >
        {loading ? "PROCESSING..." : "GO"}
      </button>
    </form>
  )
}

interface TerminalTextAreaProps {
  placeholder: string
  onSubmit: (value: string) => void
  loading?: boolean
  label?: string
  buttonLabel?: string
}

export function TerminalTextArea({ placeholder, onSubmit, loading, label, buttonLabel }: TerminalTextAreaProps) {
  const [value, setValue] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !loading) {
      onSubmit(value.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {label && <span className="text-bloomberg-amber text-xs">{label}</span>}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={loading}
        rows={6}
        className="w-full bg-bloomberg-card border border-bloomberg-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-bloomberg-green/50 resize-y"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="px-4 py-2 bg-bloomberg-green/20 text-bloomberg-green border border-bloomberg-green/30 rounded text-xs font-bold hover:bg-bloomberg-green/30 disabled:opacity-40 transition-colors"
      >
        {loading ? "PROCESSING..." : buttonLabel ?? "ANALYZE"}
      </button>
    </form>
  )
}
