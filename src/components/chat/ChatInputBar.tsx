import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Send } from 'lucide-react'
import { detectSecrets } from './SecretScanner'

export type ChatInputHandle = {
  clear: () => void
  focus: () => void
}

type ChatInputBarProps = {
  isStreaming: boolean
  onSend: (text: string) => void
  onSecretWarning: (findings: string[], pendingText: string) => void
}

export const ChatInputBar = forwardRef<ChatInputHandle, ChatInputBarProps>(function ChatInputBar(
  { isStreaming, onSend, onSecretWarning },
  ref,
) {
  const [input, setInput] = useState('')
  const pendingFindingsRef = useRef<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const secretDebounceRef = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    clear: () => {
      setInput('')
      pendingFindingsRef.current = []
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    },
    focus: () => textareaRef.current?.focus(),
  }))

  useEffect(() => {
    if (secretDebounceRef.current) window.clearTimeout(secretDebounceRef.current)
    if (!input.trim()) {
      pendingFindingsRef.current = []
      return
    }
    secretDebounceRef.current = window.setTimeout(() => {
      pendingFindingsRef.current = detectSecrets(input)
    }, 300)
    return () => {
      if (secretDebounceRef.current) window.clearTimeout(secretDebounceRef.current)
    }
  }, [input])

  const handleSend = (text: string) => {
    if (!text.trim() || isStreaming) return
    const findings = pendingFindingsRef.current.length > 0 ? pendingFindingsRef.current : detectSecrets(text)
    if (findings.length > 0) {
      onSecretWarning(findings, text)
      return
    }
    onSend(text)
    setInput('')
    pendingFindingsRef.current = []
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const handleResizeTextarea = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="shrink-0 px-4 sm:px-8 py-4 border-t border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
      <div className="flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleResizeTextarea}
          placeholder={
            isStreaming
              ? 'Waiting for response…'
              : 'Ask anything… (Enter to send, Shift+Enter for newline)'
          }
          disabled={isStreaming}
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-[var(--border-radius-button)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ maxHeight: '160px', overflowY: 'auto' }}
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isStreaming}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--border-radius-button)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send size={15} />
          Send
        </button>
      </div>
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-2">
        Responses may include Markdown, Mermaid diagrams, Chart.js charts, and
        syntax-highlighted code.
      </p>
    </div>
  )
})
