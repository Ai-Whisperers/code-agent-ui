import { Fragment, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from 'recharts'
import {
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Loader2,
} from 'lucide-react'
import { ReadinessBadge } from '@/components/scope/ReadinessBadge'
import { JiraIssueLink } from '@/components/ui/JiraIssueLink'
import { IssueTypeIcon } from '@/components/ui/IssueTypeIcon'
import { TableCard } from '@/components/ui/TableCard'
import { Select } from '@/components/ui/Select'
import { mcpProfilesApi, type SystemConfig } from '@/lib/mcpProfiles'
import api from '@/lib/api'
import type { Scope, QaReadinessResponse, ScopeTreeItem, ReadinessLabel } from '@/types/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = 'readinessScore' | 'aggregateScore' | 'readyForDelivery' | 'jiraStatus'
type SortDir = 'asc' | 'desc'

interface FeatureRow {
  feature: ScopeTreeItem
  stories: ScopeTreeItem[]
  storyStats: { total: number; ready: number; reviewed: number }
}

// ── KPI card ─────────────────────────────────────────────────────────────────

type KpiVariant = 'default' | 'success' | 'warning' | 'danger'

const VARIANT_BORDER: Record<KpiVariant, string> = {
  default:  'border-[var(--color-cards-card-stroke)]',
  success:  'border-[var(--color-tags-success-background)]',
  warning:  'border-[var(--color-tags-attention-background)]',
  danger:   'border-[var(--color-tags-critical-background)]',
}
const VARIANT_BG: Record<KpiVariant, string> = {
  default:  'var(--color-cards-card-background)',
  success:  'var(--color-tags-success-background)',
  warning:  'var(--color-tags-attention-background)',
  danger:   'var(--color-tags-critical-background)',
}
const VARIANT_VALUE: Record<KpiVariant, string> = {
  default: 'text-[var(--color-fonts-font-color-headings)]',
  success: 'text-[var(--color-tags-font-success)]',
  warning: 'text-[var(--color-tags-font-attention)]',
  danger:  'text-[var(--color-tags-font-critical)]',
}
const VARIANT_ICON: Record<KpiVariant, string> = {
  default: 'text-[var(--color-fonts-font-color-brand)]',
  success: 'text-[var(--color-tags-font-success)]',
  warning: 'text-[var(--color-tags-font-attention)]',
  danger:  'text-[var(--color-tags-font-critical)]',
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  variant?: KpiVariant
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] transition-shadow hover:shadow-md ${VARIANT_BORDER[variant]}`}
      style={{ background: VARIANT_BG[variant] }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">
          {label}
        </span>
        <span className={`h-5 w-5 ${VARIANT_ICON[variant]}`}>{icon}</span>
      </div>
      <div>
        <p className={`text-3xl font-bold tabular-nums ${VARIANT_VALUE[variant]}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-[var(--color-fonts-font-color-support)]">{sub}</p>}
      </div>
    </div>
  )
}

function gateVariant(pct: number): KpiVariant {
  if (pct >= 80) return 'success'
  if (pct >= 50) return 'warning'
  return 'danger'
}

// ── Readiness gate badge (pass / fail / na) ───────────────────────────────────

function GateBadge({ pass, na }: { pass: boolean | undefined; na?: boolean }) {
  if (na || pass == null)
    return <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold h-6 w-6 text-sm ${
        pass
          ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
          : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
      }`}
      title={pass ? 'Gate passed' : 'Gate not passed'}
    >
      {pass ? '✓' : '✗'}
    </span>
  )
}

// ── Story count fraction ──────────────────────────────────────────────────────

function StoryCount({ value, total }: { value: number; total: number }) {
  if (total === 0) return <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>
  const ratio = value / total
  const cls =
    ratio === 1
      ? 'text-[var(--color-tags-font-success)]'
      : ratio > 0.5
        ? 'text-[var(--color-tags-font-attention)]'
        : 'text-[var(--color-tags-font-critical)]'
  return <span className={`text-xs font-semibold tabular-nums ${cls}`}>{value}/{total}</span>
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-[var(--color-fonts-font-color-support)]">—</span>

  const cls: Record<string, string> = {
    'New':         'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'QA':          'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'Closed':      'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  }

  return (
    <span className={`inline-flex items-center font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] text-xs ${cls[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'}`}>
      {status}
    </span>
  )
}

// ── Sort button ───────────────────────────────────────────────────────────────

function SortButton({
  label,
  field,
  current,
  onSort,
}: {
  label: string
  field: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === field
  return (
    <button
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors ${
        active
          ? 'text-[var(--color-fonts-font-color-brand)]'
          : 'text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
      }`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
    </button>
  )
}

// ── Story sub-table (inline drawer) ──────────────────────────────────────────

function StoryDrawer({ stories, jiraBaseUrl }: { stories: ScopeTreeItem[]; jiraBaseUrl: string }) {
  if (stories.length === 0) {
    return (
      <div className="px-6 py-3 text-xs italic text-[var(--color-fonts-font-color-support)]">
        No stories linked to this feature.
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto border-t"
      style={{
        background: 'var(--color-tables-table-header-background)',
        borderColor: 'var(--color-tables-table-header-stroke)',
      }}
    >
      <table className="w-full text-xs">
        <thead>
          <tr
            className="border-b"
            style={{
              borderColor: 'var(--color-tables-table-header-stroke)',
              color: 'var(--color-fonts-font-color-support)',
            }}
          >
            <th className="px-6 py-2 text-left font-medium">Key</th>
            <th className="px-3 py-2 text-left font-medium">Summary</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-center font-medium">Readiness</th>
            <th className="px-3 py-2 text-center font-medium">Ready</th>
            <th className="px-3 py-2 text-center font-medium">Stale</th>
            <th className="px-3 py-2 text-left font-medium">Assignee</th>
          </tr>
        </thead>
        <tbody>
          {stories.map((story) => (
            <tr
              key={story.issueKey}
              className="border-b last:border-0 hover:bg-[var(--color-cards-card-background)] transition-colors"
              style={{ borderColor: 'var(--color-tables-table-row-stroke)' }}
            >
              <td className="px-6 py-2.5">
                <JiraIssueLink
                  issueKey={story.issueKey}
                  jiraBaseUrl={jiraBaseUrl}
                  className="font-mono text-[var(--color-fonts-font-color-brand)] hover:underline"
                />
              </td>
              <td className="max-w-xs px-3 py-2.5">
                <span className="line-clamp-2 text-[var(--color-fonts-font-color-primary)]">{story.summary}</span>
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge status={story.jiraStatus} />
              </td>
              <td className="px-3 py-2.5 text-center">
                <ReadinessBadge label={story.readinessLabel} score={story.readinessScore} showScore />
              </td>
              <td className="px-3 py-2.5 text-center">
                <GateBadge pass={story.readyForDelivery} na={story.readinessScore == null} />
              </td>
              <td className="px-3 py-2.5 text-center">
                {story.isStale && (
                  <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
                    stale
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-[var(--color-fonts-font-color-primary)]">
                {story.assignee ?? (
                  <span className="italic text-[var(--color-fonts-font-color-support)]">Unassigned</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Feature table ─────────────────────────────────────────────────────────────

function FeaturePipeline({
  rows,
  jiraBaseUrl,
}: {
  rows: FeatureRow[]
  jiraBaseUrl: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('aggregateScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'aggregateScore':
          diff = (a.feature.aggregateScore ?? -1) - (b.feature.aggregateScore ?? -1)
          break
        case 'readinessScore':
          diff = (a.feature.readinessScore ?? -1) - (b.feature.readinessScore ?? -1)
          break
        case 'readyForDelivery':
          diff = (a.feature.readyForDelivery ? 1 : 0) - (b.feature.readyForDelivery ? 1 : 0)
          break
        case 'jiraStatus': {
          const STATUS_ORDER: Record<string, number> = { New: 0, 'In Progress': 1, QA: 2, Closed: 3 }
          diff = (STATUS_ORDER[a.feature.jiraStatus ?? ''] ?? 0) - (STATUS_ORDER[b.feature.jiraStatus ?? ''] ?? 0)
          break
        }
      }
      return sortDir === 'asc' ? diff : -diff
    })
  }, [rows, sortKey, sortDir])

  const subtitle = `${rows.length} feature${rows.length !== 1 ? 's' : ''} · click row to expand stories`

  return (
    <TableCard title="Feature Pipeline" subtitle={subtitle} maxHeight="auto">
      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          No features found. Sync the scope from Jira first.
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead
            style={{
              borderBottom: '1px solid var(--color-tables-table-header-stroke)',
              background: 'var(--color-tables-table-header-background)',
            }}
          >
            <tr>
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Key</span>
              </th>
              <th className="px-3 py-3 text-left">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Feature</span>
              </th>
              <th className="px-3 py-3 text-left">
                <SortButton label="Status" field="jiraStatus" current={sortKey} dir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 text-center">
                <SortButton label="Readiness" field="readinessScore" current={sortKey} dir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 text-center">
                <SortButton label="Aggregate" field="aggregateScore" current={sortKey} dir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 text-center">
                <SortButton label="Ready" field="readyForDelivery" current={sortKey} dir={sortDir} onSort={handleSort} />
              </th>
              <th className="px-3 py-3 text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Stories Ready</span>
              </th>
              <th className="px-3 py-3 text-center">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Stories Done</span>
              </th>
              <th className="px-3 py-3 text-left">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Assignee</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ feature, stories, storyStats }) => {
              const isOpen = expanded.has(feature.issueKey)
              return (
                <Fragment key={feature.issueKey}>
                  <tr
                    onClick={() => toggleExpand(feature.issueKey)}
                    className={`cursor-pointer transition-colors ${
                      isOpen
                        ? 'bg-[var(--color-tables-table-row-hover)]'
                        : 'hover:bg-[var(--color-tables-table-row-hover)]'
                    }`}
                    style={{ borderBottom: '1px solid var(--color-tables-table-row-stroke)' }}
                  >
                    {/* Expand toggle */}
                    <td className="px-3 py-3 text-[var(--color-fonts-font-color-support)]">
                      {isOpen
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </td>

                    {/* Key */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <IssueTypeIcon issueType="FEATURE" size={13} />
                        <JiraIssueLink
                          issueKey={feature.issueKey}
                          jiraBaseUrl={jiraBaseUrl}
                          className="font-mono text-xs font-medium text-[var(--color-fonts-font-color-brand)] hover:underline"
                        />
                      </div>
                    </td>

                    {/* Summary */}
                    <td className="max-w-xs px-3 py-3">
                      <span className="line-clamp-2 text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                        {feature.summary}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <StatusBadge status={feature.jiraStatus} />
                    </td>

                    {/* Readiness (own score) */}
                    <td className="px-3 py-3 text-center">
                      <ReadinessBadge label={feature.readinessLabel as ReadinessLabel | undefined} score={feature.readinessScore} showScore />
                    </td>

                    {/* Aggregate score */}
                    <td className="px-3 py-3 text-center">
                      {feature.aggregateScore != null ? (
                        <span className="text-sm font-semibold tabular-nums text-[var(--color-fonts-font-color-primary)]">
                          {feature.aggregateScore}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>
                      )}
                    </td>

                    {/* Ready for delivery gate */}
                    <td className="px-3 py-3 text-center">
                      <GateBadge pass={feature.readyForDelivery} na={feature.aggregateScore == null} />
                    </td>

                    {/* Stories ready */}
                    <td className="px-3 py-3 text-center">
                      <StoryCount value={storyStats.ready} total={storyStats.total} />
                    </td>

                    {/* Stories done */}
                    <td className="px-3 py-3 text-center">
                      <StoryCount
                        value={stories.filter((s) => s.jiraStatus === 'Closed').length}
                        total={storyStats.total}
                      />
                    </td>

                    {/* Assignee */}
                    <td className="px-3 py-3">
                      {feature.assignee ? (
                        <span className="truncate text-xs text-[var(--color-fonts-font-color-primary)]">
                          {feature.assignee}
                        </span>
                      ) : (
                        <span className="text-xs italic text-[var(--color-fonts-font-color-support)]">Unassigned</span>
                      )}
                    </td>
                  </tr>

                  {/* Story sub-table */}
                  {isOpen && (
                    <tr>
                      <td colSpan={10} className="p-0">
                        <StoryDrawer stories={stories} jiraBaseUrl={jiraBaseUrl} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </TableCard>
  )
}

// ── Funnel chart ──────────────────────────────────────────────────────────────

const FUNNEL_COLORS = ['#004766', '#008FCC', '#00B4FF', '#16DB93']

function ReadinessFunnel({ summary }: { summary: QaReadinessResponse['summary'] }) {
  const total = summary.totalItems

  const data = [
    { name: 'Reviewed',         count: summary.reviewed },
    { name: 'Minor Improvements', count: summary.minorImprovementsCount + summary.fullyReadyCount },
    { name: 'Fully Ready',       count: summary.fullyReadyCount },
    { name: 'Ready for Delivery',count: summary.readyForDeliveryCount },
  ]

  return (
    <TableCard
      title="Readiness Funnel"
      subtitle={`${total} total items`}
      maxHeight="auto"
    >
      <div className="px-6 py-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 60, bottom: 0, left: 10 }}
          >
            <XAxis
              type="number"
              domain={[0, Math.max(total, 1)]}
              tick={{ fontSize: 11, fill: 'var(--color-fonts-font-color-support)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={155}
              tick={{ fontSize: 12, fill: 'var(--color-fonts-font-color-primary)' }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              cursor={{ fill: 'rgba(0,82,204,0.05)' }}
              formatter={(value) => {
                const n = typeof value === 'number' ? value : 0
                return [`${n} item${n !== 1 ? 's' : ''} (${total > 0 ? Math.round((n / total) * 100) : 0}%)`, 'Count']
              }}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--color-cards-card-stroke)',
                fontSize: '12px',
                background: 'var(--color-cards-card-background)',
                color: 'var(--color-fonts-font-color-primary)',
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {data.map((_, index) => (
                <Cell key={index} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fontSize: '13px', fontWeight: 600, fill: 'var(--color-fonts-font-color-primary)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TableCard>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function QaReadinessPage() {
  const [selectedScopeId, setSelectedScopeId] = useState<string>('')

  const { data: scopes = [] } = useQuery<Scope[]>({
    queryKey: ['scopes'],
    queryFn: () => api.get('/scope').then((r) => r.data),
  })

  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000,
  })
  const jiraBaseUrl = systemConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  const effectiveScopeId = selectedScopeId || scopes[0]?.id || ''

  const { data: qaData, isLoading, isError } = useQuery<QaReadinessResponse>({
    queryKey: ['qa-readiness', effectiveScopeId],
    queryFn: () => api.get(`/scope/${effectiveScopeId}/qa-readiness`).then((r) => r.data),
    enabled: !!effectiveScopeId,
  })

  const summary = qaData?.summary

  // Build feature rows: each FEATURE with its child USERSTORYs
  const featureRows = useMemo<FeatureRow[]>(() => {
    const allItems = qaData?.items ?? []
    const features = allItems.filter((i) => i.issueType === 'FEATURE')
    const storiesByFeature = new Map<string, ScopeTreeItem[]>()
    for (const item of allItems) {
      if (item.issueType === 'USERSTORY' && item.parentKey) {
        const arr = storiesByFeature.get(item.parentKey) ?? []
        arr.push(item)
        storiesByFeature.set(item.parentKey, arr)
      }
    }
    return features.map((feature) => {
      const stories = storiesByFeature.get(feature.issueKey) ?? []
      const reviewed = stories.filter((s) => s.readinessScore != null).length
      const ready    = stories.filter((s) => s.readyForDelivery).length
      return { feature, stories, storyStats: { total: stories.length, ready, reviewed } }
    })
  }, [qaData?.items])

  // Summary bar breakdown string
  const statusBreakdown = useMemo(() => {
    if (!summary) return undefined
    const parts: string[] = []
    if (summary.inQaStatusCount)  parts.push(`QA: ${summary.inQaStatusCount}`)
    if (summary.closedCount)       parts.push(`Closed: ${summary.closedCount}`)
    if (summary.staleCount)        parts.push(`Stale: ${summary.staleCount}`)
    return parts.join(' · ') || undefined
  }, [summary])

  const pctReviewed     = summary && summary.totalItems > 0 ? Math.round((summary.reviewed / summary.totalItems) * 100) : 0
  const pctFullyReady   = summary && summary.totalItems > 0 ? Math.round((summary.fullyReadyCount / summary.totalItems) * 100) : 0
  const pctReadyForDel  = summary && summary.totalItems > 0 ? Math.round((summary.readyForDeliveryCount / summary.totalItems) * 100) : 0

  const scopeSelector = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0">Scope</span>
      <Select
        value={selectedScopeId || effectiveScopeId}
        onChange={setSelectedScopeId}
        options={scopes.map((s) => ({ value: s.id, label: s.name }))}
        placeholder="Select scope…"
        className="w-52"
      />
    </div>
  )

  return (
    <main className="flex flex-col gap-6 px-6 py-6 lg:px-8 lg:py-8">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">QA Readiness</h1>
          <p className="mt-1 text-sm text-[var(--color-fonts-font-color-support)]">
            Scope readiness overview · live Jira data
          </p>
        </div>
        {scopeSelector}
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-fonts-font-color-support)]">
          <Loader2 size={15} className="animate-spin" />
          Loading readiness data…
        </div>
      )}

      {isError && (
        <div
          className="rounded-lg border p-5 text-sm"
          style={{
            background: 'var(--color-tags-critical-background)',
            borderColor: 'var(--color-tags-critical-background)',
            color: 'var(--color-tags-font-critical)',
          }}
        >
          <strong className="font-semibold">Unable to load data.</strong> Check that the scope exists and has been synced.
        </div>
      )}

      {!isLoading && !isError && !effectiveScopeId && (
        <div className="text-sm text-[var(--color-fonts-font-color-support)]">
          No scopes found. Create a scope first.
        </div>
      )}

      {summary && (
        <>
          {/* KPI summary bar — 5 cards like argus SummaryBar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              icon={<Layers className="h-5 w-5" />}
              label="Total Items"
              value={summary.totalItems}
              sub={statusBreakdown}
              variant="default"
            />
            <KpiCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Reviewed"
              value={`${pctReviewed}%`}
              sub={`${summary.reviewed} of ${summary.totalItems} items`}
              variant={gateVariant(pctReviewed)}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Fully Ready"
              value={`${pctFullyReady}%`}
              sub={`${summary.fullyReadyCount} items fully ready`}
              variant={gateVariant(pctFullyReady)}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Ready for Delivery"
              value={`${pctReadyForDel}%`}
              sub={`${summary.readyForDeliveryCount} items pass threshold`}
              variant={gateVariant(pctReadyForDel)}
            />
            <KpiCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Stale Reviews"
              value={summary.staleCount}
              sub="Jira modified after last review"
              variant={summary.staleCount === 0 ? 'success' : summary.staleCount <= 5 ? 'warning' : 'danger'}
            />
          </div>

          {/* Readiness funnel */}
          <ReadinessFunnel summary={summary} />

          {/* Feature pipeline table */}
          <FeaturePipeline rows={featureRows} jiraBaseUrl={jiraBaseUrl} />
        </>
      )}
    </main>
  )
}
