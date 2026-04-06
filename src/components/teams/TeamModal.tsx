import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TabBar, TabButton } from '@/components/ui/Tabs'
import api from '@/lib/api'
import type { Team, TeamRole } from '@/types/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAM_ROLES: Array<{ value: TeamRole | string; label: string }> = [
  { value: 'productOwner', label: 'Product Owner' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'devops', label: 'DevOps' },
  { value: 'operations', label: 'Operations' },
  { value: 'qa', label: 'QA' },
  { value: 'security', label: 'Security' },
  { value: 'supportQueue', label: 'Support Queue' },
]

const selectCls =
  'h-7 px-2 rounded border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-xs text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'

const labelCls = 'block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1'

// ── Keycloak user shape from GET /admin/users ─────────────────────────────────

interface AdminUser {
  id: string
  username: string
  email: string | null
  firstName: string | null
  lastName: string | null
  enabled: boolean
}

function displayName(u: AdminUser): string {
  const parts = [u.firstName, u.lastName].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : u.username
}

function initials(u: AdminUser): string {
  const first = u.firstName?.charAt(0) ?? ''
  const last = u.lastName?.charAt(0) ?? ''
  return (first + last).toUpperCase() || u.username.charAt(0).toUpperCase()
}

// ── Pending member (before save) ──────────────────────────────────────────────

interface PendingMember {
  keycloakUserId: string
  role: string
  displayName: string
  email: string | null
}

type ModalTab = 'general' | 'members'

// ── Props ─────────────────────────────────────────────────────────────────────

interface TeamModalProps {
  initial?: Team
  onClose: () => void
  onSaved: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TeamModal({ initial, onClose, onSaved }: TeamModalProps) {
  const isEdit = !!initial
  const qc = useQueryClient()

  const [tab, setTab] = useState<ModalTab>('general')
  const [teamId, setTeamId] = useState(initial?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [members, setMembers] = useState<PendingMember[]>(() =>
    (initial?.members ?? []).map((m) => ({
      keycloakUserId: m.keycloakUserId,
      role: m.role,
      displayName: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || m.keycloakUserId,
      email: m.email ?? null,
    }))
  )
  const [userSearch, setUserSearch] = useState('')

  const { data: kcUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
    staleTime: 60_000,
  })

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return kcUsers
    return kcUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName ?? '').toLowerCase().includes(q)
    )
  }, [kcUsers, userSearch])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/teams/${teamId}`, { name, description })
      await api.put(`/teams/${teamId}/members`, {
        members: members.map((m) => ({ keycloakUserId: m.keycloakUserId, role: m.role })),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      onSaved()
    },
  })

  function addMember(user: AdminUser) {
    setMembers((prev) => [
      ...prev,
      {
        keycloakUserId: user.id,
        role: 'engineering',
        displayName: displayName(user),
        email: user.email,
      },
    ])
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateRole(idx: number, role: string) {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, role } : m)))
  }

  const canSave = teamId.trim().length > 0 && name.trim().length > 0

  const membersTabLabel = members.length > 0 ? `Members (${members.length})` : 'Members'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
            {isEdit ? `Edit Team — ${initial.id}` : 'New Team'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <TabBar className="px-5 shrink-0">
          <TabButton active={tab === 'general'} onClick={() => setTab('general')}>General</TabButton>
          <TabButton active={tab === 'members'} onClick={() => setTab('members')}>{membersTabLabel}</TabButton>
        </TabBar>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {tab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Team ID *</label>
                <Input
                  className="w-full"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={isEdit}
                  placeholder="e.g. jules-team"
                  autoFocus={!isEdit}
                />
                {!isEdit && (
                  <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                    Unique slug — cannot be changed after creation.
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Name *</label>
                <Input
                  className="w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jules Team"
                  autoFocus={isEdit}
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <Input
                  className="w-full"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
          )}

          {tab === 'members' && (
            <div className="space-y-4">
              {/* User search */}
              <div>
                <label className={labelCls}>Add user</label>
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none"
                  />
                  <Input
                    className="w-full pl-8"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, username or email…"
                  />
                </div>
              </div>

              {/* Search results */}
              {userSearch.trim().length > 0 && (
                <div className="border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden max-h-48 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-[var(--color-fonts-font-color-support)] text-center">
                      No users match your search.
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-cards-card-stroke)] last:border-0 hover:bg-[var(--color-navigation-menu-item-hover-background)]"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                          style={{
                            background: 'var(--color-navigation-menu-item-hover-background)',
                            color: 'var(--color-fonts-font-color-primary)',
                          }}
                        >
                          {initials(u)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] truncate">
                            {displayName(u)}
                          </p>
                          <p className="text-[11px] text-[var(--color-fonts-font-color-support)] truncate">
                            {u.email ?? u.username}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="xs"
                          icon={<UserPlus size={11} />}
                          onClick={() => addMember(u)}
                        >
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Current members */}
              {members.length > 0 && (
                <div>
                  <label className={labelCls}>Team members</label>
                  <div className="border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden">
                    {members.map((m, idx) => (
                      <div
                        key={`${m.keycloakUserId}-${idx}`}
                        className="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-cards-card-stroke)] last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] truncate">
                            {m.displayName}
                          </p>
                          {m.email && (
                            <p className="text-[11px] text-[var(--color-fonts-font-color-support)] truncate">
                              {m.email}
                            </p>
                          )}
                        </div>
                        <select
                          className={selectCls}
                          value={m.role}
                          onChange={(e) => updateRole(idx, e.target.value)}
                        >
                          {TEAM_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<X size={11} />}
                          onClick={() => removeMember(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {members.length === 0 && userSearch.trim().length === 0 && (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] text-center py-6">
                  Search for users above to add them to this team.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-cards-card-stroke)] shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            loading={saveMutation.isPending}
            disabled={!canSave || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
