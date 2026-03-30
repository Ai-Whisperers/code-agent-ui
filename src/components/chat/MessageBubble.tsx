import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { User, Bot, Pencil, Copy, Check } from 'lucide-react'
import type { ChatMessage } from '@/types/api'
import { MarkdownMessage } from './MarkdownMessage'
import { ThinkingPanel } from './ThinkingPanel'

interface MessageBubbleProps {
  message: ChatMessage
  onEdit?: (newText: string) => void
}

export const MessageBubble = memo(function MessageBubble({ message, onEdit }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.content)
  const [copied, setCopied] = useState(false)
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

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [message.content])

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
              onClick={handleCopy}
              className="p-1.5 rounded-md text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background)] transition-colors"
              title="Copy message"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
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

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[var(--color-buttons-button-primary)] flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] rounded-tl-sm px-4 py-3">
        {message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <ThinkingPanel steps={message.thinkingSteps} isLive={false} />
        )}
        <MarkdownMessage content={message.content} />
      </div>
    </div>
  )
})
