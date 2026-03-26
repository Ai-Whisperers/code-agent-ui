import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  RotateCcw,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Truck,
  X,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ReadinessBadge } from '@/components/roadmap/ReadinessBadge'
import api from '@/lib/api'
import type { Roadmap, RoadmapTreeItem, ItemOverrideStatus } from '@/types/api'

// ── Types ────────────────────────────────────────────────────────────────────

type SortField = 'issueKey' | 'issueType' | 'readinessScore' | 'summary'
type SortDir = 'asc' | 'desc'

interface FilterState {
  issueKey: string
  issueType: string
  readiness: string
  summary: string
}

interface TreeNode extends RoadmapTreeItem {
  children: TreeNode[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(items: RoadmapTreeItem[]): TreeNode[] {
  const byKey = new Map<string, TreeNode>()
  for (const item of items) {
    byKey.set(item.issueKey, { ...item, children: [] })
  }
  const roots: TreeNode[] = []
  for (const node of byKey.values()) {
    if (node.parentKey && byKey.has(node.parentKey)) {
      byKey.get(node.parentKey)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function flattenTree(nodes: TreeNode[], expandedKeys: Set<string>, depth = 0): Array<{ node: TreeNode; depth: number }> {
  const result: Array<{ node: TreeNode; depth: number }> = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (expandedKeys.has(node.issueKey) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expandedKeys, depth + 1))
    }
  }
  return result
}

function allKeys(nodes: TreeNode[]): string[] {
  const keys: string[] = []
  for (const node of nodes) {
    keys.push(node.issueKey)
    if (node.children.length > 0) keys.push(...allKeys(node.children))
  }
  return keys
}

function findNode(nodes: TreeNode[], key: string): TreeNode | null {
  for (const n of nodes) {
    if (n.issueKey === key) return n
    const found = findNode(n.children, key)
    if (found) return found
  }
  return null
}

function hasActiveJobs(items: RoadmapTreeItem[]): boolean {
  return items.some((item) => !item.reviewedAt && !item.overrideStatus)
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
// Uses fixed positioning so it isn't clipped by overflow-x-auto on the table container.

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  return (
    <div
      className="inline-flex"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setPos({ x: rect.left + rect.width / 2, y: rect.top })
        setVisible(true)
      }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 6,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-[9999] px-2 py-1 text-[10px] leading-tight rounded-md bg-gray-900 text-gray-100 whitespace-nowrap pointer-events-none shadow-md"
        >
          {text}
        </span>
      )}
    </div>
  )
}

// ── Small reusable display components ────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>

  const cls: Record<string, string> = {
    'New': 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'QA': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'Closed': 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  }

  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${cls[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'}`}>
      {status}
    </span>
  )
}

function OverrideBadge({ status }: { status?: ItemOverrideStatus }) {
  if (!status) return null
  const cls = status === 'ACCEPTED'
    ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
    : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      {status}
    </span>
  )
}

function ScoreBar({ score, title }: { score?: number; title?: string }) {
  if (score == null) return <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
  const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2" title={title}>
      <div className="w-16 h-1.5 rounded-full bg-[var(--color-borders-border-primary)]">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-[var(--color-fonts-font-color-primary)]">{score}</span>
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />
  return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
}

// ── Item Detail Panel ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = { EPIC: 'Epic', FEATURE: 'Feature', USERSTORY: 'Story' }
const TYPE_BG: Record<string, string> = {
  EPIC: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  FEATURE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  USERSTORY: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
}

function ItemDetailPanel({
  node,
  onClose,
  onReview,
  onAccept,
  onRemove,
  onClearOverride,
  isReviewing,
}: {
  node: TreeNode
  onClose: () => void
  onReview: () => void
  onAccept: () => void
  onRemove: () => void
  onClearOverride: () => void
  isReviewing: boolean
}) {
  const isOverridden = !!node.overrideStatus

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-[420px] flex flex-col bg-[var(--color-surface-surface-1)] border-l border-[var(--color-borders-border-primary)] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-borders-border-primary)] bg-[var(--color-surface-surface-2)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono font-semibold text-[var(--color-fonts-font-color-brand)]">
            {node.issueKey}
          </span>
          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${TYPE_BG[node.issueType] ?? ''}`}>
            {TYPE_LABEL[node.issueType] ?? node.issueType}
          </span>
          {node.isStale && !isOverridden && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
              stale
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-surface-surface-1)] transition-colors"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Summary */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1.5">Summary</p>
          <p className="text-sm text-[var(--color-fonts-font-color-primary)] leading-relaxed">{node.summary}</p>
        </section>

        {/* Status grid */}
        <section className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Jira Status</p>
            <StatusBadge status={node.jiraStatus} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Override</p>
            {node.overrideStatus ? <OverrideBadge status={node.overrideStatus} /> : <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Delivery Ready</p>
            {node.readyForDelivery == null ? (
              <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>
            ) : node.readyForDelivery ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
                <CheckCircle2 size={10} /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
                <XCircle size={10} /> Not Ready
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Reviewed At</p>
            <span className="text-xs text-[var(--color-fonts-font-color-primary)]">
              {node.reviewedAt ? new Date(node.reviewedAt).toLocaleString() : '—'}
            </span>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Last Jira Update</p>
            <span className="text-xs text-[var(--color-fonts-font-color-primary)]">
              {node.jiraModifiedAt ? new Date(node.jiraModifiedAt).toLocaleString() : '—'}
            </span>
          </div>
        </section>

        {/* Scores */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-2">Scores</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-fonts-font-color-support)] w-20 shrink-0">Readiness</span>
              {node.readinessScore != null
                ? <ReadinessBadge label={node.readinessLabel} score={node.readinessScore} showScore />
                : <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-fonts-font-color-support)] w-20 shrink-0">Complexity</span>
              <ScoreBar score={node.complexityScore} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-fonts-font-color-support)] w-20 shrink-0">Aggregate</span>
              <ScoreBar score={node.aggregateScore} />
            </div>
          </div>
        </section>

        {/* AI Suggestions */}
        {node.improvementSummary && !isOverridden && (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1.5">AI Suggestions</p>
            <div className="p-3 rounded-[var(--border-radius-card)] bg-[var(--color-surface-surface-2)] border border-[var(--color-borders-border-primary)]">
              <p className="text-xs text-[var(--color-fonts-font-color-primary)] leading-relaxed whitespace-pre-wrap">
                {node.improvementSummary}
              </p>
            </div>
          </section>
        )}

        {/* Hierarchy */}
        {(node.parentKey || node.grandparentKey) && (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Hierarchy</p>
            <div className="text-xs text-[var(--color-fonts-font-color-support)] space-y-0.5">
              {node.grandparentKey && (
                <p>Epic: <span className="font-mono text-[var(--color-fonts-font-color-brand)]">{node.grandparentKey}</span></p>
              )}
              {node.parentKey && (
                <p>Parent: <span className="font-mono text-[var(--color-fonts-font-color-brand)]">{node.parentKey}</span></p>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-[var(--color-borders-border-primary)] px-4 py-3 bg-[var(--color-surface-surface-2)] flex items-center gap-2">
        {isOverridden ? (
          <button
            onClick={onClearOverride}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
          >
            <RotateCcw size={12} />
            Undo Override
          </button>
        ) : (
          <>
            <button
              onClick={onReview}
              disabled={isReviewing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {isReviewing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Run Review
            </button>
            <button
              onClick={onAccept}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] hover:opacity-80 transition-opacity"
            >
              <CheckCircle2 size={12} />
              Accept
            </button>
            <button
              onClick={onRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] hover:opacity-80 transition-opacity"
            >
              <MinusCircle size={12} />
              Remove
            </button>
          </>
        )}
      </div>
    </aside>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RoadmapDetail({ roadmapId }: { roadmapId: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('issueKey')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filters, setFilters] = useState<FilterState>({ issueKey: '', issueType: '', readiness: '', summary: '' })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const { data: roadmap } = useQuery<Roadmap>({
    queryKey: ['roadmap', roadmapId],
    queryFn: () => api.get(`/roadmap/${roadmapId}`).then((r) => r.data),
  })

  const { data: treeItems, isLoading } = useQuery<RoadmapTreeItem[]>({
    queryKey: ['roadmap-tree', roadmapId],
    queryFn: () => api.get(`/roadmap/${roadmapId}/tree`).then((r) => r.data).catch(() => []),
    refetchInterval: (query) => {
      const items = query.state.data
      if (Array.isArray(items) && hasActiveJobs(items)) return 5_000
      return 30_000
    },
  })

  const items = Array.isArray(treeItems) ? treeItems : []
  const tree = useMemo(() => buildTree(items), [items])

  // Expand all by default when data arrives
  useEffect(() => {
    if (tree.length > 0 && expandedKeys.size === 0) {
      setExpandedKeys(new Set(allKeys(tree)))
    }
  }, [tree]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selected node in sync with latest fetched data
  const selectedNode = useMemo(() => {
    if (!selectedKey) return null
    return findNode(tree, selectedKey)
  }, [selectedKey, tree])

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const setFilter = (k: keyof FilterState, v: string) =>
    setFilters((prev) => ({ ...prev, [k]: v }))

  const sortedRoots = useMemo(() => {
    const compare = (a: TreeNode, b: TreeNode): number => {
      let av: string | number | undefined
      let bv: string | number | undefined
      if (sortField === 'readinessScore') { av = a.readinessScore ?? -1; bv = b.readinessScore ?? -1 }
      else { av = String(a[sortField] ?? ''); bv = String(b[sortField] ?? '') }
      const result = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? result : -result
    }
    return [...tree].sort(compare)
  }, [tree, sortField, sortDir])

  const flatRows = useMemo(() => flattenTree(sortedRoots, expandedKeys), [sortedRoots, expandedKeys])

  const filteredRows = useMemo(() => {
    return flatRows.filter(({ node }) => {
      if (filters.issueKey && !node.issueKey.toLowerCase().includes(filters.issueKey.toLowerCase())) return false
      if (filters.issueType && node.issueType !== filters.issueType) return false
      if (filters.readiness && node.readinessLabel !== filters.readiness) return false
      if (filters.summary && !node.summary.toLowerCase().includes(filters.summary.toLowerCase())) return false
      return true
    })
  }, [flatRows, filters])

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/roadmap/${roadmapId}/sync`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] })
      setExpandedKeys(new Set())
    },
  })

  const reviewAllMutation = useMutation<unknown, Error, boolean>({
    mutationFn: (force: boolean) =>
      api.post(`/roadmap/${roadmapId}/review-all${force ? '?force=true' : ''}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] }),
  })

  const reviewOneMutation = useMutation({
    mutationFn: (issueKey: string) => api.post(`/roadmap/${roadmapId}/review/${issueKey}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] }),
  })

  const overrideMutation = useMutation({
    mutationFn: ({ issueKey, status }: { issueKey: string; status: ItemOverrideStatus }) =>
      api.put(`/roadmap/${roadmapId}/items/${issueKey}/override`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] }),
  })

  const clearOverrideMutation = useMutation({
    mutationFn: (issueKey: string) => api.delete(`/roadmap/${roadmapId}/items/${issueKey}/override`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] }),
  })

  const isPolling = items.length > 0 && hasActiveJobs(items)
  const activeReviews = items.filter((i) => !i.reviewedAt && !i.overrideStatus).length

  return (
    <main>
      <PageHeader
        title={roadmap?.name ?? 'Roadmap'}
        subtitle={roadmap ? `Jira label: ${roadmap.label}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate({ to: '/metrics/roadmap' })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              <ChevronLeft size={14} />
              Back
            </button>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title="Re-fetch all issues from Jira and update the item list"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 transition-colors"
            >
              {syncMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Sync from Jira
            </button>
            <div className="flex rounded-[var(--border-radius-button-small)] overflow-hidden">
              <button
                onClick={() => reviewAllMutation.mutate(false)}
                disabled={reviewAllMutation.isPending || items.length === 0}
                title={items.length === 0 ? 'Sync from Jira first' : 'Queue AI reviews for changed items only'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
              >
                {reviewAllMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
                Review Changed
              </button>
              <button
                onClick={() => reviewAllMutation.mutate(true)}
                disabled={reviewAllMutation.isPending || items.length === 0}
                title="Force re-review of ALL items regardless of changes"
                className="px-2 py-1.5 text-xs bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors border-l border-white/30"
              >
                All
              </button>
            </div>
          </div>
        }
        statusMessage={
          syncMutation.isPending ? (
            <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
              <Loader2 size={12} className="animate-spin" />
              Syncing issues from Jira…
            </div>
          ) : isPolling ? (
            <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
              <Loader2 size={12} className="animate-spin" />
              {activeReviews} review{activeReviews !== 1 ? 's' : ''} in progress — auto-refreshing every 5s
            </div>
          ) : undefined
        }
      />

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-[var(--border-radius-card)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)] text-sm">
          <RefreshCw size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No items synced yet</p>
            <p className="text-xs mt-0.5 opacity-80">
              Click <strong>Sync from Jira</strong> to fetch epics, features, and user stories for this roadmap.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          placeholder="Filter by issue key…"
          value={filters.issueKey}
          onChange={(e) => setFilter('issueKey', e.target.value)}
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-surface-surface-1)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)] w-44"
        />
        <select
          value={filters.issueType}
          onChange={(e) => setFilter('issueType', e.target.value)}
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-surface-surface-1)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)]"
        >
          <option value="">All types</option>
          <option value="EPIC">Epic</option>
          <option value="FEATURE">Feature</option>
          <option value="USERSTORY">User Story</option>
        </select>
        <select
          value={filters.readiness}
          onChange={(e) => setFilter('readiness', e.target.value)}
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-surface-surface-1)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)]"
        >
          <option value="">All readiness</option>
          <option value="poor">Poor</option>
          <option value="needs_refinement">Needs Refinement</option>
          <option value="ready_with_minor_improvements">Minor Improvements</option>
          <option value="fully_ready">Fully Ready</option>
        </select>
        <input
          placeholder="Filter by name…"
          value={filters.summary}
          onChange={(e) => setFilter('summary', e.target.value)}
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-surface-surface-1)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)] flex-1 min-w-40"
        />
      </div>

      {/* Table */}
      <div className="rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] bg-[var(--color-cards-card-background)]">

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-tables-table-header-stroke)]">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
            {filteredRows.length} item{filteredRows.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setExpandedKeys(new Set(allKeys(sortedRoots)))}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              <ChevronsDown size={12} />
              Expand All
            </button>
            <button
              onClick={() => setExpandedKeys(new Set())}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              <ChevronsUp size={12} />
              Collapse All
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-18rem)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
                <th
                  className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('issueKey')}
                >
                  <span className="flex items-center gap-1">
                    Issue <SortIcon field="issueKey" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none"
                  onClick={() => toggleSort('issueType')}
                >
                  <span className="flex items-center gap-1">
                    Type <SortIcon field="issueType" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none"
                  onClick={() => toggleSort('summary')}
                >
                  <span className="flex items-center gap-1">
                    Name <SortIcon field="summary" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  Status
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('readinessScore')}
                >
                  <span className="flex items-center gap-1">
                    Readiness <SortIcon field="readinessScore" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  Complexity
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  Aggregate
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <Truck size={12} />
                    Delivery Ready
                  </span>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  Override
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 skeleton-shimmer rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No items match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ node, depth }) => (
                  <RoadmapRow
                    key={node.issueKey}
                    node={node}
                    depth={depth}
                    expanded={expandedKeys.has(node.issueKey)}
                    isSelected={selectedKey === node.issueKey}
                    onToggle={() => toggleExpand(node.issueKey)}
                    onRowClick={() => setSelectedKey((k) => k === node.issueKey ? null : node.issueKey)}
                    onReview={() => reviewOneMutation.mutate(node.issueKey)}
                    onAccept={() => overrideMutation.mutate({ issueKey: node.issueKey, status: 'ACCEPTED' })}
                    onRemove={() => overrideMutation.mutate({ issueKey: node.issueKey, status: 'REMOVED' })}
                    onClearOverride={() => clearOverrideMutation.mutate(node.issueKey)}
                    isReviewing={reviewOneMutation.isPending && reviewOneMutation.variables === node.issueKey}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedKey && selectedNode && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedKey(null)}
          />
          <ItemDetailPanel
            node={selectedNode}
            onClose={() => setSelectedKey(null)}
            onReview={() => reviewOneMutation.mutate(selectedNode.issueKey)}
            onAccept={() => overrideMutation.mutate({ issueKey: selectedNode.issueKey, status: 'ACCEPTED' })}
            onRemove={() => overrideMutation.mutate({ issueKey: selectedNode.issueKey, status: 'REMOVED' })}
            onClearOverride={() => clearOverrideMutation.mutate(selectedNode.issueKey)}
            isReviewing={reviewOneMutation.isPending && reviewOneMutation.variables === selectedNode.issueKey}
          />
        </>
      )}
    </main>
  )
}

// ── Row Component ─────────────────────────────────────────────────────────────

function RoadmapRow({
  node,
  depth,
  expanded,
  isSelected,
  onToggle,
  onRowClick,
  onReview,
  onAccept,
  onRemove,
  onClearOverride,
  isReviewing,
}: {
  node: TreeNode
  depth: number
  expanded: boolean
  isSelected: boolean
  onToggle: () => void
  onRowClick: () => void
  onReview: () => void
  onAccept: () => void
  onRemove: () => void
  onClearOverride: () => void
  isReviewing: boolean
}) {
  const isOverridden = !!node.overrideStatus
  const hasChildren = node.children.length > 0
  const isPending = !node.reviewedAt && !isOverridden

  const typeBg: Record<string, string> = {
    EPIC: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    FEATURE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    USERSTORY: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  }

  return (
    <tr
      className={`border-b border-[var(--color-tables-table-cell-stroke)] transition-colors cursor-pointer ${
        isSelected
          ? 'bg-[var(--color-tables-table-hover)] outline outline-1 outline-[var(--color-buttons-button-primary)] outline-offset-[-1px]'
          : isOverridden
          ? 'opacity-50 hover:bg-[var(--color-tables-table-hover)]'
          : 'hover:bg-[var(--color-tables-table-hover)]'
      }`}
      onClick={onRowClick}
    >
      {/* Issue key + expand toggle */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle() }}
              className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] shrink-0"
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <span className="text-xs font-mono text-[var(--color-fonts-font-color-brand)]">{node.issueKey}</span>
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${typeBg[node.issueType] ?? ''}`}>
          {TYPE_LABEL[node.issueType] ?? node.issueType}
        </span>
      </td>

      {/* Summary */}
      <td className="px-4 py-3 max-w-xs">
        <div className="flex items-start gap-1.5">
          <p className="text-xs text-[var(--color-fonts-font-color-primary)] truncate">
            {node.summary}
          </p>
          {node.isStale && !isOverridden && (
            <span
              title={`Jira updated ${node.jiraModifiedAt ? new Date(node.jiraModifiedAt).toLocaleString() : ''} — review may be outdated`}
              className="shrink-0 mt-0.5 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]"
            >
              stale
            </span>
          )}
        </div>
        {node.improvementSummary && !isOverridden && (
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 truncate">
            {node.improvementSummary}
          </p>
        )}
      </td>

      {/* Jira Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={node.jiraStatus} />
      </td>

      {/* Readiness */}
      <td className="px-4 py-3 whitespace-nowrap">
        {isPending ? (
          <div className="flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-support)]">
            <Loader2 size={11} className="animate-spin" />
            Pending
          </div>
        ) : isOverridden ? (
          <OverrideBadge status={node.overrideStatus} />
        ) : (
          <ReadinessBadge label={node.readinessLabel} score={node.readinessScore} showScore />
        )}
      </td>

      {/* Complexity */}
      <td className="px-4 py-3 whitespace-nowrap">
        <ScoreBar score={node.complexityScore} title="Complexity score" />
      </td>

      {/* Aggregate */}
      <td className="px-4 py-3 whitespace-nowrap">
        <ScoreBar score={node.aggregateScore} title="Aggregate readiness score" />
      </td>

      {/* Delivery Ready */}
      <td className="px-4 py-3 whitespace-nowrap">
        {node.readyForDelivery == null ? (
          <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
        ) : node.readyForDelivery ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
            <CheckCircle2 size={11} />
            Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
            <XCircle size={11} />
            Not Ready
          </span>
        )}
      </td>

      {/* Override status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <OverrideBadge status={node.overrideStatus} />
      </td>

      {/* Actions — stopPropagation so clicking buttons doesn't open the detail panel */}
      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {isOverridden ? (
            <Tooltip text="Undo override">
              <button
                onClick={onClearOverride}
                className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-surface-surface-2)] transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            </Tooltip>
          ) : (
            <>
              <Tooltip text="Run AI review">
                <button
                  onClick={onReview}
                  disabled={isReviewing}
                  className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-buttons-button-primary)] hover:bg-[var(--color-surface-surface-2)] disabled:opacity-50 transition-colors"
                >
                  {isReviewing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                </button>
              </Tooltip>
              <Tooltip text="Mark as Accepted">
                <button
                  onClick={onAccept}
                  className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-success)] hover:bg-[var(--color-tags-success-background)] transition-colors"
                >
                  <CheckCircle2 size={13} />
                </button>
              </Tooltip>
              <Tooltip text="Mark as Removed">
                <button
                  onClick={onRemove}
                  className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors"
                >
                  <MinusCircle size={13} />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
