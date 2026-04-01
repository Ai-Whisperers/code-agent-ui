import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import {
  FlaskConical,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { ReadinessBadge } from '@/components/scope/ReadinessBadge'
import { JiraIssueLink } from '@/components/ui/JiraIssueLink'
import { IssueTypeIcon } from '@/components/ui/IssueTypeIcon'
import { mcpProfilesApi, type SystemConfig } from '@/lib/mcpProfiles'
import api from '@/lib/api'
import type { Scope, QaReadinessResponse, ScopeTreeItem } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend)

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  total,
  colorClass = 'text-[var(--color-fonts-font-color-primary)]',
}: {
  label: string
  value: number
  total?: number
  colorClass?: string
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] px-4 py-3 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <span className="text-xs text-[var(--color-fonts-font-color-support)] truncate">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</span>
        {pct !== null && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">{pct}%</span>
        )}
      </div>
    </div>
  )
}

// ── Jira status badge ─────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  Closed:      'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  QA:          'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'In Progress':'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
  New:         'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
  const cls = STATUS_CLS[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      {status}
    </span>
  )
}

// ── Expandable tree table ─────────────────────────────────────────────────────

type TreeNode = ScopeTreeItem & { children: TreeNode[] }

function buildTree(items: ScopeTreeItem[]): TreeNode[] {
  const byKey = new Map<string, TreeNode>()
  for (const item of items) {
    byKey.set(item.issueKey, { ...item, children: [] })
  }
  const roots: TreeNode[] = []
  for (const node of byKey.values()) {
    const parentKey = node.parentKey
    if (parentKey && byKey.has(parentKey)) {
      byKey.get(parentKey)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function ItemRow({
  node,
  depth,
  expanded,
  onToggle,
  jiraBaseUrl,
}: {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (key: string) => void
  jiraBaseUrl: string
}) {
  const isExpanded = expanded.has(node.issueKey)
  const hasChildren = node.children.length > 0
  const indent = depth * 20

  return (
    <>
      <tr
        className="border-b border-[var(--color-tables-table-row-stroke)] hover:bg-[var(--color-tables-table-row-hover)] transition-colors"
        onClick={() => hasChildren && onToggle(node.issueKey)}
        style={{ cursor: hasChildren ? 'pointer' : 'default' }}
      >
        {/* Expand / type */}
        <td className="py-2 pl-3 pr-1 whitespace-nowrap" style={{ paddingLeft: `${12 + indent}px` }}>
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              isExpanded
                ? <ChevronDown size={13} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
                : <ChevronRight size={13} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
            ) : (
              <span className="w-[13px] shrink-0" />
            )}
            <IssueTypeIcon issueType={node.issueType} size={14} />
          </div>
        </td>

        {/* Key */}
        <td className="py-2 px-2 whitespace-nowrap">
          <JiraIssueLink
            issueKey={node.issueKey}
            jiraBaseUrl={jiraBaseUrl}
            className="text-xs font-mono font-semibold text-[var(--color-fonts-font-color-brand)]"
          />
        </td>

        {/* Summary */}
        <td className="py-2 px-2 max-w-xs">
          <span className="text-xs text-[var(--color-fonts-font-color-primary)] line-clamp-2">
            {node.summary}
          </span>
        </td>

        {/* Jira Status */}
        <td className="py-2 px-2 whitespace-nowrap">
          <StatusBadge status={node.jiraStatus} />
        </td>

        {/* Readiness */}
        <td className="py-2 px-2 whitespace-nowrap">
          <ReadinessBadge label={node.readinessLabel} score={node.readinessScore} showScore />
        </td>

        {/* Ready for delivery */}
        <td className="py-2 px-2 text-center whitespace-nowrap">
          {node.readyForDelivery == null ? (
            <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
          ) : node.readyForDelivery ? (
            <span className="text-[var(--color-tags-font-success)] text-xs font-medium">✓</span>
          ) : (
            <span className="text-[var(--color-tags-font-critical)] text-xs font-medium">✗</span>
          )}
        </td>

        {/* Stale */}
        <td className="py-2 px-2 text-center whitespace-nowrap">
          {node.isStale && (
            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
              stale
            </span>
          )}
        </td>
      </tr>

      {isExpanded && node.children.map((child) => (
        <ItemRow
          key={child.issueKey}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          jiraBaseUrl={jiraBaseUrl}
        />
      ))}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function QaReadinessPage() {
  const [selectedScopeId, setSelectedScopeId] = useState<string>('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  const {
    data: qaData,
    isLoading,
    isError,
  } = useQuery<QaReadinessResponse>({
    queryKey: ['qa-readiness', effectiveScopeId],
    queryFn: () => api.get(`/scope/${effectiveScopeId}/qa-readiness`).then((r) => r.data),
    enabled: !!effectiveScopeId,
  })

  const summary = qaData?.summary
  const items   = qaData?.items ?? []

  const tree = useMemo(() => buildTree(items), [items])

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAll = () => {
    const keys = new Set(items.map((i) => i.issueKey))
    setExpanded(keys)
  }

  const collapseAll = () => setExpanded(new Set())

  // ── Chart data ──────────────────────────────────────────────────────────────

  const chartData = useMemo(() => ({
    labels: ['Fully Ready', 'Minor Improvements', 'Needs Refinement', 'Poor', 'Not Reviewed'],
    datasets: [
      {
        label: 'Items',
        data: summary
          ? [
              summary.fullyReadyCount,
              summary.minorImprovementsCount,
              summary.needsRefinementCount,
              summary.poorCount,
              summary.totalItems - summary.reviewed,
            ]
          : [],
        backgroundColor: [
          'var(--color-tags-success-background)',
          '#bfdbfe',
          'var(--color-tags-attention-background)',
          'var(--color-tags-critical-background)',
          'var(--color-tags-neutral-background)',
        ],
        borderColor: [
          'var(--color-tags-font-success)',
          '#3b82f6',
          'var(--color-tags-font-attention)',
          'var(--color-tags-font-critical)',
          'var(--color-tags-font-neutral)',
        ],
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }), [summary])

  const chartOptions = useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: { parsed: { x: number } }) => ` ${ctx.parsed.x} items` } },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1, precision: 0, color: 'var(--color-fonts-font-color-support)', font: { size: 11 } },
        grid: { color: 'var(--color-borders-border-primary)' },
      },
      y: {
        ticks: { color: 'var(--color-fonts-font-color-primary)', font: { size: 12 } },
        grid: { display: false },
      },
    },
  }), [])

  // ── Render ──────────────────────────────────────────────────────────────────

  const scopeSelector = (
    <div className="flex items-center gap-2">
      <label className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0">Scope</label>
      <select
        value={selectedScopeId || effectiveScopeId}
        onChange={(e) => setSelectedScopeId(e.target.value)}
        className="text-sm rounded border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--color-buttons-button-primary)]"
      >
        {scopes.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  )

  return (
    <main className="flex flex-col gap-5 p-5 min-h-0">
      <PageHeader
        title="QA Readiness"
        subtitle="Scope readiness overview for QA sign-off"
        actions={scopeSelector}
      />

      {/* Loading / error states */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-fonts-font-color-support)]">
          <Loader2 size={15} className="animate-spin" />
          Loading readiness data…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-tags-font-critical)]">
          <AlertTriangle size={15} />
          Failed to load QA readiness data.
        </div>
      )}

      {!isLoading && !isError && !effectiveScopeId && (
        <div className="text-sm text-[var(--color-fonts-font-color-support)]">
          No scopes found. Create a scope first.
        </div>
      )}

      {summary && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Reviewed"
              value={summary.reviewed}
              total={summary.totalItems}
            />
            <KpiCard
              label="Fully Ready"
              value={summary.fullyReadyCount}
              total={summary.totalItems}
              colorClass="text-[var(--color-tags-font-success)]"
            />
            <KpiCard
              label="In QA Status"
              value={summary.inQaStatusCount}
              total={summary.totalItems}
              colorClass="text-blue-600 dark:text-blue-400"
            />
            <KpiCard
              label="Stale Reviews"
              value={summary.staleCount}
              total={summary.totalItems}
              colorClass={summary.staleCount > 0 ? 'text-[var(--color-tags-font-attention)]' : undefined}
            />
          </div>

          {/* Secondary KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Ready for Delivery" value={summary.readyForDeliveryCount} total={summary.totalItems} />
            <KpiCard label="Needs Refinement"   value={summary.needsRefinementCount}  total={summary.totalItems} />
            <KpiCard label="Poor"               value={summary.poorCount}             total={summary.totalItems} />
            <KpiCard label="Closed"             value={summary.closedCount}           total={summary.totalItems} />
          </div>

          {/* Readiness distribution chart */}
          <div className="rounded-lg border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical size={14} className="text-[var(--color-fonts-font-color-support)]" />
              <span className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
                Readiness Distribution
              </span>
              <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                {summary.totalItems} total items
              </span>
            </div>
            <div style={{ height: 180 }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Item table */}
          <TableCard
            title="Item Readiness"
            subtitle={`${items.length} items`}
            toolbar={
              <div className="flex items-center gap-1">
                <button
                  onClick={expandAll}
                  className="text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] px-2 py-1 rounded hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
                >
                  Expand all
                </button>
                <button
                  onClick={collapseAll}
                  className="text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] px-2 py-1 rounded hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
                >
                  Collapse all
                </button>
              </div>
            }
            maxHeight="600px"
          >
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--color-tables-table-header-background)]">
                <tr>
                  <th className="py-2 pl-3 pr-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap w-10" />
                  <th className="py-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">Key</th>
                  <th className="py-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Summary</th>
                  <th className="py-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">Jira Status</th>
                  <th className="py-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">Readiness</th>
                  <th className="py-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap text-center">Ready</th>
                  <th className="py-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap text-center">Stale</th>
                </tr>
              </thead>
              <tbody>
                {tree.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
                      No items found. Sync the scope from Jira first.
                    </td>
                  </tr>
                ) : (
                  tree.map((node) => (
                    <ItemRow
                      key={node.issueKey}
                      node={node}
                      depth={0}
                      expanded={expanded}
                      onToggle={toggleExpand}
                      jiraBaseUrl={jiraBaseUrl}
                    />
                  ))
                )}
              </tbody>
            </table>
          </TableCard>
        </>
      )}
    </main>
  )
}
