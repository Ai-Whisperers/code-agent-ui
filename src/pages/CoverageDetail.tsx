import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { ArrowLeft, BarChart2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import type { QualityReport, PackageLineCoverage } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend, Filler)

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
const GREEN  = `${BADGE_BASE} bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]`
const ORANGE = `${BADGE_BASE} bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]`
const RED    = `${BADGE_BASE} bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]`

function rateBadgeClass(rate: number) {
  return rate >= 80 ? GREEN : rate >= 50 ? ORANGE : RED
}

type SortKey = 'name' | 'lineRate' | 'linesCovered' | 'linesMissed'
type SortDir = 'asc' | 'desc'

function packageLineRate(p: PackageLineCoverage) {
  const total = p.linesCovered + p.linesMissed
  return total > 0 ? (100 * p.linesCovered) / total : 0
}

interface Props {
  workspace: string
  repoSlug: string
}

export default function CoverageDetail({ workspace, repoSlug }: Props) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('lineRate')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data: report, isLoading } = useQuery<QualityReport>({
    queryKey: ['quality-report', workspace, repoSlug, 'main'],
    queryFn: () =>
      api.get(`/metrics/quality-reports/${workspace}/${repoSlug}/main`).then((r) => r.data),
  })

  const { data: history } = useQuery<QualityReport[]>({
    queryKey: ['quality-history', workspace, repoSlug, 'main'],
    queryFn: () =>
      api
        .get(`/metrics/quality-reports/${workspace}/${repoSlug}/main/history`)
        .then((r) => r.data)
        .catch(() => []),
  })

  const qualityJobMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/metrics/quality-reports/${workspace}/${repoSlug}/main`, {
          repoUrl: `${workspace}/${repoSlug}`,
        })
        .then((r) => r.data as { jobId: string }),
    onSuccess: (data) => {
      if (data?.jobId) navigate({ to: '/jobs/$id', params: { id: data.jobId } })
    },
  })

  const coverage = report?.coverage
  const packages: PackageLineCoverage[] = coverage?.packages ?? []

  const historyList = [...(Array.isArray(history) ? history : [])].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  )

  const chartData = {
    labels: historyList.map((r) => new Date(r.measuredAt).toLocaleDateString()),
    datasets: [
      {
        label: 'Line %',
        data: historyList.map((r) => r.coverage?.lineRate ?? 0),
        borderColor: '#16DB93',
        backgroundColor: 'rgba(22,219,147,0.08)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Branch %',
        data: historyList.map((r) => r.coverage?.branchRate ?? 0),
        borderColor: '#00B4FF',
        backgroundColor: 'rgba(0,180,255,0.06)',
        fill: true,
        tension: 0.4,
      },
    ],
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'asc')
    }
  }

  const sortedPackages = [...packages].sort((a, b) => {
    let av: number | string, bv: number | string
    if (sortKey === 'name') {
      av = a.name; bv = b.name
    } else if (sortKey === 'lineRate') {
      av = packageLineRate(a); bv = packageLineRate(b)
    } else if (sortKey === 'linesCovered') {
      av = a.linesCovered; bv = b.linesCovered
    } else {
      av = a.linesMissed; bv = b.linesMissed
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <main className="flex flex-col gap-4">
      <PageHeader
        title={`${workspace} / ${repoSlug}`}
        subtitle={
          report
            ? `Coverage report · ${new Date(report.measuredAt).toLocaleString()}`
            : 'Test Coverage'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={13} />}
              onClick={() => navigate({ to: '/metrics/quality' })}
            >
              Quality Reports
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={qualityJobMutation.isPending ? undefined : <BarChart2 size={13} />}
              loading={qualityJobMutation.isPending}
              onClick={() => { if (!qualityJobMutation.isPending) qualityJobMutation.mutate() }}
            >
              {qualityJobMutation.isPending ? 'Starting…' : 'Run Report'}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
        </div>
      ) : !coverage ? (
        <div className="flex items-center justify-center py-20 text-sm text-[var(--color-fonts-font-color-support)]">
          No coverage data available. Run a quality report to collect coverage metrics.
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-4">

          {/* Aggregate metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AggregateCard
              label="Line Coverage"
              rate={coverage.lineRate}
              covered={coverage.linesCovered}
              missed={coverage.linesMissed}
            />
            <AggregateCard
              label="Branch Coverage"
              rate={coverage.branchRate}
              covered={coverage.branchesCovered}
              missed={coverage.branchesMissed}
            />
            <AggregateCard
              label="Method Coverage"
              rate={coverage.methodRate}
              covered={coverage.methodsCovered}
              missed={coverage.methodsMissed}
            />
            <AggregateCard
              label="Class Coverage"
              rate={coverage.classRate}
              covered={coverage.classesCovered}
              missed={coverage.classesMissed}
            />
          </div>

          {/* Trend chart */}
          {historyList.length > 1 && (
            <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4">
              <h4 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] mb-3">
                Coverage Trend
              </h4>
              <div style={{ height: 200 }}>
                <Line data={chartData} options={CHART_OPTIONS} />
              </div>
            </div>
          )}

          {/* Package / namespace table — maxHeight prevents TableCard creating a nested scroll container */}
          <TableCard
            title="Packages / Namespaces"
            subtitle={packages.length > 0 ? `${packages.length} entries` : 'No package data'}
            maxHeight="9999px"
          >
            {packages.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[var(--color-fonts-font-color-support)]">
                No per-package breakdown available. Re-run the quality report to collect package data.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
                    <SortableHeader label="Package / Namespace" sortKey="name" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Line Coverage" sortKey="lineRate" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] w-40">
                      <Tooltip text="Visual line coverage bar" position="bottom">Coverage Bar</Tooltip>
                    </th>
                    <SortableHeader label="Covered" sortKey="linesCovered" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Missed" sortKey="linesMissed" current={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedPackages.map((pkg) => {
                    const rate = packageLineRate(pkg)
                    const total = pkg.linesCovered + pkg.linesMissed
                    return (
                      <tr
                        key={pkg.name}
                        className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
                      >
                        <td className="px-4 py-1.5 font-mono text-[11px] text-[var(--color-fonts-font-color-primary)] max-w-xs truncate">
                          {pkg.name.replace(/\//g, '.')}
                        </td>
                        <td className="px-4 py-1.5">
                          <span className={rateBadgeClass(rate)}>{rate.toFixed(1)}%</span>
                        </td>
                        <td className="px-4 py-1.5 w-40">
                          <CoverageBar rate={rate} />
                        </td>
                        <td className="px-4 py-1.5 tabular-nums text-[var(--color-fonts-font-color-primary)]">
                          {pkg.linesCovered}
                        </td>
                        <td className="px-4 py-1.5 tabular-nums text-[var(--color-fonts-font-color-support)]">
                          {pkg.linesMissed}
                          <span className="text-[var(--color-fonts-font-color-support)] ml-1">/ {total}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </TableCard>
        </div>
      )}
    </main>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AggregateCard({
  label,
  rate,
  covered,
  missed,
}: {
  label: string
  rate?: number
  covered?: number
  missed?: number
}) {
  const r = rate ?? 0
  const color =
    r >= 80
      ? 'var(--color-status-border-success)'
      : r >= 50
      ? 'var(--color-status-border-attention)'
      : 'var(--color-status-border-critical)'

  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 flex flex-col gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
        {label}
      </p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color }}>
          {rate !== undefined ? `${r.toFixed(1)}%` : '—'}
        </span>
      </div>
      {covered !== undefined && missed !== undefined && (
        <>
          <div className="w-full h-1.5 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, r)}%`, backgroundColor: color }}
            />
          </div>
          <p className="text-[10px] text-[var(--color-fonts-font-color-support)]">
            {covered} / {covered + missed} lines
          </p>
        </>
      )}
    </div>
  )
}

function CoverageBar({ rate }: { rate: number }) {
  const color =
    rate >= 80
      ? 'var(--color-status-border-success)'
      : rate >= 50
      ? 'var(--color-status-border-attention)'
      : 'var(--color-status-border-critical)'
  return (
    <div className="w-full h-2 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, rate)}%`, backgroundColor: color }}
      />
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer select-none hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
        ) : (
          <ChevronDown size={11} className="opacity-30" />
        )}
      </span>
    </th>
  )
}
