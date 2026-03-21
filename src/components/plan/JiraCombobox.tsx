import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Check, Loader2 } from 'lucide-react'
import api from '@/lib/api'

interface JiraIssue {
  key: string
  summary: string
  status: string
}

interface Props {
  value: string
  onChange: (jiraKey: string) => void
  required?: boolean
}

export function JiraCombobox({ value, onChange, required }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<JiraIssue[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = q.trim() ? `?q=${encodeURIComponent(q)}&maxResults=15` : '?maxResults=15'
        const res = await api.get(`/plans/jira/search${params}`)
        setResults(Array.isArray(res.data) ? res.data : [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  useEffect(() => {
    if (open) search(query)
  }, [open, query, search])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const selectedIssue = results.find((i) => i.key === value)
  const displayValue = open
    ? query
    : selectedIssue
    ? `${selectedIssue.key}: ${selectedIssue.summary}`
    : value

  function select(issue: JiraIssue) {
    onChange(issue.key)
    setQuery('')
    setOpen(false)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
        JIRA Key
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
            placeholder="Search Jira issues…"
            value={displayValue}
            required={required && !value}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
          />
          {loading ? (
            <Loader2 size={14} className="shrink-0 text-[var(--color-fonts-font-color-support)] ml-1 animate-spin" />
          ) : (
            <ChevronDown size={14} className="shrink-0 text-[var(--color-fonts-font-color-support)] ml-1" />
          )}
        </div>

        {open && (
          <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-cards-card-background)] shadow-lg">
            {!loading && results.length === 0 ? (
              <li className="px-3 py-2 text-xs text-[var(--color-fonts-font-color-support)]">
                No issues found
              </li>
            ) : (
              results.map((issue) => {
                const isSelected = issue.key === value
                return (
                  <li
                    key={issue.key}
                    className={`flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--color-navigation-menu-item-hover-background)] ${
                      isSelected ? 'text-[var(--color-fonts-font-color-brand)]' : 'text-[var(--color-fonts-font-color-primary)]'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      select(issue)
                    }}
                  >
                    <span className="shrink-0 mt-0.5 w-3">
                      {isSelected && <Check size={12} />}
                    </span>
                    <span className="min-w-0">
                      <span className="font-mono font-medium">{issue.key}</span>
                      <span className="text-[var(--color-fonts-font-color-support)] mx-1">·</span>
                      <span className="truncate">{issue.summary}</span>
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                        {issue.status}
                      </span>
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
