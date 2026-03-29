import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
import {
  ArrowUpCircle,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import { VersionBadge } from '@/components/VersionBadge'
import { isVersionOutdated } from '@/lib/version'
import api from '@/lib/api'
import type { QualityReport, RepoSettings, LatestVersionsResponse, ExecutionPlan } from '@/types/api'

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
const YELLOW = `${BADGE_BASE} bg-yellow-100 text-yellow-700`
const BLUE   = `${BADGE_BASE} bg-blue-100 text-blue-600`
const NONE   = 'text-[var(--color-fonts-font-color-support)]'

type RowData = {
  repo: RepoSettings
  mainReport: QualityReport | undefined
  developReport: QualityReport | undefined
  isLoading: boolean
}

export default function QualityReportsPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<RowData | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

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
    queries: qualityRepos.flatMap((repo) => [
      {
        queryKey: ['quality-report', repo.workspace, repo.repoSlug, 'main'],
        queryFn: () =>
          api
            .get(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/main`)
            .then((r) => r.data as QualityReport)
            .catch(() => undefined),
        enabled: qualityRepos.length > 0,
      },
      {
        queryKey: ['quality-report', repo.workspace, repo.repoSlug, 'develop'],
        queryFn: () =>
          api
            .get(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/develop`)
            .then((r) => r.data as QualityReport)
            .catch(() => undefined),
        enabled: qualityRepos.length > 0,
      },
    ]),
  })

  const rows: RowData[] = qualityRepos.map((repo, i) => ({
    repo,
    mainReport: reportQueries[i * 2]?.data,
    developReport: reportQueries[i * 2 + 1]?.data,
    isLoading: (reportQueries[i * 2]?.isLoading ?? false) || (reportQueries[i * 2 + 1]?.isLoading ?? false),
  }))

  const isLoading = reposLoading || reportQueries.some((q) => q.isLoading)

  function toggleExpand(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Quality Reports"
        subtitle="Code quality metrics per repository — main and develop branches."
      />

      <TableCard
        className="flex-1 min-h-0"
        title="Repositories"
        subtitle={`${rows.length} repo${rows.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: '',                tip: '' },
                { label: 'Workspace',       tip: 'Git workspace slug' },
                { label: 'Repo',            tip: 'Repository slug' },
                { label: 'Archetype',       tip: 'Repository language / framework archetype' },
                { label: 'Version',         tip: 'Current primary dependency version' },
                { label: 'Score',           tip: 'Composite quality score (0–100) — main branch' },
                { label: 'Linter Errors',   tip: 'Total linter violations — main branch' },
                { label: 'Security Issues', tip: 'Total security vulnerabilities — main branch' },
                { label: 'Avg Complexity',  tip: 'Average cyclomatic complexity — main branch' },
                { label: 'Last Measured',   tip: 'When the last quality report was collected' },
                { label: 'Actions',         tip: '' },
              ] as const).map(({ label, tip }, idx) => (
                <th
                  key={label || idx}
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
                    <td colSpan={11} className="px-4 py-2">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : rows.length === 0
              ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No repositories have quality reports enabled.
                  </td>
                </tr>
              )
              : rows.map((row) => {
                  const key = `${row.repo.workspace}/${row.repo.repoSlug}`
                  const isExpanded = expandedRows.has(key)
                  return [
                    /* ── Parent row ── */
                    <tr
                      key={key}
                      className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors"
                      onClick={() => toggleExpand(key)}
                    >
                      {/* Expand chevron */}
                      <td className="px-2 py-1.5 w-6 text-[var(--color-fonts-font-color-support)]">
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </td>
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
                        <ScoreBadge score={row.mainReport?.score} />
                      </td>
                      <td className="px-4 py-1.5">
                        <LinterErrorsBadge count={row.mainReport?.linter?.errorCount} />
                      </td>
                      <td className="px-4 py-1.5">
                        <SecurityBadge
                          issueCount={row.mainReport?.aikido?.totalIssues ?? row.mainReport?.aikido?.issueCount}
                          criticalCount={row.mainReport?.aikido?.criticalCount}
                        />
                      </td>
                      <td className="px-4 py-1.5">
                        <ComplexityBadge value={row.mainReport?.complexity?.avgComplexity} />
                      </td>
                      <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">
                        {row.mainReport ? new Date(row.mainReport.measuredAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <Tooltip text="View quality report summary" position="top">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<ExternalLink size={12} />}
                              onClick={() => setSelected(row)}
                            >
                              View
                            </Button>
                          </Tooltip>
                          <Tooltip
                            text={
                              row.mainReport?.coverage
                                ? `Line: ${row.mainReport.coverage.lineRate?.toFixed(1)}%  Branch: ${row.mainReport.coverage.branchRate?.toFixed(1)}%\nOpen coverage detail`
                                : 'Open coverage detail'
                            }
                            position="top"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<ShieldCheck size={12} />}
                              onClick={() =>
                                navigate({
                                  to: '/metrics/quality/$workspace/$repoSlug',
                                  params: {
                                    workspace: row.repo.workspace,
                                    repoSlug: row.repo.repoSlug,
                                  },
                                })
                              }
                            >
                              Coverage
                            </Button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>,

                    /* ── Branch subrows (visible when expanded) ── */
                    ...(isExpanded
                      ? [
                          <BranchSubRow
                            key={`${key}/main`}
                            branch="main"
                            report={row.mainReport}
                            compareReport={row.developReport}
                            isReference
                          />,
                          <BranchSubRow
                            key={`${key}/develop`}
                            branch="develop"
                            report={row.developReport}
                            compareReport={row.mainReport}
                          />,
                        ]
                      : []),
                  ]
                })}
          </tbody>
        </table>
      </TableCard>

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

// ── Branch sub-row ────────────────────────────────────────────────────────────

function BranchSubRow({
  branch,
  report,
  compareReport,
  isReference = false,
}: {
  branch: string
  report: QualityReport | undefined
  compareReport: QualityReport | undefined
  isReference?: boolean
}) {
  const branchBadgeCls =
    branch === 'main'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-purple-100 text-purple-700'

  return (
    <tr className="border-b border-[var(--color-tables-table-cell-stroke)] bg-[var(--color-cards-small-section-background)]">
      {/* Indent spacer (chevron col) */}
      <td className="px-2 py-1" />
      {/* Branch badge spanning workspace + repo cols */}
      <td colSpan={2} className="px-4 py-1">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)] ${branchBadgeCls}`}
        >
          {branch}
        </span>
      </td>
      {/* Archetype / Version: empty (repo-level) */}
      <td className="px-4 py-1" />
      <td className="px-4 py-1" />
      {/* Score */}
      <td className="px-4 py-1">
        <DiffScoreBadge
          value={report?.score}
          compareValue={compareReport?.score}
          higherIsBetter
          format={(v) => `${(v * 100).toFixed(0)}%`}
          isReference={isReference}
        />
      </td>
      {/* Linter errors */}
      <td className="px-4 py-1">
        <DiffNumericBadge
          value={report?.linter?.errorCount}
          compareValue={compareReport?.linter?.errorCount}
          higherIsBetter={false}
          isReference={isReference}
        />
      </td>
      {/* Security issues */}
      <td className="px-4 py-1">
        <DiffNumericBadge
          value={report?.aikido?.totalIssues ?? report?.aikido?.issueCount}
          compareValue={compareReport?.aikido?.totalIssues ?? compareReport?.aikido?.issueCount}
          higherIsBetter={false}
          isReference={isReference}
        />
      </td>
      {/* Avg complexity */}
      <td className="px-4 py-1">
        <DiffScoreBadge
          value={report?.complexity?.avgComplexity}
          compareValue={compareReport?.complexity?.avgComplexity}
          higherIsBetter={false}
          format={(v) => v.toFixed(1)}
          isReference={isReference}
        />
      </td>
      {/* Last measured */}
      <td className="px-4 py-1 text-[var(--color-fonts-font-color-support)]">
        {report ? new Date(report.measuredAt).toLocaleString() : '—'}
      </td>
      {/* Actions: empty */}
      <td className="px-4 py-1" />
    </tr>
  )
}

// ── Diff-aware sub-row badges ─────────────────────────────────────────────────

function DiffScoreBadge({
  value,
  compareValue,
  higherIsBetter,
  format,
  isReference,
}: {
  value: number | undefined
  compareValue: number | undefined
  higherIsBetter: boolean
  format: (v: number) => string
  isReference: boolean
}) {
  if (value === undefined || value === null) return <span className={NONE}>—</span>

  let cls = NONE
  let delta: string | null = null

  if (!isReference && compareValue !== undefined && compareValue !== null) {
    const diff = value - compareValue
    const isBetter = higherIsBetter ? diff > 0 : diff < 0
    const isWorse  = higherIsBetter ? diff < 0 : diff > 0
    if (isBetter) cls = GREEN
    else if (isWorse) cls = RED
    else cls = NONE

    if (Math.abs(diff) >= 0.001) {
      const sign = diff > 0 ? '+' : ''
      delta = `${sign}${format(diff)}`
    }
  } else {
    // Reference branch: standard coloring
    if (typeof value === 'number') {
      cls = value >= 0.8 ? GREEN : value >= 0.5 ? ORANGE : RED
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className={cls}>{format(value)}</span>
      {delta && (
        <span className={`text-[10px] ${cls}`}>{delta}</span>
      )}
    </span>
  )
}

function DiffNumericBadge({
  value,
  compareValue,
  higherIsBetter,
  isReference,
}: {
  value: number | undefined
  compareValue: number | undefined
  higherIsBetter: boolean
  isReference: boolean
}) {
  if (value === undefined || value === null) return <span className={NONE}>—</span>

  let cls = NONE
  let delta: string | null = null

  if (!isReference && compareValue !== undefined && compareValue !== null) {
    const diff = value - compareValue
    const isBetter = higherIsBetter ? diff > 0 : diff < 0
    const isWorse  = higherIsBetter ? diff < 0 : diff > 0
    if (isBetter) cls = GREEN
    else if (isWorse) cls = RED
    else cls = NONE

    if (diff !== 0) {
      delta = diff > 0 ? `+${diff}` : `${diff}`
    }
  } else {
    cls = value === 0 ? GREEN : value < 10 ? ORANGE : RED
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className={cls}>{value}</span>
      {delta && <span className={`text-[10px] ${cls}`}>{delta}</span>}
    </span>
  )
}

// ── Standard badge helpers ────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined) return <span className={NONE}>—</span>
  const pct = score * 100
  const color = score >= 0.8 ? GREEN : score >= 0.5 ? ORANGE : RED
  return <span className={color}>{pct.toFixed(0)}%</span>
}

function LinterErrorsBadge({ count }: { count?: number }) {
  if (count === undefined || count === null) return <span className={NONE}>—</span>
  const cls = count === 0 ? GREEN : count < 10 ? ORANGE : RED
  return <span className={cls}>{count}</span>
}

function SecurityBadge({ issueCount, criticalCount }: { issueCount?: number; criticalCount?: number }) {
  const total = issueCount
  if (total === undefined || total === null) return <span className={NONE}>—</span>
  const hasCritical = !!criticalCount
  const cls = total === 0 ? GREEN : total < 5 && !hasCritical ? ORANGE : RED
  const label = total + (hasCritical ? ` (${criticalCount} critical)` : '')
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

function CoverageBadge({ coverage }: { coverage?: import('@/types/api').CoverageSection }) {
  const lineRate = coverage?.lineRate
  if (lineRate === undefined || lineRate === null) return <span className={NONE}>—</span>
  const cls = lineRate >= 80 ? GREEN : lineRate >= 50 ? ORANGE : RED
  const hasDetails =
    coverage?.branchRate !== undefined ||
    coverage?.methodRate !== undefined ||
    coverage?.classRate !== undefined
  if (!hasDetails) return <span className={cls}>{lineRate.toFixed(1)}%</span>
  return (
    <span className="relative group inline-flex">
      <span className={`${cls} cursor-help underline decoration-dotted decoration-current`}>
        {lineRate.toFixed(1)}%
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col gap-0.5 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded p-2 text-xs whitespace-nowrap z-20 shadow-lg text-[var(--color-fonts-font-color-primary)]">
        {coverage?.branchRate !== undefined && <span>Branch: {coverage.branchRate.toFixed(1)}%</span>}
        {coverage?.methodRate !== undefined && <span>Method: {coverage.methodRate.toFixed(1)}%</span>}
        {coverage?.classRate !== undefined && <span>Class: {coverage.classRate.toFixed(1)}%</span>}
        {coverage?.linesCovered !== undefined && (
          <span>Lines: {coverage.linesCovered} / {coverage.linesCovered + (coverage.linesMissed ?? 0)}</span>
        )}
      </span>
    </span>
  )
}

function AikidoBadge({ aikido }: { aikido?: QualityReport['aikido'] }) {
  if (!aikido) return <span className={NONE}>—</span>
  const total = aikido.totalIssues ?? aikido.issueCount
  if (total === undefined) return <span className={NONE}>—</span>
  const c = aikido.criticalCount ?? 0
  const h = aikido.highCount ?? 0
  const m = aikido.mediumCount ?? 0
  const l = aikido.lowCount ?? 0
  return (
    <div className="flex flex-wrap gap-1">
      <span className={c > 0 ? RED : GREEN} title="Critical">{c}</span>
      <span className={ORANGE} title="High">{h}</span>
      <span className={YELLOW} title="Medium">{m}</span>
      <span className={BLUE} title="Low">{l}</span>
    </div>
  )
}

function LinterBadge({ linter }: { linter?: import('@/types/api').LinterSection }) {
  if (!linter) return <span className={NONE}>—</span>
  const e = linter.errorCount ?? 0
  const w = linter.warningCount ?? 0
  const i = linter.infoCount ?? 0
  return (
    <div className="flex flex-wrap gap-1">
      <span className={e > 0 ? RED : GREEN} title="Errors">{e}</span>
      <span className={w === 0 ? NONE : ORANGE} title="Warnings">{w}</span>
      <span className={BLUE} title="Info">{i}</span>
    </div>
  )
}

function ScoreGauge({ score, label }: { score?: number; label?: string }) {
  const pct = score ?? 0
  const color =
    pct >= 0.8
      ? 'var(--color-status-border-success)'
      : pct >= 0.5
      ? 'var(--color-status-border-attention)'
      : 'var(--color-status-border-critical)'
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 120 120">
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
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="bold" fill={color}>
          {(pct * 100).toFixed(0)}%
        </text>
        <text x="60" y="74" textAnchor="middle" fontSize="9" fill="var(--color-fonts-font-color-support)">
          score
        </text>
      </svg>
      {label && (
        <span className="text-[10px] font-semibold mt-1 text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
          {label}
        </span>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-cards-small-section-background)] rounded-[var(--border-radius-small)] p-3">
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">{label}</p>
      <div className="text-lg font-bold text-[var(--color-fonts-font-color-headings)]">{value}</div>
    </div>
  )
}

// ── Report dialog ─────────────────────────────────────────────────────────────

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
  const queryClient = useQueryClient()
  const { repo, mainReport, developReport } = row

  const [toast, setToast] = useState<ToastConfig | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])

  const bitbucketBase = import.meta.env.VITE_BITBUCKET_URL ?? 'https://bitbucket.org'
  const repoUrl = `${bitbucketBase}/${repo.workspace}/${repo.repoSlug}.git`

  const { data: mainHistory } = useQuery<QualityReport[]>({
    queryKey: ['quality-history', repo.workspace, repo.repoSlug, 'main'],
    queryFn: () =>
      api
        .get(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/main/history`)
        .then((r) => r.data)
        .catch(() => []),
  })

  const { data: developHistory } = useQuery<QualityReport[]>({
    queryKey: ['quality-history', repo.workspace, repo.repoSlug, 'develop'],
    queryFn: () =>
      api
        .get(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/develop/history`)
        .then((r) => r.data)
        .catch(() => []),
  })

  const { data: plans } = useQuery<ExecutionPlan[]>({
    queryKey: ['plans'],
    queryFn: () => api.get('/plans').then((r) => r.data).catch(() => []),
  })

  const hasActivePlan = (Array.isArray(plans) ? plans : []).some(
    (p) =>
      (p.status === 'EXECUTING' || p.status === 'APPROVED') &&
      p.repoUrl === repoUrl,
  )

  function makeMutation(branch: string) {
    return {
      mutationFn: () =>
        api
          .post(`/metrics/quality-reports/${repo.workspace}/${repo.repoSlug}/${branch}`, { repoUrl })
          .then((r) => r.data as { jobId: string }),
      onSuccess: (data: { jobId: string }) => {
        setToast({
          variant: 'success',
          message: `Quality report job started for ${branch}.`,
          ...(data?.jobId
            ? {
                action: {
                  label: 'View Job',
                  onClick: () => navigate({ to: '/jobs/$id', params: { id: data.jobId } }),
                },
              }
            : {}),
        })
      },
      onError: () => {
        setToast({ variant: 'error', message: `Failed to start quality report job for ${branch}.` })
      },
    }
  }

  const mainJobMutation    = useMutation(makeMutation('main'))
  const developJobMutation = useMutation(makeMutation('develop'))

  const upgradeJobMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/upgrades/check/${repo.workspace}/${repo.repoSlug}`)
        .then((r) => r.data as { jobId?: string; planId?: string }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      if (data?.planId) {
        navigate({ to: '/plans/$id', params: { id: data.planId } })
      } else if (data?.jobId) {
        navigate({ to: '/jobs/$id', params: { id: data.jobId } })
      } else {
        navigate({ to: '/plans' })
      }
    },
  })

  const versionOutdated = isVersionOutdated(repo.archetypeVersion, repo.archetype, latestVersions)

  const mainHistoryList = [...(Array.isArray(mainHistory) ? mainHistory : [])].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  )
  const developHistoryList = [...(Array.isArray(developHistory) ? developHistory : [])].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  )

  const showChart = mainHistoryList.length > 1 || developHistoryList.length > 1

  const chartData = {
    datasets: [
      {
        label: 'main — Score %',
        data: mainHistoryList.map((r) => ({
          x: new Date(r.measuredAt).toLocaleString(),
          y: +((r.score ?? 0) * 100).toFixed(1),
        })),
        borderColor: '#00B4FF',
        backgroundColor: 'rgba(0,180,255,0.08)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'develop — Score %',
        data: developHistoryList.map((r) => ({
          x: new Date(r.measuredAt).toLocaleString(),
          y: +((r.score ?? 0) * 100).toFixed(1),
        })),
        borderColor: '#A855F7',
        backgroundColor: 'rgba(168,85,247,0.08)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'main — Coverage %',
        data: mainHistoryList.map((r) => ({
          x: new Date(r.measuredAt).toLocaleString(),
          y: r.coverage?.lineRate ?? 0,
        })),
        borderColor: '#16DB93',
        backgroundColor: 'rgba(22,219,147,0.08)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'develop — Coverage %',
        data: developHistoryList.map((r) => ({
          x: new Date(r.measuredAt).toLocaleString(),
          y: r.coverage?.lineRate ?? 0,
        })),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245,158,11,0.08)',
        fill: false,
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
            </div>
          </div>
          <Button variant="ghost" size="xs" icon={<X size={14} />} onClick={onClose} aria-label="Close" />
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">

          {/* Two-column branch comparison */}
          <div className="grid grid-cols-2 gap-4">
            <BranchPanel branch="main" report={mainReport} branchColor="blue" />
            <BranchPanel branch="develop" report={developReport} branchColor="purple" />
          </div>

          {/* Trend chart */}
          {showChart && (
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] mb-3">Trend</h4>
              <div style={{ height: 220 }}>
                <Line data={chartData} options={CHART_OPTIONS} />
              </div>
            </div>
          )}

          {toast && <Toast {...toast} onClose={dismissToast} />}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-cards-card-stroke)]">
            {upgradeJobMutation.isError && (
              <p className="mr-auto text-xs text-[var(--color-status-border-critical)]">
                Failed to start upgrade job. Please try again.
              </p>
            )}
            {!upgradeJobMutation.isError && hasActivePlan && (
              <p className="mr-auto text-xs text-[var(--color-tags-font-attention)]">
                An upgrade plan is already running for this repository.
              </p>
            )}
            {versionOutdated && (
              <Button
                variant="danger"
                size="md"
                icon={<ArrowUpCircle size={14} />}
                loading={upgradeJobMutation.isPending}
                disabled={upgradeJobMutation.isPending || upgradeJobMutation.isSuccess || hasActivePlan}
                onClick={() => {
                  if (!upgradeJobMutation.isPending && !upgradeJobMutation.isSuccess && !hasActivePlan) {
                    upgradeJobMutation.mutate()
                  }
                }}
              >
                {upgradeJobMutation.isPending ? 'Starting…' : 'Run Upgrade'}
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              icon={<BarChart2 size={14} />}
              loading={developJobMutation.isPending}
              disabled={developJobMutation.isPending || developJobMutation.isSuccess}
              onClick={() => { if (!developJobMutation.isPending && !developJobMutation.isSuccess) developJobMutation.mutate() }}
            >
              {developJobMutation.isPending ? 'Starting…' : developJobMutation.isSuccess ? 'Queued' : 'Run Develop Report'}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<BarChart2 size={14} />}
              loading={mainJobMutation.isPending}
              disabled={mainJobMutation.isPending || mainJobMutation.isSuccess}
              onClick={() => { if (!mainJobMutation.isPending && !mainJobMutation.isSuccess) mainJobMutation.mutate() }}
            >
              {mainJobMutation.isPending ? 'Starting…' : mainJobMutation.isSuccess ? 'Queued' : 'Run Main Report'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Branch panel inside dialog ────────────────────────────────────────────────

function BranchPanel({
  branch,
  report,
  branchColor,
}: {
  branch: string
  report: QualityReport | undefined
  branchColor: 'blue' | 'purple'
}) {
  const headerCls =
    branchColor === 'blue'
      ? 'bg-blue-50 border-blue-200 text-blue-700'
      : 'bg-purple-50 border-purple-200 text-purple-700'

  return (
    <div className="border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden">
      <div className={`px-3 py-2 border-b text-xs font-semibold uppercase tracking-wide ${headerCls}`}>
        {branch}
        {report && (
          <span className="ml-2 font-normal normal-case opacity-70">
            {new Date(report.measuredAt).toLocaleString()}
          </span>
        )}
      </div>
      {report ? (
        <div className="p-3 flex flex-col items-center gap-3">
          <ScoreGauge score={report.score} />
          <div className="w-full grid grid-cols-2 gap-2">
            <MetricCard label="Coverage" value={<CoverageBadge coverage={report.coverage} />} />
            <MetricCard label="Linter" value={<LinterBadge linter={report.linter} />} />
            <MetricCard label="Security" value={<AikidoBadge aikido={report.aikido} />} />
            <MetricCard label="Avg CC" value={<ComplexityBadge value={report.complexity?.avgComplexity} />} />
            <MetricCard label="Max CC" value={<MaxComplexityBadge value={report.complexity?.maxComplexity} />} />
            <MetricCard
              label="Above Threshold"
              value={
                report.complexity?.methodsAboveThreshold !== undefined
                  ? `${report.complexity.methodsAboveThreshold} / ${report.complexity.totalMethods ?? '?'}`
                  : '—'
              }
            />
          </div>
        </div>
      ) : (
        <p className="p-4 text-center text-xs text-[var(--color-fonts-font-color-support)]">
          No report available.
        </p>
      )}
    </div>
  )
}
