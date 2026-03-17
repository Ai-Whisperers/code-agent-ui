import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { QualityReport, RepoSettings } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
    x: { grid: { display: false } },
  },
}

function ScoreGauge({ score }: { score?: number }) {
  const pct = score ?? 0
  const color =
    pct >= 80
      ? 'var(--color-status-border-success)'
      : pct >= 50
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
          strokeDasharray={`${(pct / 100) * 314} 314`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="65" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>
          {pct.toFixed(0)}
        </text>
      </svg>
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-2">Overall Score</p>
    </div>
  )
}

export default function QualityReportsPage() {
  const [workspace, setWorkspace] = useState('')
  const [repoSlug, setRepoSlug] = useState('')
  const [branch, setBranch] = useState('main')

  const { data: repos } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const canFetch = workspace && repoSlug && branch

  const { data: report, isLoading: reportLoading } = useQuery<QualityReport>({
    queryKey: ['quality-report', workspace, repoSlug, branch],
    queryFn: () =>
      api.get(`/metrics/quality-reports/${workspace}/${repoSlug}/${branch}`).then((r) => r.data),
    enabled: !!canFetch,
  })

  const { data: history } = useQuery<QualityReport[]>({
    queryKey: ['quality-history', workspace, repoSlug, branch],
    queryFn: () =>
      api
        .get(`/metrics/quality-reports/${workspace}/${repoSlug}/${branch}/history`)
        .then((r) => r.data)
        .catch(() => []),
    enabled: !!canFetch,
  })

  const repoList = Array.isArray(repos) ? repos : []
  const historyList = Array.isArray(history) ? history : []

  const chartData = {
    labels: historyList.map((r) => new Date(r.measuredAt).toLocaleDateString()),
    datasets: [
      {
        label: 'Score',
        data: historyList.map((r) => r.score ?? 0),
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
    <main>
      <PageHeader
        title="Quality Reports"
        subtitle="Track code quality metrics over time."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
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

        <input
          type="text"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="Branch"
          className="w-40 px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none"
        />
      </div>

      {!canFetch && (
        <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
          Select a repository and branch to view quality reports.
        </div>
      )}

      {canFetch && reportLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      )}

      {canFetch && !reportLoading && report && (
        <div className="space-y-5">
          {/* Latest report */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] overflow-hidden">
            <div className="px-5 py-3 bg-[var(--color-cards-small-section-background)] border-b border-[var(--color-cards-card-stroke)]">
              <h3>Latest Report — {new Date(report.measuredAt).toLocaleString()}</h3>
            </div>
            <div className="flex flex-wrap">
              <ScoreGauge score={report.score} />
              <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-3 gap-4 p-5">
                <MetricCard label="Line Coverage" value={`${(report.coverage?.lineCoverage ?? 0).toFixed(1)}%`} />
                <MetricCard label="Linter Errors" value={report.linter?.errorCount ?? '—'} />
                <MetricCard label="Linter Warnings" value={report.linter?.warningCount ?? '—'} />
                <MetricCard label="Security Issues" value={report.aikido?.issueCount ?? '—'} />
                <MetricCard label="Critical Issues" value={report.aikido?.criticalCount ?? '—'} />
                <MetricCard
                  label="Avg Complexity"
                  value={report.complexity?.avgCyclomaticComplexity?.toFixed(1) ?? '—'}
                />
              </div>
            </div>
          </div>

          {/* History chart */}
          {historyList.length > 1 && (
            <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
              <h3 className="mb-4">Trend</h3>
              <div style={{ height: 260 }}>
                <Line data={chartData} options={CHART_OPTIONS} />
              </div>
            </div>
          )}
        </div>
      )}
    </main>
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
