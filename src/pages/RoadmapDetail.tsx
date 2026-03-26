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
  Table2,
  CalendarDays,
  Wand2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tooltip } from '@/components/ui/Tooltip'
import { ReadinessBadge } from '@/components/roadmap/ReadinessBadge'
import { SprintGanttView } from '@/components/roadmap/SprintGanttView'
import { ProposalModal } from '@/components/roadmap/ProposalModal'
import api from '@/lib/api'
import { mcpProfilesApi, type SystemConfig } from '@/lib/mcpProfiles'
import type { Roadmap, RoadmapTreeItem, ItemOverrideStatus, RoadmapProposal } from '@/types/api'

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

// ── Small reusable display components ────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-[var(--color-fonts-font-color-support)]">—</span>

  const cls: Record<string, string> = {
    'New': 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'QA': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'Closed': 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  }

  return (
    <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] ${cls[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'}`}>
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
    <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] ${cls}`}>
      {status}
    </span>
  )
}

function ScoreBar({ score, title, reversed }: { score?: number; title?: string; reversed?: boolean }) {
  if (score == null) return <span className="text-[var(--color-fonts-font-color-support)]">—</span>
  const color = reversed
    ? (score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500')
    : (score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500')
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <div className="w-12 h-1 rounded-full bg-[var(--color-borders-border-primary)]">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span>{score}</span>
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
  roadmapId,
  onClose,
  onReview,
  onAccept,
  onRemove,
  onClearOverride,
  isReviewing,
  isRefreshing,
}: {
  node: TreeNode
  roadmapId: string
  onClose: () => void
  onReview: () => void
  onAccept: () => void
  onRemove: () => void
  onClearOverride: () => void
  isReviewing: boolean
  isRefreshing: boolean
}) {
  const qc = useQueryClient()
  const isOverridden = !!node.overrideStatus
  const [activeProposal, setActiveProposal] = useState<RoadmapProposal | null>(null)

  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000,
  })
  const jiraBaseUrl = systemConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''
  const jiraLink = (key: string) => jiraBaseUrl ? `${jiraBaseUrl}/browse/${key}` : undefined

  const improveMutation = useMutation<RoadmapProposal, Error>({
    mutationFn: () => api.post(`/roadmap/${roadmapId}/items/${node.issueKey}/improve`).then((r) => r.data),
    onSuccess: (proposal) => setActiveProposal(proposal),
  })

  const { data: proposals } = useQuery<RoadmapProposal[]>({
    queryKey: ['roadmap-proposals', roadmapId, node.issueKey],
    queryFn: () => api.get(`/roadmap/${roadmapId}/items/${node.issueKey}/proposals`).then((r) => r.data),
  })
  const draftCount = Array.isArray(proposals) ? proposals.filter((p) => p.status === 'DRAFT').length : 0

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-[420px] flex flex-col bg-[var(--color-cards-card-background)] border-l border-[var(--color-borders-border-primary)] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background-hover)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {jiraLink(node.issueKey) ? (
            <a
              href={jiraLink(node.issueKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono font-semibold text-[var(--color-fonts-font-color-brand)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {node.issueKey}
            </a>
          ) : (
            <span className="text-xs font-mono font-semibold text-[var(--color-fonts-font-color-brand)]">
              {node.issueKey}
            </span>
          )}
          {isRefreshing && <Loader2 size={11} className="animate-spin text-[var(--color-fonts-font-color-support)] shrink-0" />}
          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${TYPE_BG[node.issueType] ?? ''}`}>
            {TYPE_LABEL[node.issueType] ?? node.issueType}
          </span>
          {node.isStale && !isOverridden && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
              stale
            </span>
          )}
        </div>
        <Tooltip text="Close panel (Esc)">
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background)] transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </Tooltip>
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
              <ScoreBar score={node.complexityScore} reversed />
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
            <div className="p-3 rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background-hover)] border border-[var(--color-borders-border-primary)]">
              <p className="text-xs text-[var(--color-fonts-font-color-primary)] leading-relaxed whitespace-pre-wrap">
                {node.improvementSummary}
              </p>
            </div>
          </section>
        )}

        {/* Assignee / Reporter / Sprint */}
        {(node.assignee || node.reporter || node.sprintName) && (
          <section className="grid grid-cols-2 gap-x-4 gap-y-3">
            {node.assignee && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Assignee</p>
                <span className="text-xs text-[var(--color-fonts-font-color-primary)]">{node.assignee}</span>
              </div>
            )}
            {node.reporter && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Reporter</p>
                <span className="text-xs text-[var(--color-fonts-font-color-primary)]">{node.reporter}</span>
              </div>
            )}
            {node.sprintName && (
              <div className="col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">Sprint</p>
                <span className="text-xs text-[var(--color-fonts-font-color-primary)]">
                  {node.sprintName}
                  {node.sprintStart && node.sprintEnd && (
                    <span className="ml-2 text-[var(--color-fonts-font-color-support)]">
                      ({new Date(node.sprintStart).toLocaleDateString()} – {new Date(node.sprintEnd).toLocaleDateString()})
                    </span>
                  )}
                </span>
              </div>
            )}
          </section>
        )}

        {/* Hierarchy */}
        {(node.parentKey || node.grandparentKey) && (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1.5">Hierarchy</p>
            <div className="space-y-1.5">
              {node.grandparentKey && (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${TYPE_BG['EPIC']}`}>
                    {TYPE_LABEL['EPIC']}
                  </span>
                  {jiraLink(node.grandparentKey) ? (
                    <a href={jiraLink(node.grandparentKey)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[var(--color-fonts-font-color-brand)] hover:underline">
                      {node.grandparentKey}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-[var(--color-fonts-font-color-brand)]">{node.grandparentKey}</span>
                  )}
                </div>
              )}
              {node.parentKey && (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${TYPE_BG[node.issueType === 'USERSTORY' ? 'FEATURE' : 'EPIC']}`}>
                    {TYPE_LABEL[node.issueType === 'USERSTORY' ? 'FEATURE' : 'EPIC']}
                  </span>
                  {jiraLink(node.parentKey) ? (
                    <a href={jiraLink(node.parentKey)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-[var(--color-fonts-font-color-brand)] hover:underline">
                      {node.parentKey}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-[var(--color-fonts-font-color-brand)]">{node.parentKey}</span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background-hover)]">
        {/* Primary action row */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--color-borders-border-primary)]">
          {isOverridden ? (
            <Tooltip text="Remove override and re-enable AI-based scoring">
              <button
                onClick={onClearOverride}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
              >
                <RotateCcw size={11} />
                Undo Override
              </button>
            </Tooltip>
          ) : (
            <>
              <Tooltip text="Run AI readiness & complexity review for this issue">
                <button
                  onClick={onReview}
                  disabled={isReviewing}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {isReviewing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Review
                </button>
              </Tooltip>
              <div className="w-px h-4 bg-[var(--color-borders-border-primary)] mx-0.5" />
              <Tooltip text="Mark as Accepted — override AI score, include in delivery metrics">
                <button
                  onClick={onAccept}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md text-[var(--color-tags-font-success)] hover:bg-[var(--color-tags-success-background)] transition-colors"
                >
                  <CheckCircle2 size={11} />
                  Accept
                </button>
              </Tooltip>
              <Tooltip text="Mark as Removed — exclude from roadmap metrics">
                <button
                  onClick={onRemove}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors"
                >
                  <MinusCircle size={11} />
                  Remove
                </button>
              </Tooltip>
            </>
          )}
        </div>

        {/* AI row */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Tooltip text="Generate an AI-improved rewrite of this issue.\nUses codebase knowledge & Jira context if products are linked.">
            <button
              onClick={() => improveMutation.mutate()}
              disabled={improveMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 dark:hover:bg-violet-900/40 disabled:opacity-50 transition-colors"
            >
              {improveMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              {improveMutation.isPending ? 'Generating…' : 'Improve with AI'}
            </button>
          </Tooltip>

          {draftCount > 0 && (
            <Tooltip text="View or edit AI-generated improvement proposals">
              <button
                onClick={() => {
                  const draft = proposals?.find((p) => p.status === 'DRAFT')
                  if (draft) setActiveProposal(draft)
                }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40 transition-colors"
              >
                {draftCount} draft{draftCount !== 1 ? 's' : ''}
              </button>
            </Tooltip>
          )}

          {improveMutation.isError && (
            <span className="text-[10px] text-[var(--color-tags-font-critical)] truncate">
              Generation failed
            </span>
          )}
        </div>
      </div>

      {/* Proposal modal */}
      {activeProposal && (
        <ProposalModal
          proposal={activeProposal}
          roadmapId={roadmapId}
          onClose={() => {
            setActiveProposal(null)
            qc.invalidateQueries({ queryKey: ['roadmap-proposals', roadmapId, node.issueKey] })
          }}
        />
      )}
    </aside>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RoadmapDetail({ roadmapId }: { roadmapId: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [viewMode, setViewMode] = useState<'table' | 'sprint'>('table')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('issueKey')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filters, setFilters] = useState<FilterState>({ issueKey: '', issueType: '', readiness: '', summary: '' })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const { data: roadmap } = useQuery<Roadmap>({
    queryKey: ['roadmap', roadmapId],
    queryFn: () => api.get(`/roadmap/${roadmapId}`).then((r) => r.data),
  })

  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000,
  })
  const jiraBaseUrl = systemConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

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

  const refreshMutation = useMutation({
    mutationFn: (issueKey: string) => api.post(`/roadmap/${roadmapId}/items/${issueKey}/refresh`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] }),
  })

  const isTableView = viewMode === 'table'
  const isSprintView = viewMode === 'sprint'
  const isPolling = items.length > 0 && hasActiveJobs(items)
  const activeReviews = items.filter((i) => !i.reviewedAt && !i.overrideStatus).length

  return (
    <main>
      <PageHeader
        title={roadmap?.name ?? 'Roadmap'}
        subtitle={roadmap ? `Jira label: ${roadmap.label}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Tooltip text="Back to roadmaps list">
              <button
                onClick={() => navigate({ to: '/metrics/roadmap' })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            </Tooltip>
            <Tooltip text="Re-fetch all issues from Jira and update the item list">
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 transition-colors"
              >
                {syncMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Sync from Jira
              </button>
            </Tooltip>
            <div className="flex rounded-[var(--border-radius-button-small)] overflow-hidden">
              <Tooltip text={items.length === 0 ? 'Sync from Jira first' : 'Queue AI reviews for items changed since last review'}>
                <button
                  onClick={() => reviewAllMutation.mutate(false)}
                  disabled={reviewAllMutation.isPending || items.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
                >
                  {reviewAllMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
                  Review Changed
                </button>
              </Tooltip>
              <Tooltip text="Force re-review of ALL items regardless of changes">
                <button
                  onClick={() => reviewAllMutation.mutate(true)}
                  disabled={reviewAllMutation.isPending || items.length === 0}
                  className="px-2 py-1.5 text-xs bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors border-l border-white/30"
                >
                  All
                </button>
              </Tooltip>
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
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)] w-44"
        />
        <select
          value={filters.issueType}
          onChange={(e) => setFilter('issueType', e.target.value)}
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)]"
        >
          <option value="">All types</option>
          <option value="EPIC">Epic</option>
          <option value="FEATURE">Feature</option>
          <option value="USERSTORY">User Story</option>
        </select>
        <select
          value={filters.readiness}
          onChange={(e) => setFilter('readiness', e.target.value)}
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)]"
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
          className="px-3 py-1.5 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)] flex-1 min-w-40"
        />
      </div>

      {/* Sprint Gantt view */}
      {isSprintView && <SprintGanttView roadmapId={roadmapId} />}

      {/* Table */}
      {isTableView && <div className="rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] bg-[var(--color-cards-card-background)]">

        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-tables-table-header-stroke)]">
          <div className="flex items-center gap-2">
            {roadmap?.name && (
              <span className="font-semibold text-[var(--color-fonts-font-color-primary)]">
                {roadmap.name}
              </span>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
              {filteredRows.length} item{filteredRows.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* View mode toggle */}
            <div className="flex rounded-[var(--border-radius-button-small)] overflow-hidden border border-[var(--color-borders-border-primary)]">
              <Tooltip text="Show issues as a hierarchical tree table">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors ${
                    isTableView
                      ? 'bg-[var(--color-buttons-button-primary)] text-white'
                      : 'bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)]'
                  }`}
                >
                  <Table2 size={11} />
                  Table
                </button>
              </Tooltip>
              <Tooltip text="Show features and user stories as a Gantt chart grouped by sprint">
                <button
                  onClick={() => setViewMode('sprint')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border-l border-[var(--color-borders-border-primary)] ${
                    isSprintView
                      ? 'bg-[var(--color-buttons-button-primary)] text-white'
                      : 'bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)]'
                  }`}
                >
                  <CalendarDays size={11} />
                  Sprint
                </button>
              </Tooltip>
            </div>
            {isTableView && (
              <>
                <Tooltip text="Expand all Epics and Features to show full hierarchy">
                  <button
                    onClick={() => setExpandedKeys(new Set(allKeys(sortedRoots)))}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                  >
                    <ChevronsDown size={12} />
                    Expand All
                  </button>
                </Tooltip>
                <Tooltip text="Collapse all rows to show only top-level Epics">
                  <button
                    onClick={() => setExpandedKeys(new Set())}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                  >
                    <ChevronsUp size={12} />
                    Collapse All
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        <div className="overflow-auto max-h-[calc(100vh-18rem)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('issueKey')}
                >
                  <Tooltip text="Jira issue key">
                    <span className="flex items-center gap-1">
                      Issue <SortIcon field="issueKey" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none"
                  onClick={() => toggleSort('issueType')}
                >
                  <Tooltip text="Epic → Feature → User Story hierarchy level">
                    <span className="flex items-center gap-1">
                      Type <SortIcon field="issueType" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none"
                  onClick={() => toggleSort('summary')}
                >
                  <Tooltip text="Issue title from Jira">
                    <span className="flex items-center gap-1">
                      Name <SortIcon field="summary" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  <Tooltip text="Jira workflow status mapped to: New / In Progress / QA / Closed">
                    <span>Status</span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('readinessScore')}
                >
                  <Tooltip text="AI readiness score (0–100) — measures how well-defined this item is for its hierarchy level">
                    <span className="flex items-center gap-1">
                      Readiness <SortIcon field="readinessScore" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  <Tooltip text="AI complexity estimate (0–100). Lower = simpler and less risky. Higher = more effort, uncertainty, or cross-team dependencies.">
                    <span>Complexity</span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  <Tooltip text={"Weighted rollup of child readiness scores.\nFormula: Σ(child.readiness × child.complexity) / Σ(child.complexity)\nFalls back to simple average when all complexity = 0.\n0 when item has no children."}>
                    <span>Aggregate</span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  <Tooltip text="Ready when aggregate score ≥ threshold (default 70). Configured in system settings.">
                    <span className="flex items-center gap-1">
                      <Truck size={11} />
                      Delivery
                    </span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  <Tooltip text="Manual ACCEPTED or REMOVED status set by a user, bypassing the AI score">
                    <span>Override</span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  <Tooltip text="Run AI review · Accept · Mark as removed">
                    <span>Actions</span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-1.5">
                        <div className="h-3 skeleton-shimmer rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]">
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
                    jiraBaseUrl={jiraBaseUrl}
                    onToggle={() => toggleExpand(node.issueKey)}
                    onRowClick={() => {
                      const newKey = selectedKey === node.issueKey ? null : node.issueKey
                      setSelectedKey(newKey)
                      if (newKey) refreshMutation.mutate(newKey)
                    }}
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
      </div>}

      {/* Detail panel */}
      {selectedKey && selectedNode && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedKey(null)}
          />
          <ItemDetailPanel
            node={selectedNode}
            roadmapId={roadmapId}
            onClose={() => setSelectedKey(null)}
            onReview={() => reviewOneMutation.mutate(selectedNode.issueKey)}
            onAccept={() => overrideMutation.mutate({ issueKey: selectedNode.issueKey, status: 'ACCEPTED' })}
            onRemove={() => overrideMutation.mutate({ issueKey: selectedNode.issueKey, status: 'REMOVED' })}
            onClearOverride={() => clearOverrideMutation.mutate(selectedNode.issueKey)}
            isReviewing={reviewOneMutation.isPending && reviewOneMutation.variables === selectedNode.issueKey}
            isRefreshing={refreshMutation.isPending && refreshMutation.variables === selectedNode.issueKey}
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
  jiraBaseUrl,
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
  jiraBaseUrl: string
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
      <td className="px-3 py-1.5 whitespace-nowrap">
        <div className="flex items-center gap-0.5" style={{ paddingLeft: `${depth * 12}px` }}>
          {hasChildren ? (
            <Tooltip text={expanded ? 'Collapse children' : 'Expand children'}>
              <button
                onClick={(e) => { e.stopPropagation(); onToggle() }}
                className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] shrink-0"
              >
                {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            </Tooltip>
          ) : (
            <span className="w-[16px] shrink-0" />
          )}
          {jiraBaseUrl ? (
            <a
              href={`${jiraBaseUrl}/browse/${node.issueKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[var(--color-fonts-font-color-brand)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {node.issueKey}
            </a>
          ) : (
            <span className="font-mono text-[var(--color-fonts-font-color-brand)]">{node.issueKey}</span>
          )}
        </div>
      </td>

      {/* Type */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] ${typeBg[node.issueType] ?? ''}`}>
          {TYPE_LABEL[node.issueType] ?? node.issueType}
        </span>
      </td>

      {/* Summary */}
      <td className="px-3 py-1.5 max-w-xs">
        <div className="flex items-center gap-1.5">
          <p className="text-[var(--color-fonts-font-color-primary)] truncate">
            {node.summary}
          </p>
          {node.isStale && !isOverridden && (
            <span
              title={`Jira updated ${node.jiraModifiedAt ? new Date(node.jiraModifiedAt).toLocaleString() : ''} — review may be outdated`}
              className="shrink-0 inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]"
            >
              stale
            </span>
          )}
        </div>
      </td>

      {/* Jira Status */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        <StatusBadge status={node.jiraStatus} />
      </td>

      {/* Readiness */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        {isPending ? (
          <div className="flex items-center gap-1 text-[var(--color-fonts-font-color-support)]">
            <Loader2 size={10} className="animate-spin" />
            Pending
          </div>
        ) : isOverridden ? (
          <OverrideBadge status={node.overrideStatus} />
        ) : (
          <ReadinessBadge label={node.readinessLabel} score={node.readinessScore} showScore />
        )}
      </td>

      {/* Complexity */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        <ScoreBar score={node.complexityScore} title="Complexity score" reversed />
      </td>

      {/* Aggregate */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        <ScoreBar score={node.aggregateScore} title="Aggregate readiness score" />
      </td>

      {/* Delivery Ready */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        {node.readyForDelivery == null ? (
          <span className="text-[var(--color-fonts-font-color-support)]">—</span>
        ) : node.readyForDelivery ? (
          <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
            <CheckCircle2 size={10} />
            Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
            <XCircle size={10} />
            Not ready
          </span>
        )}
      </td>

      {/* Override status */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        <OverrideBadge status={node.overrideStatus} />
      </td>

      {/* Actions — stopPropagation so clicking buttons doesn't open the detail panel */}
      <td className="px-3 py-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          {isOverridden ? (
            <Tooltip text="Undo override">
              <button
                onClick={onClearOverride}
                className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
              >
                <RotateCcw size={12} />
              </button>
            </Tooltip>
          ) : (
            <>
              <Tooltip text="Run AI review">
                <button
                  onClick={onReview}
                  disabled={isReviewing}
                  className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-buttons-button-primary)] hover:bg-[var(--color-cards-card-background-hover)] disabled:opacity-50 transition-colors"
                >
                  {isReviewing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                </button>
              </Tooltip>
              <Tooltip text="Mark as Accepted">
                <button
                  onClick={onAccept}
                  className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-success)] hover:bg-[var(--color-tags-success-background)] transition-colors"
                >
                  <CheckCircle2 size={12} />
                </button>
              </Tooltip>
              <Tooltip text="Mark as Removed">
                <button
                  onClick={onRemove}
                  className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors"
                >
                  <MinusCircle size={12} />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
