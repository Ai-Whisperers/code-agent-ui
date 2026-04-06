import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RefreshCw, Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TableCard } from '@/components/ui/TableCard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Toast } from '@/components/ui/Toast'
import { TeamModal } from '@/components/teams/TeamModal'
import api from '@/lib/api'
import type { Team } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function memberCount(team: Team): number {
  return team.members?.length ?? 0
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    productOwner: 'Product Owner',
    engineering: 'Engineering',
    devops: 'DevOps',
    operations: 'Operations',
    qa: 'QA',
    security: 'Security',
    supportQueue: 'Support Queue',
  }
  return map[role] ?? role
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalTeam, setModalTeam] = useState<Team | null | 'new'>(null)
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams').then((r) => r.data),
    retry: 1,
  })

  const deleteMutation = useMutation({
    mutationFn: (team: Team) => api.delete(`/teams/${team.id}`),
    onSuccess: (_, team) => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      setPendingDelete(null)
      setToast({ message: `Team "${team.name}" deleted.`, variant: 'success' })
    },
    onError: () => {
      setToast({ message: 'Failed to delete team.', variant: 'error' })
      setPendingDelete(null)
    },
  })

  const teams = useMemo(() => (Array.isArray(data) ? data : []), [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teams
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
    )
  }, [teams, search])

  return (
    <main className="flex flex-col flex-1 min-h-0">
      <PageHeader
        title="Teams"
        subtitle="Manage teams and assign them to products."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />}
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setModalTeam('new')}
            >
              New Team
            </Button>
          </div>
        }
      />

      {isError && (
        <div className="mb-4 px-4 py-3 rounded-[var(--border-radius-card)] border border-[var(--color-tags-danger-background)] bg-[var(--color-tags-danger-background)] text-sm text-[var(--color-tags-font-danger)]">
          Failed to load teams.
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none"
          />
          <Input
            className="w-full pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams…"
          />
        </div>
        <span className="ml-auto text-xs text-[var(--color-fonts-font-color-support)]">
          {!isLoading && teams.length > 0 && `${filtered.length} of ${teams.length}`}
        </span>
      </div>

      <TableCard
        className="flex-1 min-h-0"
        title="Teams"
        subtitle={isLoading ? '…' : `${filtered.length} team${filtered.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                Name
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                Description
              </th>
              <th className="text-left px-4 py-2 text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide w-32">
                Members
              </th>
              <th className="px-4 py-2 w-32 text-right text-[10px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)] last:border-0">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 skeleton-shimmer rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-[var(--color-fonts-font-color-support)]">
                      {teams.length === 0 ? 'No teams yet. Create one to get started.' : 'No teams match your search.'}
                    </td>
                  </tr>
                )
              : filtered.map((team) => (
                  <tr
                    key={team.id}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] last:border-0 hover:bg-[var(--color-tables-table-hover)] transition-colors"
                  >
                    <td className="px-4 py-2">
                      <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">{team.name}</p>
                      <p className="text-[11px] text-[var(--color-fonts-font-color-support)]">{team.id}</p>
                    </td>
                    <td className="px-4 py-2 text-[var(--color-fonts-font-color-support)]">
                      {team.description ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5 text-[var(--color-fonts-font-color-support)]">
                        <Users size={12} />
                        <span>{memberCount(team)}</span>
                      </div>
                      {team.members && team.members.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(
                            team.members.reduce<Record<string, number>>((acc, m) => {
                              acc[m.role] = (acc[m.role] ?? 0) + 1
                              return acc
                            }, {})
                          ).map(([role, count]) => (
                            <span
                              key={role}
                              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{
                                background: 'var(--color-tags-neutral-background)',
                                color: 'var(--color-tags-font-neutral)',
                              }}
                            >
                              {roleLabel(role)} ×{count}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={<Pencil size={12} />}
                          onClick={() => setModalTeam(team)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          icon={<Trash2 size={12} />}
                          onClick={() => setPendingDelete(team)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </TableCard>

      {/* Team modal */}
      {modalTeam !== null && (
        <TeamModal
          initial={modalTeam === 'new' ? undefined : modalTeam}
          onClose={() => setModalTeam(null)}
          onSaved={() => {
            setModalTeam(null)
            setToast({ message: 'Team saved.', variant: 'success' })
          }}
        />
      )}

      {/* Delete confirm */}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete team?"
          confirmLabel="Delete"
          variant="danger"
          icon={<Trash2 size={16} />}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        >
          Delete team <strong>{pendingDelete.name}</strong>? Members will be unassigned from all products.
        </ConfirmDialog>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  )
}
