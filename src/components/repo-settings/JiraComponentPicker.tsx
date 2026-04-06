import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, ChevronLeft, Search, Check } from 'lucide-react'
import api from '@/lib/api'
import type { JiraProjectMeta, JiraComponentMeta, IntegrationFilter } from '@/types/api'

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  workspace: string
  repoSlug: string
  onClose: () => void
}

export function JiraComponentPicker({ value, onChange, workspace, repoSlug, onClose }: Props) {
  const [selectedProject, setSelectedProject] = useState<JiraProjectMeta | null>(null)
  const [projectSearch, setProjectSearch] = useState('')
  const [componentSearch, setComponentSearch] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set(value))

  const { data: enabledFilters = [], isLoading: loadingProjects } = useQuery<IntegrationFilter[]>({
    queryKey: ['integration-filters', 'jira'],
    queryFn: () => api.get('/integration-filters?type=jira').then((r) => r.data).catch(() => []),
  })

  const allProjects: JiraProjectMeta[] = enabledFilters
    .filter((f) => f.enabled)
    .map((f) => ({ id: f.key, key: f.key, name: f.name }))

  const { data: productJira } = useQuery<{ projects: Record<string, string> }>({
    queryKey: ['jira-meta-repo-product', workspace, repoSlug],
    queryFn: () =>
      api.get(`/jira/meta/repo-product?workspace=${encodeURIComponent(workspace)}&repoSlug=${encodeURIComponent(repoSlug)}`)
        .then((r) => r.data)
        .catch(() => ({ projects: {} })),
    enabled: !!workspace && !!repoSlug,
  })

  const { data: components = [], isLoading: loadingComponents } = useQuery<JiraComponentMeta[]>({
    queryKey: ['jira-meta-components', selectedProject?.key],
    queryFn: () =>
      api.get(`/jira/meta/projects/${encodeURIComponent(selectedProject!.key)}/components`)
        .then((r) => r.data)
        .catch(() => []),
    enabled: !!selectedProject,
  })

  const productProjectKeys = Object.values(productJira?.projects ?? {})
  const quickPicks = allProjects.filter((p) => productProjectKeys.includes(p.key))
  const otherProjects = allProjects.filter((p) => !productProjectKeys.includes(p.key))

  const filteredOther = projectSearch.trim()
    ? otherProjects.filter(
        (p) =>
          p.key.toLowerCase().includes(projectSearch.toLowerCase()) ||
          p.name.toLowerCase().includes(projectSearch.toLowerCase()),
      )
    : otherProjects

  const filteredComponents = componentSearch.trim()
    ? components.filter((c) => c.name.toLowerCase().includes(componentSearch.toLowerCase()))
    : components

  const toggleComponent = (name: string) => {
    setPending((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleApply = () => {
    onChange(Array.from(pending))
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-[var(--color-cards-card-background)] shadow-xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-cards-card-stroke)]">
          <div className="flex items-center gap-2">
            {selectedProject && (
              <button
                type="button"
                onClick={() => { setSelectedProject(null); setComponentSearch('') }}
                className="p-1 rounded hover:bg-[var(--color-cards-card-background-hover)] text-[var(--color-icons-icon)] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <h3 className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)]">
              {selectedProject
                ? `Components — ${selectedProject.key}`
                : 'Select Jira Project'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {!selectedProject ? (
            <>
              {/* Quick picks from product config */}
              {quickPicks.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-2">
                    From product config
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {quickPicks.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelectedProject(p)}
                        className="px-3 py-1.5 rounded border border-[var(--color-buttons-button-primary)] text-xs font-medium text-[var(--color-fonts-font-color-brand)] hover:bg-[var(--color-tags-neutral-background)] transition-colors"
                      >
                        {p.key} — {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search all projects */}
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-2">
                {quickPicks.length > 0 ? 'All projects' : 'Projects'}
              </p>
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-icons-icon)]" />
                <input
                  type="text"
                  placeholder="Search projects…"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                />
              </div>
              {loadingProjects ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-4 text-center">Loading…</p>
              ) : filteredOther.length === 0 ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-4 text-center">No projects found</p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredOther.map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        onClick={() => setSelectedProject(p)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-[var(--color-tables-table-hover)] transition-colors text-left"
                      >
                        <span className="font-mono text-xs text-[var(--color-fonts-font-color-brand)] w-16 shrink-0">{p.key}</span>
                        <span className="text-[var(--color-fonts-font-color-primary)] truncate">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              {/* Component search */}
              <div className="relative mb-3">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-icons-icon)]" />
                <input
                  type="text"
                  placeholder="Search components…"
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm rounded border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                />
              </div>
              {loadingComponents ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-4 text-center">Loading…</p>
              ) : filteredComponents.length === 0 ? (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] py-4 text-center">No components found</p>
              ) : (
                <ul className="space-y-0.5">
                  {filteredComponents.map((c) => {
                    const checked = pending.has(c.name)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggleComponent(c.name)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors text-left ${
                            checked
                              ? 'bg-[var(--color-tags-neutral-background)]'
                              : 'hover:bg-[var(--color-tables-table-hover)]'
                          }`}
                        >
                          <span className={`flex-none w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            checked
                              ? 'bg-[var(--color-buttons-button-primary)] border-[var(--color-buttons-button-primary)]'
                              : 'border-[var(--color-inputs-input-border)]'
                          }`}>
                            {checked && <Check size={10} className="text-white" />}
                          </span>
                          <span className="text-[var(--color-fonts-font-color-primary)] truncate">{c.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-cards-card-stroke)]">
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">
            {pending.size} component{pending.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1.5 text-xs rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
