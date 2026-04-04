import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, RefreshCw, ExternalLink, CheckCircle, XCircle, Ban, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from '@/components/ui/JobStatusBadge'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Toast } from '@/components/ui/Toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { FilterSelect } from '@/components/ui/FilterSelect'
import type { FilterSelectOption } from '@/components/ui/FilterSelect'
import api from '@/lib/api'
import type { JobStatusResponse, JobType } from '@/types/api'

const JOB_TYPES: JobType[] = [
  'FIX', 'REVIEW', 'FIX_PR', 'REPLY', 'FIX_COMMENT', 'HOOK',
  'GENERATE_TESTS', 'GENERATE_DOCS', 'SYNC_CONFLUENCE',
  'METRICS', 'QUALITY_REPORT',
  'REVIEW_EPIC', 'REVIEW_FEATURE', 'REVIEW_USERSTORY',
]

const STATUS_OPTIONS: FilterSelectOption[] = [
  { value: 'RUNNING',           label: 'Running',           dotClass: 'bg-[var(--color-status-border-neutral)]' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval', dotClass: 'bg-[var(--color-tags-attention-background)]' },
  { value: 'SUCCESS',           label: 'Success',           dotClass: 'bg-[var(--color-status-border-success)]' },
  { value: 'FAILED',            label: 'Failed',            dotClass: 'bg-[var(--color-status-border-critical)]' },
  { value: 'PENDING',           label: 'Pending',           dotClass: 'bg-[var(--color-tags-neutral-background)]' },
]

const TYPE_OPTIONS: FilterSelectOption[] = JOB_TYPES.map((t) => ({
  value: t,
  label: t.replace(/_/g, ' '),
}))

const PAGE_SIZE = 50

// ─── Pagination bar ───────────────────────────────────────────────────────────

interface PaginatorProps {
  page: number
  hasPrev: boolean
  hasNext: boolean
  fetching: boolean
  onPrev: () => void
  onNext: () => void
}

function Paginator({ page, hasPrev, hasNext, fetching, onPrev, onNext }: PaginatorProps) {
  const btnBase =
    'px-3 py-1 text-xs rounded border border-[var(--color-cards-card-stroke)] ' +
    'bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-headings)] ' +
    'disabled:opacity-40 hover:bg-[var(--color-tables-table-hover)] transition-colors'

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--color-fonts-font-color-support)] mr-1">
        {fetching ? 'Loading…' : `Page ${page + 1}`}
      </span>
      <button onClick={onPrev} disabled={!hasPrev || fetching} className={btnBase}>
        ← Prev
      </button>
      <button onClick={onNext} disabled={!hasNext || fetching} className={btnBase}>
        Next →
      </button>
    </div>
  )
}

export default function Jobs() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const handleStatusChange = (v: string) => { setStatusFilter(v); setPage(0) }
  const handleTypeChange   = (v: string) => { setTypeFilter(v);   setPage(0) }

  const { data: jobsData, isFetching: isLoading, refetch } = useQuery({
    queryKey: ['jobs', statusFilter, typeFilter, page],
    queryFn: () => {
      const params: Record<string, string | number> = { limit: PAGE_SIZE + 1, page }
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.jobType = typeFilter
      return api
        .get('/jobs', { params })
        .then((r) => {
          const raw: JobStatusResponse[] = Array.isArray(r.data) ? r.data : []
          return { items: raw.slice(0, PAGE_SIZE), hasNext: raw.length > PAGE_SIZE }
        })
        .catch(() => ({ items: [] as JobStatusResponse[], hasNext: false }))
    },
    placeholderData: (prev) => prev,
    refetchInterval: 10_000,
  })

  const list = jobsData?.items ?? []
  const hasPrev = page > 0
  const hasNext = jobsData?.hasNext ?? false

  const goNext = () => setPage((p) => p + 1)
  const goPrev = () => setPage((p) => Math.max(0, p - 1))

  const paginator = (
    <Paginator
      page={page}
      hasPrev={hasPrev}
      hasNext={hasNext}
      fetching={isLoading}
      onPrev={goPrev}
      onNext={goNext}
    />
  )

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Jobs"
        subtitle="Monitor and manage all agent jobs."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" icon={<RefreshCw size={16} />} onClick={() => refetch()}>
              Refresh
            </Button>
            <Tooltip text="Submit a new agent job">
              <Button variant="primary" size="lg" icon={<Plus size={15} />} onClick={() => navigate({ to: '/jobs/new' })}>
                New Job
              </Button>
            </Tooltip>
          </div>
        }
      />

      {/* Table */}
      <TableCard
        className="flex-1 min-h-0"
        title="Jobs"
        subtitle={`Page ${page + 1}`}
        toolbar={
          <div className="flex items-center gap-2">
            <FilterSelect
              value={statusFilter}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS}
              placeholder="All Statuses"
            />
            <FilterSelect
              value={typeFilter}
              onChange={handleTypeChange}
              options={TYPE_OPTIONS}
              placeholder="All Types"
            />
            {paginator}
          </div>
        }
      >
        <div className={isLoading ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: 'Job ID',   tip: 'Unique agent job identifier' },
                { label: 'Type',     tip: 'Job type (e.g. review, upgrade, docs)' },
                { label: 'Priority', tip: 'Dispatch priority (1–100, higher = first)' },
                { label: 'Status',   tip: 'Current execution status' },
                { label: 'Created',  tip: 'When the job was created' },
                { label: 'Ref',      tip: 'Associated pull request or Jira issue key' },
                { label: 'Actions',  tip: 'Available actions for this job' },
              ] as const).map(({ label, tip }) => (
                <th
                  key={label}
                  className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  <Tooltip text={tip} position="bottom">{label}</Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={7} className="px-3 py-1.5">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : list.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]">
                    No jobs found.
                  </td>
                </tr>
              )
              : list.map((job, i) => (
                  <JobRow key={job.jobId} job={job} isEven={i % 2 === 0} onToast={setToast} />
                ))}
          </tbody>
        </table>
        </div>

        {/* Bottom paginator */}
        <div className="flex justify-end px-4 py-3 border-t border-[var(--color-tables-table-cell-stroke)]">
          {paginator}
        </div>
      </TableCard>
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </main>
  )
}

type ToastState = { message: string; variant: 'success' | 'error' }

function JobRow({ job, isEven, onToast }: { job: JobStatusResponse; isEven: boolean; onToast: (t: ToastState) => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${job.jobId}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); onToast({ message: 'PR approved.', variant: 'success' }) },
    onError: () => onToast({ message: 'Failed to approve PR.', variant: 'error' }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${job.jobId}/reject`, { reason: 'Rejected via UI' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); onToast({ message: 'PR rejected.', variant: 'success' }) },
    onError: () => onToast({ message: 'Failed to reject PR.', variant: 'error' }),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${job.jobId}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); onToast({ message: 'Job cancelled.', variant: 'success' }) },
    onError: () => onToast({ message: 'Failed to cancel job.', variant: 'error' }),
  })

  const rerunMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${job.jobId}/rerun`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); onToast({ message: 'Job queued for rerun.', variant: 'success' }) },
    onError: () => onToast({ message: 'Failed to rerun job.', variant: 'error' }),
  })

  return (
    <tr
      className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
        isEven ? 'bg-[var(--color-tables-table-row-a)]' : ''
      }`}
      onClick={() => navigate({ to: '/jobs/$id', params: { id: job.jobId } })}
    >
      <td className="px-3 py-1.5 font-mono text-[var(--color-fonts-font-color-support)]">
        {job.jobId.slice(0, 8)}…
      </td>
      <td className="px-3 py-1.5 font-medium">{job.jobType}</td>
      <td className="px-3 py-1.5 text-center">
        {job.priority != null && (
          <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]">
            {job.priority}
          </span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <JobStatusBadge status={job.status} />
      </td>
      <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)]">
        {new Date(job.createdAt).toLocaleString()}
      </td>
      <td className="px-3 py-1.5">
        {job.prUrl ? (
          <a
            href={job.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ExternalLink size={12} />
            PR
          </a>
        ) : job.jiraKey ? (
          <span className="text-[var(--color-fonts-font-color-support)] font-mono text-[11px]">
            {job.jiraKey}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {job.status === 'AWAITING_APPROVAL' && (
            <>
              <Button
                variant="success"
                size="xs"
                icon={<CheckCircle size={14} />}
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="xs"
                icon={<XCircle size={14} />}
                loading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                Reject
              </Button>
            </>
          )}
          {(job.status === 'PENDING' || job.status === 'QUEUED') && (
            job.soc2Protected ? (
              <Tooltip text="SOC II: cancellation not permitted for compliance records.">
                <Button variant="danger" size="xs" icon={<Ban size={14} />} disabled>
                  Cancel
                </Button>
              </Tooltip>
            ) : (
              <Button
                variant="danger"
                size="xs"
                icon={<Ban size={14} />}
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                Cancel
              </Button>
            )
          )}
          {(job.status === 'FAILED' || job.status === 'SUCCESS') && (
            <Button
              variant="ghost"
              size="xs"
              icon={<RotateCcw size={14} />}
              loading={rerunMutation.isPending}
              onClick={() => rerunMutation.mutate()}
            >
              Rerun
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

export { JOB_TYPES }
