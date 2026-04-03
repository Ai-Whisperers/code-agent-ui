import { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle, Fragment } from 'react'
import {
  ChevronDown, ChevronRight, FolderOpen, Folder, FileCode, MessageSquare, Bot,
} from 'lucide-react'
import type { MutableRefObject } from 'react'
import type { DiffFileEntry, ReviewCommentEntry } from '@/types/api'
import { languageFromFilename, DiffLineRow, HunkHeaderRow } from './CodeBlock'
import { InlineCommentRow, FixCommentButton, type FixedCommentInfo } from './ReviewHelpers'

// ── FileDiffSectionHandle ─────────────────────────────────────────────────────

export interface FileDiffSectionHandle {
  expand: () => void
  scrollIntoView: (options?: ScrollIntoViewOptions) => void
}

// ── FileDiffSection ───────────────────────────────────────────────────────────

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
  onChatComment?: (comment: ReviewCommentEntry) => void
  resolvedCommentIds?: Set<number>
  resolveCommentPendingId?: number
  falsePositivePendingId?: number
}

export const FileDiffSection = forwardRef<FileDiffSectionHandle, FileDiffSectionProps>(
  function FileDiffSection({
    file, viewed, onToggleViewed, fileComments = [],
    onFixComment, fixCommentJobIds = {}, fixedCommentInfo = {}, fixCommentPendingId, onOpenCommit,
    initialCollapsed = false, expandCollapseSeq = 0, expandCollapseTarget,
    commentRefs, onResolveComment, onFalsePositive, onChatComment,
    resolvedCommentIds = new Set(), resolveCommentPendingId, falsePositivePendingId,
  }, ref) {
    const rootFileComments = useMemo(() => fileComments.filter(c => !c.parentId), [fileComments])
    const repliesByParentId = useMemo(() => {
      const map: Record<number, ReviewCommentEntry[]> = {}
      fileComments.filter(c => c.parentId).forEach(c => { (map[c.parentId!] ??= []).push(c) })
      return map
    }, [fileComments])

    const commentsByLine = useMemo(() => {
      const map: Record<number, ReviewCommentEntry[]> = {}
      rootFileComments.forEach(c => { if (c.line > 0) (map[c.line] ??= []).push(c) })
      return map
    }, [rootFileComments])

    const renderedLines = useMemo(() => {
      const lines = new Set<number>()
      file.hunks.forEach(h => h.lines.forEach(l => {
        if (l.newLine > 0) lines.add(l.newLine)
        if (l.oldLine > 0) lines.add(l.oldLine)
      }))
      return lines
    }, [file.hunks])

    const orphanComments = useMemo(
      () => rootFileComments.filter(c => c.line === 0 || !renderedLines.has(c.line)),
      [rootFileComments, renderedLines]
    )

    const [collapsed, setCollapsed] = useState(initialCollapsed)
    const divRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      expand: () => setCollapsed(false),
      scrollIntoView: (options) => divRef.current?.scrollIntoView(options),
    }))

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
        <div
          className="flex items-stretch sticky top-0 z-10 bg-[var(--color-cards-card-background)] border-b border-[var(--color-tables-table-header-stroke)] cursor-pointer"
          onClick={() => setCollapsed((v) => !v)}
        >
          <div className={`w-[3px] shrink-0 ${statusAccentBg}`} />
          <div className="flex items-center gap-2 flex-1 px-3 py-2 min-w-0">
            <FileCode size={13} className={`shrink-0 ${statusIconColor}`} />
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
            {fileComments.length > 0 && (
              <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <MessageSquare size={8} />
                {fileComments.length}
              </span>
            )}
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
                              replies={repliesByParentId[c.commentId]}
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
                              onChat={onChatComment && c.commentId > 0
                                ? () => onChatComment(c) : undefined}
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

// ── FileTreePanel ─────────────────────────────────────────────────────────────

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

export function FileTreePanel({ files, totalAdditions, totalDeletions, viewedFiles, onFileClick, commentsByFile = {} }: FileTreePanelProps) {
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
      <div className="shrink-0 px-3 py-2 border-b border-[var(--color-tables-table-header-stroke)] flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)]">
          Lines updated
        </span>
        <span className="ml-auto text-[11px] font-semibold">
          <span className="text-emerald-400">+{totalAdditions}</span>
          {totalDeletions > 0 && <span className="text-rose-400 ml-1">−{totalDeletions}</span>}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {Array.from(tree.entries()).map(([dir, dirFiles]) => (
          <div key={dir}>
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
