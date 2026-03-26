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
  Globe,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  FileText,
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type {
  KnowledgeStatsResponse,
  KnowledgeStatEntry,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
  WebDocSource,
  WebDocSourceCreateRequest,
  StaticFileSource,
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
  if (lower === 'web-docs')
    cls = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
  if (lower === 'static-file')
    cls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] font-medium ${cls}`}
    >
      {type}
    </span>
  )
}

// ── File size formatter ────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-[var(--color-fonts-font-color-support)] border-b border-[var(--color-cards-card-stroke)]">
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">Source Type</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Documents</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Last Indexed</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((entry) => (
              <tr
                key={entry.sourceType}
                className="border-b border-[var(--color-cards-card-stroke)] last:border-0 hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors"
              >
                <td className="px-4 py-1.5">
                  <SourceTypeBadge type={entry.sourceType} />
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-[var(--color-fonts-font-color-primary)]">
                  {entry.count.toLocaleString()}
                </td>
                <td className="px-4 py-1.5 text-right text-[var(--color-fonts-font-color-support)]">
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
            Trigger a full reindex of all configured sources (Jira, Confluence and web documentation
            sources). This may take several minutes.
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

// ── Web doc sources section ────────────────────────────────────────────────────

function WebDocSourcesSection({
  addToast,
}: {
  addToast: (text: string, type: 'success' | 'error') => void
}) {
  const qc = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [crawlingId, setCrawlingId] = useState<string | null>(null)
  const [form, setForm] = useState<WebDocSourceCreateRequest>({
    name: '',
    baseUrl: '',
    allowedPathPrefix: '',
    maxPages: 500,
    crawlDelayMs: 500,
  })

  const { data: sources = [], isLoading } = useQuery<WebDocSource[]>({
    queryKey: ['web-doc-sources'],
    queryFn: () => api.get('/knowledge/web-doc-sources').then((r) => r.data).catch(() => []),
  })

  const addMutation = useMutation({
    mutationFn: (req: WebDocSourceCreateRequest) =>
      api.post('/knowledge/web-doc-sources', req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-doc-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
      addToast('Web doc source registered.', 'success')
      setShowAddForm(false)
      setForm({ name: '', baseUrl: '', allowedPathPrefix: '', maxPages: 500, crawlDelayMs: 500 })
    },
    onError: () => addToast('Failed to register web doc source.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge/web-doc-sources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-doc-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
      addToast('Web doc source deleted.', 'success')
    },
    onError: () => addToast('Failed to delete web doc source.', 'error'),
  })

  const crawlMutation = useMutation({
    mutationFn: (id: string) => api.post(`/knowledge/index/web-docs/${id}`, {}),
    onMutate: (id) => setCrawlingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-doc-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
      addToast('Crawl completed successfully.', 'success')
    },
    onError: () => addToast('Crawl failed.', 'error'),
    onSettled: () => setCrawlingId(null),
  })

  const crawlAllMutation = useMutation({
    mutationFn: () => api.post('/knowledge/index/web-docs', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['web-doc-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
      addToast('Crawl all sources completed.', 'success')
    },
    onError: () => addToast('Crawl all failed.', 'error'),
  })

  function handleAdd() {
    if (!form.name.trim() || !form.baseUrl.trim() || !form.allowedPathPrefix.trim()) {
      addToast('Name, Base URL and Allowed Path Prefix are required.', 'error')
      return
    }
    addMutation.mutate(form)
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete web doc source "${name}" and all its indexed content?`)) return
    deleteMutation.mutate(id)
  }

  return (
    <Section
      title="Web Documentation Sources"
      defaultOpen={true}
      badge={
        !isLoading && sources.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
            {sources.length} source{sources.length !== 1 ? 's' : ''}
          </span>
        ) : undefined
      }
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-cards-card-stroke)]">
        <p className="text-xs text-[var(--color-fonts-font-color-support)]">
          Register external documentation sites to crawl and index. Crawls run automatically every
          Friday night when the scheduler is enabled.
        </p>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={() => crawlAllMutation.mutate()}
            disabled={crawlAllMutation.isPending || sources.length === 0}
            className="flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors disabled:opacity-40"
          >
            {crawlAllMutation.isPending ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Globe size={12} />
            )}
            Crawl All
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={12} />
            Add Source
          </button>
        </div>
      </div>

      {/* Source list */}
      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : sources.length === 0 && !showAddForm ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          No web documentation sources registered. Add one to get started.
        </div>
      ) : (
        <table className="w-full text-xs">
          {sources.length > 0 && (
            <>
              <thead>
                <tr className="text-[10px] text-[var(--color-fonts-font-color-support)] border-b border-[var(--color-cards-card-stroke)]">
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">Name</th>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">Base URL</th>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">Last Crawled</th>
                  <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Chunks</th>
                  <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr
                    key={source.id}
                    className="border-b border-[var(--color-cards-card-stroke)] last:border-0 hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors"
                  >
                    <td className="px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        {source.lastCrawlError ? (
                          <span title={source.lastCrawlError}>
                          <AlertCircle
                            size={13}
                            className="text-[var(--color-tags-font-critical)] shrink-0"
                          />
                          </span>
                        ) : source.lastCrawlChunks != null && source.lastCrawlChunks > 0 ? (
                          <CheckCircle
                            size={13}
                            className="text-[var(--color-tags-font-success)] shrink-0"
                          />
                        ) : null}
                        <span className="font-medium text-[var(--color-fonts-font-color-headings)] truncate max-w-36">
                          {source.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-1.5">
                      <a
                        href={source.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[var(--color-buttons-button-primary)] hover:underline truncate max-w-48 block"
                      >
                        {source.baseUrl}
                      </a>
                    </td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">
                      {source.lastCrawledAt
                        ? new Date(source.lastCrawledAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono text-[var(--color-fonts-font-color-primary)]">
                      {source.lastCrawlChunks != null ? source.lastCrawlChunks.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => crawlMutation.mutate(source.id)}
                          disabled={crawlingId === source.id}
                          title="Crawl now"
                          className="flex items-center gap-1 px-2 h-6 text-xs font-medium rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors disabled:opacity-40"
                        >
                          {crawlingId === source.id ? (
                            <RefreshCw size={11} className="animate-spin" />
                          ) : (
                            <Play size={11} />
                          )}
                          Crawl
                        </button>
                        <button
                          onClick={() => handleDelete(source.id, source.name)}
                          disabled={deleteMutation.isPending}
                          title="Delete source"
                          className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      )}

      {/* Add source form */}
      {showAddForm && (
        <div className="border-t border-[var(--color-cards-card-stroke)] px-4 py-4 bg-[var(--color-navigation-menu-item-hover-background)]">
          <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] mb-3">
            Add Web Documentation Source
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Quarkus Guides"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">
                Base URL *
              </label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://quarkus.io/guides/"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">
                Allowed Path Prefix * <span className="italic">(only links under this prefix will be followed)</span>
              </label>
              <input
                type="text"
                value={form.allowedPathPrefix}
                onChange={(e) => setForm((f) => ({ ...f, allowedPathPrefix: e.target.value }))}
                placeholder="https://quarkus.io/guides/"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">
                Max Pages
              </label>
              <input
                type="number"
                value={form.maxPages ?? 500}
                min={1}
                onChange={(e) => setForm((f) => ({ ...f, maxPages: parseInt(e.target.value) || 500 }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">
                Crawl Delay (ms)
              </label>
              <input
                type="number"
                value={form.crawlDelayMs ?? 500}
                min={0}
                step={100}
                onChange={(e) => setForm((f) => ({ ...f, crawlDelayMs: parseInt(e.target.value) || 500 }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {addMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
              Register Source
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 h-8 text-xs font-medium rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}

// ── Static files section ───────────────────────────────────────────────────────

function StaticFilesSection({
  addToast,
}: {
  addToast: (text: string, type: 'success' | 'error') => void
}) {
  const qc = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [reindexingId, setReindexingId] = useState<string | null>(null)

  const { data: files = [], isLoading } = useQuery<StaticFileSource[]>({
    queryKey: ['static-file-sources'],
    queryFn: () => api.get('/knowledge/static-files').then((r) => r.data).catch(() => []),
  })

  const uploadMutation = useMutation({
    mutationFn: ({ file, displayName }: { file: File; displayName: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('filename', file.name)
      fd.append('contentType', file.type || 'application/octet-stream')
      if (displayName.trim()) fd.append('name', displayName.trim())
      return api.post('/knowledge/static-files', fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['static-file-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
      addToast('File uploaded and indexed successfully.', 'success')
      setSelectedFile(null)
      setName('')
    },
    onError: () => addToast('Upload failed.', 'error'),
  })

  const reindexMutation = useMutation({
    mutationFn: (id: string) => api.post(`/knowledge/static-files/${id}/reindex`, {}),
    onMutate: (id) => setReindexingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['static-file-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
      addToast('File reindexed successfully.', 'success')
    },
    onError: () => addToast('Reindex failed.', 'error'),
    onSettled: () => setReindexingId(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge/static-files/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['static-file-sources'] })
      qc.invalidateQueries({ queryKey: ['knowledge-stats'] })
      addToast('File deleted.', 'success')
    },
    onError: () => addToast('Failed to delete file.', 'error'),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    if (file && !name.trim()) {
      setName(file.name.replace(/\.[^.]+$/, ''))
    }
  }

  function handleUpload() {
    if (!selectedFile) {
      addToast('Select a file first.', 'error')
      return
    }
    uploadMutation.mutate({ file: selectedFile, displayName: name })
  }

  function handleDelete(id: string, fileName: string) {
    if (!window.confirm(`Delete "${fileName}" and all its indexed content?`)) return
    deleteMutation.mutate(id)
  }

  return (
    <Section
      title="Static Files"
      defaultOpen={true}
      badge={
        !isLoading && files.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        ) : undefined
      }
    >
      {/* Upload area */}
      <div className="px-4 py-4 border-b border-[var(--color-cards-card-stroke)]">
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-3">
          Upload <code className="font-mono">.txt</code>,{' '}
          <code className="font-mono">.md</code> or{' '}
          <code className="font-mono">.pdf</code> files to index into the knowledge base.
          Files are stored in S3 and indexed automatically on upload.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">
              File *
            </label>
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileChange}
              className="text-xs text-[var(--color-fonts-font-color-primary)] file:mr-3 file:h-8 file:px-3 file:text-xs file:font-medium file:rounded-[var(--border-radius-button-small)] file:border file:border-[var(--color-inputs-input-border)] file:bg-[var(--color-buttons-button-back)] file:text-[var(--color-fonts-font-color-buttons)] file:cursor-pointer hover:file:bg-[var(--color-buttons-button-back-hover)] file:transition-colors"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">
              Display name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Architecture Overview"
              className={inputCls}
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
            className="flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          >
            {uploadMutation.isPending ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            Upload & Index
          </button>
        </div>
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          No files uploaded yet. Upload a file above to get started.
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-[var(--color-fonts-font-color-support)] border-b border-[var(--color-cards-card-stroke)]">
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">Name</th>
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">File</th>
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide">Indexed</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Size</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Chunks</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr
                key={f.id}
                className="border-b border-[var(--color-cards-card-stroke)] last:border-0 hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors"
              >
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    {f.indexError ? (
                      <span title={f.indexError}>
                      <AlertCircle
                        size={13}
                        className="text-[var(--color-tags-font-critical)] shrink-0"
                      />
                      </span>
                    ) : f.chunkCount != null && f.chunkCount > 0 ? (
                      <CheckCircle
                        size={13}
                        className="text-[var(--color-tags-font-success)] shrink-0"
                      />
                    ) : (
                      <FileText
                        size={13}
                        className="text-[var(--color-fonts-font-color-support)] shrink-0"
                      />
                    )}
                    <span className="font-medium text-[var(--color-fonts-font-color-headings)] truncate max-w-36">
                      {f.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-1.5 font-mono text-[var(--color-fonts-font-color-support)] truncate max-w-40">
                  {f.originalFilename}
                </td>
                <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">
                  {f.indexedAt ? new Date(f.indexedAt).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-[var(--color-fonts-font-color-primary)]">
                  {formatFileSize(f.fileSize)}
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-[var(--color-fonts-font-color-primary)]">
                  {f.chunkCount != null ? f.chunkCount.toLocaleString() : '—'}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => reindexMutation.mutate(f.id)}
                      disabled={reindexingId === f.id}
                      title="Reindex file"
                      className="flex items-center gap-1 px-2 h-6 text-xs font-medium rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors disabled:opacity-40"
                    >
                      <RefreshCw
                        size={11}
                        className={reindexingId === f.id ? 'animate-spin' : ''}
                      />
                      Reindex
                    </button>
                    <button
                      onClick={() => handleDelete(f.id, f.name)}
                      disabled={deleteMutation.isPending}
                      title="Delete file"
                      className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

// ── Semantic search section ────────────────────────────────────────────────────

const SOURCE_TYPES = ['jira', 'confluence', 'web-docs', 'static-file']

function SemanticSearchSection() {
  const [query, setQuery] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [topK, setTopK] = useState('10')
  const [hasSearched, setHasSearched] = useState(false)

  function toggleSource(src: string) {
    setSelectedSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src],
    )
  }

  const { data, isFetching, refetch } = useQuery<KnowledgeSearchResponse>({
    queryKey: ['knowledge-search', query, selectedSources, topK],
    queryFn: () => {
      const params = new URLSearchParams({ q: query, topK })
      selectedSources.forEach((s) => params.append('sourceType', s))
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

  const stats: KnowledgeStatEntry[] = statsData
    ? [
        { sourceType: 'jira', count: statsData.jira, lastIndexed: null },
        { sourceType: 'confluence', count: statsData.confluence, lastIndexed: null },
        { sourceType: 'jira-attachment', count: statsData.jiraAttachment, lastIndexed: null },
        { sourceType: 'web-docs', count: statsData.webDocs, lastIndexed: null },
        { sourceType: 'static-file', count: statsData.staticFiles ?? 0, lastIndexed: null },
      ]
    : []

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

      <WebDocSourcesSection addToast={addToast} />

      <StaticFilesSection addToast={addToast} />

      <SemanticSearchSection />

      <ToastList toasts={toasts} />
    </main>
  )
}
