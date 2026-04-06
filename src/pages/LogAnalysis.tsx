import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  RefreshCw,
  Activity,
  CheckCircle,
  Clock,
  HelpCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Check,
  Eye,
  ShieldOff,
  Sparkles,
  Wrench,
  ExternalLink,
  X,
  Loader2,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Tooltip } from '@/components/ui/Tooltip'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { JobStatusBadge } from '@/components/ui/JobStatusBadge'
import api from '@/lib/api'
import { mcpProfilesApi, type SystemConfig } from '@/lib/mcpProfiles'
import type { CustomerConfig, IntegrationFilter, RepoSettings } from '@/types/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogFinding {
  id: number
  fingerprint: string
  customerId: string
  environmentName: string
  logGroupName: string
  exceptionClass?: string
  topFrames?: string
  sampleMessage?: string
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  severity?: string
  aiReason?: string
  status: string
  deepAnalysis?: string
  analysedAt?: string
  jiraKey?: string
  monitoringSince?: string
  jobId?: string
  jobStatus?: string
  prUrl?: string
}

interface FindingsResponse {
  items: LogFinding[]
  count: number
  limit: number
  offset: number
}

interface FindingStats {
  openTotal: number
  openHigh: number
  newToday: number
  dismissedThisWeek: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  accent,
  accentColor,
  tooltip,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent?: string
  accentColor?: string
  tooltip: string
}) {
  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="h-1 w-full" style={{ backgroundColor: accentColor ?? 'var(--color-cards-card-stroke)' }} />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wider">
              {label}
            </span>
            <Tooltip text={tooltip}>
              <HelpCircle size={11} className="text-[var(--color-fonts-font-color-support)] opacity-50 cursor-default" />
            </Tooltip>
          </div>
          <span className={accent ?? 'text-[var(--color-icons-icon)]'}>{icon}</span>
        </div>
        <p className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
      </div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity?: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    high:   { bg: 'var(--color-tags-danger-background)',  text: 'var(--color-tags-font-danger)',  label: 'High' },
    medium: { bg: 'var(--color-tags-warning-background)', text: 'var(--color-tags-font-warning)', label: 'Medium' },
    low:    { bg: 'var(--color-tags-neutral-background)', text: 'var(--color-tags-font-neutral)', label: 'Low' },
  }
  const style = map[severity ?? 'low'] ?? map.low
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}

function StatusBadge({ status, monitoringSince }: { status: string; monitoringSince?: string }) {
  if (status === 'MONITORING') {
    return (
      <Tooltip text={monitoringSince ? `Monitoring since ${new Date(monitoringSince).toLocaleDateString()}` : 'Under monitoring'}>
        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] whitespace-nowrap"
          style={{ background: 'var(--color-tags-attention-background)', color: 'var(--color-tags-font-attention)' }}>
          <Eye size={10} />
          Monitoring
        </span>
      </Tooltip>
    )
  }
  if (status === 'CLOSED') {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] whitespace-nowrap"
        style={{ background: 'var(--color-tags-success-background)', color: 'var(--color-tags-font-success)' }}>
        Closed
      </span>
    )
  }
  return null
}

// ── Combobox (searchable single-select) ──────────────────────────────────────

interface ComboboxOption { value: string; label: string }

function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Search…',
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  options: ComboboxOption[]
  placeholder?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const selected = options.find((o) => o.value === value)
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Portal position
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openAbove = spaceBelow < 200 && spaceAbove > spaceBelow
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [open])

  const openDropdown = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const select = (opt: ComboboxOption) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={triggerRef} className="relative">
      <div
        onClick={openDropdown}
        className={`flex items-center gap-1.5 w-full px-3 py-2 text-sm rounded border transition-all cursor-text ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${
          open
            ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-cards-card-background)]'
            : 'bg-[var(--color-cards-card-background)] border-[var(--color-cards-card-stroke)] hover:border-[var(--color-buttons-button-primary)]'
        }`}
      >
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] min-w-0"
          />
        ) : (
          <span className={`flex-1 truncate ${selected ? 'text-[var(--color-fonts-font-color-user-input)]' : 'text-[var(--color-fonts-font-color-support)]'}`}>
            {selected?.label ?? placeholder}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 text-[var(--color-icons-icon)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg overflow-auto py-0.5 max-h-56"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-fonts-font-color-support)]">No results</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(opt) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-tables-table-hover)] ${
                  value === opt.value ? 'text-[var(--color-fonts-font-color-primary)] font-medium' : 'text-[var(--color-fonts-font-color-support)]'
                }`}
              >
                <Check size={11} className={`shrink-0 ${value === opt.value ? 'opacity-100' : 'opacity-0'}`} />
                <span className="text-left truncate">{opt.label}</span>
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ── Create Jira & Fix modal ───────────────────────────────────────────────────

const ISSUE_TYPE_OPTIONS = [
  { value: 'Bug',   label: 'Bug' },
  { value: 'Task',  label: 'Task' },
  { value: 'Story', label: 'Story' },
]

interface JiraPriority { id: string; name: string }

/**
 * Given a list of Jira priority names and a finding severity, pick the best match.
 * Strategy (case-insensitive prefix scan):
 *   high   → High > Critical > Blocker > first option
 *   medium → Medium > first option
 *   low    → Low > Lowest > last option
 */
function guessPriority(priorities: JiraPriority[], severity?: string): string {
  if (!priorities.length) return ''
  const names = priorities.map((p) => p.name.toLowerCase())
  const find = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = names.findIndex((n) => n === c || n.startsWith(c))
      if (idx !== -1) return priorities[idx].name
    }
    return null
  }
  const sev = (severity ?? '').toLowerCase()
  if (sev === 'high')   return find('high', 'critical', 'blocker') ?? priorities[0].name
  if (sev === 'medium') return find('medium') ?? priorities[Math.floor(priorities.length / 2)].name
  if (sev === 'low')    return find('low', 'lowest') ?? priorities[priorities.length - 1].name
  return ''
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-1">
      {children}
    </p>
  )
}

function CreateJiraModal({
  finding,
  onClose,
  onSuccess,
}: {
  finding: LogFinding
  onClose: () => void
  onSuccess: (jiraKey: string, jobId: string | null) => void
}) {
  const [projectKey, setProjectKey] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [issueType, setIssueType] = useState('Bug')
  const [priority, setPriority] = useState('')
  const [error, setError] = useState<string | null>(null)

  const projectsQuery = useQuery<IntegrationFilter[]>({
    queryKey: ['integration-filters-jira'],
    queryFn: () =>
      api.get<IntegrationFilter[]>('/integration-filters?type=jira').then((r) => r.data).catch(() => []),
    staleTime: 5 * 60_000,
  })

  const prioritiesQuery = useQuery<JiraPriority[]>({
    queryKey: ['jira-priorities'],
    queryFn: () =>
      api.get<JiraPriority[]>('/jira/meta/priorities').then((r) => r.data).catch(() => []),
    staleTime: 10 * 60_000,
  })

  // Auto-select priority once priorities are loaded
  useEffect(() => {
    if (prioritiesQuery.data && prioritiesQuery.data.length > 0 && !priority) {
      const guess = guessPriority(prioritiesQuery.data, finding.severity)
      if (guess) setPriority(guess)
    }
  }, [prioritiesQuery.data])

  const enabledProjects = (projectsQuery.data ?? []).filter((p) => p.enabled)
  const projectOptions = enabledProjects.map((p) => ({ value: p.key, label: `${p.key} — ${p.name}` }))

  const reposQuery = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get<RepoSettings[]>('/settings/repos').then((r) => r.data).catch(() => []),
    staleTime: 5 * 60_000,
  })

  const repoOptions = (reposQuery.data ?? [])
    .filter((r) => !r.archived)
    .map((r) => ({
      value: r.gitPlatformUrl ?? `https://bitbucket.org/${r.workspace}/${r.repoSlug}.git`,
      label: `${r.workspace}/${r.repoSlug}`,
    }))

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ jiraKey: string; jobId: string | null; warning?: string }>(
        `/log-analysis/findings/${finding.id}/create-jira-and-fix`,
        { projectKey, repoUrl, issueType, priority: priority || undefined },
      ).then((r) => r.data),
    onSuccess: (data) => onSuccess(data.jiraKey, data.jobId ?? null),
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Failed to create ticket'),
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] shadow-xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--color-cards-card-background)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={16} style={{ color: 'var(--color-buttons-button-primary)' }} />
            <h3 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              Create Jira Ticket & Start Fix Job
            </h3>
          </div>
          <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:opacity-70">
            <X size={16} />
          </button>
        </div>

        {/* Finding summary */}
        <div
          className="rounded-[var(--border-radius-small)] px-3 py-2 text-xs"
          style={{ background: 'var(--color-page-background)' }}
        >
          <span className="font-mono text-[var(--color-fonts-font-color-body)]">
            {finding.exceptionClass ?? '(unknown)'}
          </span>
          <span className="ml-2 text-[var(--color-fonts-font-color-support)]">
            · {finding.customerId} / {finding.environmentName}
          </span>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-3">
          {/* Jira project */}
          <div>
            <FieldLabel>Jira Project *</FieldLabel>
            {projectsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                <Loader2 size={12} className="animate-spin" /> Loading projects…
              </div>
            ) : enabledProjects.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-tags-font-warning)' }}>
                No enabled Jira projects found. Enable projects under{' '}
                <strong>Settings → Integrations</strong>.
              </p>
            ) : (
              <Select
                value={projectKey}
                onChange={setProjectKey}
                options={projectOptions}
                placeholder="Select project…"
              />
            )}
          </div>

          {/* Repository */}
          <div>
            <FieldLabel>Repository *</FieldLabel>
            {reposQuery.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                <Loader2 size={12} className="animate-spin" /> Loading repos…
              </div>
            ) : repoOptions.length > 0 ? (
              <Combobox
                value={repoUrl}
                onChange={setRepoUrl}
                options={repoOptions}
                placeholder="Type to search repositories…"
              />
            ) : (
              <Input
                type="text"
                placeholder="https://bitbucket.org/workspace/repo.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full"
              />
            )}
          </div>

          {/* Issue type + priority row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldLabel>Issue Type</FieldLabel>
              <Select
                value={issueType}
                onChange={setIssueType}
                options={ISSUE_TYPE_OPTIONS}
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Priority</FieldLabel>
              {prioritiesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </div>
              ) : (
                <Select
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: '', label: 'Default' },
                    ...(prioritiesQuery.data ?? []).map((p) => ({ value: p.name, label: p.name })),
                  ]}
                />
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--color-tags-font-danger)' }}>{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Wrench size={13} />}
            loading={mutation.isPending}
            disabled={!projectKey || !repoUrl}
            onClick={() => { setError(null); mutation.mutate() }}
          >
            Create & Fix
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── FindingRow ────────────────────────────────────────────────────────────────

function FindingRow({
  finding: initialFinding,
  onDismiss,
  isDismissing,
  readOnly,
  jiraBaseUrl,
}: {
  finding: LogFinding
  onDismiss: (id: number) => void
  isDismissing: boolean
  readOnly?: boolean
  jiraBaseUrl: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [finding, setFinding] = useState(initialFinding)
  const [showJiraModal, setShowJiraModal] = useState(false)

  const analyseMutation = useMutation({
    mutationFn: () =>
      api.post<{ deepAnalysis: string }>(`/log-analysis/findings/${finding.id}/analyse`, {}).then((r) => r.data),
    onSuccess: (data) => {
      setFinding((prev) => ({ ...prev, deepAnalysis: data.deepAnalysis, analysedAt: new Date().toISOString() }))
      queryClient.invalidateQueries({ queryKey: ['log-analysis-findings'] })
    },
  })

  const handleJiraSuccess = (jiraKey: string, jobId: string | null) => {
    setFinding((prev) => ({ ...prev, jiraKey, ...(jobId ? { jobId, jobStatus: 'PENDING' } : {}) }))
    setShowJiraModal(false)
    queryClient.invalidateQueries({ queryKey: ['log-analysis-findings'] })
  }

  return (
    <>
      {showJiraModal && (
        <CreateJiraModal
          finding={finding}
          onClose={() => setShowJiraModal(false)}
          onSuccess={handleJiraSuccess}
        />
      )}

      <tr
        className="border-b border-[var(--color-cards-card-stroke)] hover:bg-[var(--color-page-background)] cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 w-6">
          {expanded
            ? <ChevronDown size={14} className="text-[var(--color-fonts-font-color-support)]" />
            : <ChevronRight size={14} className="text-[var(--color-fonts-font-color-support)]" />}
        </td>
        <td className="px-4 py-3">
          <SeverityBadge severity={finding.severity} />
        </td>
        <td className="px-4 py-3 font-mono text-xs text-[var(--color-fonts-font-color-body)] max-w-[220px] truncate">
          {finding.exceptionClass ?? '(unknown)'}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--color-fonts-font-color-support)]">
          {finding.customerId}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--color-fonts-font-color-support)]">
          {finding.environmentName}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--color-fonts-font-color-support)] text-right tabular-nums">
          {finding.occurrenceCount.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
          <Tooltip text={new Date(finding.firstSeenAt).toLocaleString()}>
            <span>{timeSince(finding.firstSeenAt)}</span>
          </Tooltip>
        </td>
        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {finding.jiraKey ? (
            <a
              href={`${jiraBaseUrl}/browse/${finding.jiraKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--color-buttons-button-primary)' }}
            >
              <ExternalLink size={11} />
              {finding.jiraKey}
            </a>
          ) : (
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {finding.jobId ? (
            <button
              className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
              onClick={() => navigate({ to: '/jobs/$id', params: { id: finding.jobId! } })}
            >
              <JobStatusBadge status={finding.jobStatus ?? 'PENDING'} />
            </button>
          ) : (
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {finding.prUrl ? (
            <a
              href={finding.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--color-buttons-button-primary)' }}
            >
              <ExternalLink size={11} />
              PR
            </a>
          ) : (
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <StatusBadge status={finding.status} monitoringSince={finding.monitoringSince} />
            {analyseMutation.isPending ? (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded text-[var(--color-fonts-font-color-support)]">
                <Loader2 size={12} className="animate-spin" />
                Analysing…
              </span>
            ) : finding.analysedAt ? (
              <Tooltip text={`Analysed ${timeSince(finding.analysedAt)}`}>
                <span className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ color: 'var(--color-buttons-button-primary)' }}>
                  <Sparkles size={12} />
                  Analysed
                </span>
              </Tooltip>
            ) : (
              <Button
                variant="ai"
                size="sm"
                icon={<Sparkles size={12} />}
                onClick={() => analyseMutation.mutate()}
              >
                Analyse
              </Button>
            )}
            {!readOnly && finding.status === 'OPEN' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(finding.id)}
                disabled={isDismissing}
              >
                Dismiss
              </Button>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
          <td colSpan={11} className="px-6 py-4">
            <div className="flex flex-col gap-4">
              {finding.aiReason && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-1">
                    AI Triage Reason
                  </p>
                  <p className="text-sm text-[var(--color-fonts-font-color-body)]">{finding.aiReason}</p>
                </div>
              )}

              {/* Deep analysis section */}
              <div className="rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-2"
                  style={{ background: 'var(--color-page-background)' }}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} style={{ color: 'var(--color-buttons-button-primary)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">
                      Deep Analysis
                    </span>
                    {finding.analysedAt && (
                      <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                        · {timeSince(finding.analysedAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!readOnly && finding.status === 'OPEN' && !finding.jiraKey && (
                      <Button
                        variant="primary"
                        size="xs"
                        icon={<Wrench size={11} />}
                        onClick={() => setShowJiraModal(true)}
                      >
                        Create Jira & Fix
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={<Sparkles size={11} />}
                      loading={analyseMutation.isPending}
                      onClick={() => analyseMutation.mutate()}
                    >
                      {finding.deepAnalysis ? 'Re-analyse' : 'Analyse'}
                    </Button>
                  </div>
                </div>
                {analyseMutation.isPending && (
                  <div className="px-4 py-4 flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                    <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--color-buttons-button-primary)' }} />
                    Running deep analysis with Claude Sonnet… this may take 15–30 seconds.
                  </div>
                )}
                {!analyseMutation.isPending && analyseMutation.isError && (
                  <div className="px-4 py-2 text-xs" style={{ color: 'var(--color-tags-font-danger)' }}>
                    Analysis failed. Please try again.
                  </div>
                )}
                {!analyseMutation.isPending && !analyseMutation.isError && (
                  finding.deepAnalysis ? (
                    <div className="px-4 py-3 prose prose-sm max-w-none text-[var(--color-fonts-font-color-body)]">
                      <MarkdownMessage content={finding.deepAnalysis} />
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-xs text-[var(--color-fonts-font-color-support)]">
                      No analysis yet. Click &ldquo;Analyse&rdquo; to run a deep root-cause analysis.
                    </div>
                  )
                )}
              </div>

              {finding.topFrames && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-1">
                    Stack Frames
                  </p>
                  <pre className="text-xs font-mono text-[var(--color-fonts-font-color-body)] whitespace-pre-wrap break-all bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded p-3">
                    {finding.topFrames}
                  </pre>
                </div>
              )}
              {finding.sampleMessage && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-1">
                    Sample Message
                  </p>
                  <pre className="text-xs font-mono text-[var(--color-fonts-font-color-body)] whitespace-pre-wrap break-all bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded p-3 max-h-40 overflow-y-auto">
                    {finding.sampleMessage}
                  </pre>
                </div>
              )}
              <div className="flex flex-wrap gap-6 text-xs text-[var(--color-fonts-font-color-support)] items-center">
                <span>Log group: <span className="font-mono">{finding.logGroupName}</span></span>
                <span>Last seen: {new Date(finding.lastSeenAt).toLocaleString()}</span>
                <span>Fingerprint: <span className="font-mono">{finding.fingerprint.substring(0, 12)}…</span></span>
                {finding.monitoringSince && (
                  <span className="flex items-center gap-1" style={{ color: 'var(--color-tags-font-attention)' }}>
                    <Eye size={11} />
                    Monitoring since {new Date(finding.monitoringSince).toLocaleDateString()}
                  </span>
                )}
                {finding.jiraKey && (
                  <a
                    href={`${jiraBaseUrl}/browse/${finding.jiraKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-medium"
                    style={{ color: 'var(--color-buttons-button-primary)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                    {finding.jiraKey}
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS = [
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

export default function LogAnalysisPage() {
  const queryClient = useQueryClient()
  const [severityFilter, setSeverityFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [showFalsePositives, setShowFalsePositives] = useState(false)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 10 * 60_000,
  })
  const jiraBaseUrl = systemConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  const customersQuery = useQuery<CustomerConfig[]>({
    queryKey: ['customers'],
    queryFn: () =>
      api.get<CustomerConfig[]>('/customer-registry/customers').then((r) => r.data).catch(() => [] as CustomerConfig[]),
    staleTime: 5 * 60_000,
  })

  const logAnalysisCustomers = (customersQuery.data ?? []).filter((c) =>
    c.environments?.some((e) => e.logAnalysis?.enabled === true)
  )

  const customerOptions = logAnalysisCustomers.map((c) => ({
    value: c.customerId,
    label: c.name,
  }))

  const statsQuery = useQuery<FindingStats>({
    queryKey: ['log-analysis-stats'],
    queryFn: () => api.get<FindingStats>('/log-analysis/stats').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const findingsQuery = useQuery<FindingsResponse>({
    queryKey: ['log-analysis-findings', severityFilter, customerFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (severityFilter) params.set('severity', severityFilter)
      if (customerFilter) params.set('customerId', customerFilter)
      params.set('limit', '100')
      return api.get<FindingsResponse>(`/log-analysis/findings?${params}`).then((r) => r.data)
    },
    refetchInterval: 60_000,
  })

  const falsePositivesQuery = useQuery<FindingsResponse>({
    queryKey: ['log-analysis-false-positives', severityFilter, customerFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (severityFilter) params.set('severity', severityFilter)
      if (customerFilter) params.set('customerId', customerFilter)
      params.set('limit', '100')
      return api.get<FindingsResponse>(`/log-analysis/false-positives?${params}`).then((r) => r.data)
    },
    enabled: showFalsePositives,
    refetchInterval: 60_000,
  })

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/log-analysis/findings/${id}/dismiss`, {}).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-analysis-findings'] })
      queryClient.invalidateQueries({ queryKey: ['log-analysis-stats'] })
      setToast({ message: 'Finding dismissed.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to dismiss finding.', variant: 'error' }),
  })

  const stats = statsQuery.data
  const activeQuery = showFalsePositives ? falsePositivesQuery : findingsQuery
  const findings = activeQuery.data?.items ?? []
  const isLoading = activeQuery.isLoading || statsQuery.isLoading

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Log Analysis"
        subtitle="AI-triaged production exceptions — genuine findings surfaced before customers notice"
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon={
              <RefreshCw
                size={14}
                className={findingsQuery.isFetching ? 'animate-spin' : ''}
              />
            }
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['log-analysis-findings'] })
              queryClient.invalidateQueries({ queryKey: ['log-analysis-false-positives'] })
              queryClient.invalidateQueries({ queryKey: ['log-analysis-stats'] })
            }}
          >
            Refresh
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Open Findings"
          value={isLoading ? '—' : (stats?.openTotal ?? 0)}
          icon={<Activity size={15} />}
          accentColor="var(--color-buttons-button-primary)"
          tooltip="Total genuine findings currently open."
        />
        <StatCard
          label="High Severity"
          value={isLoading ? '—' : (stats?.openHigh ?? 0)}
          icon={<AlertTriangle size={15} />}
          accent={(stats?.openHigh ?? 0) > 0 ? 'text-red-500' : undefined}
          accentColor={(stats?.openHigh ?? 0) > 0 ? '#ef4444' : undefined}
          tooltip="Open findings classified as high severity by AI triage."
        />
        <StatCard
          label="New Today"
          value={isLoading ? '—' : (stats?.newToday ?? 0)}
          icon={<Clock size={15} />}
          accent={(stats?.newToday ?? 0) > 0 ? 'text-orange-500' : undefined}
          accentColor={(stats?.newToday ?? 0) > 0 ? '#f97316' : undefined}
          tooltip="Findings first seen in the last 24 hours."
        />
        <StatCard
          label="Dismissed (7d)"
          value={isLoading ? '—' : (stats?.dismissedThisWeek ?? 0)}
          icon={<CheckCircle size={15} />}
          tooltip="Findings dismissed by developers in the last 7 days."
        />
      </div>

      {/* No log-analysis-enabled customers warning */}
      {!customersQuery.isLoading && logAnalysisCustomers.length === 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-tags-warning-background)] bg-[var(--color-tags-warning-background)]">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-tags-font-warning)' }} />
          <p className="text-sm" style={{ color: 'var(--color-tags-font-warning)' }}>
            Log analysis is not enabled for any customer environment. Enable it under{' '}
            <strong>Settings → Customers</strong> by adding a log analysis configuration to at least one environment.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <FilterSelect
          placeholder="All severities"
          options={SEVERITY_OPTIONS}
          value={severityFilter}
          onChange={setSeverityFilter}
        />
        <FilterSelect
          placeholder="All customers"
          options={customerOptions}
          value={customerFilter}
          onChange={setCustomerFilter}
        />
        {(severityFilter || customerFilter) && (
          <Button
            variant="ghost"
            size="sm"
            icon={<XCircle size={13} />}
            onClick={() => { setSeverityFilter(''); setCustomerFilter('') }}
          >
            Clear
          </Button>
        )}
        <button
          onClick={() => setShowFalsePositives((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-tag)] text-xs font-medium border transition-colors"
          style={
            showFalsePositives
              ? {
                  background: 'var(--color-tags-warning-background)',
                  color: 'var(--color-tags-font-warning)',
                  borderColor: 'var(--color-tags-font-warning)',
                }
              : {
                  background: 'transparent',
                  color: 'var(--color-fonts-font-color-support)',
                  borderColor: 'var(--color-cards-card-stroke)',
                }
          }
        >
          <ShieldOff size={13} />
          False Positives
        </button>
        <span className="ml-auto text-xs text-[var(--color-fonts-font-color-support)]">
          {findings.length} {showFalsePositives ? 'false positive' : 'finding'}{findings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-[var(--color-buttons-button-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : findingsQuery.isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--color-fonts-font-color-support)]">
            <AlertTriangle size={24} />
            <p className="text-sm">Failed to load findings.</p>
          </div>
        ) : findings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--color-fonts-font-color-support)]">
            {showFalsePositives ? <ShieldOff size={24} /> : <CheckCircle size={24} />}
            <p className="text-sm font-medium">
              {showFalsePositives ? 'No false positives logged' : 'No open findings'}
            </p>
            <p className="text-xs">
              {showFalsePositives
                ? 'The AI has not suppressed any exceptions as false positives yet.'
                : 'All clear — or log analysis is not yet enabled for any environment.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
                  <th className="px-4 py-2 w-6" />
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">Severity</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">Exception</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">Customer</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">Environment</th>
                  <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">Occurrences</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">First Seen</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">Jira</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">Job</th>
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)]">PR</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <FindingRow
                    key={finding.id}
                    finding={finding}
                    onDismiss={(id) => dismissMutation.mutate(id)}
                    isDismissing={dismissMutation.isPending}
                    readOnly={showFalsePositives}
                    jiraBaseUrl={jiraBaseUrl}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}
    </main>
  )
}
