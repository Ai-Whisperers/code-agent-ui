import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RefreshCw, ExternalLink, Eye, Clock } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { TableCard } from '@/components/ui/TableCard'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import type { JobReviewResponse, ReviewCommentEntry } from '@/types/api'
import { ReviewCommentCard, FixPrButton, type FixedCommentInfo } from './ReviewHelpers'

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
  onChatComment?: (comment: ReviewCommentEntry) => void
  resolvedCommentIds?: Set<number>
  resolveCommentPendingId?: number
  falsePositivePendingId?: number
}

export function ReviewTab({
  reviewData, isLoading, requestReviewPending, onRequestReview,
  fixPrPending, fixPrJobId, onFixPr,
  fixCommentJobIds = {}, fixedCommentInfo = {}, onFixComment, fixCommentPendingId, onOpenCommit,
  onResolveComment, onFalsePositive, onChatComment, resolvedCommentIds = new Set(),
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

  const allFileComments = (reviewData.comments ?? []).filter(c => c.filePath && c.filePath.trim() !== '')
  const comments = allFileComments.filter(c => !c.parentId)
  const repliesByParentId: Record<number, ReviewCommentEntry[]> = {}
  allFileComments.filter(c => c.parentId).forEach(c => {
    (repliesByParentId[c.parentId!] ??= []).push(c)
  })
  const commentsByFile: Record<string, ReviewCommentEntry[]> = {}
  comments.forEach(c => { (commentsByFile[c.filePath] ??= []).push(c) })

  return (
    <div className="space-y-3">
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

      {reviewData.reviewSummary && (
        <TableCard title="Summary">
          <div className="px-4 py-4 bot-comment-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reviewData.reviewSummary.replace(/<!--[\s\S]*?-->/g, '')}</ReactMarkdown>
          </div>
        </TableCard>
      )}

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
                replies={repliesByParentId[c.commentId]}
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
                onChat={onChatComment && c.commentId > 0
                  ? () => onChatComment(c) : undefined}
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
