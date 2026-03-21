import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Check } from 'lucide-react'
import api from '@/lib/api'
import type { RepoSettings } from '@/types/api'

interface Props {
  value: string
  onChange: (repoUrl: string) => void
  required?: boolean
  filterQualityEnabled?: boolean
}

function buildRepoUrl(repo: RepoSettings): string {
  const base = repo.gitPlatformUrl?.replace(/\/$/, '') ?? ''
  if (!base) return ''
  return `${base}/${repo.workspace}/${repo.repoSlug}.git`
}

export function RepoCombobox({ value, onChange, required, filterQualityEnabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: repos = [] } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data).catch(() => []),
  })

  const active = repos.filter((r) => {
    if (r.archived) return false
    if (filterQualityEnabled && !r.qualityReportEnabled) return false
    return true
  })

  const filtered = query.trim()
    ? active.filter(
        (r) =>
          r.repoSlug.toLowerCase().includes(query.toLowerCase()) ||
          r.workspace.toLowerCase().includes(query.toLowerCase()),
      )
    : active

  const selectedLabel = (() => {
    const match = active.find((r) => buildRepoUrl(r) === value)
    return match ? `${match.workspace} / ${match.repoSlug}` : value
  })()

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function select(repo: RepoSettings) {
    const url = buildRepoUrl(repo)
    onChange(url)
    setQuery('')
    setOpen(false)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
        Repository
        {required && <span className="text-[var(--color-status-border-critical)] ml-1">*</span>}
      </label>
      <div ref={containerRef} className="relative">
        <div
          className="flex items-center w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus-within:border-[var(--color-buttons-button-primary)] cursor-text"
          onClick={() => setOpen(true)}
        >
          <input
            type="text"
            className="flex-1 bg-transparent outline-none min-w-0"
            placeholder="Search repositories…"
            value={open ? query : selectedLabel}
            required={required && !value}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown
            size={14}
            className="shrink-0 text-[var(--color-fonts-font-color-support)] ml-1"
          />
        </div>

        {open && (
          <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-cards-card-background)] shadow-lg">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-[var(--color-fonts-font-color-support)]">
                No repositories found
              </li>
            ) : (
              filtered.map((repo) => {
                const url = buildRepoUrl(repo)
                const isSelected = url === value
                return (
                  <li
                    key={`${repo.workspace}/${repo.repoSlug}`}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-navigation-menu-item-hover-background)] ${
                      isSelected ? 'text-[var(--color-fonts-font-color-brand)]' : 'text-[var(--color-fonts-font-color-primary)]'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      select(repo)
                    }}
                  >
                    {isSelected && <Check size={12} className="shrink-0" />}
                    {!isSelected && <span className="w-3 shrink-0" />}
                    <span>
                      <span className="font-medium">{repo.workspace}</span>
                      <span className="text-[var(--color-fonts-font-color-support)]"> / </span>
                      {repo.repoSlug}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
