import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
  TimeScale,
  type ChartOptions,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { CoverageTrendResponse, CoverageTrendPoint, RepoSettings } from '@/types/api'

ChartJS.register(
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
  { label: '1 year',   value: 365 },
]

const BRANCH_OPTIONS = ['main', 'develop']

// Deterministic colour palette for up to 12 repos
const PALETTE = [
  'rgba(99,130,255,1)',
  'rgba(22,219,147,1)',
  'rgba(255,185,0,1)',
  'rgba(255,99,99,1)',
  'rgba(0,200,220,1)',
  'rgba(200,100,255,1)',
  'rgba(255,140,0,1)',
  'rgba(80,200,120,1)',
  'rgba(255,60,130,1)',
  'rgba(60,180,255,1)',
  'rgba(180,180,60,1)',
  'rgba(140,80,255,1)',
]

export default function CoverageTrendPage() {
  const [days, setDays]       = useState(90)
  const [branch, setBranch]   = useState('main')
  const [threshold, setThreshold] = useState(80)
  const [hiddenRepos, setHiddenRepos] = useState<Set<string>>(new Set())

  const { data: repos } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const qualityRepos = (Array.isArray(repos) ? repos : []).filter((r) => !r.archived)

  // Use the first workspace found (all repos share a workspace in typical deployments)
  const workspace = qualityRepos[0]?.workspace ?? ''

  const { data: trendData, isLoading } = useQuery<CoverageTrendResponse>({
    queryKey: ['coverage-trend', workspace, branch, days],
    queryFn: () =>
      api
        .get(`/metrics/quality-reports/${workspace}/all/coverage-trend?branch=${branch}&days=${days}`)
        .then((r) => r.data),
    enabled: !!workspace,
  })

  // Group trend points by repo
  const repoSlugs = useMemo(() => {
    const slugs = new Set<string>()
    trendData?.trend?.forEach((pt) => slugs.add(pt.repoSlug))
    return Array.from(slugs).sort()
  }, [trendData])

  // All unique week labels (sorted)
  const allWeeks = useMemo(() => {
    const weeks = new Set<string>()
    trendData?.trend?.forEach((pt) => { if (pt.week) weeks.add(pt.week) })
    return Array.from(weeks).sort()
  }, [trendData])

  const visibleRepos = repoSlugs.filter((s) => !hiddenRepos.has(s))

  const chartDatasets = visibleRepos.map((slug, idx) => {
    const pointsByWeek = new Map<string, number | null>()
    trendData?.trend
      ?.filter((pt: CoverageTrendPoint) => pt.repoSlug === slug)
      .forEach((pt) => pointsByWeek.set(pt.week, pt.avgLineRate != null ? pt.avgLineRate * 100 : null))

    return {
      label: slug,
      data: allWeeks.map((w) => pointsByWeek.get(w) ?? null),
      borderColor: PALETTE[idx % PALETTE.length],
      backgroundColor: PALETTE[idx % PALETTE.length].replace(',1)', ',0.08)'),
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      spanGaps: true,
    }
  })

  // Threshold reference line dataset
  if (allWeeks.length > 0) {
    chartDatasets.push({
      label: `Threshold (${threshold}%)`,
      data: allWeeks.map(() => threshold),
      borderColor: 'rgba(255,99,99,0.6)',
      backgroundColor: 'transparent',
      fill: false,
      tension: 0,
      pointRadius: 0,
      spanGaps: true,
      borderDash: [5, 4],
    } as typeof chartDatasets[0])
  }

  const chartData = {
    labels: allWeeks,
    datasets: chartDatasets,
  }

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y
            return v != null ? ` ${ctx.dataset.label}: ${v.toFixed(1)}%` : ` ${ctx.dataset.label}: —`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'week', tooltipFormat: 'MMM d, yyyy' },
        grid: { color: 'rgba(128,128,128,0.1)' },
        ticks: { font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: (v) => `${v}%`,
          font: { size: 10 },
        },
        grid: { color: 'rgba(128,128,128,0.1)' },
      },
    },
  }

  function toggleRepo(slug: string) {
    setHiddenRepos((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Coverage Trend"
        subtitle="Test coverage % per repository over time, aggregated weekly from quality reports."
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* Period */}
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

        {/* Branch */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-fonts-font-color-support)]">Branch:</span>
          <div className="flex gap-1">
            {BRANCH_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => setBranch(b)}
                className={`px-3 py-1 text-xs rounded-[var(--border-radius-button-small)] font-medium transition-colors ${
                  branch === b
                    ? 'bg-[var(--color-buttons-button-primary)] text-[var(--color-buttons-button-primary-text)]'
                    : 'bg-[var(--color-cards-small-section-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Threshold */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-fonts-font-color-support)]">Threshold:</span>
          <input
            type="number"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Math.min(100, Math.max(0, Number(e.target.value))))}
            className="w-16 px-2 py-1 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-cards-small-section-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)]"
          />
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">%</span>
        </div>
      </div>

      {/* Repo filter checkboxes */}
      {repoSlugs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {repoSlugs.map((slug, idx) => (
            <button
              key={slug}
              onClick={() => toggleRepo(slug)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[var(--border-radius-tag)] border transition-colors ${
                hiddenRepos.has(slug)
                  ? 'border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-support)] opacity-40'
                  : 'border-transparent text-[var(--color-fonts-font-color-primary)]'
              }`}
              style={
                hiddenRepos.has(slug)
                  ? {}
                  : { backgroundColor: PALETTE[idx % PALETTE.length].replace(',1)', ',0.15)') }
              }
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
              />
              {slug}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-4 w-32 skeleton-shimmer rounded" />
          </div>
        ) : allWeeks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-[var(--color-fonts-font-color-support)]">
            <TrendingUp size={28} className="opacity-30" />
            <span className="text-sm">No coverage data found for {branch} in this period.</span>
            <span className="text-xs">
              Trigger a Quality Report job for a repository to start collecting coverage data.
            </span>
          </div>
        ) : (
          <div style={{ height: Math.max(320, repoSlugs.length * 20 + 260) }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </main>
  )
}
