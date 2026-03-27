import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  ChevronDown,
  ChevronUp,
  Check,
  Minus,
  Copy,
  CheckCheck,
  Link,
  Unlink,
  Loader2,
  AlertCircle,
  User,
  ShieldCheck,
  Link2,
  KeyRound,
} from 'lucide-react'
import type { AuthUser } from '@/store/auth-store'
import {
  APP_ROLE_META,
  PERMISSION_META,
  PERMISSION_CATEGORY_ORDER,
  primaryRole,
  type AppRole,
  type Permission,
} from '@/lib/permissions'
import {
  mcpProfilesApi,
  type LinkedAccountResponse,
  type SystemConfig,
} from '@/lib/mcpProfiles'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  user: AuthUser
  onClose: () => void
}

type Tab = 'identity' | 'roles' | 'linked' | 'source'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'identity', label: 'Identity',     icon: <User size={14} /> },
  { id: 'roles',    label: 'Roles',        icon: <ShieldCheck size={14} /> },
  { id: 'linked',   label: 'Linked',       icon: <Link2 size={14} /> },
  { id: 'source',   label: 'Source',       icon: <KeyRound size={14} /> },
]

// ── Identity tab ──────────────────────────────────────────────────────────────

function IdentitySection({ user }: { user: AuthUser }) {
  const initials = (user.name || user.username)
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="space-y-6">
      {/* Avatar + name block */}
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 shrink-0 rounded-full bg-[var(--color-navigation-user-avatar-background)] flex items-center justify-center text-xl font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-[var(--color-fonts-font-color-headings)] truncate">
            {user.name || user.username}
          </p>
          <p className="text-sm text-[var(--color-fonts-font-color-support)] truncate">{user.email}</p>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">@{user.username}</p>
        </div>
      </div>

      {/* Detail rows */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <FieldRow label="Display name" value={user.name || '—'} />
        <FieldRow label="Username"     value={user.username || '—'} mono />
        <FieldRow label="Email"        value={user.email || '—'} />
      </div>
    </div>
  )
}

function FieldRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-0.5">{label}</p>
      <p className={`text-sm text-[var(--color-fonts-font-color-primary)] truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  )
}

// ── Roles & Permissions tab ───────────────────────────────────────────────────

function RoleBadge({ role }: { role: AppRole }) {
  const meta = APP_ROLE_META[role]
  const colorMap: Record<AppRole, string> = {
    ADMINISTRATOR: 'bg-[var(--color-status-background-critical)] text-[var(--color-status-text-critical)]',
    DEVELOPER:     'bg-[var(--color-status-background-active)] text-[var(--color-status-text-active)]',
    STAFF:         'bg-[var(--color-status-background-warning)] text-[var(--color-status-text-warning)]',
    USER:          'bg-[var(--color-status-background-neutral)] text-[var(--color-status-text-neutral)]',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[role]}`}>
      {meta.label}
    </span>
  )
}

function rolesGranting(permission: Permission, userRoles: AppRole[]): AppRole[] {
  const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
    USER:          ['USE_CHAT', 'EXECUTE_ANALYSIS'],
    STAFF:         ['USE_CHAT', 'EXECUTE_ANALYSIS'],
    DEVELOPER:     ['USE_CHAT', 'EXECUTE_ANALYSIS', 'EXECUTE_FIX_JOBS', 'EXECUTE_PLAN_JOBS'],
    ADMINISTRATOR: ['USE_CHAT', 'EXECUTE_ANALYSIS', 'EXECUTE_FIX_JOBS', 'EXECUTE_PLAN_JOBS', 'MANAGE_SETTINGS', 'MANAGE_USERS'],
  }
  return userRoles.filter((r) => ROLE_PERMISSIONS[r]?.includes(permission))
}

function RolesSection({ user }: { user: AuthUser }) {
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const primary = primaryRole(user.appRoles)
  const additionalRoles = user.appRoles.filter((r) => r !== primary && r !== 'USER')

  const grouped = PERMISSION_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    permissions: (Object.keys(PERMISSION_META) as Permission[]).filter(
      (p) => PERMISSION_META[p].category === cat,
    ),
  }))

  return (
    <div className="space-y-5">
      {/* Primary role */}
      <div className="flex items-start gap-3">
        <RoleBadge role={primary} />
        <p className="text-sm text-[var(--color-fonts-font-color-support)] leading-snug pt-0.5">
          {APP_ROLE_META[primary].description}
        </p>
      </div>

      {/* Additional roles */}
      {additionalRoles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {additionalRoles.map((r) => <RoleBadge key={r} role={r} />)}
        </div>
      )}

      {/* Expandable permissions */}
      <div>
        <button
          className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
          onClick={() => setPermissionsOpen((o) => !o)}
        >
          {permissionsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {permissionsOpen ? 'Hide permissions' : 'Show permissions'}
        </button>

        {permissionsOpen && (
          <div className="mt-4 space-y-4">
            {grouped.map(({ category, permissions }) => (
              <div key={category}>
                <p className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide mb-2">
                  {category}
                </p>
                <div className="space-y-1.5">
                  {permissions.map((p) => {
                    const granted = user.permissions.includes(p)
                    const providers = rolesGranting(p, user.appRoles)
                    return (
                      <div key={p} className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                          {granted
                            ? <Check size={13} className="text-[var(--color-status-text-active)]" />
                            : <Minus size={13} className="text-[var(--color-fonts-font-color-support)] opacity-40" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs ${granted ? 'text-[var(--color-fonts-font-color-primary)]' : 'text-[var(--color-fonts-font-color-support)] opacity-60'}`}>
                            {PERMISSION_META[p].label}
                          </span>
                          <span className="text-xs text-[var(--color-fonts-font-color-support)] ml-1">
                            — {PERMISSION_META[p].description}
                          </span>
                        </div>
                        {granted && providers.length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {providers.map((r) => (
                              <span
                                key={r}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)]"
                              >
                                {APP_ROLE_META[r].label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Linked Accounts tab ───────────────────────────────────────────────────────

const XRAY_REGIONS = [
  { label: 'US (xray.cloud.getxray.app)', value: 'https://xray.cloud.getxray.app' },
  { label: 'EU (eu.xray.cloud.getxray.app)', value: 'https://eu.xray.cloud.getxray.app' },
]

interface LinkFormState {
  baseUrl: string
  username: string
  apiToken: string
}

// ── Per-provider card ─────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: 'jira' | 'xray'
  linked: LinkedAccountResponse | null
  user: AuthUser
  systemConfig: SystemConfig | undefined
}

function ProviderCard({ provider, linked, user, systemConfig }: ProviderCardProps) {
  const qc = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<LinkFormState>({ baseUrl: '', username: '', apiToken: '' })
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const isXray = provider === 'xray'

  const upsertMutation = useMutation({
    mutationFn: (data: LinkFormState) =>
      mcpProfilesApi.upsert(provider, { provider, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mcp-profiles'] })
      setIsEditing(false)
      setTestResult(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => mcpProfilesApi.delete(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-profiles'] }),
  })

  const testMutation = useMutation({
    mutationFn: () => mcpProfilesApi.testConnection(provider),
    onSuccess: (result) => setTestResult(result),
  })

  const openEdit = () => {
    setForm(
      isXray
        ? { baseUrl: linked?.baseUrl ?? XRAY_REGIONS[0].value, username: linked?.username ?? '', apiToken: '' }
        : { baseUrl: linked?.baseUrl ?? systemConfig?.jira?.baseUrl ?? '', username: linked?.username ?? user.email ?? '', apiToken: '' },
    )
    setTestResult(null)
    setIsEditing(true)
  }

  const linkedSummary = linked
    ? isXray
      ? `${XRAY_REGIONS.find((r) => r.value === linked.baseUrl)?.label.split(' ')[0] ?? 'Custom'} · ${linked.username}`
      : `${linked.username} · ${linked.baseUrl}`
    : null

  const inputCls =
    'w-full text-sm px-3 py-1.5 rounded border border-[var(--color-navigation-menu-border)] bg-[var(--color-navigation-menu-card)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'

  return (
    <div className="rounded-lg border border-[var(--color-navigation-menu-border)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Logo */}
        <div
          className="w-8 h-8 shrink-0 rounded flex items-center justify-center"
          style={{ backgroundColor: isXray ? '#6554C0' : '#0052CC' }}
        >
          <span className="text-white text-sm font-bold leading-none">{isXray ? 'X' : 'A'}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
            {isXray ? 'Xray Cloud' : 'Atlassian'}
          </p>
          {linkedSummary ? (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] truncate">{linkedSummary}</p>
          ) : (
            <p className="text-xs text-[var(--color-fonts-font-color-support)]">Not linked</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {linked && !isEditing && (
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="text-xs px-2.5 py-1 rounded border border-[var(--color-navigation-menu-border)] text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors disabled:opacity-50"
            >
              {testMutation.isPending ? <Loader2 size={11} className="animate-spin inline" /> : 'Test'}
            </button>
          )}
          <button
            onClick={() => (isEditing ? setIsEditing(false) : openEdit())}
            className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-[var(--color-icons-icon)]"
            title={linked ? 'Edit' : 'Link account'}
          >
            <Link size={14} />
          </button>
          {linked && (
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-[var(--color-status-text-critical)] disabled:opacity-50"
              title="Unlink"
            >
              <Unlink size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Test result */}
      {testResult && !isEditing && (
        <div
          className={`border-t border-[var(--color-navigation-menu-border)] px-4 py-2 text-xs flex items-center gap-1.5 ${
            testResult.success ? 'text-[var(--color-status-text-active)]' : 'text-[var(--color-status-text-critical)]'
          }`}
        >
          {testResult.success ? <Check size={12} /> : <AlertCircle size={12} />}
          {testResult.message}
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="border-t border-[var(--color-navigation-menu-border)] px-4 py-4 space-y-3 bg-[var(--color-page-background)]">
          {isXray ? (
            <>
              <div>
                <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">Region</label>
                <select
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  className={inputCls}
                >
                  {XRAY_REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">Client ID</label>
                <input
                  type="text"
                  placeholder="Xray Cloud Client ID"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">Client Secret</label>
                <input
                  type="password"
                  placeholder={linked ? '(leave blank to keep existing)' : 'Xray Cloud Client Secret'}
                  value={form.apiToken}
                  onChange={(e) => setForm((f) => ({ ...f, apiToken: e.target.value }))}
                  className={inputCls}
                />
                <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                  Generate at{' '}
                  <a
                    href="https://docs.getxray.app/display/XRAYCLOUD/Global+Settings%3A+API+Keys"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-[var(--color-fonts-font-color-primary)]"
                  >
                    Xray API Keys settings
                  </a>
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">Base URL</label>
                <input
                  type="url"
                  placeholder="https://yourcompany.atlassian.net"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">Username / email</label>
                <input
                  type="text"
                  placeholder="you@yourcompany.com"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-fonts-font-color-support)] mb-1">API token</label>
                <input
                  type="password"
                  placeholder="Atlassian API token"
                  value={form.apiToken}
                  onChange={(e) => setForm((f) => ({ ...f, apiToken: e.target.value }))}
                  className={inputCls}
                />
                <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                  Generate one at{' '}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-[var(--color-fonts-font-color-primary)]"
                  >
                    id.atlassian.com
                  </a>
                </p>
              </div>
            </>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setIsEditing(false)}
              className="text-sm px-3 py-1.5 rounded border border-[var(--color-navigation-menu-border)] text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => upsertMutation.mutate(form)}
              disabled={upsertMutation.isPending || !form.baseUrl || !form.username || (!linked && !form.apiToken)}
              className="text-sm px-3 py-1.5 rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {upsertMutation.isPending && <Loader2 size={12} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LinkedAccountsSection({ user }: { user: AuthUser }) {
  const { data: accounts = [], isLoading } = useQuery<LinkedAccountResponse[]>({
    queryKey: ['mcp-profiles'],
    queryFn: () => mcpProfilesApi.list().catch(() => []),
  })

  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000,
  })

  const jiraLinked = accounts.find((a) => a.provider === 'jira') ?? null
  const xrayLinked = accounts.find((a) => a.provider === 'xray') ?? null

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
        <Loader2 size={13} className="animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-fonts-font-color-support)]">
        Link your personal accounts so the AI can interact with Jira, Confluence, and Xray on your behalf.
      </p>
      <ProviderCard provider="jira" linked={jiraLinked} user={user} systemConfig={systemConfig} />
      <ProviderCard provider="xray" linked={xrayLinked} user={user} systemConfig={systemConfig} />
    </div>
  )
}

// ── Account Source tab ────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="p-0.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-[var(--color-icons-icon)]"
      title="Copy"
    >
      {copied ? <CheckCheck size={12} className="text-[var(--color-status-text-active)]" /> : <Copy size={12} />}
    </button>
  )
}

function AccountSourceSection({ user }: { user: AuthUser }) {
  return (
    <div className="space-y-5 text-sm">
      {/* Subject ID */}
      <div>
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">Subject ID</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-[var(--color-fonts-font-color-primary)] font-mono bg-[var(--color-navigation-menu-item-hover-background)] px-2 py-1 rounded truncate">
            {user.sub || '—'}
          </code>
          {user.sub && <CopyButton text={user.sub} />}
        </div>
      </div>

      {/* KC Roles */}
      <div>
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1.5">Keycloak roles</p>
        {user.kcRoles.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {user.kcRoles.map((r) => (
              <span
                key={r}
                className="text-xs px-2 py-0.5 rounded bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-primary)] font-mono"
              >
                {r}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">None</span>
        )}
      </div>

      {/* Groups */}
      <div>
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1.5">Groups</p>
        {user.groups.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {user.groups.map((g) => (
              <span
                key={g}
                className="text-xs px-2 py-0.5 rounded bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-primary)]"
              >
                {g}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">None</span>
        )}
      </div>

      <p className="text-xs text-[var(--color-fonts-font-color-support)] italic">
        Role and group changes can only be made by an administrator in Keycloak.
      </p>
    </div>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export function ProfileDialog({ user, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<Tab>('identity')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const initials = (user.name || user.username)
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      >
        {/* Panel — wider */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-2xl h-[90vh] flex flex-col rounded-xl bg-[var(--color-navigation-menu-card)] border border-[var(--color-navigation-menu-border)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header: avatar + name + close */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-navigation-menu-border)] shrink-0">
            <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--color-navigation-user-avatar-background)] flex items-center justify-center text-sm font-bold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] truncate">
                {user.name || user.username}
              </p>
              <p className="text-xs text-[var(--color-fonts-font-color-support)] truncate">{user.email}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-[var(--color-icons-icon)]"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-6 pt-3 shrink-0 border-b border-[var(--color-navigation-menu-border)]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-buttons-button-primary)]'
                    : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'identity' && <IdentitySection user={user} />}
            {activeTab === 'roles'    && <RolesSection user={user} />}
            {activeTab === 'linked'   && <LinkedAccountsSection user={user} />}
            {activeTab === 'source'   && <AccountSourceSection user={user} />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
