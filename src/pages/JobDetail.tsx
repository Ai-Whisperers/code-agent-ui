import { useState, useCallback, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle, RefreshCw, Ban, RotateCcw, Eye,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from './Dashboard'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import { AiCallModal } from '@/components/ui/AiCallModal'
import api from '@/lib/api'
import type { JobStatusResponse, JobAiCallsResponse, AiCallRecord } from '@/types/api'

interface JobDetailProps {
  jobId: string
}

const ACTIVE_STATUSES = new Set(['RUNNING', 'PENDING', 'QUEUED'])

export default function JobDetail({ jobId }: JobDetailProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])
  const [selectedCall, setSelectedCall] = useState<AiCallRecord | null>(null)

  const { data: job, isLoading } = useQuery<JobStatusResponse>({
    queryKey: ['job', jobId],
    queryFn: () => api.get(`/status/${jobId}`).then((r) => r.data),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && ACTIVE_STATUSES.has(status) ? 5_000 : false
    },
  })

  const isActive = job?.status ? ACTIVE_STATUSES.has(job.status) : false

  const { data: aiData, isLoading: aiLoading } = useQuery<JobAiCallsResponse>({
    queryKey: ['job-ai-calls', jobId],
    queryFn: () => api.get(`/stats/ai-calls/by-job/${jobId}`).then((r) => r.data),
    refetchInterval: isActive ? 5_000 : false,
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      setToast({ variant: 'success', message: 'Job approved and merge triggered.' })
    },
    onError: () => setToast({ variant: 'error', message: 'Failed to approve job.' }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/reject`, { reason: 'Rejected via UI' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      setToast({ variant: 'info', message: 'Job rejected.' })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      setToast({ variant: 'info', message: 'Job cancelled.' })
    },
  })

  const rerunMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/rerun`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setToast({ variant: 'success', message: 'Job requeued.' })
      setTimeout(() => navigate({ to: '/jobs' }), 1200)
    },
    onError: () => setToast({ variant: 'error', message: 'Failed to rerun job.' }),
  })

  const metaStrip = job ? (
    <div className="flex items-center gap-2.5 flex-wrap text-xs text-[var(--color-fonts-font-color-support)] mt-2">
      <JobStatusBadge status={job.status} />

      {job.priority != null && (
        <>
          <Separator />
          <span className="inline-flex items-center gap-1">
            <span className="font-medium text-[var(--color-fonts-font-color-primary)]">Priority</span>
            <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-tags-neutral-background)]">
              {job.priority}
            </span>
          </span>
        </>
      )}

      {job.filesChanged != null && (
        <>
          <Separator />
          <span>{job.filesChanged} files changed</span>
        </>
      )}

      {job.linesChanged != null && (
        <>
          <Separator />
          <span>{job.linesChanged} lines changed</span>
        </>
      )}

      {job.prUrl && (
        <>
          <Separator />
          <a
            href={job.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ExternalLink size={11} />
            Pull Request
          </a>
        </>
      )}

      {job.jiraKey && (
        <>
          <Separator />
          <span className="font-mono text-[11px]">{job.jiraKey}</span>
        </>
      )}

      {isActive && (
        <>
          <Separator />
          <span className="flex items-center gap-1">
            <RefreshCw size={11} className="animate-spin" />
            Auto-refreshing
          </span>
        </>
      )}
    </div>
  ) : null

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={isLoading ? 'Loading…' : (job?.jobType ?? jobId)}
        subtitle={job ? `${jobId.slice(0, 8)}… · ${new Date(job.createdAt).toLocaleString()}` : undefined}
        statusMessage={metaStrip}
        actions={
          <div className="flex items-center gap-2">
            {job?.status === 'AWAITING_APPROVAL' && (
              <>
                <Tooltip text="Approve and merge the pull request">
                  <Button
                    variant="primary"
                    size="md"
                    icon={<CheckCircle size={14} />}
                    loading={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    Approve & Merge
                  </Button>
                </Tooltip>
                <Tooltip text="Reject and close the pull request">
                  <Button
                    variant="danger"
                    size="md"
                    icon={<XCircle size={14} />}
                    loading={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate()}
                  >
                    Reject
                  </Button>
                </Tooltip>
              </>
            )}
            {(job?.status === 'PENDING' || job?.status === 'QUEUED') && (
              <Tooltip text="Cancel this job">
                <Button
                  variant="danger"
                  size="md"
                  icon={<Ban size={14} />}
                  loading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate()}
                >
                  Cancel
                </Button>
              </Tooltip>
            )}
            {(job?.status === 'FAILED' || job?.status === 'SUCCESS') && (
              <Tooltip text="Re-queue this job">
                <Button
                  variant="ghost"
                  size="md"
                  icon={<RotateCcw size={14} />}
                  loading={rerunMutation.isPending}
                  onClick={() => rerunMutation.mutate()}
                >
                  Rerun
                </Button>
              </Tooltip>
            )}
            <Tooltip text="Back to jobs">
              <Button
                variant="ghost"
                size="md"
                icon={<ArrowLeft size={14} />}
                onClick={() => navigate({ to: '/jobs' })}
              />
            </Tooltip>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : job ? (
        <div className="space-y-3">
          {job.summary && (
            <TableCard title="Summary" maxHeight="none">
              <p className="text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap p-4">
                {job.summary}
              </p>
            </TableCard>
          )}

          {job.errorMessage && (
            <div className="bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)] rounded-[var(--border-radius-card)] p-4">
              <h3 className="mb-1.5 text-sm font-semibold text-[var(--color-tags-font-critical)]">Error</h3>
              <p className="text-xs text-[var(--color-tags-font-critical)] whitespace-pre-wrap font-mono">
                {job.errorMessage}
              </p>
            </div>
          )}

          {/* AI Calls */}
          <AiCallsCard
            aiData={aiData}
            isLoading={aiLoading}
            isActive={isActive}
            onViewCall={setSelectedCall}
          />
        </div>
      ) : (
        <p className="text-[var(--color-fonts-font-color-support)]">Job not found.</p>
      )}

      {toast && <Toast {...toast} onClose={dismissToast} />}
      {selectedCall && (
        <AiCallModal call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
    </main>
  )
}

function Separator() {
  return (
    <span className="h-3 w-px bg-[var(--color-borders-border-primary)] opacity-30 shrink-0" />
  )
}

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function truncateText(text: string | null, len: number): string {
  if (!text) return '—'
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length > len ? s.slice(0, len) + '…' : s
}

const TOOL_COLORS = [
  'text-blue-400 bg-blue-400/10',
  'text-violet-400 bg-violet-400/10',
  'text-amber-400 bg-amber-400/10',
  'text-emerald-400 bg-emerald-400/10',
  'text-rose-400 bg-rose-400/10',
  'text-cyan-400 bg-cyan-400/10',
  'text-orange-400 bg-orange-400/10',
  'text-indigo-400 bg-indigo-400/10',
]

function toolColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TOOL_COLORS[h % TOOL_COLORS.length]
}

function fmtDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const AI_CALL_HEADERS: { label: string; tip: string }[] = [
  { label: '#',        tip: 'Iteration number within this job' },
  { label: 'Model',    tip: 'AI model used for this call' },
  { label: 'In',       tip: 'Input tokens sent to the model' },
  { label: 'Out',      tip: 'Output tokens returned by the model' },
  { label: 'Cache R',  tip: 'Cache read tokens (cheaper)' },
  { label: 'Cache W',  tip: 'Cache write tokens' },
  { label: 'Tools',    tip: 'Tools invoked during this call' },
  { label: 'Duration', tip: 'Time taken for this call' },
  { label: 'Stop',     tip: 'Stop reason returned by the model' },
  { label: 'Status',   tip: 'Whether this call resulted in an error' },
  { label: '',         tip: 'View full prompt and response' },
]

interface AiCallsCardProps {
  aiData: JobAiCallsResponse | undefined
  isLoading: boolean
  isActive: boolean
  onViewCall: (call: AiCallRecord) => void
}

function AiCallsCard({ aiData, isLoading, isActive, onViewCall }: AiCallsCardProps) {
  const calls = aiData?.calls ?? []

  const statStrip = aiData ? (
    <div className="flex items-center gap-3 text-[11px] text-[var(--color-fonts-font-color-support)]">
      {isActive && <RefreshCw size={11} className="animate-spin shrink-0" />}
      <StatChip label="Calls" value={String(aiData.totalCalls)} />
      <span className="opacity-30">·</span>
      <StatChip label="In" value={fmtTokens(aiData.totalInputTokens)} />
      <span className="opacity-30">·</span>
      <StatChip label="Out" value={fmtTokens(aiData.totalOutputTokens)} />
      <span className="opacity-30">·</span>
      <StatChip label="Cache R" value={fmtTokens(aiData.totalCacheReadTokens)} />
      <span className="opacity-30">·</span>
      <StatChip label="Cache W" value={fmtTokens(aiData.totalCacheWriteTokens)} />
      <span className="opacity-30">·</span>
      <StatChip label="Cost" value={`$${aiData.estimatedCostUsd.toFixed(4)}`} />
      <span className="opacity-30">·</span>
      <StatChip label="Time" value={fmtDuration(aiData.totalDurationMs)} />
    </div>
  ) : null

  return (
    <TableCard title="AI Calls" subtitle={aiData ? `${aiData.totalCalls} calls` : undefined} toolbar={statStrip}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
            {AI_CALL_HEADERS.map(({ label, tip }) => (
              <th
                key={label || 'action'}
                className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
              >
                {tip ? <Tooltip text={tip} position="bottom">{label}</Tooltip> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                  <td colSpan={AI_CALL_HEADERS.length} className="px-3 py-1.5">
                    <div className="h-4 skeleton-shimmer rounded" />
                  </td>
                </tr>
              ))
            : calls.length === 0
            ? (
              <tr>
                <td colSpan={AI_CALL_HEADERS.length} className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]">
                  No AI calls recorded yet.
                </td>
              </tr>
            )
            : calls.map((call, i) => (
              <Fragment key={call.id}>
                <tr
                  className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] transition-colors ${
                    i % 2 === 0 ? 'bg-[var(--color-tables-table-row-a)]' : ''
                  }`}
                >
                  <td className="px-3 pt-1.5 pb-0.5 tabular-nums text-[var(--color-fonts-font-color-support)]">
                    {call.iteration}
                  </td>
                  <td className="px-3 pt-1.5 pb-0.5 font-mono text-[11px]">{call.model}</td>
                  <td className="px-3 pt-1.5 pb-0.5 tabular-nums">{fmtTokens(call.inputTokens)}</td>
                  <td className="px-3 pt-1.5 pb-0.5 tabular-nums">{fmtTokens(call.outputTokens)}</td>
                  <td className="px-3 pt-1.5 pb-0.5 tabular-nums text-[var(--color-fonts-font-color-support)]">
                    {fmtTokens(call.cacheReadInputTokens ?? call.cacheReadTokens ?? 0)}
                  </td>
                  <td className="px-3 pt-1.5 pb-0.5 tabular-nums text-[var(--color-fonts-font-color-support)]">
                    {fmtTokens(call.cacheCreationInputTokens ?? call.cacheWriteTokens ?? 0)}
                  </td>
                  <td className="px-3 pt-1.5 pb-0.5">
                    {call.toolNames
                      ? (
                        <div className="flex flex-wrap gap-0.5">
                          {call.toolNames.split(',').map(t => t.trim()).filter(Boolean).map(tool => (
                            <span key={tool} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${toolColor(tool)}`}>
                              {tool}
                            </span>
                          ))}
                        </div>
                      )
                      : <span className="text-[var(--color-fonts-font-color-support)]">—</span>
                    }
                  </td>
                  <td className="px-3 pt-1.5 pb-0.5 tabular-nums">{fmtDuration(call.durationMs)}</td>
                  <td className="px-3 pt-1.5 pb-0.5 text-[var(--color-fonts-font-color-support)]">
                    {call.stopReason ?? '—'}
                  </td>
                  <td className="px-3 pt-1.5 pb-0.5">
                    {call.isError ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]">
                        Error
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-3 pt-1.5 pb-0.5">
                    <Tooltip text="View prompt & response">
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<Eye size={13} />}
                        onClick={() => onViewCall(call)}
                      />
                    </Tooltip>
                  </td>
                </tr>
                <tr
                  className={`border-b border-[var(--color-tables-table-cell-stroke)] ${
                    i % 2 === 0 ? 'bg-[var(--color-tables-table-row-a)]' : ''
                  }`}
                >
                  <td colSpan={AI_CALL_HEADERS.length} className="px-3 pb-1.5 pt-0 overflow-hidden max-w-0 w-full">
                    {call.isError && call.errorMessage ? (
                      <div className="flex items-center gap-2 w-full pl-4">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-tags-font-critical)]">
                          Error
                        </span>
                        <span className="truncate text-[11px] font-mono text-[var(--color-tags-font-critical)] opacity-80">
                          {call.errorMessage}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full pl-4 opacity-55">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                          Output
                        </span>
                        <span className="truncate text-[11px] font-mono text-[var(--color-fonts-font-color-primary)]">
                          {call.responseText ?? '—'}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
        </tbody>
      </table>
    </TableCard>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span>{label}: </span>
      <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{value}</span>
    </span>
  )
}
