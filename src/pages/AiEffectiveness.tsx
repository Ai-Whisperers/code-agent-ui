import { useQuery, useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BotMessageSquare } from 'lucide-react'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Doughnut, Line } from 'react-chartjs-2'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type {
  AiAcceptanceReport,
  AiAcceptanceBreakdownRow,
  AiAcceptanceTrend,
  RepoSettings,
} from '@/types/api'

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  ChartTooltip,
  Legend,
)

const PERIOD_OPTIONS = [
  { label: '30 days',  value: 30  },
  { label: '90 days',  value: 90  },
  { label: '180 days', value: 180 },
]

const GROUP_OPTIONS = [
  { label: 'By Repo',     value: 'repo'    },
  { label: 'By Job Type', value: 'jobType' },
  { label: 'By Author',   value: 'author'  },
]

const BUCKET_COLORS = {
  accepted: 'rgba(22,219,147,0.8)',
  rejected: 'rgba(255,99,99,0.8)',
  ignored:  'rgba(180,180,180,0.6)',
}

function pct(v: number, total: number) {
  return total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—'
}

export default function AiEffectivenessPage() {
  const [days, setDays]       = useState(30)
  const [groupBy, setGroupBy] = useState<'repo' | 'jobType' | 'author'>('repo')

  const { data: repos, isLoading: reposLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const reviewRepos = (Array.isArray(repos) ? repos : []).filter((r) => r.reviewEnabled && !r.archived)

  const summaryQueries = useQueries({
    queries: reviewRepos.map((repo) => ({
      queryKey: ['ai-acceptance', repo.workspace, repo.repoSlug, days, groupBy],
      queryFn: () =>
        api
          .get(`/metrics/ai-acceptance/${repo.workspace}/${repo.repoSlug}?days=${days}&groupBy=${groupBy}`)
          .then((r) => r.data as AiAcceptanceReport)
          .catch(() => undefined),
      enabled: reviewRepos.length > 0,
    })),
  })

  const trendQueries = useQueries({
    queries: reviewRepos.map((repo) => ({
      queryKey: ['ai-acceptance-trend', repo.workspace, repo.repoSlug, days],
      queryFn: () =>
        api
          .get(`/metrics/ai-acceptance/${repo.workspace}/${repo.repoSlug}/trend?days=${days}`)
          .then((r) => r.data as AiAcceptanceTrend)
          .catch(() => undefined),
      enabled: reviewRepos.length > 0,
    })),
  })

  const isLoading = reposLoading || summaryQueries.some((q) => q.isLoading)

  // Aggregate totals across all repos
  let totalFindings = 0, totalAccepted = 0, totalRejected = 0, totalIgnored = 0
  const allBreakdownRows: Array<AiAcceptanceBreakdownRow & { repoSlug: string }> = []

  reviewRepos.forEach((repo, i) => {
    const data = summaryQueries[i]?.data
    if (data) {
      totalFindings += data.total ?? 0
      totalAccepted += data.accepted ?? 0
      totalRejected += data.rejected ?? 0
      totalIgnored  += data.ignored ?? 0
      data.breakdown?.forEach((row) =>
        allBreakdownRows.push({ ...row, repoSlug: repo.repoSlug }),
      )
    }
  })

  // Aggregate weekly trend across all repos
  const trendMap = new Map<string, { accepted: number; total: number }>()
  reviewRepos.forEach((_, i) => {
    const data = trendQueries[i]?.data
    data?.trend?.forEach((pt) => {
      const prev = trendMap.get(pt.week) ?? { accepted: 0, total: 0 }
      trendMap.set(pt.week, {
        accepted: prev.accepted + (pt.accepted ?? 0),
        total:    prev.total    + (pt.total    ?? 0),
      })
    })
  })
  const trendWeeks = Array.from(trendMap.keys()).sort()
  const trendRates = trendWeeks.map((w) => {
    const { accepted, total } = trendMap.get(w)!
    return total > 0 ? Math.round((accepted / total) * 10000) / 100 : 0
  })

  // Doughnut
  const doughnutData = {
    labels: ['Accepted', 'Rejected (FP)', 'Ignored'],
    datasets: [{
      data: [totalAccepted, totalRejected, totalIgnored],
      backgroundColor: [BUCKET_COLORS.accepted, BUCKET_COLORS.rejected, BUCKET_COLORS.ignored],
      borderWidth: 0,
    }],
  }
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
    },
  }

  // Trend line
  const trendData = {
    labels: trendWeeks,
    datasets: [{
      label: 'Acceptance Rate (%)',
      data: trendRates,
      borderColor: BUCKET_COLORS.accepted,
      backgroundColor: 'rgba(22,219,147,0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }],
  }
  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => ` ${(ctx.parsed.y ?? 0).toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        time: { unit: 'week' as const, tooltipFormat: 'MMM d' },
        grid: { color: 'rgba(128,128,128,0.1)' },
        ticks: { font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { callback: (v: number | string) => `${v}%`, font: { size: 10 } },
        grid: { color: 'rgba(128,128,128,0.1)' },
      },
    },
  }

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="AI Effectiveness"
        subtitle="How developers respond to AI review findings — accepted, rejected as false-positive, or ignored."
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
                onClick={() => setGroupBy(opt.value as typeof groupBy)}
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
        <Link
          to="/stats"
          className="ml-auto text-xs text-[var(--color-fonts-font-color-brand)] hover:underline flex items-center gap-1"
        >
          <BotMessageSquare size={13} />
          View AI Stats →
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Findings"    value={totalFindings} />
        <MetricCard label="Accepted"          value={`${pct(totalAccepted, totalFindings)} (${totalAccepted})`} />
        <MetricCard label="Rejected (FP)"     value={`${pct(totalRejected, totalFindings)} (${totalRejected})`} />
        <MetricCard label="Ignored"           value={`${pct(totalIgnored,  totalFindings)} (${totalIgnored})`} />
      </div>

      {/* Charts row */}
      {!isLoading && totalFindings > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {/* Doughnut */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">
              Findings Breakdown
            </h3>
            <div style={{ height: 200 }}>
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </div>

          {/* Trend line */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">
              Acceptance Rate Over Time
            </h3>
            <div style={{ height: 200 }}>
              {trendWeeks.length > 0
                ? <Line data={trendData} options={trendOptions} />
                : <p className="text-xs text-[var(--color-fonts-font-color-support)] pt-8 text-center">Not enough trend data yet.</p>
              }
            </div>
          </div>
        </div>
      )}

      {/* Breakdown table */}
      <TableCard
        className="flex-1 min-h-0"
        title="Breakdown"
        subtitle={`${allBreakdownRows.length} row${allBreakdownRows.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: 'Group',          tip: 'Grouping key (repo, job type, or author)' },
                { label: 'Repo',           tip: 'Repository slug' },
                { label: 'Total',          tip: 'Total inline findings in this group' },
                { label: 'Accepted',       tip: 'Resolved by developer with no false-positive feedback' },
                { label: 'Rejected (FP)',  tip: 'Marked as false-positive via comment chat' },
                { label: 'Ignored',        tip: 'Not resolved and no feedback submitted' },
                { label: 'Accept Rate',    tip: 'Accepted / Total' },
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
              : allBreakdownRows.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    <div className="flex flex-col items-center gap-2">
                      <BotMessageSquare size={24} className="opacity-30" />
                      <span>No AI effectiveness data found for this period.</span>
                      <span className="text-[10px]">
                        Data is populated when developers interact with agent review findings via comment chat.
                      </span>
                    </div>
                  </td>
                </tr>
              )
              : allBreakdownRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
                  >
                    <td className="px-4 py-1.5 font-medium">{row.groupKey ?? '—'}</td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">{row.repoSlug}</td>
                    <td className="px-4 py-1.5">{row.total}</td>
                    <td className="px-4 py-1.5 text-[var(--color-tags-font-success)]">{row.accepted}</td>
                    <td className="px-4 py-1.5 text-[var(--color-tags-font-critical)]">{row.rejected}</td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">{row.ignored}</td>
                    <td className="px-4 py-1.5">
                      <AcceptBadge rate={row.acceptanceRate} />
                    </td>
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
      <p className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
    </div>
  )
}

function AcceptBadge({ rate }: { rate: number }) {
  const color =
    rate >= 0.6
      ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
      : rate >= 0.3
      ? 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
      : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)] ${color}`}>
      {(rate * 100).toFixed(1)}%
    </span>
  )
}
