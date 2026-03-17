import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { ReviewMetrics, RepoSettings } from '@/types/api'

export default function ReviewMetricsPage() {
  const [workspace, setWorkspace] = useState('')
  const [repoSlug, setRepoSlug] = useState('')

  const { data: repos } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const canFetch = workspace && repoSlug

  const { data: metrics, isLoading } = useQuery<ReviewMetrics>({
    queryKey: ['review-metrics', workspace, repoSlug],
    queryFn: () =>
      api.get(`/metrics/review-quality/${workspace}/${repoSlug}`).then((r) => r.data),
    enabled: !!canFetch,
  })

  const repoList = Array.isArray(repos) ? repos : []

  return (
    <main>
      <PageHeader title="Review Metrics" subtitle="AI code review quality metrics per repository." />

      <div className="mb-6">
        <select
          value={`${workspace}/${repoSlug}`}
          onChange={(e) => {
            const [ws, rs] = e.target.value.split('/')
            setWorkspace(ws ?? '')
            setRepoSlug(rs ?? '')
          }}
          className="px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none"
        >
          <option value="/">Select repository…</option>
          {repoList.map((r) => (
            <option key={`${r.workspace}/${r.repoSlug}`} value={`${r.workspace}/${r.repoSlug}`}>
              {r.workspace} / {r.repoSlug}
            </option>
          ))}
        </select>
      </div>

      {!canFetch && (
        <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
          Select a repository to view review metrics.
        </div>
      )}

      {canFetch && isLoading && (
        <div className="h-40 skeleton-shimmer rounded-[var(--border-radius-card)]" />
      )}

      {canFetch && !isLoading && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ['Total Reviews', metrics.totalReviews],
            ['Avg Score', metrics.avgScore?.toFixed(2) ?? '—'],
            ['Last Review', metrics.lastReviewAt ? new Date(metrics.lastReviewAt).toLocaleDateString() : '—'],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]"
            >
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-2 uppercase tracking-wide">
                {label}
              </p>
              <p className="text-2xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
