import { useState, useCallback, useRef, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle, RefreshCw, Ban, RotateCcw, Eye,
  GitBranch, ArrowRight, ChevronDown, ChevronRight,
  FolderOpen, Folder,
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
  JobDiffResponse, DiffFileEntry,
} from '@/types/api'

interface JobDetailProps {
  jobId: string
}

const ACTIVE_STATUSES = new Set(['RUNNING', 'PENDING', 'QUEUED'])

type Tab = 'summary' | 'ai-calls' | 'changed-files'

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
                active={activeTab === 'changed-files'}
                onClick={() => setActiveTab('changed-files')}
                badge={totalFiles > 0 ? String(totalFiles) : undefined}
              >
                Changed Files
              </TabButton>
            )}
          </div>

          {/* Summary tab */}
          {activeTab === 'summary' && (
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

          {/* Changed Files tab */}
          {hasPr && activeTab === 'changed-files' && (
            <ChangedFilesTab
              job={job}
              diffData={diffData}
              isLoading={diffLoading}
              isError={diffError}
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

interface ChangedFilesTabProps {
  job: JobStatusResponse
  diffData: JobDiffResponse | undefined
  isLoading: boolean
  isError: boolean
}

function ChangedFilesTab({ job, diffData, isLoading, isError }: ChangedFilesTabProps) {
  const sourceBranch = diffData?.sourceBranch || job.sourceBranch || ''
  const targetBranch = diffData?.targetBranch || job.targetBranch || ''
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set())

  const toggleViewed = (filename: string) =>
    setViewedFiles((prev) => {
      const next = new Set(prev)
      next.has(filename) ? next.delete(filename) : next.add(filename)
      return next
    })

  const scrollTo = (filename: string) => {
    fileRefs.current[filename]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Branch context bar */}
      {(sourceBranch || targetBranch) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--border-radius-card)] border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] text-xs shrink-0">
          <GitBranch size={12} className="shrink-0 text-[var(--color-fonts-font-color-support)]" />
          <span className="font-mono font-medium text-[var(--color-fonts-font-color-primary)]">{sourceBranch || '—'}</span>
          <ArrowRight size={11} className="shrink-0 text-[var(--color-fonts-font-color-support)]" />
          <span className="font-mono font-medium text-[var(--color-fonts-font-color-primary)]">{targetBranch || '—'}</span>
          {diffData && (
            <span className="ml-auto flex items-center gap-2 shrink-0">
              <span className="text-[var(--color-fonts-font-color-support)]">
                {diffData.files.length} file{diffData.files.length !== 1 ? 's' : ''}
              </span>
              <span className="text-emerald-400 font-semibold">+{diffData.totalAdditions}</span>
              <span className="text-rose-400 font-semibold">−{diffData.totalDeletions}</span>
            </span>
          )}
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
          />
          {/* Right: diff content */}
          <div className="flex-1 overflow-auto bg-[var(--color-cards-card-background)]">
            {diffData.files.map((file) => (
              <FileDiffSection
                key={file.filename}
                file={file}
                viewed={viewedFiles.has(file.filename)}
                onToggleViewed={() => toggleViewed(file.filename)}
                ref={(el) => { fileRefs.current[file.filename] = el }}
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

function FileTreePanel({ files, totalAdditions, totalDeletions, viewedFiles, onFileClick }: FileTreePanelProps) {
  const tree = buildTree(files)
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

interface FileDiffSectionProps {
  file: DiffFileEntry
  viewed: boolean
  onToggleViewed: () => void
}

const FileDiffSection = forwardRef<HTMLDivElement, FileDiffSectionProps>(
  function FileDiffSection({ file, viewed, onToggleViewed }, ref) {
    const [collapsed, setCollapsed] = useState(false)
    const parts = file.filename.split('/')
    const filename = parts.pop() ?? file.filename
    const dirParts = parts

    const breadcrumb = dirParts.length > 4
      ? [...dirParts.slice(0, 1), '…', ...dirParts.slice(-1), filename]
      : [...dirParts, filename]

    return (
      <div ref={ref} className="border-b border-[var(--color-cards-card-stroke)] last:border-b-0">
        {/* File header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-cards-card-background)] border-b border-[var(--color-tables-table-header-stroke)] sticky top-0 z-10">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="shrink-0 text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

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

          {/* Stats */}
          <span className="shrink-0 text-[11px] font-semibold flex items-center gap-1">
            <span className="text-emerald-400">+{file.additions}</span>
            {file.deletions > 0 && <span className="text-rose-400">−{file.deletions}</span>}
          </span>

          {/* Viewed toggle */}
          <label className="shrink-0 flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={viewed}
              onChange={onToggleViewed}
              className="rounded border-[var(--color-borders-border-primary)] accent-[var(--color-fonts-font-color-brand)]"
            />
            <span className="text-[11px] text-[var(--color-fonts-font-color-support)]">Viewed</span>
          </label>
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
                    {hunk.lines.map((line, li) => (
                      <DiffLineRow
                        key={li}
                        type={line.type}
                        oldLine={line.oldLine}
                        newLine={line.newLine}
                        content={line.content}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
)

function HunkHeaderRow({ header }: { header: string }) {
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
}

function DiffLineRow({ type, oldLine, newLine, content }: {
  type: 'add' | 'del' | 'ctx'
  oldLine: number
  newLine: number
  content: string
}) {
  // Use bright-base colours at low opacity so the tint is visible in both light and dark themes.
  // emerald-500 (#10b981) and rose-500 (#f43f5e) produce a clear tint at 12–15 % opacity.
  const rowBg =
    type === 'add' ? 'bg-emerald-500/[0.13]' :
    type === 'del' ? 'bg-rose-500/[0.13]'    :
    'hover:bg-[var(--color-tables-table-hover)]'

  // Gutter cells (line-number + prefix) use a slightly denser tint for depth.
  const gutterBg =
    type === 'add' ? 'bg-emerald-500/[0.22]' :
    type === 'del' ? 'bg-rose-500/[0.22]'    :
    'bg-[var(--color-tables-table-row-a)]'

  const prefixColor =
    type === 'add' ? 'text-emerald-400' :
    type === 'del' ? 'text-rose-400'    :
    'text-[var(--color-fonts-font-color-support)] opacity-30'

  const prefix = type === 'add' ? '+' : type === 'del' ? '−' : ' '

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
      {/* +/− prefix */}
      <td className={`${gutterBg} w-5 px-1 py-px text-center select-none leading-5 font-bold border-r border-[var(--color-borders-border-primary)] ${prefixColor}`}>
        {prefix !== ' ' ? prefix : ''}
      </td>
      {/* Code content */}
      <td className="px-3 py-px leading-5 whitespace-pre text-[13px] text-[var(--color-fonts-font-color-primary)]">
        {content}
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
