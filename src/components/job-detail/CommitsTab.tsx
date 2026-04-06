import { RefreshCw, ChevronRight, XCircle } from 'lucide-react'
import type { PrCommitEntry, JobDiffResponse } from '@/types/api'
import { FileDiffSection } from './FileDiffSection'

export function RelativeTime({ dateStr }: { dateStr: string }) {
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

interface CommitsTabProps {
  commits: PrCommitEntry[]
  isLoading: boolean
  onCommitClick: (sha: string) => void
}

export function CommitsTab({ commits, isLoading, onCommitClick }: CommitsTabProps) {
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
            <span className="shrink-0 mt-0.5 font-mono text-[11px] font-semibold text-[var(--color-fonts-font-color-brand)] bg-[var(--color-tags-neutral-background)] px-1.5 py-0.5 rounded">
              {commit.shortSha}
            </span>
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
            <ChevronRight size={14} className="shrink-0 mt-0.5 text-[var(--color-fonts-font-color-support)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  )
}

interface CommitDiffDialogProps {
  commit: PrCommitEntry | null
  diffData: JobDiffResponse | undefined
  isLoading: boolean
  onClose: () => void
}

export function CommitDiffDialog({ commit, diffData, isLoading, onClose }: CommitDiffDialogProps) {
  if (!commit) return null

  const firstLine = commit.message.split('\n')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] shadow-xl flex flex-col max-h-[80vh]">
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
