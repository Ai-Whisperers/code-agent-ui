import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ExternalLink, GitPullRequest, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { Input } from '@/components/ui/Input'
import { FilterSelect } from '@/components/ui/FilterSelect'
import type { FilterSelectOption } from '@/components/ui/FilterSelect'
import { TabBar, TabButton } from '@/components/ui/Tabs'
import { JobStatusBadge } from './Dashboard'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import api from '@/lib/api'
import { getUserInfo } from '@/lib/keycloak'
import type { OpenPrEntry, PrListResponse, JobStatusResponse } from '@/types/api'

type PrTab = 'needs-approval' | 'all'

const PAGE_SIZE = 50

const STATUS_OPTIONS: FilterSelectOption[] = [
  { value: 'OPEN',     label: 'Open',     dotClass: 'bg-[var(--color-status-border-success)]' },
  { value: 'MERGED',   label: 'Merged',   dotClass: 'bg-[var(--color-status-border-neutral)]' },
  { value: 'DECLINED', label: 'Declined', dotClass: 'bg-[var(--color-status-border-critical)]' },
  { value: 'ALL',      label: 'All',      dotClass: 'bg-[var(--color-tags-neutral-background)]' },
]

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

interface PaginatorProps {
  page: number
  total: number
  size: number
  fetching: boolean
  onPrev: () => void
  onNext: () => void
}

function Paginator({ page, total, size, fetching, onPrev, onNext }: PaginatorProps) {
  const totalPages = Math.max(1, Math.ceil(total / size))
  const btnBase =
    'px-3 py-1 text-xs rounded border border-[var(--color-cards-card-stroke)] ' +
    'bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-headings)] ' +
    'disabled:opacity-40 hover:bg-[var(--color-tables-table-hover)] transition-colors'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--color-fonts-font-color-support)] mr-1">
        {fetching ? 'Loading…' : `Page ${page + 1} of ${totalPages} (${total} total)`}
      </span>
      <button onClick={onPrev} disabled={page === 0 || fetching} className={btnBase}>
        ← Prev
      </button>
      <button onClick={onNext} disabled={page >= totalPages - 1 || fetching} className={btnBase}>
        Next →
      </button>
    </div>
  )
}

export default function PullRequests() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<PrTab>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isAdmin = getUserInfo()?.roles.includes('app_admin') ?? false

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput)
      setPage(0)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const handleStatusChange = (v: string) => { setStatusFilter(v); setPage(0) }

  const { data, isFetching, refetch } = useQuery<PrListResponse>({
    queryKey: ['pull-requests', search, statusFilter, page],
    queryFn: () =>
      api.get('/pull-requests', {
        params: {
          q: search || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          page,
          size: PAGE_SIZE,
        },
      }).then(r => r.data),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })

  const prs = data?.items ?? []
  const total = data?.total ?? 0

  const { data: approvalJobs = [] } = useQuery<JobStatusResponse[]>({
    queryKey: ['jobs-awaiting-approval'],
    queryFn: () => api.get('/jobs', { params: { status: 'AWAITING_APPROVAL', limit: 200 } }).then(r => r.data),
    refetchInterval: 30_000,
  })

  const awaitingJobIds = new Set(approvalJobs.map(j => j.jobId))
  const needsApproval = prs.filter(pr => pr.jobId && awaitingJobIds.has(pr.jobId))
  const displayed = activeTab === 'needs-approval' ? needsApproval : prs

  const syncMutation = useMutation({
    mutationFn: () => api.post('/pull-requests/sync'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pull-requests'] })
      setToast({ variant: 'success', message: `Sync complete — ${res.data.synced ?? 0} PRs cached.` })
    },
    onError: () => setToast({ variant: 'error', message: 'Sync failed.' }),
  })

  const handleRowClick = (pr: OpenPrEntry) => {
    navigate({
      to: '/pull-requests/$workspace/$repoSlug/$prId',
      params: { workspace: pr.workspace, repoSlug: pr.repoSlug, prId: pr.prId },
    })
  }

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Pull Requests"
        subtitle="Open pull requests across all active repositories."
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search title, author, repo…"
              className="w-52"
            />
            <FilterSelect
              value={statusFilter}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS}
              placeholder="Status"
              className="w-32"
            />
            <Tooltip text="Refresh pull requests">
              <Button
                variant="ghost"
                size="md"
                icon={<RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />}
                onClick={() => refetch()}
              />
            </Tooltip>
            {isAdmin && (
              <Tooltip text="Force full sync from SCM">
                <Button
                  variant="ghost"
                  size="md"
                  icon={<RotateCcw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />}
                  loading={syncMutation.isPending}
                  onClick={() => syncMutation.mutate()}
                >
                  Sync
                </Button>
              </Tooltip>
            )}
          </div>
        }
      />

      <div className="flex flex-col flex-1 min-h-0 space-y-3">
        <div className="flex items-center justify-between">
          <TabBar>
            <TabButton
              active={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
              badge={total > 0 ? String(total) : undefined}
            >
              All PRs
            </TabButton>
            <TabButton
              active={activeTab === 'needs-approval'}
              onClick={() => setActiveTab('needs-approval')}
              badge={needsApproval.length > 0 ? String(needsApproval.length) : undefined}
            >
              Needs Approval
            </TabButton>
          </TabBar>

          {total > PAGE_SIZE && (
            <Paginator
              page={page}
              total={total}
              size={PAGE_SIZE}
              fetching={isFetching}
              onPrev={() => setPage(p => Math.max(0, p - 1))}
              onNext={() => setPage(p => p + 1)}
            />
          )}
        </div>

        <TableCard className="flex-1 min-h-0" title="">
          <div className={isFetching ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
                  {([
                    { label: 'Repository', tip: 'Workspace and repository slug' },
                    { label: 'Title',      tip: 'Pull request title' },
                    { label: 'PR',         tip: 'Link to the pull request in the SCM' },
                    { label: 'Branches',   tip: 'Source → target branch' },
                    { label: 'Author',     tip: 'Pull request author' },
                    { label: 'Status',     tip: 'PR status' },
                    { label: 'Updated',    tip: 'Last updated time' },
                    { label: 'Job',        tip: 'Linked agent job status' },
                    { label: '',           tip: 'SOC II compliance badge' },
                  ] as const).map(({ label, tip }) => (
                    <th
                      key={label}
                      className="bg-[var(--color-cards-card-background)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                    >
                      <Tooltip text={tip} position="bottom">{label}</Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isFetching && displayed.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                        <td colSpan={9} className="px-3 py-1.5">
                          <div className="h-4 skeleton-shimmer rounded" />
                        </td>
                      </tr>
                    ))
                  : displayed.length === 0
                  ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[var(--color-fonts-font-color-support)]">
                        {activeTab === 'needs-approval'
                          ? 'No pull requests awaiting approval.'
                          : 'No pull requests found.'}
                      </td>
                    </tr>
                  )
                  : displayed.map((pr, i) => (
                    <PrRow
                      key={`${pr.workspace}/${pr.repoSlug}/${pr.prId}`}
                      pr={pr}
                      isEven={i % 2 === 0}
                      linkedJobStatus={pr.jobId
                        ? approvalJobs.find(j => j.jobId === pr.jobId)?.status
                        : undefined}
                      onClick={() => handleRowClick(pr)}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </TableCard>

        {total > PAGE_SIZE && (
          <div className="flex justify-end">
            <Paginator
              page={page}
              total={total}
              size={PAGE_SIZE}
              fetching={isFetching}
              onPrev={() => setPage(p => Math.max(0, p - 1))}
              onNext={() => setPage(p => p + 1)}
            />
          </div>
        )}
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </main>
  )
}

interface PrRowProps {
  pr: OpenPrEntry
  isEven: boolean
  linkedJobStatus?: string
  onClick: () => void
}

function Soc2Badge() {
  return (
    <Tooltip text="SOC II applicable — linked to a security bug fix">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
        <ShieldCheck size={10} />
        SOC II
      </span>
    </Tooltip>
  )
}

function PrStatusBadge({ status }: { status: string }) {
  const s = (status ?? 'OPEN').toUpperCase()
  const styles: Record<string, string> = {
    OPEN:     'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    MERGED:   'bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]',
    DECLINED: 'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]',
  }
  const cls = styles[s] ?? styles['OPEN']
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  )
}

function PrRow({ pr, isEven, linkedJobStatus, onClick }: PrRowProps) {
  return (
    <tr
      className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
        isEven ? 'bg-[var(--color-tables-table-row-a)]' : ''
      }`}
      onClick={onClick}
    >
      {/* Repository */}
      <td className="px-3 py-1.5 font-mono text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
        <span className="flex items-center gap-1">
          <GitPullRequest size={11} className="shrink-0" />
          {pr.workspace}/{pr.repoSlug}
        </span>
      </td>

      {/* Title */}
      <td className="px-3 py-1.5 max-w-[260px]">
        <span className="block truncate font-medium text-[var(--color-fonts-font-color-primary)]">
          {pr.title}
        </span>
      </td>

      {/* PR link */}
      <td className="px-3 py-1.5" onClick={e => e.stopPropagation()}>
        <a
          href={pr.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline whitespace-nowrap"
        >
          <ExternalLink size={11} />
          #{pr.prId}
        </a>
      </td>

      {/* Branches */}
      <td className="px-3 py-1.5 whitespace-nowrap text-[var(--color-fonts-font-color-support)]">
        <span className="font-mono text-[11px]">{pr.sourceBranch}</span>
        <span className="mx-1 text-[var(--color-fonts-font-color-support)]">→</span>
        <span className="font-mono text-[11px]">{pr.targetBranch}</span>
      </td>

      {/* Author */}
      <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
        {pr.author}
      </td>

      {/* PR Status */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        <PrStatusBadge status={pr.status} />
      </td>

      {/* Updated */}
      <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
        {pr.updatedOn ? <RelativeTime dateStr={pr.updatedOn} /> : '—'}
      </td>

      {/* Job status */}
      <td className="px-3 py-1.5">
        {linkedJobStatus
          ? <JobStatusBadge status={linkedJobStatus as import('@/types/api').JobStatus} />
          : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
      </td>

      {/* SOC II badge */}
      <td className="px-3 py-1.5 whitespace-nowrap">
        {pr.soc2 && <Soc2Badge />}
      </td>
    </tr>
  )
}
