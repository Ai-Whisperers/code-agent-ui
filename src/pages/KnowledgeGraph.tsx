import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useStore } from '@tanstack/react-store'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import { TableCard } from '@/components/ui/TableCard'
import { authStore } from '@/store/auth-store'
import api from '@/lib/api'
import type { JobStatusResponse } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, Legend)

// ── Types ──────────────────────────────────────────────────────────────────

interface KnowledgeSnapshot {
  id: number
  productId: string | null
  computedAt: string
  lookbackDays: number
  totalRepos: number
  totalAuthors: number
  totalFiles: number
}

interface ServiceScore {
  authorEmail: string
  authorName: string | null
  repoSlug: string
  serviceScore: number
}

interface KnowledgeScore {
  snapshotId: number
  authorEmail: string
  authorName: string | null
  repoSlug: string
  filePath: string
  commitCount: number
  linesAdded: number
  linesDeleted: number
  blameLines: number
  totalLines: number
  lastCommitAt: string | null
  score: number
  serviceScore: number
}

interface BusFactorRow {
  snapshotId: number
  repoSlug: string
  filePath: string
  topAuthorEmail: string
  topAuthorName: string | null
  topScore: number
  topOwnershipPct: number
  secondAuthorEmail: string | null
  secondScore: number
  busFactorFlag: boolean
  riskLevel: 'none' | 'warning' | 'critical'
}

interface AuthorSummary {
  authorEmail: string
  authorName: string | null
}

// ── Colour palette (consistent across all charts) ─────────────────────────

const PALETTE = [
  'rgba(99,130,255,0.80)',
  'rgba(22,219,147,0.80)',
  'rgba(255,185,0,0.80)',
  'rgba(255,99,99,0.80)',
  'rgba(147,51,234,0.80)',
  'rgba(236,72,153,0.80)',
  'rgba(14,165,233,0.80)',
  'rgba(249,115,22,0.80)',
  'rgba(16,185,129,0.80)',
  'rgba(239,68,68,0.80)',
  'rgba(59,130,246,0.80)',
  'rgba(245,158,11,0.80)',
]

function colorFor(index: number) {
  return PALETTE[index % PALETTE.length]
}

// ── Job poller ─────────────────────────────────────────────────────────────

function useJobPoller(jobId: string | null, onDone: (status: string) => void) {
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    const poll = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 5_000))
        if (cancelled) break
        try {
          const res = await api.get<JobStatusResponse>(`/status/${jobId}`)
          const status = res.data?.status
          if (status === 'SUCCESS' || status === 'FAILED' || status === 'AWAITING_APPROVAL') {
            if (!cancelled) onDoneRef.current(status)
            break
          }
        } catch {
          // network hiccup — keep polling
        }
      }
    }
    poll()
    return () => { cancelled = true }
  }, [jobId])
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function decayDot(lastCommitAt: string | null) {
  if (!lastCommitAt) return <span className="inline-block w-2 h-2 rounded-full bg-gray-400" title="Unknown" />
  const days = Math.floor((Date.now() - new Date(lastCommitAt).getTime()) / 86_400_000)
  if (days <= 30) return <span className="inline-block w-2 h-2 rounded-full bg-green-500" title={`${days}d ago`} />
  if (days <= 90) return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" title={`${days}d ago`} />
  return <span className="inline-block w-2 h-2 rounded-full bg-red-500" title={`${days}d ago — may be stale`} />
}

function RiskBadge({ level }: { level: string }) {
  if (level === 'critical')
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Critical</span>
  if (level === 'warning')
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">Warning</span>
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">OK</span>
}

// ── Stat strip ─────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
    </div>
  )
}

// ── Tab bar ────────────────────────────────────────────────────────────────

const TABS = ['Service Overview', 'Bus Factor Risks', 'Author Profiles'] as const
type Tab = typeof TABS[number]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b border-[var(--color-borders-border-primary)] mb-5">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === t
              ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-fonts-font-color-primary)]'
              : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ── Tab 1: Service Overview ────────────────────────────────────────────────

function ServiceOverviewTab({ snapshotId, snapshot }: { snapshotId: number; snapshot: KnowledgeSnapshot }) {
  const [drillRepo, setDrillRepo] = useState<string | null>(null)

  const { data: serviceScores = [] } = useQuery<ServiceScore[]>({
    queryKey: ['kg-service-scores', snapshotId],
    queryFn: () => api.get(`/knowledge-graph/service-scores?snapshotId=${snapshotId}`).then((r) => r.data),
    enabled: snapshotId > 0,
  })

  const { data: drillScores = [] } = useQuery<KnowledgeScore[]>({
    queryKey: ['kg-scores-repo', snapshotId, drillRepo],
    queryFn: () =>
      api.get(`/knowledge-graph/scores?snapshotId=${snapshotId}&repo=${encodeURIComponent(drillRepo!)}`).then((r) => r.data),
    enabled: !!drillRepo,
  })

  // Build stacked bar chart: one bar per repo, stacked by author
  const repos = [...new Set(serviceScores.map((s) => s.repoSlug))].sort()
  const authors = [...new Set(serviceScores.map((s) => s.authorEmail))]

  // Compute total score per repo for percentage calculation
  const repoTotals = new Map<string, number>()
  for (const s of serviceScores) {
    repoTotals.set(s.repoSlug, (repoTotals.get(s.repoSlug) ?? 0) + s.serviceScore)
  }

  const datasets = authors.map((email, i) => ({
    label: email,
    data: repos.map((repo) => {
      const match = serviceScores.find((s) => s.repoSlug === repo && s.authorEmail === email)
      const total = repoTotals.get(repo) ?? 1
      return match ? Math.round((match.serviceScore / total) * 1000) / 10 : 0
    }),
    backgroundColor: colorFor(i),
    borderRadius: 2,
  }))

  const chartData = { labels: repos, datasets }
  const chartHeight = Math.max(120, repos.length * 36)

  const chartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { boxWidth: 10, font: { size: 10 } } },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { x: number | null } }) =>
            ` ${ctx.dataset.label ?? ''}: ${(ctx.parsed.x ?? 0).toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: { stacked: true, beginAtZero: true, max: 100, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: (v: number | string) => `${v}%` } },
      y: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
    },
    onClick: (_: unknown, elements: Array<{ index: number }>) => {
      if (elements.length > 0) {
        const repo = repos[elements[0].index]
        setDrillRepo((prev) => (prev === repo ? null : repo))
      }
    },
  }

  // Top contributor across all repos
  const authorTotals = new Map<string, { name: string | null; total: number }>()
  for (const s of serviceScores) {
    const prev = authorTotals.get(s.authorEmail) ?? { name: s.authorName, total: 0 }
    authorTotals.set(s.authorEmail, { name: s.authorName, total: prev.total + s.serviceScore })
  }
  const topContributor = [...authorTotals.entries()].sort((a, b) => b[1].total - a[1].total)[0]

  return (
    <div className="flex flex-col gap-5">
      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Repos analysed" value={snapshot.totalRepos} />
        <StatCard label="Authors" value={snapshot.totalAuthors} />
        <StatCard label="Files analysed" value={snapshot.totalFiles.toLocaleString()} />
        <StatCard
          label="Top contributor"
          value={topContributor ? (topContributor[1].name ?? topContributor[0]) : '—'}
        />
      </div>

      {/* Stacked bar chart */}
      {repos.length > 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
          <h3 className="text-sm font-semibold mb-1 text-[var(--color-fonts-font-color-headings)]">
            Knowledge share per repo
          </h3>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-4">
            Each bar shows the % of total service score owned by each author. Click a bar to drill down.
          </p>
          <div style={{ height: chartHeight }}>
            <Bar data={chartData} options={chartOptions as unknown as typeof chartOptions} />
          </div>
        </div>
      )}

      {/* Drill-down panel */}
      {drillRepo && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
            <span className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              {drillRepo} — top files
            </span>
            <button
              onClick={() => setDrillRepo(null)}
              className="text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]"
            >
              Close
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-tables-table-header-background)] text-[var(--color-tables-table-header-text)]">
                  <th className="px-3 py-2 text-left font-semibold">File</th>
                  <th className="px-3 py-2 text-left font-semibold">Top author</th>
                  <th className="px-3 py-2 text-right font-semibold">Score</th>
                  <th className="px-3 py-2 text-right font-semibold">Contributors</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  drillScores.reduce<Record<string, KnowledgeScore[]>>((acc, s) => {
                    ;(acc[s.filePath] ??= []).push(s)
                    return acc
                  }, {}),
                )
                  .sort(([, a], [, b]) => Math.max(...b.map((x) => x.score)) - Math.max(...a.map((x) => x.score)))
                  .slice(0, 50)
                  .map(([file, fileScores]) => {
                    const top = fileScores.reduce((a, b) => (a.score > b.score ? a : b))
                    return (
                      <tr
                        key={file}
                        className="border-t border-[var(--color-tables-table-row-stroke)] hover:bg-[var(--color-tables-table-row-hover)]"
                      >
                        <td className="px-3 py-1.5 font-mono text-[var(--color-fonts-font-color-primary)] max-w-xs truncate">{file}</td>
                        <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)]">{top.authorName ?? top.authorEmail}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{top.score.toFixed(1)}</td>
                        <td className="px-3 py-1.5 text-right">{fileScores.length}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {repos.length === 0 && (
        <p className="text-sm text-[var(--color-fonts-font-color-support)]">No data in this snapshot yet.</p>
      )}
    </div>
  )
}

// ── Tab 2: Bus Factor Risks ────────────────────────────────────────────────

function BusFactor({ snapshotId, onSelectAuthor }: { snapshotId: number; onSelectAuthor: (email: string) => void }) {
  const [repoFilter, setRepoFilter] = useState('')
  const [criticalOnly, setCriticalOnly] = useState(false)

  const { data: rows = [] } = useQuery<BusFactorRow[]>({
    queryKey: ['kg-bus-factor', snapshotId],
    queryFn: () => api.get(`/knowledge-graph/bus-factor?snapshotId=${snapshotId}`).then((r) => r.data),
    enabled: snapshotId > 0,
  })

  const repos = [...new Set(rows.map((r) => r.repoSlug))].sort()
  const repoOptions = [{ label: 'All repos', value: '' }, ...repos.map((r) => ({ label: r, value: r }))]

  const filtered = rows.filter((r) => {
    if (repoFilter && r.repoSlug !== repoFilter) return false
    if (criticalOnly && r.riskLevel !== 'critical') return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-56">
          <Select
            options={repoOptions}
            value={repoFilter}
            onChange={setRepoFilter}
            placeholder="All repos"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-fonts-font-color-support)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={criticalOnly}
            onChange={(e) => setCriticalOnly(e.target.checked)}
            className="rounded"
          />
          Critical only
        </label>
        <span className="text-xs text-[var(--color-fonts-font-color-support)]">
          {filtered.length} file{filtered.length !== 1 ? 's' : ''}
          {filtered.filter((r) => r.busFactorFlag).length > 0 && (
            <span className="ml-1 text-red-500 font-medium flex items-center gap-1 inline-flex">
              <AlertTriangle size={11} />
              {filtered.filter((r) => r.busFactorFlag).length} flagged
            </span>
          )}
        </span>
      </div>

      <TableCard title="Bus Factor Risks" subtitle={`${filtered.length} files`} maxHeight="600px">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[var(--color-tables-table-header-background)] text-[var(--color-tables-table-header-text)] sticky top-0">
              <th className="px-3 py-2 text-left font-semibold">Repo</th>
              <th className="px-3 py-2 text-left font-semibold">File / Service</th>
              <th className="px-3 py-2 text-left font-semibold">Top Author</th>
              <th className="px-3 py-2 text-right font-semibold">Ownership %</th>
              <th className="px-3 py-2 text-left font-semibold">2nd Author</th>
              <th className="px-3 py-2 text-right font-semibold">Gap</th>
              <th className="px-3 py-2 text-center font-semibold">Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const gap = row.secondAuthorEmail
                ? Math.round(row.topOwnershipPct - (row.secondScore / Math.max(row.topScore, 1)) * row.topOwnershipPct)
                : Math.round(row.topOwnershipPct)
              return (
                <tr
                  key={i}
                  className="border-t border-[var(--color-tables-table-row-stroke)] hover:bg-[var(--color-tables-table-row-hover)]"
                >
                  <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)]">{row.repoSlug}</td>
                  <td className="px-3 py-1.5 font-mono text-[var(--color-fonts-font-color-primary)] max-w-xs truncate">{row.filePath}</td>
                  <td className="px-3 py-1.5">
                    <button
                      className="text-[var(--color-buttons-button-primary)] hover:underline"
                      onClick={() => onSelectAuthor(row.topAuthorEmail)}
                    >
                      {row.topAuthorName ?? row.topAuthorEmail}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{row.topOwnershipPct.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)]">
                    {row.secondAuthorEmail ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{gap}pp</td>
                  <td className="px-3 py-1.5 text-center">
                    <RiskBadge level={row.riskLevel} />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]">
                  No bus-factor data for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  )
}

// ── Tab 3: Author Profiles ─────────────────────────────────────────────────

function AuthorProfiles({ snapshotId, initialEmail }: { snapshotId: number; initialEmail?: string }) {
  const [selectedEmail, setSelectedEmail] = useState(initialEmail ?? '')

  useEffect(() => {
    if (initialEmail) setSelectedEmail(initialEmail)
  }, [initialEmail])

  const { data: authors = [] } = useQuery<AuthorSummary[]>({
    queryKey: ['kg-authors', snapshotId],
    queryFn: () => api.get(`/knowledge-graph/authors?snapshotId=${snapshotId}`).then((r) => r.data),
    enabled: snapshotId > 0,
  })

  const { data: scores = [] } = useQuery<KnowledgeScore[]>({
    queryKey: ['kg-scores-author', snapshotId, selectedEmail],
    queryFn: () =>
      api.get(`/knowledge-graph/scores?snapshotId=${snapshotId}&author=${encodeURIComponent(selectedEmail)}`).then((r) => r.data),
    enabled: !!selectedEmail,
  })

  const authorOptions = authors.map((a) => ({
    label: a.authorName ? `${a.authorName} <${a.authorEmail}>` : a.authorEmail,
    value: a.authorEmail,
  }))

  // Doughnut: knowledge share across repos
  const repoTotals = new Map<string, number>()
  for (const s of scores) {
    repoTotals.set(s.repoSlug, (repoTotals.get(s.repoSlug) ?? 0) + s.score)
  }
  const doughnutLabels = [...repoTotals.keys()]
  const doughnutData = {
    labels: doughnutLabels,
    datasets: [
      {
        data: doughnutLabels.map((r) => repoTotals.get(r) ?? 0),
        backgroundColor: doughnutLabels.map((_, i) => colorFor(i)),
        borderWidth: 1,
      },
    ],
  }

  const topScores = [...scores].sort((a, b) => b.score - a.score).slice(0, 10)

  return (
    <div className="flex flex-col gap-4">
      {/* Author selector */}
      <div className="w-80">
        <Select
          options={authorOptions}
          value={selectedEmail}
          onChange={setSelectedEmail}
          placeholder="Select an author…"
        />
      </div>

      {selectedEmail && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Doughnut chart */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">
              Knowledge spread across repos
            </h3>
            {doughnutLabels.length > 0 ? (
              <div style={{ height: 260 }}>
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } },
                    },
                  }}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--color-fonts-font-color-support)]">No data.</p>
            )}
          </div>

          {/* Top areas table */}
          <TableCard title="Top areas" subtitle={`top ${topScores.length}`} maxHeight="320px">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-tables-table-header-background)] text-[var(--color-tables-table-header-text)] sticky top-0">
                  <th className="px-3 py-2 text-left font-semibold">Repo</th>
                  <th className="px-3 py-2 text-left font-semibold">File / Service</th>
                  <th className="px-3 py-2 text-right font-semibold">Score</th>
                  <th className="px-3 py-2 text-right font-semibold">Last commit</th>
                  <th className="px-3 py-2 text-center font-semibold">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {topScores.map((s, i) => (
                  <tr
                    key={i}
                    className="border-t border-[var(--color-tables-table-row-stroke)] hover:bg-[var(--color-tables-table-row-hover)]"
                  >
                    <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)]">{s.repoSlug}</td>
                    <td className="px-3 py-1.5 font-mono text-[var(--color-fonts-font-color-primary)] max-w-[200px] truncate">{s.filePath}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{s.score.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right text-[var(--color-fonts-font-color-support)]">{fmtDate(s.lastCommitAt)}</td>
                    <td className="px-3 py-1.5 text-center">{decayDot(s.lastCommitAt)}</td>
                  </tr>
                ))}
                {topScores.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]">
                      No scores found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableCard>
        </div>
      )}

      {!selectedEmail && (
        <p className="text-sm text-[var(--color-fonts-font-color-support)]">Select an author to view their profile.</p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function KnowledgeGraphPage() {
  const user = useStore(authStore, (s) => s.user)
  const qc = useQueryClient()
  const isAdmin = user?.appRoles.includes('ADMINISTRATOR') ?? false

  const [activeTab, setActiveTab] = useState<Tab>('Service Overview')
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const [generating, setGenerating] = useState(false)
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)
  const [drillAuthor, setDrillAuthor] = useState<string | undefined>(undefined)

  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery<KnowledgeSnapshot[]>({
    queryKey: ['kg-snapshots'],
    queryFn: () => api.get('/knowledge-graph/snapshots').then((r) => r.data),
  })

  // Auto-select latest snapshot
  useEffect(() => {
    if (snapshots.length > 0 && selectedSnapshotId === null) {
      setSelectedSnapshotId(snapshots[0].id)
    }
  }, [snapshots, selectedSnapshotId])

  const activeSnapshot = snapshots.find((s) => s.id === selectedSnapshotId) ?? null

  useJobPoller(pollingJobId, (status) => {
    setGenerating(false)
    setPollingJobId(null)
    if (status === 'SUCCESS') {
      setToast({ variant: 'success', message: 'Knowledge graph computed successfully.' })
      qc.invalidateQueries({ queryKey: ['kg-snapshots'] })
    } else {
      setToast({ variant: 'error', message: 'Knowledge graph job failed. Check job logs.' })
    }
  })

  const handleRefresh = async () => {
    setGenerating(true)
    try {
      const res = await api.post('/knowledge-graph/generate')
      setPollingJobId(res.data.jobId)
      setToast({ variant: 'info', message: 'Knowledge graph job queued…', duration: 0 })
    } catch {
      setGenerating(false)
      setToast({ variant: 'error', message: 'Failed to queue knowledge graph job.' })
    }
  }

  const snapshotOptions = snapshots.map((s) => ({
    label: `${fmtDate(s.computedAt)} — ${s.totalRepos} repos, ${s.totalAuthors} authors`,
    value: String(s.id),
  }))

  const handleSelectAuthorFromBusFactor = (email: string) => {
    setDrillAuthor(email)
    setActiveTab('Author Profiles')
  }

  return (
    <main className="flex flex-col flex-1 min-h-0">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <PageHeader
        title="Knowledge Graph"
        subtitle={
          activeSnapshot
            ? `Last computed: ${fmtDate(activeSnapshot.computedAt)}`
            : 'Analyse git history to surface expertise and bus-factor risks.'
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Snapshot selector */}
            {snapshots.length > 0 && (
              <div className="w-72">
                <Select
                  options={snapshotOptions}
                  value={selectedSnapshotId !== null ? String(selectedSnapshotId) : ''}
                  onChange={(v) => setSelectedSnapshotId(Number(v))}
                  placeholder="Select snapshot…"
                />
              </div>
            )}
            {/* Refresh Now (admin only) */}
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw size={13} className={generating ? 'animate-spin' : ''} />}
                loading={generating}
                onClick={handleRefresh}
                title="Queue a new knowledge graph computation"
              >
                Refresh Now
              </Button>
            )}
          </div>
        }
      />

      {snapshotsLoading && (
        <p className="text-sm text-[var(--color-fonts-font-color-support)] px-1">Loading snapshots…</p>
      )}

      {!snapshotsLoading && snapshots.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-[var(--color-fonts-font-color-support)]">
            No knowledge graph snapshots yet.
          </p>
          {isAdmin && (
            <Button variant="primary" size="sm" onClick={handleRefresh} loading={generating}>
              Generate now
            </Button>
          )}
        </div>
      )}

      {!snapshotsLoading && snapshots.length > 0 && selectedSnapshotId !== null && activeSnapshot && (
        <>
          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === 'Service Overview' && (
            <ServiceOverviewTab snapshotId={selectedSnapshotId} snapshot={activeSnapshot} />
          )}
          {activeTab === 'Bus Factor Risks' && (
            <BusFactor snapshotId={selectedSnapshotId} onSelectAuthor={handleSelectAuthorFromBusFactor} />
          )}
          {activeTab === 'Author Profiles' && (
            <AuthorProfiles snapshotId={selectedSnapshotId} initialEmail={drillAuthor} />
          )}
        </>
      )}
    </main>
  )
}
