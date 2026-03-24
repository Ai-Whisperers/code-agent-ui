import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { WebhookAuditEntry } from '@/types/api'

const PLATFORM_LABELS: Record<string, string> = {
  bitbucket: 'Bitbucket',
  gitlab: 'GitLab',
  github: 'GitHub',
  azuredevops: 'Azure DevOps',
}

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  review_triggered:  { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Review Triggered' },
  hooks_evaluated:   { bg: 'var(--color-tags-brand-background)',    text: 'var(--color-tags-font-brand)',    label: 'Hooks Evaluated' },
  fix_triggered:     { bg: 'var(--color-tags-warning-background)',  text: 'var(--color-tags-font-warning)',  label: 'Fix Triggered' },
  reply_triggered:   { bg: 'var(--color-tags-brand-background)',    text: 'var(--color-tags-font-brand)',    label: 'Reply Triggered' },
  learn_command:     { bg: 'var(--color-tags-success-background)',  text: 'var(--color-tags-font-success)',  label: 'Learn' },
  false_positive:    { bg: 'var(--color-tags-warning-background)',  text: 'var(--color-tags-font-warning)',  label: 'False Positive' },
  generate_tests:    { bg: 'var(--color-tags-brand-background)',    text: 'var(--color-tags-font-brand)',    label: 'Generate Tests' },
  skipped:           { bg: 'var(--color-tags-neutral-background)',  text: 'var(--color-tags-font-neutral)',  label: 'Skipped' },
  ignored:           { bg: 'var(--color-tags-neutral-background)',  text: 'var(--color-tags-font-neutral)',  label: 'Ignored' },
  error:             { bg: 'var(--color-tags-danger-background)',   text: 'var(--color-tags-font-danger)',   label: 'Error' },
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string }> = {
  bitbucket:   { bg: 'var(--color-tags-brand-background)',   text: 'var(--color-tags-font-brand)' },
  gitlab:      { bg: 'var(--color-tags-warning-background)', text: 'var(--color-tags-font-warning)' },
  github:      { bg: 'var(--color-tags-neutral-background)', text: 'var(--color-tags-font-neutral)' },
  azuredevops: { bg: 'var(--color-tags-brand-background)',   text: 'var(--color-tags-font-brand)' },
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
      {style.label ?? action}
    </span>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const style = PLATFORM_STYLES[platform] ?? {
    bg: 'var(--color-tags-neutral-background)',
    text: 'var(--color-tags-font-neutral)',
  }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {PLATFORM_LABELS[platform] ?? platform}
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

function PayloadViewer({ payload }: { payload?: string }) {
  if (!payload) {
    return <p className="text-xs text-[var(--color-fonts-font-color-support)] italic">No payload recorded.</p>
  }
  let formatted = payload
  try {
    formatted = JSON.stringify(JSON.parse(payload), null, 2)
  } catch {
    // not JSON, display raw
  }
  return (
    <pre className="text-xs bg-[var(--color-inputs-input-background)] border border-[var(--color-inputs-input-border)] rounded-[var(--border-radius-small)] p-3 overflow-x-auto max-h-96 text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap break-all">
      {formatted}
    </pre>
  )
}

function AuditRow({ entry, isOdd }: { entry: WebhookAuditEntry; isOdd: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${
          isOdd ? '' : 'bg-[var(--color-tables-table-row-a)]'
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-2.5 text-[var(--color-fonts-font-color-support)]">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
          {formatDate(entry.receivedAt)}
        </td>
        <td className="px-3 py-2.5">
          <PlatformBadge platform={entry.platform} />
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-fonts-font-color-primary)] font-mono">
          {entry.eventType}
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-fonts-font-color-primary)]">
          {entry.workspace && entry.repoSlug ? (
            <span>
              <span className="text-[var(--color-fonts-font-color-support)]">{entry.workspace}/</span>
              {entry.repoSlug}
            </span>
          ) : (
            <span className="text-[var(--color-fonts-font-color-support)]">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-fonts-font-color-support)]">
          {entry.prId ? `#${entry.prId}` : '—'}
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-fonts-font-color-primary)]">
          {entry.author ?? '—'}
        </td>
        <td className="px-3 py-2.5">
          <ActionBadge action={entry.action} />
        </td>
        <td className="px-3 py-2.5">
          {entry.hooksExecuted && entry.hooksExecuted.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {entry.hooksExecuted.map((h) => (
                <span
                  key={h}
                  className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] font-medium"
                >
                  {h}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">—</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[var(--color-tables-table-cell-stroke)] bg-[var(--color-inputs-input-background)]">
          <td colSpan={9} className="px-6 py-4">
            <p className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide mb-2">
              Raw Payload
            </p>
            <PayloadViewer payload={entry.payload} />
          </td>
        </tr>
      )}
    </>
  )
}

export default function WebhookAuditLogPage() {
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')

  const { data, isLoading, refetch, isFetching } = useQuery<WebhookAuditEntry[]>({
    queryKey: ['webhook-audit'],
    queryFn: () => api.get('/webhook-audit?limit=200').then((r) => r.data).catch(() => []),
    staleTime: 15_000,
  })

  const entries = Array.isArray(data) ? data : []

  const filtered = entries.filter((e) => {
    if (platformFilter !== 'all' && e.platform !== platformFilter) return false
    if (actionFilter !== 'all' && e.action !== actionFilter) return false
    return true
  })

  const platforms = [...new Set(entries.map((e) => e.platform))].sort()
  const actions = [...new Set(entries.map((e) => e.action))].sort()

  return (
    <main>
      <PageHeader
        title="Webhook Audit Log"
        subtitle="All incoming webhook events received by the agent."
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-sm font-medium hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
            Platform
          </label>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="px-2 py-1 text-sm rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
          >
            <option value="all">All</option>
            {platforms.map((p) => (
              <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
            Action
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2 py-1 text-sm rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
          >
            <option value="all">All</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_STYLES[a]?.label ?? a}</option>
            ))}
          </select>
        </div>
        {filtered.length !== entries.length && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">
            Showing {filtered.length} of {entries.length}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
                {['', 'Received', 'Platform', 'Event', 'Repository', 'PR', 'Author', 'Action', 'Hooks Executed'].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                      <td colSpan={9} className="px-3 py-3">
                        <div className="h-4 skeleton-shimmer rounded" />
                      </td>
                    </tr>
                  ))
                : filtered.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-[var(--color-fonts-font-color-support)]"
                    >
                      {entries.length === 0
                        ? 'No webhook events recorded yet.'
                        : 'No entries match the current filters.'}
                    </td>
                  </tr>
                )
                : filtered.map((entry, i) => (
                    <AuditRow key={entry.id} entry={entry} isOdd={i % 2 !== 0} />
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
