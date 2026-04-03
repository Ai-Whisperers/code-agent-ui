import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle, GitBranch,
  ArrowRight, RefreshCw, GitPullRequest, ShieldCheck, GitMerge, AlertCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { JobStatusBadge } from '@/components/ui/JobStatusBadge'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import { TabBar, TabButton } from '@/components/ui/Tabs'
import {
  ChangedFilesTab,
  CommitsTab,
  CommitDiffDialog,
  ReviewTab,
  RelativeTime,
} from './JobDetail'
import api from '@/lib/api'
import type {
  OpenPrEntry,
  JobStatusResponse,
  JobDiffResponse,
  JobCommitsResponse,
  JobReviewResponse,
  PrCommitEntry,
  PromoteJobResponse,
} from '@/types/api'

interface PRDetailProps {
  workspace: string
  repoSlug: string
  prId: string
}

type Tab = 'overview' | 'changed-files' | 'commits' | 'review'

export default function PRDetail({ workspace, repoSlug, prId }: PRDetailProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const dismissToast = useCallback(() => setToast(null), [])
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null)
  // Tracks a promotion job triggered manually for PRs with no linked agent job
  const [manualPromotionJobId, setManualPromotionJobId] = useState<string | null>(null)

  const prKey = `${workspace}/${repoSlug}/${prId}`

  // Use already-cached list data if available (navigating from the list page is instant),
  // otherwise fetch /info directly — never re-fetches the full PR list on detail open.
  // The list query key now includes filters, so we scan all matching cache entries.
  const cachedEntry = (() => {
    const queries = qc.getQueriesData<{ items: OpenPrEntry[] }>({ queryKey: ['pull-requests'] })
    for (const [, data] of queries) {
      const found = data?.items?.find(
        (p) => p.workspace === workspace && p.repoSlug === repoSlug && p.prId === prId
      )
      if (found) return found
    }
    return undefined
  })()

  const { data: prEntry, isLoading: prLoading } = useQuery<OpenPrEntry>({
    queryKey: ['pr-entry', prKey],
    queryFn: (): Promise<OpenPrEntry> =>
      api.get(`/pull-requests/${workspace}/${repoSlug}/${prId}/info`).then((ir) => ({
        workspace,
        repoSlug,
        prId,
        prUrl: ir.data.prUrl ?? '',
        title: ir.data.title ?? prId,
        sourceBranch: ir.data.sourceBranch ?? '',
        targetBranch: ir.data.targetBranch ?? '',
        author: ir.data.author ?? '',
        createdOn: ir.data.createdOn ?? '',
        updatedOn: ir.data.updatedOn ?? '',
        jobId: ir.data.jobId ?? cachedEntry?.jobId,
        status: ir.data.status ?? cachedEntry?.status ?? 'OPEN',
      })),
    initialData: cachedEntry as OpenPrEntry | undefined,
    staleTime: 60_000,
  })

  // Fetch linked job status if jobId is known
  const { data: linkedJob } = useQuery<JobStatusResponse>({
    queryKey: ['job', prEntry?.jobId],
    queryFn: () => api.get(`/status/${prEntry!.jobId}`).then((r) => r.data),
    enabled: !!prEntry?.jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'RUNNING' || s === 'PENDING' || s === 'QUEUED' ? 5_000 : false
    },
  })

  // Diff
  const { data: diffData, isLoading: diffLoading, isError: diffError } = useQuery<JobDiffResponse>({
    queryKey: ['pr-diff', prKey],
    queryFn: () => api.get(`/pull-requests/${workspace}/${repoSlug}/${prId}/diff`).then((r) => r.data),
    enabled: activeTab === 'changed-files',
    retry: false,
  })

  // Commits
  const { data: commitsData } = useQuery<JobCommitsResponse>({
    queryKey: ['pr-commits', prKey],
    queryFn: () => api.get(`/pull-requests/${workspace}/${repoSlug}/${prId}/commits`).then((r) => r.data),
    enabled: activeTab === 'commits',
    retry: false,
  })

  // Commit diff
  const { data: commitDiffData, isLoading: commitDiffLoading } = useQuery<JobDiffResponse>({
    queryKey: ['pr-commit-diff', prKey, selectedCommitSha],
    queryFn: () =>
      api
        .get(`/pull-requests/${workspace}/${repoSlug}/${prId}/commits/${selectedCommitSha}/diff`)
        .then((r) => r.data),
    enabled: !!selectedCommitSha,
    retry: false,
  })

  // Review
  const { data: reviewData, isLoading: reviewLoading } = useQuery<JobReviewResponse>({
    queryKey: ['pr-review', prKey],
    queryFn: () => api.get(`/pull-requests/${workspace}/${repoSlug}/${prId}/review`).then((r) => r.data),
    enabled: activeTab === 'review',
    refetchInterval: (q) => {
      const s = q.state.data?.reviewJobStatus
      return s === 'RUNNING' || s === 'PENDING' ? 5_000 : false
    },
    retry: false,
  })

  const reviewInFlight =
    reviewData?.reviewJobStatus === 'RUNNING' || reviewData?.reviewJobStatus === 'PENDING'

  // Approve / Reject — only available when there's a linked job awaiting approval
  const jobId = prEntry?.jobId
  const isAwaitingApproval = linkedJob?.status === 'AWAITING_APPROVAL'

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      qc.invalidateQueries({ queryKey: ['pull-requests'] })
      setToast({ variant: 'success', message: 'PR approved and merge triggered.' })
    },
    onError: () => setToast({ variant: 'error', message: 'Failed to approve PR.' }),
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/jobs/${jobId}/reject`, { reason: 'Rejected via UI' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      qc.invalidateQueries({ queryKey: ['pull-requests'] })
      setToast({ variant: 'info', message: 'PR rejected.' })
    },
    onError: () => setToast({ variant: 'error', message: 'Failed to reject PR.' }),
  })

  // Promotion job ID: prefer the one stored on the linked agent job, fall back to manually triggered
  const promotionJobId = linkedJob?.promotionJobId ?? manualPromotionJobId ?? undefined
  const { data: promotionJob, refetch: refetchPromotion } = useQuery<JobStatusResponse>({
    queryKey: ['job', promotionJobId],
    queryFn: () => api.get(`/status/${promotionJobId}`).then((r) => r.data),
    enabled: !!promotionJobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status
      return s === 'RUNNING' || s === 'PENDING' || s === 'QUEUED' ? 5_000 : false
    },
  })

  const promoteMutation = useMutation<PromoteJobResponse>({
    mutationFn: () =>
      api.post(`/pull-requests/${workspace}/${repoSlug}/${prId}/promote`).then((r) => r.data),
    onSuccess: (data) => {
      setManualPromotionJobId(data.jobId)
      qc.invalidateQueries({ queryKey: ['job', jobId] })
      qc.invalidateQueries({ queryKey: ['job', data.jobId] })
      setToast({ variant: 'success', message: 'Promotion job started — cherry-picking to main.' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setToast({ variant: 'error', message: msg ?? 'Failed to start promotion.' })
    },
  })

  const totalFiles = diffData?.files.length ?? 0

  const metaStrip = prEntry ? (
    <div className="flex items-center gap-2.5 flex-wrap text-xs text-[var(--color-fonts-font-color-support)] mt-2">
      <span className="flex items-center gap-1">
        <GitPullRequest size={11} />
        <span className="font-mono">{workspace}/{repoSlug}</span>
        <span className="text-[var(--color-fonts-font-color-support)]">·</span>
        <span>PR #{prId}</span>
      </span>

      {prEntry.sourceBranch && (
        <>
          <span className="text-[var(--color-fonts-font-color-support)]">·</span>
          <span className="flex items-center gap-1">
            <GitBranch size={10} />
            <span className="font-mono text-[11px]">{prEntry.sourceBranch}</span>
            <ArrowRight size={10} />
            <span className="font-mono text-[11px]">{prEntry.targetBranch}</span>
          </span>
        </>
      )}

      {prEntry.author && (
        <>
          <span className="text-[var(--color-fonts-font-color-support)]">·</span>
          <span>by {prEntry.author}</span>
        </>
      )}

      {prEntry.updatedOn && (
        <>
          <span className="text-[var(--color-fonts-font-color-support)]">·</span>
          <RelativeTime dateStr={prEntry.updatedOn} />
        </>
      )}

      {linkedJob && (
        <>
          <span className="text-[var(--color-fonts-font-color-support)]">·</span>
          <JobStatusBadge status={linkedJob.status} />
        </>
      )}

      {prEntry.soc2 && (
        <>
          <span className="text-[var(--color-fonts-font-color-support)]">·</span>
          <Tooltip text="SOC II applicable — linked to a security bug fix">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
              <ShieldCheck size={10} />
              SOC II
            </span>
          </Tooltip>
        </>
      )}
    </div>
  ) : null

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title={prLoading ? 'Loading…' : (prEntry?.title ?? `PR #${prId}`)}
        subtitle={`${workspace}/${repoSlug}`}
        statusMessage={metaStrip}
        actions={
          <div className="flex items-center gap-2">
            {isAwaitingApproval && (
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

            {prEntry?.prUrl && (
              <Tooltip text="Open pull request in SCM">
                <a
                  href={prEntry.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
                >
                  <ExternalLink size={13} />
                  Open PR
                </a>
              </Tooltip>
            )}

            <Tooltip text="Back to pull requests">
              <Button
                variant="ghost"
                size="md"
                icon={<ArrowLeft size={14} />}
                onClick={() => navigate({ to: '/pull-requests' })}
              />
            </Tooltip>
          </div>
        }
      />

      {prLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          <TabBar>
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              Overview
            </TabButton>
            <TabButton
              active={activeTab === 'changed-files'}
              onClick={() => setActiveTab('changed-files')}
              badge={totalFiles > 0 ? String(totalFiles) : undefined}
            >
              Changed Files
            </TabButton>
            <TabButton
              active={activeTab === 'commits'}
              onClick={() => setActiveTab('commits')}
              badge={
                commitsData && commitsData.commits.length > 0
                  ? String(commitsData.commits.length)
                  : undefined
              }
            >
              Commits
            </TabButton>
            <TabButton
              active={activeTab === 'review'}
              onClick={() => setActiveTab('review')}
            >
              Review
              {reviewInFlight && <RefreshCw size={10} className="animate-spin" />}
            </TabButton>
          </TabBar>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <>
              <OverviewTab prEntry={prEntry} linkedJob={linkedJob} />
              {prEntry && (
                <Soc2PromotionPanel
                  prEntry={prEntry}
                  promotionJob={promotionJob}
                  promotionJobId={promotionJobId}
                  isPromoting={promoteMutation.isPending}
                  onPromote={() => promoteMutation.mutate()}
                  onRetry={() => {
                    setManualPromotionJobId(null)
                    qc.invalidateQueries({ queryKey: ['job', jobId] })
                    refetchPromotion()
                    promoteMutation.mutate()
                  }}
                />
              )}
            </>
          )}

          {/* Changed Files tab */}
          {activeTab === 'changed-files' && (
            <ChangedFilesTab
              job={linkedJob ?? buildFakeJob(prEntry)}
              diffData={diffData}
              isLoading={diffLoading}
              isError={diffError}
              reviewComments={reviewData?.comments ?? []}
            />
          )}

          {/* Commits tab */}
          {activeTab === 'commits' && (
            <CommitsTab
              commits={commitsData?.commits ?? []}
              isLoading={!commitsData && activeTab === 'commits'}
              onCommitClick={setSelectedCommitSha}
            />
          )}

          {/* Commit diff dialog */}
          {selectedCommitSha && (
            <CommitDiffDialog
              commit={
                commitsData?.commits.find((c: PrCommitEntry) => c.sha === selectedCommitSha) ?? null
              }
              diffData={commitDiffData}
              isLoading={commitDiffLoading}
              onClose={() => setSelectedCommitSha(null)}
            />
          )}

          {/* Review tab */}
          {activeTab === 'review' && (
            <ReviewTab
              reviewData={reviewData}
              isLoading={reviewLoading}
              requestReviewPending={false}
              onRequestReview={() => {}}
            />
          )}
        </div>
      )}

      {toast && <Toast {...toast} onClose={dismissToast} />}
    </main>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  prEntry,
  linkedJob,
}: {
  prEntry: OpenPrEntry | undefined
  linkedJob: JobStatusResponse | undefined
}) {
  if (!prEntry) {
    return (
      <p className="text-sm text-[var(--color-fonts-font-color-support)] px-1">
        Pull request not found.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <TableCard title="Pull Request Details" maxHeight="none">
        <div className="px-4 py-4 space-y-3 text-sm">
          <Row label="Repository">
            <span className="font-mono text-[var(--color-fonts-font-color-primary)]">
              {prEntry.workspace}/{prEntry.repoSlug}
            </span>
          </Row>
          <Row label="PR #">
            <a
              href={prEntry.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline"
            >
              <ExternalLink size={12} />
              {prEntry.prId}
            </a>
          </Row>
          <Row label="Title">
            <span className="text-[var(--color-fonts-font-color-primary)] font-medium">
              {prEntry.title}
            </span>
          </Row>
          <Row label="Branches">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)]">
                {prEntry.sourceBranch}
              </span>
              <ArrowRight size={12} className="text-[var(--color-fonts-font-color-support)]" />
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)]">
                {prEntry.targetBranch}
              </span>
            </span>
          </Row>
          <Row label="Author">
            <span className="text-[var(--color-fonts-font-color-primary)]">{prEntry.author}</span>
          </Row>
          {prEntry.createdOn && (
            <Row label="Created">
              <span className="text-[var(--color-fonts-font-color-support)]">
                {new Date(prEntry.createdOn).toLocaleString()}
              </span>
            </Row>
          )}
          {prEntry.updatedOn && (
            <Row label="Updated">
              <span className="text-[var(--color-fonts-font-color-support)]">
                {new Date(prEntry.updatedOn).toLocaleString()}
              </span>
            </Row>
          )}
          {linkedJob && (
            <Row label="Agent Job">
              <span className="flex items-center gap-2">
                <JobStatusBadge status={linkedJob.status} />
                <span className="font-mono text-[11px] text-[var(--color-fonts-font-color-support)]">
                  {linkedJob.jobId.slice(0, 8)}…
                </span>
                <span className="text-[var(--color-fonts-font-color-support)]">
                  {linkedJob.jobType}
                </span>
              </span>
            </Row>
          )}
        </div>
      </TableCard>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-24 shrink-0 text-[var(--color-fonts-font-color-support)] text-xs pt-0.5">
        {label}
      </span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  )
}

// ── SOC2 Promotion Panel ──────────────────────────────────────────────────────

interface Soc2PromotionPanelProps {
  prEntry: OpenPrEntry
  promotionJob: JobStatusResponse | undefined
  promotionJobId: string | undefined
  isPromoting: boolean
  onPromote: () => void
  onRetry: () => void
}

function Soc2PromotionPanel({
  prEntry,
  promotionJob,
  promotionJobId,
  isPromoting,
  onPromote,
  onRetry,
}: Soc2PromotionPanelProps) {
  const isMerged = prEntry.status?.toUpperCase() === 'MERGED'

  let content: React.ReactNode

  if (!promotionJobId) {
    // No promotion started yet
    content = isMerged ? (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
            Ready to promote
          </p>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
            Cherry-pick this fix to the production branch and open a review PR.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<GitMerge size={14} />}
          loading={isPromoting}
          onClick={onPromote}
        >
          Promote to main
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-sm text-[var(--color-fonts-font-color-support)]">
        <GitMerge size={14} className="shrink-0" />
        <span>Merge this PR into develop first, then promote to main.</span>
      </div>
    )
  } else if (!promotionJob || promotionJob.status === 'PENDING' || promotionJob.status === 'QUEUED' || promotionJob.status === 'RUNNING') {
    // Promotion in progress
    content = (
      <div className="flex items-center gap-2 text-sm text-[var(--color-fonts-font-color-support)]">
        <RefreshCw size={14} className="animate-spin shrink-0" />
        <span>Promotion in progress — cherry-picking commits to main…</span>
      </div>
    )
  } else if (promotionJob.status === 'AWAITING_APPROVAL') {
    content = (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-[var(--color-status-border-success)] shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
              Promotion PR created — awaiting review
            </p>
            {promotionJob.prUrl && (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                Branch: <span className="font-mono">{promotionJob.sourceBranch}</span>
                {' → '}
                <span className="font-mono">{promotionJob.targetBranch}</span>
              </p>
            )}
          </div>
        </div>
        {promotionJob.prUrl && (
          <a
            href={promotionJob.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors whitespace-nowrap"
          >
            <ExternalLink size={12} />
            Review PR
          </a>
        )}
      </div>
    )
  } else if (promotionJob.status === 'SUCCESS') {
    content = (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle size={14} className="text-[var(--color-status-border-success)] shrink-0" />
        <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
          Promoted — merged to main
        </span>
        {promotionJob.prUrl && (
          <a
            href={promotionJob.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline text-xs ml-1"
          >
            <ExternalLink size={11} />
            View PR
          </a>
        )}
      </div>
    )
  } else if (promotionJob.status === 'FAILED') {
    content = (
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-[var(--color-status-border-critical)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
              Promotion failed
            </p>
            {promotionJob.errorMessage && (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 max-w-md">
                {promotionJob.errorMessage}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="md"
          icon={<RefreshCw size={13} />}
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    )
  } else {
    content = null
  }

  if (!content) return null

  return (
    <div className="rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <GitMerge size={12} className="text-[var(--color-fonts-font-color-support)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
          Promote to main
        </span>
        {prEntry.soc2 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)] ml-1">
            <ShieldCheck size={10} />
            SOC II
          </span>
        )}
      </div>
      {content}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal fake JobStatusResponse so ChangedFilesTab can render
 * when there is no linked agent job (it only needs prUrl from the job).
 */
function buildFakeJob(prEntry: OpenPrEntry | undefined): import('@/types/api').JobStatusResponse {
  return {
    jobId: '',
    jobType: 'REVIEW',
    status: 'SUCCESS',
    createdAt: '',
    prUrl: prEntry?.prUrl ?? '',
    prId: prEntry?.prId ?? '',
  }
}
