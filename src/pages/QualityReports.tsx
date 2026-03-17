import { useQuery, useQueries, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { ArrowUpCircle, BarChart2, Loader2, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { VersionBadge } from '@/components/VersionBadge'
import { isVersionOutdated } from '@/lib/version'
import api from '@/lib/api'
import type { QualityReport, RepoSettings, LatestVersionsResponse } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    tooltip: { callbacks: { title: (items: { label: string }[]) => items[0]?.label ?? '' } },
  },
  scales: {
    y: {
      beginAtZero: true,
      max: 100,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { callback: (v: number | string) => `${v}%` },
    },
    x: { grid: { display: false } },
  },
}

const BADGE_BASE = 'text-xs font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)]'
const GREEN = `${BADGE_BASE} bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]`
const ORANGE = `${BADGE_BASE} bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]`
const RED = `${BADGE_BASE} bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]`
const NONE = 'text-[var(--color-fonts-font-color-support)]'

type RowData = {
  repo: RepoSettings
  report: QualityReport | undefined
  isLoading: boolean
}

export default function QualityReportsPage() {
  const [selected, setSelected] = useState<RowData | null>(null)

  const { data: repos, isLoading: reposLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const { data: latestVersions } = useQuery<LatestVersionsResponse>({
    queryKey: ['latest-versions'],
    queryFn: () => api.get('/upgrades/latest-versions').then((r) => r.data).catch(() => ({})),
    staleTime: 5 * 60 * 1000,
  })

  const qualityRepos = (Array.isArray(repos) ? repos : []).filter((r) => r.qualityReportEnabled)

  const reportQueries = useQueries({
    queries: qualityRepos.map((repo) => ({
      queryKey: ['quality-report', repo.workspace, repo.repoSlug, 'main'],
      queryFn: () =>
        api
          .get(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/main`)
          .then((r) => r.data as QualityReport)
          .catch(() => undefined),
      enabled: qualityRepos.length > 0,
    })),
  })

  const rows: RowData[] = qualityRepos.map((repo, i) => ({
    repo,
    report: reportQueries[i]?.data,
    isLoading: reportQueries[i]?.isLoading ?? false,
  }))

  const isLoading = reposLoading || reportQueries.some((q) => q.isLoading)

  return (
    <main>
      <PageHeader
        title="Quality Reports"
        subtitle="Code quality metrics per repository."
      />

      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
              {['Workspace', 'Repo', 'Archetype', 'Version', 'Score', 'Linter Errors', 'Security Issues', 'Avg Complexity', 'Last Measured', ''].map((h) => (
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
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={10} className="px-4 py-3">
                      <div className="h-5 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : rows.length === 0
              ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No repositories have quality reports enabled.
                  </td>
                </tr>
              )
              : rows.map((row, i) => (
                  <tr
                    key={`${row.repo.workspace}/${row.repo.repoSlug}`}
                    className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
                      i % 2 === 0 ? 'bg-[var(--color-tables-table-row-a)]' : ''
                    }`}
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-3 font-medium">{row.repo.workspace}</td>
                    <td className="px-4 py-3">{row.repo.repoSlug}</td>
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">
                      {row.repo.archetype ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <VersionBadge
                        version={row.repo.archetypeVersion}
                        archetype={row.repo.archetype}
                        latestVersions={latestVersions}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={row.report?.score} />
                    </td>
                    <td className="px-4 py-3">
                      <LinterErrorsBadge count={row.report?.linter?.errorCount} />
                    </td>
                    <td className="px-4 py-3">
                      <SecurityBadge
                        issueCount={row.report?.aikido?.issueCount}
                        criticalCount={row.report?.aikido?.criticalCount}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ComplexityBadge value={row.report?.complexity?.avgComplexity} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">
                      {row.report ? new Date(row.report.measuredAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-brand)] text-xs">
                      View
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ReportDialog
          row={selected}
          latestVersions={latestVersions}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  )
}

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined) return <span className={NONE}>—</span>
  const pct = score * 100
  const color =
    score >= 0.8 ? GREEN : score >= 0.5 ? ORANGE : RED
  return (
    <span className={color}>
      {pct.toFixed(0)}%
    </span>
  )
}

function LinterErrorsBadge({ count }: { count?: number }) {
  if (count === undefined || count === null) return <span className={NONE}>—</span>
  const cls = count === 0 ? GREEN : count < 10 ? ORANGE : RED
  return <span className={cls}>{count}</span>
}

function LinterWarningsBadge({ count }: { count?: number }) {
  if (count === undefined || count === null) return <span className={NONE}>—</span>
  const cls = count === 0 ? GREEN : count < 20 ? ORANGE : RED
  return <span className={cls}>{count}</span>
}

function SecurityBadge({ issueCount, criticalCount }: { issueCount?: number; criticalCount?: number }) {
  if (issueCount === undefined || issueCount === null) return <span className={NONE}>—</span>
  const hasCritical = !!criticalCount
  const cls = issueCount === 0 ? GREEN : (issueCount < 5 && !hasCritical) ? ORANGE : RED
  const label = issueCount + (hasCritical ? ` (${criticalCount} critical)` : '')
  return <span className={cls}>{label}</span>
}

function ComplexityBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span className={NONE}>—</span>
  const cls = value <= 5 ? GREEN : value <= 10 ? ORANGE : RED
  return <span className={cls}>{value.toFixed(1)}</span>
}

function MaxComplexityBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span className={NONE}>—</span>
  const cls = value <= 10 ? GREEN : value <= 20 ? ORANGE : RED
  return <span className={cls}>{value}</span>
}

function CoverageBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span className={NONE}>—</span>
  const cls = value >= 80 ? GREEN : value >= 50 ? ORANGE : RED
  return <span className={cls}>{value.toFixed(1)}%</span>
}

function CriticalIssuesBadge({ count }: { count?: number }) {
  if (count === undefined || count === null) return <span className={NONE}>—</span>
  const cls = count === 0 ? GREEN : count === 1 ? ORANGE : RED
  return <span className={cls}>{count}</span>
}

function ScoreGauge({ score }: { score?: number }) {
  const pct = score ?? 0
  const color =
    pct >= 0.8
      ? 'var(--color-status-border-success)'
      : pct >= 0.5
      ? 'var(--color-status-border-attention)'
      : 'var(--color-status-border-critical)'
  return (
    <div className="flex flex-col items-center justify-center p-6">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-neutral-200)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${pct * 314} 314`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="60" textAnchor="middle" fontSize="20" fontWeight="bold" fill={color}>
          {(pct * 100).toFixed(0)}%
        </text>
        <text x="60" y="78" textAnchor="middle" fontSize="10" fill="var(--color-fonts-font-color-support)">
          score
        </text>
      </svg>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-cards-small-section-background)] rounded-[var(--border-radius-small)] p-3">
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">{label}</p>
      <p className="text-lg font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
    </div>
  )
}

function ReportDialog({
  row,
  latestVersions,
  onClose,
}: {
  row: RowData
  latestVersions?: LatestVersionsResponse
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { repo, report } = row

  const { data: history } = useQuery<QualityReport[]>({
    queryKey: ['quality-history', repo.workspace, repo.repoSlug, 'main'],
    queryFn: () =>
      api
        .get(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/main/history`)
        .then((r) => r.data)
        .catch(() => []),
  })

  const qualityJobMutation = useMutation({
    mutationFn: () => {
      const bitbucketBase = import.meta.env.VITE_BITBUCKET_URL ?? 'https://bitbucket.org'
      const repoUrl = `${bitbucketBase}/${repo.workspace}/${repo.repoSlug}.git`
      return api
        .post(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/main`, { repoUrl })
        .then((r) => r.data as { jobId: string })
    },
    onSuccess: (data) => {
      if (data?.jobId) {
        navigate({ to: '/jobs/$id', params: { id: data.jobId } })
      }
    },
  })

  const upgradeJobMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/upgrades/check/${repo.workspace}/${repo.repoSlug}`)
        .then((r) => r.data as { jobId: string }),
    onSuccess: (data) => {
      if (data?.jobId) {
        navigate({ to: '/jobs/$id', params: { id: data.jobId } })
      }
    },
  })

  const versionOutdated = isVersionOutdated(repo.archetypeVersion, repo.archetype, latestVersions)

  const historyList = [...(Array.isArray(history) ? history : [])].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  )

  const chartData = {
    labels: historyList.map((r) => new Date(r.measuredAt).toLocaleString()),
    datasets: [
      {
        label: 'Score %',
        data: historyList.map((r) => +((r.score ?? 0) * 100).toFixed(1)),
        borderColor: '#00B4FF',
        backgroundColor: 'rgba(0,180,255,0.08)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Coverage %',
        data: historyList.map((r) => r.coverage?.lineCoverage ?? 0),
        borderColor: '#16DB93',
        backgroundColor: 'rgba(22,219,147,0.08)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_8px_32px_rgba(0,0,0,0.24)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-small-section-background)]">
          <div>
            <h3 className="font-semibold">
              {repo.workspace} / {repo.repoSlug}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              {repo.archetype && (
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  Archetype: <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{repo.archetype}</span>
                </span>
              )}
              {repo.archetypeVersion && (
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  Version:{' '}
                  <VersionBadge
                    version={repo.archetypeVersion}
                    archetype={repo.archetype}
                    latestVersions={latestVersions}
                  />
                </span>
              )}
              {report && (
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  {new Date(report.measuredAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {report ? (
            <>
              {/* Score + metrics */}
              <div className="flex flex-wrap">
                <ScoreGauge score={report.score} />
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-3 py-4 pr-2">
                  <MetricCard label="Line Coverage" value={<CoverageBadge value={report.coverage?.lineCoverage} />} />
                  <MetricCard label="Linter Errors" value={<LinterErrorsBadge count={report.linter?.errorCount} />} />
                  <MetricCard label="Linter Warnings" value={<LinterWarningsBadge count={report.linter?.warningCount} />} />
                  <MetricCard label="Security Issues" value={<SecurityBadge issueCount={report.aikido?.issueCount} criticalCount={report.aikido?.criticalCount} />} />
                  <MetricCard label="Critical Issues" value={<CriticalIssuesBadge count={report.aikido?.criticalCount} />} />
                  <MetricCard label="Avg Complexity" value={<ComplexityBadge value={report.complexity?.avgComplexity} />} />
                  <MetricCard label="Max Complexity" value={<MaxComplexityBadge value={report.complexity?.maxComplexity} />} />
                  <MetricCard
                    label="Methods Above Threshold"
                    value={
                      report.complexity?.methodsAboveThreshold !== undefined
                        ? `${report.complexity.methodsAboveThreshold} / ${report.complexity.totalMethods ?? '?'}`
                        : '—'
                    }
                  />
                </div>
              </div>

              {/* Trend chart */}
              {historyList.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] mb-3">Trend</h4>
                  <div style={{ height: 220 }}>
                    <Line data={chartData} options={CHART_OPTIONS} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--color-fonts-font-color-support)]">
              No report available yet. Run a quality report to get started.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-cards-card-stroke)]">
            {(qualityJobMutation.isError || upgradeJobMutation.isError) && (
              <p className="mr-auto text-xs text-[var(--color-status-border-critical)]">
                Failed to start job. Please try again.
              </p>
            )}
            {versionOutdated && (
              <button
                onClick={() => upgradeJobMutation.mutate()}
                disabled={upgradeJobMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)] text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {upgradeJobMutation.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ArrowUpCircle size={15} />
                )}
                {upgradeJobMutation.isPending ? 'Starting…' : 'Run Upgrade'}
              </button>
            )}
            <button
              onClick={() => qualityJobMutation.mutate()}
              disabled={qualityJobMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {qualityJobMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <BarChart2 size={15} />
              )}
              {qualityJobMutation.isPending ? 'Starting…' : 'Run Quality Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
