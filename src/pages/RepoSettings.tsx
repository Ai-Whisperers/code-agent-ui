import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Save, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { RepoSettings } from '@/types/api'

export default function RepoSettingsPage() {
  const qc = useQueryClient()
  const [editRepo, setEditRepo] = useState<RepoSettings | null>(null)

  const { data: repos, isLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: (repo: RepoSettings) =>
      api.put(`/settings/repos/${repo.workspace}/${repo.repoSlug}`, repo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repos'] })
      setEditRepo(null)
    },
  })

  const list = Array.isArray(repos) ? repos : []

  return (
    <main>
      <PageHeader
        title="Repository Settings"
        subtitle="Manage per-repository configuration."
        actions={
          <button
            onClick={() =>
              setEditRepo({
                workspace: '',
                repoSlug: '',
                reviewEnabled: false,
                vectorEnabled: false,
                docsEnabled: false,
                upgradeEnabled: false,
                qualityReportEnabled: false,
              })
            }
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
          >
            <Plus size={15} />
            Add Repository
          </button>
        }
      />

      {editRepo && (
        <RepoEditor
          repo={editRepo}
          onSave={(r) => saveMutation.mutate(r)}
          onCancel={() => setEditRepo(null)}
          isSaving={saveMutation.isPending}
        />
      )}

      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
              {['Workspace', 'Repo', 'Review', 'Vectors', 'Docs', 'Upgrade', 'Quality', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-5 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : list.length === 0
              ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]">
                    No repositories configured yet.
                  </td>
                </tr>
              )
              : list.map((repo, i) => (
                  <tr
                    key={`${repo.workspace}/${repo.repoSlug}`}
                    className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
                      i % 2 === 0 ? 'bg-[var(--color-tables-table-row-a)]' : ''
                    }`}
                    onClick={() => setEditRepo(repo)}
                  >
                    <td className="px-4 py-3 font-medium">{repo.workspace}</td>
                    <td className="px-4 py-3">{repo.repoSlug}</td>
                    {(['reviewEnabled', 'vectorEnabled', 'docsEnabled', 'upgradeEnabled', 'qualityReportEnabled'] as const).map(
                      (key) => (
                        <td key={key} className="px-4 py-3">
                          <ToggleBadge value={repo[key]} />
                        </td>
                      ),
                    )}
                    <td className="px-4 py-3 text-[var(--color-fonts-font-color-brand)] text-xs">Edit</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </main>
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
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}

function RepoEditor({
  repo,
  onSave,
  onCancel,
  isSaving,
}: {
  repo: RepoSettings
  onSave: (r: RepoSettings) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<RepoSettings>(repo)
  const field = (name: keyof RepoSettings) => (value: string) =>
    setForm((p) => ({ ...p, [name]: value }))
  const toggle = (name: keyof RepoSettings) => (value: boolean) =>
    setForm((p) => ({ ...p, [name]: value }))

  return (
    <div className="mb-6 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-6 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-center justify-between mb-4">
        <h3>
          {form.workspace && form.repoSlug
            ? `${form.workspace} / ${form.repoSlug}`
            : 'New Repository'}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

      <div className="border-t border-[var(--color-cards-card-stroke)] pt-4 mb-4">
        {(
          [
            ['reviewEnabled', 'Code Review'],
            ['vectorEnabled', 'Vector Indexing'],
            ['docsEnabled', 'Documentation'],
            ['upgradeEnabled', 'Dependency Upgrades'],
            ['qualityReportEnabled', 'Quality Reports'],
          ] as const
        ).map(([name, label]) => (
          <Toggle key={name} label={label} value={form[name] as boolean} onChange={toggle(name)} />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
        >
          <Save size={14} />
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-sm font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
