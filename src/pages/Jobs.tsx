import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, RefreshCw, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from './Dashboard'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { FilterSelect } from '@/components/ui/FilterSelect'
import type { FilterSelectOption } from '@/components/ui/FilterSelect'
import api from '@/lib/api'
import type { JobStatusResponse, JobType } from '@/types/api'

const JOB_TYPES: JobType[] = ['FIX', 'REVIEW', 'GENERATE_TESTS', 'GENERATE_DOCS', 'METRICS', 'QUALITY_REPORT']

const STATUS_OPTIONS: FilterSelectOption[] = [
  { value: 'RUNNING',           label: 'Running',           dotClass: 'bg-[var(--color-status-border-neutral)]' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval', dotClass: 'bg-[var(--color-tags-attention-background)]' },
  { value: 'SUCCESS',           label: 'Success',           dotClass: 'bg-[var(--color-status-border-success)]' },
  { value: 'FAILED',            label: 'Failed',            dotClass: 'bg-[var(--color-status-border-critical)]' },
  { value: 'PENDING',           label: 'Pending',           dotClass: 'bg-[var(--color-tags-neutral-background)]' },
]

export default function Jobs() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')

  const { data: jobs, isLoading, refetch } = useQuery<JobStatusResponse[]>({
    queryKey: ['jobs', statusFilter],
    queryFn: () =>
      api
        .get('/jobs', { params: statusFilter ? { status: statusFilter } : {} })
        .then((r) => r.data)
        .catch(() => []),
    refetchInterval: 10_000,
  })

  const list = Array.isArray(jobs) ? jobs : []

  return (
    <main>
      <PageHeader
        title="Jobs"
        subtitle="Monitor and manage all agent jobs."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" icon={<RefreshCw size={16} />} onClick={() => refetch()} title="Refresh" />
            <Button variant="primary" size="lg" icon={<Plus size={15} />} onClick={() => navigate({ to: '/jobs/new' })}>
              New Job
            </Button>
          </div>
        }
      />

      {/* Table */}
      <TableCard
        title="Jobs"
        subtitle={list.length > 0 ? `${list.length} ${list.length === 1 ? 'job' : 'jobs'}` : undefined}
        toolbar={
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
          />
        }
      >
        <table className="w-full text-xs">
          <thead className="sticky top-[33px] z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: 'Job ID',  tip: 'Unique agent job identifier' },
                { label: 'Type',    tip: 'Job type (e.g. review, upgrade, docs)' },
                { label: 'Status',  tip: 'Current execution status' },
                { label: 'Created', tip: 'When the job was created' },
                { label: 'PR',      tip: 'Associated pull request' },
                { label: 'Actions', tip: 'Available actions for this job' },
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
                    <td colSpan={6} className="px-3 py-1.5">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : list.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]">
                    No jobs found.
                  </td>
                </tr>
              )
              : list.map((job, i) => (
                  <JobRow key={job.jobId} job={job} isEven={i % 2 === 0} />
                ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  )
}

function JobRow({ job, isEven }: { job: JobStatusResponse; isEven: boolean }) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${job.jobId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${job.jobId}/reject`, { reason: 'Rejected via UI' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
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
      <td className="px-3 py-1.5">
        <JobStatusBadge status={job.status} />
      </td>
      <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)]">
        {new Date(job.createdAt).toLocaleString()}
      </td>
      <td className="px-3 py-1.5">
        {job.prUrl && (
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
        )}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        {job.status === 'AWAITING_APPROVAL' && (
          <div className="flex items-center gap-1">
            <Button
              variant="success"
              size="xs"
              icon={<CheckCircle size={14} />}
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
              title="Approve"
            />
            <Button
              variant="danger"
              size="xs"
              icon={<XCircle size={14} />}
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
              title="Reject"
            />
          </div>
        )}
      </td>
    </tr>
  )
}

export { JOB_TYPES }
