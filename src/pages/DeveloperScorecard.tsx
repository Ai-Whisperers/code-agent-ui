import { useQuery, useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { User, X } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { DeveloperScorecard, DeveloperEntry, RepoSettings } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const PERIOD_OPTIONS = [
  { label: '7 days',   value: 7   },
  { label: '30 days',  value: 30  },
  { label: '90 days',  value: 90  },
  { label: '180 days', value: 180 },
]

const CHART_COLORS = {
  findings:   'rgba(99,130,255,0.75)',
  resolved:   'rgba(22,219,147,0.75)',
  unresolved: 'rgba(255,99,99,0.75)',
  rate:       (v: number) =>
    v >= 0.7
      ? 'rgba(22,219,147,0.75)'
      : v >= 0.4
      ? 'rgba(255,185,0,0.75)'
      : 'rgba(255,99,99,0.75)',
}

const HBAR_BASE_OPTIONS = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } },
  },
  scales: {
    x: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } },
    y: { grid: { display: false }, ticks: { font: { size: 11 } } },
  },
}

type SelectedDev = {
  repo: RepoSettings
  entry: DeveloperEntry
  periodDays: number
}

/** Aggregate allRows by author across repos for cross-repo chart views. */
function aggregateByAuthor(rows: Array<{ repo: RepoSettings; entry: DeveloperEntry }>) {
  const map = new Map<string, { totalFindings: number; resolvedFindings: number; totalPrs: number }>()
  for (const { entry } of rows) {
    const prev = map.get(entry.author) ?? { totalFindings: 0, resolvedFindings: 0, totalPrs: 0 }
    map.set(entry.author, {
      totalFindings:    prev.totalFindings    + entry.totalFindings,
      resolvedFindings: prev.resolvedFindings + entry.resolvedFindings,
      totalPrs:         prev.totalPrs         + entry.totalPrs,
    })
  }
  return Array.from(map.entries())
    .map(([author, stats]) => ({ author, ...stats }))
    .sort((a, b) => b.totalFindings - a.totalFindings)
    .slice(0, 15)
}

export default function DeveloperScorecardPage() {
  const [days, setDays]         = useState(30)
  const [selected, setSelected] = useState<SelectedDev | null>(null)

  const { data: repos, isLoading: reposLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const reviewRepos = (Array.isArray(repos) ? repos : []).filter((r) => r.reviewEnabled && !r.archived)

  const scorecardQueries = useQueries({
    queries: reviewRepos.map((repo) => ({
      queryKey: ['developer-scorecard', repo.workspace, repo.repoSlug, days],
      queryFn: () =>
        api
          .get(`/metrics/developer-scorecard/${repo.workspace}/${repo.repoSlug}?days=${days}`)
          .then((r) => r.data as DeveloperScorecard)
          .catch(() => undefined),
      enabled: reviewRepos.length > 0,
    })),
  })

  const isLoading = reposLoading || scorecardQueries.some((q) => q.isLoading)

  const allRows: Array<{ repo: RepoSettings; entry: DeveloperEntry }> = []
  reviewRepos.forEach((repo, i) => {
    const sc = scorecardQueries[i]?.data
    if (sc?.authors) {
      sc.authors.forEach((entry) => allRows.push({ repo, entry }))
    }
  })

  const aggregated = aggregateByAuthor(allRows)

  const findingsChartData = {
    labels: aggregated.map((a) => a.author),
    datasets: [
      {
        label: 'Total Findings',
        data: aggregated.map((a) => a.totalFindings),
        backgroundColor: CHART_COLORS.findings,
        borderRadius: 3,
      },
      {
        label: 'Resolved',
        data: aggregated.map((a) => a.resolvedFindings),
        backgroundColor: CHART_COLORS.resolved,
        borderRadius: 3,
      },
    ],
  }

  const rateChartData = {
    labels: aggregated.map((a) => a.author),
    datasets: [
      {
        label: 'Resolution Rate (%)',
        data: aggregated.map((a) =>
          a.totalFindings > 0
            ? Math.round((a.resolvedFindings / a.totalFindings) * 1000) / 10
            : 0,
        ),
        backgroundColor: aggregated.map((a) =>
          CHART_COLORS.rate(a.totalFindings > 0 ? a.resolvedFindings / a.totalFindings : 0),
        ),
        borderRadius: 3,
      },
    ],
  }

  const rateChartOptions = {
    ...HBAR_BASE_OPTIONS,
    plugins: {
      ...HBAR_BASE_OPTIONS.plugins,
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { x: number } }) => ` ${ctx.parsed.x.toFixed(1)}%`,
        },
      },
    },
    scales: {
      ...HBAR_BASE_OPTIONS.scales,
      x: { ...HBAR_BASE_OPTIONS.scales.x, max: 100, ticks: { callback: (v: number | string) => `${v}%` } },
    },
  }

  const chartHeight = Math.max(120, aggregated.length * 32)

  return (
    <main>
      <PageHeader
        title="Developer Scorecard"
        subtitle="Per-developer PR review quality metrics across repositories."
      />

      {/* Period selector */}
      <div className="flex items-center gap-3 mb-4">
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

      {/* Charts — only when data is present */}
      {!isLoading && aggregated.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {/* Findings vs Resolved */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">
              Findings vs Resolved
            </h3>
            <div style={{ height: chartHeight }}>
              <Bar data={findingsChartData} options={HBAR_BASE_OPTIONS} />
            </div>
          </div>

          {/* Resolution Rate */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">
              Resolution Rate by Developer
            </h3>
            <div style={{ height: chartHeight }}>
              <Bar data={rateChartData} options={rateChartOptions as unknown as typeof HBAR_BASE_OPTIONS} />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
              {['Developer', 'Workspace', 'Repo', 'PRs Reviewed', 'Findings', 'Resolved', 'Resolution Rate', 'Last PR', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-5 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : allRows.length === 0
              ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No developer data found for this period. Reviews triggered via webhook will populate this table.
                  </td>
                </tr>
              )
              : allRows.map(({ repo, entry }, i) => (
                  <tr
                    key={`${repo.workspace}/${repo.repoSlug}/${entry.author}`}
                    className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
                      i % 2 === 0 ? 'bg-[var(--color-tables-table-row-a)]' : ''
                    }`}
                    onClick={() => setSelected({ repo, entry, periodDays: days })}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <User size={14} className="text-[var(--color-fonts-font-color-support)]" />
                        {entry.author}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">{repo.workspace}</td>
                    <td className="px-4 py-3">{repo.repoSlug}</td>
                    <td className="px-4 py-3">{entry.totalPrs}</td>
                    <td className="px-4 py-3">{entry.totalFindings}</td>
                    <td className="px-4 py-3">{entry.resolvedFindings}</td>
                    <td className="px-4 py-3">
                      <ResolutionBadge rate={entry.resolutionRate} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">
                      {entry.lastPrAt ? new Date(entry.lastPrAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-brand)] text-xs">View</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <DevDetailDialog
          repo={selected.repo}
          entry={selected.entry}
          periodDays={selected.periodDays}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}

function ResolutionBadge({ rate }: { rate: number }) {
  const color =
    rate >= 0.7
      ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
      : rate >= 0.4
      ? 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
      : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)] ${color}`}>
      {(rate * 100).toFixed(1)}%
    </span>
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

function DevDetailDialog({
  repo,
  entry,
  periodDays,
  onClose,
}: {
  repo: RepoSettings
  entry: DeveloperEntry
  periodDays: number
  onClose: () => void
}) {
  const unresolved = entry.totalFindings - entry.resolvedFindings

  const doughnutData = {
    labels: ['Resolved', 'Unresolved'],
    datasets: [
      {
        data: [entry.resolvedFindings, Math.max(0, unresolved)],
        backgroundColor: [CHART_COLORS.resolved, CHART_COLORS.unresolved],
        borderWidth: 0,
      },
    ],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }) =>
            ` ${ctx.label}: ${ctx.parsed}`,
        },
      },
    },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_8px_32px_rgba(0,0,0,0.24)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-small-section-background)]">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <User size={16} />
              {entry.author}
            </h3>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
              {repo.workspace} / {repo.repoSlug} · last {periodDays} days
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="PRs Reviewed" value={entry.totalPrs} />
            <MetricCard label="Total Findings" value={entry.totalFindings} />
            <MetricCard label="Resolved" value={entry.resolvedFindings} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Resolution Rate"
              value={<ResolutionBadge rate={entry.resolutionRate} />}
            />
            <MetricCard
              label="Last PR"
              value={entry.lastPrAt ? new Date(entry.lastPrAt).toLocaleDateString() : '—'}
            />
          </div>

          {/* Doughnut chart — only when there's something to show */}
          {entry.totalFindings > 0 && (
            <div className="border-t border-[var(--color-cards-card-stroke)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-3">
                Findings Breakdown
              </p>
              <div style={{ height: 180 }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
