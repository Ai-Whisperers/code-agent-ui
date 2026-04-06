import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Trash2, ToggleLeft, ToggleRight, Brain, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { FilterSelect } from '@/components/ui/FilterSelect'
import api from '@/lib/api'
import type { MemoryEntry } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function MemoryDetailModal({
  entry,
  onClose,
}: {
  entry: MemoryEntry
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-cards-card-stroke)]">
          <div className="flex items-center gap-3">
            <Brain size={18} className="text-[var(--color-fonts-font-color-support)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
                {entry.workspace}/{entry.repoSlug}
              </p>
              <p className="text-xs text-[var(--color-fonts-font-color-support)]">
                {formatDate(entry.createdAt)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="xs" onClick={onClose} aria-label="Close" icon={<X size={15} />} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap leading-relaxed">
            {entry.content}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--color-cards-card-stroke)]">
          <span
            className={`text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] font-medium ${
              entry.active
                ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
                : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
            }`}
          >
            {entry.active ? 'Active' : 'Inactive'}
          </span>
          <p className="text-xs text-[var(--color-fonts-font-color-support)]">
            ID: {entry.id}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MemoriesPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<MemoryEntry | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MemoryEntry | null>(null)
  const [filterWorkspace, setFilterWorkspace] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const { data: memories, isLoading } = useQuery<MemoryEntry[]>({
    queryKey: ['memories'],
    queryFn: () => api.get('/memories').then((r) => r.data).catch(() => []),
  })

  const toggleMutation = useMutation({
    mutationFn: (entry: MemoryEntry) =>
      api.patch(`/memories/${entry.id}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memories'] }),
    onError: () => setToast({ message: 'Failed to update memory.', variant: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/memories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['memories'] })
      setPendingDelete(null)
      setToast({ message: 'Memory deleted.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to delete memory.', variant: 'error' }),
  })

  const list = Array.isArray(memories) ? memories : []

  const workspaces = Array.from(new Set(list.map((m) => m.workspace))).sort()

  const filtered = list.filter((m) => {
    if (filterWorkspace && m.workspace !== filterWorkspace) return false
    if (filterActive === 'active' && !m.active) return false
    if (filterActive === 'inactive' && m.active) return false
    return true
  })

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Memories"
        subtitle="Agent-generated memories used to personalise AI behaviour per repository."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <FilterSelect
          value={filterWorkspace}
          onChange={setFilterWorkspace}
          placeholder="All workspaces"
          options={workspaces.map((w) => ({ value: w, label: w }))}
        />

        <FilterSelect
          value={filterActive === 'all' ? '' : filterActive}
          onChange={(v) => setFilterActive((v || 'all') as 'all' | 'active' | 'inactive')}
          placeholder="All statuses"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />

        <span className="ml-auto text-xs text-[var(--color-fonts-font-color-support)]">
          {!isLoading && list.length > 0 && `${filtered.length} of ${list.length}`}
        </span>
      </div>

      {/* Table */}
      <TableCard
        className="flex-1 min-h-0"
        title="Memories"
        subtitle={isLoading ? '…' : `${filtered.length} of ${list.length} entries`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-36">
                <Tooltip text="Git workspace slug" position="bottom">Workspace</Tooltip>
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-36">
                <Tooltip text="Repository slug" position="bottom">Repository</Tooltip>
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                <Tooltip text="Agent-generated memory content" position="bottom">Content</Tooltip>
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-40">
                <Tooltip text="When this memory entry was created" position="bottom">Created</Tooltip>
              </th>
              <th className="text-center px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-24">
                <Tooltip text="Active entries are considered during agent reasoning" position="bottom">Status</Tooltip>
              </th>
              <th className="px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)] last:border-0">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-2">
                        <div className="h-4 skeleton-shimmer rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-[var(--color-fonts-font-color-support)]"
                    >
                      {list.length === 0 ? 'No memory entries yet.' : 'No entries match the current filters.'}
                    </td>
                  </tr>
                )
              : filtered.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] last:border-0 hover:bg-[var(--color-tables-table-hover)] transition-colors cursor-pointer"
                    onClick={() => setSelected(entry)}
                  >
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-primary)] font-medium">
                      {entry.workspace}
                    </td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-primary)]">
                      {entry.repoSlug}
                    </td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)] max-w-xs">
                      <span className="line-clamp-2">{entry.content}</span>
                    </td>
                    <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        title={entry.active ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleMutation.mutate(entry)}
                        disabled={toggleMutation.isPending}
                        className="inline-flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
                      >
                        {entry.active ? (
                          <ToggleRight
                            size={22}
                            className="text-[var(--color-tags-font-success)]"
                          />
                        ) : (
                          <ToggleLeft
                            size={22}
                            className="text-[var(--color-fonts-font-color-support)]"
                          />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={<Trash2 size={14} />}
                        onClick={() => setPendingDelete(entry)}
                        className="hover:bg-[var(--color-tags-critical-background)] hover:text-[var(--color-tags-font-critical)]"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </TableCard>

      {selected && (
        <MemoryDetailModal entry={selected} onClose={() => setSelected(null)} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete memory?"
          confirmLabel="Delete"
          variant="danger"
          icon={<Trash2 size={16} />}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        >
          This action cannot be undone. The memory entry will be permanently removed.
        </ConfirmDialog>
      )}
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </main>
  )
}
