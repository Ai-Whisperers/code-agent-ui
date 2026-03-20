import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  ExternalLink,
  Database,
  Play,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type {
  KnowledgeStatsResponse,
  KnowledgeStatEntry,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
} from '@/types/api'

// ── Shared input styles ────────────────────────────────────────────────────────

const inputCls =
  'w-full h-8 px-3 text-sm font-mono rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)]'

const selectCls =
  'h-8 px-3 text-sm rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] cursor-pointer'

// ── Toast ──────────────────────────────────────────────────────────────────────

interface ToastMsg {
  id: number
  text: string
  type: 'success' | 'error'
}

let toastId = 0

function ToastList({ toasts }: { toasts: ToastMsg[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-[var(--border-radius-card)] shadow-lg text-sm font-medium ${
            t.type === 'success'
              ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] border border-[var(--color-tags-font-success)]'
              : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] border border-[var(--color-tags-font-critical)]'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ── Accordion wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] overflow-hidden mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown size={15} className="text-[var(--color-fonts-font-color-support)]" />
          ) : (
            <ChevronRight size={15} className="text-[var(--color-fonts-font-color-support)]" />
          )}
          <span className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
            {title}
          </span>
        </div>
        {badge}
      </button>
      {open && (
        <div className="border-t border-[var(--color-cards-card-stroke)]">{children}</div>
      )}
    </div>
  )
}

// ── Source type badge ──────────────────────────────────────────────────────────

function SourceTypeBadge({ type }: { type: string }) {
  const lower = type.toLowerCase()
  let cls = 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  if (lower === 'jira')
    cls = 'bg-[var(--color-tags-info-background)] text-[var(--color-tags-font-info)]'
  if (lower === 'confluence')
    cls = 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] font-medium ${cls}`}
    >
      {type}
    </span>
  )
}

// ── Stats section ──────────────────────────────────────────────────────────────

function StatsSection({
  stats,
  isLoading,
  onRefresh,
  isRefreshing,
}: {
  stats: KnowledgeStatEntry[]
  isLoading: boolean
  onRefresh: () => void
  isRefreshing: boolean
}) {
  const totalCount = stats.reduce((n, s) => n + s.count, 0)

  return (
    <Section
      title="Index Stats"
      defaultOpen={true}
      badge={
        !isLoading && (
          <span className="text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
            {totalCount.toLocaleString()} documents
          </span>
        )
      }
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--color-cards-card-stroke)]">
        <p className="text-xs text-[var(--color-fonts-font-color-support)]">
          Document counts and last indexed time per source type.
        </p>
        <button
          onClick={onRefresh}
          disabled={isRefreshing || isLoading}
          title="Refresh stats"
          className="flex items-center gap-1.5 px-3 h-7 text-xs rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-10 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          No index stats available. Run indexing to populate the knowledge base.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--color-fonts-font-color-support)] border-b border-[var(--color-cards-card-stroke)]">
              <th className="px-4 py-2 text-left font-medium">Source Type</th>
              <th className="px-4 py-2 text-right font-medium">Documents</th>
              <th className="px-4 py-2 text-right font-medium">Last Indexed</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((entry) => (
              <tr
                key={entry.sourceType}
                className="border-b border-[var(--color-cards-card-stroke)] last:border-0 hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors"
              >
                <td className="px-4 py-3">
                  <SourceTypeBadge type={entry.sourceType} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-fonts-font-color-primary)]">
                  {entry.count.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-xs text-[var(--color-fonts-font-color-support)]">
                  {entry.lastIndexed
                    ? new Date(entry.lastIndexed).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

// ── Index management section ───────────────────────────────────────────────────

function IndexManagementSection({
  onTrigger,
  triggering,
  addToast,
}: {
  onTrigger: (type: 'jira' | 'confluence' | 'all', payload?: object) => void
  triggering: string | null
  addToast: (text: string, type: 'success' | 'error') => void
}) {
  const [jiraProject, setJiraProject] = useState('')
  const [confluenceSpace, setConfluenceSpace] = useState('')

  function handleJira() {
    const key = jiraProject.trim()
    if (!key) {
      addToast('Enter a Jira project key first.', 'error')
      return
    }
    onTrigger('jira', { projectKey: key })
  }

  function handleConfluence() {
    const key = confluenceSpace.trim()
    if (!key) {
      addToast('Enter a Confluence space key first.', 'error')
      return
    }
    onTrigger('confluence', { spaceKey: key })
  }

  return (
    <Section title="Index Management" defaultOpen={true}>
      {/* Jira */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-[var(--color-cards-card-stroke)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SourceTypeBadge type="Jira" />
            <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
              Index Jira Project
            </span>
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)]">
            Trigger indexing for a specific Jira project by its project key (e.g.{' '}
            <code className="font-mono">PROJ</code>).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={jiraProject}
            onChange={(e) => setJiraProject(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJira()}
            placeholder="PROJECT-KEY"
            className={`${inputCls} w-40`}
          />
          <button
            onClick={handleJira}
            disabled={triggering === 'jira'}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            {triggering === 'jira' ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Index
          </button>
        </div>
      </div>

      {/* Confluence */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-[var(--color-cards-card-stroke)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <SourceTypeBadge type="Confluence" />
            <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
              Index Confluence Space
            </span>
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)]">
            Trigger indexing for a specific Confluence space by its space key (e.g.{' '}
            <code className="font-mono">ENG</code>).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={confluenceSpace}
            onChange={(e) => setConfluenceSpace(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleConfluence()}
            placeholder="SPACE-KEY"
            className={`${inputCls} w-40`}
          />
          <button
            onClick={handleConfluence}
            disabled={triggering === 'confluence'}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            {triggering === 'confluence' ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Index
          </button>
        </div>
      </div>

      {/* Reindex all */}
      <div className="flex items-center gap-4 px-4 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Database size={14} className="text-[var(--color-fonts-font-color-support)]" />
            <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
              Reindex All Sources
            </span>
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)]">
            Trigger a full reindex of all configured sources (Jira + Confluence). This may take
            several minutes.
          </p>
        </div>
        <button
          onClick={() => onTrigger('all')}
          disabled={triggering === 'all'}
          className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-[var(--border-radius-button-small)] border border-[var(--color-tags-critical-background)] bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] hover:opacity-80 disabled:opacity-40 transition-opacity shrink-0"
        >
          {triggering === 'all' ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Reindex All
        </button>
      </div>
    </Section>
  )
}

// ── Search result card ─────────────────────────────────────────────────────────

function SearchResultCard({ result }: { result: KnowledgeSearchResult }) {
  return (
    <div className="px-4 py-3 border-b border-[var(--color-cards-card-stroke)] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SourceTypeBadge type={result.sourceType} />
            <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)] truncate">
              {result.title}
            </span>
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] leading-relaxed line-clamp-3">
            {result.content}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-xs font-mono px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
            {(result.score * 100).toFixed(1)}%
          </span>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open source"
              className="p-1 rounded-[var(--border-radius-small)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Semantic search section ────────────────────────────────────────────────────

const SOURCE_TYPES = ['jira', 'confluence']

function SemanticSearchSection() {
  const [query, setQuery] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [productId, setProductId] = useState('')
  const [topK, setTopK] = useState('10')
  const [hasSearched, setHasSearched] = useState(false)

  function toggleSource(src: string) {
    setSelectedSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src],
    )
  }

  const { data, isFetching, refetch } = useQuery<KnowledgeSearchResponse>({
    queryKey: ['knowledge-search', query, selectedSources, productId, topK],
    queryFn: () => {
      const params = new URLSearchParams({ query, topK })
      if (selectedSources.length > 0) params.set('sourceTypes', selectedSources.join(','))
      if (productId.trim()) params.set('productId', productId.trim())
      return api.get(`/knowledge/search?${params.toString()}`).then((r) => r.data)
    },
    enabled: false,
  })

  function handleSearch() {
    if (!query.trim()) return
    setHasSearched(true)
    refetch()
  }

  const results = data?.results ?? []

  return (
    <Section title="Semantic Search" defaultOpen={false}>
      {/* Search form */}
      <div className="px-4 py-4 space-y-3 border-b border-[var(--color-cards-card-stroke)]">
        {/* Query input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search knowledge base…"
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isFetching}
            className="flex items-center gap-1.5 px-4 h-8 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            {isFetching ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Search size={12} />
            )}
            Search
          </button>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Source type toggle chips */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">Sources:</span>
            <div className="flex gap-1.5">
              {SOURCE_TYPES.map((src) => {
                const active = selectedSources.includes(src)
                return (
                  <button
                    key={src}
                    onClick={() => toggleSource(src)}
                    className={`text-xs px-2.5 py-1 rounded-[var(--border-radius-tag)] border transition-colors capitalize ${
                      active
                        ? 'bg-[var(--color-buttons-button-primary)] text-white border-[var(--color-buttons-button-primary)]'
                        : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] border-[var(--color-inputs-input-border)] hover:border-[var(--color-buttons-button-primary)]'
                    }`}
                  >
                    {src}
                  </button>
                )
              })}
              {selectedSources.length === 0 && (
                <span className="text-xs text-[var(--color-fonts-font-color-support)] italic self-center">
                  all
                </span>
              )}
            </div>
          </div>

          {/* Product ID */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">Product ID:</span>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="optional"
              className="h-7 px-2 text-xs font-mono w-32 rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)]"
            />
          </div>

          {/* Top-K */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">Top K:</span>
            <select
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
              className={`${selectCls} h-7 text-xs w-20`}
            >
              {['5', '10', '20', '50'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      {isFetching ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          No results found for &ldquo;{query}&rdquo;.
        </div>
      ) : hasSearched ? (
        <>
          <div className="px-4 py-2 border-b border-[var(--color-cards-card-stroke)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">
              {data?.total ?? results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>
          {results.map((r) => (
            <SearchResultCard key={r.id} result={r} />
          ))}
        </>
      ) : (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          Enter a query above to search the knowledge base.
        </div>
      )}
    </Section>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function KnowledgeIndexPage() {
  const qc = useQueryClient()
  const [triggering, setTriggering] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  function addToast(text: string, type: 'success' | 'error') {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  // Stats query
  const {
    data: statsData,
    isLoading: statsLoading,
    isFetching: statsRefreshing,
    refetch: refetchStats,
  } = useQuery<KnowledgeStatsResponse>({
    queryKey: ['knowledge-stats'],
    queryFn: () => api.get('/knowledge/stats').then((r) => r.data),
  })

  const stats = statsData?.stats ?? []

  // Index mutation
  const indexMutation = useMutation({
    mutationFn: ({
      type,
      payload,
    }: {
      type: 'jira' | 'confluence' | 'all'
      payload?: object
    }) => api.post(`/knowledge/index/${type}`, payload ?? {}),
    onMutate: ({ type }) => setTriggering(type),
    onSuccess: (_data, { type }) => {
      const labels: Record<string, string> = {
        jira: 'Jira indexing',
        confluence: 'Confluence indexing',
        all: 'Full reindex',
      }
      addToast(`${labels[type]} triggered successfully.`, 'success')
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
    },
    onError: (_err, { type }) => {
      const labels: Record<string, string> = {
        jira: 'Jira indexing',
        confluence: 'Confluence indexing',
        all: 'Full reindex',
      }
      addToast(`Failed to trigger ${labels[type]}.`, 'error')
    },
    onSettled: () => setTriggering(null),
  })

  function handleTrigger(type: 'jira' | 'confluence' | 'all', payload?: object) {
    indexMutation.mutate({ type, payload })
  }

  return (
    <main>
      <PageHeader
        title="Knowledge Index"
        subtitle="Manage and explore the knowledge base. Trigger Jira and Confluence indexing, monitor index stats, and run semantic searches."
      />

      <StatsSection
        stats={stats}
        isLoading={statsLoading}
        onRefresh={() => refetchStats()}
        isRefreshing={statsRefreshing && !statsLoading}
      />

      <IndexManagementSection
        onTrigger={handleTrigger}
        triggering={triggering}
        addToast={addToast}
      />

      <SemanticSearchSection />

      <ToastList toasts={toasts} />
    </main>
  )
}
