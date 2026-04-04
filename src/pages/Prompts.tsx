import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Save, RotateCcw, GitCompare, Code2, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import api from '@/lib/api'
import type { PromptTemplate } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

/**
 * Produces a simple line-level diff between two strings.
 * Returns an array of { type: 'same' | 'add' | 'remove', text: string }.
 */
function diffLines(a: string, b: string) {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const result: { type: 'same' | 'add' | 'remove'; text: string }[] = []

  // LCS-based diff (simple greedy for display purposes)
  let ai = 0
  let bi = 0
  while (ai < aLines.length || bi < bLines.length) {
    if (ai >= aLines.length) {
      result.push({ type: 'add', text: bLines[bi++] })
    } else if (bi >= bLines.length) {
      result.push({ type: 'remove', text: aLines[ai++] })
    } else if (aLines[ai] === bLines[bi]) {
      result.push({ type: 'same', text: aLines[ai++] })
      bi++
    } else {
      // Look ahead to find the next match
      const lookAhead = 4
      let matched = false
      for (let d = 1; d <= lookAhead && !matched; d++) {
        if (ai + d < aLines.length && aLines[ai + d] === bLines[bi]) {
          for (let k = 0; k < d; k++) result.push({ type: 'remove', text: aLines[ai++] })
          matched = true
        } else if (bi + d < bLines.length && aLines[ai] === bLines[bi + d]) {
          for (let k = 0; k < d; k++) result.push({ type: 'add', text: bLines[bi++] })
          matched = true
        }
      }
      if (!matched) {
        result.push({ type: 'remove', text: aLines[ai++] })
        result.push({ type: 'add', text: bLines[bi++] })
      }
    }
  }
  return result
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlaceholderChip({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{
        background: 'var(--color-tags-neutral-background)',
        color: 'var(--color-tags-font-neutral)',
      }}
    >
      {`{{${name}}}`}
    </span>
  )
}

function DiffView({ defaultContent, currentContent }: { defaultContent: string; currentContent: string }) {
  const lines = useMemo(() => diffLines(defaultContent, currentContent), [defaultContent, currentContent])
  const hasChanges = lines.some((l) => l.type !== 'same')

  if (!hasChanges) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-[var(--color-fonts-font-color-support)]">
        No changes from default.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <tbody>
          {lines.map((line, i) => {
            const bg =
              line.type === 'add'
                ? 'var(--color-tags-success-background)'
                : line.type === 'remove'
                ? 'var(--color-tags-danger-background)'
                : 'transparent'
            const color =
              line.type === 'add'
                ? 'var(--color-tags-font-success)'
                : line.type === 'remove'
                ? 'var(--color-tags-font-danger)'
                : 'var(--color-fonts-font-color-body)'
            const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
            return (
              <tr key={i} style={{ background: bg }}>
                <td
                  className="select-none w-4 px-2 text-right"
                  style={{ color, opacity: 0.6 }}
                >
                  {prefix}
                </td>
                <td className="px-2 py-px whitespace-pre" style={{ color }}>
                  {line.text}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = 'edit' | 'diff'

export default function PromptsPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<PromptTemplate | null>(null)
  const [editContent, setEditContent] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const { data: templates, isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['prompts'],
    queryFn: () => api.get('/settings/prompts').then((r) => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/settings/prompts/${selected!.key}`, { content: editContent }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompts'] })
      setToast({ message: 'Template saved.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to save template.', variant: 'error' }),
  })

  const resetMutation = useMutation({
    mutationFn: () => api.delete(`/settings/prompts/${selected!.key}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompts'] })
      setSelected(null)
      setEditContent('')
      setToast({ message: 'Template reset to default.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to reset template.', variant: 'error' }),
  })

  const handleSelect = (t: PromptTemplate) => {
    setSelected(t)
    setEditContent(t.content)
    setViewMode('edit')
  }

  const isDirty = selected !== null && editContent !== selected.content

  const list = (Array.isArray(templates) ? templates : []).filter((t) =>
    search === '' ||
    t.key.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <main className="flex flex-col gap-0 h-[calc(100vh-64px)]">
      <div className="px-6 pt-6 pb-4 shrink-0">
        <PageHeader
          title="Prompt Templates"
          subtitle="Manage AI prompt templates. Overridden templates take precedence over built-in defaults."
        />
      </div>

      <div className="flex gap-0 flex-1 min-h-0 px-6 pb-6">
        {/* ── Sidebar list ── */}
        <div className="w-64 shrink-0 flex flex-col gap-2 mr-5">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)]" />
            <input
              type="text"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
            />
          </div>

          {/* Template list */}
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 skeleton-shimmer rounded-[var(--border-radius-small)]" />
                ))
              : list.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => handleSelect(t)}
                    className={`w-full text-left px-3 py-2.5 rounded-[var(--border-radius-small)] transition-colors ${
                      selected?.key === t.key
                        ? 'bg-[var(--color-navigation-menu-item-active)] text-[var(--color-navigation-menu-item-hover-font)]'
                        : 'hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{t.key}</span>
                      {t.isOverride && (
                        <span
                          className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-[var(--border-radius-tag)]"
                          style={{
                            background: 'var(--color-tags-attention-background)',
                            color: 'var(--color-tags-font-attention)',
                          }}
                        >
                          custom
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-[11px] mt-0.5 truncate opacity-60">{t.description}</p>
                    )}
                  </button>
                ))}
          </div>

          <p className="text-[10px] text-[var(--color-fonts-font-color-support)] text-center">
            {list.length} template{list.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* ── Editor panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {selected ? (
            <>
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-[var(--color-fonts-font-color-headings)]">
                      {selected.key}
                    </h3>
                    {selected.isOverride && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-[var(--border-radius-tag)] font-medium"
                        style={{
                          background: 'var(--color-tags-attention-background)',
                          color: 'var(--color-tags-font-attention)',
                        }}
                      >
                        custom override
                      </span>
                    )}
                    {selected.updatedAt && (
                      <span className="text-[11px] text-[var(--color-fonts-font-color-support)]">
                        · saved {timeSince(selected.updatedAt)}
                      </span>
                    )}
                  </div>
                  {selected.description && (
                    <p className="text-sm text-[var(--color-fonts-font-color-support)] mt-0.5">
                      {selected.description}
                    </p>
                  )}
                  {selected.placeholders?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selected.placeholders.map((p) => (
                        <PlaceholderChip key={p} name={p} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Edit / Diff toggle */}
                  <div
                    className="flex rounded-[var(--border-radius-small)] border border-[var(--color-cards-card-stroke)] overflow-hidden"
                  >
                    <button
                      onClick={() => setViewMode('edit')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors"
                      style={
                        viewMode === 'edit'
                          ? { background: 'var(--color-buttons-button-primary)', color: '#fff' }
                          : { color: 'var(--color-fonts-font-color-support)' }
                      }
                    >
                      <Code2 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => setViewMode('diff')}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors"
                      style={
                        viewMode === 'diff'
                          ? { background: 'var(--color-buttons-button-primary)', color: '#fff' }
                          : { color: 'var(--color-fonts-font-color-support)' }
                      }
                    >
                      <GitCompare size={12} />
                      Diff
                    </button>
                  </div>

                  {selected.isOverride && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<RotateCcw size={13} />}
                      loading={resetMutation.isPending}
                      onClick={() => resetMutation.mutate()}
                    >
                      Reset to Default
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save size={13} />}
                    loading={saveMutation.isPending}
                    disabled={!isDirty}
                    onClick={() => saveMutation.mutate()}
                  >
                    Save
                  </Button>
                </div>
              </div>

              {/* Edit or Diff view */}
              {viewMode === 'edit' ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 w-full px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm font-mono text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
                />
              ) : (
                <div className="flex-1 overflow-y-auto rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)]">
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
                    <GitCompare size={13} className="text-[var(--color-fonts-font-color-support)]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">
                      Current vs Default
                    </span>
                  </div>
                  <DiffView
                    defaultContent={selected.defaultContent ?? ''}
                    currentContent={editContent}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[var(--color-fonts-font-color-support)]">
              <Code2 size={28} className="opacity-30" />
              <p className="text-sm">Select a template to edit</p>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </main>
  )
}
