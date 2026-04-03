import { useState, useCallback, useRef, useMemo } from 'react'
import { ChevronDown, ChevronRight, ChevronLeft, MessageSquare, ArrowRight, GitCompare } from 'lucide-react'
import type { JobStatusResponse, JobDiffResponse, ReviewCommentEntry } from '@/types/api'
import { FileDiffSection, FileTreePanel, type FileDiffSectionHandle } from './FileDiffSection'
import { FixPrButton, type FixedCommentInfo } from './ReviewHelpers'

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
  onChatComment?: (comment: ReviewCommentEntry) => void
  resolvedCommentIds?: Set<number>
  resolveCommentPendingId?: number
  falsePositivePendingId?: number
}

export function ChangedFilesTab({
  job, diffData, isLoading, isError, reviewComments = [],
  fixPrPending, fixPrJobId, onFixPr,
  fixCommentJobIds = {}, fixedCommentInfo = {}, onFixComment, fixCommentPendingId, onOpenCommit,
  onResolveComment, onFalsePositive, onChatComment, resolvedCommentIds = new Set(),
  resolveCommentPendingId, falsePositivePendingId,
}: ChangedFilesTabProps) {
  const commentsByFile = useMemo(() => {
    const map: Record<string, ReviewCommentEntry[]> = {}
    reviewComments.forEach(c => { (map[c.filePath] ??= []).push(c) })
    return map
  }, [reviewComments])

  const allComments = useMemo(() => {
    const rootComments = reviewComments.filter(c => c.commentId > 0 && !c.parentId)
    if (!diffData) return rootComments
    const fileOrder: Record<string, number> = {}
    diffData.files.forEach((f, i) => { fileOrder[f.filename] = i })
    return [...rootComments].sort((a, b) => {
      const fa = fileOrder[a.filePath] ?? 999
      const fb = fileOrder[b.filePath] ?? 999
      return fa !== fb ? fa - fb : a.line - b.line
    })
  }, [reviewComments, diffData])

  const [activeCommentIdx, setActiveCommentIdx] = useState(0)
  const commentRefs = useRef<Record<number, HTMLTableRowElement | null>>({})
  const fileRefs = useRef<Record<string, FileDiffSectionHandle | null>>({})
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set())
  const [expandCollapseSeq, setExpandCollapseSeq] = useState(0)
  const [expandCollapseTarget, setExpandCollapseTarget] = useState(false)

  const initialCollapsed = (diffData?.files.length ?? 0) > 5

  const scrollToComment = useCallback((idx: number) => {
    const comment = allComments[idx]
    if (!comment) return
    const handle = fileRefs.current[comment.filePath]
    if (handle) {
      handle.expand()
      requestAnimationFrame(() => {
        commentRefs.current[comment.commentId]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    } else {
      commentRefs.current[comment.commentId]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
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

  const toggleViewed = useCallback((filename: string) =>
    setViewedFiles((prev) => {
      const next = new Set(prev)
      next.has(filename) ? next.delete(filename) : next.add(filename)
      return next
    }), [])

  const scrollTo = useCallback((filename: string) => {
    const handle = fileRefs.current[filename]
    if (!handle) return
    handle.expand()
    requestAnimationFrame(() => {
      const fileCommentList = commentsByFile[filename] ?? []
      if (fileCommentList.length > 0) {
        const sorted = [...fileCommentList].sort((a, b) => a.line - b.line)
        for (const c of sorted) {
          const el = commentRefs.current[c.commentId]
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
          }
        }
      }
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

  const sourceBranch = diffData?.sourceBranch || job.sourceBranch || ''
  const targetBranch = diffData?.targetBranch || job.targetBranch || ''

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
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

      {isError && (
        <div className="px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-status-border-critical)] bg-[var(--color-status-critical-background)] text-xs text-[var(--color-tags-font-critical)]">
          Could not load diff from the SCM. The platform may not support on-demand diff retrieval.
        </div>
      )}

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

      {!isLoading && diffData && diffData.files.length > 0 && (
        <div className="flex flex-1 min-h-0 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
          <FileTreePanel
            files={diffData.files}
            totalAdditions={diffData.totalAdditions}
            totalDeletions={diffData.totalDeletions}
            viewedFiles={viewedFiles}
            onFileClick={scrollTo}
            commentsByFile={commentsByFile}
          />
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
                onChatComment={onChatComment}
                resolvedCommentIds={resolvedCommentIds}
                resolveCommentPendingId={resolveCommentPendingId}
                falsePositivePendingId={falsePositivePendingId}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && diffData && diffData.files.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--color-fonts-font-color-support)] text-sm">
          No changed files found in the diff.
        </div>
      )}
    </div>
  )
}
