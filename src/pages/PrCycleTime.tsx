import { useQuery, useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { Timer } from 'lucide-react'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { PrCycleTimeReport, PrCycleTimeRow, RepoSettings } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend)

const PERIOD_OPTIONS = [
  { label: '30 days',  value: 30  },
  { label: '90 days',  value: 90  },
  { label: '180 days', value: 180 },
]

const GROUP_OPTIONS = [
  { label: 'By Repo',   value: 'repo'   },
  { label: 'By Author', value: 'author' },
]

const CHART_COLORS = {
  review: 'rgba(99,130,255,0.75)',
  merge:  'rgba(22,219,147,0.75)',
}

const BAR_OPTIONS = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; parsed: { x: number | null } }) =>
          ` ${ctx.dataset.label}: ${(ctx.parsed.x ?? 0).toFixed(1)} hrs`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: 'rgba(128,128,128,0.1)' },
      title: { display: true, text: 'Hours', font: { size: 11 } },
    },
    y: { grid: { display: false }, ticks: { font: { size: 11 } } },
  },
}

function fmtHrs(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v < 1) return `${Math.round(v * 60)}m`
  return `${v.toFixed(1)}h`
}

export default function PrCycleTimePage() {
  const [days, setDays]       = useState(30)
  const [groupBy, setGroupBy] = useState<'repo' | 'author'>('repo')

  const { data: repos, isLoading: reposLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const reviewRepos = (Array.isArray(repos) ? repos : []).filter((r) => r.reviewEnabled && !r.archived)

  const cycleQueries = useQueries({
    queries: reviewRepos.map((repo) => ({
      queryKey: ['pr-cycle-time', repo.workspace, repo.repoSlug, days, groupBy],
      queryFn: () =>
        api
          .get(`/metrics/pr-cycle-time/${repo.workspace}/${repo.repoSlug}?days=${days}&groupBy=${groupBy}`)
          .then((r) => r.data as PrCycleTimeReport)
          .catch(() => undefined),
      enabled: reviewRepos.length > 0,
    })),
  })

  const isLoading = reposLoading || cycleQueries.some((q) => q.isLoading)

  const allRows: Array<PrCycleTimeRow & { repoSlug: string; workspace: string }> = []
  reviewRepos.forEach((repo, i) => {
    const data = cycleQueries[i]?.data
    if (data?.rows) {
      data.rows.forEach((row) =>
        allRows.push({ ...row, repoSlug: repo.repoSlug, workspace: repo.workspace }),
      )
    }
  })

  // Fleet-wide averages
  const reviewHrs = allRows.map((r) => r.avgOpenToReviewHrs).filter((v): v is number => v != null)
  const mergeHrs  = allRows.map((r) => r.avgOpenToMergeHrs).filter((v): v is number => v != null)
  const fleetAvgReview = reviewHrs.length ? reviewHrs.reduce((a, b) => a + b, 0) / reviewHrs.length : null
  const fleetAvgMerge  = mergeHrs.length  ? mergeHrs.reduce((a, b) => a + b, 0)  / mergeHrs.length  : null

  // Chart — top 15 rows by totalPrs
  const chartRows = [...allRows].sort((a, b) => b.totalPrs - a.totalPrs).slice(0, 15)
  const chartData = {
    labels: chartRows.map((r) => r.groupKey ?? (groupBy === 'repo' ? r.repoSlug : '—')),
    datasets: [
      {
        label: 'Open → Agent Review (hrs)',
        data: chartRows.map((r) => r.avgOpenToReviewHrs ?? 0),
        backgroundColor: CHART_COLORS.review,
        borderRadius: 3,
      },
      {
        label: 'Open → Merge (hrs)',
        data: chartRows.map((r) => r.avgOpenToMergeHrs ?? 0),
        backgroundColor: CHART_COLORS.merge,
        borderRadius: 3,
      },
    ],
  }
  const chartHeight = Math.max(120, chartRows.length * 36)

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="PR Cycle Time"
        subtitle="Time from PR open to first agent review and to merge, across repositories."
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-fonts-font-color-support)]">Period:</span>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1 text-xs rounded-[var(--border-radius-button-small)] font-medium transition-colors ${
                  days === opt.value
                    ? 'bg-[var(--color-buttons-button-primary)] text-[var(--color-buttons-button-primary-text)]'
                    : 'bg-[var(--color-cards-small-section-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-fonts-font-color-support)]">Group:</span>
          <div className="flex gap-1">
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value as 'repo' | 'author')}
                className={`px-3 py-1 text-xs rounded-[var(--border-radius-button-small)] font-medium transition-colors ${
                  groupBy === opt.value
                    ? 'bg-[var(--color-buttons-button-primary)] text-[var(--color-buttons-button-primary-text)]'
                    : 'bg-[var(--color-cards-small-section-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Avg Open → Agent Review" value={fmtHrs(fleetAvgReview)} />
        <MetricCard label="Avg Open → Merge"         value={fmtHrs(fleetAvgMerge)} />
        <MetricCard label="Repos tracked"            value={reviewRepos.length} />
        <MetricCard label="PRs in period"            value={allRows.reduce((s, r) => s + r.totalPrs, 0)} />
      </div>

      {/* Bar chart */}
      {!isLoading && chartRows.length > 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] mb-5">
          <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">
            Cycle Time by {groupBy === 'repo' ? 'Repository' : 'Author'}
          </h3>
          <div style={{ height: chartHeight }}>
            <Bar data={chartData} options={BAR_OPTIONS} />
          </div>
        </div>
      )}

      {/* Table */}
      <TableCard
        className="flex-1 min-h-0"
        title="Cycle Time Details"
        subtitle={`${allRows.length} row${allRows.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: groupBy === 'repo' ? 'Repository' : 'Author', tip: 'Grouping key' },
                { label: 'Workspace',                tip: 'Git workspace' },
                { label: 'PRs',                      tip: 'PRs with at least one agent REVIEW job' },
                { label: 'Avg Open→Review',          tip: 'Average hours from PR open to first agent review' },
                { label: 'p50 Open→Review',          tip: 'Median hours from PR open to first agent review' },
                { label: 'p95 Open→Review',          tip: '95th-percentile hours from PR open to first agent review' },
                { label: 'Avg Open→Merge',           tip: 'Average hours from PR open to merge (MERGED PRs only)' },
              ] as const).map(({ label, tip }) => (
                <th
                  key={label}
                  className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  <Tooltip text={tip} position="bottom">{label}</Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={7} className="px-4 py-2">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : allRows.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    <div className="flex flex-col items-center gap-2">
                      <Timer size={24} className="opacity-30" />
                      <span>No cycle time data found for this period.</span>
                      <span className="text-[10px]">
                        Data is populated from agent REVIEW jobs. Trigger a PR review to start tracking.
                      </span>
                    </div>
                  </td>
                </tr>
              )
              : allRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
                  >
                    <td className="px-4 py-1.5 font-medium">{row.groupKey ?? row.repoSlug}</td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">{row.workspace}</td>
                    <td className="px-4 py-1.5">{row.totalPrs}</td>
                    <td className="px-4 py-1.5">{fmtHrs(row.avgOpenToReviewHrs)}</td>
                    <td className="px-4 py-1.5">{fmtHrs(row.p50OpenToReviewHrs)}</td>
                    <td className="px-4 py-1.5">{fmtHrs(row.p95OpenToReviewHrs)}</td>
                    <td className="px-4 py-1.5">{fmtHrs(row.avgOpenToMergeHrs)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-cards-small-section-background)] rounded-[var(--border-radius-small)] p-4">
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-2 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
    </div>
  )
}
