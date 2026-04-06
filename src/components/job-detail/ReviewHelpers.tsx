import { useState, useMemo, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bot, CheckCheck, ChevronDown, ChevronUp, Flag, MessagesSquare,
  RefreshCw, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ReviewCommentEntry } from '@/types/api'

export interface FixedCommentInfo { fixJobId: string; commitSha?: string }

// ── FixPrButton ───────────────────────────────────────────────────────────────

export function FixPrButton({ pending, runningJobId, onClick }: {
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

// ── FixCommentButton ──────────────────────────────────────────────────────────

export function FixCommentButton({ isRunning, isPending, onClick }: {
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

// ── FixPrConfirmDialog ────────────────────────────────────────────────────────

export function FixPrConfirmDialog({
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
  const byFile = useMemo(() => {
    const map = new Map<string, number>()
    openComments.forEach(c => map.set(c.filePath, (map.get(c.filePath) ?? 0) + 1))
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [openComments])

  const commentCount = openComments.length
  const fileCount = byFile.length

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-[460px] max-h-[90vh] flex flex-col rounded-lg bg-[var(--color-cards-card-background)] shadow-xl">
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

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-3">
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

// ── ReviewCommentCard ─────────────────────────────────────────────────────────

export function ReviewCommentCard({
  comment, replies, onFix, isFixRunning, isFixPending, fixedInfo, onOpenCommit,
  onResolve, onFalsePositive, onChat, isResolvePending, isFalsePositivePending, optimisticallyResolved,
}: {
  comment: ReviewCommentEntry
  replies?: ReviewCommentEntry[]
  onFix?: () => void
  isFixRunning?: boolean
  isFixPending?: boolean
  fixedInfo?: FixedCommentInfo
  onOpenCommit?: (sha: string) => void
  onResolve?: () => void
  onFalsePositive?: () => void
  onChat?: () => void
  isResolvePending?: boolean
  isFalsePositivePending?: boolean
  optimisticallyResolved?: boolean
}) {
  const isResolved = optimisticallyResolved || !!comment.resolved
  const [expanded, setExpanded] = useState(!isResolved)
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
        {replies && replies.length > 0 && (
          <div className="border-t border-[var(--color-borders-border-primary)]/20">
            {replies.map((reply, ri) => (
              <div key={ri} className="flex gap-2 px-3 py-2.5 border-b border-[var(--color-borders-border-primary)]/10 last:border-b-0 bg-[var(--color-cards-card-background-hover)]/50">
                <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]">
                    <Bot size={10} />
                  </span>
                  {ri < replies.length - 1 && <span className="w-px flex-1 bg-[var(--color-borders-border-primary)]/30 min-h-[8px]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-[var(--color-fonts-font-color-support)]">Review Agent</span>
                  <div className="bot-comment-body text-xs mt-0.5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
                {onChat && (
                  <button onClick={onChat} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:bg-pink-500/15 hover:text-pink-500 transition-colors ml-auto">
                    <MessagesSquare size={10} /> Chat
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── InlineCommentRow ──────────────────────────────────────────────────────────

export function InlineCommentRow({
  comment, replies, lineType = 'ctx', onFix, isFixRunning, isFixPending, fixedInfo, onOpenCommit,
  commentRef, onResolve, onFalsePositive, onChat, isResolvePending, isFalsePositivePending, optimisticallyResolved,
}: {
  comment: ReviewCommentEntry
  replies?: ReviewCommentEntry[]
  lineType?: 'add' | 'del' | 'ctx'
  onFix?: () => void
  isFixRunning?: boolean
  isFixPending?: boolean
  fixedInfo?: { fixJobId: string; commitSha?: string }
  onOpenCommit?: (sha: string) => void
  commentRef?: (el: HTMLTableRowElement | null) => void
  onResolve?: () => void
  onFalsePositive?: () => void
  onChat?: () => void
  isResolvePending?: boolean
  isFalsePositivePending?: boolean
  optimisticallyResolved?: boolean
}) {
  const isResolved = optimisticallyResolved || !!comment.resolved
  const [expanded, setExpanded] = useState(!isResolved)

  const accentColor = isResolved
    ? 'var(--color-status-text-active)'
    : 'var(--color-tags-font-attention)'

  const gutterBg =
    lineType === 'add' ? 'bg-emerald-500/[0.22]' :
    lineType === 'del' ? 'bg-rose-500/[0.22]'    :
    'bg-[var(--color-tables-table-row-a)]'

  const rowBg =
    lineType === 'add' ? 'bg-emerald-500/[0.13]' :
    lineType === 'del' ? 'bg-rose-500/[0.13]'    :
    ''

  const isFixable = comment.line > 0 && comment.commentId > 0

  if (!expanded) {
    return (
      <tr ref={commentRef} className={rowBg}>
        <td colSpan={3} className={`${gutterBg} border-r border-[var(--color-borders-border-primary)]/30`} />
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

  return (
    <tr ref={commentRef} className={rowBg}>
      <td colSpan={3} className={`${gutterBg} border-r border-[var(--color-borders-border-primary)]/30 align-top pt-1.5`} />
      <td className="pl-1 pr-3 py-1.5 align-top">
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
          {replies && replies.length > 0 && (
            <div className="border-t border-[var(--color-borders-border-primary)]/20">
              {replies.map((reply, ri) => (
                <div key={ri} className="flex gap-2 px-3 py-2.5 border-b border-[var(--color-borders-border-primary)]/10 last:border-b-0 bg-[var(--color-cards-card-background-hover)]/50">
                  <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]">
                      <Bot size={10} />
                    </span>
                    {ri < replies.length - 1 && <span className="w-px flex-1 bg-[var(--color-borders-border-primary)]/30 min-h-[8px]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold text-[var(--color-fonts-font-color-support)]">Review Agent</span>
                    <div className="bot-comment-body text-xs mt-0.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  {onChat && (
                    <button onClick={onChat} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-fonts-font-color-support)] hover:bg-pink-500/15 hover:text-pink-500 transition-colors ml-auto">
                      <MessagesSquare size={10} /> Chat
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}
