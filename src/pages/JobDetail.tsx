import { useState, useCallback, useRef, Fragment, useMemo, useEffect, memo, useImperativeHandle, type MutableRefObject } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Prism from 'prismjs'
// Language registrations — load base/dependency grammars first
import 'prismjs/components/prism-markup'   // must precede php, markdown (embeds HTML)
import 'prismjs/components/prism-css'      // must precede markup-templating dependents
import 'prismjs/components/prism-c'        // must precede cpp
import 'prismjs/components/prism-javascript' // must precede typescript, jsx, php
import 'prismjs/components/prism-markup-templating' // must precede php
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-scala'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'

function languageFromFilename(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'jsx', js: 'javascript', jsx: 'jsx',
    java: 'java', cs: 'csharp', py: 'python', php: 'php',
    go: 'go', rs: 'rust', kt: 'kotlin', swift: 'swift',
    rb: 'ruby', scala: 'scala', sc: 'scala',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', css: 'css', scss: 'css', less: 'css',
    xml: 'markup', html: 'markup', htm: 'markup', svg: 'markup',
  }
  return ext ? map[ext] : undefined
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle, RefreshCw, Ban, RotateCcw, Eye,
  GitBranch, ArrowRight, ChevronDown, ChevronRight, ChevronUp, ChevronLeft,
  FolderOpen, Folder, TrendingUp, TrendingDown, Minus,
  ShieldCheck, AlertTriangle, Bot, Clock, MessageSquare, Printer, Wrench, CheckCheck,
  FileCode, Flag, Send, GitCompare,
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
import type {
  JobStatusResponse, JobAiCallsResponse, AiCallRecord,
  JobDiffResponse, DiffFileEntry, JobCoverageData, PackageLineCoverage,
  JobReviewResponse, ReviewCommentEntry, JobEvidenceResponse,
  PrCommitEntry, JobCommitsResponse,
} from '@/types/api'

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

  const replyCommentMutation = useMutation({
    mutationFn: ({ commentId, message }: { commentId: number; message: string }) =>
      api.post(`/jobs/${jobId}/reply-comment`, { commentId, message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-review', jobId] })
      setToast({ variant: 'success', message: 'Reply posted.' })
    },
    onError: () => setToast({ variant: 'error', message: 'Failed to post reply.' }),
  })

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
          <span className="font-mono text-[11px]">{job.jiraKey}</span>
        </>
      )}

      {job.aikidoIssueId && (
        <>
          <Separator />
          <a
            href={`https://app.aikido.dev/issues/${job.aikidoIssueId}`}
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
            {(job?.status === 'PENDING' || job?.status === 'QUEUED') && (
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
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          {/* Tab bar — always visible */}
          <div className="flex items-center gap-1 border-b border-[var(--color-borders-border-primary)]">
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
          </div>

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
            <AiCallsCard
              aiData={aiData}
              isLoading={aiLoading}
              isActive={isActive}
              onViewCall={setSelectedCall}
            />
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
              onReplyComment={(commentId, message) => replyCommentMutation.mutate({ commentId, message })}
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
              onReplyComment={(commentId, message) => replyCommentMutation.mutate({ commentId, message })}
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
            <CoverageTab coverageData={job.coverageData} />
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
          openComments={(reviewData?.comments ?? []).filter(c => !c.resolved)}
          isPending={requestFixPrMutation.isPending}
          onConfirm={() => {
            requestFixPrMutation.mutate()
            setShowFixPrConfirm(false)
          }}
          onCancel={() => setShowFixPrConfirm(false)}
        />
      )}
    </main>
  )
}

// ── Tab primitives ────────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean
  onClick: () => void
  badge?: string
  children: React.ReactNode
}

function TabButton({ active, onClick, badge, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors
        border-b-2 -mb-px
        ${active
          ? 'border-[var(--color-fonts-font-color-brand)] text-[var(--color-fonts-font-color-primary)]'
          : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-borders-border-primary)]'
        }
      `}
    >
      {children}
      {badge && (
        <span className="inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[10px] font-semibold bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]">
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Changed Files tab ─────────────────────────────────────────────────────────

interface FixedCommentInfo { fixJobId: string; commitSha?: string }

interface ChangedFilesTabProps {
  job: JobStatusResponse
  diffData: JobDiffResponse | undefined
  isLoading: boolean
  isError: boolean
  reviewComments?: ReviewCommentEntry[]
  fixPrPending?: boolean
  fixPrJobId?: string | null
  onFixPr?: () => void
  fixCommentJobIds?: Record<number, string>
  fixedCommentInfo?: Record<number, FixedCommentInfo>
  onFixComment?: (commentId: number, filePath: string, line: number) => void
  fixCommentPendingId?: number
  onOpenCommit?: (sha: string) => void
  onResolveComment?: (commentId: number) => void
  onFalsePositive?: (commentId: number) => void
  onReplyComment?: (commentId: number, message: string) => void
  resolvedCommentIds?: Set<number>
  resolveCommentPendingId?: number
  falsePositivePendingId?: number
}

function ChangedFilesTab({
  job, diffData, isLoading, isError, reviewComments = [],
  fixPrPending, fixPrJobId, onFixPr,
  fixCommentJobIds = {}, fixedCommentInfo = {}, onFixComment, fixCommentPendingId, onOpenCommit,
  onResolveComment, onFalsePositive, onReplyComment, resolvedCommentIds = new Set(),
  resolveCommentPendingId, falsePositivePendingId,
}: ChangedFilesTabProps) {
  // Build a file-keyed map of review comments for inline display
  const commentsByFile = useMemo(() => {
    const map: Record<string, ReviewCommentEntry[]> = {}
    reviewComments.forEach(c => { (map[c.filePath] ??= []).push(c) })
    return map
  }, [reviewComments])

  // Flat ordered list for prev/next nav, sorted by file order in diff then line number
  const allComments = useMemo(() => {
    if (!diffData) return reviewComments.filter(c => c.commentId > 0)
    const fileOrder: Record<string, number> = {}
    diffData.files.forEach((f, i) => { fileOrder[f.filename] = i })
    return [...reviewComments]
      .filter(c => c.commentId > 0)
      .sort((a, b) => {
        const fa = fileOrder[a.filePath] ?? 999
        const fb = fileOrder[b.filePath] ?? 999
        return fa !== fb ? fa - fb : a.line - b.line
      })
  }, [reviewComments, diffData])

  const [activeCommentIdx, setActiveCommentIdx] = useState(0)
  const commentRefs = useRef<Record<number, HTMLTableRowElement | null>>({})

  const scrollToComment = useCallback((idx: number) => {
    const comment = allComments[idx]
    if (!comment) return
    const el = commentRefs.current[comment.commentId]
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [allComments])

  const goToPrev = useCallback(() => {
    const next = Math.max(0, activeCommentIdx - 1)
    setActiveCommentIdx(next)
    scrollToComment(next)
  }, [activeCommentIdx, scrollToComment])

  const goToNext = useCallback(() => {
    const next = Math.min(allComments.length - 1, activeCommentIdx + 1)
    setActiveCommentIdx(next)
    scrollToComment(next)
  }, [activeCommentIdx, allComments.length, scrollToComment])
  const sourceBranch = diffData?.sourceBranch || job.sourceBranch || ''
  const targetBranch = diffData?.targetBranch || job.targetBranch || ''
  const fileRefs = useRef<Record<string, FileDiffSectionHandle | null>>({})
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set())

  // Expand/collapse-all: seq increments on each action, target is the desired collapsed state
  const [expandCollapseSeq, setExpandCollapseSeq] = useState(0)
  const [expandCollapseTarget, setExpandCollapseTarget] = useState(false)

  // Files start collapsed when the PR has more than 5 files to prevent DOM explosion
  const initialCollapsed = (diffData?.files.length ?? 0) > 5

  const toggleViewed = useCallback((filename: string) =>
    setViewedFiles((prev) => {
      const next = new Set(prev)
      next.has(filename) ? next.delete(filename) : next.add(filename)
      return next
    }), [])

  const scrollTo = useCallback((filename: string) => {
    const handle = fileRefs.current[filename]
    if (!handle) return
    // Always expand the file block first so its contents are visible
    handle.expand()
    // After the DOM has had a frame to re-render (expansion is synchronous state update),
    // scroll to the first comment for this file, or to the file header itself.
    requestAnimationFrame(() => {
      const fileCommentList = commentsByFile[filename] ?? []
      if (fileCommentList.length > 0) {
        // Find the comment with the lowest line number that has a ref registered
        const sorted = [...fileCommentList].sort((a, b) => a.line - b.line)
        for (const c of sorted) {
          const el = commentRefs.current[c.commentId]
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
          }
        }
      }
      // Fallback: scroll to the file header
      handle.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [commentsByFile, commentRefs])

  const expandAll = useCallback(() => {
    setExpandCollapseTarget(false)
    setExpandCollapseSeq(s => s + 1)
  }, [])

  const collapseAll = useCallback(() => {
    setExpandCollapseTarget(true)
    setExpandCollapseSeq(s => s + 1)
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Branch context bar */}
      {(sourceBranch || targetBranch) && (
        <div className="flex items-center gap-2 px-3 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-xs shrink-0 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
          <GitCompare size={14} className="shrink-0 text-[var(--color-fonts-font-color-brand)]" />
          <span className="font-mono font-semibold text-[var(--color-fonts-font-color-primary)]">{sourceBranch || '—'}</span>
          <ArrowRight size={12} className="shrink-0 text-[var(--color-fonts-font-color-support)]" />
          <span className="font-mono font-semibold text-[var(--color-fonts-font-color-primary)]">{targetBranch || '—'}</span>
          {diffData && (
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-[var(--color-fonts-font-color-support)]">
                {diffData.files.length} file{diffData.files.length !== 1 ? 's' : ''}
              </span>
              <span className="text-emerald-400 font-semibold">+{diffData.totalAdditions}</span>
              <span className="text-rose-400 font-semibold">−{diffData.totalDeletions}</span>
            </span>
          )}
          <span className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={expandAll}
              className="px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
              title="Expand all files"
            >
              <ChevronDown size={11} className="inline mr-0.5" />Expand all
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
              title="Collapse all files"
            >
              <ChevronRight size={11} className="inline mr-0.5" />Collapse all
            </button>
            {onFixPr && reviewComments.length > 0 && (
              <FixPrButton
                pending={fixPrPending}
                runningJobId={fixPrJobId}
                onClick={onFixPr}
              />
            )}
          </span>
        </div>
      )}

      {/* Prev / Next comment navigator bar */}
      {allComments.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--border-radius-card)] border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-xs shrink-0 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
          <MessageSquare size={12} className="shrink-0 text-amber-400" />
          <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
            Comment {activeCommentIdx + 1} / {allComments.length}
          </span>
          <span className="text-[var(--color-fonts-font-color-support)] truncate max-w-[40ch] hidden sm:block">
            {allComments[activeCommentIdx]?.content.replace(/[#*`_>-]/g, '').trim().slice(0, 60)}
          </span>
          <span className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={goToPrev}
              disabled={activeCommentIdx === 0}
              className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] disabled:opacity-30 transition-colors"
              title="Previous comment"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={goToNext}
              disabled={activeCommentIdx === allComments.length - 1}
              className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] disabled:opacity-30 transition-colors"
              title="Next comment"
            >
              <ChevronRight size={13} />
            </button>
          </span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-status-border-critical)] bg-[var(--color-status-critical-background)] text-xs text-[var(--color-tags-font-critical)]">
          Could not load diff from the SCM. The platform may not support on-demand diff retrieval.
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && !isError && (
        <div className="flex gap-0 flex-1 min-h-0 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] overflow-hidden">
          <div className="w-60 shrink-0 border-r border-[var(--color-cards-card-stroke)] space-y-1 p-2">
            {[80, 140, 120, 100, 90].map((w, i) => (
              <div key={i} className="h-5 skeleton-shimmer rounded" style={{ width: w }} />
            ))}
          </div>
          <div className="flex-1 space-y-0">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="h-9 skeleton-shimmer border-b border-[var(--color-cards-card-stroke)]" />
                <div className="h-40 skeleton-shimmer opacity-50" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-panel layout */}
      {!isLoading && diffData && diffData.files.length > 0 && (
        <div className="flex flex-1 min-h-0 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
          {/* Left: file tree */}
          <FileTreePanel
            files={diffData.files}
            totalAdditions={diffData.totalAdditions}
            totalDeletions={diffData.totalDeletions}
            viewedFiles={viewedFiles}
            onFileClick={scrollTo}
            commentsByFile={commentsByFile}
          />
          {/* Right: diff content */}
          <div className="flex-1 overflow-auto bg-[var(--color-cards-card-background)]">
            {diffData.files.map((file) => (
              <FileDiffSection
                key={file.filename}
                file={file}
                viewed={viewedFiles.has(file.filename)}
                onToggleViewed={() => toggleViewed(file.filename)}
                fileComments={commentsByFile[file.filename] ?? []}
                ref={(el: FileDiffSectionHandle | null) => { fileRefs.current[file.filename] = el }}
                onFixComment={onFixComment}
                fixCommentJobIds={fixCommentJobIds}
                fixedCommentInfo={fixedCommentInfo}
                fixCommentPendingId={fixCommentPendingId}
                onOpenCommit={onOpenCommit}
                initialCollapsed={initialCollapsed}
                expandCollapseSeq={expandCollapseSeq}
                expandCollapseTarget={expandCollapseTarget}
                commentRefs={commentRefs}
                onResolveComment={onResolveComment}
                onFalsePositive={onFalsePositive}
                onReplyComment={onReplyComment}
                resolvedCommentIds={resolvedCommentIds}
                resolveCommentPendingId={resolveCommentPendingId}
                falsePositivePendingId={falsePositivePendingId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && diffData && diffData.files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--color-fonts-font-color-support)] text-sm">
          No changed files found in the diff.
        </div>
      )}
    </div>
  )
}

// ── File tree sidebar ─────────────────────────────────────────────────────────

interface FileTreePanelProps {
  files: DiffFileEntry[]
  totalAdditions: number
  totalDeletions: number
  viewedFiles: Set<string>
  onFileClick: (filename: string) => void
  commentsByFile?: Record<string, ReviewCommentEntry[]>
}

function buildTree(files: DiffFileEntry[]): Map<string, DiffFileEntry[]> {
  const map = new Map<string, DiffFileEntry[]>()
  for (const file of files) {
    const parts = file.filename.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : ''
    const list = map.get(dir) ?? []
    list.push(file)
    map.set(dir, list)
  }
  return map
}

function FileTreePanel({ files, totalAdditions, totalDeletions, viewedFiles, onFileClick, commentsByFile = {} }: FileTreePanelProps) {
  const tree = useMemo(() => buildTree(files), [files])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleDir = (dir: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(dir) ? next.delete(dir) : next.add(dir)
      return next
    })

  return (
    <div className="w-64 shrink-0 border-r border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] flex flex-col min-h-0">
      {/* Tree header */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--color-tables-table-header-stroke)] flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)]">
          Lines updated
        </span>
        <span className="ml-auto text-[11px] font-semibold">
          <span className="text-emerald-400">+{totalAdditions}</span>
          {totalDeletions > 0 && <span className="text-rose-400 ml-1">−{totalDeletions}</span>}
        </span>
      </div>
      {/* Tree body */}
      <div className="flex-1 overflow-y-auto py-1">
        {Array.from(tree.entries()).map(([dir, dirFiles]) => (
          <div key={dir}>
            {/* Directory row */}
            {dir && (
              <button
                onClick={() => toggleDir(dir)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-[var(--color-tables-table-hover)] transition-colors"
              >
                <span className="text-[var(--color-fonts-font-color-support)] shrink-0">
                  {collapsed.has(dir)
                    ? <Folder size={13} />
                    : <FolderOpen size={13} />
                  }
                </span>
                <span className="text-[11px] text-[var(--color-fonts-font-color-primary)] truncate">
                  {dir.split('/').pop()}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-[var(--color-fonts-font-color-support)]">
                  {dirFiles.length}
                </span>
              </button>
            )}
            {/* Files in directory */}
            {!collapsed.has(dir) && dirFiles.map((file) => {
              const filename = file.filename.split('/').pop() ?? file.filename
              const isViewed = viewedFiles.has(file.filename)
              const statusColor =
                file.status === 'added'   ? 'text-emerald-400' :
                file.status === 'removed' ? 'text-rose-400'    :
                'text-amber-400'
              const statusPrefix =
                file.status === 'added'   ? '+' :
                file.status === 'removed' ? '−' :
                '~'
              const commentCount = commentsByFile[file.filename]?.length ?? 0
              return (
                <button
                  key={file.filename}
                  onClick={() => onFileClick(file.filename)}
                  className={`w-full flex items-center gap-1.5 py-1 text-left hover:bg-[var(--color-tables-table-hover)] transition-colors ${dir ? 'pl-7 pr-2' : 'px-2'} ${isViewed ? 'opacity-50' : ''}`}
                >
                  <span className={`shrink-0 text-[11px] font-bold ${statusColor}`}>{statusPrefix}</span>
                  <span className="flex-1 min-w-0 text-[11px] font-mono text-[var(--color-fonts-font-color-primary)] truncate">
                    {filename}
                  </span>
                  {commentCount > 0 && (
                    <span className="shrink-0 ml-1 text-[9px] font-bold text-amber-400">
                      ● {commentCount}
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-400 ml-1">
                    +{file.additions}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── File diff section ─────────────────────────────────────────────────────────

import { forwardRef } from 'react'

/** Imperative handle exposed by each FileDiffSection so the file tree can expand + scroll to it. */
export interface FileDiffSectionHandle {
  /** Ensure the file block is expanded (unhides the diff hunks). */
  expand: () => void
  /** Proxy for the underlying DOM element's scrollIntoView. */
  scrollIntoView: (options?: ScrollIntoViewOptions) => void
}

interface FileDiffSectionProps {
  file: DiffFileEntry
  viewed: boolean
  onToggleViewed: () => void
  fileComments?: ReviewCommentEntry[]
  onFixComment?: (commentId: number, filePath: string, line: number) => void
  fixCommentJobIds?: Record<number, string>
  fixedCommentInfo?: Record<number, FixedCommentInfo>
  fixCommentPendingId?: number
  onOpenCommit?: (sha: string) => void
  initialCollapsed?: boolean
  expandCollapseSeq?: number
  expandCollapseTarget?: boolean
  commentRefs?: MutableRefObject<Record<number, HTMLTableRowElement | null>>
  onResolveComment?: (commentId: number) => void
  onFalsePositive?: (commentId: number) => void
  onReplyComment?: (commentId: number, message: string) => void
  resolvedCommentIds?: Set<number>
  resolveCommentPendingId?: number
  falsePositivePendingId?: number
}

const FileDiffSection = forwardRef<FileDiffSectionHandle, FileDiffSectionProps>(
  function FileDiffSection({
    file, viewed, onToggleViewed, fileComments = [],
    onFixComment, fixCommentJobIds = {}, fixedCommentInfo = {}, fixCommentPendingId, onOpenCommit,
    initialCollapsed = false, expandCollapseSeq = 0, expandCollapseTarget,
    commentRefs, onResolveComment, onFalsePositive, onReplyComment,
    resolvedCommentIds = new Set(), resolveCommentPendingId, falsePositivePendingId,
  }, ref) {
    // Build a line-number → comments map for O(1) lookup
    const commentsByLine = useMemo(() => {
      const map: Record<number, ReviewCommentEntry[]> = {}
      fileComments.forEach(c => { if (c.line > 0) (map[c.line] ??= []).push(c) })
      return map
    }, [fileComments])

    // Collect rendered line numbers to detect orphan comments
    const renderedLines = useMemo(() => {
      const lines = new Set<number>()
      file.hunks.forEach(h => h.lines.forEach(l => {
        if (l.newLine > 0) lines.add(l.newLine)
        if (l.oldLine > 0) lines.add(l.oldLine)
      }))
      return lines
    }, [file.hunks])

    const orphanComments = useMemo(
      () => fileComments.filter(c => c.line === 0 || !renderedLines.has(c.line)),
      [fileComments, renderedLines]
    )

    const [collapsed, setCollapsed] = useState(initialCollapsed)
    const divRef = useRef<HTMLDivElement>(null)

    // Expose expand() and scrollIntoView() imperatively to the file-tree sidebar
    useImperativeHandle(ref, () => ({
      expand: () => setCollapsed(false),
      scrollIntoView: (options) => divRef.current?.scrollIntoView(options),
    }))

    // Respond to expand-all / collapse-all signals from the parent
    useEffect(() => {
      if (expandCollapseSeq === 0) return
      setCollapsed(expandCollapseTarget ?? false)
    }, [expandCollapseSeq, expandCollapseTarget])
    const parts = file.filename.split('/')
    const filename = parts.pop() ?? file.filename
    const dirParts = parts

    const breadcrumb = dirParts.length > 4
      ? [...dirParts.slice(0, 1), '…', ...dirParts.slice(-1), filename]
      : [...dirParts, filename]

    const language = languageFromFilename(file.filename)

    const statusAccentBg =
      file.status === 'added'   ? 'bg-emerald-500' :
      file.status === 'removed' ? 'bg-rose-500'    :
      'bg-amber-500'
    const statusIconColor =
      file.status === 'added'   ? 'text-emerald-400' :
      file.status === 'removed' ? 'text-rose-400'    :
      'text-amber-400'

    return (
      <div ref={divRef} className="border-b border-[var(--color-cards-card-stroke)] last:border-b-0">
        {/* File header */}
        <div
          className="flex items-stretch sticky top-0 z-10 bg-[var(--color-cards-card-background)] border-b border-[var(--color-tables-table-header-stroke)] cursor-pointer"
          onClick={() => setCollapsed((v) => !v)}
        >
          {/* Left accent bar */}
          <div className={`w-[3px] shrink-0 ${statusAccentBg}`} />

          {/* Icon + breadcrumb + badges */}
          <div className="flex items-center gap-2 flex-1 px-3 py-2 min-w-0">
            <FileCode size={13} className={`shrink-0 ${statusIconColor}`} />

            {/* Breadcrumb path */}
            <div className="flex items-center gap-0.5 flex-1 min-w-0 text-xs font-mono overflow-hidden">
              {breadcrumb.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span className="shrink-0 text-[var(--color-fonts-font-color-support)] px-0.5">/</span>
                  )}
                  <span className={`truncate ${i === breadcrumb.length - 1 ? 'font-semibold text-[var(--color-fonts-font-color-primary)]' : 'text-[var(--color-fonts-font-color-support)]'}`}>
                    {part}
                  </span>
                </Fragment>
              ))}
            </div>

            {/* Comment count badge */}
            {fileComments.length > 0 && (
              <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <MessageSquare size={8} />
                {fileComments.length}
              </span>
            )}

            {/* Stats + Viewed + Collapse */}
            <span className="ml-auto flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
              <span className="text-[11px] font-semibold flex items-center gap-1">
                <span className="text-emerald-400">+{file.additions}</span>
                {file.deletions > 0 && <span className="text-rose-400">−{file.deletions}</span>}
              </span>

              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={viewed}
                  onChange={onToggleViewed}
                  className="rounded border-[var(--color-borders-border-primary)] accent-[var(--color-fonts-font-color-brand)]"
                />
                <span className="text-[11px] text-[var(--color-fonts-font-color-support)]">Viewed</span>
              </label>

              <button
                onClick={e => { e.stopPropagation(); setCollapsed(v => !v) }}
                className="shrink-0 p-0.5 text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
              >
                {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              </button>
            </span>
          </div>
        </div>

        {/* Diff hunks */}
        {!collapsed && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <colgroup>
                <col className="w-12" />
                <col className="w-12" />
                <col className="w-6" />
                <col />
              </colgroup>
              <tbody>
                {file.hunks.map((hunk, hi) => (
                  <Fragment key={hi}>
                    <HunkHeaderRow header={hunk.header} />
                    {hunk.lines.map((line, li) => {
                      const lineNum = line.newLine > 0 ? line.newLine : line.oldLine
                      const lineComments = commentsByLine[lineNum] ?? []
                      return (
                        <Fragment key={li}>
                          <DiffLineRow
                            type={line.type}
                            oldLine={line.oldLine}
                            newLine={line.newLine}
                            content={line.content}
                            language={language}
                            hasComment={lineComments.length > 0}
                          />
                          {lineComments.map((c, ci) => (
                            <InlineCommentRow
                              key={ci}
                              comment={c}
                              lineType={line.type}
                              onFix={onFixComment && c.commentId > 0 && !fixedCommentInfo[c.commentId]
                                ? () => onFixComment(c.commentId, c.filePath, c.line)
                                : undefined}
                              isFixRunning={!!fixCommentJobIds[c.commentId]}
                              isFixPending={fixCommentPendingId === c.commentId}
                              fixedInfo={fixedCommentInfo[c.commentId]}
                              onOpenCommit={onOpenCommit}
                              commentRef={commentRefs ? el => { commentRefs.current[c.commentId] = el } : undefined}
                              onResolve={onResolveComment && c.commentId > 0 && !resolvedCommentIds.has(c.commentId)
                                ? () => onResolveComment(c.commentId) : undefined}
                              onFalsePositive={onFalsePositive && c.commentId > 0 && !resolvedCommentIds.has(c.commentId)
                                ? () => onFalsePositive(c.commentId) : undefined}
                              onReply={onReplyComment && c.commentId > 0
                                ? (msg) => onReplyComment(c.commentId, msg) : undefined}
                              isResolvePending={resolveCommentPendingId === c.commentId}
                              isFalsePositivePending={falsePositivePendingId === c.commentId}
                              optimisticallyResolved={resolvedCommentIds.has(c.commentId)}
                            />
                          ))}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {orphanComments.length > 0 && (
              <div className="border-t border-[var(--color-cards-card-stroke)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-fonts-font-color-support)] mb-1">
                  Other comments
                </p>
                {orphanComments.map((c, i) => (
                  <div key={i} className="mb-1 border-l-2 border-[var(--color-tags-attention-background)] pl-3 py-1 rounded-r bg-[var(--color-tags-attention-background)]/10">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Bot size={10} className="text-[var(--color-tags-font-attention)]" />
                      <span className="text-[10px] text-[var(--color-tags-font-attention)]">Bot Review</span>
                      {c.line > 0 && <span className="ml-1 px-1 rounded text-[9px] bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]">line {c.line}</span>}
                      {onFixComment && c.commentId > 0 && (
                        <span className="ml-auto">
                          <FixCommentButton
                            isRunning={!!fixCommentJobIds[c.commentId]}
                            isPending={fixCommentPendingId === c.commentId}
                            onClick={() => onFixComment(c.commentId, c.filePath, c.line)}
                          />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

const HunkHeaderRow = memo(function HunkHeaderRow({ header }: { header: string }) {
  return (
    <tr className="bg-sky-500/10 border-y border-sky-500/20">
      <td
        colSpan={4}
        className="px-3 py-1 text-[11px] font-mono text-sky-400 whitespace-pre select-none"
      >
        {header}
      </td>
    </tr>
  )
})

const DiffLineRow = memo(function DiffLineRow({ type, oldLine, newLine, content, language, hasComment }: {
  type: 'add' | 'del' | 'ctx'
  oldLine: number
  newLine: number
  content: string
  language?: string
  hasComment?: boolean
}) {
  // Use bright-base colours at low opacity so the tint is visible in both light and dark themes.
  const rowBg =
    hasComment    ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.13]' :
    type === 'add' ? 'bg-emerald-500/[0.13]' :
    type === 'del' ? 'bg-rose-500/[0.13]'    :
    'hover:bg-[var(--color-tables-table-hover)]'

  const gutterBg =
    hasComment    ? 'bg-amber-500/[0.25]' :
    type === 'add' ? 'bg-emerald-500/[0.22]' :
    type === 'del' ? 'bg-rose-500/[0.22]'    :
    'bg-[var(--color-tables-table-row-a)]'

  const prefixColor =
    type === 'add' ? 'text-emerald-400' :
    type === 'del' ? 'text-rose-400'    :
    'text-[var(--color-fonts-font-color-support)] opacity-30'

  const prefix = type === 'add' ? '+' : type === 'del' ? '−' : ' '

  const highlightedHtml = useMemo(() => {
    if (!language || !content.trim()) return null
    const grammar = Prism.languages[language]
    if (!grammar) return null
    try {
      return Prism.highlight(content, grammar, language)
    } catch {
      return null
    }
  }, [content, language])

  return (
    <tr className={`${rowBg} transition-colors`}>
      {/* Old line number */}
      <td className={`${gutterBg} px-2 py-px text-right select-none leading-5 text-[10px] tabular-nums text-[var(--color-fonts-font-color-support)] border-r border-[var(--color-borders-border-primary)]`}>
        {type !== 'add' && oldLine > 0 ? oldLine : ''}
      </td>
      {/* New line number */}
      <td className={`${gutterBg} px-2 py-px text-right select-none leading-5 text-[10px] tabular-nums text-[var(--color-fonts-font-color-support)] border-r border-[var(--color-borders-border-primary)]`}>
        {type !== 'del' && newLine > 0 ? newLine : ''}
      </td>
      {/* +/− prefix (or amber comment dot) */}
      <td className={`${gutterBg} w-5 px-1 py-px text-center select-none leading-5 font-bold border-r border-[var(--color-borders-border-primary)] ${hasComment ? 'text-amber-400' : prefixColor}`}>
        {hasComment ? '●' : prefix !== ' ' ? prefix : ''}
      </td>
      {/* Code content — syntax highlighted when language is known */}
      <td className="px-3 py-px leading-5 whitespace-pre text-[13px]">
        {highlightedHtml
          ? <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          : <span className="text-[var(--color-fonts-font-color-primary)]">{content}</span>
        }
      </td>
    </tr>
  )
})

/**
 * Div-based version of the same floating comment card — used in ReviewTab
 * where there is no table context.
 */
function ReviewCommentCard({
  comment, onFix, isFixRunning, isFixPending, fixedInfo, onOpenCommit,
  onResolve, onFalsePositive, onReply, isResolvePending, isFalsePositivePending, optimisticallyResolved,
}: {
  comment: ReviewCommentEntry
  onFix?: () => void
  isFixRunning?: boolean
  isFixPending?: boolean
  fixedInfo?: FixedCommentInfo
  onOpenCommit?: (sha: string) => void
  onResolve?: () => void
  onFalsePositive?: () => void
  onReply?: (message: string) => void
  isResolvePending?: boolean
  isFalsePositivePending?: boolean
  optimisticallyResolved?: boolean
}) {
  const isResolved = optimisticallyResolved || !!comment.resolved
  const [expanded, setExpanded] = useState(!isResolved)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const accentColor = isResolved ? 'var(--color-status-text-active)' : 'var(--color-tags-font-attention)'
  const isFixable = comment.line > 0 && comment.commentId > 0

  if (!expanded) {
    return (
      <div className="px-4 py-2">
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--color-borders-border-primary)]/20 bg-[var(--color-cards-card-background)] text-left group hover:bg-[var(--color-cards-card-background-hover)] transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.07)]"
          style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
        >
          <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isResolved ? 'bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]' : 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'}`}>
            {isResolved ? <CheckCheck size={10} /> : <Bot size={10} />}
          </span>
          <span className="text-[11px] font-semibold text-[var(--color-fonts-font-color-primary)]">Review Agent</span>
          {isResolved ? (
            <>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]">
                <CheckCheck size={8} /> Resolved
              </span>
              {comment.resolvedBy && <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">by <span className="font-medium">{comment.resolvedBy}</span></span>}
            </>
          ) : (
            <span className="text-[10px] text-[var(--color-fonts-font-color-support)] truncate max-w-[60ch]">
              {comment.content.replace(/[#*`_>-]/g, '').trim().slice(0, 90)}{comment.content.length > 90 ? '…' : ''}
            </span>
          )}
          <ChevronDown size={12} className="ml-auto shrink-0 text-[var(--color-fonts-font-color-support)] group-hover:text-[var(--color-fonts-font-color-primary)] transition-colors" />
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <div
        className="rounded-lg border border-[var(--color-borders-border-primary)]/20 bg-[var(--color-cards-card-background)] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
        style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-borders-border-primary)]/20">
          <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isResolved ? 'bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]' : 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'}`}>
            {isResolved ? <CheckCheck size={12} /> : <Bot size={12} />}
          </span>
          <span className="text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">Review Agent</span>
          {comment.line > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)] font-mono">line {comment.line}</span>
          )}
          {isResolved && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]">
              <CheckCheck size={9} /> Resolved
            </span>
          )}
          <button onClick={() => setExpanded(false)} className="ml-auto shrink-0 p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors" title="Collapse">
            <ChevronUp size={14} />
          </button>
        </div>
        <div className={`px-4 py-3 bot-comment-body${isResolved ? ' is-resolved' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
        </div>
        <div className="flex flex-col border-t border-[var(--color-borders-border-primary)]/20 bg-[var(--color-cards-card-background-hover)]">
          <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap min-h-[32px]">
            {isResolved ? (
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                Resolved{comment.resolvedBy ? <> by <span className="font-medium">{comment.resolvedBy}</span></> : null}
                {comment.resolvedAt ? <> · {new Date(comment.resolvedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</> : null}
              </span>
            ) : (
              <>
                {onResolve && (
                  <button onClick={onResolve} disabled={isResolvePending} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-status-text-active)] hover:bg-[var(--color-status-success-background)] transition-colors disabled:opacity-50">
                    <CheckCheck size={10} /> Resolve
                  </button>
                )}
                {onFalsePositive && (
                  <button onClick={onFalsePositive} disabled={isFalsePositivePending} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-tags-neutral-background)] transition-colors disabled:opacity-50">
                    <Flag size={10} /> False Positive
                  </button>
                )}
                {fixedInfo ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]"><CheckCheck size={9} /> Fixed</span>
                    <a href={`/jobs/${fixedInfo.fixJobId}`} onClick={e => { e.preventDefault(); window.location.href = `/jobs/${fixedInfo.fixJobId}` }} className="text-[10px] font-mono text-[var(--color-fonts-font-color-brand)] hover:underline">{fixedInfo.fixJobId.slice(0, 8)}</a>
                    {fixedInfo.commitSha && (<><span className="text-[10px] text-[var(--color-fonts-font-color-support)]">·</span><button onClick={() => onOpenCommit?.(fixedInfo.commitSha!)} className="text-[10px] font-mono text-[var(--color-fonts-font-color-brand)] hover:underline">{fixedInfo.commitSha.slice(0, 8)}</button></>)}
                  </div>
                ) : isFixable && onFix ? (
                  <FixCommentButton isRunning={!!isFixRunning} isPending={!!isFixPending} onClick={onFix} />
                ) : null}
                {onReply && (
                  <button onClick={() => setReplyOpen(v => !v)} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-tables-table-hover)] transition-colors ml-auto">
                    <MessageSquare size={10} /> Reply
                  </button>
                )}
              </>
            )}
          </div>
          {replyOpen && onReply && !isResolved && (
            <div className="flex items-end gap-2 px-3 pb-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="flex-1 resize-none text-xs rounded border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] px-2 py-1.5 focus:outline-none focus:border-[var(--color-fonts-font-color-brand)] placeholder:text-[var(--color-fonts-font-color-support)]"
              />
              <button
                onClick={() => { if (replyText.trim()) { onReply(replyText.trim()); setReplyText(''); setReplyOpen(false) } }}
                disabled={!replyText.trim()}
                className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-[var(--color-fonts-font-color-brand)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                <Send size={10} /> Send
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InlineCommentRow({
  comment, lineType = 'ctx', onFix, isFixRunning, isFixPending, fixedInfo, onOpenCommit,
  commentRef, onResolve, onFalsePositive, onReply, isResolvePending, isFalsePositivePending, optimisticallyResolved,
}: {
  comment: ReviewCommentEntry
  /** Type of the diff line this comment is attached to — used to tint the gutter cell. */
  lineType?: 'add' | 'del' | 'ctx'
  onFix?: () => void
  isFixRunning?: boolean
  isFixPending?: boolean
  fixedInfo?: { fixJobId: string; commitSha?: string }
  onOpenCommit?: (sha: string) => void
  commentRef?: (el: HTMLTableRowElement | null) => void
  onResolve?: () => void
  onFalsePositive?: () => void
  onReply?: (message: string) => void
  isResolvePending?: boolean
  isFalsePositivePending?: boolean
  optimisticallyResolved?: boolean
}) {
  const isResolved = optimisticallyResolved || !!comment.resolved
  const [expanded, setExpanded] = useState(!isResolved)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')

  // Saturated accent colour for the left border (font token, not background token)
  const accentColor = isResolved
    ? 'var(--color-status-text-active)'
    : 'var(--color-tags-font-attention)'

  // Use the exact same tints as DiffLineRow so the gutter colours are identical
  const gutterBg =
    lineType === 'add' ? 'bg-emerald-500/[0.22]' :
    lineType === 'del' ? 'bg-rose-500/[0.22]'    :
    'bg-[var(--color-tables-table-row-a)]'

  const rowBg =
    lineType === 'add' ? 'bg-emerald-500/[0.13]' :
    lineType === 'del' ? 'bg-rose-500/[0.13]'    :
    ''

  const isFixable = comment.line > 0 && comment.commentId > 0

  // ── Collapsed chip ─────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <tr ref={commentRef} className={rowBg}>
        {/* Gutter — same tint as parent diff line */}
        <td colSpan={3} className={`${gutterBg} border-r border-[var(--color-borders-border-primary)]/30`} />
        {/* Chip in code column */}
        <td className="pl-1 pr-3 py-1">
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1 rounded border border-[var(--color-borders-border-primary)]/20 bg-[var(--color-cards-card-background)] text-left group hover:bg-[var(--color-cards-card-background-hover)] transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.07)]"
            style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
          >
            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isResolved ? 'bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]' : 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'}`}>
              {isResolved ? <CheckCheck size={10} /> : <Bot size={10} />}
            </span>
            <span className="text-[11px] font-semibold text-[var(--color-fonts-font-color-primary)]">Review Agent</span>
            {isResolved ? (
              <>
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]">
                  <CheckCheck size={8} /> Resolved
                </span>
                {comment.resolvedBy && <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">by <span className="font-medium">{comment.resolvedBy}</span></span>}
                {comment.resolvedAt && <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">· {new Date(comment.resolvedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
              </>
            ) : (
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)] truncate max-w-[60ch]">
                {comment.content.replace(/[#*`_>-]/g, '').trim().slice(0, 90)}{comment.content.length > 90 ? '…' : ''}
              </span>
            )}
            <ChevronDown size={12} className="ml-auto shrink-0 text-[var(--color-fonts-font-color-support)] group-hover:text-[var(--color-fonts-font-color-primary)] transition-colors" />
          </button>
        </td>
      </tr>
    )
  }

  // ── Expanded card ──────────────────────────────────────────────────────────
  return (
    <tr ref={commentRef} className={rowBg}>
      {/* Gutter — continues the diff line color visually */}
      <td colSpan={3} className={`${gutterBg} border-r border-[var(--color-borders-border-primary)]/30 align-top pt-1.5`} />
      {/* Card floats in the code column */}
      <td className="pl-1 pr-3 py-1.5 align-top">
        <div
          className="rounded-lg border border-[var(--color-borders-border-primary)]/20 bg-[var(--color-cards-card-background)] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
          style={{ borderLeftWidth: '3px', borderLeftColor: accentColor }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-borders-border-primary)]/20">
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${isResolved ? 'bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]' : 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'}`}>
              {isResolved ? <CheckCheck size={12} /> : <Bot size={12} />}
            </span>
            <span className="text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">Review Agent</span>
            {comment.line > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)] font-mono">line {comment.line}</span>
            )}
            {isResolved && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]">
                <CheckCheck size={9} /> Resolved
              </span>
            )}
            <button onClick={() => setExpanded(false)} className="ml-auto shrink-0 p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors" title="Collapse">
              <ChevronUp size={14} />
            </button>
          </div>

          {/* Markdown body */}
          <div className={`px-4 py-3 bot-comment-body${isResolved ? ' is-resolved' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
          </div>

          {/* Footer */}
          <div className="flex flex-col border-t border-[var(--color-borders-border-primary)]/20 bg-[var(--color-cards-card-background-hover)]">
            <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap min-h-[32px]">
              {isResolved ? (
                <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                  Resolved
                  {comment.resolvedBy ? <> by <span className="font-medium">{comment.resolvedBy}</span></> : null}
                  {comment.resolvedAt ? <> · {new Date(comment.resolvedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</> : null}
                </span>
              ) : (
                <>
                  {onResolve && (
                    <button onClick={onResolve} disabled={isResolvePending} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-status-text-active)] hover:bg-[var(--color-status-success-background)] transition-colors disabled:opacity-50">
                      <CheckCheck size={10} /> Resolve
                    </button>
                  )}
                  {onFalsePositive && (
                    <button onClick={onFalsePositive} disabled={isFalsePositivePending} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-tags-neutral-background)] transition-colors disabled:opacity-50">
                      <Flag size={10} /> False Positive
                    </button>
                  )}
                  {fixedInfo ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--color-status-success-background)] text-[var(--color-status-text-active)]"><CheckCheck size={9} /> Fixed</span>
                      <a href={`/jobs/${fixedInfo.fixJobId}`} onClick={e => { e.preventDefault(); window.location.href = `/jobs/${fixedInfo.fixJobId}` }} className="text-[10px] font-mono text-[var(--color-fonts-font-color-brand)] hover:underline">{fixedInfo.fixJobId.slice(0, 8)}</a>
                      {fixedInfo.commitSha && (<><span className="text-[10px] text-[var(--color-fonts-font-color-support)]">·</span><button onClick={() => onOpenCommit?.(fixedInfo.commitSha!)} className="text-[10px] font-mono text-[var(--color-fonts-font-color-brand)] hover:underline">{fixedInfo.commitSha.slice(0, 8)}</button></>)}
                    </div>
                  ) : isFixable && onFix ? (
                    <FixCommentButton isRunning={!!isFixRunning} isPending={!!isFixPending} onClick={onFix} />
                  ) : null}
                  {onReply && (
                    <button onClick={() => setReplyOpen(v => !v)} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-tables-table-hover)] transition-colors ml-auto">
                      <MessageSquare size={10} /> Reply
                    </button>
                  )}
                </>
              )}
            </div>
            {replyOpen && onReply && !isResolved && (
              <div className="flex items-end gap-2 px-3 pb-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Write a reply…"
                  rows={2}
                  className="flex-1 resize-none text-xs rounded border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] px-2 py-1.5 focus:outline-none focus:border-[var(--color-fonts-font-color-brand)] placeholder:text-[var(--color-fonts-font-color-support)]"
                />
                <button
                  onClick={() => { if (replyText.trim()) { onReply(replyText.trim()); setReplyText(''); setReplyOpen(false) } }}
                  disabled={!replyText.trim()}
                  className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-[10px] font-medium bg-[var(--color-fonts-font-color-brand)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Send size={10} /> Send
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Separator() {
  return (
    <span className="h-3 w-px bg-[var(--color-borders-border-primary)] opacity-30 shrink-0" />
  )
}

// ── Fix PR Confirm Dialog ─────────────────────────────────────────────────────

function FixPrConfirmDialog({
  openComments,
  isPending,
  onConfirm,
  onCancel,
}: {
  openComments: ReviewCommentEntry[]
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // Group open comments by file for the summary table
  const byFile = useMemo(() => {
    const map = new Map<string, number>()
    openComments.forEach(c => map.set(c.filePath, (map.get(c.filePath) ?? 0) + 1))
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [openComments])

  const commentCount = openComments.length
  const fileCount = byFile.length

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-[460px] max-h-[90vh] flex flex-col rounded-lg bg-[var(--color-cards-card-background)] shadow-xl">

        {/* Header */}
        <div className="shrink-0 flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[var(--color-borders-border-primary)]">
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
            <Wrench size={15} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              Queue Fix PR job?
            </h2>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
              The agent will create a new commit addressing{' '}
              <strong>{commentCount} review {commentCount === 1 ? 'comment' : 'comments'}</strong>{' '}
              across <strong>{fileCount} {fileCount === 1 ? 'file' : 'files'}</strong>.
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-3">

          {/* What will happen */}
          <div className="rounded-lg border border-[var(--color-borders-border-primary)] p-3 space-y-1.5">
            {[
              'Clones the repository and checks out the PR branch',
              'Applies targeted fixes for each open review comment',
              'Commits and pushes the changes to the existing PR branch',
              'Triggers a follow-up bot review once the fix lands',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-[var(--color-tags-neutral-background)] flex items-center justify-center text-[9px] font-bold text-[var(--color-fonts-font-color-support)]">
                  {i + 1}
                </span>
                <p className="text-xs text-[var(--color-fonts-font-color-support)]">{step}</p>
              </div>
            ))}
          </div>

          {/* Comments by file */}
          {byFile.length > 0 && (
            <div className="rounded-lg border border-[var(--color-borders-border-primary)] overflow-hidden">
              <div className="px-3 py-1.5 bg-[var(--color-cards-card-background-hover)] border-b border-[var(--color-borders-border-primary)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  Comments to fix
                </p>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {byFile.map(([filePath, count]) => {
                    const name = filePath.split('/').pop() ?? filePath
                    const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : ''
                    return (
                      <tr key={filePath} className="border-b border-[var(--color-borders-border-primary)] last:border-b-0">
                        <td className="px-3 py-1.5">
                          <span className="font-mono font-semibold text-[var(--color-fonts-font-color-primary)]">{name}</span>
                          {dir && (
                            <span className="ml-1 text-[var(--color-fonts-font-color-support)] font-mono">{dir}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right shrink-0 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
                            {count} {count === 1 ? 'comment' : 'comments'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--color-borders-border-primary)]">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={isPending ? <RefreshCw size={13} className="animate-spin" /> : <Wrench size={13} />}
            loading={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Queuing…' : 'Start Fix'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function FixPrButton({ pending, runningJobId, onClick }: {
  pending?: boolean
  runningJobId?: string | null
  onClick: () => void
}) {
  const isActive = pending || !!runningJobId
  return (
    <Tooltip text={isActive ? 'Fix job is running…' : 'Auto-fix all review comments in this PR'}>
      <Button
        variant="secondary"
        size="xs"
        icon={isActive ? <RefreshCw size={11} className="animate-spin" /> : <Wrench size={11} />}
        loading={pending && !runningJobId}
        disabled={isActive}
        onClick={onClick}
      >
        {isActive ? 'Fixing…' : 'Fix PR'}
      </Button>
    </Tooltip>
  )
}

function FixCommentButton({ isRunning, isPending, onClick }: {
  isRunning: boolean
  isPending: boolean
  onClick: () => void
}) {
  const isActive = isRunning || isPending
  return (
    <Tooltip text={isActive ? 'Fix job running…' : 'Auto-fix this comment'}>
      <Button
        variant="ghost"
        size="xs"
        icon={isActive ? <RefreshCw size={10} className="animate-spin" /> : <Wrench size={10} />}
        disabled={isActive}
        onClick={onClick}
      >
        {isActive ? 'Fixing…' : 'Fix'}
      </Button>
    </Tooltip>
  )
}

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
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

// ── Coverage tab ──────────────────────────────────────────────────────────────

function pkgLineRate(p: PackageLineCoverage) {
  const total = p.linesCovered + p.linesMissed
  return total > 0 ? (100 * p.linesCovered) / total : 0
}

function rateBadgeClass(rate: number) {
  const base = 'text-xs font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)]'
  if (rate >= 80) return `${base} bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]`
  if (rate >= 50) return `${base} bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]`
  return `${base} bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]`
}

function deltaBadge(delta: number | null) {
  if (delta === null) return <span className="text-[var(--color-fonts-font-color-support)]">—</span>
  const abs = Math.abs(delta).toFixed(1)
  if (delta > 0.05)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-tags-font-success)]">
        <TrendingUp size={11} />+{abs}%
      </span>
    )
  if (delta < -0.05)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-tags-font-critical)]">
        <TrendingDown size={11} />−{abs}%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-[var(--color-fonts-font-color-support)]">
      <Minus size={11} />{abs}%
    </span>
  )
}

interface CoverageMetricCardProps {
  label: string
  before?: number
  after?: number
}

function CoverageMetricCard({ label, before, after }: CoverageMetricCardProps) {
  // Show `after` when available; fall back to `before` when there is no after snapshot
  const hasAfter = after !== undefined
  const displayVal = hasAfter ? after! : (before ?? 0)
  const showFrom = hasAfter && before !== undefined
  const delta = before != null && after != null ? after - before : null
  const color =
    displayVal >= 80
      ? 'var(--color-status-border-success)'
      : displayVal >= 50
      ? 'var(--color-status-border-attention)'
      : 'var(--color-status-border-critical)'

  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 flex flex-col gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color }}>
          {before !== undefined || after !== undefined ? `${displayVal.toFixed(1)}%` : '—'}
        </span>
        {showFrom && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)] mb-0.5">
            from {before!.toFixed(1)}%
          </span>
        )}
        {!hasAfter && before !== undefined && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)] mb-0.5">baseline</span>
        )}
      </div>
      {delta !== null && (
        <div className="flex items-center gap-1">
          {deltaBadge(delta)}
        </div>
      )}
      <div className="w-full h-1.5 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, displayVal)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function CoverageTab({ coverageData }: { coverageData: JobCoverageData }) {
  const { before, after } = coverageData
  // True when we only have a baseline snapshot (no post-generation measurement)
  const baselineOnly = after == null

  type SortKey = 'name' | 'beforeRate' | 'afterRate' | 'delta'
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey>('delta')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Build merged package list
  const mergedPackages = useMemo(() => {
    const map = new Map<string, { before?: PackageLineCoverage; after?: PackageLineCoverage }>()
    for (const p of before?.packages ?? []) {
      map.set(p.name, { before: p })
    }
    for (const p of after?.packages ?? []) {
      const existing = map.get(p.name) ?? {}
      map.set(p.name, { ...existing, after: p })
    }
    return Array.from(map.entries()).map(([name, { before: b, after: a }]) => ({
      name,
      beforeRate: b ? pkgLineRate(b) : null,
      afterRate: a ? pkgLineRate(a) : null,
      delta: b != null && a != null ? pkgLineRate(a) - pkgLineRate(b) : null,
    }))
  }, [before, after])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...mergedPackages].sort((a, b) => {
    let av: number | string, bv: number | string
    if (sortKey === 'name') { av = a.name; bv = b.name }
    else if (sortKey === 'beforeRate') { av = a.beforeRate ?? -1; bv = b.beforeRate ?? -1 }
    else if (sortKey === 'afterRate') { av = a.afterRate ?? -1; bv = b.afterRate ?? -1 }
    else { av = a.delta ?? -999; bv = b.delta ?? -999 }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const improved = mergedPackages.filter(p => (p.delta ?? 0) > 0.05).length
  const regressed = mergedPackages.filter(p => (p.delta ?? 0) < -0.05).length

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Aggregate metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CoverageMetricCard label="Line Coverage"   before={before?.lineRate}   after={after?.lineRate} />
        <CoverageMetricCard label="Branch Coverage" before={before?.branchRate} after={after?.branchRate} />
        <CoverageMetricCard label="Method Coverage" before={before?.methodRate} after={after?.methodRate} />
        <CoverageMetricCard label="Class Coverage"  before={before?.classRate}  after={after?.classRate} />
      </div>

      {/* Package diff table */}
      {mergedPackages.length > 0 && (
        <TableCard
          title="Package / Namespace Coverage"
          subtitle={
            mergedPackages.length > 0
              ? `${mergedPackages.length} packages · ${improved} improved · ${regressed} regressed`
              : undefined
          }
          maxHeight="9999px"
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
                <CovSortHeader label="Package / Namespace" sortKey="name"       current={sortKey} dir={sortDir} onSort={handleSort} />
                {baselineOnly ? (
                  <CovSortHeader label="Coverage (baseline)" sortKey="beforeRate" current={sortKey} dir={sortDir} onSort={handleSort} />
                ) : (
                  <>
                    <CovSortHeader label="Before"            sortKey="beforeRate" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <CovSortHeader label="After"             sortKey="afterRate"  current={sortKey} dir={sortDir} onSort={handleSort} />
                    <CovSortHeader label="Change"            sortKey="delta"      current={sortKey} dir={sortDir} onSort={handleSort} />
                  </>
                )}
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] w-40">
                  Coverage Bar
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(pkg => {
                const displayRate = baselineOnly ? pkg.beforeRate : pkg.afterRate
                return (
                  <tr
                    key={pkg.name}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
                  >
                    <td className="px-4 py-1.5 font-mono text-[11px] text-[var(--color-fonts-font-color-primary)] max-w-xs truncate">
                      {pkg.name.replace(/\//g, '.')}
                    </td>
                    {baselineOnly ? (
                      <td className="px-4 py-1.5">
                        {pkg.beforeRate != null
                          ? <span className={rateBadgeClass(pkg.beforeRate)}>{pkg.beforeRate.toFixed(1)}%</span>
                          : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-1.5">
                          {pkg.beforeRate != null
                            ? <span className={rateBadgeClass(pkg.beforeRate)}>{pkg.beforeRate.toFixed(1)}%</span>
                            : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                        </td>
                        <td className="px-4 py-1.5">
                          {pkg.afterRate != null
                            ? <span className={rateBadgeClass(pkg.afterRate)}>{pkg.afterRate.toFixed(1)}%</span>
                            : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                        </td>
                        <td className="px-4 py-1.5">
                          {deltaBadge(pkg.delta)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-1.5 w-40">
                      <div className="relative w-full h-2 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
                        {pkg.beforeRate != null && !baselineOnly && (
                          <div
                            className="absolute h-full rounded-full opacity-30"
                            style={{
                              width: `${Math.min(100, pkg.beforeRate)}%`,
                              backgroundColor: 'var(--color-fonts-font-color-support)',
                            }}
                          />
                        )}
                        {displayRate != null && (
                          <div
                            className="absolute h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, displayRate)}%`,
                              backgroundColor:
                                displayRate >= 80 ? 'var(--color-status-border-success)'
                                : displayRate >= 50 ? 'var(--color-status-border-attention)'
                                : 'var(--color-status-border-critical)',
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}

function CovSortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string
  sortKey: 'name' | 'beforeRate' | 'afterRate' | 'delta'
  current: 'name' | 'beforeRate' | 'afterRate' | 'delta'
  dir: 'asc' | 'desc'
  onSort: (k: 'name' | 'beforeRate' | 'afterRate' | 'delta') => void
}) {
  const active = current === sortKey
  return (
    <th
      className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer select-none hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (dir === 'asc' ? <ChevronDown size={11} className="rotate-180" /> : <ChevronDown size={11} />)
          : <ChevronDown size={11} className="opacity-30" />}
      </span>
    </th>
  )
}

// ── SLA Badge ─────────────────────────────────────────────────────────────────

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

// ── Review Tab ────────────────────────────────────────────────────────────────

interface ReviewTabProps {
  reviewData: JobReviewResponse | undefined
  isLoading: boolean
  requestReviewPending: boolean
  onRequestReview: () => void
  fixPrPending?: boolean
  fixPrJobId?: string | null
  onFixPr?: () => void
  fixCommentJobIds?: Record<number, string>
  fixedCommentInfo?: Record<number, FixedCommentInfo>
  onFixComment?: (commentId: number, filePath: string, line: number) => void
  fixCommentPendingId?: number
  onOpenCommit?: (sha: string) => void
  onResolveComment?: (commentId: number) => void
  onFalsePositive?: (commentId: number) => void
  onReplyComment?: (commentId: number, message: string) => void
  resolvedCommentIds?: Set<number>
  resolveCommentPendingId?: number
  falsePositivePendingId?: number
}

function ReviewTab({
  reviewData, isLoading, requestReviewPending, onRequestReview,
  fixPrPending, fixPrJobId, onFixPr,
  fixCommentJobIds = {}, fixedCommentInfo = {}, onFixComment, fixCommentPendingId, onOpenCommit,
  onResolveComment, onFalsePositive, onReplyComment, resolvedCommentIds = new Set(),
  resolveCommentPendingId, falsePositivePendingId,
}: ReviewTabProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <TableCard title="Review">
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--color-fonts-font-color-support)]">
          <RefreshCw size={14} className="animate-spin" />
          Loading review…
        </div>
      </TableCard>
    )
  }

  const status = reviewData?.reviewJobStatus
  const reviewJobId = reviewData?.reviewJobId
  const inFlight = status === 'RUNNING' || status === 'PENDING'
  const completed = status === 'SUCCESS' || status === 'FAILED'

  if (!reviewData || (!reviewJobId && !reviewData.comments.length)) {
    return (
      <TableCard
        title="Review"
        toolbar={
          <Button
            variant="primary"
            size="sm"
            icon={<Eye size={12} />}
            loading={requestReviewPending}
            onClick={onRequestReview}
          >
            Request Review
          </Button>
        }
      >
        <div className="px-4 py-6 text-sm text-[var(--color-fonts-font-color-support)]">
          No bot review found for this PR.
        </div>
      </TableCard>
    )
  }

  if (inFlight) {
    return (
      <TableCard
        title="Review"
        toolbar={
          <Button variant="secondary" size="sm" loading disabled icon={<RefreshCw size={12} />}>
            Review in progress…
          </Button>
        }
      >
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--color-fonts-font-color-support)]">
          <RefreshCw size={14} className="animate-spin" />
          Bot review is running. This page will auto-refresh.
        </div>
      </TableCard>
    )
  }

  const statusBadgeCls = status === 'SUCCESS'
    ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
    : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'

  const comments = (reviewData.comments ?? []).filter(c => c.filePath && c.filePath.trim() !== '')
  const commentsByFile: Record<string, ReviewCommentEntry[]> = {}
  comments.forEach(c => { (commentsByFile[c.filePath] ??= []).push(c) })

  return (
    <div className="space-y-3">
      {/* Review header card */}
      <TableCard
        title="Bot Review"
        toolbar={
          <div className="flex items-center gap-2">
            {reviewJobId && (
              <Tooltip text="Open review job">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ExternalLink size={11} />}
                  onClick={() => navigate({ to: '/jobs/$id', params: { id: reviewJobId } })}
                >
                  {reviewJobId.slice(0, 8)}…
                </Button>
              </Tooltip>
            )}
            {completed && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusBadgeCls}`}>
                {status}
              </span>
            )}
            {completed && (
              <Tooltip text="Re-request a fresh bot review">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw size={11} />}
                  loading={requestReviewPending}
                  onClick={onRequestReview}
                >
                  Re-request
                </Button>
              </Tooltip>
            )}
            {onFixPr && comments.length > 0 && (
              <FixPrButton
                pending={fixPrPending}
                runningJobId={fixPrJobId}
                onClick={onFixPr}
              />
            )}
          </div>
        }
      >
        <div className="px-4 py-2 text-xs text-[var(--color-fonts-font-color-support)]">
          {reviewData.reviewedAt && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Reviewed on {new Date(reviewData.reviewedAt).toLocaleString()}
            </span>
          )}
        </div>
      </TableCard>

      {/* Summary card */}
      {reviewData.reviewSummary && (
        <TableCard title="Summary">
          <div className="px-4 py-4 bot-comment-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reviewData.reviewSummary.replace(/<!--[\s\S]*?-->/g, '')}</ReactMarkdown>
          </div>
        </TableCard>
      )}

      {/* Comments grouped by file */}
      {Object.entries(commentsByFile).map(([filePath, fileComments]) => (
        <TableCard
          key={filePath}
          title={filePath.split('/').pop() ?? filePath}
          subtitle={`${fileComments.length} comment${fileComments.length !== 1 ? 's' : ''}`}
        >
          <div className="divide-y divide-[var(--color-cards-card-stroke)]">
            {fileComments.map((c, i) => (
              <ReviewCommentCard
                key={i}
                comment={c}
                onFix={onFixComment && c.commentId > 0 && !fixedCommentInfo[c.commentId]
                  ? () => onFixComment(c.commentId, c.filePath, c.line)
                  : undefined}
                isFixRunning={!!fixCommentJobIds[c.commentId]}
                isFixPending={fixCommentPendingId === c.commentId}
                fixedInfo={fixedCommentInfo[c.commentId]}
                onOpenCommit={onOpenCommit}
                onResolve={onResolveComment && c.commentId > 0 && !resolvedCommentIds.has(c.commentId)
                  ? () => onResolveComment(c.commentId) : undefined}
                onFalsePositive={onFalsePositive && c.commentId > 0 && !resolvedCommentIds.has(c.commentId)
                  ? () => onFalsePositive(c.commentId) : undefined}
                onReply={onReplyComment && c.commentId > 0
                  ? (msg) => onReplyComment(c.commentId, msg) : undefined}
                isResolvePending={resolveCommentPendingId === c.commentId}
                isFalsePositivePending={falsePositivePendingId === c.commentId}
                optimisticallyResolved={resolvedCommentIds.has(c.commentId)}
              />
            ))}
          </div>
        </TableCard>
      ))}

      {comments.length === 0 && (
        <div className="text-sm text-[var(--color-fonts-font-color-support)] px-1">
          No inline comments in this review.
        </div>
      )}
    </div>
  )
}

// ── Evidence Tab ──────────────────────────────────────────────────────────────

interface EvidenceTabProps {
  job: JobStatusResponse
  evidenceData: JobEvidenceResponse | undefined
  uploadScytalePending: boolean
  onUploadScytale: () => void
}

function EvidenceTab({ job, evidenceData, uploadScytalePending, onUploadScytale }: EvidenceTabProps) {
  const navigate = useNavigate()

  if (!evidenceData) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-fonts-font-color-support)]">
        <RefreshCw size={14} className="animate-spin" />
        Loading evidence…
      </div>
    )
  }

  const { complianceApplicable, complianceChecks, auditTrail, scytaleEvidenceRef, scytaleEnabled } = evidenceData

  return (
    <div className="space-y-3 pb-6">
      {/* Aikido source */}
      {job.aikidoIssueId && (
        <TableCard title="Vulnerability Source">
          <div className="px-4 py-3 flex items-center gap-2 text-sm">
            <ShieldCheck size={14} className="text-[var(--color-tags-font-critical)] shrink-0" />
            <span>Aikido issue:</span>
            <a
              href={`https://app.aikido.dev/issues/${job.aikidoIssueId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-fonts-font-color-brand)] hover:underline inline-flex items-center gap-1"
            >
              {job.aikidoIssueId}
              <ExternalLink size={11} />
            </a>
            <span className="text-xs text-[var(--color-fonts-font-color-support)] ml-2">
              Post-fix re-scan verification is a future phase.
            </span>
          </div>
        </TableCard>
      )}

      {/* Compliance checklist or not-applicable notice */}
      {complianceApplicable ? (
        <TableCard
          title="SOC II CC8.1 Compliance"
          subtitle="Change Management"
          toolbar={
            <Button
              variant="ghost"
              size="sm"
              icon={<Printer size={11} />}
              onClick={() => window.print()}
            >
              Print / Export
            </Button>
          }
        >
          <div className="divide-y divide-[var(--color-cards-card-stroke)]">
            {complianceChecks.map((check) => (
              <div key={check.name} className="flex items-start gap-3 px-4 py-2.5">
                {check.passed
                  ? <CheckCircle size={14} className="text-[var(--color-tags-font-success)] shrink-0 mt-0.5" />
                  : <XCircle    size={14} className="text-[var(--color-tags-font-critical)] shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)]">{check.name}</p>
                  {check.detail && (
                    <p className="text-[11px] text-[var(--color-fonts-font-color-support)] mt-0.5 truncate">{check.detail}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  check.passed
                    ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
                    : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
                }`}>
                  {check.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </TableCard>
      ) : (
        <div className="px-1 text-sm text-[var(--color-fonts-font-color-support)]">
          Compliance controls apply to Jira Bug tickets only. Showing audit trail below.
        </div>
      )}

      {/* Promotion banner */}
      {evidenceData.promotionJobId && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-[var(--border-radius-card)] bg-[var(--color-status-neutral-background)] border border-[var(--color-cards-card-stroke)]">
          <GitBranch size={14} className="text-[var(--color-fonts-font-color-brand)]" />
          <span className="text-sm text-[var(--color-fonts-font-color-primary)]">
            Production promotion:
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<ExternalLink size={11} />}
            onClick={() => navigate({ to: '/jobs/$id', params: { id: evidenceData.promotionJobId! } })}
          >
            {evidenceData.promotionJobId.slice(0, 8)}…
          </Button>
        </div>
      )}

      {/* Scytale upload */}
      {complianceApplicable && (
        <TableCard title="Scytale Evidence Upload">
          <div className="px-4 py-3">
            {scytaleEvidenceRef ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-tags-font-success)]">
                <CheckCircle size={14} />
                Uploaded to Scytale · Ref: <span className="font-mono">{scytaleEvidenceRef}</span>
              </div>
            ) : scytaleEnabled ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ShieldCheck size={12} />}
                  loading={uploadScytalePending}
                  onClick={onUploadScytale}
                >
                  Upload to Scytale
                </Button>
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  Upload SOC II evidence to your Scytale workspace for CC8.1
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-fonts-font-color-support)]">
                Scytale integration not configured. Add credentials in System Settings → Compliance.
              </p>
            )}
          </div>
        </TableCard>
      )}

      {/* Audit timeline */}
      <TableCard title="Audit Trail" subtitle={`${auditTrail.length} events`}>
        {auditTrail.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--color-fonts-font-color-support)]">No audit events found.</p>
        ) : (
          <div className="relative">
            {auditTrail.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 relative">
                {/* Vertical connector */}
                {i < auditTrail.length - 1 && (
                  <div className="absolute left-[23px] top-8 bottom-0 w-px bg-[var(--color-cards-card-stroke)]" />
                )}
                <div className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-tags-neutral-background)] flex items-center justify-center mt-0.5 z-10">
                  <MessageSquare size={9} className="text-[var(--color-fonts-font-color-support)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">{entry.action}</span>
                    <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-[10px] italic text-[var(--color-fonts-font-color-support)]">{entry.actor}</span>
                  </div>
                  {entry.detail && (
                    <p className="text-[11px] text-[var(--color-fonts-font-color-support)] mt-0.5 font-mono break-all">
                      {entry.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TableCard>
    </div>
  )
}

// ── Commits Tab ───────────────────────────────────────────────────────────────

interface CommitsTabProps {
  commits: PrCommitEntry[]
  isLoading: boolean
  onCommitClick: (sha: string) => void
}

function CommitsTab({ commits, isLoading, onCommitClick }: CommitsTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-fonts-font-color-support)]">
        <RefreshCw size={14} className="animate-spin" />
        Loading commits…
      </div>
    )
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--color-fonts-font-color-support)] text-sm">
        No commits found for this pull request.
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="shrink-0 px-3 py-2 border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)] flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)]">
          Commits
        </span>
        <span className="ml-auto text-[11px] text-[var(--color-fonts-font-color-support)]">
          {commits.length} commit{commits.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)]">
        {commits.map((commit) => (
          <button
            key={commit.sha}
            onClick={() => onCommitClick(commit.sha)}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-tables-table-hover)] transition-colors group"
          >
            {/* SHA badge */}
            <span className="shrink-0 mt-0.5 font-mono text-[11px] font-semibold text-[var(--color-fonts-font-color-brand)] bg-[var(--color-tags-neutral-background)] px-1.5 py-0.5 rounded">
              {commit.shortSha}
            </span>
            {/* Message + meta */}
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-[var(--color-fonts-font-color-primary)] truncate">
                {commit.message.split('\n')[0]}
              </span>
              <span className="block text-[11px] text-[var(--color-fonts-font-color-support)] mt-0.5">
                {commit.authorName}
                {commit.authorDate && (
                  <> · <RelativeTime dateStr={commit.authorDate} /></>
                )}
              </span>
            </span>
            {/* Arrow hint */}
            <ChevronRight size={14} className="shrink-0 mt-0.5 text-[var(--color-fonts-font-color-support)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  )
}

function RelativeTime({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return <>{dateStr}</>
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return <>just now</>
  if (mins < 60) return <>{mins}m ago</>
  if (hours < 24) return <>{hours}h ago</>
  if (days < 30) return <>{days}d ago</>
  return <>{date.toLocaleDateString()}</>
}

// ── Commit Diff Dialog ────────────────────────────────────────────────────────

interface CommitDiffDialogProps {
  commit: PrCommitEntry | null
  diffData: JobDiffResponse | undefined
  isLoading: boolean
  onClose: () => void
}

function CommitDiffDialog({ commit, diffData, isLoading, onClose }: CommitDiffDialogProps) {
  if (!commit) return null

  const firstLine = commit.message.split('\n')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] shadow-xl flex flex-col max-h-[80vh]">
        {/* Dialog header */}
        <div className="shrink-0 flex items-start gap-3 px-4 py-3 border-b border-[var(--color-cards-card-stroke)]">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)] truncate">
              {firstLine}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-fonts-font-color-support)]">
              <span className="font-mono bg-[var(--color-tags-neutral-background)] px-1.5 py-0.5 rounded text-[var(--color-fonts-font-color-brand)]">
                {commit.shortSha}
              </span>
              <span>{commit.authorName}</span>
              {commit.authorDate && (
                <><span>·</span><RelativeTime dateStr={commit.authorDate} /></>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded hover:bg-[var(--color-tables-table-hover)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
          >
            <XCircle size={16} />
          </button>
        </div>

        {/* Dialog body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-[var(--color-fonts-font-color-support)]">
              <RefreshCw size={14} className="animate-spin" />
              Loading diff…
            </div>
          )}
          {!isLoading && (!diffData || diffData.files.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-fonts-font-color-support)] text-sm">
              Diff unavailable for this platform or commit.
            </div>
          )}
          {!isLoading && diffData && diffData.files.length > 0 && (
            <div className="text-xs">
              {/* Stats bar */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-cards-card-stroke)] text-[11px] text-[var(--color-fonts-font-color-support)]">
                <span>{diffData.files.length} file{diffData.files.length !== 1 ? 's' : ''}</span>
                <span className="text-emerald-400 font-semibold">+{diffData.totalAdditions}</span>
                <span className="text-rose-400 font-semibold">−{diffData.totalDeletions}</span>
              </div>
              {diffData.files.map((file) => (
                <FileDiffSection
                  key={file.filename}
                  file={file}
                  viewed={false}
                  onToggleViewed={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
