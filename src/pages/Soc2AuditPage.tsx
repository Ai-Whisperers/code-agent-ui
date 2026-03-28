import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Upload,
  GitBranch,
  Eye,
  EyeOff,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { FilterSelect } from '@/components/ui/FilterSelect'
import api from '@/lib/api'
import type { Soc2AuditResponse, Soc2JobSummary, SlaStatus } from '@/types/api'

// ── SLA badge ─────────────────────────────────────────────────────────────────

function SlaBadge({ status, deadline }: { status: SlaStatus; deadline?: string }) {
  const map: Record<SlaStatus, { icon: React.ReactNode; label: string; cls: string }> = {
    ON_TRACK:       { icon: <CheckCircle2 size={12} />, label: 'On Track',       cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
    AT_RISK:        { icon: <AlertTriangle size={12} />, label: 'At Risk',        cls: 'bg-[var(--color-tags-warning-background)] text-[var(--color-tags-font-warning)]' },
    OVERDUE:        { icon: <XCircle size={12} />,      label: 'Overdue',        cls: 'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]' },
    MET:            { icon: <CheckCircle2 size={12} />, label: 'SLA Met',        cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
    MISSED:         { icon: <XCircle size={12} />,      label: 'SLA Missed',     cls: 'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]' },
    NOT_APPLICABLE: { icon: <Clock size={12} />,        label: 'N/A',            cls: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
  }
  const entry = map[status] ?? map.NOT_APPLICABLE
  const deadlineStr = deadline ? new Date(deadline).toLocaleDateString() : null
  return (
    <Tooltip text={deadlineStr ? `Deadline: ${deadlineStr}` : 'No SLA configured'}>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${entry.cls}`}>
        {entry.icon}
        {entry.label}
      </span>
    </Tooltip>
  )
}

// ── Review status badge ────────────────────────────────────────────────────────

function ReviewBadge({ status }: { status: 'NONE' | 'IN_PROGRESS' | 'COMPLETE' }) {
  if (status === 'COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
        <Eye size={11} /> Reviewed
      </span>
    )
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-brand-background)] text-[var(--color-tags-font-brand)]">
        <Clock size={11} /> In Progress
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
      <EyeOff size={11} /> No Review
    </span>
  )
}

// ── Job status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const clsMap: Record<string, string> = {
    SUCCESS:           'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    FAILED:            'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]',
    AWAITING_APPROVAL: 'bg-[var(--color-tags-warning-background)] text-[var(--color-tags-font-warning)]',
    RUNNING:           'bg-[var(--color-tags-brand-background)] text-[var(--color-tags-font-brand)]',
    QUEUED:            'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    PENDING:           'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${clsMap[status] ?? clsMap.PENDING}`}>
      {status}
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Soc2Row({ job, isEven }: { job: Soc2JobSummary; isEven: boolean }) {
  const navigate = useNavigate()
  return (
    <tr
      className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
        isEven ? 'bg-[var(--color-tables-table-row-a)]' : ''
      }`}
      onClick={() => navigate({ to: '/jobs/$id', params: { id: job.jobId } })}
    >
      {/* Job ID */}
      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-fonts-font-color-support)]">
        {job.jobId.slice(0, 8)}…
      </td>

      {/* Jira key + priority */}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {job.jiraKey ? (
            <span className="font-mono text-[12px] font-semibold text-[var(--color-fonts-font-color-brand)]">
              {job.jiraKey}
            </span>
          ) : (
            <span className="text-[var(--color-fonts-font-color-support)] text-[11px]">—</span>
          )}
          {job.jiraPriority && (
            <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
              {job.jiraPriority}
            </span>
          )}
        </div>
      </td>

      {/* Aikido */}
      <td className="px-3 py-2 text-center">
        {job.aikidoIssueId ? (
          <Tooltip text={`Aikido: ${job.aikidoIssueId}`}>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]">
              <ShieldCheck size={11} /> Linked
            </span>
          </Tooltip>
        ) : (
          <span className="text-[var(--color-fonts-font-color-support)] text-[11px]">—</span>
        )}
      </td>

      {/* Job status */}
      <td className="px-3 py-2">
        <StatusBadge status={job.jobStatus} />
      </td>

      {/* SLA */}
      <td className="px-3 py-2">
        <SlaBadge status={job.slaStatus} deadline={job.slaDeadline} />
      </td>

      {/* Review */}
      <td className="px-3 py-2">
        <ReviewBadge status={job.reviewStatus} />
      </td>

      {/* Scytale */}
      <td className="px-3 py-2 text-center">
        {job.scytaleUploaded ? (
          <Tooltip text="Evidence uploaded to Scytale">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
              <Upload size={11} /> Uploaded
            </span>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
            <Upload size={11} /> Pending
          </span>
        )}
      </td>

      {/* PR link */}
      <td className="px-3 py-2 text-center">
        {job.prUrl ? (
          <a
            href={job.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline text-[12px]"
          >
            <GitBranch size={12} />
            PR
            <ExternalLink size={10} />
          </a>
        ) : (
          <span className="text-[var(--color-fonts-font-color-support)] text-[11px]">—</span>
        )}
      </td>

      {/* Date */}
      <td className="px-3 py-2 text-[var(--color-fonts-font-color-support)] text-[11px] whitespace-nowrap">
        {new Date(job.createdAt).toLocaleDateString()}
      </td>
    </tr>
  )
}

// ── Filter options ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'RUNNING',           label: 'Running' },
  { value: 'SUCCESS',           label: 'Success' },
  { value: 'FAILED',            label: 'Failed' },
  { value: 'PENDING',           label: 'Pending' },
]

const SLA_OPTIONS = [
  { value: 'ON_TRACK', label: 'On Track' },
  { value: 'AT_RISK',  label: 'At Risk' },
  { value: 'OVERDUE',  label: 'Overdue' },
  { value: 'MET',      label: 'SLA Met' },
  { value: 'MISSED',   label: 'SLA Missed' },
]

const REVIEW_OPTIONS = [
  { value: 'NONE',        label: 'No Review' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETE',    label: 'Reviewed' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Soc2AuditPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [slaFilter, setSlaFilter] = useState('')
  const [reviewFilter, setReviewFilter] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const params = new URLSearchParams({ limit: String(limit), page: String(page) })
  if (statusFilter) params.set('status', statusFilter)
  if (slaFilter)    params.set('slaStatus', slaFilter)
  if (reviewFilter) params.set('reviewStatus', reviewFilter)

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Soc2AuditResponse>({
    queryKey: ['soc2-audit', statusFilter, slaFilter, reviewFilter, page],
    queryFn: () => api.get<Soc2AuditResponse>(`/compliance/soc2?${params}`),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // Summary KPIs
  const overdue   = items.filter(j => j.slaStatus === 'OVERDUE').length
  const atRisk    = items.filter(j => j.slaStatus === 'AT_RISK').length
  const noReview  = items.filter(j => j.reviewStatus === 'NONE').length
  const noScytale = items.filter(j => !j.scytaleUploaded && j.jobStatus === 'SUCCESS').length

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader
        title="SOC II Audit"
        subtitle={`${total} compliance-tracked job${total !== 1 ? 's' : ''}`}
        actions={
          <Tooltip text="Refresh">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </Tooltip>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Overdue SLA',      value: overdue,   cls: overdue   > 0 ? 'text-[var(--color-tags-font-danger)]'  : '' },
          { label: 'At-risk SLA',      value: atRisk,    cls: atRisk    > 0 ? 'text-[var(--color-tags-font-warning)]' : '' },
          { label: 'Awaiting Review',  value: noReview,  cls: noReview  > 0 ? 'text-[var(--color-tags-font-warning)]' : '' },
          { label: 'Scytale Pending',  value: noScytale, cls: noScytale > 0 ? 'text-[var(--color-tags-font-warning)]' : '' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-[var(--color-card-card-stroke)] bg-[var(--color-card-card-background)] p-4 flex flex-col gap-1"
          >
            <span className="text-[11px] text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
              {kpi.label}
            </span>
            <span className={`text-2xl font-bold ${kpi.cls || 'text-[var(--color-fonts-font-color-primary)]'}`}>
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <FilterSelect
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(0) }}
          options={STATUS_OPTIONS}
          placeholder="All Statuses"
        />
        <FilterSelect
          value={slaFilter}
          onChange={(v) => { setSlaFilter(v); setPage(0) }}
          options={SLA_OPTIONS}
          placeholder="All SLA Statuses"
        />
        <FilterSelect
          value={reviewFilter}
          onChange={(v) => { setReviewFilter(v); setPage(0) }}
          options={REVIEW_OPTIONS}
          placeholder="All Review Statuses"
        />
        {(statusFilter || slaFilter || reviewFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter(''); setSlaFilter(''); setReviewFilter(''); setPage(0) }}
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-[12px] text-[var(--color-fonts-font-color-support)]">
          {total} result{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <TableCard>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-tables-table-cell-stroke)] bg-[var(--color-tables-table-header)]">
              {['Job ID', 'Jira / Priority', 'Aikido', 'Status', 'SLA', 'Review', 'Scytale', 'PR', 'Created'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-[var(--color-tags-font-danger)]">
                  Failed to load SOC II jobs.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center">
                  <div className="flex flex-col items-center gap-2 text-[var(--color-fonts-font-color-support)]">
                    <Shield size={28} className="opacity-40" />
                    <p className="text-sm">No SOC II compliance jobs found.</p>
                    <p className="text-[11px]">Jobs linked to Bug-type Jira tickets will appear here.</p>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((job, i) => (
                <Soc2Row key={job.jobId} job={job} isEven={i % 2 === 0} />
              ))
            )}
          </tbody>
        </table>
      </TableCard>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <span className="text-[12px] text-[var(--color-fonts-font-color-support)]">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </main>
  )
}
