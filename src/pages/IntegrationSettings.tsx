import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { RefreshCw, AlertTriangle, Webhook, Power, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import { TableCard } from '@/components/ui/TableCard'
import { TabBar, TabButton } from '@/components/ui/Tabs'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import api from '@/lib/api'
import type {
  IntegrationFilter,
  JiraProjectMeta,
  UpsertIntegrationFilterRequest,
} from '@/types/api'

// ── Confluence space meta (not in shared types) ───────────────────────────────

interface ConfluenceSpaceMeta {
  key: string
  name: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'jira' | 'confluence'

interface MergedRow {
  key: string
  name: string
  enabled: boolean
  webhookEnabled: boolean
  updatedAt: string | null
  hasRow: boolean
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchJiraProjects(): Promise<JiraProjectMeta[]> {
  return api.get('/jira/meta/projects').then((r) => r.data)
}

async function fetchConfluenceSpaces(): Promise<ConfluenceSpaceMeta[]> {
  return api.get('/confluence/meta/spaces').then((r) => r.data)
}

async function fetchFilters(type: Tab): Promise<IntegrationFilter[]> {
  return api.get(`/integration-filters?type=${type}`).then((r) => r.data)
}

async function upsertFilter(
  type: Tab,
  key: string,
  body: UpsertIntegrationFilterRequest,
): Promise<IntegrationFilter> {
  return api.put(`/integration-filters/${type}/${key}`, body).then((r) => r.data)
}

async function resetFilter(type: Tab, key: string): Promise<void> {
  return api.delete(`/integration-filters/${type}/${key}`).then(() => undefined)
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2',
        'transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--color-fonts-font-color-brand)] focus-visible:ring-offset-2',
        checked
          ? 'bg-[var(--color-fonts-font-color-brand)] border-transparent'
          : 'bg-[#CCCCCC] border-[#B8B8B8]',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
          'transform transition duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

export default function IntegrationSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('jira')
  const [jiraPage, setJiraPage] = useState(0)
  const [confluencePage, setConfluencePage] = useState(0)
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const [pendingDisable, setPendingDisable] = useState<{
    type: Tab
    key: string
    name: string
    body: UpsertIntegrationFilterRequest
  } | null>(null)

  const queryClient = useQueryClient()

  const jiraProjectsQuery = useQuery({
    queryKey: ['jira-meta-projects'],
    queryFn: fetchJiraProjects,
    staleTime: 60_000,
  })

  const confluenceSpacesQuery = useQuery({
    queryKey: ['confluence-meta-spaces'],
    queryFn: fetchConfluenceSpaces,
    staleTime: 60_000,
  })

  const jiraFiltersQuery = useQuery({
    queryKey: ['integration-filters', 'jira'],
    queryFn: () => fetchFilters('jira'),
  })

  const confluenceFiltersQuery = useQuery({
    queryKey: ['integration-filters', 'confluence'] as const,
    queryFn: () => fetchFilters('confluence'),
  })

  const upsertMutation = useMutation({
    mutationFn: ({
      type,
      key,
      body,
    }: {
      type: Tab
      key: string
      body: UpsertIntegrationFilterRequest
    }) => upsertFilter(type, key, body),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['integration-filters', vars.type] })
      setToast({ variant: 'success', message: 'Filter updated' })
    },
    onError: () => {
      setToast({ variant: 'error', message: 'Failed to update filter' })
    },
  })

  const resetMutation = useMutation({
    mutationFn: ({ type, key }: { type: Tab; key: string }) => resetFilter(type, key),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['integration-filters', vars.type] })
      setToast({ variant: 'success', message: 'Filter reset to defaults' })
    },
    onError: () => {
      setToast({ variant: 'error', message: 'Failed to reset filter' })
    },
  })

  // ── Merge live API list with DB filter state ────────────────────────────────

  const jiraRows = useMemo<MergedRow[]>(() => {
    const projects = jiraProjectsQuery.data ?? []
    const filters = jiraFiltersQuery.data ?? []
    const filterMap = new Map(filters.map((f) => [f.key, f]))
    return projects.map((p) => {
      const f = filterMap.get(p.key)
      return {
        key: p.key,
        name: p.name,
        enabled: f ? f.enabled : false,
        webhookEnabled: f ? f.webhookEnabled : false,
        updatedAt: f ? f.updatedAt : null,
        hasRow: !!f,
      }
    })
  }, [jiraProjectsQuery.data, jiraFiltersQuery.data])

  const confluenceRows = useMemo<MergedRow[]>(() => {
    const spaces = confluenceSpacesQuery.data ?? []
    const filters = confluenceFiltersQuery.data ?? []
    const filterMap = new Map(filters.map((f) => [f.key, f]))
    return spaces.map((s) => {
      const f = filterMap.get(s.key)
      return {
        key: s.key,
        name: s.name,
        enabled: f ? f.enabled : false,
        webhookEnabled: f ? f.webhookEnabled : false,
        updatedAt: f ? f.updatedAt : null,
        hasRow: !!f,
      }
    })
  }, [confluenceSpacesQuery.data, confluenceFiltersQuery.data])

  const rows = activeTab === 'jira' ? jiraRows : confluenceRows
  const page = activeTab === 'jira' ? jiraPage : confluencePage
  const setPage = activeTab === 'jira' ? setJiraPage : setConfluencePage
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pagedRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleToggle(
    row: MergedRow,
    field: 'enabled' | 'webhookEnabled',
    newValue: boolean,
  ) {
    const body: UpsertIntegrationFilterRequest = {
      name: row.name,
      enabled: field === 'enabled' ? newValue : row.enabled,
      webhookEnabled: field === 'webhookEnabled' ? newValue : row.webhookEnabled,
    }

    if (field === 'enabled' && !newValue) {
      setPendingDisable({ type: activeTab, key: row.key, name: row.name, body })
      return
    }

    upsertMutation.mutate({ type: activeTab, key: row.key, body })
  }

  function handleReset(row: MergedRow) {
    resetMutation.mutate({ type: activeTab, key: row.key })
  }

  function handleRefresh() {
    if (activeTab === 'jira') {
      queryClient.invalidateQueries({ queryKey: ['jira-meta-projects'] })
      queryClient.invalidateQueries({ queryKey: ['integration-filters', 'jira'] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['confluence-meta-spaces'] })
      queryClient.invalidateQueries({ queryKey: ['integration-filters', 'confluence'] })
    }
  }

  const isLoading =
    activeTab === 'jira'
      ? jiraProjectsQuery.isLoading || jiraFiltersQuery.isLoading
      : confluenceSpacesQuery.isLoading || confluenceFiltersQuery.isLoading

  const isError =
    activeTab === 'jira'
      ? jiraProjectsQuery.isError || jiraFiltersQuery.isError
      : confluenceSpacesQuery.isError || confluenceFiltersQuery.isError

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Integration Filters"
        description="Enable or disable Jira projects and Confluence spaces. Disabled entries are excluded from webhooks, knowledge indexing, and UI selectors."
      />

      <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-4">
        {/* Tab bar */}
        <TabBar>
          <TabButton active={activeTab === 'jira'} onClick={() => { setActiveTab('jira'); setJiraPage(0) }}>
            Jira Projects
            {jiraRows.length > 0 && (
              <span className="ml-1 text-xs text-[var(--color-fonts-font-color-support)]">
                ({jiraRows.filter((r) => !r.enabled).length} disabled)
              </span>
            )}
          </TabButton>
          <TabButton
            active={activeTab === 'confluence'}
            onClick={() => { setActiveTab('confluence'); setConfluencePage(0) }}
          >
            Confluence Spaces
            {confluenceRows.length > 0 && (
              <span className="ml-1 text-xs text-[var(--color-fonts-font-color-support)]">
                ({confluenceRows.filter((r) => !r.enabled).length} disabled)
              </span>
            )}
          </TabButton>
        </TabBar>

        {/* Table */}
        <TableCard
          title={activeTab === 'jira' ? 'Jira Projects' : 'Confluence Spaces'}
          subtitle={`${rows.length} total`}
          maxHeight="auto"
          className={!isError && !isLoading && rows.length > PAGE_SIZE ? '[&]:rounded-b-none' : ''}
          toolbar={
            <div className="flex items-center gap-2">
              {/* Pagination controls in header */}
              {!isError && !isLoading && rows.length > PAGE_SIZE && (
                <div className="flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-support)]">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1 rounded hover:bg-[var(--color-tables-table-row-hover-background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="px-1 tabular-nums">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1 rounded hover:bg-[var(--color-tables-table-row-hover-background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </Button>
            </div>
          }
        >
          {isError && (
            <div className="flex items-center gap-2 p-4 text-sm text-[var(--color-status-error)]">
              <AlertTriangle size={15} />
              Failed to load{' '}
              {activeTab === 'jira' ? 'Jira projects' : 'Confluence spaces'}. Check
              integration settings.
            </div>
          )}

          {!isError && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-tables-table-header-background)]">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                    Key
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                    <span className="flex items-center justify-center gap-1">
                      <Power size={11} />
                      Enabled
                    </span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                    <span className="flex items-center justify-center gap-1">
                      <Webhook size={11} />
                      Webhook
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                    Last Updated
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]"
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-[var(--color-fonts-font-color-support)]"
                    >
                      No {activeTab === 'jira' ? 'Jira projects' : 'Confluence spaces'} found.
                      Check your integration credentials in System Settings.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  pagedRows.map((row) => (
                    <tr
                      key={row.key}
                      className={[
                        'border-b border-[var(--color-tables-table-row-stroke)] last:border-0',
                        'hover:bg-[var(--color-tables-table-row-hover-background)] transition-colors',
                        !row.enabled ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      <td className="px-3 py-2.5 font-medium text-[var(--color-fonts-font-color-primary)]">
                        {row.name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-fonts-font-color-support)]">
                        {row.key}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Toggle
                          checked={row.enabled}
                          onChange={(v) => handleToggle(row, 'enabled', v)}
                          disabled={upsertMutation.isPending}
                          label={`${row.enabled ? 'Disable' : 'Enable'} ${row.key}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Toggle
                          checked={row.webhookEnabled}
                          onChange={(v) => handleToggle(row, 'webhookEnabled', v)}
                          disabled={upsertMutation.isPending || !row.enabled}
                          label={`${row.webhookEnabled ? 'Disable' : 'Enable'} webhook for ${row.key}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[var(--color-fonts-font-color-support)]">
                        {row.updatedAt
                          ? new Date(row.updatedAt).toLocaleString()
                          : <span className="italic">default</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {row.hasRow && (
                          <button
                            type="button"
                            onClick={() => handleReset(row)}
                            disabled={resetMutation.isPending}
                            title="Reset to defaults (enabled, webhook enabled)"
                            className="inline-flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors disabled:opacity-50"
                          >
                            <RotateCcw size={12} />
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

        </TableCard>

        {/* Pagination footer — outside TableCard so it is never hidden inside the scroll body */}
        {!isError && !isLoading && rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-3 py-2 rounded-b-lg border border-t-0 border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] text-xs text-[var(--color-fonts-font-color-support)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <span>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-[var(--color-tables-table-row-hover-background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-1">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-[var(--color-tables-table-row-hover-background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disable confirmation dialog */}
      {pendingDisable && (
        <ConfirmDialog
          title={`Disable ${activeTab === 'jira' ? 'project' : 'space'} "${pendingDisable.name}"?`}
          confirmLabel="Disable and purge"
          variant="danger"
          isPending={upsertMutation.isPending}
          onConfirm={() => {
            upsertMutation.mutate({
              type: pendingDisable.type,
              key: pendingDisable.key,
              body: pendingDisable.body,
            })
            setPendingDisable(null)
          }}
          onCancel={() => setPendingDisable(null)}
        >
          {activeTab === 'jira'
            ? `Disabling this project will immediately remove all indexed Jira issues and attachments for "${pendingDisable.key}" from the knowledge base. Webhooks for this project will be ignored. Re-enabling requires a manual reindex.`
            : `Disabling this space will immediately remove all indexed Confluence pages for "${pendingDisable.key}" from the knowledge base. Webhooks for this space will be ignored. Re-enabling requires a manual reindex.`}
        </ConfirmDialog>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
