import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, RefreshCw, Ban, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from './Dashboard'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
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

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['job', jobId] }),
  })

  const rerunMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/rerun`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      navigate({ to: '/jobs' })
    },
  })

  return (
    <main>
      <PageHeader
        title={isLoading ? 'Loading…' : `Job: ${job?.jobType ?? jobId}`}
        actions={
          <div className="flex items-center gap-2">
            {job?.status === 'AWAITING_APPROVAL' && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<CheckCircle size={15} />}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate()}
                >
                  Approve & Merge
                </Button>
                <Button
                  variant="danger"
                  size="lg"
                  icon={<XCircle size={15} />}
                  loading={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                >
                  Reject
                </Button>
              </>
            )}
            {(job?.status === 'PENDING' || job?.status === 'QUEUED') && (
              <Button
                variant="danger"
                size="lg"
                icon={<Ban size={15} />}
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                Cancel
              </Button>
            )}
            {(job?.status === 'FAILED' || job?.status === 'SUCCESS') && (
              <Button
                variant="primary"
                size="lg"
                icon={<RotateCcw size={15} />}
                loading={rerunMutation.isPending}
                onClick={() => rerunMutation.mutate()}
              >
                Rerun
              </Button>
            )}
            <Button
              variant="ghost"
              size="md"
              icon={<ArrowLeft size={15} />}
              onClick={() => navigate({ to: '/jobs' })}
            >
              Back to Jobs
            </Button>
          </div>
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
          <TableCard title="Details" maxHeight="none">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
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
          </TableCard>

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
            <TableCard title="Summary" maxHeight="none">
              <p className="text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap p-5">
                {job.summary}
              </p>
            </TableCard>
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
