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
  Info,
  Download,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Input } from '@/components/ui/Input'
import { Tooltip } from '@/components/ui/Tooltip'
import { TableCard } from '@/components/ui/TableCard'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb'
import { ReadinessBadge } from '@/components/roadmap/ReadinessBadge'
import { SprintGanttView } from '@/components/roadmap/SprintGanttView'
import { ProposalModal } from '@/components/roadmap/ProposalModal'
import api from '@/lib/api'
import { mcpProfilesApi, type SystemConfig } from '@/lib/mcpProfiles'
import type { Roadmap, RoadmapTreeItem, ItemOverrideStatus, RoadmapProposal, SystemSetting, ReviewTokenStats } from '@/types/api'

// ── Types ────────────────────────────────────────────────────────────────────

type SortField = 'issueKey' | 'issueType' | 'readinessScore' | 'summary' | 'jiraStatus' | 'complexityScore' | 'aggregateScore'
type SortDir = 'asc' | 'desc'

interface FilterState {
  issueKey: string
  issueType: string
  readiness: string
  summary: string
  assignee: string
  reporter: string
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
  const bar = (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 rounded-full bg-[var(--color-borders-border-primary)]">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span>{score}</span>
    </div>
  )
  return title ? <Tooltip text={title} position="bottom">{bar}</Tooltip> : bar
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />
  return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
}

// ── Review Confirmation Dialog ────────────────────────────────────────────────

// Approximate token budgets per item (low / high bounds)
const INPUT_TOKENS_LOW  = 1_500   // system prompt + compact context
const INPUT_TOKENS_HIGH = 3_000   // system prompt + rich description + attachments
const OUTPUT_TOKENS     = 400     // JSON response with scores + improvement text

// Fallback pricing when settings haven't loaded yet
const DEFAULT_INPUT_COST_PER_M  = 3.00
const DEFAULT_OUTPUT_COST_PER_M = 15.00

function formatCost(usd: number): string {
  if (usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(2)}`
}

// Minimum sample count before we trust actual averages over hardcoded estimates
const MIN_SAMPLE_TRUST = 5

function ReviewConfirmDialog({
  force,
  targets,
  modelName,
  inputCostPerM,
  outputCostPerM,
  tokenStats,
  isPending,
  onConfirm,
  onCancel,
}: {
  force: boolean
  targets: RoadmapTreeItem[]
  modelName: string
  inputCostPerM: number
  outputCostPerM: number
  tokenStats: ReviewTokenStats | undefined
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const epics    = targets.filter((i) => i.issueType === 'EPIC').length
  const features = targets.filter((i) => i.issueType === 'FEATURE').length
  const stories  = targets.filter((i) => i.issueType === 'USERSTORY').length
  const total    = targets.length

  // Per-type token resolution: use actual avg when we have enough samples, else use bounds
  const resolve = (type: 'REVIEW_EPIC' | 'REVIEW_FEATURE' | 'REVIEW_USERSTORY') => {
    const stat = tokenStats?.[type]
    const trusted = stat && stat.sampleCount >= MIN_SAMPLE_TRUST
    return {
      input:  trusted ? stat.avgInputTokens  : null,
      output: trusted ? stat.avgOutputTokens : null,
      sampleCount: stat?.sampleCount ?? 0,
    }
  }
  const epicStat    = resolve('REVIEW_EPIC')
  const featureStat = resolve('REVIEW_FEATURE')
  const storyStat   = resolve('REVIEW_USERSTORY')

  // Use actual averages where available; otherwise fall back to low/high bounds
  const computeCost = (inputAvg: number | null, count: number) => {
    if (inputAvg === null) return null
    return count * (inputAvg * inputCostPerM + OUTPUT_TOKENS * outputCostPerM) / 1_000_000
  }
  const computeTokens = (inputAvg: number | null, count: number) =>
    inputAvg === null ? null : count * (inputAvg + OUTPUT_TOKENS)

  const epicCost    = computeCost(epicStat.input, epics)
  const featureCost = computeCost(featureStat.input, features)
  const storyCost   = computeCost(storyStat.input, stories)
  const epicTokens  = computeTokens(epicStat.input, epics)
  const featureTokens = computeTokens(featureStat.input, features)
  const storyTokens = computeTokens(storyStat.input, stories)

  // Totals: if all types have actual data, show a single number; otherwise show a range
  const allActual = [epicCost, featureCost, storyCost].filter((_, i) => [epics, features, stories][i] > 0)
                      .every((v) => v !== null)
  const actualTotalTokens = allActual
    ? (epicTokens ?? 0) + (featureTokens ?? 0) + (storyTokens ?? 0)
    : null
  const actualTotalCost   = allActual
    ? (epicCost ?? 0) + (featureCost ?? 0) + (storyCost ?? 0)
    : null

  const lowTokens  = total * (INPUT_TOKENS_LOW  + OUTPUT_TOKENS)
  const highTokens = total * (INPUT_TOKENS_HIGH + OUTPUT_TOKENS)
  const lowCost    = total * (INPUT_TOKENS_LOW  * inputCostPerM + OUTPUT_TOKENS * outputCostPerM) / 1_000_000
  const highCost   = total * (INPUT_TOKENS_HIGH * inputCostPerM + OUTPUT_TOKENS * outputCostPerM) / 1_000_000

  const totalSamples = (tokenStats?.['REVIEW_EPIC']?.sampleCount ?? 0) +
                       (tokenStats?.['REVIEW_FEATURE']?.sampleCount ?? 0) +
                       (tokenStats?.['REVIEW_USERSTORY']?.sampleCount ?? 0)

  const fmtTokens = (n: number) =>
    n >= 1_000_000 ? `~${(n / 1_000_000).toFixed(1)}M` : `~${(n / 1_000).toFixed(0)}k`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[548px] rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-6">

        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
            <Layers size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              {force ? 'Review all items?' : 'Review changed items?'}
            </h2>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
              {force
                ? 'Every item will be sent to the AI model, regardless of changes.'
                : 'Only stale or unreviewed items will be sent to the AI model.'}
            </p>
          </div>
        </div>

        {total === 0 ? (
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-5">
            No items qualify for review.
          </p>
        ) : (
          <>
            {/* Item breakdown */}
            <div className="mb-4 rounded-lg border border-[var(--color-borders-border-primary)] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--color-cards-card-background-hover)] border-b border-[var(--color-borders-border-primary)]">
                    <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Type</th>
                    <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Items</th>
                  </tr>
                </thead>
                <tbody>
                  {epics > 0 && (
                    <tr className="border-b border-[var(--color-borders-border-primary)]">
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Epic</span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[var(--color-fonts-font-color-primary)] font-medium">{epics}</td>
                    </tr>
                  )}
                  {features > 0 && (
                    <tr className="border-b border-[var(--color-borders-border-primary)]">
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Feature</span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[var(--color-fonts-font-color-primary)] font-medium">{features}</td>
                    </tr>
                  )}
                  {stories > 0 && (
                    <tr className="border-b border-[var(--color-borders-border-primary)]">
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">Story</span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[var(--color-fonts-font-color-primary)] font-medium">{stories}</td>
                    </tr>
                  )}
                  <tr className="bg-[var(--color-cards-card-background-hover)]">
                    <td className="px-3 py-1.5 font-semibold text-[var(--color-fonts-font-color-primary)]">Total</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-[var(--color-fonts-font-color-primary)]">{total}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cost estimate */}
            <div className="mb-5 rounded-lg border border-[var(--color-borders-border-primary)] p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-2">
                {allActual ? 'Projected cost' : 'Estimated cost'} ({modelName})
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-fonts-font-color-support)]">Tokens</span>
                <span className="text-[var(--color-fonts-font-color-primary)] font-medium">
                  {actualTotalTokens !== null
                    ? fmtTokens(actualTotalTokens)
                    : `${fmtTokens(lowTokens)} – ${fmtTokens(highTokens)}`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-fonts-font-color-support)]">Cost</span>
                <span className="text-[var(--color-fonts-font-color-primary)] font-medium">
                  {actualTotalCost !== null
                    ? formatCost(actualTotalCost)
                    : `${formatCost(lowCost)} – ${formatCost(highCost)}`}
                </span>
              </div>
              <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-[var(--color-borders-border-primary)]">
                <Info size={11} className="shrink-0 mt-0.5 text-[var(--color-fonts-font-color-support)]" />
                <p className="text-[10px] text-[var(--color-fonts-font-color-support)] leading-relaxed">
                  {totalSamples >= MIN_SAMPLE_TRUST
                    ? `Based on averages from ${totalSamples} past review${totalSamples !== 1 ? 's' : ''}.`
                    : `Estimate based on ~${INPUT_TOKENS_LOW.toLocaleString()}–${INPUT_TOKENS_HIGH.toLocaleString()} input + ~${OUTPUT_TOKENS} output tokens per item.`}
                  {' '}Actual cost varies with issue description length.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || total === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isPending ? 'Queueing…' : `Review ${total} item${total !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
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
  items,
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
  items: RoadmapTreeItem[]
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
      <div className="shrink-0 border-b border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background-hover)]">
        {/* Main row: key · type · stale · close */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
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

        {/* Hierarchy breadcrumb — current → parent → grandparent (most specific first) */}
        {(() => {
          const gpNode     = node.grandparentKey ? items.find((i) => i.issueKey === node.grandparentKey) : undefined
          const pNode      = node.parentKey      ? items.find((i) => i.issueKey === node.parentKey)      : undefined
          const parentType = node.issueType === 'USERSTORY' ? 'FEATURE' : 'EPIC'

          const crumbs: BreadcrumbItem[] = [
            {
              label:   node.issueKey,
              badge:   { text: TYPE_LABEL[node.issueType] ?? node.issueType, className: TYPE_BG[node.issueType] ?? '' },
              tooltip: node.summary,
              href:    jiraLink(node.issueKey) ?? undefined,
            },
            ...(node.parentKey ? [{
              label:   node.parentKey,
              badge:   { text: TYPE_LABEL[parentType], className: TYPE_BG[parentType] },
              tooltip: pNode?.summary,
              href:    jiraLink(node.parentKey) ?? undefined,
            }] : []),
            ...(node.grandparentKey ? [{
              label:   node.grandparentKey,
              badge:   { text: TYPE_LABEL['EPIC'], className: TYPE_BG['EPIC'] },
              tooltip: gpNode?.summary,
              href:    jiraLink(node.grandparentKey) ?? undefined,
            }] : []),
          ]

          return (
            <div className="px-4 pb-2.5">
              <Breadcrumb items={crumbs} />
            </div>
          )
        })()}
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

        {/* Scores — three columns side by side */}
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-2">Scores</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-[var(--color-fonts-font-color-support)] mb-1.5">Readiness</p>
              <ScoreBar
                score={node.readinessScore}
                title={[
                  { poor: 'Poor', needs_refinement: 'Needs Refinement', ready_with_minor_improvements: 'Minor Improvements', fully_ready: 'Fully Ready' }[node.readinessLabel as string],
                  node.readinessScore != null && `Score: ${node.readinessScore}`,
                  'Higher is better',
                ].filter(Boolean).join('\n')}
              />
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-fonts-font-color-support)] mb-1.5">Complexity</p>
              <ScoreBar
                score={node.complexityScore}
                reversed
                title={node.complexityScore != null ? `Complexity: ${node.complexityScore}\nHigher means more complex` : undefined}
              />
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-fonts-font-color-support)] mb-1.5">Aggregate</p>
              <ScoreBar
                score={node.aggregateScore}
                title={node.aggregateScore != null ? `Aggregate: ${node.aggregateScore}\nOverall readiness score` : undefined}
              />
            </div>
          </div>
        </section>

        {/* AI Suggestions */}
        {node.improvementSummary && !isOverridden && (
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1.5">AI Suggestions</p>
            <div className="p-3 rounded-lg bg-[var(--color-cards-card-background-hover)] border border-[var(--color-borders-border-primary)]">
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

      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background-hover)]">
        <div className="flex items-center gap-1 px-3 py-2">
          {isOverridden ? (
            <>
              <Tooltip text="Remove override and re-enable AI-based scoring">
                <Button size="xs" variant="secondary" icon={<RotateCcw size={11} />} onClick={onClearOverride}>
                  Undo Override
                </Button>
              </Tooltip>
              <Tooltip text="Generate an AI-improved rewrite of this issue.\nUses codebase knowledge & Jira context if products are linked.">
                <Button
                  size="xs"
                  variant="ai"
                  loading={improveMutation.isPending}
                  icon={<Wand2 size={11} />}
                  onClick={() => improveMutation.mutate()}
                  disabled={improveMutation.isPending}
                >
                  {improveMutation.isPending ? 'Generating…' : 'Improve with AI'}
                </Button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip text="Run AI readiness & complexity review for this issue">
                <Button size="xs" variant="primary" loading={isReviewing} icon={<RefreshCw size={11} />} onClick={onReview} disabled={isReviewing}>
                  Review
                </Button>
              </Tooltip>
              <Tooltip text="Generate an AI-improved rewrite of this issue.\nUses codebase knowledge & Jira context if products are linked.">
                <Button
                  size="xs"
                  variant="ai"
                  loading={improveMutation.isPending}
                  icon={<Wand2 size={11} />}
                  onClick={() => improveMutation.mutate()}
                  disabled={improveMutation.isPending}
                >
                  {improveMutation.isPending ? 'Generating…' : 'Improve with AI'}
                </Button>
              </Tooltip>
              <div className="ml-auto w-px h-4 bg-[var(--color-borders-border-primary)] mx-0.5" />
              <Tooltip text="Mark as Accepted — override AI score, include in delivery metrics">
                <Button size="xs" variant="success" icon={<CheckCircle2 size={11} />} onClick={onAccept}>
                  Accept
                </Button>
              </Tooltip>
              <Tooltip text="Mark as Removed — exclude from roadmap metrics">
                <Button size="xs" variant="danger" icon={<MinusCircle size={11} />} onClick={onRemove}>
                  Remove
                </Button>
              </Tooltip>
            </>
          )}

          {draftCount > 0 && (
            <Tooltip text="View or edit AI-generated improvement proposals">
              <Button
                size="xs"
                variant="ai"
                onClick={() => {
                  const draft = proposals?.find((p) => p.status === 'DRAFT')
                  if (draft) setActiveProposal(draft)
                }}
              >
                {draftCount} draft{draftCount !== 1 ? 's' : ''}
              </Button>
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
  const [filters, setFilters] = useState<FilterState>({ issueKey: '', issueType: '', readiness: '', summary: '', assignee: '', reporter: '' })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [reviewConfirm, setReviewConfirm] = useState<{ force: boolean } | null>(null)

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

  const { data: allSettings } = useQuery<SystemSetting[]>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data).catch(() => []),
    staleTime: 5 * 60 * 1000,
  })
  const getSetting = (key: string, fallback: string) =>
    allSettings?.find((s) => s.key === key)?.value ?? fallback
  const aiModelName    = getSetting('anthropic.model', 'claude-sonnet-4-20250514')
  const inputCostPerM  = parseFloat(getSetting('anthropic.pricing.input-per-million',  String(DEFAULT_INPUT_COST_PER_M)))
  const outputCostPerM = parseFloat(getSetting('anthropic.pricing.output-per-million', String(DEFAULT_OUTPUT_COST_PER_M)))

  const { data: tokenStats } = useQuery<ReviewTokenStats>({
    queryKey: ['roadmap-review-token-stats'],
    queryFn: () => api.get('/roadmap/review-token-stats').then((r) => r.data).catch(() => ({})),
    staleTime: 5 * 60 * 1000,
  })

  const { data: activeReviewCount = 0 } = useQuery<number>({
    queryKey: ['roadmap-active-reviews', roadmapId],
    queryFn: () =>
      api.get(`/roadmap/${roadmapId}/active-review-count`).then((r) => r.data?.count ?? 0).catch(() => 0),
    refetchInterval: (q) => ((q.state.data ?? 0) > 0 ? 5_000 : 30_000),
  })

  const { data: treeItems, isLoading } = useQuery<RoadmapTreeItem[]>({
    queryKey: ['roadmap-tree', roadmapId],
    queryFn: () => api.get(`/roadmap/${roadmapId}/tree`).then((r) => r.data).catch(() => []),
    refetchInterval: activeReviewCount > 0 ? 5_000 : 30_000,
  })

  const items = Array.isArray(treeItems) ? treeItems : []
  const tree = useMemo(() => buildTree(items), [items])

  const reviewTargets = useMemo(() => {
    if (!reviewConfirm) return []
    return reviewConfirm.force
      ? items.filter((i) => !i.overrideStatus)
      : items.filter((i) => !i.overrideStatus && (i.isStale || !i.reviewedAt))
  }, [reviewConfirm, items])

  const assigneeOptions = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => { if (i.assignee) s.add(i.assignee) })
    return Array.from(s).sort()
  }, [items])

  const reporterOptions = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => { if (i.reporter) s.add(i.reporter) })
    return Array.from(s).sort()
  }, [items])

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
      if (sortField === 'readinessScore')  { av = a.readinessScore  ?? -1; bv = b.readinessScore  ?? -1 }
      else if (sortField === 'complexityScore') { av = a.complexityScore ?? -1; bv = b.complexityScore ?? -1 }
      else if (sortField === 'aggregateScore')  { av = a.aggregateScore  ?? -1; bv = b.aggregateScore  ?? -1 }
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
      if (filters.assignee && node.assignee !== filters.assignee) return false
      if (filters.reporter && node.reporter !== filters.reporter) return false
      return true
    })
  }, [flatRows, filters])

  function handleExport() {
    const esc = (v: string | number | boolean | undefined | null) => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    const headers = ['Key', 'Type', 'Parent', 'Grandparent', 'Summary', 'Status',
      'Readiness Label', 'Readiness Score', 'Complexity', 'Aggregate',
      'Ready for Delivery', 'Assignee', 'Reporter', 'Sprint', 'Override']
    const rows = filteredRows.map(({ node: n }) =>
      [n.issueKey, n.issueType, n.parentKey, n.grandparentKey, n.summary,
       n.jiraStatus, n.readinessLabel, n.readinessScore, n.complexityScore,
       n.aggregateScore, n.readyForDelivery, n.assignee, n.reporter,
       n.sprintName, n.overrideStatus].map(esc).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${roadmap?.name ?? 'roadmap'}-export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] })
      qc.invalidateQueries({ queryKey: ['roadmap-active-reviews', roadmapId] })
    },
  })

  const reviewOneMutation = useMutation({
    mutationFn: (issueKey: string) => api.post(`/roadmap/${roadmapId}/review/${issueKey}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmap-tree', roadmapId] })
      qc.invalidateQueries({ queryKey: ['roadmap-active-reviews', roadmapId] })
    },
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
  const isPolling = activeReviewCount > 0
  const activeReviews = activeReviewCount

  return (
    <main>
      <PageHeader
        title="Roadmap"
        actions={
          <div className="flex items-center gap-2">
            <Tooltip text="Back to roadmaps list" position="bottom">
              <Button size="md" variant="secondary" icon={<ChevronLeft size={13} />} onClick={() => navigate({ to: '/metrics/roadmap' })}>
                Back
              </Button>
            </Tooltip>
            <Tooltip text="Re-fetch all issues from Jira and update the item list" position="bottom">
              <Button size="md" variant="secondary" loading={syncMutation.isPending} icon={<RefreshCw size={13} />} onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                Sync from Jira
              </Button>
            </Tooltip>
            <div className="flex rounded overflow-hidden">
              <Tooltip text={items.length === 0 ? 'Sync from Jira first' : 'Queue AI reviews for items changed since last review'} position="bottom">
                <Button size="md" variant="primary" loading={reviewAllMutation.isPending} icon={<Layers size={13} />} onClick={() => setReviewConfirm({ force: false })} disabled={reviewAllMutation.isPending || items.length === 0} className="rounded-r-none">
                  Review Changed
                </Button>
              </Tooltip>
              <Tooltip text="Force re-review of ALL items regardless of changes" position="bottom">
                <Button size="md" variant="primary" onClick={() => setReviewConfirm({ force: true })} disabled={reviewAllMutation.isPending || items.length === 0} className="rounded-l-none border-l border-white/30 px-2">
                  All
                </Button>
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
        <div className="mb-4 flex items-start gap-3 p-4 rounded-lg bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)] text-sm">
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
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          placeholder="Filter by issue key…"
          value={filters.issueKey}
          onChange={(e) => setFilter('issueKey', e.target.value)}
          className="w-44"
        />
        <FilterSelect
          value={filters.issueType}
          onChange={(v) => setFilter('issueType', v)}
          placeholder="All types"
          options={[
            { value: 'EPIC',      label: 'Epic',       dotClass: 'bg-violet-500' },
            { value: 'FEATURE',   label: 'Feature',    dotClass: 'bg-blue-500' },
            { value: 'USERSTORY', label: 'User Story', dotClass: 'bg-gray-400' },
          ]}
        />
        <FilterSelect
          value={filters.readiness}
          onChange={(v) => setFilter('readiness', v)}
          placeholder="All readiness"
          options={[
            { value: 'poor',                              label: 'Poor',              dotClass: 'bg-red-500' },
            { value: 'needs_refinement',                  label: 'Needs Refinement',  dotClass: 'bg-orange-500' },
            { value: 'ready_with_minor_improvements',     label: 'Minor Improvements', dotClass: 'bg-yellow-500' },
            { value: 'fully_ready',                       label: 'Fully Ready',       dotClass: 'bg-green-500' },
          ]}
        />
        <Input
          placeholder="Filter by name…"
          value={filters.summary}
          onChange={(e) => setFilter('summary', e.target.value)}
          className="flex-1 min-w-40"
        />
        {assigneeOptions.length > 0 && (
          <FilterSelect
            value={filters.assignee}
            onChange={(v) => setFilter('assignee', v)}
            placeholder="All assignees"
            options={assigneeOptions.map((a) => ({ value: a, label: a }))}
          />
        )}
        {reporterOptions.length > 0 && (
          <FilterSelect
            value={filters.reporter}
            onChange={(v) => setFilter('reporter', v)}
            placeholder="All reporters"
            options={reporterOptions.map((r) => ({ value: r, label: r }))}
          />
        )}
        {/* View mode toggle */}
        <div className="ml-auto flex rounded overflow-hidden border border-[var(--color-cards-card-stroke)]">
          <Tooltip text="Show issues as a hierarchical tree table" position="bottom">
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
          <Tooltip text="Show features and user stories as a Gantt chart grouped by sprint" position="bottom">
            <button
              onClick={() => setViewMode('sprint')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border-l border-[var(--color-cards-card-stroke)] ${
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
      </div>

      {/* Content area: table/gantt + non-modal detail panel side by side */}
      <div className="flex items-start">
        <div className="flex-1 min-w-0">

      {/* Sprint Gantt view */}
      {isSprintView && <SprintGanttView roadmapId={roadmapId} />}

      {/* Table */}
      {isTableView && <TableCard
        title={roadmap?.name ?? '…'}
        subtitle={`${filteredRows.length} item${filteredRows.length !== 1 ? 's' : ''}`}
        toolbar={
          <>
            <Tooltip text="Expand all Epics and Features to show full hierarchy" position="bottom">
              <Button size="sm" variant="secondary" icon={<ChevronsDown size={12} />} onClick={() => setExpandedKeys(new Set(allKeys(sortedRoots)))}>
                Expand All
              </Button>
            </Tooltip>
            <Tooltip text="Collapse all rows to show only top-level Epics" position="bottom">
              <Button size="sm" variant="secondary" icon={<ChevronsUp size={12} />} onClick={() => setExpandedKeys(new Set())}>
                Collapse All
              </Button>
            </Tooltip>
            <Tooltip text="Export visible rows to CSV" position="bottom">
              <Button size="sm" variant="secondary" icon={<Download size={12} />} onClick={handleExport}>
                Export
              </Button>
            </Tooltip>
          </>
        }
      >
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('issueKey')}
                >
                  <Tooltip text="Jira issue key" position="bottom">
                    <span className="flex items-center gap-1">
                      Issue <SortIcon field="issueKey" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none"
                  onClick={() => toggleSort('issueType')}
                >
                  <Tooltip text="Epic → Feature → User Story hierarchy level" position="bottom">
                    <span className="flex items-center gap-1">
                      Type <SortIcon field="issueType" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none"
                  onClick={() => toggleSort('summary')}
                >
                  <Tooltip text="Issue title from Jira" position="bottom">
                    <span className="flex items-center gap-1">
                      Name <SortIcon field="summary" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('jiraStatus')}
                >
                  <Tooltip text="Jira workflow status mapped to: New / In Progress / QA / Closed" position="bottom">
                    <span className="flex items-center gap-1">
                      Status <SortIcon field="jiraStatus" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('readinessScore')}
                >
                  <Tooltip text="AI readiness score (0–100) — measures how well-defined this item is for its hierarchy level" position="bottom">
                    <span className="flex items-center gap-1">
                      Readiness <SortIcon field="readinessScore" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('complexityScore')}
                >
                  <Tooltip text="AI complexity estimate (0–100). Lower = simpler and less risky. Higher = more effort, uncertainty, or cross-team dependencies." position="bottom">
                    <span className="flex items-center gap-1">
                      Complexity <SortIcon field="complexityScore" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] select-none whitespace-nowrap"
                  onClick={() => toggleSort('aggregateScore')}
                >
                  <Tooltip text={"Weighted rollup of child readiness scores.\nFormula: Σ(child.readiness × child.complexity) / Σ(child.complexity)\nFalls back to simple average when all complexity = 0.\n0 when item has no children."} position="bottom">
                    <span className="flex items-center gap-1">
                      Aggregate <SortIcon field="aggregateScore" sortField={sortField} sortDir={sortDir} />
                    </span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  <Tooltip text="Ready when aggregate score ≥ threshold (default 70). Configured in system settings." position="bottom">
                    <span className="flex items-center gap-1">
                      <Truck size={11} />
                      Delivery
                    </span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  <Tooltip text="Manual ACCEPTED or REMOVED status set by a user, bypassing the AI score" position="bottom">
                    <span>Override</span>
                  </Tooltip>
                </th>
                <th className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  <Tooltip text="Run AI review · Accept · Mark as removed" position="bottom">
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
      </TableCard>}

        </div>{/* end flex-1 table column */}

        {/* Non-modal detail panel — sticky alongside the table */}
        {selectedKey && selectedNode && (
          <div className="w-[420px] shrink-0 sticky top-0 self-start h-screen overflow-hidden">
            <ItemDetailPanel
              node={selectedNode}
              roadmapId={roadmapId}
              items={items}
              onClose={() => setSelectedKey(null)}
              onReview={() => reviewOneMutation.mutate(selectedNode.issueKey)}
              onAccept={() => overrideMutation.mutate({ issueKey: selectedNode.issueKey, status: 'ACCEPTED' })}
              onRemove={() => overrideMutation.mutate({ issueKey: selectedNode.issueKey, status: 'REMOVED' })}
              onClearOverride={() => clearOverrideMutation.mutate(selectedNode.issueKey)}
              isReviewing={reviewOneMutation.isPending && reviewOneMutation.variables === selectedNode.issueKey}
              isRefreshing={refreshMutation.isPending && refreshMutation.variables === selectedNode.issueKey}
            />
          </div>
        )}
      </div>{/* end flex row */}

      {/* Review confirmation dialog */}
      {reviewConfirm && (
        <ReviewConfirmDialog
          force={reviewConfirm.force}
          targets={reviewTargets}
          modelName={aiModelName}
          inputCostPerM={inputCostPerM}
          outputCostPerM={outputCostPerM}
          tokenStats={tokenStats}
          isPending={reviewAllMutation.isPending}
          onConfirm={() => {
            reviewAllMutation.mutate(reviewConfirm.force)
            setReviewConfirm(null)
          }}
          onCancel={() => setReviewConfirm(null)}
        />
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
