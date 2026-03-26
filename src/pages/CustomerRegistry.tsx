import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Building2,
  Package,
  Link2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import api from '@/lib/api'
import type {
  CustomerConfig,
  ProductConfig,
  RepoSettings,
  UpsertCustomerRequest,
  UpsertProductRequest,
  EnvironmentConfig,
  TeamMember,
  CloudAccount,
} from '@/types/api'

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  'h-8 w-full px-3 rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)]'

const selectCls =
  'h-8 w-full px-3 rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'

const labelCls = 'block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1'

const btnPrimary =
  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-40'

const btnSecondary =
  'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-[var(--border-radius-button-small)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors disabled:opacity-40'

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectPlatform(gitPlatformUrl?: string): string {
  if (!gitPlatformUrl) return 'bitbucket'
  const u = gitPlatformUrl.toLowerCase()
  if (u.includes('github.com')) return 'github'
  if (u.includes('gitlab.com')) return 'gitlab'
  if (u.includes('dev.azure.com') || u.includes('visualstudio.com')) return 'azuredevops'
  return 'bitbucket'
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastMsg {
  id: number
  text: string
  type: 'success' | 'error'
}

let toastId = 0

function ToastList({ toasts }: { toasts: ToastMsg[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-[var(--border-radius-card)] shadow-lg text-sm font-medium ${
            t.type === 'success'
              ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] border border-[var(--color-tags-font-success)]'
              : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] border border-[var(--color-tags-font-critical)]'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  function addToast(text: string, type: 'success' | 'error') {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }
  return { toasts, addToast }
}

// ── Customer Modal ────────────────────────────────────────────────────────────

type CustomerModalTab = 'general' | 'environments'

function CustomerModal({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial?: CustomerConfig
  onSave: (id: string, req: UpsertCustomerRequest) => void
  onClose: () => void
  isSaving: boolean
}) {
  const isEdit = !!initial
  const [tab, setTab] = useState<CustomerModalTab>('general')
  const [customerId, setCustomerId] = useState(initial?.customerId ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [cloudAccountId, setCloudAccountId] = useState(initial?.cloudAccountId ?? '')
  const [environments, setEnvironments] = useState<EnvironmentConfig[]>(initial?.environments ?? [])

  function handleSubmit() {
    if (!customerId.trim() || !name.trim()) return
    onSave(customerId.trim(), {
      name: name.trim(),
      cloudAccountId: cloudAccountId || undefined,
      environments: environments.length > 0 ? environments : undefined,
    })
  }

  const envTabLabel = [
    environments.length > 0 ? `${environments.length} env` : null,
    cloudAccountId ? '1 account' : null,
  ].filter(Boolean).join(', ')

  const MODAL_TABS: Array<{ id: CustomerModalTab; label: string }> = [
    { id: 'general', label: 'General' },
    {
      id: 'environments',
      label: envTabLabel ? `Environments (${envTabLabel})` : 'Environments',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
            {isEdit ? `Edit Customer — ${initial.customerId}` : 'Add Customer'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 px-5 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          {MODAL_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-fonts-font-color-headings)]'
                  : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Customer ID *</label>
                <input
                  className={inputCls}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  disabled={isEdit}
                  placeholder="e.g. acme-corp"
                  autoFocus={!isEdit}
                />
                {!isEdit && (
                  <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                    Unique slug — cannot be changed after creation.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Display Name *</label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  autoFocus={isEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit()
                  }}
                />
              </div>
            </div>
          )}
          {tab === 'environments' && (
            <EnvironmentsTab
              cloudAccountId={cloudAccountId}
              onCloudAccountChange={setCloudAccountId}
              environments={environments}
              onChange={setEnvironments}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-cards-card-stroke)] shrink-0">
          <button className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btnPrimary}
            onClick={handleSubmit}
            disabled={!customerId.trim() || !name.trim() || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Product form state ────────────────────────────────────────────────────────

const TEAM_ROLES: Array<{ key: string; label: string }> = [
  { key: 'productOwner', label: 'Product Owner' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'devops', label: 'DevOps' },
  { key: 'operations', label: 'Operations' },
  { key: 'qa', label: 'QA' },
  { key: 'security', label: 'Security' },
  { key: 'supportQueue', label: 'Support Queue' },
]

// ── Repo selector ─────────────────────────────────────────────────────────────

function RepoSelector({
  selected,
  onToggle,
  repos,
  isLoading,
}: {
  selected: string[]
  onToggle: (slug: string, repo: RepoSettings) => void
  repos: RepoSettings[]
  isLoading: boolean
}) {
  const [filter, setFilter] = useState('')
  const lower = filter.toLowerCase()

  const visible = repos.filter(
    (r) =>
      !lower ||
      r.repoSlug.toLowerCase().includes(lower) ||
      r.workspace.toLowerCase().includes(lower),
  )

  const groups: Record<string, RepoSettings[]> = {}
  visible.forEach((r) => {
    if (!groups[r.workspace]) groups[r.workspace] = []
    groups[r.workspace].push(r)
  })

  return (
    <div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter repositories…"
        className={inputCls}
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map((slug) => (
            <span
              key={slug}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]"
            >
              {slug}
              <button
                type="button"
                onClick={() => {
                  const repo = repos.find((r) => r.repoSlug === slug)
                  if (repo) onToggle(slug, repo)
                }}
                className="hover:opacity-70"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="h-28 skeleton-shimmer rounded-[var(--border-radius-card)] mt-2" />
      )}

      {!isLoading && (
        <div className="mt-2 border border-[var(--color-inputs-input-border)] rounded-[var(--border-radius-card)] max-h-52 overflow-y-auto">
          {Object.keys(groups).length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[var(--color-fonts-font-color-support)]">
              {filter ? `No repositories match "${filter}".` : 'No repositories available.'}
            </div>
          ) : (
            Object.entries(groups).map(([workspace, wsRepos]) => (
              <div key={workspace}>
                <div className="px-3 py-1.5 bg-[var(--color-navigation-menu-item-hover-background)] sticky top-0">
                  <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)]">
                    {workspace}
                  </span>
                </div>
                {wsRepos.map((repo, idx) => (
                  <label
                    key={repo.repoSlug}
                    className={`flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--color-navigation-menu-item-hover-background)] cursor-pointer ${
                      idx < wsRepos.length - 1
                        ? 'border-b border-[var(--color-cards-card-stroke)]'
                        : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(repo.repoSlug)}
                      onChange={() => onToggle(repo.repoSlug, repo)}
                      className="rounded accent-[var(--color-buttons-button-primary)]"
                    />
                    <span className="text-sm text-[var(--color-fonts-font-color-primary)]">
                      {repo.repoSlug}
                    </span>
                    {repo.archetype && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                        {repo.archetype}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface ProductFormState {
  productId: string
  displayName: string
  selectedRepos: string[]
  // Derived from selectedRepos — not shown as manual inputs
  gitPlatform: string
  gitWorkspace: string
  gitBaseUrl: string
  jiraBaseUrl: string
  jiraProjects: Array<{ role: string; key: string }>
  confluenceSpaceKey: string
  confluenceRootPageId: string
  teams: Record<string, TeamMember[]>
}

function blankProduct(): ProductFormState {
  return {
    productId: '',
    displayName: '',
    selectedRepos: [],
    gitPlatform: 'bitbucket',
    gitWorkspace: '',
    gitBaseUrl: '',
    jiraBaseUrl: '',
    jiraProjects: [],
    confluenceSpaceKey: '',
    confluenceRootPageId: '',
    teams: {},
  }
}

function productToForm(p: ProductConfig): ProductFormState {
  const savedRepos = Array.isArray(p.metadata?.repos) ? (p.metadata.repos as string[]) : []
  return {
    productId: p.productId,
    displayName: p.displayName,
    selectedRepos: savedRepos,
    gitPlatform: p.git?.platform ?? 'bitbucket',
    gitWorkspace: p.git?.workspace ?? '',
    gitBaseUrl: p.git?.baseUrl ?? '',
    jiraBaseUrl: p.jira?.baseUrl ?? '',
    jiraProjects: Object.entries(p.jira?.projects ?? {}).map(([role, key]) => ({ role, key })),
    confluenceSpaceKey: p.confluence?.spaceKey ?? '',
    confluenceRootPageId: p.confluence?.rootPageId ?? '',
    teams: p.teams ?? {},
  }
}

function formToRequest(f: ProductFormState): UpsertProductRequest {
  const projects: Record<string, string> = {}
  f.jiraProjects.forEach(({ role, key }) => {
    if (role.trim() && key.trim()) projects[role.trim()] = key.trim()
  })

  const metadata: Record<string, unknown> =
    f.selectedRepos.length > 0 ? { repos: f.selectedRepos } : {}

  return {
    displayName: f.displayName,
    git:
      f.gitWorkspace
        ? { platform: f.gitPlatform, workspace: f.gitWorkspace, baseUrl: f.gitBaseUrl || undefined }
        : undefined,
    jira:
      f.jiraBaseUrl || Object.keys(projects).length > 0
        ? { baseUrl: f.jiraBaseUrl || undefined, projects }
        : undefined,
    confluence:
      f.confluenceSpaceKey || f.confluenceRootPageId
        ? { spaceKey: f.confluenceSpaceKey || undefined, rootPageId: f.confluenceRootPageId || undefined }
        : undefined,
    teams: Object.keys(f.teams).length > 0 ? f.teams : undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  }
}

// ── Product Modal sub-tabs ────────────────────────────────────────────────────

function GeneralTab({
  form,
  set,
  isEdit,
}: {
  form: ProductFormState
  set: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void
  isEdit: boolean
}) {
  const { data: repoData, isLoading: reposLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const repos = (Array.isArray(repoData) ? repoData : []).filter((r) => !r.archived)

  function handleToggleRepo(slug: string) {
    const isSelected = form.selectedRepos.includes(slug)
    const updated = isSelected
      ? form.selectedRepos.filter((s) => s !== slug)
      : [...form.selectedRepos, slug]

    set('selectedRepos', updated)

    // Derive git workspace / platform from the first selected repo
    const firstSlug = updated[0]
    const firstRepo = firstSlug ? repos.find((r) => r.repoSlug === firstSlug) : null

    if (firstRepo) {
      set('gitWorkspace', firstRepo.workspace)
      set('gitBaseUrl', firstRepo.gitPlatformUrl ?? '')
      set('gitPlatform', detectPlatform(firstRepo.gitPlatformUrl))
    } else {
      set('gitWorkspace', '')
      set('gitBaseUrl', '')
      set('gitPlatform', 'bitbucket')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Product ID *</label>
        <input
          className={inputCls}
          value={form.productId}
          onChange={(e) => set('productId', e.target.value)}
          disabled={isEdit}
          placeholder="e.g. acme-platform"
          autoFocus={!isEdit}
        />
        {!isEdit && (
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
            Unique slug — cannot be changed after creation.
          </p>
        )}
      </div>

      <div>
        <label className={labelCls}>Display Name *</label>
        <input
          className={inputCls}
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
          placeholder="e.g. Acme Platform"
          autoFocus={isEdit}
        />
      </div>

      <div className="pt-2">
        <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] mb-1 uppercase tracking-wide">
          Repositories
        </p>
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-3">
          Select the repositories that make up this product. Git platform and workspace are
          derived automatically.
        </p>
        <RepoSelector
          selected={form.selectedRepos}
          onToggle={handleToggleRepo}
          repos={repos}
          isLoading={reposLoading}
        />
        {form.gitWorkspace && (
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-2">
            Derived:{' '}
            <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
              {form.gitPlatform}
            </span>{' '}
            /{' '}
            <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
              {form.gitWorkspace}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}

function IntegrationsTab({
  form,
  set,
}: {
  form: ProductFormState
  set: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void
}) {
  function addJiraProject() {
    set('jiraProjects', [...form.jiraProjects, { role: '', key: '' }])
  }

  function updateJiraProject(idx: number, field: 'role' | 'key', value: string) {
    set(
      'jiraProjects',
      form.jiraProjects.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    )
  }

  function removeJiraProject(idx: number) {
    set(
      'jiraProjects',
      form.jiraProjects.filter((_, i) => i !== idx),
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] mb-3 uppercase tracking-wide">
          Jira
        </p>
        <div>
          <label className={labelCls}>Jira Base URL</label>
          <input
            className={inputCls}
            value={form.jiraBaseUrl}
            onChange={(e) => set('jiraBaseUrl', e.target.value)}
            placeholder="https://yourorg.atlassian.net (leave blank to use global setting)"
          />
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + ' mb-0'}>Project Keys by Role</label>
            <button
              type="button"
              onClick={addJiraProject}
              className="flex items-center gap-1 text-xs text-[var(--color-buttons-button-primary)] hover:opacity-80"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {form.jiraProjects.length === 0 && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] italic">
              No project keys configured.
            </p>
          )}
          {form.jiraProjects.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <input
                className={inputCls}
                placeholder="Role (e.g. engineering)"
                value={p.role}
                onChange={(e) => updateJiraProject(idx, 'role', e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Project key (e.g. ENG)"
                value={p.key}
                onChange={(e) => updateJiraProject(idx, 'key', e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeJiraProject(idx)}
                className="p-1.5 rounded hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] mb-3 uppercase tracking-wide">
          Confluence
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Space Key</label>
            <input
              className={inputCls}
              value={form.confluenceSpaceKey}
              onChange={(e) => set('confluenceSpaceKey', e.target.value)}
              placeholder="e.g. MYPRODUCT"
            />
          </div>
          <div>
            <label className={labelCls}>Root Page ID</label>
            <input
              className={inputCls}
              value={form.confluenceRootPageId}
              onChange={(e) => set('confluenceRootPageId', e.target.value)}
              placeholder="e.g. 123456"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const ENVIRONMENT_TYPES = [
  { value: 'production',  label: 'Production' },
  { value: 'acceptance',  label: 'Acceptance' },
  { value: 'test',        label: 'Test' },
  { value: 'development', label: 'Development' },
  { value: 'other',       label: 'Other' },
]

function EnvironmentEditor({
  env,
  onChange,
  onRemove,
}: {
  env: EnvironmentConfig
  onChange: (updated: EnvironmentConfig) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(true)

  const typeLabel = ENVIRONMENT_TYPES.find((t) => t.value === env.type)?.label ?? env.type ?? ''

  return (
    <div className="bg-[var(--color-inputs-input-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] mb-3 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-cards-card-stroke)]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[var(--color-fonts-font-color-support)]"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <input
          className="flex-1 h-7 px-2 bg-transparent text-sm font-medium text-[var(--color-fonts-font-color-headings)] focus:outline-none border-0"
          placeholder="Environment name (e.g. Engie Netherlands Production)"
          value={env.name}
          onChange={(e) => onChange({ ...env, name: e.target.value })}
        />
        {typeLabel && (
          <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] shrink-0">
            {typeLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div className="px-4 py-3 space-y-4">
          {/* Type */}
          <div>
            <label className={labelCls}>Environment Type</label>
            <select
              className={selectCls}
              value={env.type ?? ''}
              onChange={(e) => onChange({ ...env, type: e.target.value || undefined })}
            >
              <option value="">— Select type —</option>
              {ENVIRONMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* AWS */}
          <div>
            <p className="text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-2">
              AWS
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Account ID</label>
                <input
                  className={inputCls}
                  value={env.aws?.accountId ?? ''}
                  onChange={(e) =>
                    onChange({ ...env, aws: { ...env.aws, accountId: e.target.value } })
                  }
                  placeholder="123456789012"
                />
              </div>
              <div>
                <label className={labelCls}>Region</label>
                <input
                  className={inputCls}
                  value={env.aws?.region ?? ''}
                  onChange={(e) =>
                    onChange({ ...env, aws: { ...env.aws, region: e.target.value } })
                  }
                  placeholder="eu-central-1"
                />
              </div>
              <div>
                <label className={labelCls}>IAM Role ARN</label>
                <input
                  className={inputCls}
                  value={env.aws?.iamRole ?? ''}
                  onChange={(e) =>
                    onChange({ ...env, aws: { ...env.aws, iamRole: e.target.value } })
                  }
                  placeholder="arn:aws:iam::..."
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EnvironmentsTab({
  cloudAccountId,
  onCloudAccountChange,
  environments,
  onChange,
}: {
  cloudAccountId: string
  onCloudAccountChange: (id: string) => void
  environments: EnvironmentConfig[]
  onChange: (envs: EnvironmentConfig[]) => void
}) {
  const { data: cloudAccounts } = useQuery<CloudAccount[]>({
    queryKey: ['cloud-accounts'],
    queryFn: () => api.get('/cloud-accounts').then((r) => r.data).catch(() => []),
  })

  const accounts = Array.isArray(cloudAccounts) ? cloudAccounts : []

  function addEnvironment() {
    onChange([
      ...environments,
      { name: '', aws: { accountId: '', region: '', iamRole: '' } },
    ])
  }

  function updateEnv(idx: number, updated: EnvironmentConfig) {
    onChange(environments.map((e, i) => (i === idx ? updated : e)))
  }

  function removeEnv(idx: number) {
    onChange(environments.filter((_, i) => i !== idx))
  }

  const selectedAccount = accounts.find((a) => a.id === cloudAccountId)

  return (
    <div>
      {/* Cloud Account selector */}
      <div className="mb-5 pb-4 border-b border-[var(--color-cards-card-stroke)]">
        <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide mb-3">
          Cloud Account
        </p>
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-2">
          Select which global cloud account (credentials) should be used to access this customer's environments.
        </p>
        <select
          className={selectCls}
          value={cloudAccountId}
          onChange={(e) => onCloudAccountChange(e.target.value)}
        >
          <option value="">— None —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.type})
            </option>
          ))}
        </select>
        {selectedAccount && (
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
            {selectedAccount.description ?? selectedAccount.type}
          </p>
        )}
        {accounts.length === 0 && (
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1 italic">
            No cloud accounts configured. Add one in System Settings → Cloud Accounts.
          </p>
        )}
      </div>

      {/* Environments */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide">
          Environments
        </p>
        <Button size="md" variant="secondary" icon={<Plus size={13} />} type="button" onClick={addEnvironment}>
          Add Environment
        </Button>
      </div>

      {environments.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--color-fonts-font-color-support)]">
          No environments configured. Click "Add Environment" to add one.
        </div>
      )}

      {environments.map((env, idx) => (
        <EnvironmentEditor
          key={idx}
          env={env}
          onChange={(updated) => updateEnv(idx, updated)}
          onRemove={() => removeEnv(idx)}
        />
      ))}
    </div>
  )
}

function RoleEditor({
  role,
  members,
  onChange,
}: {
  role: string
  members: TeamMember[]
  onChange: (members: TeamMember[]) => void
}) {
  const [open, setOpen] = useState(members.length > 0)

  function addMember() {
    onChange([...members, { name: '', email: '', jiraAccountId: '' }])
    setOpen(true)
  }

  function updateMember(idx: number, field: keyof TeamMember, value: string) {
    onChange(members.map((m, i) => (i === idx ? { ...m, [field]: value } : m)))
  }

  function removeMember(idx: number) {
    onChange(members.filter((_, i) => i !== idx))
  }

  return (
    <div className="bg-[var(--color-inputs-input-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-left"
      >
        {open ? (
          <ChevronDown size={14} className="text-[var(--color-fonts-font-color-support)]" />
        ) : (
          <ChevronRight size={14} className="text-[var(--color-fonts-font-color-support)]" />
        )}
        <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
          {role}
        </span>
        {members.length > 0 && (
          <span className="ml-auto text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
            {members.length}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--color-cards-card-stroke)] px-4 py-3">
          {members.map((m, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
              <input
                className={inputCls}
                placeholder="Name"
                value={m.name ?? ''}
                onChange={(e) => updateMember(idx, 'name', e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Email"
                value={m.email ?? ''}
                onChange={(e) => updateMember(idx, 'email', e.target.value)}
              />
              <input
                className={inputCls}
                placeholder="Jira Account ID"
                value={m.jiraAccountId ?? ''}
                onChange={(e) => updateMember(idx, 'jiraAccountId', e.target.value)}
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => removeMember(idx)}
                  className="ml-auto p-1 rounded hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addMember}
            className="flex items-center gap-1 text-xs text-[var(--color-buttons-button-primary)] hover:opacity-80 mt-1"
          >
            <Plus size={12} /> Add member
          </button>
        </div>
      )}
    </div>
  )
}

function TeamsTab({
  form,
  set,
}: {
  form: ProductFormState
  set: <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => void
}) {
  function getMembers(roleKey: string): TeamMember[] {
    return form.teams[roleKey] ?? []
  }

  function setMembers(roleKey: string, members: TeamMember[]) {
    const updated = { ...form.teams }
    if (members.length === 0) {
      delete updated[roleKey]
    } else {
      updated[roleKey] = members
    }
    set('teams', updated)
  }

  return (
    <div className="space-y-2">
      {TEAM_ROLES.map((role) => (
        <RoleEditor
          key={role.key}
          role={role.label}
          members={getMembers(role.key)}
          onChange={(members) => setMembers(role.key, members)}
        />
      ))}
    </div>
  )
}

// ── Product Modal ─────────────────────────────────────────────────────────────

type ProductModalTab = 'general' | 'integrations' | 'teams'

function ProductModal({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial?: ProductConfig
  onSave: (id: string, req: UpsertProductRequest) => void
  onClose: () => void
  isSaving: boolean
}) {
  const isEdit = !!initial
  const [form, setForm] = useState<ProductFormState>(
    initial ? productToForm(initial) : blankProduct(),
  )
  const [tab, setTab] = useState<ProductModalTab>('general')

  function set<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit() {
    if (!form.productId.trim() || !form.displayName.trim()) return
    onSave(form.productId.trim(), formToRequest(form))
  }

  const MODAL_TABS: Array<{ id: ProductModalTab; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'teams', label: 'Teams' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
            {isEdit ? `Edit Product — ${initial.productId}` : 'Add Product'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 px-5 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          {MODAL_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-fonts-font-color-headings)]'
                  : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {tab === 'general' && <GeneralTab form={form} set={set} isEdit={isEdit} />}
          {tab === 'integrations' && <IntegrationsTab form={form} set={set} />}
          {tab === 'teams' && <TeamsTab form={form} set={set} />}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-cards-card-stroke)] shrink-0">
          <button className={btnSecondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btnPrimary}
            onClick={handleSubmit}
            disabled={!form.productId.trim() || !form.displayName.trim() || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Customer row with expandable linked-products panel ────────────────────────

function CustomerRow({
  customer,
  allProducts,
  isLast,
  onEdit,
  onDelete,
  isDeleting,
  addToast,
}: {
  customer: CustomerConfig
  allProducts: ProductConfig[]
  isLast: boolean
  onEdit: (c: CustomerConfig) => void
  onDelete: (id: string) => void
  isDeleting: boolean
  addToast: (text: string, type: 'success' | 'error') => void
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [linkProductId, setLinkProductId] = useState('')

  const { data: linkedProducts, isLoading: linkedLoading } = useQuery<ProductConfig[]>({
    queryKey: ['customer-products', customer.customerId],
    queryFn: () =>
      api
        .get(`/customer-registry/customers/${customer.customerId}/products`)
        .then((r) => r.data)
        .catch(() => []),
    enabled: expanded,
  })

  const linkMutation = useMutation({
    mutationFn: (pid: string) =>
      api.put(`/customer-registry/customers/${customer.customerId}/products/${pid}`, {}),
    onSuccess: (_, pid) => {
      qc.invalidateQueries({ queryKey: ['customer-products', customer.customerId] })
      addToast(`Product "${pid}" linked to ${customer.name}.`, 'success')
      setLinkProductId('')
    },
    onError: (_, pid) => addToast(`Failed to link "${pid}".`, 'error'),
  })

  const unlinkMutation = useMutation({
    mutationFn: (pid: string) =>
      api.delete(`/customer-registry/customers/${customer.customerId}/products/${pid}`),
    onSuccess: (_, pid) => {
      qc.invalidateQueries({ queryKey: ['customer-products', customer.customerId] })
      addToast(`Product "${pid}" unlinked from ${customer.name}.`, 'success')
    },
    onError: (_, pid) => addToast(`Failed to unlink "${pid}".`, 'error'),
  })

  const linked = Array.isArray(linkedProducts) ? linkedProducts : []
  const linkedIds = new Set(linked.map((p) => p.productId))
  const available = allProducts.filter((p) => !linkedIds.has(p.productId))

  return (
    <div className={!isLast ? 'border-b border-[var(--color-cards-card-stroke)]' : ''}>
      {/* Customer row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
          title={expanded ? 'Collapse' : 'Expand linked products'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Building2 size={16} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
              {customer.name}
            </span>
            <code className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
              {customer.customerId}
            </code>
          </div>
          {customer.createdAt && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
              Created {new Date(customer.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            title="Edit"
            onClick={() => onEdit(customer)}
            className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            title="Delete"
            onClick={() => onDelete(customer.customerId)}
            disabled={isDeleting}
            className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Linked products panel */}
      {expanded && (
        <div className="border-t border-[var(--color-cards-card-stroke)] bg-[var(--color-inputs-input-background)] px-5 py-3">
          <p className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide mb-2">
            Linked Products
          </p>

          {linkedLoading && (
            <div className="h-7 skeleton-shimmer rounded-[var(--border-radius-card)] mb-2" />
          )}

          {!linkedLoading && linked.length === 0 && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] italic mb-3">
              No products linked yet.
            </p>
          )}

          {!linkedLoading && linked.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {linked.map((p) => (
                <div key={p.productId} className="flex items-center gap-2">
                  <Package
                    size={13}
                    className="text-[var(--color-fonts-font-color-support)] shrink-0"
                  />
                  <span className="text-sm text-[var(--color-fonts-font-color-primary)]">
                    {p.displayName}
                  </span>
                  <code className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                    {p.productId}
                  </code>
                  {Array.isArray(p.metadata?.repos) && (p.metadata.repos as string[]).length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      {(p.metadata.repos as string[]).length} repo
                      {(p.metadata.repos as string[]).length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <button
                    title="Unlink"
                    onClick={() => unlinkMutation.mutate(p.productId)}
                    disabled={unlinkMutation.isPending}
                    className="ml-auto p-1 rounded hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors disabled:opacity-40"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Link new product */}
          {available.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-cards-card-stroke)]">
              <select
                className={selectCls}
                value={linkProductId}
                onChange={(e) => setLinkProductId(e.target.value)}
              >
                <option value="">— Link a product —</option>
                {available.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.displayName} ({p.productId})
                  </option>
                ))}
              </select>
              <button
                className={btnPrimary + ' shrink-0'}
                onClick={() => linkProductId && linkMutation.mutate(linkProductId)}
                disabled={!linkProductId || linkMutation.isPending}
              >
                <Link2 size={13} /> Link
              </button>
            </div>
          )}

          {available.length === 0 && !linkedLoading && allProducts.length > 0 && linked.length > 0 && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] italic pt-2 border-t border-[var(--color-cards-card-stroke)]">
              All available products are already linked.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Customers tab ─────────────────────────────────────────────────────────────

function CustomersTab({
  customers,
  isLoading,
  allProducts,
}: {
  customers: CustomerConfig[]
  isLoading: boolean
  allProducts: ProductConfig[]
}) {
  const qc = useQueryClient()
  const { toasts, addToast } = useToast()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<CustomerConfig | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpsertCustomerRequest }) =>
      api.put(`/customer-registry/customers/${id}`, req),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      addToast(`Customer "${id}" saved.`, 'success')
      setAddOpen(false)
      setEditCustomer(null)
    },
    onError: (_err, { id }) => addToast(`Failed to save "${id}".`, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customer-registry/customers/${id}`),
    onMutate: (id) => setDeletingId(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      addToast(`Customer "${id}" deleted.`, 'success')
    },
    onError: (_data, id) => addToast(`Failed to delete "${id}".`, 'error'),
    onSettled: () => setDeletingId(null),
  })

  const lower = search.toLowerCase()
  const filtered = customers.filter(
    (c) =>
      c.customerId.toLowerCase().includes(lower) || c.name.toLowerCase().includes(lower),
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="h-8 px-3 rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)] w-64"
        />
        <Button size="md" variant="primary" icon={<Plus size={13} />} className="ml-auto" onClick={() => setAddOpen(true)}>
          Add Customer
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-4 py-12 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          {search
            ? `No customers match "${search}".`
            : 'No customers yet. Add your first customer to get started.'}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] overflow-hidden">
          {filtered.map((c, idx) => (
            <CustomerRow
              key={c.customerId}
              customer={c}
              allProducts={allProducts}
              isLast={idx === filtered.length - 1}
              onEdit={setEditCustomer}
              onDelete={(id) => deleteMutation.mutate(id)}
              isDeleting={deletingId === c.customerId}
              addToast={addToast}
            />
          ))}
        </div>
      )}

      {(addOpen || editCustomer) && (
        <CustomerModal
          initial={editCustomer ?? undefined}
          onSave={(id, req) => saveMutation.mutate({ id, req })}
          onClose={() => {
            setAddOpen(false)
            setEditCustomer(null)
          }}
          isSaving={saveMutation.isPending}
        />
      )}

      <ToastList toasts={toasts} />
    </div>
  )
}

// ── Products tab ──────────────────────────────────────────────────────────────

function ProductsTab() {
  const qc = useQueryClient()
  const { toasts, addToast } = useToast()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductConfig | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: products, isLoading } = useQuery<ProductConfig[]>({
    queryKey: ['products'],
    queryFn: () =>
      api.get('/customer-registry/products').then((r) => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, req }: { id: string; req: UpsertProductRequest }) =>
      api.put(`/customer-registry/products/${id}`, req),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      addToast(`Product "${id}" saved.`, 'success')
      setAddOpen(false)
      setEditProduct(null)
    },
    onError: (_err, { id }) => addToast(`Failed to save "${id}".`, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customer-registry/products/${id}`),
    onMutate: (id) => setDeletingId(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      addToast(`Product "${id}" deleted.`, 'success')
    },
    onError: (_data, id) => addToast(`Failed to delete "${id}".`, 'error'),
    onSettled: () => setDeletingId(null),
  })

  const lower = search.toLowerCase()
  const filtered = (Array.isArray(products) ? products : []).filter(
    (p) =>
      p.productId.toLowerCase().includes(lower) ||
      p.displayName.toLowerCase().includes(lower),
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-8 px-3 rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)] w-64"
        />
        <Button size="md" variant="primary" icon={<Plus size={13} />} className="ml-auto" onClick={() => setAddOpen(true)}>
          Add Product
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-4 py-12 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          {search ? `No products match "${search}".` : 'No products yet. Add your first product to get started.'}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] overflow-hidden">
          {filtered.map((p, idx) => (
            <div
              key={p.productId}
              className={`flex items-center gap-3 px-4 py-3 ${
                idx < filtered.length - 1 ? 'border-b border-[var(--color-cards-card-stroke)]' : ''
              }`}
            >
              <Package size={16} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
                    {p.displayName}
                  </span>
                  <code className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                    {p.productId}
                  </code>
                  {Array.isArray(p.metadata?.repos) && (p.metadata.repos as string[]).length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      {(p.metadata.repos as string[]).length} repo
                      {(p.metadata.repos as string[]).length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {p.git?.platform && (
                    <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      {p.git.platform}
                    </span>
                  )}
                </div>
                {p.git?.workspace && (
                  <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                    {p.git.platform} / {p.git.workspace}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  title="Edit"
                  onClick={() => setEditProduct(p)}
                  className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  title="Delete"
                  onClick={() => deleteMutation.mutate(p.productId)}
                  disabled={deletingId === p.productId}
                  className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(addOpen || editProduct) && (
        <ProductModal
          initial={editProduct ?? undefined}
          onSave={(id, req) => saveMutation.mutate({ id, req })}
          onClose={() => {
            setAddOpen(false)
            setEditProduct(null)
          }}
          isSaving={saveMutation.isPending}
        />
      )}

      <ToastList toasts={toasts} />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type MainTab = 'customers' | 'products'

export default function CustomerRegistryPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('customers')

  const { data: customers, isLoading: customersLoading } = useQuery<CustomerConfig[]>({
    queryKey: ['customers'],
    queryFn: () =>
      api.get('/customer-registry/customers').then((r) => r.data).catch(() => []),
  })

  // Pre-fetch all products so the link dropdown in CustomersTab is populated
  const { data: products } = useQuery<ProductConfig[]>({
    queryKey: ['products'],
    queryFn: () =>
      api.get('/customer-registry/products').then((r) => r.data).catch(() => []),
  })

  const customerList = Array.isArray(customers) ? customers : []
  const productList = Array.isArray(products) ? products : []

  const TABS: Array<{ id: MainTab; label: string; count?: number }> = [
    {
      id: 'customers',
      label: 'Customers',
      count: customersLoading ? undefined : customerList.length,
    },
    {
      id: 'products',
      label: 'Products',
      count: productList.length > 0 ? productList.length : undefined,
    },
  ]

  return (
    <main>
      <PageHeader
        title="Customer Registry"
        subtitle="Manage customers and their linked products. Configure customer environments, and each product's Git, Jira, Confluence and teams independently."
      />

      <div className="flex gap-1 mb-4 border-b border-[var(--color-cards-card-stroke)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-fonts-font-color-headings)]'
                : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-cards-card-stroke)]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] leading-none">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'customers' && (
        <CustomersTab
          customers={customerList}
          isLoading={customersLoading}
          allProducts={productList}
        />
      )}

      {activeTab === 'products' && <ProductsTab />}
    </main>
  )
}
