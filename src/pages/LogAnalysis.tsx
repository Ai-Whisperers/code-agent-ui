import { useState } from 'react'
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
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Tooltip } from '@/components/ui/Tooltip'
import api from '@/lib/api'
import type { CustomerConfig } from '@/types/api'

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

function FindingRow({
  finding,
  onDismiss,
  isDismissing,
}: {
  finding: LogFinding
  onDismiss: (id: number) => void
  isDismissing: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
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
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(finding.id)}
            disabled={isDismissing}
          >
            Dismiss
          </Button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
          <td colSpan={8} className="px-6 py-4">
            <div className="flex flex-col gap-3">
              {finding.aiReason && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-1">
                    AI Reason
                  </p>
                  <p className="text-sm text-[var(--color-fonts-font-color-body)]">{finding.aiReason}</p>
                </div>
              )}
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
              <div className="flex gap-6 text-xs text-[var(--color-fonts-font-color-support)]">
                <span>Log group: <span className="font-mono">{finding.logGroupName}</span></span>
                <span>Last seen: {new Date(finding.lastSeenAt).toLocaleString()}</span>
                <span>Fingerprint: <span className="font-mono">{finding.fingerprint.substring(0, 12)}…</span></span>
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

  const dismissMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/log-analysis/findings/${id}/dismiss`, {}).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-analysis-findings'] })
      queryClient.invalidateQueries({ queryKey: ['log-analysis-stats'] })
    },
  })

  const stats = statsQuery.data
  const findings = findingsQuery.data?.items ?? []
  const isLoading = findingsQuery.isLoading || statsQuery.isLoading

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
        <span className="ml-auto text-xs text-[var(--color-fonts-font-color-support)]">
          {findings.length} finding{findings.length !== 1 ? 's' : ''}
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
            <CheckCircle size={24} />
            <p className="text-sm font-medium">No open findings</p>
            <p className="text-xs">All clear — or log analysis is not yet enabled for any environment.</p>
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
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
