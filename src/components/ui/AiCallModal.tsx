import { useState, useEffect, useCallback } from 'react'
import { X, Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import type { AiCallRecord } from '@/types/api'

interface AiCallModalProps {
  call: AiCallRecord
  onClose: () => void
}

type Tab = 'prompt' | 'response'

function formatTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function AiCallModal({ call, onClose }: AiCallModalProps) {
  const [tab, setTab] = useState<Tab>('prompt')
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleCopy() {
    const text = tab === 'prompt' ? call.promptText : call.responseText
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setToast({ variant: 'success', message: 'Copied to clipboard.' })
    })
  }

  const activeText = tab === 'prompt' ? call.promptText : call.responseText

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-4 py-3 border-b border-[var(--color-tables-table-header-stroke)]">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
                #{call.iteration} — {call.model}
              </span>
              {call.isError && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]">
                  Error
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-[var(--color-fonts-font-color-support)]">
              <MetaItem label="In" value={formatTokens(call.inputTokens)} />
              <Dot />
              <MetaItem label="Out" value={formatTokens(call.outputTokens)} />
              <Dot />
              <MetaItem label="Cache R" value={formatTokens(call.cacheReadInputTokens ?? call.cacheReadTokens ?? 0)} />
              <Dot />
              <MetaItem label="Cache W" value={formatTokens(call.cacheCreationInputTokens ?? call.cacheWriteTokens ?? 0)} />
              <Dot />
              <MetaItem label="Duration" value={formatDuration(call.durationMs)} />
              {call.stopReason && (
                <>
                  <Dot />
                  <MetaItem label="Stop" value={call.stopReason} />
                </>
              )}
              {call.toolNames && (
                <>
                  <Dot />
                  <MetaItem label="Tools" value={call.toolNames} />
                </>
              )}
            </div>
            {call.errorMessage && (
              <p className="text-[11px] font-mono text-[var(--color-tags-font-critical)] truncate max-w-xl">
                {call.errorMessage}
              </p>
            )}
          </div>
          <Tooltip text="Close">
            <Button variant="ghost" size="xs" icon={<X size={14} />} onClick={onClose} />
          </Tooltip>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex items-center gap-0 px-4 border-b border-[var(--color-tables-table-header-stroke)]">
          {(['prompt', 'response'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-[var(--color-fonts-font-color-brand)] text-[var(--color-fonts-font-color-brand)]'
                  : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {t === 'prompt' ? 'Prompt' : 'Response'}
            </button>
          ))}
          <div className="flex-1" />
          <Tooltip text="Copy to clipboard">
            <Button
              variant="ghost"
              size="xs"
              icon={<Copy size={13} />}
              onClick={handleCopy}
              disabled={!activeText}
            />
          </Tooltip>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {activeText ? (
            <pre className="font-mono text-xs text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap break-words leading-relaxed">
              {activeText}
            </pre>
          ) : (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] py-8 text-center">
              No {tab} text recorded for this call.
            </p>
          )}
        </div>
      </div>

      {toast && <Toast {...toast} onClose={dismissToast} />}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-[var(--color-fonts-font-color-support)]">{label}: </span>
      <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{value}</span>
    </span>
  )
}

function Dot() {
  return <span className="opacity-30">·</span>
}
