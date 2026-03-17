import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Save, Eye, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { PromptTemplate } from '@/types/api'

export default function PromptsPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<PromptTemplate | null>(null)
  const [editContent, setEditContent] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const { data: templates, isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['prompts'],
    queryFn: () => api.get('/settings/prompts').then((r) => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/settings/prompts/${selected!.key}`, { content: editContent }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prompts'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/settings/prompts/${selected!.key}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompts'] })
      setSelected(null)
    },
  })

  const handleSelect = (t: PromptTemplate) => {
    setSelected(t)
    setEditContent(t.content)
    setPreview(null)
  }

  const handlePreview = async () => {
    if (!selected) return
    setPreviewLoading(true)
    try {
      const { data } = await api.post(`/settings/prompts/${selected.key}/preview`, {
        content: editContent,
      })
      setPreview(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    } catch {
      setPreview('Failed to generate preview.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const list = Array.isArray(templates) ? templates : []

  return (
    <main>
      <PageHeader
        title="Prompt Templates"
        subtitle="Manage AI prompt templates. Overridden templates take precedence over defaults."
      />

      <div className="flex gap-5 h-[calc(100vh-180px)] min-h-0">
        {/* Template list */}
        <div className="w-64 shrink-0 overflow-y-auto space-y-1">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 skeleton-shimmer rounded-[var(--border-radius-small)]" />
              ))
            : list.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleSelect(t)}
                  className={`w-full text-left px-3 py-2.5 rounded-[var(--border-radius-small)] text-sm transition-colors ${
                    selected?.key === t.key
                      ? 'bg-[var(--color-navigation-menu-item-active)] text-[var(--color-navigation-menu-item-hover-font)]'
                      : 'hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-primary)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">{t.key}</span>
                    {t.isOverride && (
                      <span className="ml-2 shrink-0 text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
                        custom
                      </span>
                    )}
                  </div>
                </button>
              ))}
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <h3>{selected.key}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreview}
                    disabled={previewLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                  >
                    <Eye size={13} />
                    {previewLoading ? 'Loading…' : 'Preview'}
                  </button>
                  {selected.isOverride && (
                    <button
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] text-xs font-medium hover:opacity-80 transition-opacity"
                    >
                      <RotateCcw size={13} />
                      Reset to Default
                    </button>
                  )}
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
                  >
                    <Save size={13} />
                    {saveMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm font-mono text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
              />

              {preview && (
                <div className="bg-[var(--color-cards-small-section-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 max-h-64 overflow-y-auto">
                  <p className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] mb-2 uppercase tracking-wide">
                    Preview
                  </p>
                  <p className="text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap font-mono">
                    {preview}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-fonts-font-color-support)]">
              Select a template to edit
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
