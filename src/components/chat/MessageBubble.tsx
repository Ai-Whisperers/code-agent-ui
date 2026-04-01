import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { User, Bot, Pencil, Copy, Check, Download, Globe } from 'lucide-react'
import type { ChatMessage } from '@/types/api'
import { MarkdownMessage } from './MarkdownMessage'
import { ThinkingPanel } from './ThinkingPanel'
import { SourcesSidebar } from './SourcesSidebar'

interface MessageBubbleProps {
  message: ChatMessage
  onEdit?: (newText: string) => void
}

function downloadMarkdown(content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'chat-export.md'
  a.click()
  URL.revokeObjectURL(url)
}

export const MessageBubble = memo(function MessageBubble({ message, onEdit }: MessageBubbleProps) {
  // ── All hooks unconditionally at the top ──────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.content)
  const [userCopied, setUserCopied] = useState(false)
  const [assistantCopied, setAssistantCopied] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  const handleEditStart = useCallback(() => {
    setEditText(message.content)
    setIsEditing(true)
  }, [message.content])

  const handleEditSubmit = useCallback(() => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(trimmed)
    }
    setIsEditing(false)
  }, [editText, message.content, onEdit])

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditText(message.content)
    }
  }, [handleEditSubmit, message.content])

  const handleUserCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setUserCopied(true)
      setTimeout(() => setUserCopied(false), 2000)
    })
  }, [message.content])

  const handleAssistantCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setAssistantCopied(true)
      setTimeout(() => setAssistantCopied(false), 2000)
    })
  }, [message.content])

  // ── User message ──────────────────────────────────────────────────────
  if (message.role === 'user') {
    return (
      <div className="flex justify-end items-center gap-2 group">
        {/* Hover action buttons — shown to left of bubble */}
        {!isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
            {onEdit && (
              <button
                onClick={handleEditStart}
                className="p-1.5 rounded-md text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background)] transition-colors"
                title="Edit message"
              >
                <Pencil size={13} />
              </button>
            )}
            <button
              onClick={handleUserCopy}
              className="p-1.5 rounded-md text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background)] transition-colors"
              title="Copy message"
            >
              {userCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            </button>
          </div>
        )}

        {/* Message bubble or inline editor */}
        {isEditing ? (
          <div className="max-w-[80%] w-full flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={Math.max(2, editText.split('\n').length)}
              className="w-full bg-[var(--color-buttons-button-primary)] text-white rounded-[var(--border-radius-card)] rounded-tr-sm px-4 py-3 text-sm leading-relaxed resize-none outline-none placeholder-white/60 border-2 border-white/30 focus:border-white/60"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => { setIsEditing(false); setEditText(message.content) }}
                className="px-2.5 py-1 rounded border border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-cards-card-background)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                className="px-2.5 py-1 rounded bg-[var(--color-buttons-button-primary)] text-white hover:opacity-80 transition-opacity"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-[80%] bg-[var(--color-buttons-button-primary)] text-white rounded-[var(--border-radius-card)] rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        )}

        <div className="w-8 h-8 rounded-full bg-[var(--color-inputs-input-background)] border border-[var(--color-cards-card-stroke)] flex items-center justify-center shrink-0 mt-0.5">
          <User size={15} className="text-[var(--color-fonts-font-color-support)]" />
        </div>
      </div>
    )
  }

  // ── Assistant message ─────────────────────────────────────────────────
  return (
    <div className="flex gap-3 group">
      <div className="w-8 h-8 rounded-full bg-[var(--color-buttons-button-primary)] flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] rounded-tl-sm px-4 py-3">
          {message.thinkingSteps && message.thinkingSteps.length > 0 && (
            <ThinkingPanel steps={message.thinkingSteps} isLive={false} />
          )}
          <MarkdownMessage content={message.content} />
        </div>
        {/* Action bar — visible on hover */}
        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={handleAssistantCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background)] transition-colors"
            title="Copy response"
          >
            {assistantCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          </button>

          <button
            onClick={() => downloadMarkdown(message.content)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background)] transition-colors"
            title="Download as Markdown"
          >
            <Download size={13} />
          </button>

          {/* Sources pill — only when web search was used */}
          {message.webSources && message.webSources.length > 0 && (
            <button
              onClick={() => setShowSources(true)}
              className={[
                'ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                'border border-[var(--color-borders-border-primary)]',
                'text-[var(--color-fonts-font-color-support)]',
                'hover:text-[var(--color-fonts-font-color-primary)]',
                'hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30',
              ].join(' ')}
              title="View web search sources"
            >
              <Globe size={11} />
              {message.webSources.length} source{message.webSources.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {showSources && message.webSources && (
        <SourcesSidebar
          sources={message.webSources}
          onClose={() => setShowSources(false)}
        />
      )}
    </div>
  )
})
