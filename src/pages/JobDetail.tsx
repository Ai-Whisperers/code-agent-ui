import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle, RefreshCw, Ban, RotateCcw, Play,
  ShieldCheck, AlertTriangle, Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from '@/components/ui/JobStatusBadge'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import { AiCallModal } from '@/components/ui/AiCallModal'
import { TabBar, TabButton } from '@/components/ui/Tabs'
import { CommentChatDialog, type CommentChatAction } from '@/components/CommentChatDialog'
import api from '@/lib/api'
import { mcpProfilesApi, type SystemConfig } from '@/lib/mcpProfiles'
import type {
  JobStatusResponse, JobAiCallsResponse, AiCallRecord,
  JobDiffResponse, JobReviewResponse, ReviewCommentEntry, JobEvidenceResponse,
  JobCommitsResponse, QualityReport,
} from '@/types/api'
import { RestartJobDialog } from '@/components/job-detail/RestartJobDialog'
import { AiCallsCard } from '@/components/job-detail/AiCallsCard'
import { CoverageTab } from '@/components/job-detail/CoverageTab'
import { EvidenceTab } from '@/components/job-detail/EvidenceTab'
import { CommitsTab, CommitDiffDialog } from '@/components/job-detail/CommitsTab'
import { ChangedFilesTab } from '@/components/job-detail/ChangedFilesTab'
import { ReviewTab } from '@/components/job-detail/ReviewTab'
import { FixPrConfirmDialog } from '@/components/job-detail/ReviewHelpers'

interface JobDetailProps {
  jobId: string
}

const ACTIVE_STATUSES = new Set(['RUNNING', 'PENDING', 'QUEUED'])

type Tab = 'summary' | 'ai-calls' | 'review' | 'changed-files' | 'commits' | 'evidence' | 'coverage'

export default function JobDetail({ jobId }: JobDetailProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])
  const [selectedCall, setSelectedCall] = useState<AiCallRecord | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('summary')

  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 10 * 60_000,
  })
  const jiraBaseUrl = systemConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

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

  const { data: diffData, isLoading: diffLoading, isError: diffError } = useQuery<JobDiffResponse>({
    queryKey: ['job-diff', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/diff`).then((r) => r.data),
    enabled: activeTab === 'changed-files' && !!job?.prUrl,
    retry: false,
  })

  const { data: reviewData, isLoading: reviewLoading } = useQuery<JobReviewResponse>({
    queryKey: ['job-review', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/review`).then((r) => r.data),
    enabled: (activeTab === 'review' || activeTab === 'changed-files') && !!job?.prUrl,
    refetchInterval: (q) => {
      const s = q.state.data?.reviewJobStatus
      return s === 'RUNNING' || s === 'PENDING' ? 5_000 : false
    },
    retry: false,
  })

  const { data: evidenceData } = useQuery<JobEvidenceResponse>({
    queryKey: ['job-evidence', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/evidence`).then((r) => r.data),
    enabled: activeTab === 'evidence',
    retry: false,
  })

  const { data: commitsData } = useQuery<JobCommitsResponse>({
    queryKey: ['job-commits', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/commits`).then((r) => r.data),
    enabled: activeTab === 'commits' && !!job?.prUrl,
    retry: false,
  })

  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null)

  const { data: commitDiffData, isLoading: commitDiffLoading } = useQuery<JobDiffResponse>({
    queryKey: ['commit-diff', jobId, selectedCommitSha],
    queryFn: () => api.get(`/jobs/${jobId}/commits/${selectedCommitSha}/diff`).then((r) => r.data),
    enabled: !!selectedCommitSha,
    retry: false,
  })

  // Fetch the latest quality report for this repo when the Coverage tab is open so we can
  // use it as the authoritative baseline instead of the job's own before-snapshot.
  const { data: qualityReport } = useQuery<QualityReport>({
    queryKey: ['quality-report', job?.workspace, job?.repoSlug, job?.targetBranch ?? 'main'],
    queryFn: () =>
      api
        .get(`/metrics/quality-reports/${job!.workspace}/${job!.repoSlug}/${job!.targetBranch ?? 'main'}`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: activeTab === 'coverage' && !!job?.workspace && !!job?.repoSlug,
    retry: false,
  })

  // Track running fix jobs so we can poll them and reload review when done
  const [fixPrJobId, setFixPrJobId] = useState<string | null>(null)
  const [fixCommentJobIds, setFixCommentJobIds] = useState<Record<number, string>>({})
  /** Permanent record of completed fix-comment jobs, keyed by SCM comment ID. */
  const [fixedCommentInfo, setFixedCommentInfo] = useState<Record<number, { fixJobId: string; commitSha?: string }>>({})
  const [showFixPrConfirm, setShowFixPrConfirm] = useState(false)

  const requestReviewMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/request-review`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-review', jobId] })
      setToast({ variant: 'success', message: 'Bot review requested.' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to request review.'
      setToast({ variant: 'error', message: msg })
    },
  })

  const requestFixPrMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/request-fix-pr`),
    onSuccess: (res) => {
      const newJobId: string = res.data?.fixPrJobId
      if (newJobId) setFixPrJobId(newJobId)
      setToast({ variant: 'success', message: 'Fix-PR job queued.' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to queue fix-PR job.'
      setToast({ variant: 'error', message: msg })
    },
  })

  const requestFixCommentMutation = useMutation({
    mutationFn: ({ commentId, filePath, line }: { commentId: number; filePath: string; line: number }) =>
      api.post(`/jobs/${jobId}/request-fix-comment`, { commentId, filePath, line }),
    onSuccess: (res, { commentId }) => {
      const newJobId: string = res.data?.fixCommentJobId
      if (newJobId) setFixCommentJobIds(prev => ({ ...prev, [commentId]: newJobId }))
      setToast({ variant: 'success', message: 'Fix-comment job queued.' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to queue fix-comment job.'
      setToast({ variant: 'error', message: msg })
    },
  })

  // Poll the fix-PR job status and invalidate review data once it finishes
  useQuery({
    queryKey: ['fix-pr-job', fixPrJobId],
    queryFn: () => api.get(`/status/${fixPrJobId}`).then(r => r.data),
    enabled: !!fixPrJobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      if (!s || s === 'RUNNING' || s === 'PENDING' || s === 'QUEUED') return 4_000
      qc.invalidateQueries({ queryKey: ['job-review', jobId] })
      setFixPrJobId(null)
      return false
    },
  })

  // Poll each running fix-comment job; when done, persist completed info
  const fixCommentEntries = Object.entries(fixCommentJobIds)
  useQuery({
    queryKey: ['fix-comment-jobs', fixCommentEntries.map(([, v]) => v).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        fixCommentEntries.map(([commentId, jId]) =>
          api.get(`/status/${jId}`).then(r => ({ commentId: Number(commentId), jId, status: r.data?.status as string, sourceBranch: r.data?.sourceBranch as string | undefined }))
        )
      )
      return results
    },
    enabled: fixCommentEntries.length > 0,
    refetchInterval: (q) => {
      const results = q.state.data as Array<{ commentId: number; jId: string; status: string; sourceBranch?: string }> | undefined
      if (!results) return 4_000
      const allDone = results.every(r => r.status && !['RUNNING', 'PENDING', 'QUEUED'].includes(r.status))
      if (allDone) {
        // Record completed fix info per comment before clearing the running map
        const newFixed: Record<number, { fixJobId: string; commitSha?: string }> = {}
        results.forEach(r => { newFixed[r.commentId] = { fixJobId: r.jId } })
        setFixedCommentInfo(prev => ({ ...prev, ...newFixed }))
        qc.invalidateQueries({ queryKey: ['job-review', jobId] })
        setFixCommentJobIds({})
        return false
      }
      return 4_000
    },
  })

  // Comment action mutations
  const [resolvedCommentIds, setResolvedCommentIds] = useState<Set<number>>(new Set())

  const resolveCommentMutation = useMutation({
    mutationFn: (commentId: number) => api.post(`/jobs/${jobId}/resolve-comment`, { commentId }),
    onSuccess: (_, commentId) => {
      setResolvedCommentIds(prev => { const s = new Set(prev); s.add(commentId); return s })
      qc.invalidateQueries({ queryKey: ['job-review', jobId] })
      setToast({ variant: 'success', message: 'Comment resolved.' })
    },
    onError: () => setToast({ variant: 'error', message: 'Failed to resolve comment.' }),
  })

  const falsePositiveMutation = useMutation({
    mutationFn: (commentId: number) => api.post(`/jobs/${jobId}/false-positive`, { commentId }),
    onSuccess: (_, commentId) => {
      setResolvedCommentIds(prev => { const s = new Set(prev); s.add(commentId); return s })
      qc.invalidateQueries({ queryKey: ['job-review', jobId] })
      setToast({ variant: 'success', message: 'Marked as false positive.' })
    },
    onError: () => setToast({ variant: 'error', message: 'Failed to mark as false positive.' }),
  })

  const [chatComment, setChatComment] = useState<ReviewCommentEntry | null>(null)

  const uploadScytaleMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/evidence/upload-scytale`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-evidence', jobId] })
      setToast({ variant: 'success', message: 'Evidence uploaded to Scytale.' })
    },
    onError: () => setToast({ variant: 'error', message: 'Scytale upload failed.' }),
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

  const [showRestartDialog, setShowRestartDialog] = useState(false)
  const restartMutation = useMutation({
    mutationFn: (additionalIterations: number) =>
      api.post(`/jobs/${jobId}/restart`, { additionalIterations }),
    onSuccess: (data: { jobId: string }) => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setShowRestartDialog(false)
      setToast({ variant: 'success', message: 'Job restart queued.' })
      setTimeout(() => navigate({ to: '/jobs/$id', params: { id: data.jobId } }), 800)
    },
    onError: () => {
      setShowRestartDialog(false)
      setToast({ variant: 'error', message: 'Failed to restart job.' })
    },
  })

  const hasPr = !!job?.prUrl

  // SOC II helpers
  const isBugJob = !!(job?.jiraIssueType)
  const hasCompletedReview = reviewData?.reviewJobStatus === 'SUCCESS'
  const reviewInFlight = reviewData?.reviewJobStatus === 'RUNNING' || reviewData?.reviewJobStatus === 'PENDING'
  const showSoc2Warning = job?.status === 'AWAITING_APPROVAL' && isBugJob && job?.soc2Protected
    && reviewData && !hasCompletedReview

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
          <a
            href={`${jiraBaseUrl}/browse/${job.jiraKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-[11px] hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-buttons-button-primary)' }}
          >
            <ExternalLink size={11} />
            {job.jiraKey}
          </a>
        </>
      )}

      {job.aikidoIssueId && (
        <>
          <Separator />
          <a
            href={`https://app.aikido.dev/queue?sidebarIssue=${job.aikidoIssueId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] hover:opacity-80"
          >
            <ShieldCheck size={10} />
            Aikido: {job.aikidoIssueId}
            <ExternalLink size={9} />
          </a>
        </>
      )}

      {job.slaStatus && job.slaStatus !== 'NOT_APPLICABLE' && job.slaDeadline && (
        <>
          <Separator />
          <SlaBadge priority={job.jiraPriority} deadline={job.slaDeadline} status={job.slaStatus} />
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

  const totalFiles = diffData?.files.length ?? job?.filesChanged ?? 0

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
                {showSoc2Warning ? (
                  <Tooltip text="No bot review found — merge may be blocked by SOC II guard (CC8.1). Request a review first.">
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-tags-font-attention)] px-2 py-1 rounded bg-[var(--color-tags-attention-background)]">
                      <AlertTriangle size={12} />
                      SOC II review required
                    </span>
                  </Tooltip>
                ) : null}
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
            {(job?.status === 'PENDING' || job?.status === 'QUEUED' || job?.status === 'RUNNING') && (
              job?.soc2Protected ? (
                <Tooltip text="SOC II compliance record — cancellation is not permitted.">
                  <Button variant="danger" size="md" icon={<Ban size={14} />} disabled>
                    Cancel
                  </Button>
                </Tooltip>
              ) : (
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
              )
            )}
            {(job?.status === 'FAILED' || job?.status === 'SUCCESS') && (
              <Tooltip text="Re-queue this job from scratch">
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
            {(job?.status === 'FAILED' || job?.status === 'CANCELLED') && job?.hasCheckpoint && (
              <Tooltip text="Resume from last checkpoint">
                <Button
                  variant="ghost"
                  size="md"
                  icon={<Play size={14} />}
                  onClick={() => setShowRestartDialog(true)}
                >
                  Restart
                </Button>
              </Tooltip>
            )}
            {showRestartDialog && job && (
              <RestartJobDialog
                jobId={jobId}
                checkpointIteration={job.checkpointIteration ?? 0}
                iterationCap={job.iterationCap ?? 50}
                isPending={restartMutation.isPending}
                onConfirm={(n) => restartMutation.mutate(n)}
                onCancel={() => setShowRestartDialog(false)}
              />
            )}
            <Button
              variant="ghost"
              size="md"
              icon={<ArrowLeft size={14} />}
              onClick={() => navigate({ to: '/jobs' })}
            >
              Back
            </Button>
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
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          {/* Tab bar — always visible */}
          <TabBar>
            <TabButton
              active={activeTab === 'summary'}
              onClick={() => setActiveTab('summary')}
            >
              Summary
            </TabButton>
            <TabButton
              active={activeTab === 'ai-calls'}
              onClick={() => setActiveTab('ai-calls')}
              badge={aiData && aiData.totalCalls > 0 ? String(aiData.totalCalls) : undefined}
            >
              AI Calls
            </TabButton>
            {hasPr && (
              <TabButton
                active={activeTab === 'review'}
                onClick={() => setActiveTab('review')}
              >
                Review
                {reviewInFlight && <RefreshCw size={10} className="animate-spin" />}
              </TabButton>
            )}
            {hasPr && (
              <TabButton
                active={activeTab === 'changed-files'}
                onClick={() => setActiveTab('changed-files')}
                badge={totalFiles > 0 ? String(totalFiles) : undefined}
              >
                Changed Files
              </TabButton>
            )}
            {hasPr && (
              <TabButton
                active={activeTab === 'commits'}
                onClick={() => setActiveTab('commits')}
                badge={commitsData && commitsData.commits.length > 0 ? String(commitsData.commits.length) : undefined}
              >
                Commits
              </TabButton>
            )}
            {job.coverageData && (
              <TabButton
                active={activeTab === 'coverage'}
                onClick={() => setActiveTab('coverage')}
              >
                Coverage
              </TabButton>
            )}
            <TabButton
              active={activeTab === 'evidence'}
              onClick={() => setActiveTab('evidence')}
            >
              Evidence
            </TabButton>
          </TabBar>

          {/* Summary tab */}
          {activeTab === 'summary' && (
            <div className="space-y-3">
              {job.summary && (
                <TableCard title="Summary" maxHeight="none">
                  <div className="px-4 py-4 bot-comment-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.summary.replace(/<!--[\s\S]*?-->/g, '')}</ReactMarkdown>
                  </div>
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

              {!job.summary && !job.errorMessage && (
                <p className="text-sm text-[var(--color-fonts-font-color-support)] px-1">
                  No summary available yet.
                </p>
              )}
            </div>
          )}

          {/* AI Calls tab */}
          {activeTab === 'ai-calls' && (
            <div className="overflow-y-auto flex-1 min-h-0">
              <AiCallsCard
                aiData={aiData}
                isLoading={aiLoading}
                isActive={isActive}
                onViewCall={setSelectedCall}
              />
            </div>
          )}

          {/* Review tab */}
          {hasPr && activeTab === 'review' && (
            <ReviewTab
              reviewData={reviewData}
              isLoading={reviewLoading}
              requestReviewPending={requestReviewMutation.isPending}
              onRequestReview={() => requestReviewMutation.mutate()}
              fixPrPending={requestFixPrMutation.isPending}
              fixPrJobId={fixPrJobId}
              onFixPr={() => setShowFixPrConfirm(true)}
              fixCommentJobIds={fixCommentJobIds}
              fixedCommentInfo={fixedCommentInfo}
              onFixComment={(commentId, filePath, line) =>
                requestFixCommentMutation.mutate({ commentId, filePath, line })}
              fixCommentPendingId={requestFixCommentMutation.isPending
                ? (requestFixCommentMutation.variables as { commentId: number })?.commentId
                : undefined}
              onOpenCommit={setSelectedCommitSha}
              onResolveComment={commentId => resolveCommentMutation.mutate(commentId)}
              onFalsePositive={commentId => falsePositiveMutation.mutate(commentId)}
              onChatComment={setChatComment}
              resolvedCommentIds={resolvedCommentIds}
              resolveCommentPendingId={resolveCommentMutation.isPending ? resolveCommentMutation.variables as number : undefined}
              falsePositivePendingId={falsePositiveMutation.isPending ? falsePositiveMutation.variables as number : undefined}
            />
          )}

          {/* Changed Files tab */}
          {hasPr && activeTab === 'changed-files' && (
            <ChangedFilesTab
              job={job}
              diffData={diffData}
              isLoading={diffLoading}
              isError={diffError}
              reviewComments={reviewData?.comments ?? []}
              fixPrPending={requestFixPrMutation.isPending}
              fixPrJobId={fixPrJobId}
              onFixPr={() => setShowFixPrConfirm(true)}
              fixCommentJobIds={fixCommentJobIds}
              fixedCommentInfo={fixedCommentInfo}
              onFixComment={(commentId, filePath, line) =>
                requestFixCommentMutation.mutate({ commentId, filePath, line })}
              fixCommentPendingId={requestFixCommentMutation.isPending
                ? (requestFixCommentMutation.variables as { commentId: number })?.commentId
                : undefined}
              onOpenCommit={setSelectedCommitSha}
              onResolveComment={commentId => resolveCommentMutation.mutate(commentId)}
              onFalsePositive={commentId => falsePositiveMutation.mutate(commentId)}
              onChatComment={setChatComment}
              resolvedCommentIds={resolvedCommentIds}
              resolveCommentPendingId={resolveCommentMutation.isPending ? resolveCommentMutation.variables as number : undefined}
              falsePositivePendingId={falsePositiveMutation.isPending ? falsePositiveMutation.variables as number : undefined}
            />
          )}

          {/* Commits tab */}
          {hasPr && activeTab === 'commits' && (
            <CommitsTab
              commits={commitsData?.commits ?? []}
              isLoading={!commitsData && activeTab === 'commits'}
              onCommitClick={setSelectedCommitSha}
            />
          )}

          {/* Commit diff dialog */}
          {selectedCommitSha && (
            <CommitDiffDialog
              commit={commitsData?.commits.find(c => c.sha === selectedCommitSha) ?? null}
              diffData={commitDiffData}
              isLoading={commitDiffLoading}
              onClose={() => setSelectedCommitSha(null)}
            />
          )}

          {/* Coverage tab */}
          {activeTab === 'coverage' && job.coverageData && (
            <CoverageTab
              coverageData={job.coverageData}
              qualityReportCoverage={qualityReport?.coverage}
            />
          )}

          {/* Evidence tab */}
          {activeTab === 'evidence' && (
            <EvidenceTab
              job={job}
              evidenceData={evidenceData}
              uploadScytalePending={uploadScytaleMutation.isPending}
              onUploadScytale={() => uploadScytaleMutation.mutate()}
            />
          )}
        </div>
      ) : (
        <p className="text-[var(--color-fonts-font-color-support)]">Job not found.</p>
      )}

      {toast && <Toast {...toast} onClose={dismissToast} />}
      {selectedCall && (
        <AiCallModal call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}

      {showFixPrConfirm && (
        <FixPrConfirmDialog
          openComments={(reviewData?.comments ?? []).filter(c => !c.resolved && !c.parentId)}
          isPending={requestFixPrMutation.isPending}
          onConfirm={() => {
            requestFixPrMutation.mutate()
            setShowFixPrConfirm(false)
          }}
          onCancel={() => setShowFixPrConfirm(false)}
        />
      )}

      {chatComment && (
        <CommentChatDialog
          comment={chatComment}
          jobId={jobId}
          onClose={() => setChatComment(null)}
          onAction={(type: CommentChatAction, meta?: string) => {
            if (type === 'resolved' || type === 'false_positive') {
              setResolvedCommentIds(prev => new Set([...prev, chatComment.commentId]))
            }
            if (type === 'fix_started' && meta) {
              const fixJobId = meta
              setFixCommentJobIds(prev => ({ ...prev, [chatComment.commentId]: fixJobId }))
            }
            qc.invalidateQueries({ queryKey: ['job-review', jobId] })
          }}
        />
      )}
    </main>
  )
}


// ── Local helpers (used only in this file) ────────────────────────────────────

function Separator() {
  return (
    <span className="h-3 w-px bg-[var(--color-borders-border-primary)] opacity-30 shrink-0" />
  )
}

function SlaBadge({ priority, deadline, status }: { priority?: string; deadline?: string; status?: string }) {
  if (!status || status === 'NOT_APPLICABLE' || !deadline) return null

  const deadlineDate = new Date(deadline)
  const now = new Date()
  const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000)
  const daysOverdue = -daysLeft

  const statusStyles: Record<string, string> = {
    ON_TRACK: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    AT_RISK:  'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
    OVERDUE:  'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
    MET:      'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    MISSED:   'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
  }

  const cls = statusStyles[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]'

  let label = ''
  if (status === 'MET') label = 'SLA Met ✓'
  else if (status === 'MISSED') label = 'SLA Missed'
  else if (status === 'OVERDUE') label = `Overdue by ${daysOverdue}d`
  else if (status === 'AT_RISK') label = `${daysLeft}d left · At Risk`
  else label = `${daysLeft}d left`

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls} ${status === 'AT_RISK' ? 'animate-pulse' : ''}`}>
      <Clock size={9} />
      {priority && <span>{priority}:</span>}
      {deadlineDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      · {label}
    </span>
  )
}
