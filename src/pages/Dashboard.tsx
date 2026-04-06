import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  GitBranch,
  Loader2,
  Play,
  Shield,
  Upload,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useStore } from '@tanstack/react-store'
import { authStore } from '@/store/auth-store'
import api from '@/lib/api'
import type {
  AiCallSummaryByJobType,
  ExecutionPlan,
  JobStatusResponse,
  Soc2AuditResponse,
  SlaStatus,
} from '@/types/api'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { JobStatusBadge } from '@/components/ui/JobStatusBadge'

function StatCard({
  label,
  value,
  icon,
  accent,
  onClick,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent?: string
  onClick?: () => void
}) {
  const inner = (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-4 py-3 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] h-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wider">
          {label}
        </span>
        <span className={accent ?? 'text-[var(--color-icons-icon)]'}>{icon}</span>
      </div>
      <p className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
    </div>
  )

  if (onClick) {
    return (
      <button className="text-left w-full hover:opacity-90 transition-opacity" onClick={onClick}>
        {inner}
      </button>
    )
  }
  return inner
}

function NeedsAttentionSection({
  approvalJobs,
  failedJobs,
}: {
  approvalJobs: JobStatusResponse[]
  failedJobs: JobStatusResponse[]
}) {
  const navigate = useNavigate()

  if (approvalJobs.length === 0 && failedJobs.length === 0) return null

  const total = approvalJobs.length + failedJobs.length

  return (
    <div className="mb-4 rounded-[var(--border-radius-card)] border border-[var(--color-tags-attention-background)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-tags-attention-background)]">
        <AlertTriangle size={13} className="text-[var(--color-tags-font-attention)] shrink-0" />
        <span className="text-xs font-semibold text-[var(--color-tags-font-attention)]">
          Needs Attention
        </span>
        <span className="ml-auto text-[10px] text-[var(--color-tags-font-attention)] opacity-70">
          {total} {total === 1 ? 'item' : 'items'}
        </span>
      </div>
      <div className="bg-[var(--color-cards-card-background)] divide-y divide-[var(--color-cards-card-stroke)]">
        {approvalJobs.map((job) => (
          <AttentionRow
            key={`approval-${job.jobId}`}
            job={job}
            iconNode={
              <AlertTriangle size={13} className="shrink-0 text-[var(--color-tags-font-attention)]" />
            }
            onClick={() => navigate({ to: '/jobs/$id', params: { id: job.jobId } })}
          />
        ))}
        {failedJobs.map((job) => (
          <AttentionRow
            key={`failed-${job.jobId}`}
            job={job}
            iconNode={
              <XCircle size={13} className="shrink-0 text-[var(--color-tags-font-critical)]" />
            }
            errorMsg={job.errorMessage}
            onClick={() => navigate({ to: '/jobs/$id', params: { id: job.jobId } })}
          />
        ))}
      </div>
    </div>
  )
}

function AttentionRow({
  job,
  iconNode,
  errorMsg,
  onClick,
}: {
  job: JobStatusResponse
  iconNode: React.ReactNode
  errorMsg?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 hover:bg-[var(--color-cards-card-background-hover)] transition-colors flex items-center gap-3"
    >
      {iconNode}
      <span className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] shrink-0">
        {job.jobType.replace(/_/g, ' ')}
      </span>
      {(job.workspace || job.repoSlug) && (
        <span className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0">
          {[job.workspace, job.repoSlug].filter(Boolean).join('/')}
        </span>
      )}
      {job.jiraKey && (
        <span className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0">
          {job.jiraKey}
        </span>
      )}
      {errorMsg && (
        <span className="text-xs text-[var(--color-tags-font-critical)] truncate min-w-0">
          {errorMsg}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <JobStatusBadge status={job.status} />
        <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
          {new Date(job.createdAt).toLocaleDateString()}
        </span>
        <ArrowRight size={12} className="text-[var(--color-icons-icon)]" />
      </div>
    </button>
  )
}

function PlanStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    EXECUTING: 'bg-[var(--color-status-neutral-background)] text-[var(--color-fonts-font-color-brand)]',
    APPROVED: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    PAUSED: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
    DRAFT: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    FAILED: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
    COMPLETED: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    CANCELLED: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  }
  const cls = map[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      {status}
    </span>
  )
}

function ActivePlansSection({ plans }: { plans: ExecutionPlan[] }) {
  const navigate = useNavigate()

  return (
    <TableCard
      className="mb-4"
      title="Active Plans"
      subtitle={`${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}`}
      toolbar={
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/plans' })}>
          View all
        </Button>
      }
    >
      <div className="divide-y divide-[var(--color-cards-card-stroke)]">
        {plans.map((plan) => (
          <button
            key={plan.planId}
            onClick={() => navigate({ to: '/plans/$id', params: { id: plan.planId } })}
            className="w-full text-left px-3 py-2 hover:bg-[var(--color-cards-card-background-hover)] transition-colors flex items-center gap-3"
          >
            <Play size={12} className="shrink-0 text-[var(--color-icons-icon)]" />
            <span className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] truncate min-w-0 flex-1">
              {plan.title}
            </span>
            {plan.repoUrl && (
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)] flex items-center gap-1 shrink-0">
                <GitBranch size={10} />
                {plan.repoUrl.replace(/^https?:\/\/[^/]+\//, '')}
              </span>
            )}
            {plan.sourceRef && (
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)] shrink-0">
                {plan.sourceRef}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <PlanStatusBadge status={plan.status} />
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                {new Date(plan.createdAt).toLocaleDateString()}
              </span>
              <ArrowRight size={12} className="text-[var(--color-icons-icon)]" />
            </div>
          </button>
        ))}
      </div>
    </TableCard>
  )
}

function JobActivitySection({ data }: { data: AiCallSummaryByJobType | undefined }) {
  if (!data?.jobTypeBreakdown || data.jobTypeBreakdown.length === 0) return null

  const breakdown = data.jobTypeBreakdown.filter((item) => item.jobType !== 'CHAT')
  if (breakdown.length === 0) return null

  return (
    <TableCard className="mb-4" title="Job Activity" subtitle="by type">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-tables-table-header-background)]">
            <th className="text-left px-3 py-1.5 font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide text-[10px]">
              Type
            </th>
            <th className="text-right px-3 py-1.5 font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide text-[10px]">
              Jobs
            </th>
            <th className="text-right px-3 py-1.5 font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide text-[10px]">
              AI Calls
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-cards-card-stroke)]">
          {breakdown.map((item) => (
            <tr
              key={item.jobType}
              className="hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
            >
              <td className="px-3 py-2 font-medium text-[var(--color-fonts-font-color-primary)] capitalize">
                {item.jobType.replace(/_/g, ' ').toLowerCase()}
              </td>
              <td className="px-3 py-2 text-right text-[var(--color-fonts-font-color-primary)]">
                {item.uniqueJobs.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-[var(--color-fonts-font-color-support)]">
                {item.callCount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  )
}

function SlaBadge({ status, deadline }: { status: SlaStatus; deadline?: string }) {
  const map: Record<SlaStatus, { label: string; cls: string }> = {
    ON_TRACK:       { label: 'On Track',    cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
    AT_RISK:        { label: 'At Risk',     cls: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]' },
    OVERDUE:        { label: 'Overdue',     cls: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]' },
    MET:            { label: 'SLA Met',     cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
    MISSED:         { label: 'SLA Missed',  cls: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]' },
    NOT_APPLICABLE: { label: 'N/A',         cls: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
  }
  const entry = map[status] ?? map.NOT_APPLICABLE
  const deadlineStr = deadline ? new Date(deadline).toLocaleDateString() : null
  return (
    <Tooltip text={deadlineStr ? `Deadline: ${deadlineStr}` : 'No SLA configured'}>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${entry.cls}`}>
        {entry.label}
      </span>
    </Tooltip>
  )
}

function Soc2Section() {
  const navigate = useNavigate()

  const { data } = useQuery<Soc2AuditResponse>({
    queryKey: ['dashboard-soc2'],
    queryFn: () =>
      api.get('/compliance/soc2', { params: { limit: 100 } }).then((r) => r.data).catch(() => null),
    refetchInterval: 60_000,
  })

  const items = data?.items ?? []
  if (items.length === 0) return null

  const overdue       = items.filter((j) => j.slaStatus === 'OVERDUE')
  const atRisk        = items.filter((j) => j.slaStatus === 'AT_RISK')
  const noReview      = items.filter((j) => j.reviewStatus === 'NONE').length
  const scytalePending = items.filter((j) => !j.scytaleUploaded && j.jobStatus === 'SUCCESS').length

  const criticalItems = [...overdue, ...atRisk].slice(0, 4)

  return (
    <TableCard
      className="mb-4"
      title="SOC II Compliance"
      subtitle={`${data?.total ?? items.length} tracked`}
      toolbar={
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/compliance/soc2' })}>
          View all
        </Button>
      }
    >
      {/* KPI strip */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-3 py-2 border-b border-[var(--color-cards-card-stroke)]">
        {[
          { label: 'Overdue SLA',     value: overdue.length,    urgent: overdue.length > 0 },
          { label: 'At Risk',         value: atRisk.length,     warn: atRisk.length > 0 },
          { label: 'Awaiting Review', value: noReview,          warn: noReview > 0 },
          { label: 'Scytale Pending', value: scytalePending,    warn: scytalePending > 0 },
        ].map(({ label, value, urgent, warn }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
              {label}
            </span>
            <span
              className={`text-sm font-bold ${
                urgent
                  ? 'text-[var(--color-tags-font-critical)]'
                  : warn
                    ? 'text-[var(--color-tags-font-attention)]'
                    : 'text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Critical items */}
      {criticalItems.length > 0 && (
        <table className="w-full text-xs">
          <tbody className="divide-y divide-[var(--color-cards-card-stroke)]">
            {criticalItems.map((job) => (
              <tr
                key={job.jobId}
                className="hover:bg-[var(--color-cards-card-background-hover)] transition-colors cursor-pointer"
                onClick={() => navigate({ to: '/jobs/$id', params: { id: job.jobId } })}
              >
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-fonts-font-color-support)] w-24">
                  {job.jiraKey ?? job.jobId.slice(0, 8) + '…'}
                </td>
                <td className="px-3 py-2 text-[var(--color-fonts-font-color-primary)] capitalize">
                  {job.jobType.replace(/_/g, ' ').toLowerCase()}
                </td>
                <td className="px-3 py-2">
                  <SlaBadge status={job.slaStatus} deadline={job.slaDeadline} />
                </td>
                <td className="px-3 py-2">
                  {job.scytaleUploaded ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
                      <Upload size={10} /> Uploaded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      <Upload size={10} /> Pending
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-[10px] text-[var(--color-fonts-font-color-support)] text-right whitespace-nowrap">
                  {job.slaDeadline
                    ? new Date(job.slaDeadline).toLocaleDateString()
                    : new Date(job.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <ArrowRight size={12} className="text-[var(--color-icons-icon)] ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {criticalItems.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-3 text-xs text-[var(--color-fonts-font-color-support)]">
          <Shield size={14} className="opacity-50" />
          All tracked jobs are on track. No SLA issues detected.
        </div>
      )}
    </TableCard>
  )
}

interface LogAttentionItem {
  id: number
  exceptionClass?: string
  customerId: string
  environmentName: string
  severity?: string
  occurrenceCount: number
  firstSeenAt: string
  jiraKey?: string
}

interface LogAttentionData {
  openTotal: number
  monitoringTotal: number
  items: LogAttentionItem[]
}

function SeverityDot({ severity }: { severity?: string }) {
  const cls =
    severity === 'high'
      ? 'bg-[var(--color-tags-font-critical)]'
      : severity === 'medium'
        ? 'bg-[var(--color-tags-font-attention)]'
        : 'bg-[var(--color-tags-font-neutral)]'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />
}

function LogFindingsAttentionSection({ data }: { data: LogAttentionData }) {
  const navigate = useNavigate()
  if (data.openTotal === 0 && data.monitoringTotal === 0) return null

  return (
    <div className="mb-4 rounded-[var(--border-radius-card)] border border-[var(--color-tags-critical-background)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-tags-critical-background)]">
        <AlertTriangle size={13} className="text-[var(--color-tags-font-critical)] shrink-0" />
        <span className="text-xs font-semibold text-[var(--color-tags-font-critical)]">
          Log Analysis Findings
        </span>
        <div className="ml-auto flex items-center gap-3">
          {data.openTotal > 0 && (
            <span className="text-[10px] text-[var(--color-tags-font-critical)] opacity-80">
              {data.openTotal} open
            </span>
          )}
          {data.monitoringTotal > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-tags-font-attention)] opacity-80">
              <Eye size={10} />
              {data.monitoringTotal} monitoring
            </span>
          )}
        </div>
      </div>
      <div className="bg-[var(--color-cards-card-background)] divide-y divide-[var(--color-cards-card-stroke)]">
        {data.items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate({ to: '/log-analysis' })}
            className="w-full text-left px-3 py-2 hover:bg-[var(--color-cards-card-background-hover)] transition-colors flex items-center gap-2"
          >
            <SeverityDot severity={item.severity} />
            <span className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] truncate min-w-0 flex-1">
              {item.exceptionClass ?? 'Unknown exception'}
            </span>
            <span className="text-[10px] text-[var(--color-fonts-font-color-support)] shrink-0">
              {item.customerId}/{item.environmentName}
            </span>
            {item.jiraKey && (
              <span className="text-[10px] font-mono text-[var(--color-fonts-font-color-support)] shrink-0">
                {item.jiraKey}
              </span>
            )}
            <span className="text-[10px] text-[var(--color-fonts-font-color-support)] shrink-0">
              ×{item.occurrenceCount}
            </span>
            <ArrowRight size={12} className="text-[var(--color-icons-icon)] shrink-0" />
          </button>
        ))}
        {data.items.length === 0 && data.openTotal > 0 && (
          <button
            onClick={() => navigate({ to: '/log-analysis' })}
            className="w-full text-left px-3 py-2 hover:bg-[var(--color-cards-card-background-hover)] transition-colors flex items-center gap-2"
          >
            <AlertTriangle size={12} className="text-[var(--color-tags-font-critical)] shrink-0" />
            <span className="text-xs text-[var(--color-fonts-font-color-primary)]">
              {data.openTotal} open finding{data.openTotal !== 1 ? 's' : ''} require attention
            </span>
            <ArrowRight size={12} className="text-[var(--color-icons-icon)] ml-auto shrink-0" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useStore(authStore, (s) => s.user)!
  const navigate = useNavigate()

  const { data: recentJobsData } = useQuery<JobStatusResponse[]>({
    queryKey: ['dashboard-jobs'],
    queryFn: () =>
      api.get('/jobs', { params: { limit: 50 } }).then((r) => r.data).catch(() => []),
    refetchInterval: 15_000,
  })

  const { data: approvalJobsData } = useQuery<JobStatusResponse[]>({
    queryKey: ['dashboard-approval-jobs'],
    queryFn: () =>
      api
        .get('/jobs', { params: { status: 'AWAITING_APPROVAL', limit: 10 } })
        .then((r) => r.data)
        .catch(() => []),
    refetchInterval: 15_000,
  })

  const { data: failedJobsData } = useQuery<JobStatusResponse[]>({
    queryKey: ['dashboard-failed-jobs'],
    queryFn: () =>
      api
        .get('/jobs', { params: { status: 'FAILED', limit: 5 } })
        .then((r) => r.data)
        .catch(() => []),
    refetchInterval: 30_000,
  })

  const { data: activityData } = useQuery<AiCallSummaryByJobType>({
    queryKey: ['ai-calls-summary-by-job-type'],
    queryFn: () => api.get('/stats/ai-calls/summary-by-job-type').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: plansData } = useQuery<ExecutionPlan[]>({
    queryKey: ['dashboard-plans'],
    queryFn: () => api.get('/plans').then((r) => r.data).catch(() => []),
    refetchInterval: 30_000,
  })

  const { data: logAttentionData } = useQuery<LogAttentionData>({
    queryKey: ['dashboard-log-attention'],
    queryFn: () =>
      api.get('/log-analysis/attention').then((r) => r.data).catch(() => null),
    refetchInterval: 60_000,
  })

  const jobs = Array.isArray(recentJobsData) ? recentJobsData : []
  const approvalJobs = Array.isArray(approvalJobsData) ? approvalJobsData : []
  const failedJobs = Array.isArray(failedJobsData) ? failedJobsData : []
  const allPlans = Array.isArray(plansData) ? plansData : []

  const today = new Date().toDateString()
  const runningCount = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'QUEUED').length
  const approvalCount = approvalJobs.length
  const todayCount = jobs.filter((j) => new Date(j.createdAt).toDateString() === today).length

  const terminalJobs = jobs.filter((j) => j.status === 'SUCCESS' || j.status === 'FAILED')
  const successRate =
    terminalJobs.length > 0
      ? Math.round(
          (terminalJobs.filter((j) => j.status === 'SUCCESS').length / terminalJobs.length) * 100,
        )
      : null

  const activePlans = allPlans.filter(
    (p) => (p.status === 'EXECUTING' || p.status === 'APPROVED') && !p.archived,
  )

  const firstName = user.name.split(' ')[0]

  return (
    <main>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's what's happening with your Code Agent."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          label="Running Now"
          value={runningCount}
          icon={<Loader2 size={15} />}
        />
        <StatCard
          label="Needs Approval"
          value={approvalCount}
          icon={<AlertTriangle size={15} />}
          accent={
            approvalCount > 0
              ? 'text-[var(--color-tags-font-attention)]'
              : 'text-[var(--color-icons-icon)]'
          }
          onClick={approvalCount > 0 ? () => navigate({ to: '/jobs' }) : undefined}
        />
        <StatCard
          label="Jobs Today"
          value={todayCount}
          icon={<Activity size={15} />}
        />
        <StatCard
          label="Success Rate"
          value={successRate !== null ? `${successRate}%` : '—'}
          icon={<CheckCircle2 size={15} />}
          accent={
            successRate === null
              ? 'text-[var(--color-icons-icon)]'
              : successRate >= 80
                ? 'text-[var(--color-status-border-success)]'
                : 'text-[var(--color-status-border-critical)]'
          }
        />
      </div>

      <NeedsAttentionSection approvalJobs={approvalJobs} failedJobs={failedJobs} />

      {logAttentionData && (logAttentionData.openTotal > 0 || logAttentionData.monitoringTotal > 0) && (
        <LogFindingsAttentionSection data={logAttentionData} />
      )}

      {activePlans.length > 0 && <ActivePlansSection plans={activePlans} />}

      <JobActivitySection data={activityData} />

      <Soc2Section />

      <TableCard title="Quick Actions" className="mb-4">
        <div className="flex flex-wrap gap-2 p-3">
          {(
            [
              { label: 'New Fix Job', to: '/jobs/new', variant: 'primary' },
              { label: 'View Jobs', to: '/jobs', variant: 'secondary' },
              { label: 'New Plan', to: '/plans/new', variant: 'secondary' },
              { label: 'View Plans', to: '/plans', variant: 'secondary' },
              { label: 'Quality Reports', to: '/metrics/quality', variant: 'secondary' },
            ] as const
          ).map(({ label, to, variant }) => (
            <Button key={to} variant={variant} size="sm" onClick={() => navigate({ to })}>
              {label}
            </Button>
          ))}
        </div>
      </TableCard>

      <TableCard
        title="Recent Jobs"
        maxHeight="none"
        toolbar={
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/jobs' })}>
            View all
          </Button>
        }
      >
        <RecentJobsList />
      </TableCard>
    </main>
  )
}

function RecentJobsList() {
  const navigate = useNavigate()
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => api.get('/jobs?limit=5').then((r) => r.data).catch(() => []),
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <div className="p-3 space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 skeleton-shimmer rounded-[var(--border-radius-card)]" />
        ))}
      </div>
    )
  }

  const list = Array.isArray(jobs) ? jobs : []

  if (list.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-fonts-font-color-support)]">
        <Clock size={24} className="mx-auto mb-2 opacity-40" />
        <p className="text-xs">No recent jobs found. Trigger your first job!</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--color-cards-card-stroke)]">
      {list.map(
        (job: {
          jobId: string
          jobType: string
          status: string
          createdAt: string
          workspace?: string
          repoSlug?: string
          sourceBranch?: string
        }) => (
          <button
            key={job.jobId}
            onClick={() => navigate({ to: '/jobs/$id', params: { id: job.jobId } })}
            className="w-full text-left px-3 py-2 hover:bg-[var(--color-cards-card-background-hover)] transition-colors flex items-center gap-3"
          >
            <span className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] shrink-0">
              {job.jobType.replace(/_/g, ' ')}
            </span>
            {(job.workspace || job.repoSlug) && (
              <span className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0">
                {[job.workspace, job.repoSlug].filter(Boolean).join('/')}
              </span>
            )}
            {job.sourceBranch && (
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)] flex items-center gap-1 shrink-0">
                <GitBranch size={10} />
                {job.sourceBranch}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <JobStatusBadge status={job.status} />
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                {new Date(job.createdAt).toLocaleString()}
              </span>
            </div>
          </button>
        ),
      )}
    </div>
  )
}

