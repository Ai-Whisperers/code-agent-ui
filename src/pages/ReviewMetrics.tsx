import { useQuery, useQueries, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowUpCircle, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { VersionBadge } from '@/components/VersionBadge'
import { isVersionOutdated } from '@/lib/version'
import api from '@/lib/api'
import type { ReviewMetrics, RepoSettings, LatestVersionsResponse } from '@/types/api'

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

  const { data: latestVersions } = useQuery<LatestVersionsResponse>({
    queryKey: ['latest-versions'],
    queryFn: () => api.get('/upgrades/latest-versions').then((r) => r.data).catch(() => ({})),
    staleTime: 5 * 60 * 1000,
  })

  const reviewRepos = (Array.isArray(repos) ? repos : []).filter((r) => r.reviewEnabled && !r.archived)

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

      <TableCard
        title="Repositories"
        subtitle={`${rows.length} repo${rows.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-[33px] z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: 'Workspace',        tip: 'Git workspace slug' },
                { label: 'Repo',             tip: 'Repository slug' },
                { label: 'Archetype',        tip: 'Repository language / framework archetype' },
                { label: 'Version',          tip: 'Current primary dependency version' },
                { label: 'Findings',         tip: 'Total code review findings raised' },
                { label: 'Resolution Rate',  tip: 'Percentage of findings resolved' },
                { label: 'FP Rate',          tip: 'Proportion of findings marked as false positives' },
                { label: '',                 tip: '' },
              ] as const).map(({ label, tip }) => (
                <th
                  key={label || 'actions'}
                  className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  {tip ? <Tooltip text={tip} position="bottom">{label}</Tooltip> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={8} className="px-4 py-2">
                      <div className="h-4 skeleton-shimmer rounded" />
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
              : rows.map((row) => (
                  <tr
                    key={`${row.repo.workspace}/${row.repo.repoSlug}`}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors"
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-4 py-1.5 font-medium">{row.repo.workspace}</td>
                    <td className="px-4 py-1.5">{row.repo.repoSlug}</td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">
                      {row.repo.archetype ?? '—'}
                    </td>
                    <td className="px-4 py-1.5">
                      <VersionBadge
                        version={row.repo.archetypeVersion}
                        archetype={row.repo.archetype}
                        latestVersions={latestVersions}
                      />
                    </td>
                    <td className="px-4 py-1.5">
                      {row.metrics?.totalFindings ?? '—'}
                    </td>
                    <td className="px-4 py-1.5">
                      <RateBadge rate={row.metrics?.resolutionRate} good={0.7} warn={0.4} />
                    </td>
                    <td className="px-4 py-1.5">
                      <RateBadge rate={row.metrics?.fpRate} good={0.1} warn={0.25} invert />
                    </td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-brand)]">
                      View
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </TableCard>

      {selected && (
        <MetricsDialog row={selected} latestVersions={latestVersions} onClose={() => setSelected(null)} />
      )}
    </main>
  )
}

function RateBadge({
  rate,
  good,
  warn,
  invert = false,
}: {
  rate?: number
  good: number
  warn: number
  invert?: boolean
}) {
  if (rate === undefined || rate === null) {
    return <span className="text-[var(--color-fonts-font-color-support)]">—</span>
  }
  const isGood = invert ? rate <= good : rate >= good
  const isWarn = invert ? rate <= warn : rate >= warn
  const color = isGood
    ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
    : isWarn
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

function MetricsDialog({
  row,
  latestVersions,
  onClose,
}: {
  row: RowData
  latestVersions?: LatestVersionsResponse
  onClose: () => void
}) {
  const { repo, metrics } = row
  const navigate = useNavigate()

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
                  <VersionBadge
                    version={repo.archetypeVersion}
                    archetype={repo.archetype}
                    latestVersions={latestVersions}
                  />
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
        <div className="p-5 space-y-4">
          {metrics ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="Total Findings" value={metrics.totalFindings} />
                <MetricCard label="Resolved" value={metrics.resolvedByDeveloper} />
                <MetricCard
                  label="Resolution Rate"
                  value={<RateBadge rate={metrics.resolutionRate} good={0.7} warn={0.4} />}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="False Positives" value={metrics.falsePositives} />
                <MetricCard
                  label="FP Rate"
                  value={<RateBadge rate={metrics.fpRate} good={0.1} warn={0.25} invert />}
                />
                <MetricCard label="Auto-Suppressed" value={metrics.autoSuppressedPatterns} />
              </div>
              {Object.keys(metrics.fpByCategory ?? {}).length > 0 && (
                <FpByCategorySection fpByCategory={metrics.fpByCategory} />
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-[var(--color-fonts-font-color-support)]">
              No review metrics available yet.
            </p>
          )}

          {versionOutdated && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-cards-card-stroke)]">
              {upgradeJobMutation.isError && (
                <p className="mr-auto text-xs text-[var(--color-status-border-critical)]">
                  Failed to start job. Please try again.
                </p>
              )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FpByCategorySection({ fpByCategory }: { fpByCategory: Record<string, number> }) {
  const [expanded, setExpanded] = useState(false)
  const entries = Object.entries(fpByCategory).sort((a, b) => b[1] - a[1])
  return (
    <div className="border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-small)] overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] bg-[var(--color-cards-small-section-background)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>False Positives by Category</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <ul className="divide-y divide-[var(--color-tables-table-cell-stroke)]">
          {entries.map(([cat, count]) => (
            <li key={cat} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-[var(--color-fonts-font-color-primary)]">{cat}</span>
              <span className="font-semibold text-[var(--color-fonts-font-color-headings)]">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
