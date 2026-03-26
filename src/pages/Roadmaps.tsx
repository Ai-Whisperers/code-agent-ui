import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Trash2, MapPin, Loader2, AlertTriangle, Pencil, X, Check, Settings2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { Roadmap } from '@/types/api'

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
  'w-full px-3 py-2 text-sm rounded-[var(--border-radius-input)] bg-[var(--color-surface-surface-2)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-2 focus:ring-[var(--color-buttons-button-primary)]'

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
      <div className="w-full max-w-md rounded-[var(--border-radius-card)] bg-[var(--color-surface-surface-1)] shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[var(--color-fonts-font-color-headings)] font-semibold">
            {initial?.name ? 'Edit Roadmap' : 'New Roadmap'}
          </h2>
          <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]">
            <X size={18} />
          </button>
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
            <button
              type="button"
              onClick={() => setShowIssueTypes((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            >
              <Settings2 size={13} />
              Jira issue types
              <span className="opacity-60 ml-1">{showIssueTypes ? '▲' : '▼'}</span>
            </button>

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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
          >
            Cancel
          </button>
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
      setDeleteConfirm(null)
    },
  })

  const list = Array.isArray(roadmaps) ? roadmaps : []

  return (
    <main>
      <PageHeader
        title="Roadmap"
        subtitle="Manage product roadmaps linked to Jira labels."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
          >
            <Plus size={15} />
            New Roadmap
          </button>
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
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-[var(--border-radius-card)] bg-[var(--color-surface-surface-1)] border border-[var(--color-borders-border-primary)] hover:border-[var(--color-buttons-button-primary)] transition-colors cursor-pointer group"
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
                <button
                  title="Edit"
                  onClick={() => setEditTarget(rm)}
                  className="p-1.5 rounded-[var(--border-radius-button-small)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-surface-surface-2)] transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Pencil size={14} />
                </button>

                {deleteConfirm === rm.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[var(--color-tags-font-critical)] mr-1">Delete?</span>
                    <button
                      onClick={() => deleteMutation.mutate(rm.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-[var(--border-radius-button-small)] text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors"
                    >
                      {deleteMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="p-1.5 rounded-[var(--border-radius-button-small)] text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-surface-surface-2)] transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    title="Delete"
                    onClick={() => setDeleteConfirm(rm.id)}
                    className="p-1.5 rounded-[var(--border-radius-button-small)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
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

      {createMutation.isError && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-[var(--border-radius-card)] bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] text-sm">
          <AlertTriangle size={15} />
          Failed to create roadmap. Please try again.
        </div>
      )}
    </main>
  )
}
