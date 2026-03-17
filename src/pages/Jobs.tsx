import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, RefreshCw, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from './Dashboard'
import api from '@/lib/api'
import type { JobStatusResponse, JobStatus, JobType } from '@/types/api'

const JOB_TYPES: JobType[] = ['FIX', 'REVIEW', 'GENERATE_TESTS', 'GENERATE_DOCS', 'METRICS', 'QUALITY_REPORT']
const STATUS_FILTERS: (JobStatus | 'ALL')[] = ['ALL', 'RUNNING', 'AWAITING_APPROVAL', 'SUCCESS', 'FAILED', 'PENDING']

export default function Jobs() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'ALL'>('ALL')

  const { data: jobs, isLoading, refetch } = useQuery<JobStatusResponse[]>({
    queryKey: ['jobs', statusFilter],
    queryFn: () =>
      api
        .get('/jobs', { params: statusFilter !== 'ALL' ? { status: statusFilter } : {} })
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
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => navigate({ to: '/jobs/new' })}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
            >
              <Plus size={15} />
              New Job
            </button>
          </div>
        }
      />

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === s
                ? 'bg-[var(--color-filters-filter-active)] text-[var(--color-fonts-font-color-buttons)]'
                : 'bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-filters-filter-hover)]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
              {['Job ID', 'Type', 'Status', 'Created', 'PR', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-5 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : list.length === 0
              ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No jobs found.
                  </td>
                </tr>
              )
              : list.map((job, i) => (
                  <JobRow key={job.jobId} job={job} isEven={i % 2 === 0} />
                ))}
          </tbody>
        </table>
      </div>
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
      <td className="px-4 py-3 font-mono text-xs text-[var(--color-fonts-font-color-support)]">
        {job.jobId.slice(0, 8)}…
      </td>
      <td className="px-4 py-3 font-medium">{job.jobType}</td>
      <td className="px-4 py-3">
        <JobStatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">
        {new Date(job.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        {job.prUrl && (
          <a
            href={job.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline text-xs"
          >
            <ExternalLink size={12} />
            PR
          </a>
        )}
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {job.status === 'AWAITING_APPROVAL' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="p-1 rounded text-[var(--color-status-border-success)] hover:bg-[var(--color-status-success-background)] transition-colors"
              title="Approve"
            >
              <CheckCircle size={16} />
            </button>
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="p-1 rounded text-[var(--color-status-border-critical)] hover:bg-[var(--color-status-critical-background)] transition-colors"
              title="Reject"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export { JOB_TYPES }
