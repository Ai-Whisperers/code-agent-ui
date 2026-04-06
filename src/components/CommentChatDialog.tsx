import { useState, useRef, useEffect, useCallback } from 'react'
import { X, FileCode, Bot, Loader2 } from 'lucide-react'
import { refreshToken, getToken } from '@/lib/keycloak'
import { MessageBubble, StreamingMarkdownMessage, ThinkingPanel, ChatInputBar } from '@/components/chat'
import type { ChatInputHandle } from '@/components/chat'
import type { ChatMessage, ThinkingStep, ChatEvent, ReviewCommentEntry } from '@/types/api'

export type CommentChatAction = 'resolved' | 'false_positive' | 'fix_started'

interface Props {
  comment: ReviewCommentEntry
  jobId: string
  onClose: () => void
  onAction: (type: CommentChatAction, meta?: string) => void
}

interface CommentChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function CommentChatDialog({ comment, jobId, onClose, onAction }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinkingSteps, setStreamingThinkingSteps] = useState<ThinkingStep[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [secretWarning, setSecretWarning] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamingContentRef = useRef('')
  const streamingRafRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inputBarRef = useRef<ChatInputHandle>(null)
  const hasGreeted = useRef(false)

  // Smooth scroll when a complete message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Instant scroll while tokens arrive — smooth scroll at token frequency
  // creates competing animations that feel choppy
  useEffect(() => {
    if (isStreaming && streamingContent) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [streamingContent, isStreaming])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Auto-greet on mount
  useEffect(() => {
    if (!hasGreeted.current) {
      hasGreeted.current = true
      sendMessage([], '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildHistory = useCallback((msgs: ChatMessage[]): CommentChatMessage[] =>
    msgs.map(m => ({ role: m.role, content: m.content })),
  [])

  const sendMessage = useCallback(async (currentMessages: ChatMessage[], userText: string) => {
    if (isStreaming) return

    setIsStreaming(true)
    setStreamingContent('')
    setStreamingThinkingSteps([])
    streamingContentRef.current = ''

    // Optimistically add the user message to the list (skip on auto-greeting)
    let messagesWithUser = currentMessages
    if (userText.trim()) {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText.trim(),
      }
      messagesWithUser = [...currentMessages, userMsg]
      setMessages(messagesWithUser)
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    let accumulatedContent = ''
    const accumulatedThinkingSteps: ThinkingStep[] = []

    try {
      await refreshToken()
      const token = getToken()

      // Build history for backend (all messages including new user message)
      const history: CommentChatMessage[] = buildHistory(messagesWithUser)

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/jobs/${jobId}/comment-chat`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            commentId: comment.commentId,
            messages: history,
          }),
        }
      )

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim()
          if (!raw) continue

          let event: ChatEvent
          try {
            event = JSON.parse(raw)
          } catch {
            continue
          }

          switch (event.type) {
            case 'thinking': {
              const last = accumulatedThinkingSteps[accumulatedThinkingSteps.length - 1]
              if (last?.kind === 'thought') {
                last.text += event.text ?? ''
              } else {
                accumulatedThinkingSteps.push({ kind: 'thought', text: event.text ?? '' })
              }
              setStreamingThinkingSteps([...accumulatedThinkingSteps])
              break
            }
            case 'text':
              accumulatedContent += event.text ?? ''
              streamingContentRef.current = accumulatedContent
              if (!streamingRafRef.current) {
                streamingRafRef.current = requestAnimationFrame(() => {
                  setStreamingContent(streamingContentRef.current)
                  streamingRafRef.current = null
                })
              }
              break
            case 'tool_start':
              accumulatedThinkingSteps.push({
                kind: 'tool',
                name: event.tool ?? '',
                input: event.input,
                status: 'running',
                startTime: event.timestamp ?? Date.now(),
              })
              setStreamingThinkingSteps([...accumulatedThinkingSteps])
              break
            case 'tool_end': {
              const toolName = event.tool ?? ''
              const result = event.result ?? ''

              // Update thinking step status
              const lastTool = [...accumulatedThinkingSteps]
                .reverse()
                .find(s => s.kind === 'tool' && s.name === toolName && s.status === 'running')
              if (lastTool && lastTool.kind === 'tool') {
                lastTool.status = result.startsWith('ERROR:') ? 'error' : 'completed'
                lastTool.result = result
                lastTool.endTime = event.timestamp ?? Date.now()
              }
              setStreamingThinkingSteps([...accumulatedThinkingSteps])

              // Fire onAction callback for the three comment actions
              if (toolName === 'resolve_comment' && !result.startsWith('ERROR:')) {
                onAction('resolved')
              } else if (toolName === 'mark_false_positive' && !result.startsWith('ERROR:')) {
                onAction('false_positive')
              } else if (toolName === 'request_fix' && result.startsWith('fix_started:')) {
                const fixJobId = result.replace('fix_started:', '')
                onAction('fix_started', fixJobId)
              }
              break
            }
            case 'done':
            case 'error':
              // Stream complete — finalise the assistant message
              break
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      accumulatedContent = accumulatedContent || 'Something went wrong. Please try again.'
    } finally {
      // Cancel pending RAF and flush final accumulated content so the last
      // tokens are never silently dropped before the message is committed.
      if (streamingRafRef.current) {
        cancelAnimationFrame(streamingRafRef.current)
        streamingRafRef.current = null
      }
      setStreamingContent(accumulatedContent)

      // Commit the streamed assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: accumulatedContent,
        thinkingSteps: accumulatedThinkingSteps.length > 0 ? [...accumulatedThinkingSteps] : undefined,
      }

      setMessages(prev => [...prev, assistantMsg])
      setStreamingContent('')
      setStreamingThinkingSteps([])
      setIsStreaming(false)

      // Re-focus input after response
      setTimeout(() => inputBarRef.current?.focus(), 50)
    }
  }, [isStreaming, jobId, comment.commentId, buildHistory, onAction])

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return
    sendMessage(messages, text)
  }, [isStreaming, messages, sendMessage])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dialog card */}
      <div className="relative flex flex-col w-full max-w-4xl h-[88vh] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] rounded-xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-borders-border-primary)] shrink-0">
          <div className="w-7 h-7 rounded-full bg-[var(--color-buttons-button-primary)] flex items-center justify-center shrink-0">
            <Bot size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)]">
            Review Discussion
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Context pill */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-borders-border-primary)]/50 bg-[var(--color-cards-card-background-hover)] shrink-0">
          <FileCode size={13} className="shrink-0 text-[var(--color-fonts-font-color-support)]" />
          <span className="text-xs text-[var(--color-fonts-font-color-support)] font-mono truncate">
            {comment.filePath}
            {comment.line > 0 && <span className="ml-1 text-[var(--color-fonts-font-color-support)]">:{comment.line}</span>}
          </span>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4 min-h-0">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming assistant response */}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-buttons-button-primary)] flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={15} className="text-white" />
              </div>
              <div className="flex-1 min-w-0 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] rounded-tl-sm px-4 py-3">
                {streamingThinkingSteps.length > 0 && (
                  <ThinkingPanel steps={streamingThinkingSteps} isLive />
                )}
                {streamingContent ? (
                  <StreamingMarkdownMessage content={streamingContent} isStreaming={true} />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Loader2 size={13} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
                    <span className="text-xs text-[var(--color-fonts-font-color-support)]">Thinking…</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Secret scanner warning */}
        {secretWarning && (
          <div className="mx-4 mb-1 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600 flex items-center gap-2">
            <span className="flex-1">{secretWarning}</span>
            <button onClick={() => setSecretWarning(null)} className="shrink-0 hover:text-amber-800">✕</button>
          </div>
        )}

        {/* Input bar — attachments and plan mode disabled */}
        <div className="border-t border-[var(--color-borders-border-primary)] shrink-0">
          <ChatInputBar
            ref={inputBarRef}
            isStreaming={isStreaming}
            simplified
            canPlan={false}
            onSend={handleSend}
            onStop={handleStop}
            onSecretWarning={(findings) =>
              setSecretWarning(`Possible secret detected: ${findings.join(', ')}. Please remove before sending.`)
            }
          />
        </div>
      </div>
    </div>
  )
}
