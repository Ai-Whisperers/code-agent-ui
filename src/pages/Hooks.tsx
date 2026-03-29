import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { RadioGroup } from '@/components/ui/RadioGroup'
import api from '@/lib/api'
import type { AutomationHook } from '@/types/api'
import { CATEGORIES, getCategories } from '@/components/hooks/hookConstants'
import { HookCard } from '@/components/hooks/HookCard'
import { HookTypeMenu } from '@/components/hooks/HookTypeMenu'
import { HookWizard } from '@/components/hooks/HookWizard'

type TriggerCategory = typeof CATEGORIES[number]

export default function HooksPage() {
  const qc = useQueryClient()
  const [editingHook, setEditingHook] = useState<AutomationHook | null>(null)
  const [initialCategory, setInitialCategory] = useState<string | undefined>()
  const [showWizard, setShowWizard] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<TriggerCategory>('ALL')

  const { data: hooks, isLoading } = useQuery<AutomationHook[]>({
    queryKey: ['hooks'],
    queryFn: () => api.get('/settings/hooks').then(r => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: (hook: AutomationHook) => api.put(`/settings/hooks/${hook.name}`, hook),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hooks'] })
      setShowWizard(false)
      setEditingHook(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.patch(`/settings/hooks/${name}/${enabled ? 'enable' : 'disable'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hooks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/settings/hooks/${name}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hooks'] }),
  })

  const allHooks = Array.isArray(hooks) ? hooks : []
  const filtered = allHooks.filter(h => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory =
      categoryFilter === 'ALL' || getCategories(h.triggerTypes).includes(categoryFilter as Exclude<TriggerCategory, 'ALL'>)
    return matchesSearch && matchesCategory
  })

  function openNewHook(category: string) {
    setInitialCategory(category)
    setEditingHook({ name: '', enabled: false })
    setShowWizard(true)
    setShowTypeMenu(false)
  }

  function openEditHook(hook: AutomationHook) {
    setInitialCategory(undefined)
    setEditingHook(hook)
    setShowWizard(true)
  }

  function closeWizard() {
    setShowWizard(false)
    setEditingHook(null)
    setInitialCategory(undefined)
  }

  return (
    <main>
      <PageHeader
        title="Automation Hooks"
        subtitle="Configure event-driven automation triggers."
        actions={
          <div className="relative">
            <Button
              size="md"
              variant="primary"
              icon={<Plus size={13} />}
              onClick={() => setShowTypeMenu(v => !v)}
            >
              New Hook
            </Button>
            {showTypeMenu && (
              <HookTypeMenu
                onSelect={openNewHook}
                onClose={() => setShowTypeMenu(false)}
              />
            )}
          </div>
        }
      />

      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search hooks…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
          />
        </div>

        <RadioGroup
          variant="pills"
          options={CATEGORIES.map(cat => ({ value: cat, label: cat }))}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v as TriggerCategory)}
        />
      </div>

      {/* Hook list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))
        ) : allHooks.length === 0 ? (
          <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
            No hooks configured yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
            No hooks match your search.
          </div>
        ) : (
          filtered.map(hook => (
            <HookCard
              key={hook.name}
              hook={hook}
              onEdit={() => openEditHook(hook)}
              onToggle={() => toggleMutation.mutate({ name: hook.name, enabled: !hook.enabled })}
              onDelete={() => deleteMutation.mutate(hook.name)}
              isToggling={toggleMutation.isPending}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === hook.name}
            />
          ))
        )}
      </div>

      {/* Wizard */}
      {showWizard && editingHook && (
        <HookWizard
          hook={editingHook}
          initialCategory={initialCategory}
          onSave={h => saveMutation.mutate(h)}
          onCancel={closeWizard}
          isSaving={saveMutation.isPending}
        />
      )}
    </main>
  )
}
