import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Plus, Trash2, Target, Loader2, AlertTriangle, Pencil, X, Settings2, Link2,
  ExternalLink, Info,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { ChipInput } from '@/components/ui/ChipInput'
import api from '@/lib/api'
import type { Scope, ScopeLinkedProduct, LabelPreviewItem } from '@/types/api'

interface AgentSetting { key: string; value: string }

interface ScopeFormValues {
  name: string
  labels: string[]
  epicIssuetype: string
  featureIssuetype: string
  userstoryIssuetype: string
}

const INPUT_CLS =
  'w-full px-3 py-2 text-sm rounded bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-2 focus:ring-[var(--color-buttons-button-primary)]'

const LABEL_CLS = 'block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1'

function Field({
  label, value, onChange, placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLS} />
      {hint && <p className="mt-1 text-xs text-[var(--color-fonts-font-color-support)]">{hint}</p>}
    </div>
  )
}

// ── Live preview table ────────────────────────────────────────────────────────

function LabelPreviewTable({ labels, jiraBaseUrl }: { labels: string[]; jiraBaseUrl: string }) {
  const { data, isFetching, isError } = useQuery<LabelPreviewItem[]>({
    queryKey: ['scope-preview-labels', labels],
    queryFn: () => {
      const params = labels.map((l) => `labels=${encodeURIComponent(l)}`).join('&')
      return api.get(`/scope/preview-labels?${params}`).then((r) => r.data)
    },
    enabled: labels.length > 0,
    staleTime: 30_000,
  })

  if (labels.length === 0) return null

  if (isFetching) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)] mt-2">
        <Loader2 size={12} className="animate-spin" />
        Loading preview…
      </div>
    )
  }

  if (isError) {
    return (
      <p className="mt-2 text-xs text-[var(--color-tags-font-critical)]">
        Failed to load preview. Check Jira connectivity.
      </p>
    )
  }

  const items = Array.isArray(data) ? data : []

  if (items.length === 0) {
    return (
      <p className="mt-2 text-xs text-[var(--color-fonts-font-color-support)] italic">
        No issues found for the given labels.
      </p>
    )
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">
        {items.length} matching issue{items.length !== 1 ? 's' : ''} found
      </p>
      <div className="max-h-56 overflow-y-auto rounded border border-[var(--color-borders-border-primary)]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-cards-card-background-hover)] border-b border-[var(--color-borders-border-primary)]">
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                <Tooltip text="Jira issue key" position="bottom"><span>Key</span></Tooltip>
              </th>
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                <Tooltip text="Issue title from Jira" position="bottom"><span>Summary</span></Tooltip>
              </th>
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                <Tooltip text="Jira workflow status" position="bottom"><span>Status</span></Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.issueKey} className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)]">
                <td className="px-2 py-1 whitespace-nowrap">
                  {jiraBaseUrl ? (
                    <a
                      href={`${jiraBaseUrl}/browse/${item.issueKey}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-[var(--color-fonts-font-color-brand)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.issueKey}
                      <ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="font-mono text-[var(--color-fonts-font-color-brand)]">{item.issueKey}</span>
                  )}
                </td>
                <td className="px-2 py-1 max-w-xs">
                  <span className="truncate block text-[var(--color-fonts-font-color-primary)]">{item.summary}</span>
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {item.status ? (
                    <span className="inline-flex items-center px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      {item.status}
                    </span>
                  ) : (
                    <span className="text-[var(--color-fonts-font-color-support)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Form dialog ───────────────────────────────────────────────────────────────

function ScopeFormDialog({
  initial,
  defaultIssuetypes,
  jiraBaseUrl,
  onSubmit,
  onClose,
  isPending,
}: {
  initial?: Partial<ScopeFormValues>
  defaultIssuetypes: { epic: string; feature: string; story: string }
  jiraBaseUrl: string
  onSubmit: (v: ScopeFormValues) => void
  onClose: () => void
  isPending: boolean
}) {
  const [name,    setName]    = useState(initial?.name  ?? '')
  const [labels,  setLabels]  = useState<string[]>(initial?.labels ?? [])
  const [epic,    setEpic]    = useState(initial?.epicIssuetype        ?? defaultIssuetypes.epic)
  const [feature, setFeature] = useState(initial?.featureIssuetype     ?? defaultIssuetypes.feature)
  const [story,   setStory]   = useState(initial?.userstoryIssuetype   ?? defaultIssuetypes.story)
  const [showIssueTypes, setShowIssueTypes] = useState(false)

  const valid = name.trim().length > 0 && labels.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[var(--color-fonts-font-color-headings)] font-semibold">
            {initial?.name ? 'Edit Scope' : 'New Scope'}
          </h2>
          <Tooltip text="Close without saving">
            <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]">
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        <div className="space-y-4">
          <Field label="Name" value={name} onChange={setName} placeholder="Q1 2026 Product Scope" />

          <div>
            <ChipInput
              label="Jira Labels"
              value={labels}
              onChange={setLabels}
              placeholder="scope-q1-2026"
              hint="Press Enter or Tab to add a label. Jira issues tagged with ANY of these labels will be included."
            />
            {/* Live preview */}
            <LabelPreviewTable labels={labels} jiraBaseUrl={jiraBaseUrl} />
          </div>

          <div>
            <Tooltip text="Override the Jira issue type names used when syncing this scope">
              <button
                type="button"
                onClick={() => setShowIssueTypes((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
              >
                <Settings2 size={13} />
                Jira issue types
                <span className="opacity-60 ml-1">{showIssueTypes ? '▲' : '▼'}</span>
              </button>
            </Tooltip>

            {showIssueTypes && (
              <div className="mt-3 space-y-3 pl-2 border-l-2 border-[var(--color-borders-border-primary)]">
                <p className="text-xs text-[var(--color-fonts-font-color-support)]">
                  Override the Jira issue type names used when syncing this scope.
                  Defaults come from System Settings.
                </p>
                <Field label="Epic issue type"       value={epic}    onChange={setEpic}    placeholder={defaultIssuetypes.epic} />
                <Field label="Feature issue type"    value={feature} onChange={setFeature} placeholder={defaultIssuetypes.feature} />
                <Field label="User Story issue type" value={story}   onChange={setStory}   placeholder={defaultIssuetypes.story} />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Tooltip text="Discard changes and close">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              Cancel
            </button>
          </Tooltip>
          <Tooltip text={initial?.name ? 'Save changes to this scope' : 'Create scope and sync issues from Jira'}>
            <button
              disabled={!valid || isPending}
              onClick={() => onSubmit({
                name: name.trim(), labels,
                epicIssuetype: epic.trim(), featureIssuetype: feature.trim(), userstoryIssuetype: story.trim(),
              })}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {initial?.name ? 'Save' : 'Create'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

// ── ProductLinkerDialog ───────────────────────────────────────────────────────

function ProductLinkerDialog({ scope, onClose }: { scope: Scope; onClose: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: linked = [] } = useQuery<ScopeLinkedProduct[]>({
    queryKey: ['scope-products', scope.id],
    queryFn: () => api.get(`/scope/${scope.id}/products`).then((r) => r.data),
  })

  interface AvailableProduct { productId: string; displayName: string }
  const { data: allProducts = [] } = useQuery<AvailableProduct[]>({
    queryKey: ['all-products'],
    queryFn: () => api.get('/registry/products').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  })

  const linkedIds = new Set(linked.map((p) => p.productId))

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allProducts.filter(
      (p) => !linkedIds.has(p.productId) && p.displayName.toLowerCase().includes(q),
    )
  }, [allProducts, linkedIds, search])

  const linkMutation = useMutation({
    mutationFn: (productId: string) =>
      api.put(`/scope/${scope.id}/products/${encodeURIComponent(productId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scope-products', scope.id] }),
  })

  const unlinkMutation = useMutation({
    mutationFn: (productId: string) =>
      api.delete(`/scope/${scope.id}/products/${encodeURIComponent(productId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scope-products', scope.id] }),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              Linked Products
            </h2>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
              {scope.name} — AI improvements will use these products' knowledge base & code index.
            </p>
          </div>
          <Tooltip text="Close">
            <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]">
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        <div className="mb-4">
          {linked.length === 0 ? (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] italic">No products linked yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {linked.map((p) => (
                <span
                  key={p.productId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                >
                  {p.displayName}
                  <Tooltip text={`Unlink ${p.displayName} from this scope`}>
                    <button
                      onClick={() => unlinkMutation.mutate(p.productId)}
                      disabled={unlinkMutation.isPending}
                      className="hover:text-red-500 transition-colors"
                    >
                      {unlinkMutation.isPending && unlinkMutation.variables === p.productId
                        ? <Loader2 size={10} className="animate-spin" />
                        : <X size={10} />}
                    </button>
                  </Tooltip>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-borders-border-primary)] pt-3">
          <label className={LABEL_CLS}>Add product</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className={INPUT_CLS + ' mb-2'}
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] px-1">
                {allProducts.length === 0 ? 'No products configured.' : 'All products already linked.'}
              </p>
            ) : (
              filtered.slice(0, 20).map((p) => (
                <button
                  key={p.productId}
                  onClick={() => linkMutation.mutate(p.productId)}
                  disabled={linkMutation.isPending && linkMutation.variables === p.productId}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-left rounded-md hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
                >
                  <span className="text-[var(--color-fonts-font-color-primary)]">{p.displayName}</span>
                  {linkMutation.isPending && linkMutation.variables === p.productId
                    ? <Loader2 size={11} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
                    : <Plus size={11} className="text-[var(--color-fonts-font-color-support)]" />}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ScopesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<Scope | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Scope | null>(null)
  const [linkTarget,   setLinkTarget]   = useState<Scope | null>(null)

  const { data: scopes, isLoading } = useQuery<Scope[]>({
    queryKey: ['scopes'],
    queryFn: () => api.get('/scope').then((r) => r.data).catch(() => []),
    refetchInterval: 30_000,
  })

  const { data: settingsList } = useQuery<AgentSetting[]>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  })
  const settingMap = Object.fromEntries((settingsList ?? []).map((s) => [s.key, s.value]))
  const defaultIssuetypes = {
    epic:    settingMap['roadmap.jira.epic-issuetype']       ?? 'Epic',
    feature: settingMap['roadmap.jira.feature-issuetype']    ?? 'Story',
    story:   settingMap['roadmap.jira.userstory-issuetype']  ?? 'Sub-task',
  }

  // Get Jira base URL for linking
  const { data: mcpConfig } = useQuery<{ jira?: { baseUrl?: string } }>({
    queryKey: ['mcp-system-config'],
    queryFn: () => api.get('/mcp/system-config').then((r) => r.data).catch(() => ({})),
    staleTime: 5 * 60_000,
  })
  const jiraBaseUrl = mcpConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  const createMutation = useMutation({
    mutationFn: (body: ScopeFormValues) => api.post('/scope', body).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['scopes'] })
      setShowCreate(false)
      if (data?.id) navigate({ to: `/metrics/scope/${data.id}` })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & ScopeFormValues) =>
      api.put(`/scope/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scopes'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scope/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scopes'] })
      setDeleteTarget(null)
    },
  })

  const list = Array.isArray(scopes) ? scopes : []

  return (
    <main>
      <PageHeader
        title="Scope"
        subtitle="Manage product scopes linked to Jira labels."
        actions={
          <Tooltip text="Create a new scope linked to a Jira label" position="bottom">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
            >
              <Plus size={15} />
              New Scope
            </button>
          </Tooltip>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <Target size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No scopes yet</p>
          <p className="text-sm">Create a scope to start tracking Jira Epics and their readiness.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((sc) => (
            <div
              key={sc.id}
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] hover:border-[var(--color-buttons-button-primary)] transition-colors cursor-pointer group"
              onClick={() => navigate({ to: `/metrics/scope/${sc.id}` })}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Target size={16} className="text-[var(--color-fonts-font-color-brand)] shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[var(--color-fonts-font-color-primary)] truncate">
                    {sc.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {(sc.labels?.length > 0 ? sc.labels : sc.label ? [sc.label] : []).map((lbl) => (
                      <code
                        key={lbl}
                        className="text-[10px] font-mono px-1.5 py-0 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] border border-[var(--color-borders-border-primary)]"
                      >
                        {lbl}
                      </code>
                    ))}
                    <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                      {sc.epicIssuetype} / {sc.featureIssuetype} / {sc.userstoryIssuetype}
                      {' · '}
                      Created {new Date(sc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Tooltip text="Link products — AI improvements will use the products' knowledge base & code index">
                  <button
                    onClick={() => setLinkTarget(sc)}
                    className="p-1.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Link2 size={14} />
                  </button>
                </Tooltip>
                <Tooltip text="Edit scope name, labels and issue type mappings">
                  <button
                    onClick={() => setEditTarget(sc)}
                    className="p-1.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Pencil size={14} />
                  </button>
                </Tooltip>

                <Tooltip text="Delete this scope and all its synced items">
                  <button
                    onClick={() => setDeleteTarget(sc)}
                    className="p-1.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <ScopeFormDialog
          defaultIssuetypes={defaultIssuetypes}
          jiraBaseUrl={jiraBaseUrl}
          onSubmit={(v) => createMutation.mutate(v)}
          onClose={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {editTarget && (
        <ScopeFormDialog
          initial={{
            name:               editTarget.name,
            labels:             editTarget.labels?.length > 0 ? editTarget.labels : editTarget.label ? [editTarget.label] : [],
            epicIssuetype:      editTarget.epicIssuetype,
            featureIssuetype:   editTarget.featureIssuetype,
            userstoryIssuetype: editTarget.userstoryIssuetype,
          }}
          defaultIssuetypes={defaultIssuetypes}
          jiraBaseUrl={jiraBaseUrl}
          onSubmit={(v) => updateMutation.mutate({ id: editTarget.id, ...v })}
          onClose={() => setEditTarget(null)}
          isPending={updateMutation.isPending}
        />
      )}

      {linkTarget && (
        <ProductLinkerDialog scope={linkTarget} onClose={() => setLinkTarget(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete scope?"
          variant="danger"
          icon={<Trash2 size={16} />}
          confirmLabel="Delete"
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        >
          <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{deleteTarget.name}</span>
          {' '}and all its synced items, reviews, and proposals will be permanently deleted.
          This action cannot be undone.
        </ConfirmDialog>
      )}

      {createMutation.isError && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] text-sm">
          <AlertTriangle size={15} />
          Failed to create scope. Please try again.
        </div>
      )}
    </main>
  )
}
