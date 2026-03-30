import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Save, X, RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { ChipInput } from '@/components/ui/ChipInput'
import { JiraComponentPicker } from '@/components/repo-settings/JiraComponentPicker'
import api from '@/lib/api'
import type { RepoSettings, CodeGraphStatus } from '@/types/api'

export default function RepoSettingsPage() {
  const qc = useQueryClient()
  const [editRepo, setEditRepo] = useState<RepoSettings | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [rebuildAllStatus, setRebuildAllStatus] = useState<'idle' | 'pending' | 'accepted' | 'error'>('idle')
  const [rebuildProgress, setRebuildProgress] = useState<Record<string, 'pending' | 'accepted' | 'error'>>({})

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
    },
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
                { label: 'Workspace',   tip: 'Git workspace slug' },
                { label: 'Repo',        tip: 'Repository slug' },
                { label: 'Review',      tip: 'Automatic PR code review' },
                { label: 'Vectors',     tip: 'Semantic vector embedding for AI-assisted search' },
                { label: 'Docs',        tip: 'Automated Confluence documentation generation' },
                { label: 'Upgrade',     tip: 'Automated dependency upgrade jobs' },
                { label: 'Quality',     tip: 'Quality report collection' },
                { label: 'Archived',    tip: 'Excluded from all automated tasks' },
                { label: 'Code Graph',  tip: 'Code graph build status and last indexed date' },
                { label: '',            tip: '' },
              ] as const).map(({ label, tip }) => (
                <th
                  key={label || 'actions'}
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
                    <td colSpan={10} className="px-4 py-2">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : list.length === 0
              ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
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
