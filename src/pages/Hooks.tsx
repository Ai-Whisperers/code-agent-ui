import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Save, X, Power } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { AutomationHook } from '@/types/api'

export default function HooksPage() {
  const qc = useQueryClient()
  const [editHook, setEditHook] = useState<AutomationHook | null>(null)

  const { data: hooks, isLoading } = useQuery<AutomationHook[]>({
    queryKey: ['hooks'],
    queryFn: () => api.get('/settings/hooks').then((r) => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: (hook: AutomationHook) =>
      api.put(`/settings/hooks/${hook.name}`, hook),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hooks'] })
      setEditHook(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.patch(`/settings/hooks/${name}/${enabled ? 'enable' : 'disable'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hooks'] }),
  })

  const list = Array.isArray(hooks) ? hooks : []

  return (
    <main>
      <PageHeader
        title="Automation Hooks"
        subtitle="Configure event-driven automation triggers."
        actions={
          <button
            onClick={() => setEditHook({ name: '', enabled: false })}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
          >
            <Plus size={15} />
            New Hook
          </button>
        }
      />

      {editHook && (
        <HookEditor
          hook={editHook}
          onSave={(h) => saveMutation.mutate(h)}
          onCancel={() => setEditHook(null)}
          isSaving={saveMutation.isPending}
        />
      )}

      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 skeleton-shimmer rounded-[var(--border-radius-card)]" />
            ))
          : list.length === 0
          ? (
            <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
              No hooks configured yet.
            </div>
          )
          : list.map((hook) => (
              <div
                key={hook.name}
                className="flex items-center justify-between bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-5 py-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)]">
                    {hook.name}
                  </p>
                  {hook.description && (
                    <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                      {hook.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      toggleMutation.mutate({ name: hook.name, enabled: !hook.enabled })
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] text-xs font-medium transition-colors ${
                      hook.enabled
                        ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] hover:opacity-80'
                        : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] hover:opacity-80'
                    }`}
                  >
                    <Power size={12} />
                    {hook.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => setEditHook(hook)}
                    className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
      </div>
    </main>
  )
}

function HookEditor({
  hook,
  onSave,
  onCancel,
  isSaving,
}: {
  hook: AutomationHook
  onSave: (h: AutomationHook) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<AutomationHook>(hook)

  return (
    <div className="mb-6 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-6 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-center justify-between mb-4">
        <h3>{form.name || 'New Hook'}</h3>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        {(
          [
            ['name', 'Hook Name'],
            ['description', 'Description'],
            ['trigger', 'Trigger'],
          ] as const
        ).map(([name, label]) => (
          <div key={name}>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
              {label}
            </label>
            <input
              type="text"
              value={form[name] ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
              className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
            />
          </div>
        ))}

        <div>
          <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
            Prompt
          </label>
          <textarea
            rows={4}
            value={form.prompt ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
            className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
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
