import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Check } from 'lucide-react'
import api from '@/lib/api'
import type { RepoSettings } from '@/types/api'

const BITBUCKET_BASE_URL = import.meta.env.VITE_BITBUCKET_URL ?? 'https://bitbucket.org'

interface Props {
  value: string
  onChange: (repoUrl: string) => void
  required?: boolean
  filterQualityEnabled?: boolean
}

function buildRepoUrl(repo: RepoSettings): string {
  const base = (repo.gitPlatformUrl ?? BITBUCKET_BASE_URL).replace(/\/$/, '')
  return `${base}/${repo.workspace}/${repo.repoSlug}.git`
}

export function RepoCombobox({ value, onChange, required, filterQualityEnabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

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
    return match ? `${match.workspace} / ${match.repoSlug}` : ''
  })()

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Compute fixed dropdown position (escapes overflow-hidden containers)
  useEffect(() => {
    if (!open || !containerRef.current) return
    const update = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
        zIndex: 9999,
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  function select(repo: RepoSettings) {
    onChange(buildRepoUrl(repo))
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
        {/* Trigger */}
        <div
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1.5 w-full px-3 py-2 text-sm rounded border transition-all cursor-text ${
            open
              ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-cards-card-background)]'
              : 'bg-[var(--color-cards-card-background)] border-[var(--color-cards-card-stroke)] hover:border-[var(--color-buttons-button-primary)]'
          }`}
        >
          <input
            type="text"
            className="flex-1 bg-transparent outline-none min-w-0 text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)]"
            placeholder={selectedLabel || 'Search repositories…'}
            value={open ? query : selectedLabel}
            required={required && !value}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
          />
          <ChevronDown
            size={13}
            className={`shrink-0 text-[var(--color-icons-icon)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </div>

        {/* Dropdown via portal — escapes overflow-hidden card container */}
        {open && createPortal(
          <ul
            style={dropdownStyle}
            className="max-h-56 overflow-y-auto rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg py-0.5"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-1.5 text-sm text-[var(--color-fonts-font-color-support)]">
                No repositories found
              </li>
            ) : (
              filtered.map((repo) => {
                const url = buildRepoUrl(repo)
                const isSelected = value ? url === value : false
                return (
                  <li
                    key={`${repo.workspace}/${repo.repoSlug}`}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors hover:bg-[var(--color-tables-table-hover)] ${
                      isSelected
                        ? 'text-[var(--color-fonts-font-color-primary)] font-medium'
                        : 'text-[var(--color-fonts-font-color-support)]'
                    }`}
                    onMouseDown={(e) => { e.preventDefault(); select(repo) }}
                  >
                    <Check size={11} className={`shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="whitespace-nowrap">
                      {repo.workspace}
                      <span className="opacity-40"> / </span>
                      {repo.repoSlug}
                    </span>
                  </li>
                )
              })
            )}
          </ul>,
          document.body,
        )}
      </div>
    </div>
  )
}
