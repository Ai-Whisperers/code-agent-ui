import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: number
  actor: string
  category: string
  action: string
  resourceType: string | null
  resourceId: string | null
  detail: string | null
  occurredAt: string
}

// ── Label / style maps ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  JOBS:          'Jobs',
  SETTINGS:      'Settings',
  REPO_SETTINGS: 'Repo Settings',
  HOOKS:         'Hooks',
  PROMPTS:       'Prompts',
  MEMORIES:      'Memories',
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  JOBS:          { bg: 'var(--color-tags-brand-background)',   text: 'var(--color-tags-font-brand)' },
  SETTINGS:      { bg: 'var(--color-tags-warning-background)', text: 'var(--color-tags-font-warning)' },
  REPO_SETTINGS: { bg: 'var(--color-tags-success-background)', text: 'var(--color-tags-font-success)' },
  HOOKS:         { bg: 'var(--color-tags-neutral-background)', text: 'var(--color-tags-font-neutral)' },
  PROMPTS:       { bg: 'var(--color-tags-neutral-background)', text: 'var(--color-tags-font-neutral)' },
  MEMORIES:      { bg: 'var(--color-tags-neutral-background)', text: 'var(--color-tags-font-neutral)' },
}

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  JOB_SUBMITTED:              { bg: 'var(--color-tags-brand-background)',    text: 'var(--color-tags-font-brand)',    label: 'Job Submitted' },
  JOB_APPROVED:               { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Job Approved' },
  JOB_REJECTED:               { bg: 'var(--color-tags-danger-background)',   text: 'var(--color-tags-font-danger)',   label: 'Job Rejected' },
  JIRA_SYNC:                  { bg: 'var(--color-tags-brand-background)',    text: 'var(--color-tags-font-brand)',    label: 'Jira Sync' },
  SETTING_CHANGED:            { bg: 'var(--color-tags-warning-background)',  text: 'var(--color-tags-font-warning)',  label: 'Setting Changed' },
  SETTING_DELETED:            { bg: 'var(--color-tags-danger-background)',   text: 'var(--color-tags-font-danger)',   label: 'Setting Deleted' },
  REPO_SETTINGS_SAVED:        { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Repo Saved' },
  REPO_REVIEW_ENABLED:        { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Review Enabled' },
  REPO_REVIEW_DISABLED:       { bg: 'var(--color-tags-neutral-background)',  text: 'var(--color-tags-font-neutral)',  label: 'Review Disabled' },
  REPO_VECTOR_ENABLED:        { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Vector Enabled' },
  REPO_VECTOR_DISABLED:       { bg: 'var(--color-tags-neutral-background)',  text: 'var(--color-tags-font-neutral)',  label: 'Vector Disabled' },
  REPO_DOCS_ENABLED:          { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Docs Enabled' },
  REPO_DOCS_DISABLED:         { bg: 'var(--color-tags-neutral-background)',  text: 'var(--color-tags-font-neutral)',  label: 'Docs Disabled' },
  REPO_UPGRADE_ENABLED:       { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Upgrade Enabled' },
  REPO_UPGRADE_DISABLED:      { bg: 'var(--color-tags-neutral-background)',  text: 'var(--color-tags-font-neutral)',  label: 'Upgrade Disabled' },
  REPO_QUALITY_REPORT_ENABLED:  { bg: 'var(--color-tags-success-background)', text: 'var(--color-tags-font-success)', label: 'Quality Report On' },
  REPO_QUALITY_REPORT_DISABLED: { bg: 'var(--color-tags-neutral-background)', text: 'var(--color-tags-font-neutral)', label: 'Quality Report Off' },
  REPO_ARCHIVED:              { bg: 'var(--color-tags-warning-background)',  text: 'var(--color-tags-font-warning)',  label: 'Repo Archived' },
  REPO_UNARCHIVED:            { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Repo Unarchived' },
  REPO_DELETED:               { bg: 'var(--color-tags-danger-background)',   text: 'var(--color-tags-font-danger)',   label: 'Repo Deleted' },
  REPO_SYNC:                  { bg: 'var(--color-tags-brand-background)',    text: 'var(--color-tags-font-brand)',    label: 'Repo Sync' },
}

// ── Helper components ─────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? {
    bg: 'var(--color-tags-neutral-background)',
    text: 'var(--color-tags-font-neutral)',
  }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {CATEGORY_LABELS[category] ?? category}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? {
    bg: 'var(--color-tags-neutral-background)',
    text: 'var(--color-tags-font-neutral)',
    label: action,
  }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function DetailViewer({ detail }: { detail?: string | null }) {
  if (!detail) {
    return <p className="text-xs text-[var(--color-fonts-font-color-support)] italic">No detail recorded.</p>
  }
  let formatted = detail
  try {
    formatted = JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    // not JSON, display raw
  }
  return (
    <pre className="text-xs bg-[var(--color-inputs-input-background)] border border-[var(--color-inputs-input-border)] rounded-[var(--border-radius-small)] p-3 overflow-x-auto max-h-64 text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap break-all">
      {formatted}
    </pre>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-1.5 text-[var(--color-fonts-font-color-support)]">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-3 py-1.5 text-xs text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
          {formatDate(entry.occurredAt)}
        </td>
        <td className="px-3 py-1.5 text-xs font-medium text-[var(--color-fonts-font-color-primary)]">
          {entry.actor}
        </td>
        <td className="px-3 py-1.5">
          <CategoryBadge category={entry.category} />
        </td>
        <td className="px-3 py-1.5">
          <ActionBadge action={entry.action} />
        </td>
        <td className="px-3 py-1.5 text-xs text-[var(--color-fonts-font-color-primary)] font-mono">
          {entry.resourceId ?? (entry.resourceType ?? '—')}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[var(--color-tables-table-cell-stroke)] bg-[var(--color-inputs-input-background)]">
          <td colSpan={6} className="px-6 py-4">
            <p className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide mb-2">
              Detail
            </p>
            <DetailViewer detail={entry.detail} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [actionFilter, setActionFilter]     = useState<string>('all')
  const [actorFilter, setActorFilter]       = useState<string>('')

  const { data, isLoading, refetch, isFetching } = useQuery<AuditEntry[]>({
    queryKey: ['audit-log'],
    queryFn: () => api.get('/audit?limit=500').then((r) => r.data).catch(() => []),
    staleTime: 15_000,
  })

  const entries = Array.isArray(data) ? data : []

  const filtered = entries.filter((e) => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false
    if (actionFilter !== 'all' && e.action !== actionFilter) return false
    if (actorFilter && !e.actor.toLowerCase().includes(actorFilter.toLowerCase())) return false
    return true
  })

  const categories = [...new Set(entries.map((e) => e.category))].sort()
  const actions    = [...new Set(entries.map((e) => e.action))].sort()

  const selectClass =
    'px-2 py-1 text-sm rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'

  return (
    <main>
      <PageHeader
        title="Audit Log"
        subtitle="Record of administrative and operational actions performed within the application."
        actions={
          <Button
            size="md"
            variant="secondary"
            icon={<RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
            Category
          </label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
            Action
          </label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
            <option value="all">All</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_STYLES[a]?.label ?? a}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
            Actor
          </label>
          <input
            type="text"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="Filter by user…"
            className={`${selectClass} w-40`}
          />
        </div>
      </div>

      {/* Table */}
      <TableCard
        title="Audit Log"
        subtitle={isLoading ? '…' : `${filtered.length}${filtered.length !== entries.length ? ` of ${entries.length}` : ''} event${filtered.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: '',           tip: '' },
                { label: 'Timestamp',  tip: 'When the event occurred' },
                { label: 'Actor',      tip: 'User or service that triggered the event' },
                { label: 'Category',   tip: 'High-level grouping of the event type' },
                { label: 'Action',     tip: 'Specific operation performed' },
                { label: 'Resource',   tip: 'Entity affected by the action' },
              ] as const).map(({ label, tip }) => (
                <th
                  key={label || 'expand'}
                  className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap"
                >
                  {tip ? <Tooltip text={tip} position="bottom">{label}</Tooltip> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                    <td colSpan={6} className="px-3 py-2">
                      <div className="h-4 skeleton-shimmer rounded" />
                    </td>
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-[var(--color-fonts-font-color-support)]"
                  >
                    {entries.length === 0
                      ? 'No audit events recorded yet.'
                      : 'No entries match the current filters.'}
                  </td>
                </tr>
              )
              : filtered.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
          </tbody>
        </table>
      </TableCard>
    </main>
  )
}
