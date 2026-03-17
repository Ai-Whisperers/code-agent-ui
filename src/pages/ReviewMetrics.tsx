import { useQuery, useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { ReviewMetrics, RepoSettings } from '@/types/api'

type RowData = {
  repo: RepoSettings
  metrics: ReviewMetrics | undefined
  isLoading: boolean
}

export default function ReviewMetricsPage() {
  const [selected, setSelected] = useState<RowData | null>(null)

  const { data: repos, isLoading: reposLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const reviewRepos = (Array.isArray(repos) ? repos : []).filter((r) => r.reviewEnabled)

  const metricQueries = useQueries({
    queries: reviewRepos.map((repo) => ({
      queryKey: ['review-metrics', repo.workspace, repo.repoSlug],
      queryFn: () =>
        api
          .get(`/metrics/review-quality/${repo.workspace}/${repo.repoSlug}`)
          .then((r) => r.data as ReviewMetrics)
          .catch(() => undefined),
      enabled: reviewRepos.length > 0,
    })),
  })

  const rows: RowData[] = reviewRepos.map((repo, i) => ({
    repo,
    metrics: metricQueries[i]?.data,
    isLoading: metricQueries[i]?.isLoading ?? false,
  }))

  const isLoading = reposLoading || metricQueries.some((q) => q.isLoading)

  return (
    <main>
      <PageHeader title="Review Metrics" subtitle="AI code review quality metrics per repository." />

      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
              {['Workspace', 'Repo', 'Archetype', 'Version', 'Total Reviews', 'Avg Score', 'Last Review', ''].map((h) => (
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
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-5 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : rows.length === 0
              ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No repositories have code review enabled.
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
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">
                      {row.repo.archetypeVersion ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.metrics?.totalReviews ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={row.metrics?.avgScore} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">
                      {row.metrics?.lastReviewAt
                        ? new Date(row.metrics.lastReviewAt).toLocaleDateString()
                        : '—'}
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
        <MetricsDialog row={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  )
}

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) {
    return <span className="text-[var(--color-fonts-font-color-support)]">—</span>
  }
  const color =
    score >= 0.8
      ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
      : score >= 0.5
      ? 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
      : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)] ${color}`}>
      {score.toFixed(2)}
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

function MetricsDialog({ row, onClose }: { row: RowData; onClose: () => void }) {
  const { repo, metrics } = row

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
            <h3 className="font-semibold">
              {repo.workspace} / {repo.repoSlug}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              {repo.archetype && (
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  Archetype:{' '}
                  <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
                    {repo.archetype}
                  </span>
                </span>
              )}
              {repo.archetypeVersion && (
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  Version:{' '}
                  <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
                    {repo.archetypeVersion}
                  </span>
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
        <div className="p-5">
          {metrics ? (
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label="Total Reviews" value={metrics.totalReviews} />
              <MetricCard label="Avg Score" value={metrics.avgScore?.toFixed(2) ?? '—'} />
              <MetricCard
                label="Last Review"
                value={
                  metrics.lastReviewAt
                    ? new Date(metrics.lastReviewAt).toLocaleDateString()
                    : '—'
                }
              />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--color-fonts-font-color-support)]">
              No review metrics available yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
