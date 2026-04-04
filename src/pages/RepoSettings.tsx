import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Save, X, RefreshCw, CheckCircle, XCircle, Search, Plus, ChevronLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Toast } from '@/components/ui/Toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { ChipInput } from '@/components/ui/ChipInput'
import { JiraComponentPicker } from '@/components/repo-settings/JiraComponentPicker'
import api from '@/lib/api'
import type { RepoSettings, CodeGraphStatus } from '@/types/api'

// ── Git platform helpers (shared with AddRepoDialog) ─────────────────────────

const BITBUCKET_BASE_URL = import.meta.env.VITE_BITBUCKET_URL ?? 'https://bitbucket.org'

type GitPlatform = 'bitbucket' | 'gitlab' | 'github' | 'azuredevops'

const PLATFORM_LABEL: Record<GitPlatform, string> = {
  bitbucket:   'Bitbucket',
  gitlab:      'GitLab',
  github:      'GitHub',
  azuredevops: 'Azure DevOps',
}

const PLATFORM_DEFAULT_URL: Record<GitPlatform, string> = {
  bitbucket:   BITBUCKET_BASE_URL,
  gitlab:      'https://gitlab.com',
  github:      'https://github.com',
  azuredevops: 'https://dev.azure.com',
}

const PLATFORM_COLORS: Record<GitPlatform, string> = {
  bitbucket:   'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20',
  gitlab:      'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20',
  github:      'border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background-hover)]',
  azuredevops: 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20',
}

const PLATFORM_ICON_COLORS: Record<GitPlatform, string> = {
  bitbucket:   'text-blue-600 dark:text-blue-400',
  gitlab:      'text-orange-600 dark:text-orange-400',
  github:      'text-[var(--color-fonts-font-color-primary)]',
  azuredevops: 'text-sky-600 dark:text-sky-400',
}

function detectPlatform(url: string | undefined): GitPlatform {
  if (!url) return 'bitbucket'
  const lower = url.toLowerCase()
  if (lower.includes('gitlab'))    return 'gitlab'
  if (lower.includes('github'))    return 'github'
  if (lower.includes('dev.azure') || lower.includes('visualstudio.com') || lower.includes('azure')) return 'azuredevops'
  return 'bitbucket'
}

function PlatformSvgIcon({ platform, size = 24 }: { platform: GitPlatform; size?: number }) {
  const s = size
  if (platform === 'bitbucket') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
        <path d="M2.07 5.26A1.5 1.5 0 0 0 .58 6.97l4.35 19.5a1.5 1.5 0 0 0 1.47 1.2h19.2a1.5 1.5 0 0 0 1.47-1.2l4.35-19.5a1.5 1.5 0 0 0-1.49-1.71H2.07zm19.56 13.5h-11.3l-1.5-7.5h14.3l-1.5 7.5z"/>
      </svg>
    )
  }
  if (platform === 'gitlab') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
        <path d="M16 29.2 6.1 18.4l-5-15.3 4.9 15.3H16zm0 0 9.9-10.8 5-15.3-4.9 15.3H16zm-9.9-10.8L16 29.2l-9.9-10.8zm19.8 0L16 29.2l9.9-10.8zM1.1 3.1 6.1 18.4 1.1 3.1zm29.8 0-5 15.3 5-15.3zM16 3.1l-4.9 15.3H16V3.1zm0 0v15.3h4.9L16 3.1z"/>
      </svg>
    )
  }
  if (platform === 'github') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
        <path d="M16 2C8.27 2 2 8.27 2 16c0 6.19 4.01 11.44 9.57 13.29.7.13.96-.3.96-.67v-2.35c-3.9.85-4.72-1.88-4.72-1.88-.64-1.62-1.56-2.05-1.56-2.05-1.27-.87.1-.85.1-.85 1.41.1 2.15 1.45 2.15 1.45 1.25 2.14 3.28 1.52 4.08 1.16.13-.9.49-1.52.89-1.87-3.11-.35-6.38-1.56-6.38-6.93 0-1.53.55-2.78 1.44-3.76-.14-.35-.62-1.78.14-3.71 0 0 1.18-.38 3.85 1.44A13.4 13.4 0 0 1 16 9.18c1.19.01 2.39.16 3.51.47 2.67-1.82 3.85-1.44 3.85-1.44.76 1.93.28 3.36.14 3.71.9.98 1.44 2.23 1.44 3.76 0 5.38-3.28 6.57-6.4 6.92.5.43.95 1.29.95 2.6v3.85c0 .37.25.81.96.67C25.99 27.44 30 22.19 30 16 30 8.27 23.73 2 16 2z"/>
      </svg>
    )
  }
  // azuredevops
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M29.6 8.4 22.4 2v5.6L10.4 11 4 8.4V24l6.4 2.4 12-4.8v5.6l7.2-6.4V8.4zM10.4 22.4l-3.2-1.6V11.2l3.2 1.6v9.6zm9.6-2.4-9.6 3.2v-9.6l9.6-3.2v9.6z"/>
    </svg>
  )
}

export default function RepoSettingsPage() {
  const qc = useQueryClient()
  const [editRepo, setEditRepo] = useState<RepoSettings | null>(null)
  const [showAddRepo, setShowAddRepo] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [rebuildAllStatus, setRebuildAllStatus] = useState<'idle' | 'pending' | 'accepted' | 'error'>('idle')
  const [rebuildProgress, setRebuildProgress] = useState<Record<string, 'pending' | 'accepted' | 'error'>>({})
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const clearRebuildProgress = () => {
    setRebuildProgress({})
    setRebuildAllStatus('idle')
  }

  const { data: repos, isLoading, isFetching } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const { data: graphStatuses } = useQuery<CodeGraphStatus[]>({
    queryKey: ['graph-status'],
    queryFn: () => api.get('/graph/status').then((r) => r.data).catch(() => []),
  })

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['repos'] })
    qc.invalidateQueries({ queryKey: ['graph-status'] })
  }

  const handleRebuildAll = async () => {
    const activeRepos = (Array.isArray(repos) ? repos : []).filter((r) => !r.archived)
    if (activeRepos.length === 0) return

    const initial: Record<string, 'pending' | 'accepted' | 'error'> = {}
    activeRepos.forEach((r) => { initial[`${r.workspace}/${r.repoSlug}`] = 'pending' })
    setRebuildProgress(initial)
    setRebuildAllStatus('pending')

    const results = await Promise.allSettled(
      activeRepos.map(async (r) => {
        const key = `${r.workspace}/${r.repoSlug}`
        try {
          await api.post(`/graph/rebuild/${r.workspace}/${r.repoSlug}`)
          setRebuildProgress((prev) => ({ ...prev, [key]: 'accepted' }))
        } catch {
          setRebuildProgress((prev) => ({ ...prev, [key]: 'error' }))
          throw key
        }
      }),
    )

    const hasError = results.some((r) => r.status === 'rejected')
    setRebuildAllStatus(hasError ? 'error' : 'accepted')
    qc.invalidateQueries({ queryKey: ['graph-status'] })
  }

  const saveMutation = useMutation({
    mutationFn: (repo: RepoSettings) =>
      api.put(`/settings/repos/${repo.workspace}/${repo.repoSlug}`, repo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repos'] })
      setEditRepo(null)
      setToast({ message: 'Repository settings saved.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to save repository settings.', variant: 'error' }),
  })

  const graphStatusMap = new Map(
    (Array.isArray(graphStatuses) ? graphStatuses : []).map((s) => [
      `${s.workspace}/${s.repoSlug}`,
      s,
    ]),
  )

  const all = Array.isArray(repos) ? repos : []
  const list = showArchived ? all : all.filter((r) => !r.archived)

  return (
    <main>
      <PageHeader
        title="Repository Settings"
        subtitle="Manage per-repository configuration."
        actions={
          <div className="flex items-center gap-3">
            <Tooltip text="Manually register a repository from any git platform">
              <Button
                size="md"
                variant="primary"
                icon={<Plus size={13} />}
                onClick={() => setShowAddRepo(true)}
              >
                Add Repository
              </Button>
            </Tooltip>
            <Tooltip text="Reload repository list and code graph status">
              <Button
                size="md"
                variant="secondary"
                icon={<RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />}
                onClick={handleRefresh}
                disabled={isFetching}
              >
                Refresh
              </Button>
            </Tooltip>
            <Tooltip text="Trigger code graph rebuild for all active repositories">
              <Button
                size="md"
                variant={
                  rebuildAllStatus === 'error' ? 'danger' :
                  rebuildAllStatus === 'accepted' ? 'success' :
                  'secondary'
                }
                loading={rebuildAllStatus === 'pending'}
                icon={
                  rebuildAllStatus === 'accepted' ? <CheckCircle size={13} /> :
                  rebuildAllStatus === 'error' ? <XCircle size={13} /> :
                  <RefreshCw size={13} />
                }
                onClick={handleRebuildAll}
                disabled={rebuildAllStatus === 'pending' || isLoading}
              >
                {rebuildAllStatus === 'pending' ? 'Rebuilding…' :
                 rebuildAllStatus === 'accepted' ? 'Queued' :
                 rebuildAllStatus === 'error' ? 'Failed — retry' :
                 'Rebuild All'}
              </Button>
            </Tooltip>
          </div>
        }
      />

      {Object.keys(rebuildProgress).length > 0 && (
        <div className="mb-4 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-input-label)]">
              Rebuild Progress
            </p>
            {rebuildAllStatus !== 'pending' && (
              <button
                type="button"
                onClick={clearRebuildProgress}
                className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)]"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.entries(rebuildProgress).map(([key, status]) => (
              <div
                key={key}
                className={`flex items-center gap-2 px-3 py-2 rounded-[var(--border-radius-small)] border text-xs ${
                  status === 'accepted'
                    ? 'border-[var(--color-tags-success-background)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
                    : status === 'error'
                    ? 'border-[var(--color-tags-error-background)] bg-[var(--color-tags-error-background)] text-[var(--color-tags-font-error)]'
                    : 'border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-support)]'
                }`}
              >
                {status === 'pending' && <RefreshCw size={12} className="animate-spin shrink-0" />}
                {status === 'accepted' && <CheckCircle size={12} className="shrink-0" />}
                {status === 'error' && <XCircle size={12} className="shrink-0" />}
                <span className="truncate font-medium">{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editRepo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setEditRepo(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <RepoEditor
              repo={editRepo}
              graphStatus={graphStatusMap.get(`${editRepo.workspace}/${editRepo.repoSlug}`) ?? null}
              onSave={(r) => saveMutation.mutate(r)}
              onCancel={() => setEditRepo(null)}
              isSaving={saveMutation.isPending}
              onRebuildComplete={() => qc.invalidateQueries({ queryKey: ['graph-status'] })}
            />
          </div>
        </div>
      )}

      {showAddRepo && (
        <AddRepoDialog
          onClose={() => setShowAddRepo(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['repos'] })
            setShowAddRepo(false)
            setToast({ message: 'Repository added successfully.', variant: 'success' })
          }}
        />
      )}

      <TableCard
        title="Repositories"
        subtitle={`${list.length} repo${list.length !== 1 ? 's' : ''}`}
        toolbar={
          <Tooltip text="Show or hide archived repositories" position="bottom">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="text-xs text-[var(--color-fonts-font-color-support)]">Show archived</span>
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${
                  showArchived ? 'bg-[var(--color-buttons-button-primary)]' : 'bg-[var(--color-inputs-input-border)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    showArchived ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          </Tooltip>
        }
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-[var(--color-cards-card-background)]">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
              {([
                { label: '',            tip: 'Git platform',                                       key: 'platform' },
                { label: 'Workspace',   tip: 'Git workspace slug',                                 key: 'workspace' },
                { label: 'Repo',        tip: 'Repository slug',                                    key: 'repo' },
                { label: 'Review',      tip: 'Automatic PR code review',                           key: 'review' },
                { label: 'Vectors',     tip: 'Semantic vector embedding for AI-assisted search',   key: 'vectors' },
                { label: 'Docs',        tip: 'Automated Confluence documentation generation',      key: 'docs' },
                { label: 'Upgrade',     tip: 'Automated dependency upgrade jobs',                  key: 'upgrade' },
                { label: 'Quality',     tip: 'Quality report collection',                          key: 'quality' },
                { label: 'Archived',    tip: 'Excluded from all automated tasks',                  key: 'archived' },
                { label: 'Code Graph',  tip: 'Code graph build status and last indexed date',      key: 'codegraph' },
                { label: '',            tip: '',                                                    key: 'actions' },
              ] as const).map(({ label, tip, key }) => (
                <th
                  key={key}
                  className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  {tip
                    ? <Tooltip text={tip} position="bottom">{label}</Tooltip>
                    : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={11} className="px-4 py-2">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : list.length === 0
              ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No repositories configured yet.
                  </td>
                </tr>
              )
              : list.map((repo) => {
                  const graphStatus = graphStatusMap.get(`${repo.workspace}/${repo.repoSlug}`)
                  return (
                    <tr
                      key={`${repo.workspace}/${repo.repoSlug}`}
                      className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
                        repo.archived ? 'opacity-50' : ''
                      }`}
                      onClick={() => setEditRepo(repo)}
                    >
                      <td className="pl-4 pr-2 py-1.5">
                        <Tooltip text={PLATFORM_LABEL[detectPlatform(repo.gitPlatformUrl)]} position="right">
                          <span className={`inline-flex ${PLATFORM_ICON_COLORS[detectPlatform(repo.gitPlatformUrl)]}`}>
                            <PlatformSvgIcon platform={detectPlatform(repo.gitPlatformUrl)} size={14} />
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-1.5 font-medium">{repo.workspace}</td>
                      <td className="px-4 py-1.5">{repo.repoSlug}</td>
                      {(['reviewEnabled', 'vectorEnabled', 'docsEnabled', 'upgradeEnabled', 'qualityReportEnabled'] as const).map(
                        (key) => (
                          <td key={key} className="px-4 py-1.5">
                            <ToggleBadge value={repo[key]} />
                          </td>
                        ),
                      )}
                      <td className="px-4 py-1.5">
                        <ToggleBadge value={!!repo.archived} />
                      </td>
                      <td className="px-4 py-1.5">
                        <GraphStatusBadge
                          status={graphStatus ?? null}
                          rebuilding={rebuildProgress[`${repo.workspace}/${repo.repoSlug}`]}
                        />
                      </td>
                      <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-brand)]">Edit</td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </TableCard>
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </main>
  )
}

function GraphStatusBadge({
  status,
  rebuilding,
}: {
  status: CodeGraphStatus | null
  rebuilding?: 'pending' | 'accepted' | 'error'
}) {
  if (rebuilding === 'pending' || rebuilding === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
        <RefreshCw size={11} className="animate-spin" />
        {rebuilding === 'pending' ? 'Starting…' : 'Queued'}
      </span>
    )
  }
  if (!status) {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
        None
      </span>
    )
  }
  const date = status.lastUpdatedAt ? new Date(status.lastUpdatedAt).toLocaleDateString() : '—'
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]"
      title={`${status.nodeCount.toLocaleString()} nodes · last updated ${status.lastUpdatedAt ?? '?'}`}
    >
      {date}
    </span>
  )
}

function ToggleBadge({ value }: { value: boolean }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${
        value
          ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
          : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
      }`}
    >
      {value ? 'On' : 'Off'}
    </span>
  )
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-[var(--color-fonts-font-color-primary)]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          value ? 'bg-[var(--color-buttons-button-primary)]' : 'bg-[var(--color-inputs-input-border)]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function RepoEditor({
  repo,
  graphStatus,
  onSave,
  onCancel,
  isSaving,
  onRebuildComplete,
}: {
  repo: RepoSettings
  graphStatus: CodeGraphStatus | null
  onSave: (r: RepoSettings) => void
  onCancel: () => void
  isSaving: boolean
  onRebuildComplete: () => void
}) {
  const [form, setForm] = useState<RepoSettings>(repo)
  const [rebuildStatus, setRebuildStatus] = useState<'idle' | 'pending' | 'accepted' | 'error'>('idle')
  const [showJiraPicker, setShowJiraPicker] = useState(false)
  const [tab, setTab] = useState<'general' | 'ai-context' | 'code-graph'>('general')

  const field = (name: keyof RepoSettings) => (value: string) =>
    setForm((p) => ({ ...p, [name]: value }))
  const toggle = (name: keyof RepoSettings) => (value: boolean) =>
    setForm((p) => ({ ...p, [name]: value }))
  const listField = (name: keyof RepoSettings) => (v: string[]) =>
    setForm((p) => ({ ...p, [name]: v }))

  const handleRebuild = async () => {
    setRebuildStatus('pending')
    try {
      await api.post(`/graph/rebuild/${repo.workspace}/${repo.repoSlug}`)
      setRebuildStatus('accepted')
      onRebuildComplete()
    } catch {
      setRebuildStatus('error')
    }
  }

  return (
    <>
    {showJiraPicker && (
      <JiraComponentPicker
        value={form.jiraComponents ?? []}
        onChange={listField('jiraComponents')}
        workspace={form.workspace}
        repoSlug={form.repoSlug}
        onClose={() => setShowJiraPicker(false)}
      />
    )}
    <div className="w-[480px] rounded-lg bg-[var(--color-cards-card-background)] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4">
        <h3 className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)] truncate">
          {form.workspace && form.repoSlug
            ? `${form.workspace} / ${form.repoSlug}`
            : 'New Repository'}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[var(--color-cards-card-stroke)] px-6">
        {(['general', 'ai-context', 'code-graph'] as const).map((t) => {
          const labels: Record<typeof t, string> = {
            general: 'General',
            'ai-context': 'AI Context',
            'code-graph': 'Code Graph',
          }
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`pb-2 pt-0.5 mr-5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t
                  ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-fonts-font-color-primary)]'
                  : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {labels[t]}
            </button>
          )
        })}
      </div>

      {/* Tab body */}
      <div className="px-6 py-5 space-y-4 h-80 overflow-y-auto">
        {tab === 'general' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  ['workspace', 'Workspace'],
                  ['repoSlug', 'Repo Slug'],
                  ['confluenceSpaceKey', 'Confluence Space Key'],
                  ['confluenceParentPageId', 'Confluence Parent Page ID'],
                ] as const
              ).map(([name, label]) => (
                <div key={name}>
                  <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={(form[name] as string) ?? ''}
                    onChange={(e) => field(name)(e.target.value)}
                    className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                  />
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--color-cards-card-stroke)] pt-4">
              {(
                [
                  ['reviewEnabled', 'Code Review'],
                  ['vectorEnabled', 'Vector Indexing'],
                  ['docsEnabled', 'Documentation'],
                  ['upgradeEnabled', 'Dependency Upgrades'],
                  ['qualityReportEnabled', 'Quality Reports'],
                  ['archived', 'Archived'],
                ] as const
              ).map(([name, label]) => (
                <Toggle key={name} label={label} value={form[name] as boolean} onChange={toggle(name)} />
              ))}
            </div>
          </>
        )}

        {tab === 'ai-context' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description ?? ''}
                onChange={(e) => field('description')(e.target.value)}
                placeholder="What does this service do?"
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                Primary Language
              </label>
              <select
                value={form.primaryLanguage ?? ''}
                onChange={(e) => field('primaryLanguage')(e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              >
                <option value="">— select —</option>
                <option value="java">Java</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="go">Go</option>
                <option value="dotnet">.NET</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] uppercase tracking-wide">
                  Jira Components
                </label>
                <button
                  type="button"
                  onClick={() => setShowJiraPicker(true)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                >
                  <Search size={11} />
                  Browse Jira
                </button>
              </div>
              <ChipInput
                value={form.jiraComponents ?? []}
                onChange={listField('jiraComponents')}
                placeholder="Type component and press Enter…"
                hint="Components used to route Jira issues to this repo"
              />
            </div>
            <ChipInput
              label="Tags"
              value={form.tags ?? []}
              onChange={listField('tags')}
              placeholder="billing, stripe, webhooks…"
              hint="Free-form domain tags for AI context"
            />
          </div>
        )}

        {tab === 'code-graph' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[var(--color-fonts-font-color-support)]">
                {graphStatus ? (
                  <>
                    <span className="text-[var(--color-fonts-font-color-primary)] font-medium">
                      {graphStatus.nodeCount.toLocaleString()} nodes
                    </span>
                    {' · last updated '}
                    <span className="text-[var(--color-fonts-font-color-primary)]">
                      {graphStatus.lastUpdatedAt
                        ? new Date(graphStatus.lastUpdatedAt).toLocaleString()
                        : '—'}
                    </span>
                  </>
                ) : (
                  <span>No code graph built yet</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleRebuild}
                disabled={rebuildStatus === 'pending'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} className={rebuildStatus === 'pending' ? 'animate-spin' : ''} />
                {rebuildStatus === 'pending'
                  ? 'Starting…'
                  : rebuildStatus === 'accepted'
                  ? 'Queued'
                  : rebuildStatus === 'error'
                  ? 'Failed — retry'
                  : 'Force Rebuild'}
              </button>
            </div>
            {rebuildStatus === 'accepted' && (
              <p className="text-xs text-[var(--color-tags-font-success)]">
                Rebuild accepted — runs in background
                {form.vectorEnabled ? ', including embeddings.' : '.'}
              </p>
            )}
            {rebuildStatus === 'error' && (
              <p className="text-xs text-[var(--color-tags-font-error)]">
                Failed to start rebuild. Check server logs.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-6 pb-5 pt-2 border-t border-[var(--color-cards-card-stroke)]">
        <button
          onClick={() => onSave(form)}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
        >
          <Save size={14} />
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
    </>
  )
}

// ── AddRepoDialog ─────────────────────────────────────────────────────────────

const ALL_PLATFORMS: GitPlatform[] = ['bitbucket', 'gitlab', 'github', 'azuredevops']

function AddRepoDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState<'platform' | 'details'>('platform')
  const [platform, setPlatform] = useState<GitPlatform | null>(null)
  const [platformUrl, setPlatformUrl] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [repoSlug, setRepoSlug] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: (payload: { workspace: string; repoSlug: string; gitPlatformUrl: string }) =>
      api.put(`/settings/repos/${encodeURIComponent(payload.workspace)}/${encodeURIComponent(payload.repoSlug)}`, {
        gitPlatformUrl: payload.gitPlatformUrl,
        reviewEnabled: true,
        vectorEnabled: false,
        docsEnabled: true,
        upgradeEnabled: true,
        qualityReportEnabled: false,
        archived: false,
      }),
    onSuccess: onSaved,
    onError: () => setError('Failed to add repository. Please check the details and try again.'),
  })

  function selectPlatform(p: GitPlatform) {
    setPlatform(p)
    setPlatformUrl(PLATFORM_DEFAULT_URL[p])
    setStep('details')
  }

  function handleBack() {
    setStep('platform')
    setError(null)
  }

  function handleSave() {
    setError(null)
    if (!workspace.trim()) { setError('Workspace / Org is required.'); return }
    if (!repoSlug.trim()) { setError('Repo Slug / Name is required.'); return }
    if (!platformUrl.trim()) { setError('Platform URL is required.'); return }
    addMutation.mutate({
      workspace: workspace.trim(),
      repoSlug: repoSlug.trim(),
      gitPlatformUrl: platformUrl.replace(/\/$/, ''),
    })
  }

  const cloneUrlPreview =
    workspace.trim() && repoSlug.trim() && platformUrl.trim()
      ? `${platformUrl.replace(/\/$/, '')}/${workspace.trim()}/${repoSlug.trim()}.git`
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[480px] rounded-lg bg-[var(--color-cards-card-background)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--color-cards-card-stroke)]">
          <div className="flex items-center gap-2">
            {step === 'details' && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <h3 className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)]">
              {step === 'platform' ? 'Add Repository — Select Platform' : `Add Repository — ${platform ? PLATFORM_LABEL[platform] : ''}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {step === 'platform' && (
            <div className="grid grid-cols-2 gap-3">
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPlatform(p)}
                  className={`flex flex-col items-center gap-3 p-5 rounded-lg border-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${PLATFORM_COLORS[p]}`}
                >
                  <span className={PLATFORM_ICON_COLORS[p]}>
                    <PlatformSvgIcon platform={p} size={28} />
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)]">
                    {PLATFORM_LABEL[p]}
                  </span>
                  <span className="text-[10px] text-[var(--color-fonts-font-color-support)] font-mono truncate w-full text-center">
                    {PLATFORM_DEFAULT_URL[p]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                  Platform URL
                </label>
                <input
                  type="text"
                  value={platformUrl}
                  onChange={(e) => setPlatformUrl(e.target.value)}
                  placeholder="https://github.com"
                  className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                />
                <p className="mt-1 text-[10px] text-[var(--color-fonts-font-color-support)]">
                  Base URL of your {platform ? PLATFORM_LABEL[platform] : 'git'} instance. Change this for self-hosted deployments.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                    Workspace / Org
                  </label>
                  <input
                    type="text"
                    value={workspace}
                    onChange={(e) => setWorkspace(e.target.value)}
                    placeholder={platform === 'azuredevops' ? 'organization' : 'my-org'}
                    className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                    Repo Slug / Name
                  </label>
                  <input
                    type="text"
                    value={repoSlug}
                    onChange={(e) => setRepoSlug(e.target.value)}
                    placeholder="my-repo"
                    className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                  />
                </div>
              </div>

              {cloneUrlPreview && (
                <div className="rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-input-label)] mb-1">
                    Clone URL preview
                  </p>
                  <p className="text-xs font-mono text-[var(--color-fonts-font-color-brand)] break-all">
                    {cloneUrlPreview}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-xs text-[var(--color-tags-font-error)]">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'details' && (
          <div className="flex gap-2 px-6 pb-5 pt-2 border-t border-[var(--color-cards-card-stroke)]">
            <button
              type="button"
              onClick={handleSave}
              disabled={addMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
            >
              <Plus size={14} />
              {addMutation.isPending ? 'Adding…' : 'Add Repository'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
