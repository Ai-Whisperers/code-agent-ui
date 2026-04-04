import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect, useMemo } from 'react'
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
  Search,
  ChevronLeft,
  Check,
  FileText,
  ScanSearch,
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import api from '@/lib/api'
import type {
  CustomerConfig,
  ProductConfig,
  RepoSettings,
  UpsertCustomerRequest,
  UpsertProductRequest,
  EnvironmentConfig,
  LogAnalysisConfig,
  Team,
  CloudAccount,
  IntegrationFilter,
} from '@/types/api'

const labelCls = 'block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectPlatform(gitPlatformUrl?: string): string {
  if (!gitPlatformUrl) return 'bitbucket'
  const u = gitPlatformUrl.toLowerCase()
  if (u.includes('github.com')) return 'github'
  if (u.includes('gitlab.com')) return 'gitlab'
  if (u.includes('dev.azure.com') || u.includes('visualstudio.com')) return 'azuredevops'
  return 'bitbucket'
}

// ── Toast helper ──────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)
  function addToast(message: string, variant: 'success' | 'error') {
    setToast({ message, variant })
  }
  return { toast, setToast, addToast }
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
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>

        <div className="flex gap-1 px-5 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          {MODAL_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
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
                <Input
                  className="w-full"
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
                <Input
                  className="w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  autoFocus={isEdit}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                />
              </div>
            </div>
          )}
          {tab === 'environments' && (
            <EnvironmentsTab
              customerId={customerId}
              cloudAccountId={cloudAccountId}
              onCloudAccountChange={setCloudAccountId}
              environments={environments}
              onChange={setEnvironments}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-cards-card-stroke)] shrink-0">
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!customerId.trim() || !name.trim() || isSaving}
            loading={isSaving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Product form state ────────────────────────────────────────────────────────

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
      <Input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter repositories…"
        className="w-full"
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
  jiraProjectKey: string
  confluenceSpaceKey: string
  confluenceRootPageId: string
  confluenceRootPageTitle: string
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
    jiraProjectKey: '',
    confluenceSpaceKey: '',
    confluenceRootPageId: '',
    confluenceRootPageTitle: '',
  }
}

function productToForm(p: ProductConfig): ProductFormState {
  const savedRepos = Array.isArray(p.metadata?.repos) ? (p.metadata.repos as string[]) : []
  const projectEntries = Object.entries(p.jira?.projects ?? {})
  const jiraProjectKey = projectEntries.length > 0 ? projectEntries[0][1] : ''
  return {
    productId: p.productId,
    displayName: p.displayName,
    selectedRepos: savedRepos,
    gitPlatform: p.git?.platform ?? 'bitbucket',
    gitWorkspace: p.git?.workspace ?? '',
    gitBaseUrl: p.git?.baseUrl ?? '',
    jiraBaseUrl: p.jira?.baseUrl ?? '',
    jiraProjectKey,
    confluenceSpaceKey: p.confluence?.spaceKey ?? '',
    confluenceRootPageId: p.confluence?.rootPageId ?? '',
    confluenceRootPageTitle: '',
  }
}

function formToRequest(f: ProductFormState): UpsertProductRequest {
  const projects: Record<string, string> = {}
  if (f.jiraProjectKey.trim()) {
    projects['default'] = f.jiraProjectKey.trim()
  }

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
        <Input
          className="w-full"
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
        <Input
          className="w-full"
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

interface JiraProjectMeta { id: string; key: string; name: string }
interface ConfluenceSpaceMeta { key: string; name: string }
interface ConfluencePageMeta { pageId: string; title: string }

function JiraProjectSelector({
  value,
  onChange,
}: {
  value: string
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const { data: jiraFilters = [], isLoading } = useQuery<IntegrationFilter[]>({
    queryKey: ['integration-filters', 'jira'],
    queryFn: () => api.get('/integration-filters?type=jira').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  })
  // Opt-in: only rows with enabled=true exist and are relevant
  const projects: JiraProjectMeta[] = jiraFilters
    .filter((f) => f.enabled)
    .map((f) => ({ id: f.key, key: f.key, name: f.name }))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const filtered = search.trim()
    ? projects.filter(
        (p) =>
          p.key.toLowerCase().includes(search.toLowerCase()) ||
          p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : projects

  const selected = projects.find((p) => p.key === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 w-full px-3 py-2 text-sm rounded border transition-all ${
          open
            ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)]'
            : 'bg-[var(--color-cards-card-background)] border-[var(--color-cards-card-stroke)] hover:border-[var(--color-buttons-button-primary)]'
        }`}
      >
        <span className={`flex-1 text-left truncate ${selected ? 'text-[var(--color-fonts-font-color-user-input)]' : 'text-[var(--color-fonts-font-color-support)]'}`}>
          {selected
            ? <><span className="font-mono text-xs text-[var(--color-fonts-font-color-brand)] mr-1.5">{selected.key}</span>{selected.name}</>
            : 'Select a project…'}
        </span>
        {value ? (
          <X
            size={13}
            className="shrink-0 text-[var(--color-icons-icon)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false) }}
          />
        ) : (
          <ChevronDown size={13} className={`shrink-0 text-[var(--color-icons-icon)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--color-cards-card-stroke)]">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-icons-icon)]" />
              <Input
                autoFocus
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-6"
              />
            </div>
          </div>
          <div className="overflow-y-auto py-0.5" style={{ maxHeight: '220px' }}>
            {isLoading ? (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] py-3 text-center">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] py-3 text-center">No projects found</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { onChange(p.key); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-tables-table-hover)] ${
                    p.key === value ? 'text-[var(--color-fonts-font-color-primary)] font-medium' : 'text-[var(--color-fonts-font-color-support)]'
                  }`}
                >
                  <Check size={11} className={`shrink-0 ${p.key === value ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="font-mono text-xs text-[var(--color-fonts-font-color-brand)] w-14 shrink-0">{p.key}</span>
                  <span className="text-left truncate">{p.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ConfluencePageSelector({
  spaceKey,
  pageId,
  pageTitle,
  onSpaceChange,
  onPageChange,
}: {
  spaceKey: string
  pageId: string
  pageTitle: string
  onSpaceChange: (key: string) => void
  onPageChange: (id: string, title: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'space' | 'page'>('space')
  const [spaceSearch, setSpaceSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [pendingSpace, setPendingSpace] = useState(spaceKey)
  const ref = useRef<HTMLDivElement>(null)

  const { data: confluenceFilters = [], isLoading: loadingSpaces } = useQuery<IntegrationFilter[]>({
    queryKey: ['integration-filters', 'confluence'],
    queryFn: () => api.get('/integration-filters?type=confluence').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  })
  // Opt-in: only rows with enabled=true exist and are relevant
  const spaces: ConfluenceSpaceMeta[] = confluenceFilters
    .filter((f) => f.enabled)
    .map((f) => ({ key: f.key, name: f.name }))

  const { data: pages = [], isLoading: loadingPages } = useQuery<ConfluencePageMeta[]>({
    queryKey: ['confluence-meta-pages', pendingSpace, pageSearch],
    queryFn: () =>
      api.get(`/confluence/meta/spaces/${encodeURIComponent(pendingSpace)}/pages${pageSearch ? `?q=${encodeURIComponent(pageSearch)}` : ''}`)
        .then((r) => r.data)
        .catch(() => []),
    enabled: step === 'page' && !!pendingSpace,
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const filteredSpaces = spaceSearch.trim()
    ? spaces.filter(
        (s) =>
          s.key.toLowerCase().includes(spaceSearch.toLowerCase()) ||
          s.name.toLowerCase().includes(spaceSearch.toLowerCase()),
      )
    : spaces

  function handleOpen() {
    setPendingSpace(spaceKey)
    setStep(spaceKey ? 'page' : 'space')
    setSpaceSearch('')
    setPageSearch('')
    setOpen((v) => !v)
  }

  function clearSelection() {
    onSpaceChange('')
    onPageChange('', '')
    setOpen(false)
  }

  const hasSelection = !!(pageId || spaceKey)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 w-full px-3 py-2 text-sm rounded border transition-all ${
          open
            ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)]'
            : 'bg-[var(--color-cards-card-background)] border-[var(--color-cards-card-stroke)] hover:border-[var(--color-buttons-button-primary)]'
        }`}
      >
        <span className={`flex-1 text-left truncate flex items-center gap-1.5 ${hasSelection ? 'text-[var(--color-fonts-font-color-user-input)]' : 'text-[var(--color-fonts-font-color-support)]'}`}>
          {pageId ? (
            <>
              <FileText size={12} className="text-[var(--color-icons-icon)] shrink-0" />
              <span className="truncate">{pageTitle || pageId}</span>
              {spaceKey && <span className="font-mono text-[10px] text-[var(--color-fonts-font-color-support)] shrink-0">{spaceKey}</span>}
            </>
          ) : (
            'Select a page…'
          )}
        </span>
        {hasSelection ? (
          <X
            size={13}
            className="shrink-0 text-[var(--color-icons-icon)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            onClick={(e) => { e.stopPropagation(); clearSelection() }}
          />
        ) : (
          <ChevronDown size={13} className={`shrink-0 text-[var(--color-icons-icon)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg overflow-hidden">
          {/* Step header */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--color-cards-card-stroke)]">
            {step === 'page' && (
              <button
                type="button"
                onClick={() => { setStep('space'); setPageSearch('') }}
                className="p-0.5 rounded hover:bg-[var(--color-tables-table-hover)] text-[var(--color-icons-icon)] transition-colors shrink-0"
              >
                <ChevronLeft size={13} />
              </button>
            )}
            <span className="text-xs font-medium text-[var(--color-fonts-font-color-support)]">
              {step === 'space' ? 'Space' : pendingSpace}
            </span>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-[var(--color-cards-card-stroke)]">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-icons-icon)]" />
              <Input
                autoFocus
                placeholder={step === 'space' ? 'Search spaces…' : 'Search pages…'}
                value={step === 'space' ? spaceSearch : pageSearch}
                onChange={(e) =>
                  step === 'space' ? setSpaceSearch(e.target.value) : setPageSearch(e.target.value)
                }
                className="w-full pl-6"
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto py-0.5" style={{ maxHeight: '220px' }}>
            {step === 'space' ? (
              loadingSpaces ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-3 text-center">Loading…</p>
              ) : filteredSpaces.length === 0 ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-3 text-center">No spaces found</p>
              ) : (
                filteredSpaces.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setPendingSpace(s.key)
                      onSpaceChange(s.key)
                      setStep('page')
                      setSpaceSearch('')
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-tables-table-hover)] ${
                      s.key === pendingSpace ? 'text-[var(--color-fonts-font-color-primary)] font-medium' : 'text-[var(--color-fonts-font-color-support)]'
                    }`}
                  >
                    <Check size={11} className={`shrink-0 ${s.key === pendingSpace ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="font-mono text-xs text-[var(--color-fonts-font-color-brand)] w-14 shrink-0">{s.key}</span>
                    <span className="text-left truncate">{s.name}</span>
                  </button>
                ))
              )
            ) : (
              loadingPages ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-3 text-center">Loading…</p>
              ) : pages.length === 0 ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-3 text-center">No pages found</p>
              ) : (
                pages.map((p) => (
                  <button
                    key={p.pageId}
                    type="button"
                    onClick={() => { onPageChange(p.pageId, p.title); setOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-tables-table-hover)] ${
                      p.pageId === pageId ? 'text-[var(--color-fonts-font-color-primary)] font-medium' : 'text-[var(--color-fonts-font-color-support)]'
                    }`}
                  >
                    <Check size={11} className={`shrink-0 ${p.pageId === pageId ? 'opacity-100' : 'opacity-0'}`} />
                    <FileText size={12} className="text-[var(--color-icons-icon)] shrink-0" />
                    <span className="text-left truncate">{p.title}</span>
                  </button>
                ))
              )
            )}
          </div>
        </div>
      )}
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
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] mb-3 uppercase tracking-wide">
          Jira
        </p>
        <div>
          <label className={labelCls}>Jira Base URL</label>
          <Input
            className="w-full"
            value={form.jiraBaseUrl}
            onChange={(e) => set('jiraBaseUrl', e.target.value)}
            placeholder="https://yourorg.atlassian.net (leave blank to use global setting)"
          />
        </div>
        <div className="mt-4">
          <label className={labelCls}>Project</label>
          <JiraProjectSelector
            value={form.jiraProjectKey}
            onChange={(key) => set('jiraProjectKey', key)}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] mb-3 uppercase tracking-wide">
          Confluence
        </p>
        <div>
          <label className={labelCls}>Root Page</label>
          <ConfluencePageSelector
            spaceKey={form.confluenceSpaceKey}
            pageId={form.confluenceRootPageId}
            pageTitle={form.confluenceRootPageTitle}
            onSpaceChange={(key) => set('confluenceSpaceKey', key)}
            onPageChange={(id, title) => {
              set('confluenceRootPageId', id)
              set('confluenceRootPageTitle', title)
            }}
          />
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
  customerId,
  env,
  onChange,
  onRemove,
}: {
  customerId: string
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
          className="flex-1 h-7 px-2 bg-transparent text-xs font-medium text-[var(--color-fonts-font-color-headings)] focus:outline-none border-0"
          placeholder="Environment name (e.g. Engie Netherlands Production)"
          value={env.name}
          onChange={(e) => onChange({ ...env, name: e.target.value })}
        />
        {typeLabel && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] shrink-0">
            {typeLabel}
          </span>
        )}
        <Button variant="ghost" size="sm" type="button" icon={<Trash2 size={13} />} onClick={onRemove}>
          Remove
        </Button>
      </div>

      {open && (
        <div className="px-4 py-3 space-y-4">
          {/* Type */}
          <div>
            <label className={labelCls}>Environment Type</label>
            <Select
              value={env.type ?? ''}
              onChange={(val) => onChange({ ...env, type: val || undefined })}
              options={[{ value: '', label: '— Select type —' }, ...ENVIRONMENT_TYPES]}
            />
          </div>

          {/* AWS */}
          <div>
            <p className="text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-2">
              AWS
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Account ID</label>
                <Input
                  value={env.aws?.accountId ?? ''}
                  onChange={(e) =>
                    onChange({ ...env, aws: { ...env.aws, accountId: e.target.value } })
                  }
                  placeholder="123456789012"
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>Region</label>
                <Input
                  value={env.aws?.region ?? ''}
                  onChange={(e) =>
                    onChange({ ...env, aws: { ...env.aws, region: e.target.value } })
                  }
                  placeholder="eu-central-1"
                  className="w-full"
                />
              </div>
              <div>
                <label className={labelCls}>IAM Role ARN</label>
                <Input
                  value={env.aws?.iamRole ?? ''}
                  onChange={(e) =>
                    onChange({ ...env, aws: { ...env.aws, iamRole: e.target.value } })
                  }
                  placeholder="arn:aws:iam::..."
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Log Analysis */}
          <LogAnalysisSection
            customerId={customerId}
            iamRole={env.aws?.iamRole ?? ''}
            region={env.aws?.region ?? ''}
            config={env.logAnalysis}
            onChange={(updated) => onChange({ ...env, logAnalysis: updated })}
          />
        </div>
      )}
    </div>
  )
}

function LogAnalysisSection({
  customerId,
  iamRole,
  region,
  config,
  onChange,
}: {
  customerId: string
  iamRole: string
  region: string
  config?: LogAnalysisConfig
  onChange: (updated: LogAnalysisConfig | undefined) => void
}) {
  const enabled = config?.enabled ?? false
  const [logGroupSearch, setLogGroupSearch] = useState('')
  const [logGroupDropdownOpen, setLogGroupDropdownOpen] = useState(false)
  const logGroupInputRef = useRef<HTMLInputElement>(null)
  const logGroupDropdownRef = useRef<HTMLDivElement>(null)

  // Migrate legacy single logGroupName to the array on first render
  const selectedGroups: string[] = config?.logGroupNames ??
    (config?.logGroupName ? [config.logGroupName] : [])

  // Fetch log groups from AWS when the dropdown is open — only needs customerId + AWS config
  const canFetch = enabled && !!customerId
  const { data: logGroupsData, isFetching: logGroupsFetching, error: logGroupsError } = useQuery<{
    items: Array<{ name: string; retentionDays?: number }>
    hasMore: boolean
  }>({
    queryKey: ['log-groups', customerId, iamRole, region, logGroupSearch],
    queryFn: () => {
      const params = new URLSearchParams({ customerId })
      if (iamRole) params.set('iamRole', iamRole)
      if (region)  params.set('region', region)
      if (logGroupSearch) params.set('prefix', logGroupSearch)
      return api.get(`/log-analysis/log-groups?${params}`).then((r) => r.data)
    },
    enabled: canFetch && logGroupDropdownOpen,
    staleTime: 30_000,
  })

  const logGroupOptions = logGroupsData?.items ?? []

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!logGroupInputRef.current?.contains(target) && !logGroupDropdownRef.current?.contains(target)) {
        setLogGroupDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function setEnabled(val: boolean) {
    if (val) {
      onChange({ enabled: true, logGroupNames: selectedGroups, lookbackMinutes: config?.lookbackMinutes, maxFingerprintsPerRun: config?.maxFingerprintsPerRun })
    } else {
      onChange(config ? { ...config, enabled: false } : undefined)
    }
  }

  function setField<K extends keyof LogAnalysisConfig>(key: K, value: LogAnalysisConfig[K]) {
    onChange({ enabled, logGroupNames: selectedGroups, ...config, [key]: value })
  }

  function toggleLogGroup(name: string) {
    const next = selectedGroups.includes(name)
      ? selectedGroups.filter((g) => g !== name)
      : [...selectedGroups, name]
    onChange({ enabled, ...config, logGroupNames: next, logGroupName: undefined })
    setLogGroupSearch('')
  }

  function addCustomLogGroup(name: string) {
    if (!name.trim() || selectedGroups.includes(name.trim())) return
    const next = [...selectedGroups, name.trim()]
    onChange({ enabled, ...config, logGroupNames: next, logGroupName: undefined })
    setLogGroupSearch('')
  }

  function removeLogGroup(name: string) {
    const next = selectedGroups.filter((g) => g !== name)
    onChange({ enabled, ...config, logGroupNames: next, logGroupName: undefined })
  }

  return (
    <div className="border-t border-[var(--color-cards-card-stroke)] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <ScanSearch size={13} className="text-[var(--color-fonts-font-color-support)]" />
        <p className="text-xs font-medium text-[var(--color-fonts-font-color-support)] flex-1">
          Log Analysis
        </p>
        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            enabled ? 'bg-[var(--color-buttons-button-primary)]' : 'bg-[var(--color-cards-card-stroke)]'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-3' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-xs text-[var(--color-fonts-font-color-support)]">
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {enabled && (
        <div className="space-y-3 mt-3">
          {/* Multi-select log group picker */}
          <div>
            <label className={labelCls}>CloudWatch Log Groups *</label>

            {/* Selected chips */}
            {selectedGroups.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {selectedGroups.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-xs bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] border border-[var(--color-cards-card-stroke)]"
                  >
                    <span className="max-w-[200px] truncate">{g}</span>
                    <button
                      type="button"
                      onClick={() => removeLogGroup(g)}
                      className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search / add input */}
              <div className="relative">
              <div
                className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded border transition-colors ${
                  logGroupDropdownOpen
                    ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-cards-card-background)]'
                    : 'border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] hover:border-[var(--color-buttons-button-primary)]'
                }`}
              >
                <Search size={11} className="shrink-0 text-[var(--color-fonts-font-color-support)]" />
                <input
                  ref={logGroupInputRef}
                  className="flex-1 bg-transparent text-xs text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none"
                  placeholder="Search or type a log group name…"
                  value={logGroupSearch}
                  onFocus={() => setLogGroupDropdownOpen(true)}
                  onChange={(e) => setLogGroupSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setLogGroupDropdownOpen(false); setLogGroupSearch('') }
                    if (e.key === 'Enter' && logGroupSearch.trim()) {
                      addCustomLogGroup(logGroupSearch)
                      setLogGroupDropdownOpen(false)
                    }
                  }}
                />
                {logGroupsFetching && (
                  <span className="shrink-0 text-[10px] text-[var(--color-fonts-font-color-support)] animate-pulse">
                    loading…
                  </span>
                )}
              </div>

              {/* Dropdown */}
              {logGroupDropdownOpen && (
                <div
                  ref={logGroupDropdownRef}
                  className="absolute z-50 mt-1 w-full rounded border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] shadow-lg max-h-48 overflow-auto py-0.5"
                >
                  {logGroupsError && (
                    <p className="px-3 py-2 text-xs text-red-400">
                      Could not load log groups — check AWS config.
                    </p>
                  )}
                  {!logGroupsError && logGroupOptions.length === 0 && !logGroupsFetching && (
                    <p className="px-3 py-2 text-xs text-[var(--color-fonts-font-color-support)]">
                      No log groups found. Type a name to add it manually.
                    </p>
                  )}
                  {logGroupOptions.map((g) => {
                    const isSelected = selectedGroups.includes(g.name)
                    return (
                      <button
                        key={g.name}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); toggleLogGroup(g.name) }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-tables-table-hover)] text-left ${
                          isSelected
                            ? 'text-[var(--color-fonts-font-color-primary)] font-medium'
                            : 'text-[var(--color-fonts-font-color-support)]'
                        }`}
                      >
                        <Check size={10} className={`shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                        <span className="flex-1 truncate">{g.name}</span>
                        {g.retentionDays && (
                          <span className="text-[10px] text-[var(--color-fonts-font-color-support)] shrink-0">
                            {g.retentionDays}d
                          </span>
                        )}
                      </button>
                    )
                  })}
                  {logGroupsData?.hasMore && (
                    <p className="px-3 py-1.5 text-[10px] text-[var(--color-fonts-font-color-support)] italic">
                      More groups available — type a prefix to filter.
                    </p>
                  )}
                  {/* Add a custom name not returned by AWS */}
                  {logGroupSearch.trim() && !logGroupOptions.some((g) => g.name === logGroupSearch.trim()) && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addCustomLogGroup(logGroupSearch); setLogGroupDropdownOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-buttons-button-primary)] hover:bg-[var(--color-tables-table-hover)] text-left"
                    >
                      <Plus size={10} className="shrink-0" />
                      Add &ldquo;{logGroupSearch.trim()}&rdquo;
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
              Select one or more groups from AWS, or type a name and press Enter.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Lookback (minutes)</label>
              <Input
                type="number"
                min={5}
                max={1440}
                className="w-full"
                value={config?.lookbackMinutes ?? ''}
                onChange={(e) =>
                  setField('lookbackMinutes', e.target.value ? parseInt(e.target.value, 10) : undefined)
                }
                placeholder="30"
              />
            </div>
            <div>
              <label className={labelCls}>Max fingerprints / run</label>
              <Input
                type="number"
                min={1}
                max={50}
                className="w-full"
                value={config?.maxFingerprintsPerRun ?? ''}
                onChange={(e) =>
                  setField('maxFingerprintsPerRun', e.target.value ? parseInt(e.target.value, 10) : undefined)
                }
                placeholder="5"
              />
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                Caps AI triage calls per scheduler run.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EnvironmentsTab({
  customerId,
  cloudAccountId,
  onCloudAccountChange,
  environments,
  onChange,
}: {
  customerId: string
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
        <Select
          value={cloudAccountId}
          onChange={onCloudAccountChange}
          placeholder="— None —"
          options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }))}
        />
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
          customerId={customerId}
          env={env}
          onChange={(updated) => updateEnv(idx, updated)}
          onRemove={() => removeEnv(idx)}
        />
      ))}
    </div>
  )
}

function ProductTeamsTab({ productId }: { productId: string }) {
  const qc = useQueryClient()

  const { data: allTeams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams').then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: assignedTeams = [], isLoading: assignedLoading } = useQuery<Team[]>({
    queryKey: ['product-teams', productId],
    queryFn: () => api.get(`/teams/by-product/${productId}`).then((r) => r.data),
    enabled: !!productId,
    staleTime: 10_000,
  })

  const assignedIds = useMemo(() => new Set(assignedTeams.map((t) => t.id)), [assignedTeams])
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  const assignMutation = useMutation({
    mutationFn: ({ teamId, assign }: { teamId: string; assign: boolean }) =>
      assign
        ? api.put(`/teams/${teamId}/products/${productId}`)
        : api.delete(`/teams/${teamId}/products/${productId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-teams', productId] })
    },
  })

  const isLoading = teamsLoading || assignedLoading

  if (!productId) {
    return (
      <p className="text-xs text-[var(--color-fonts-font-color-support)] py-6 text-center">
        Save the product first to manage team assignments.
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 skeleton-shimmer rounded-[var(--border-radius-card)]" />
        ))}
      </div>
    )
  }

  if (allTeams.length === 0) {
    return (
      <p className="text-xs text-[var(--color-fonts-font-color-support)] py-6 text-center">
        No teams exist yet. Create teams in <strong>Settings → Teams</strong> first.
      </p>
    )
  }

  const roleLabel: Record<string, string> = {
    productOwner: 'Product Owner',
    engineering: 'Engineering',
    devops: 'DevOps',
    operations: 'Operations',
    qa: 'QA',
    security: 'Security',
    supportQueue: 'Support Queue',
  }

  return (
    <div className="space-y-2">
      {allTeams.map((team) => {
        const isAssigned = assignedIds.has(team.id)
        const isExpanded = expandedTeam === team.id
        const isPending = assignMutation.isPending && assignMutation.variables?.teamId === team.id

        return (
          <div
            key={team.id}
            className={`border rounded-[var(--border-radius-card)] overflow-hidden transition-colors ${
              isAssigned
                ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-inputs-input-background)]'
                : 'border-[var(--color-cards-card-stroke)] bg-[var(--color-inputs-input-background)]'
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-fonts-font-color-headings)] truncate">
                  {team.name}
                </p>
                {team.description && (
                  <p className="text-[11px] text-[var(--color-fonts-font-color-support)] truncate">
                    {team.description}
                  </p>
                )}
              </div>
              {isAssigned && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                  style={{
                    background: 'var(--color-tags-success-background)',
                    color: 'var(--color-tags-font-success)',
                  }}
                >
                  Assigned
                </span>
              )}
              <Button
                size="sm"
                variant={isAssigned ? 'secondary' : 'primary'}
                disabled={isPending}
                loading={isPending}
                onClick={() => assignMutation.mutate({ teamId: team.id, assign: !isAssigned })}
              >
                {isAssigned ? 'Unassign' : 'Assign'}
              </Button>
            </div>

            {isExpanded && team.members && team.members.length > 0 && (
              <div className="border-t border-[var(--color-cards-card-stroke)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-2">
                  Members
                </p>
                <div className="space-y-1">
                  {team.members.map((m, idx) => {
                    const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || m.keycloakUserId
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                          style={{
                            background: 'var(--color-tags-neutral-background)',
                            color: 'var(--color-tags-font-neutral)',
                          }}
                        >
                          {roleLabel[m.role] ?? m.role}
                        </span>
                        <span className="text-[var(--color-fonts-font-color-primary)] truncate">{name}</span>
                        {m.email && (
                          <span className="text-[var(--color-fonts-font-color-support)] truncate">{m.email}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {isExpanded && (!team.members || team.members.length === 0) && (
              <div className="border-t border-[var(--color-cards-card-stroke)] px-4 py-3">
                <p className="text-xs text-[var(--color-fonts-font-color-support)]">No members in this team.</p>
              </div>
            )}
          </div>
        )
      })}
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
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>

        <div className="flex gap-1 px-5 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          {MODAL_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
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
          {tab === 'teams' && <ProductTeamsTab productId={form.productId} />}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-cards-card-stroke)] shrink-0">
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={!form.productId.trim() || !form.displayName.trim() || isSaving}
            loading={isSaving}
          >
            Save
          </Button>
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null)

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
            <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
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
          <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => onEdit(customer)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={13} />}
            onClick={() => setConfirmDelete(true)}
            disabled={isDeleting}
          >
            Delete
          </Button>
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
                  <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                    {p.productId}
                  </code>
                  {Array.isArray(p.metadata?.repos) && (p.metadata.repos as string[]).length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      {(p.metadata.repos as string[]).length} repo
                      {(p.metadata.repos as string[]).length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<X size={12} />}
                    onClick={() => setUnlinkTarget(p.productId)}
                    disabled={unlinkMutation.isPending}
                    className="ml-auto"
                  >
                    Unlink
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Link new product */}
          {available.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-cards-card-stroke)]">
              <Select
                value={linkProductId}
                onChange={setLinkProductId}
                placeholder="— Link a product —"
                options={available.map((p) => ({ value: p.productId, label: `${p.displayName} (${p.productId})` }))}
                className="flex-1"
              />
              <Button
                variant="primary"
                size="sm"
                icon={<Link2 size={13} />}
                onClick={() => linkProductId && linkMutation.mutate(linkProductId)}
                disabled={!linkProductId || linkMutation.isPending}
                loading={linkMutation.isPending}
              >
                Link
              </Button>
            </div>
          )}

          {available.length === 0 && !linkedLoading && allProducts.length > 0 && linked.length > 0 && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] italic pt-2 border-t border-[var(--color-cards-card-stroke)]">
              All available products are already linked.
            </p>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Customer"
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => { setConfirmDelete(false); onDelete(customer.customerId) }}
          onCancel={() => setConfirmDelete(false)}
        >
          Are you sure you want to delete <strong>{customer.name}</strong> ({customer.customerId})? This action cannot be undone.
        </ConfirmDialog>
      )}

      {unlinkTarget && (
        <ConfirmDialog
          title="Unlink Product"
          variant="danger"
          confirmLabel="Unlink"
          onConfirm={() => { const id = unlinkTarget; setUnlinkTarget(null); unlinkMutation.mutate(id) }}
          onCancel={() => setUnlinkTarget(null)}
        >
          Are you sure you want to unlink <strong>{unlinkTarget}</strong> from {customer.name}?
        </ConfirmDialog>
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
  const { toast, setToast, addToast } = useToast()
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
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="w-64"
        />
        <Button size="sm" variant="primary" icon={<Plus size={13} />} className="ml-auto" onClick={() => setAddOpen(true)}>
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

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

// ── Products tab ──────────────────────────────────────────────────────────────

function ProductsTab() {
  const qc = useQueryClient()
  const { toast, setToast, addToast } = useToast()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<ProductConfig | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<ProductConfig | null>(null)

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
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-64"
        />
        <Button size="sm" variant="primary" icon={<Plus size={13} />} className="ml-auto" onClick={() => setAddOpen(true)}>
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
                  <code className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                    {p.productId}
                  </code>
                  {Array.isArray(p.metadata?.repos) && (p.metadata.repos as string[]).length > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      {(p.metadata.repos as string[]).length} repo
                      {(p.metadata.repos as string[]).length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {p.git?.platform && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
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
                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditProduct(p)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={() => setConfirmDeleteProduct(p)}
                  disabled={deletingId === p.productId}
                >
                  Delete
                </Button>
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

      {confirmDeleteProduct && (
        <ConfirmDialog
          title="Delete Product"
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => { const p = confirmDeleteProduct; setConfirmDeleteProduct(null); deleteMutation.mutate(p.productId) }}
          onCancel={() => setConfirmDeleteProduct(null)}
          isPending={deletingId === confirmDeleteProduct.productId}
        >
          Are you sure you want to delete <strong>{confirmDeleteProduct.displayName}</strong> ({confirmDeleteProduct.productId})? This action cannot be undone.
        </ConfirmDialog>
      )}

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      )}
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
