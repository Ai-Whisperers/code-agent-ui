import { useState, useEffect, useRef } from 'react'
import { GitBranch, ChevronDown, X, Search, Check } from 'lucide-react'
import { getToken } from '@/lib/keycloak'
import type { RepoOption } from '@/types/api'

interface RepositorySelectProps {
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export function RepositorySelect({
  value,
  onChange,
  placeholder = 'Select repositories...',
  className = '',
}: RepositorySelectProps) {
  const [options, setOptions] = useState<RepoOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/hooks/autocomplete/repositories`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data: RepoOption[]) => setOptions(data))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filtered = options.filter((o) =>
    o.displayName.toLowerCase().includes(query.toLowerCase())
  )

  const toggle = (repoSlug: string) => {
    if (value.includes(repoSlug)) {
      onChange(value.filter((v) => v !== repoSlug))
    } else {
      onChange([...value, repoSlug])
    }
  }

  const remove = (repoSlug: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((v) => v !== repoSlug))
  }

  const selectedOptions = options.filter((o) => value.includes(o.repoSlug))

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-wrap gap-1.5 min-h-[38px] w-full px-2.5 py-1.5 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] cursor-pointer hover:border-[var(--color-buttons-button-primary)] focus-within:border-[var(--color-buttons-button-primary)] transition-colors"
      >
        {selectedOptions.length === 0 ? (
          <span className="text-sm text-[var(--color-fonts-font-color-support)] self-center py-0.5">
            {loading ? 'Loading repositories...' : placeholder}
          </span>
        ) : (
          selectedOptions.map((o) => (
            <span
              key={o.repoSlug}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded text-xs font-medium"
            >
              <GitBranch size={11} />
              {o.repoSlug}
              <button
                type="button"
                onClick={(e) => remove(o.repoSlug, e)}
                className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))
        )}
        <ChevronDown
          size={16}
          className={`ml-auto self-center text-[var(--color-icons-icon)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-small)] shadow-lg max-h-56 flex flex-col">
          <div className="p-2 border-b border-[var(--color-cards-card-stroke)]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)]">
              <Search size={13} className="text-[var(--color-icons-icon)] shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search repositories..."
                className="flex-1 text-sm bg-transparent outline-none text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)]"
              />
            </div>
          </div>
          <div className="overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-sm text-center text-[var(--color-fonts-font-color-support)]">
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-[var(--color-fonts-font-color-support)]">
                No repositories found
              </div>
            ) : (
              filtered.map((o) => {
                const selected = value.includes(o.repoSlug)
                return (
                  <button
                    key={o.repoSlug}
                    type="button"
                    onClick={() => toggle(o.repoSlug)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors ${
                      selected ? 'text-[var(--color-buttons-button-primary)]' : 'text-[var(--color-fonts-font-color-primary)]'
                    }`}
                  >
                    <GitBranch size={14} className="shrink-0 text-[var(--color-icons-icon)]" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{o.repoSlug}</div>
                      <div className="text-xs text-[var(--color-fonts-font-color-support)] truncate">{o.workspace}</div>
                    </div>
                    {selected && <Check size={14} className="shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
