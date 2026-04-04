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
  /** Override the label text. Pass null to hide the label entirely. */
  label?: string | null
  /** When true the user can also type a free-form URL that is not in the repo list */
  allowFreeText?: boolean
}

// ── Platform detection ────────────────────────────────────────────────────────

type GitPlatform = 'bitbucket' | 'gitlab' | 'github' | 'azuredevops' | 'unknown'

function detectPlatform(url: string): GitPlatform {
  const lower = url.toLowerCase()
  if (lower.includes('bitbucket')) return 'bitbucket'
  if (lower.includes('gitlab'))    return 'gitlab'
  if (lower.includes('github'))    return 'github'
  if (lower.includes('dev.azure') || lower.includes('visualstudio.com') || lower.includes('azure')) return 'azuredevops'
  return 'unknown'
}

const PLATFORM_LABEL: Record<GitPlatform, string> = {
  bitbucket:   'Bitbucket',
  gitlab:      'GitLab',
  github:      'GitHub',
  azuredevops: 'Azure DevOps',
  unknown:     'Git',
}

const PLATFORM_COLORS: Record<GitPlatform, string> = {
  bitbucket:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  gitlab:      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  github:      'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  azuredevops: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  unknown:     'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
}

// Simple SVG platform icons (inline, no extra deps)
function PlatformIcon({ platform, size = 12 }: { platform: GitPlatform; size?: number }) {
  const s = size
  if (platform === 'bitbucket') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
        <path d="M2.07 5.26A1.5 1.5 0 0 0 .58 6.97l4.35 19.5a1.5 1.5 0 0 0 1.47 1.2h19.2a1.5 1.5 0 0 0 1.47-1.2l4.35-19.5a1.5 1.5 0 0 0-1.49-1.71H2.07zm19.56 13.5h-11.3l-1.5-7.5h14.3l-1.5 7.5z"/>
      </svg>
    )
  }
  if (platform === 'gitlab') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
        <path d="M16 29.2 6.1 18.4l-5-15.3 4.9 15.3H16zm0 0 9.9-10.8 5-15.3-4.9 15.3H16zm-9.9-10.8L16 29.2l-9.9-10.8zm19.8 0L16 29.2l9.9-10.8zM1.1 3.1 6.1 18.4 1.1 3.1zm29.8 0-5 15.3 5-15.3zM16 3.1l-4.9 15.3H16V3.1zm0 0v15.3h4.9L16 3.1z"/>
      </svg>
    )
  }
  if (platform === 'github') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
        <path d="M16 2C8.27 2 2 8.27 2 16c0 6.19 4.01 11.44 9.57 13.29.7.13.96-.3.96-.67v-2.35c-3.9.85-4.72-1.88-4.72-1.88-.64-1.62-1.56-2.05-1.56-2.05-1.27-.87.1-.85.1-.85 1.41.1 2.15 1.45 2.15 1.45 1.25 2.14 3.28 1.52 4.08 1.16.13-.9.49-1.52.89-1.87-3.11-.35-6.38-1.56-6.38-6.93 0-1.53.55-2.78 1.44-3.76-.14-.35-.62-1.78.14-3.71 0 0 1.18-.38 3.85 1.44A13.4 13.4 0 0 1 16 9.18c1.19.01 2.39.16 3.51.47 2.67-1.82 3.85-1.44 3.85-1.44.76 1.93.28 3.36.14 3.71.9.98 1.44 2.23 1.44 3.76 0 5.38-3.28 6.57-6.4 6.92.5.43.95 1.29.95 2.6v3.85c0 .37.25.81.96.67C25.99 27.44 30 22.19 30 16 30 8.27 23.73 2 16 2z"/>
      </svg>
    )
  }
  if (platform === 'azuredevops') {
    return (
      <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
        <path d="M29.6 8.4 22.4 2v5.6L10.4 11 4 8.4V24l6.4 2.4 12-4.8v5.6l7.2-6.4V8.4zM10.4 22.4l-3.2-1.6V11.2l3.2 1.6v9.6zm9.6-2.4-9.6 3.2v-9.6l9.6-3.2v9.6z"/>
      </svg>
    )
  }
  // unknown / generic git
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M29.6 14.4 17.6 2.4a2.4 2.4 0 0 0-3.2 0L2.4 14.4a2.4 2.4 0 0 0 0 3.2l12 12a2.4 2.4 0 0 0 3.2 0l12-12a2.4 2.4 0 0 0 0-3.2zM16 22.4l-6.4-6.4L16 9.6l6.4 6.4L16 22.4z"/>
    </svg>
  )
}

function PlatformBadge({ platform }: { platform: GitPlatform }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${PLATFORM_COLORS[platform]}`}>
      <PlatformIcon platform={platform} size={10} />
      {PLATFORM_LABEL[platform]}
    </span>
  )
}

// ── URL builder ───────────────────────────────────────────────────────────────

function buildRepoUrl(repo: RepoSettings): string {
  const base = (repo.gitPlatformUrl ?? BITBUCKET_BASE_URL).replace(/\/$/, '')
  return `${base}/${repo.workspace}/${repo.repoSlug}.git`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RepoCombobox({
  value,
  onChange,
  required,
  filterQualityEnabled,
  label = 'Repository',
  allowFreeText = false,
}: Props) {
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

  const matchedRepo = active.find((r) => buildRepoUrl(r) === value)
  const selectedLabel = matchedRepo
    ? `${matchedRepo.workspace} / ${matchedRepo.repoSlug}`
    : (allowFreeText && value ? value : '')

  const selectedPlatform: GitPlatform | null = matchedRepo
    ? detectPlatform(matchedRepo.gitPlatformUrl ?? BITBUCKET_BASE_URL)
    : (allowFreeText && value ? detectPlatform(value) : null)

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

  function handleBlur() {
    if (allowFreeText && query.trim() && !matchedRepo) {
      onChange(query.trim())
    }
    setOpen(false)
    setQuery('')
  }

  const inputPlaceholder = allowFreeText
    ? (selectedLabel || 'Search repos or paste a URL…')
    : (selectedLabel || 'Search repositories…')

  // When open, show the query; when closed show the selected label (or nothing if nothing selected)
  const inputValue = open ? query : selectedLabel

  return (
    <div>
      {label !== null && (
        <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
          {label}
          {required && <span className="text-[var(--color-status-border-critical)] ml-1">*</span>}
        </label>
      )}
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
          {/* Platform badge shown when a value is selected and not actively typing */}
          {!open && selectedPlatform && value && (
            <PlatformBadge platform={selectedPlatform} />
          )}
          <input
            type="text"
            className="flex-1 bg-transparent outline-none min-w-0 text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)]"
            placeholder={open ? (allowFreeText ? 'Search repos or paste a URL…' : 'Search repositories…') : inputPlaceholder}
            value={inputValue}
            required={required && !value}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={handleBlur}
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
            className="max-h-64 overflow-y-auto rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg py-0.5"
          >
            {/* Free-text "use this URL" option when query looks like a URL */}
            {allowFreeText && query.trim() && (query.includes('://') || query.includes('.git')) && (
              <li
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-[var(--color-tables-table-hover)] border-b border-[var(--color-cards-card-stroke)]"
                onMouseDown={(e) => { e.preventDefault(); onChange(query.trim()); setQuery(''); setOpen(false) }}
              >
                <Check size={11} className="shrink-0 opacity-0" />
                <PlatformBadge platform={detectPlatform(query)} />
                <span className="truncate font-mono text-xs text-[var(--color-fonts-font-color-user-input)]">{query.trim()}</span>
                <span className="ml-auto shrink-0 text-xs text-[var(--color-fonts-font-color-support)]">use this URL</span>
              </li>
            )}

            {/* Section header when there are known repos to show */}
            {filtered.length > 0 && (
              <li className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] select-none">
                Registered repositories
              </li>
            )}

            {filtered.length === 0 && !(allowFreeText && query.trim()) ? (
              <li className="px-3 py-1.5 text-sm text-[var(--color-fonts-font-color-support)]">
                No repositories found
              </li>
            ) : (
              filtered.map((repo) => {
                const url = buildRepoUrl(repo)
                const isSelected = value ? url === value : false
                const platform = detectPlatform(repo.gitPlatformUrl ?? BITBUCKET_BASE_URL)
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
                    <PlatformBadge platform={platform} />
                    <span className="whitespace-nowrap min-w-0 truncate">
                      {repo.workspace}
                      <span className="opacity-40"> / </span>
                      {repo.repoSlug}
                    </span>
                    {repo.primaryLanguage && (
                      <span className="ml-auto shrink-0 text-[10px] text-[var(--color-fonts-font-color-support)] opacity-70">
                        {repo.primaryLanguage}
                      </span>
                    )}
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
