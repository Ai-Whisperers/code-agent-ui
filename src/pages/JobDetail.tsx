import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from './Dashboard'
import api from '@/lib/api'
import type { JobStatusResponse } from '@/types/api'

interface JobDetailProps {
  jobId: string
}

export default function JobDetail({ jobId }: JobDetailProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: job, isLoading } = useQuery<JobStatusResponse>({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/status/${jobId}`).then((r) => r.data),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'RUNNING' || status === 'PENDING' || status === 'QUEUED' ? 5_000 : false
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', jobId] }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/reject`, { reason: 'Rejected via UI' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', jobId] }),
  })

  return (
    <main>
      <div className="mb-4">
        <button
          onClick={() => navigate({ to: '/jobs' })}
          className="flex items-center gap-1.5 text-sm text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Jobs
        </button>
      </div>

      <PageHeader
        title={isLoading ? 'Loading…' : `Job: ${job?.jobType ?? jobId}`}
        actions={
          job?.status === 'AWAITING_APPROVAL' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-status-border-success)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <CheckCircle size={15} />
                Approve & Merge
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <XCircle size={15} />
                Reject
              </button>
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : job ? (
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Detail label="Status" value={<JobStatusBadge status={job.status} />} />
              <Detail label="Type" value={job.jobType} />
              <Detail label="Created" value={new Date(job.createdAt).toLocaleString()} />
              {job.queuePosition != null && (
                <Detail label="Queue Position" value={job.queuePosition} />
              )}
              {job.filesChanged != null && (
                <Detail label="Files Changed" value={job.filesChanged} />
              )}
              {job.linesChanged != null && (
                <Detail label="Lines Changed" value={job.linesChanged} />
              )}
            </div>
          </div>

          {/* PR link */}
          {job.prUrl && (
            <div className="bg-[var(--color-status-neutral-background)] border border-[var(--color-status-border-neutral)] rounded-[var(--border-radius-card)] p-4">
              <a
                href={job.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-fonts-font-color-brand)] hover:underline"
              >
                <ExternalLink size={15} />
                View Pull Request
              </a>
            </div>
          )}

          {/* Summary */}
          {job.summary && (
            <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5">
              <h3 className="mb-2">Summary</h3>
              <p className="text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap">
                {job.summary}
              </p>
            </div>
          )}

          {/* Error */}
          {job.errorMessage && (
            <div className="bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)] rounded-[var(--border-radius-card)] p-5">
              <h3 className="mb-2 text-[var(--color-tags-font-critical)]">Error</h3>
              <p className="text-sm text-[var(--color-tags-font-critical)] whitespace-pre-wrap font-mono">
                {job.errorMessage}
              </p>
            </div>
          )}

          {/* Auto-refresh indicator for active jobs */}
          {(job.status === 'RUNNING' || job.status === 'PENDING' || job.status === 'QUEUED') && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin" />
              Auto-refreshing every 5 seconds…
            </p>
          )}
        </div>
      ) : (
        <p className="text-[var(--color-fonts-font-color-support)]">Job not found.</p>
      )}
    </main>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">{label}</p>
      <div className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">{value}</div>
    </div>
  )
}
