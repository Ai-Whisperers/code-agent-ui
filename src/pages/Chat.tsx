import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import mermaid from 'mermaid'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Line, Pie, Doughnut, Radar, PolarArea } from 'react-chartjs-2'
import { Send, Bot, User, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import { refreshToken, getToken } from '@/lib/keycloak'
import type { ChatEvent, ChatMessage, ProductConfig } from '@/types/api'

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })

// ── MermaidDiagram ─────────────────────────────────────────────────────────────

function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState('')
  const [renderError, setRenderError] = useState(false)
  // Tracks which render call is the most recent to discard stale results
  const renderIdRef = useRef(0)

  useEffect(() => {
    const renderId = ++renderIdRef.current

    // Use a fresh UUID each call so mermaid never finds a previously placed SVG
    // in the DOM and removes it when rendering a new diagram.
    const uniqueId = `mermaid-${crypto.randomUUID().replace(/-/g, '')}`

    mermaid
      .render(uniqueId, code)
      .then(({ svg: rawSvg }) => {
        if (renderId !== renderIdRef.current) return
        // Strip the id attribute so mermaid cannot locate and remove this
        // SVG on subsequent render() calls with a colliding id.
        setSvg(rawSvg.replace(/\sid="[^"]*"/, ''))
        setRenderError(false)
      })
      .catch(() => {
        if (renderId !== renderIdRef.current) return
        setRenderError(true)
      })
  }, [code])

  if (renderError) {
    return (
      <div className="my-4 flex items-center gap-2 px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-support)] text-sm">
        <AlertTriangle size={15} />
        Failed to render diagram.
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 h-32 rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] animate-pulse" />
    )
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className="my-4 flex justify-center overflow-x-auto rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] p-4"
    />
  )
}

// ── ChartBlock ─────────────────────────────────────────────────────────────────

type ChartConfig = {
  type: string
  data: never
  options?: never
}

function ChartBlock({ code }: { code: string }) {
  let config: ChartConfig
  try {
    config = JSON.parse(code) as ChartConfig
  } catch {
    return (
      <div className="my-3 flex items-center gap-2 px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] text-sm">
        <AlertTriangle size={15} />
        Invalid chart JSON
      </div>
    )
  }

  const opts = (config.options ?? {}) as never
  const data = config.data

  const inner = (() => {
    switch (config.type?.toLowerCase()) {
      case 'bar':
        return <Bar data={data} options={opts} />
      case 'line':
        return <Line data={data} options={opts} />
      case 'pie':
        return <Pie data={data} options={opts} />
      case 'doughnut':
        return <Doughnut data={data} options={opts} />
      case 'radar':
        return <Radar data={data} options={opts} />
      case 'polararea':
        return <PolarArea data={data} options={opts} />
      default:
        return (
          <div className="flex items-center gap-2 text-[var(--color-fonts-font-color-support)] text-sm">
            <AlertTriangle size={15} />
            Unknown chart type: {config.type}
          </div>
        )
    }
  })()

  return (
    <div className="my-4 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] p-4">
      {inner}
    </div>
  )
}

// ── Markdown components ────────────────────────────────────────────────────────

const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const language = match?.[1] ?? ''
    const code = String(children).replace(/\n$/, '')

    if (!match) {
      return (
        <code className="px-1.5 py-0.5 rounded text-[0.8em] font-mono bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] border border-[var(--color-cards-card-stroke)]">
          {children}
        </code>
      )
    }

    if (language === 'mermaid') {
      return <MermaidDiagram code={code} />
    }

    if (language === 'chart') {
      return <ChartBlock code={code} />
    }

    return (
      <div className="my-3 rounded-[var(--border-radius-card)] overflow-hidden text-sm">
        <div className="flex items-center px-4 py-1.5 bg-[#282c34] border-b border-white/10">
          <span className="text-xs font-mono text-[#abb2bf] uppercase tracking-wider">
            {language}
          </span>
        </div>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8125rem' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    )
  },
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-[var(--color-fonts-font-color-headings)] mt-5 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-[var(--color-fonts-font-color-headings)] mt-4 mb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-[var(--color-fonts-font-color-headings)] mt-3 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 text-sm leading-relaxed text-[var(--color-fonts-font-color-primary)]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-sm text-[var(--color-fonts-font-color-primary)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm text-[var(--color-fonts-font-color-primary)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 border-l-4 border-[var(--color-buttons-button-primary)] italic text-sm text-[var(--color-fonts-font-color-support)]">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--color-cards-card-background)]">{children}</thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-[var(--color-cards-card-stroke)] last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-[var(--color-fonts-font-color-primary)]">{children}</td>
  ),
  hr: () => <hr className="my-4 border-[var(--color-cards-card-stroke)]" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-buttons-button-primary)] underline hover:opacity-80"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--color-fonts-font-color-headings)]">
      {children}
    </strong>
  ),
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}

// ── ToolActivityBadge ──────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  knowledge_search: 'Searching knowledge base',
  search_knowledge_base: 'Searching knowledge base',
  semantic_search: 'Semantic search',
  customer_lookup: 'Looking up customer context',
  code_search: 'Searching source code',
  web_search: 'Searching the web',
}

function ToolActivityBadge({ tool }: { tool: string }) {
  const label = TOOL_LABELS[tool] ?? `Using ${tool.replace(/_/g, ' ')}`
  return (
    <div className="mb-2">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] border border-[var(--color-cards-card-stroke)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-buttons-button-primary)] animate-pulse" />
        {label}…
      </span>
    </div>
  )
}

// ── ProductSelector ────────────────────────────────────────────────────────────

function ProductSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (id: string) => void
}) {
  const { data: products = [] } = useQuery<ProductConfig[]>({
    queryKey: ['products'],
    queryFn: () =>
      api
        .get('/customer-registry/products')
        .then((r) => r.data)
        .catch(() => []),
  })

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-3 rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] cursor-pointer"
    >
      <option value="">All products</option>
      {products.map((p) => (
        <option key={p.productId} value={p.productId}>
          {p.productId}
          {p.displayName ? ` — ${p.displayName}` : ''}
        </option>
      ))}
    </select>
  )
}

// ── MessageBubble ──────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[80%] bg-[var(--color-buttons-button-primary)] text-white rounded-[var(--border-radius-card)] rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
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
        <MarkdownMessage content={message.content} />
      </div>
    </div>
  )
}

// ── Chat page ──────────────────────────────────────────────────────────────────

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [input, setInput] = useState('')

  const conversationId = useRef(crypto.randomUUID())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsStreaming(true)
      setStreamingContent('')
      setActiveTool(null)

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      let accumulatedContent = ''

      try {
        await refreshToken()
        const token = getToken()

        const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: text.trim(),
            ...(selectedProductId ? { productId: selectedProductId } : {}),
            conversationId: conversationId.current,
          }),
        })

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
              case 'text':
                accumulatedContent += event.text ?? ''
                setStreamingContent(accumulatedContent)
                break
              case 'tool_start':
                setActiveTool(event.tool ?? null)
                break
              case 'tool_end':
                setActiveTool(null)
                break
              case 'done':
                setMessages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), role: 'assistant', content: accumulatedContent },
                ])
                setStreamingContent('')
                setIsStreaming(false)
                setActiveTool(null)
                return
              case 'error':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `**Error:** ${event.error ?? 'Something went wrong.'}`,
                  },
                ])
                setStreamingContent('')
                setIsStreaming(false)
                setActiveTool(null)
                return
            }
          }
        }

        // Stream ended without a 'done' event — commit what we have
        if (accumulatedContent) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: accumulatedContent },
          ])
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '**Error:** Could not reach the assistant. Please try again.',
          },
        ])
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
        setActiveTool(null)
      }
    },
    [isStreaming, selectedProductId],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div
      className="-mx-8 -my-6 flex flex-col bg-[var(--color-page-background)]"
      style={{ height: '100dvh' }}
    >
      {/* Header */}
      <div className="shrink-0 px-8 pt-6 pb-4 border-b border-[var(--color-cards-card-stroke)]">
        <PageHeader
          title="AI Chat"
          subtitle="Ask anything about your codebase, team, or architecture."
          actions={<ProductSelector value={selectedProductId} onChange={setSelectedProductId} />}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-buttons-button-primary)] flex items-center justify-center shadow-lg">
              <Bot size={28} className="text-white" />
            </div>
            <div>
              <p className="text-[var(--color-fonts-font-color-headings)] font-semibold text-base">
                How can I help you today?
              </p>
              <p className="text-[var(--color-fonts-font-color-support)] text-sm mt-1 max-w-sm">
                Ask about your codebase, architecture, team members, or anything else. Select a
                product above to scope the context.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* In-flight assistant message */}
        {isStreaming && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-buttons-button-primary)] flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {activeTool && <ToolActivityBadge tool={activeTool} />}
              <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] rounded-tl-sm px-4 py-3">
                {streamingContent ? (
                  <MarkdownMessage content={streamingContent} />
                ) : (
                  <div className="flex items-center gap-1.5 py-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[var(--color-fonts-font-color-support)] animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[var(--color-fonts-font-color-support)] animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[var(--color-fonts-font-color-support)] animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-8 py-4 border-t border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
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
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--border-radius-button)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={15} />
            Send
          </button>
        </div>
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-2">
          Responses may include Markdown, Mermaid diagrams, Chart.js charts, and syntax-highlighted code.
        </p>
      </div>
    </div>
  )
}
