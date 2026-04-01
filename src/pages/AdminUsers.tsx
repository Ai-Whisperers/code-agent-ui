import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { ShieldOff, ShieldCheck, RefreshCw, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string
  username: string
  email: string | null
  firstName: string | null
  lastName: string | null
  enabled: boolean
  roles: string[]
  groups: string[]
  lastLoginAt: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(user: AdminUser): string {
  const first = user.firstName?.charAt(0) ?? ''
  const last = user.lastName?.charAt(0) ?? ''
  if (first || last) return (first + last).toUpperCase()
  return user.username.charAt(0).toUpperCase()
}

function displayName(user: AdminUser): string {
  const parts = [user.firstName, user.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : user.username
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ROLE_STYLE: Record<string, { bg: string; text: string }> = {
  app_admin:     { bg: 'var(--color-tags-danger-background)',   text: 'var(--color-tags-font-danger)' },
  app_developer: { bg: 'var(--color-tags-brand-background)',    text: 'var(--color-tags-font-brand)' },
  app_staff:     { bg: 'var(--color-tags-warning-background)',  text: 'var(--color-tags-font-warning)' },
  app_user:      { bg: 'var(--color-tags-neutral-background)',  text: 'var(--color-tags-font-neutral)' },
}

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_STYLE[role] ?? {
    bg:   'var(--color-tags-neutral-background)',
    text: 'var(--color-tags-font-neutral)',
  }
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
      style={{ background: style.bg, color: style.text }}
    >
      {role}
    </span>
  )
}

function GroupBadge({ group }: { group: string }) {
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
      style={{
        background: 'var(--color-tags-brand-background)',
        color: 'var(--color-tags-font-brand)',
        opacity: 0.85,
      }}
    >
      {group}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [pendingToggle, setPendingToggle] = useState<AdminUser | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
    retry: 1,
  })

  const toggleMutation = useMutation({
    mutationFn: (user: AdminUser) =>
      api.put(`/admin/users/${user.id}/enabled`, { enabled: !user.enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setPendingToggle(null)
    },
  })

  const users = useMemo(() => (Array.isArray(data) ? data : []), [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName ?? '').toLowerCase().includes(q),
    )
  }, [users, search])

  const errorMessage = isError
    ? ((error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
       'Failed to load users.')
    : null

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Users"
        subtitle="Manage Keycloak users — view roles, last login, and block/unblock access."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            Refresh
          </Button>
        }
      />

      {/* Error banner */}
      {errorMessage && (
        <div className="mb-4 px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-tags-danger-background)] bg-[var(--color-tags-danger-background)] text-sm text-[var(--color-tags-font-danger)]">
          {errorMessage}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username or email…"
            className="w-full h-8 pl-8 pr-3 text-sm rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)]"
          />
        </div>
        <span className="ml-auto text-xs text-[var(--color-fonts-font-color-support)]">
          {!isLoading && users.length > 0 && `${filtered.length} of ${users.length}`}
        </span>
      </div>

      {/* Table */}
      <TableCard
        className="flex-1 min-h-0"
        title="Users"
        subtitle={isLoading ? '…' : `${filtered.length} user${filtered.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                User
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-48">
                Roles
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-48">
                Groups
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-44">
                <Tooltip text="Most recent successful login" position="bottom">Last Login</Tooltip>
              </th>
              <th className="text-center px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-24">
                Status
              </th>
              <th className="px-4 py-2 w-28 text-right text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] last:border-0"
                  >
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 skeleton-shimmer rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-[var(--color-fonts-font-color-support)]"
                    >
                      {users.length === 0 && !isError
                        ? 'No users found.'
                        : 'No users match the current search.'}
                    </td>
                  </tr>
                )
              : filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] last:border-0 hover:bg-[var(--color-tables-table-hover)] transition-colors"
                  >
                    {/* User cell */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 select-none"
                          style={{
                            background: 'var(--color-navigation-menu-item-hover-background)',
                            color: 'var(--color-fonts-font-color-primary)',
                          }}
                        >
                          {initials(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)] truncate">
                            {displayName(user)}
                          </p>
                          <p className="text-[11px] text-[var(--color-fonts-font-color-support)] truncate">
                            {user.email ?? user.username}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Roles cell */}
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0
                          ? user.roles.map((r) => <RoleBadge key={r} role={r} />)
                          : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                      </div>
                    </td>

                    {/* Groups cell */}
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(user.groups ?? []).length > 0
                          ? (user.groups ?? []).map((g) => <GroupBadge key={g} group={g} />)
                          : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                      </div>
                    </td>

                    {/* Last login cell */}
                    <td className="px-4 py-2 text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                      {formatDate(user.lastLoginAt)}
                    </td>

                    {/* Status cell */}
                    <td className="px-4 py-2 text-center">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-[var(--border-radius-tag)] font-medium"
                        style={
                          user.enabled
                            ? {
                                background: 'var(--color-tags-success-background)',
                                color: 'var(--color-tags-font-success)',
                              }
                            : {
                                background: 'var(--color-tags-danger-background)',
                                color: 'var(--color-tags-font-danger)',
                              }
                        }
                      >
                        {user.enabled ? 'Active' : 'Blocked'}
                      </span>
                    </td>

                    {/* Actions cell */}
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant={user.enabled ? 'danger' : 'secondary'}
                        size="xs"
                        icon={
                          user.enabled
                            ? <ShieldOff size={13} />
                            : <ShieldCheck size={13} />
                        }
                        onClick={() => setPendingToggle(user)}
                        disabled={toggleMutation.isPending}
                      >
                        {user.enabled ? 'Block' : 'Unblock'}
                      </Button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </TableCard>

      {/* Confirm block/unblock dialog */}
      {pendingToggle && (
        <ConfirmDialog
          title={pendingToggle.enabled ? 'Block user?' : 'Unblock user?'}
          confirmLabel={pendingToggle.enabled ? 'Block' : 'Unblock'}
          variant={pendingToggle.enabled ? 'danger' : 'default'}
          icon={pendingToggle.enabled ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
          isPending={toggleMutation.isPending}
          onConfirm={() => toggleMutation.mutate(pendingToggle)}
          onCancel={() => setPendingToggle(null)}
        >
          {pendingToggle.enabled ? (
            <>
              <strong>{displayName(pendingToggle)}</strong> will be disabled in Keycloak and will
              not be able to log in until unblocked.
            </>
          ) : (
            <>
              <strong>{displayName(pendingToggle)}</strong> will be re-enabled and will be able to
              log in again.
            </>
          )}
        </ConfirmDialog>
      )}
    </main>
  )
}
