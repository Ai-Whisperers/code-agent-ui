import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Save, X, Plug, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { mcpProfilesApi, type LinkedAccountResponse, type SystemConfig } from '@/lib/mcpProfiles'

const PROVIDERS = [
  {
    id: 'jira',
    label: 'Jira and Confluence',
    description: 'Link your Atlassian account to let the AI search, create and update Jira issues and read Confluence pages.',
    urlPlaceholder: 'https://yourcompany.atlassian.net',
  },
]

export default function McpProfilesPage() {
  const qc = useQueryClient()
  const [editProvider, setEditProvider] = useState<string | null>(null)

  const { data: accounts, isLoading } = useQuery<LinkedAccountResponse[]>({
    queryKey: ['mcp-profiles'],
    queryFn: () => mcpProfilesApi.list().catch(() => []),
  })

  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const deleteMutation = useMutation({
    mutationFn: (provider: string) => mcpProfilesApi.delete(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-profiles'] }),
  })

  const linkedMap = Object.fromEntries((accounts ?? []).map((a) => [a.provider, a]))
  const systemJira = systemConfig?.jira

  return (
    <main>
      <PageHeader
        title="MCP Profiles"
        subtitle="Link personal accounts so the AI can interact with Jira and Confluence on your behalf."
      />

      {editProvider && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setEditProvider(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ProfileEditor
              provider={editProvider}
              existing={linkedMap[editProvider] ?? null}
              systemConfig={systemJira}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['mcp-profiles'] })
                setEditProvider(null)
              }}
              onCancel={() => setEditProvider(null)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => {
          const linked = linkedMap[p.id]
          return (
            <div
              key={p.id}
              className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
                    {p.label}
                  </h3>
                  <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                    {p.description}
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
                ) : linked ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-tags-font-success)] bg-[var(--color-tags-success-background)] px-2 py-0.5 rounded-[var(--border-radius-tag)]">
                    <CheckCircle size={11} />
                    Linked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-tags-font-neutral)] bg-[var(--color-tags-neutral-background)] px-2 py-0.5 rounded-[var(--border-radius-tag)]">
                    Not linked
                  </span>
                )}
              </div>

              {linked && (
                <div className="mb-3 p-3 rounded-[var(--border-radius-small)] bg-[var(--color-inputs-input-background)] border border-[var(--color-inputs-input-border)] text-xs space-y-1">
                  <div className="text-[var(--color-fonts-font-color-support)]">
                    <span className="font-semibold">URL: </span>
                    <span className="text-[var(--color-fonts-font-color-primary)]">{linked.baseUrl}</span>
                  </div>
                  <div className="text-[var(--color-fonts-font-color-support)]">
                    <span className="font-semibold">User: </span>
                    <span className="text-[var(--color-fonts-font-color-primary)]">{linked.username}</span>
                  </div>
                  <div className="text-[var(--color-fonts-font-color-support)]">
                    <span className="font-semibold">Token: </span>
                    <span className="text-[var(--color-fonts-font-color-primary)] font-mono">{linked.apiTokenMasked}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setEditProvider(p.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
                >
                  <Plug size={12} />
                  {linked ? 'Update' : 'Link'}
                </button>
                {linked && (
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-60 transition-colors"
                  >
                    <Trash2 size={12} />
                    Unlink
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

interface ProfileEditorProps {
  provider: string
  existing: LinkedAccountResponse | null
  systemConfig?: { baseUrl: string; username: string }
  onSaved: () => void
  onCancel: () => void
}

function ProfileEditor({ provider, existing, systemConfig, onSaved, onCancel }: ProfileEditorProps) {
  const providerDef = PROVIDERS.find((p) => p.id === provider)!
  // Use system config as defaults (read-only), fallback to existing if already linked
  const baseUrl = systemConfig?.baseUrl || existing?.baseUrl || ''
  const username = systemConfig?.username || existing?.username || ''
  const [apiToken, setApiToken] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const saveMutation = useMutation({
    mutationFn: () =>
      mcpProfilesApi.upsert(provider, { provider, baseUrl, username, apiToken }),
    onSuccess: onSaved,
  })

  const handleTest = async () => {
    if (!apiToken) {
      setTestResult({ success: false, message: 'Please enter your API token.' })
      return
    }
    setIsTesting(true)
    setTestResult(null)
    try {
      await mcpProfilesApi.upsert(provider, { provider, baseUrl, username, apiToken })
      const result = await mcpProfilesApi.testConnection(provider)
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: 'Connection test failed.' })
    } finally {
      setIsTesting(false)
    }
  }

  const canSave = baseUrl.trim() && username.trim() && apiToken.trim()

  const hasSystemConfig = !!(systemConfig?.baseUrl && systemConfig?.username)

  return (
    <div className="relative w-full max-w-md bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
          Link {providerDef.label} Account
        </h3>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 mb-5">
        {hasSystemConfig ? (
          <>
            <ReadOnlyField label="Base URL" value={baseUrl} />
            <ReadOnlyField label="Username" value={username} />
          </>
        ) : (
          <>
            <Field
              label="Base URL"
              value={baseUrl}
              onChange={() => {}}
              placeholder={providerDef.urlPlaceholder}
            />
            <Field
              label="Username / Email"
              value={username}
              onChange={() => {}}
              placeholder="user@example.com"
            />
          </>
        )}
        <Field
          label="API Token"
          value={apiToken}
          onChange={setApiToken}
          placeholder={existing ? '(leave blank to keep existing)' : 'Paste your API token'}
          type="password"
        />
      </div>

      {testResult && (
        <div
          className={`flex items-center gap-2 text-xs p-3 rounded-[var(--border-radius-small)] mb-4 ${
            testResult.success
              ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
              : 'bg-[var(--color-tags-error-background)] text-[var(--color-tags-font-error)]'
          }`}
        >
          {testResult.success ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!canSave || saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
        >
          <Save size={13} />
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={handleTest}
          disabled={isTesting || !apiToken}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-sm font-medium hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-60 transition-colors"
        >
          {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
          {isTesting ? 'Testing…' : 'Test'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-sm font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'password'
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-placeholder)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
      />
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-support)] select-none">
        {value || <span className="text-[var(--color-fonts-font-color-placeholder)]">Not configured</span>}
      </div>
    </div>
  )
}
