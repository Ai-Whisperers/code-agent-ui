import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Trash2, MapPin, Loader2, AlertTriangle, Pencil, X, Settings2, Link2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import api from '@/lib/api'
import type { Roadmap, RoadmapLinkedProduct } from '@/types/api'

// A setting entry returned by GET /settings
interface AgentSetting { key: string; value: string }

interface RoadmapFormValues {
  name: string
  label: string
  epicIssuetype: string
  featureIssuetype: string
  userstoryIssuetype: string
}

const INPUT_CLS =
  'w-full px-3 py-2 text-sm rounded-[var(--border-radius-input)] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-2 focus:ring-[var(--color-buttons-button-primary)]'

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

function RoadmapFormDialog({
  initial,
  defaultIssuetypes,
  onSubmit,
  onClose,
  isPending,
}: {
  initial?: Partial<RoadmapFormValues>
  defaultIssuetypes: { epic: string; feature: string; story: string }
  onSubmit: (v: RoadmapFormValues) => void
  onClose: () => void
  isPending: boolean
}) {
  const [name,    setName]    = useState(initial?.name  ?? '')
  const [label,   setLabel]   = useState(initial?.label ?? '')
  const [epic,    setEpic]    = useState(initial?.epicIssuetype        ?? defaultIssuetypes.epic)
  const [feature, setFeature] = useState(initial?.featureIssuetype     ?? defaultIssuetypes.feature)
  const [story,   setStory]   = useState(initial?.userstoryIssuetype   ?? defaultIssuetypes.story)
  const [showIssueTypes, setShowIssueTypes] = useState(false)

  const valid = name.trim().length > 0 && label.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[var(--color-fonts-font-color-headings)] font-semibold">
            {initial?.name ? 'Edit Roadmap' : 'New Roadmap'}
          </h2>
          <Tooltip text="Close without saving">
            <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]">
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        <div className="space-y-4">
          <Field label="Name" value={name} onChange={setName} placeholder="Q1 2026 Product Roadmap" />
          <Field
            label="Jira Label"
            value={label}
            onChange={setLabel}
            placeholder="roadmap-q1-2026"
            hint="Jira issues tagged with this label will be included in the roadmap."
          />

          {/* Issue type overrides – collapsed by default */}
          <div>
            <Tooltip text="Override the Jira issue type names used when syncing this roadmap">
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
                  Override the Jira issue type names used when syncing this roadmap.
                  Defaults come from System Settings.
                </p>
                <Field label="Epic issue type"      value={epic}    onChange={setEpic}    placeholder={defaultIssuetypes.epic} />
                <Field label="Feature issue type"   value={feature} onChange={setFeature} placeholder={defaultIssuetypes.feature} />
                <Field label="User Story issue type" value={story}  onChange={setStory}   placeholder={defaultIssuetypes.story} />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Tooltip text="Discard changes and close">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              Cancel
            </button>
          </Tooltip>
          <Tooltip text={initial?.name ? 'Save changes to this roadmap' : 'Create roadmap and sync issues from Jira'}>
            <button
              disabled={!valid || isPending}
              onClick={() => onSubmit({
                name: name.trim(), label: label.trim(),
                epicIssuetype: epic.trim(), featureIssuetype: feature.trim(), userstoryIssuetype: story.trim(),
              })}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

function ProductLinkerDialog({ roadmap, onClose }: { roadmap: Roadmap; onClose: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: linked = [] } = useQuery<RoadmapLinkedProduct[]>({
    queryKey: ['roadmap-products', roadmap.id],
    queryFn: () => api.get(`/roadmap/${roadmap.id}/products`).then((r) => r.data),
  })

  // All available products from the customer registry
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
      api.put(`/roadmap/${roadmap.id}/products/${encodeURIComponent(productId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-products', roadmap.id] }),
  })

  const unlinkMutation = useMutation({
    mutationFn: (productId: string) =>
      api.delete(`/roadmap/${roadmap.id}/products/${encodeURIComponent(productId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roadmap-products', roadmap.id] }),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              Linked Products
            </h2>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
              {roadmap.name} — AI improvements will use these products' knowledge base & code index.
            </p>
          </div>
          <Tooltip text="Close">
            <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]">
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {/* Currently linked */}
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
                  <Tooltip text={`Unlink ${p.displayName} from this roadmap`}>
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

        {/* Add products */}
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

export default function RoadmapsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [showCreate,    setShowCreate]    = useState(false)
  const [editTarget,    setEditTarget]    = useState<Roadmap | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<Roadmap | null>(null)
  const [linkTarget,    setLinkTarget]    = useState<Roadmap | null>(null)

  const { data: roadmaps, isLoading } = useQuery<Roadmap[]>({
    queryKey: ['roadmaps'],
    queryFn: () => api.get('/roadmap').then((r) => r.data).catch(() => []),
    refetchInterval: 30_000,
  })

  // Load global settings to prefill issue-type defaults
  const { data: settingsList } = useQuery<AgentSetting[]>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  })
  const settingMap = Object.fromEntries((settingsList ?? []).map((s) => [s.key, s.value]))
  const defaultIssuetypes = {
    epic:    settingMap['roadmap.jira.epic-issuetype']        ?? 'Epic',
    feature: settingMap['roadmap.jira.feature-issuetype']     ?? 'Story',
    story:   settingMap['roadmap.jira.userstory-issuetype']   ?? 'Sub-task',
  }

  const createMutation = useMutation({
    mutationFn: (body: RoadmapFormValues) => api.post('/roadmap', body).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['roadmaps'] })
      setShowCreate(false)
      if (data?.id) navigate({ to: `/metrics/roadmap/${data.id}` })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & RoadmapFormValues) =>
      api.put(`/roadmap/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmaps'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/roadmap/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roadmaps'] })
      setDeleteTarget(null)
    },
  })

  const list = Array.isArray(roadmaps) ? roadmaps : []

  return (
    <main>
      <PageHeader
        title="Roadmap"
        subtitle="Manage product roadmaps linked to Jira labels."
        actions={
          <Tooltip text="Create a new roadmap linked to a Jira label">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
            >
              <Plus size={15} />
              New Roadmap
            </button>
          </Tooltip>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <MapPin size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No roadmaps yet</p>
          <p className="text-sm">Create a roadmap to start tracking Jira Epics and their readiness.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((rm) => (
            <div
              key={rm.id}
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] hover:border-[var(--color-buttons-button-primary)] transition-colors cursor-pointer group"
              onClick={() => navigate({ to: `/metrics/roadmap/${rm.id}` })}
            >
              <div className="flex items-center gap-3 min-w-0">
                <MapPin size={16} className="text-[var(--color-fonts-font-color-brand)] shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[var(--color-fonts-font-color-primary)] truncate">
                    {rm.name}
                  </p>
                  <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                    Label: <code className="font-mono">{rm.label}</code>
                    {' · '}
                    {rm.epicIssuetype} / {rm.featureIssuetype} / {rm.userstoryIssuetype}
                    {' · '}
                    Created {new Date(rm.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Tooltip text="Link products — AI improvements will use the products' knowledge base & code index">
                  <button
                    onClick={() => setLinkTarget(rm)}
                    className="p-1.5 rounded-[var(--border-radius-button-small)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Link2 size={14} />
                  </button>
                </Tooltip>
                <Tooltip text="Edit roadmap name, label and issue type mappings">
                  <button
                    onClick={() => setEditTarget(rm)}
                    className="p-1.5 rounded-[var(--border-radius-button-small)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Pencil size={14} />
                  </button>
                </Tooltip>

                <Tooltip text="Delete this roadmap and all its synced items">
                  <button
                    onClick={() => setDeleteTarget(rm)}
                    className="p-1.5 rounded-[var(--border-radius-button-small)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors opacity-0 group-hover:opacity-100"
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
        <RoadmapFormDialog
          defaultIssuetypes={defaultIssuetypes}
          onSubmit={(v) => createMutation.mutate(v)}
          onClose={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {editTarget && (
        <RoadmapFormDialog
          initial={{
            name:               editTarget.name,
            label:              editTarget.label,
            epicIssuetype:      editTarget.epicIssuetype,
            featureIssuetype:   editTarget.featureIssuetype,
            userstoryIssuetype: editTarget.userstoryIssuetype,
          }}
          defaultIssuetypes={defaultIssuetypes}
          onSubmit={(v) => updateMutation.mutate({ id: editTarget.id, ...v })}
          onClose={() => setEditTarget(null)}
          isPending={updateMutation.isPending}
        />
      )}

      {linkTarget && (
        <ProductLinkerDialog roadmap={linkTarget} onClose={() => setLinkTarget(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete roadmap?"
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
        <div className="mt-4 flex items-center gap-2 p-3 rounded-[var(--border-radius-card)] bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] text-sm">
          <AlertTriangle size={15} />
          Failed to create roadmap. Please try again.
        </div>
      )}
    </main>
  )
}
