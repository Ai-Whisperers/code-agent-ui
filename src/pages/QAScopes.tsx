import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, FlaskConical, Loader2, X, Settings2, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { Tooltip } from '@/components/ui/Tooltip'
import { ChipInput } from '@/components/ui/ChipInput'
import api from '@/lib/api'
import type { Scope, LabelPreviewItem } from '@/types/api'

interface AgentSetting { key: string; value: string }

interface ScopeFormValues {
  name: string
  labels: string[]
  epicIssuetype: string
  featureIssuetype: string
  userstoryIssuetype: string
}

type ToastState = { message: string; variant: 'success' | 'error' }

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
        placeholder={placeholder} className={INPUT_CLS} />
      {hint && <p className="mt-1 text-xs text-[var(--color-fonts-font-color-support)]">{hint}</p>}
    </div>
  )
}

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
  if (isFetching) return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)] mt-2">
      <Loader2 size={12} className="animate-spin" /> Loading preview…
    </div>
  )
  if (isError) return (
    <p className="mt-2 text-xs text-[var(--color-tags-font-critical)]">Failed to load preview.</p>
  )

  const items = Array.isArray(data) ? data : []
  if (items.length === 0) return (
    <p className="mt-2 text-xs text-[var(--color-fonts-font-color-support)] italic">No issues found.</p>
  )

  return (
    <div className="mt-2">
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">
        {items.length} matching issue{items.length !== 1 ? 's' : ''} found
      </p>
      <div className="max-h-40 overflow-y-auto rounded border border-[var(--color-borders-border-primary)]">
        <table className="w-full text-xs">
          <tbody>
            {items.map((item) => (
              <tr key={item.issueKey} className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)]">
                <td className="px-2 py-1 whitespace-nowrap">
                  {jiraBaseUrl ? (
                    <a href={`${jiraBaseUrl}/browse/${item.issueKey}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-[var(--color-fonts-font-color-brand)] hover:underline"
                      onClick={(e) => e.stopPropagation()}>
                      {item.issueKey}<ExternalLink size={9} />
                    </a>
                  ) : (
                    <span className="font-mono text-[var(--color-fonts-font-color-brand)]">{item.issueKey}</span>
                  )}
                </td>
                <td className="px-2 py-1 max-w-xs">
                  <span className="truncate block text-[var(--color-fonts-font-color-primary)]">{item.summary}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QAScopeFormDialog({
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

  const isEdit = Boolean(initial?.name)
  const valid = name.trim().length > 0 && labels.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-6 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[var(--color-fonts-font-color-headings)] font-semibold">
              {isEdit ? 'Edit QA Scope' : 'Add QA Scope'}
            </h2>
            {!isEdit && (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                Create a scope to track QA test plans for features.
              </p>
            )}
          </div>
          <Tooltip text="Close without saving">
            <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]">
              <X size={18} />
            </button>
          </Tooltip>
        </div>

        <div className="space-y-4">
          <Field label="Name" value={name} onChange={setName} placeholder="Q1 2026 QA Scope" />
          <div>
            <ChipInput
              label="Jira Labels"
              value={labels}
              onChange={setLabels}
              placeholder="scope-q1-2026"
              hint="Press Enter or Tab to add a label. Features tagged with ANY of these labels will be included."
            />
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
            <button onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors">
              Cancel
            </button>
          </Tooltip>
          <Tooltip text={isEdit ? 'Save changes to this QA scope' : 'Create QA scope and sync issues from Jira'}>
            <button
              disabled={!valid || isPending}
              onClick={() => onSubmit({ name: name.trim(), labels, epicIssuetype: epic.trim(), featureIssuetype: feature.trim(), userstoryIssuetype: story.trim() })}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save' : 'Create QA Scope'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QAScopesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<Scope | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Scope | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const { data: scopes, isLoading } = useQuery<Scope[]>({
    queryKey: ['scopes', 'qa'],
    queryFn: () => api.get('/scope?type=qa').then((r) => r.data).catch(() => []),
    refetchInterval: 30_000,
  })

  const { data: settingsList } = useQuery<AgentSetting[]>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then((r) => r.data).catch(() => []),
    staleTime: 60_000,
  })
  const settingMap = Object.fromEntries((settingsList ?? []).map((s) => [s.key, s.value]))
  const defaultIssuetypes = {
    epic:    settingMap['roadmap.jira.epic-issuetype']      ?? 'Epic',
    feature: settingMap['roadmap.jira.feature-issuetype']   ?? 'Story',
    story:   settingMap['roadmap.jira.userstory-issuetype'] ?? 'Sub-task',
  }

  const { data: mcpConfig } = useQuery<{ jira?: { baseUrl?: string } }>({
    queryKey: ['mcp-system-config'],
    queryFn: () => api.get('/mcp/system-config').then((r) => r.data).catch(() => ({})),
    staleTime: 5 * 60_000,
  })
  const jiraBaseUrl = mcpConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  const createMutation = useMutation({
    mutationFn: (body: ScopeFormValues) =>
      api.post('/scope', { ...body, scopeType: 'qa' }).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['scopes', 'qa'] })
      setShowCreate(false)
      if (data?.id) navigate({ to: `/qa/scope/${data.id}` })
    },
    onError: () => setToast({ message: 'Failed to create QA scope.', variant: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & ScopeFormValues) =>
      api.put(`/scope/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scopes', 'qa'] })
      setEditTarget(null)
      setToast({ message: 'QA scope updated.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to update QA scope.', variant: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scope/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scopes', 'qa'] })
      setDeleteTarget(null)
      setToast({ message: 'QA scope deleted.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to delete QA scope.', variant: 'error' }),
  })

  const list = Array.isArray(scopes) ? scopes : []

  return (
    <main>
      <PageHeader
        title="QA Scopes"
        subtitle="Manage QA test plans for features across your product scopes."
        actions={
          <Tooltip text="Create a new QA scope to track test plans for features" position="bottom">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
            >
              <Plus size={15} />
              Add QA Scope
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
          <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No QA scopes yet</p>
          <p className="text-sm">Add a QA scope to start tracking test plans for features.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((sc) => (
            <div
              key={sc.id}
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] hover:border-[var(--color-buttons-button-primary)] transition-colors cursor-pointer group"
              onClick={() => navigate({ to: `/qa/scope/${sc.id}` })}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FlaskConical size={16} className="text-[var(--color-fonts-font-color-brand)] shrink-0" />
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
                      {sc.featureIssuetype}
                      {' · '}
                      Created {new Date(sc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Tooltip text="Edit QA scope name, labels and issue type mappings">
                  <button
                    onClick={() => setEditTarget(sc)}
                    className="p-1.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Pencil size={14} />
                  </button>
                </Tooltip>
                <Tooltip text="Delete this QA scope and all its synced items">
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
        <QAScopeFormDialog
          defaultIssuetypes={defaultIssuetypes}
          jiraBaseUrl={jiraBaseUrl}
          onSubmit={(v) => createMutation.mutate(v)}
          onClose={() => setShowCreate(false)}
          isPending={createMutation.isPending}
        />
      )}

      {editTarget && (
        <QAScopeFormDialog
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

      {deleteTarget && (
        <ConfirmDialog
          title="Delete QA scope?"
          variant="danger"
          icon={<Trash2 size={16} />}
          confirmLabel="Delete"
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        >
          <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{deleteTarget.name}</span>
          {' '}and all its synced items and test plans will be permanently deleted.
          This action cannot be undone.
        </ConfirmDialog>
      )}

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </main>
  )
}
