import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, useCallback, useMemo, useEffect, Fragment } from 'react'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
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
import { ArrowLeft, BarChart2, ChevronUp, ChevronDown, Loader2, FlaskConical, Info, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import type { QualityReport, PackageLineCoverage, RepoSettings, SystemSetting } from '@/types/api'

const BITBUCKET_BASE_URL = import.meta.env.VITE_BITBUCKET_URL ?? 'https://bitbucket.org'

// Coverage threshold below which the "Generate Tests" button is shown per row
const COVERAGE_THRESHOLD = 90

// Token budget estimates per generate-tests job (one job = one package/namespace)
const GT_INPUT_LOW   = 50_000
const GT_INPUT_HIGH  = 200_000
const GT_OUTPUT_LOW  = 10_000
const GT_OUTPUT_HIGH = 50_000
const DEFAULT_INPUT_COST_PER_M  = 3.00
const DEFAULT_OUTPUT_COST_PER_M = 15.00

function formatCost(usd: number) {
  return usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`
}
function fmtTokens(n: number) {
  return n >= 1_000_000 ? `~${(n / 1_000_000).toFixed(1)}M` : `~${(n / 1_000).toFixed(0)}k`
}

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

export function packageLineRate(p: PackageLineCoverage) {
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
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])
  // null = dialog closed; array = packages to confirm
  const [confirmTargets, setConfirmTargets] = useState<PackageLineCoverage[] | null>(null)

  const { data: repos } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const repoSettings = repos?.find(
    (r) => r.workspace === workspace && r.repoSlug === repoSlug,
  )

  const { data: allSettings } = useQuery<SystemSetting[]>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data).catch(() => []),
    staleTime: 5 * 60 * 1000,
  })
  const getSetting = (key: string, fallback: string) =>
    allSettings?.find((s) => s.key === key)?.value ?? fallback
  const aiModelName    = getSetting('anthropic.model', 'claude-sonnet-4-20250514')
  const inputCostPerM  = parseFloat(getSetting('anthropic.pricing.input-per-million',  String(DEFAULT_INPUT_COST_PER_M)))
  const outputCostPerM = parseFloat(getSetting('anthropic.pricing.output-per-million', String(DEFAULT_OUTPUT_COST_PER_M)))

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

  const generateTestsMutation = useMutation({
    mutationFn: async ({ pkgs, batchSize }: { pkgs: PackageLineCoverage[]; batchSize: number }) => {
      const gitBase = (repoSettings?.gitPlatformUrl ?? BITBUCKET_BASE_URL).replace(/\/$/, '')
      const repoUrl = `${gitBase}/${workspace}/${repoSlug}.git`
      const date = new Date().toISOString().slice(0, 10)

      if (pkgs.length === 1) {
        // Single package: dedicated branch
        const safeName = pkgs[0].name.replace(/[/.\\]/g, '-').slice(0, 40)
        const branchName = `agent/tests/${safeName}-${date}`
        const data = await api
          .post('/generate-tests', { repoUrl, branchName, targetFiles: [pkgs[0].name] })
          .then((r) => r.data as { jobId: string })
        return { jobIds: [data.jobId] }
      }

      // Split into chunks of at most batchSize
      const effectiveBatch = Math.max(1, batchSize)
      const chunks: PackageLineCoverage[][] = []
      for (let i = 0; i < pkgs.length; i += effectiveBatch) {
        chunks.push(pkgs.slice(i, i + effectiveBatch))
      }

      const results = await Promise.allSettled(
        chunks.map((chunk, idx) => {
          const suffix = chunks.length > 1 ? `-batch${idx + 1}` : ''
          const branchName = `agent/tests/improve-coverage-${date}${suffix}`
          return api
            .post('/generate-tests', { repoUrl, branchName, targetFiles: chunk.map((p) => p.name) })
            .then((r) => (r.data as { jobId: string }).jobId)
        }),
      )

      const jobIds = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map((r) => r.value)
      const failed = results.filter((r) => r.status === 'rejected').length

      if (jobIds.length === 0) throw new Error('All job submissions failed')
      return { jobIds, failed }
    },
    onSuccess: ({ jobIds, failed }) => {
      setConfirmTargets(null)
      const count = jobIds.length
      const message =
        count === 1
          ? 'Generate tests job queued successfully.'
          : `${count} generate tests job${count > 1 ? 's' : ''} queued${failed ? ` (${failed} failed)` : ''}.`
      setToast({
        variant: failed ? 'error' : 'success',
        message,
        action: jobIds[0]
          ? { label: 'View first job', onClick: () => navigate({ to: '/jobs/$id', params: { id: jobIds[0] } }) }
          : undefined,
        duration: 8000,
      })
    },
    onError: () => {
      setConfirmTargets(null)
      setToast({ variant: 'error', message: 'Failed to queue the job. Please try again.' })
    },
  })

  const coverage = report?.coverage
  const packages: PackageLineCoverage[] = useMemo(
    () => coverage?.packages ?? [],
    [coverage],
  )

  const belowThreshold = useMemo(
    () => packages.filter((p) => packageLineRate(p) < COVERAGE_THRESHOLD),
    [packages],
  )

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
            <Tooltip
              text={
                belowThreshold.length > 0
                  ? `Queue one job per package below ${COVERAGE_THRESHOLD}% coverage (${belowThreshold.length} packages)`
                  : 'All packages meet the coverage threshold'
              }
              position="bottom"
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<FlaskConical size={13} />}
                disabled={belowThreshold.length === 0}
                onClick={() => setConfirmTargets(belowThreshold)}
              >
                Generate Tests
              </Button>
            </Tooltip>
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
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] w-28">
                      <Tooltip text={`Generate tests for packages below ${COVERAGE_THRESHOLD}%`} position="bottom">Actions</Tooltip>
                    </th>
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
                        <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                          {rate < COVERAGE_THRESHOLD && (
                            <Tooltip text={`Generate tests for ${pkg.name.replace(/\//g, '.')}`} position="left">
                              <button
                                onClick={() => setConfirmTargets([pkg])}
                                className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-buttons-button-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
                              >
                                <FlaskConical size={13} />
                              </button>
                            </Tooltip>
                          )}
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

      {toast && <Toast {...toast} onClose={dismissToast} />}

      {confirmTargets && (
        <GenerateTestsConfirmDialog
          packages={confirmTargets}
          modelName={aiModelName}
          inputCostPerM={inputCostPerM}
          outputCostPerM={outputCostPerM}
          isPending={generateTestsMutation.isPending}
          onConfirm={(batchSize, selectedPkgs) =>
            generateTestsMutation.mutate({ pkgs: selectedPkgs, batchSize })
          }
          onCancel={() => setConfirmTargets(null)}
        />
      )}
    </main>
  )
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

export function GenerateTestsConfirmDialog({
  packages,
  modelName,
  inputCostPerM,
  outputCostPerM,
  isPending,
  onConfirm,
  onCancel,
}: {
  packages: PackageLineCoverage[]
  modelName: string
  inputCostPerM: number
  outputCostPerM: number
  isPending: boolean
  onConfirm: (batchSize: number, selectedPackages: PackageLineCoverage[]) => void
  onCancel: () => void
}) {
  // Internal list the user can trim by removing individual packages or whole jobs
  const [activePackages, setActivePackages] = useState<PackageLineCoverage[]>(packages)

  function removePackage(name: string) {
    setActivePackages((prev) => prev.filter((p) => p.name !== name))
  }

  function removeJob(jobIndex: number, batch: number) {
    const start = jobIndex * batch
    const end = start + batch
    setActivePackages((prev) => prev.filter((_, i) => i < start || i >= end))
  }

  const total  = activePackages.length
  const isBulk = total > 1

  // Default batch size: 3 for bulk (safe for loop limits), unlimited for single
  const [batchSize, setBatchSize] = useState(packages.length > 1 ? Math.min(3, packages.length) : packages.length)

  // Clamp batch size whenever packages are removed
  useEffect(() => {
    if (batchSize > total && total > 0) setBatchSize(total)
  }, [total, batchSize])

  const effectiveBatch = Math.max(1, Math.min(batchSize, total))
  const jobCount = isBulk ? Math.ceil(total / effectiveBatch) : 1

  // Cost per job scales with packages in that job
  const pkgsPerJob = isBulk ? effectiveBatch : 1
  const inputLow  = Math.min(GT_INPUT_LOW  * pkgsPerJob, 300_000)
  const inputHigh = Math.min(GT_INPUT_HIGH * pkgsPerJob, 800_000)
  const outputLow  = Math.min(GT_OUTPUT_LOW  * pkgsPerJob, 80_000)
  const outputHigh = Math.min(GT_OUTPUT_HIGH * pkgsPerJob, 200_000)

  // Total across all jobs
  const lowCost  = jobCount * (inputLow  * inputCostPerM + outputLow  * outputCostPerM) / 1_000_000
  const highCost = jobCount * (inputHigh * inputCostPerM + outputHigh * outputCostPerM) / 1_000_000
  const lowTok   = jobCount * (inputLow  + outputLow)
  const highTok  = jobCount * (inputHigh + outputHigh)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {/* max-h + flex-col keeps header/footer pinned while the middle scrolls */}
      <div className="w-full max-w-[500px] max-h-[90vh] flex flex-col rounded-lg bg-[var(--color-cards-card-background)] shadow-xl">

        {/* ── Fixed header ── */}
        <div className="shrink-0 flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[var(--color-borders-border-primary)]">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
            <FlaskConical size={15} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              Queue generate tests {jobCount > 1 ? 'jobs' : 'job'}?
            </h2>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
              {isBulk
                ? `${jobCount} job${jobCount > 1 ? 's' : ''} · ${effectiveBatch} package${effectiveBatch > 1 ? 's' : ''}/job · ${jobCount} PR${jobCount > 1 ? 's' : ''}`
                : '1 job · 1 package · 1 PR — clones the repo, writes tests, validates, and opens a PR.'}
            </p>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Batch size control (bulk only) */}
          {isBulk && (
            <div className="rounded-lg border border-[var(--color-borders-border-primary)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)]">
                    Packages per job
                  </p>
                  <p className="text-[10px] text-[var(--color-fonts-font-color-support)] mt-0.5">
                    Smaller batches reduce the risk of hitting the agent loop limit.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="w-6 h-6 rounded border border-[var(--color-borders-border-primary)] text-sm font-semibold flex items-center justify-center hover:bg-[var(--color-cards-card-background-hover)] disabled:opacity-40"
                    onClick={() => setBatchSize((s) => Math.max(1, s - 1))}
                    disabled={effectiveBatch <= 1 || isPending}
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={total}
                    value={batchSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v)) setBatchSize(Math.min(total, Math.max(1, v)))
                    }}
                    className="w-12 text-center text-xs border border-[var(--color-borders-border-primary)] rounded px-1 py-0.5 bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)]"
                    disabled={isPending}
                  />
                  <button
                    className="w-6 h-6 rounded border border-[var(--color-borders-border-primary)] text-sm font-semibold flex items-center justify-center hover:bg-[var(--color-cards-card-background-hover)] disabled:opacity-40"
                    onClick={() => setBatchSize((s) => Math.min(activePackages.length, s + 1))}
                    disabled={effectiveBatch >= total || isPending}
                  >+</button>
                </div>
              </div>
            </div>
          )}

          {/* Package table */}
          <div className="rounded-lg border border-[var(--color-borders-border-primary)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-[var(--color-cards-card-background-hover)] border-b border-[var(--color-borders-border-primary)]">
                  <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">Package / Namespace</th>
                  <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] w-20">Line %</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {activePackages.map((pkg, idx) => {
                  const rate = packageLineRate(pkg)
                  const jobIndex = Math.floor(idx / effectiveBatch)
                  const isFirstInJob = idx % effectiveBatch === 0
                  const showJobDivider = isBulk && jobCount > 1 && isFirstInJob
                  // A job can be removed only if it won't leave 0 packages
                  const jobPkgCount = Math.min(effectiveBatch, activePackages.length - jobIndex * effectiveBatch)
                  const canRemoveJob = jobPkgCount < total
                  return (
                    <Fragment key={pkg.name}>
                      {showJobDivider && (
                        <tr key={`divider-${jobIndex}`} className="bg-[var(--color-cards-card-background-hover)]">
                          <td className="px-3 py-1 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                            Job {jobIndex + 1}
                            <span className="ml-1 normal-case font-normal">({jobPkgCount} pkg{jobPkgCount > 1 ? 's' : ''})</span>
                          </td>
                          <td />
                          <td className="px-2 py-1 text-center">
                            {canRemoveJob && (
                              <button
                                onClick={() => removeJob(jobIndex, effectiveBatch)}
                                disabled={isPending}
                                title="Remove this entire job"
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-status-border-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors disabled:pointer-events-none whitespace-nowrap"
                              >
                                <X size={9} />
                                Remove job
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-[var(--color-borders-border-primary)]">
                        <td className="px-3 py-1 font-mono text-[11px] text-[var(--color-fonts-font-color-primary)] max-w-[260px] truncate">
                          {pkg.name.replace(/\//g, '.')}
                        </td>
                        <td className="px-3 py-1 text-right">
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${
                            rate < 50
                              ? 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
                              : 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
                          }`}>
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-2 py-1 text-center">
                          {total >= 2 && (
                            <button
                              onClick={() => removePackage(pkg.name)}
                              disabled={isPending}
                              title="Remove this package"
                              className="p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-status-border-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors disabled:pointer-events-none"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
                <tr className="bg-[var(--color-cards-card-background-hover)]">
                  <td className="px-3 py-1.5 font-semibold text-[var(--color-fonts-font-color-primary)]">
                    Total packages
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-[var(--color-fonts-font-color-primary)]">{total}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cost estimate */}
          <div className="rounded-lg border border-[var(--color-borders-border-primary)] p-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-2">
              Estimated cost · {jobCount} job{jobCount > 1 ? 's' : ''} ({modelName})
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-fonts-font-color-support)]">Total tokens</span>
              <span className="text-[var(--color-fonts-font-color-primary)] font-medium">
                {fmtTokens(lowTok)} – {fmtTokens(highTok)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-fonts-font-color-support)]">Total cost</span>
              <span className="text-[var(--color-fonts-font-color-primary)] font-medium">
                {formatCost(lowCost)} – {formatCost(highCost)}
              </span>
            </div>
            <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-[var(--color-borders-border-primary)]">
              <Info size={11} className="shrink-0 mt-0.5 text-[var(--color-fonts-font-color-support)]" />
              <p className="text-[10px] text-[var(--color-fonts-font-color-support)] leading-relaxed">
                {isBulk
                  ? `${jobCount} job${jobCount > 1 ? 's' : ''}, ~${effectiveBatch} package${effectiveBatch > 1 ? 's' : ''} each. The agent commits after each package so partial work is saved if a job hits its loop limit.`
                  : `~${(GT_INPUT_LOW / 1000).toFixed(0)}k–${(GT_INPUT_HIGH / 1000).toFixed(0)}k input + ~${(GT_OUTPUT_LOW / 1000).toFixed(0)}k–${(GT_OUTPUT_HIGH / 1000).toFixed(0)}k output tokens.`}
                {' '}Actual usage varies with codebase size.
              </p>
            </div>
          </div>

        </div>

        {/* ── Fixed footer ── */}
        <div className="shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-[var(--color-borders-border-primary)]">
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={isPending}
            icon={isPending ? undefined : <FlaskConical size={12} />}
            onClick={() => onConfirm(effectiveBatch, activePackages)}
            disabled={isPending || total === 0}
          >
            {isPending
              ? 'Queueing…'
              : jobCount > 1
              ? `Queue ${jobCount} jobs`
              : 'Queue job'}
          </Button>
        </div>

      </div>
    </div>
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
