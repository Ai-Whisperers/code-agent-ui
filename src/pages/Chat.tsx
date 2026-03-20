import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
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
import {
  Send,
  Bot,
  User,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MessageSquare,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react'
import api from '@/lib/api'
import { refreshToken, getToken } from '@/lib/keycloak'
import type { ChatEvent, ChatMessage, ProductConfig, ConversationSummary } from '@/types/api'

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

    // Use two distinct UUIDs: one for the mermaid render call, one for the
    // displayed SVG element. After rendering, replace every occurrence of the
    // render ID with the display ID throughout the SVG string (the id=""
    // attribute on <svg> AND all matching #id CSS selectors inside <style>).
    // This keeps the scoped CSS rules intact (so node fills/colours work) while
    // ensuring mermaid will never find and remove the displayed element on a
    // future render() call.
    const rendererKey = `rnd${crypto.randomUUID().replace(/-/g, '')}`
    const displayKey = `dsp${crypto.randomUUID().replace(/-/g, '')}`

    mermaid
      .render(rendererKey, code)
      .then(({ svg: rawSvg }) => {
        if (renderId !== renderIdRef.current) return
        setSvg(rawSvg.replaceAll(rendererKey, displayKey))
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

function parseChartConfig(code: string): ChartConfig | null {
  // Try strict JSON first, then fall back to JS object literal evaluation
  try {
    return JSON.parse(code) as ChartConfig
  } catch {
    try {
      return new Function('return ' + code)() as ChartConfig
    } catch {
      return null
    }
  }
}

function ChartBlock({ code }: { code: string }) {
  const [view, setView] = useState<'chart' | 'source'>('chart')

  const config = parseChartConfig(code)

  const renderChart = () => {
    if (!config) {
      return (
        <div className="flex items-center gap-2 text-[var(--color-fonts-font-color-support)] text-sm p-4">
          <AlertTriangle size={15} />
          Could not parse chart configuration.
        </div>
      )
    }

    const opts = (config.options ?? {}) as never
    const data = config.data

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
          <div className="flex items-center gap-2 text-[var(--color-fonts-font-color-support)] text-sm p-4">
            <AlertTriangle size={15} />
            Unknown chart type: {config.type}
          </div>
        )
    }
  }

  return (
    <div className="my-4 rounded-[var(--border-radius-card)] overflow-hidden border border-[var(--color-cards-card-stroke)]">
      {/* Header bar with toggle */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#282c34] border-b border-white/10">
        <span className="text-xs font-mono text-[#abb2bf] uppercase tracking-wider">chart</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('chart')}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
              view === 'chart'
                ? 'bg-white/15 text-white'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/10'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setView('source')}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
              view === 'source'
                ? 'bg-white/15 text-white'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/10'
            }`}
          >
            Source
          </button>
        </div>
      </div>

      {/* Body */}
      {view === 'chart' ? (
        <div className="bg-[var(--color-cards-card-background)] p-4">
          <div
            style={{
              height: '340px',
              width: '100%',
              resize: 'both',
              overflow: 'hidden',
              minWidth: '240px',
              minHeight: '180px',
            }}
          >
            {renderChart()}
          </div>
        </div>
      ) : (
        <SyntaxHighlighter
          language="javascript"
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8125rem' }}
        >
          {code}
        </SyntaxHighlighter>
      )}
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

    if (language === 'chart' || language === 'chartjs') {
      return <ChartBlock code={code} />
    }

    // Detect Chart.js configs in javascript/json blocks: must have both
    // a recognised chart type AND a datasets array.
    if (language === 'javascript' || language === 'js' || language === 'json') {
      const looksLikeChart =
        /\btype\s*[:=]\s*['"`]?(bar|line|pie|doughnut|radar|polarArea)\b/i.test(code) &&
        /\bdatasets\s*[:[]/.test(code)
      if (looksLikeChart) {
        return <ChartBlock code={code} />
      }
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

// ── Conversation helpers ────────────────────────────────────────────────────────

const CONV_LS_KEY = (id: string) => `conv_messages_${id}`

function saveMessagesToStorage(id: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(CONV_LS_KEY(id), JSON.stringify(msgs))
  } catch {
    // storage quota exceeded — silently ignore
  }
}

function loadMessagesFromStorage(id: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CONV_LS_KEY(id))
    if (!raw) return []
    return JSON.parse(raw) as ChatMessage[]
  } catch {
    return []
  }
}

type ConvGroup = { label: string; items: ConversationSummary[] }

function groupConversations(convs: ConversationSummary[]): ConvGroup[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86_400_000)

  const groups: ConvGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const conv of convs) {
    const d = new Date(conv.updatedAt)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (dayStart >= todayStart) groups[0].items.push(conv)
    else if (dayStart >= yesterdayStart) groups[1].items.push(conv)
    else if (d >= sevenDaysAgo) groups[2].items.push(conv)
    else groups[3].items.push(conv)
  }

  return groups.filter((g) => g.items.length > 0)
}

// ── ConversationSidebar ────────────────────────────────────────────────────────

function ConversationSidebar({
  activeId,
  onSelect,
  onNewChat,
}: {
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
}) {
  const queryClient = useQueryClient()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: conversations = [], isLoading } = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data),
  })

  const groups = groupConversations(conversations)

  const startRename = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(conv.conversationId)
    setRenameValue(conv.title)
  }

  const commitRename = async (id: string) => {
    const title = renameValue.trim()
    if (!title) {
      setRenamingId(null)
      return
    }
    try {
      await api.patch(`/conversations/${id}/title`, { title })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } finally {
      setRenamingId(null)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await api.delete(`/conversations/${id}`)
      localStorage.removeItem(CONV_LS_KEY(id))
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* New chat */}
      <div className="shrink-0 p-3 border-b border-[var(--color-cards-card-stroke)]">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--border-radius-button-small)] border border-[var(--color-cards-card-stroke)] hover:bg-[var(--color-cards-card-background)] text-sm text-[var(--color-fonts-font-color-primary)] transition-colors"
        >
          <Plus size={14} />
          New chat
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && (
          <p className="px-4 py-4 text-xs text-center text-[var(--color-fonts-font-color-support)]">
            Loading…
          </p>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
            <MessageSquare
              size={22}
              className="text-[var(--color-fonts-font-color-support)] opacity-30"
            />
            <p className="text-xs text-[var(--color-fonts-font-color-support)]">
              No conversations yet
            </p>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pt-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] opacity-50 select-none">
              {group.label}
            </p>
            {group.items.map((conv) => {
              const isActive = activeId === conv.conversationId
              const isRenaming = renamingId === conv.conversationId
              const isDeleting = deletingId === conv.conversationId

              return (
                <div
                  key={conv.conversationId}
                  onClick={() => !isRenaming && onSelect(conv.conversationId)}
                  className={`group relative flex items-center gap-2 mx-1.5 px-2.5 py-2 rounded-[var(--border-radius-button-small)] cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[var(--color-buttons-button-primary)] text-white'
                      : 'hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)]'
                  } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  {isRenaming ? (
                    <div
                      className="flex-1 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(conv.conversationId)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => commitRename(conv.conversationId)}
                        className="flex-1 min-w-0 bg-transparent border-b border-current text-sm outline-none"
                      />
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          commitRename(conv.conversationId)
                        }}
                        className="shrink-0 opacity-80 hover:opacity-100"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setRenamingId(null)
                        }}
                        className="shrink-0 opacity-80 hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-sm truncate">{conv.title}</span>
                      <div
                        className={`shrink-0 hidden group-hover:flex items-center gap-0.5 ${isActive ? 'text-white/70' : 'text-[var(--color-fonts-font-color-support)]'}`}
                      >
                        <button
                          onClick={(e) => startRename(conv, e)}
                          className="p-0.5 rounded hover:opacity-100 opacity-60 transition-opacity"
                          title="Rename"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(conv.conversationId, e)}
                          className={`p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity ${isActive ? 'hover:text-red-300' : 'hover:text-red-500'}`}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Chat page ──────────────────────────────────────────────────────────────────

export default function Chat() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams({ strict: false }) as { conversationId?: string }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [input, setInput] = useState('')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    params.conversationId ?? null,
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load messages from localStorage when route param changes (page load / back-forward)
  useEffect(() => {
    const id = params.conversationId
    if (id) {
      setActiveConversationId(id)
      setMessages(loadMessagesFromStorage(id))
    } else {
      setActiveConversationId(null)
      setMessages([])
    }
  }, [params.conversationId])

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
      setMobileSidebarOpen(false)

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
            ...(activeConversationId ? { conversationId: activeConversationId } : {}),
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
              case 'done': {
                const assistantMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: accumulatedContent,
                }
                setMessages((prev) => {
                  const next = [...prev, assistantMsg]
                  // Persist display history to localStorage
                  const convId = event.conversationId ?? activeConversationId
                  if (convId) saveMessagesToStorage(convId, next)
                  return next
                })
                setStreamingContent('')
                setIsStreaming(false)
                setActiveTool(null)
                // Navigate to the conversation URL if we just created a new one
                if (event.conversationId && event.conversationId !== activeConversationId) {
                  setActiveConversationId(event.conversationId)
                  navigate({ to: '/chat/$conversationId', params: { conversationId: event.conversationId } })
                }
                queryClient.invalidateQueries({ queryKey: ['conversations'] })
                return
              }
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
    [isStreaming, selectedProductId, activeConversationId, navigate, queryClient],
  )

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id)
      setMessages(loadMessagesFromStorage(id))
      setStreamingContent('')
      setActiveTool(null)
      setMobileSidebarOpen(false)
      navigate({ to: '/chat/$conversationId', params: { conversationId: id } })
    },
    [navigate],
  )

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null)
    setMessages([])
    setStreamingContent('')
    setActiveTool(null)
    setInput('')
    setMobileSidebarOpen(false)
    navigate({ to: '/chat' })
  }, [navigate])

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
      className="-mx-8 -my-6 flex bg-[var(--color-page-background)]"
      style={{ height: '100dvh' }}
    >
      {/* ── Mobile sidebar overlay backdrop ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 sm:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Conversation sidebar (desktop) ── */}
      <div
        className={`hidden sm:flex flex-col shrink-0 border-r border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] transition-all duration-200 overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-3 pt-4 pb-2">
          <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wider">
            Conversations
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationSidebar
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </div>
      </div>

      {/* ── Conversation sidebar (mobile drawer) ── */}
      <div
        className={`fixed top-0 left-0 bottom-0 z-30 w-72 flex flex-col border-r border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] sm:hidden transition-transform duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="shrink-0 flex items-center justify-between px-3 pt-4 pb-2 border-b border-[var(--color-cards-card-stroke)]">
          <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wider">
            Conversations
          </span>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationSidebar
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNewChat={handleNewChat}
          />
        </div>
      </div>

      {/* ── Main chat panel ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[var(--color-cards-card-stroke)]">
          {/* Toggle buttons */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="sm:hidden p-1.5 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
            title="Open conversations"
          >
            <PanelLeftOpen size={17} />
          </button>
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden sm:flex p-1.5 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
              title="Open conversations"
            >
              <PanelLeftOpen size={17} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] truncate">
              AI Chat
            </p>
          </div>

          <ProductSelector value={selectedProductId} onChange={setSelectedProductId} />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
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
        <div className="shrink-0 px-4 sm:px-8 py-4 border-t border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
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
            Responses may include Markdown, Mermaid diagrams, Chart.js charts, and
            syntax-highlighted code.
          </p>
        </div>
      </div>
    </div>
  )
}
