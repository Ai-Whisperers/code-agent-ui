import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  FileText,
  BookOpen,
  FlaskConical,
  Target,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ArrowUpRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TestPlanStatusBadge } from '@/components/shared/TestPlanStatusBadge'
import { JiraIssueLink } from '@/components/ui/JiraIssueLink'
import { Tooltip } from '@/components/ui/Tooltip'
import api from '@/lib/api'
import type { QaTestPlanSummary } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diffD = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (diffD === 0) return 'today'
  if (diffD === 1) return 'yesterday'
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── KPI chip ──────────────────────────────────────────────────────────────────

function KpiChip({
  icon: Icon,
  value,
  label,
  warn,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  value?: number | null
  label: string
  warn?: boolean
}) {
  if (value == null) return null
  const isWarning = warn && value > 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        isWarning
          ? 'text-[var(--color-tags-font-attention)]'
          : 'text-[var(--color-fonts-font-color-support)]'
      }`}
    >
      <Icon size={11} className="shrink-0" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  )
}

// ── Readiness badge ───────────────────────────────────────────────────────────

function ReadinessPill({ value }: { value?: string | null }) {
  if (!value) return null
  const map: Record<string, string> = {
    'Ready': 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    'Ready with Caveats': 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
    'Not Ready': 'bg-[var(--color-tags-error-background)] text-[var(--color-tags-font-error)]',
  }
  const cls = map[value] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      <CheckCircle2 size={10} />
      {value}
    </span>
  )
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  jiraBaseUrl,
  onView,
}: {
  plan: QaTestPlanSummary
  jiraBaseUrl: string
  onView: (plan: QaTestPlanSummary) => void
}) {
  const hasKpis = plan.kpiBehaviourTcCount != null || plan.kpiCapabilityTcCount != null

  return (
    <div
      className="group rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] p-5 flex flex-col gap-3 transition-shadow hover:shadow-[var(--shadow-card-hover)] cursor-pointer"
      onClick={() => plan.testPlanStatus === 'json_ready' && onView(plan)}
    >
      {/* ── Top row ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <JiraIssueLink
            issueKey={plan.issueKey}
            jiraBaseUrl={jiraBaseUrl}
            className="font-mono text-sm font-bold text-[var(--color-fonts-font-color-brand)] group-hover:underline"
          />
          <TestPlanStatusBadge status={plan.testPlanStatus} analysisEdited={plan.analysisEdited} />
          <ReadinessPill value={plan.kpiReadiness} />
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 text-[11px] text-[var(--color-fonts-font-color-support)]"
          >
            <Clock size={11} />
            {fmtDate(plan.generatedAt)}
          </div>
          {plan.testPlanStatus === 'json_ready' && (
            <Tooltip text="View test plan" position="left">
              <button
                onClick={(e) => { e.stopPropagation(); onView(plan) }}
                className="p-1 rounded text-[var(--color-fonts-font-color-brand)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
              >
                <ArrowUpRight size={15} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      {hasKpis && (
        <div
          className="flex items-center gap-5 flex-wrap pt-2.5 border-t border-[var(--color-cards-cards-divider)]"
        >
          <KpiChip icon={BookOpen} value={plan.kpiStoryCount} label="stories" />
          <KpiChip icon={FlaskConical} value={plan.kpiBehaviourTcCount} label="behaviour TCs" />
          <KpiChip icon={Target} value={plan.kpiCapabilityTcCount} label="capability TCs" />
          <KpiChip icon={ShieldAlert} value={plan.kpiRiskCount} label="risks" />
          <KpiChip icon={AlertTriangle} value={plan.kpiOpenClarifications} label="open clarifications" warn />
        </div>
      )}
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'json_ready' | 'analysis' | 'none'

function FilterBar({
  active,
  counts,
  onChange,
}: {
  active: StatusFilter
  counts: Record<StatusFilter, number>
  onChange: (f: StatusFilter) => void
}) {
  const options: { key: StatusFilter; label: string; cls: string }[] = [
    { key: 'all', label: 'All', cls: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
    { key: 'json_ready', label: 'JSON Ready', cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
    { key: 'analysis', label: 'Analysis', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    { key: 'none', label: 'No Plan', cls: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-[var(--border-radius-tag)] transition-all ${o.cls} ${
            active === o.key
              ? 'ring-2 ring-offset-1 ring-[var(--color-buttons-button-primary)]'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          {o.label}
          <span className="font-bold tabular-nums">{counts[o.key]}</span>
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TestPlansPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const { data: plans = [], isLoading, refetch, isFetching } = useQuery<QaTestPlanSummary[]>({
    queryKey: ['qa-test-plans-all'],
    queryFn: () => api.get('/qa/test-plans').then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: mcpConfig } = useQuery<{ jira?: { baseUrl?: string } }>({
    queryKey: ['mcp-system-config'],
    queryFn: () => api.get('/mcp/system-config').then((r) => r.data).catch(() => ({})),
    staleTime: 5 * 60_000,
  })
  const jiraBaseUrl = mcpConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  const counts: Record<StatusFilter, number> = {
    all: plans.length,
    json_ready: plans.filter((p) => p.testPlanStatus === 'json_ready').length,
    analysis: plans.filter((p) => p.testPlanStatus === 'analysis').length,
    none: plans.filter((p) => p.testPlanStatus === 'none').length,
  }

  const filtered = plans.filter((p) => {
    const matchStatus = statusFilter === 'all' || p.testPlanStatus === statusFilter
    const matchSearch =
      !search ||
      p.issueKey.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const handleView = (plan: QaTestPlanSummary) => {
    // Navigate to the test plan detail — we don't have a scopeId here, so we use
    // the global route /qa/test-plans/:issueKey
    navigate({ to: `/qa/test-plans/${plan.issueKey}` })
  }

  return (
    <main>
      <PageHeader
        title="Test Plans"
        subtitle={`${plans.length} feature test plan${plans.length !== 1 ? 's' : ''}`}
        actions={
          <Tooltip text="Refresh" position="bottom">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-sm text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] disabled:opacity-50 transition-colors"
            >
              {isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Refresh
            </button>
          </Tooltip>
        }
      />

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <FilterBar active={statusFilter} counts={counts} onChange={setStatusFilter} />
        <div className="ml-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by key…"
            className="w-44 px-3 py-1.5 text-sm rounded border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-2 focus:ring-[var(--color-buttons-button-primary)]"
          />
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] p-16 text-center"
        >
          <FileText size={40} className="mb-3 text-[var(--color-fonts-font-color-support)] opacity-30" />
          <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
            {plans.length === 0 ? 'No test plans yet' : 'No plans match the current filter'}
          </p>
          <p className="text-xs mt-1 text-[var(--color-fonts-font-color-support)]">
            {plans.length === 0
              ? 'Open a QA Scope and generate analysis for a feature to get started.'
              : 'Try changing the status filter or clearing the search.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              jiraBaseUrl={jiraBaseUrl}
              onView={handleView}
            />
          ))}
        </div>
      )}
    </main>
  )
}
