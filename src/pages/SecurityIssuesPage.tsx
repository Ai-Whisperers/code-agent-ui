import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Shield, Clock, HelpCircle, Code2, Container } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Tooltip } from '@/components/ui/Tooltip'
import { ProductRow } from '@/components/security/ProductRow'
import api from '@/lib/api'
import type { SecurityIssuesResponse } from '@/types/api'

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High' },
  { value: 'medium',   label: 'Medium' },
  { value: 'low',      label: 'Low' },
]

const SLA_OPTIONS = [
  { value: 'ON_TRACK', label: 'On Track' },
  { value: 'AT_RISK',  label: 'At Risk' },
  { value: 'OVERDUE',  label: 'Overdue' },
]

const TYPE_OPTIONS = [
  { value: 'software',  label: 'Software' },
  { value: 'container', label: 'Container' },
]


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

export default function SecurityIssuesPage() {
  const queryClient = useQueryClient()
  const [severityFilter, setSeverityFilter] = useState('')
  const [slaFilter, setSlaFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data, isLoading, isError, isFetching } = useQuery<SecurityIssuesResponse>({
    queryKey: ['security-issues'],
    queryFn: () => api.get<SecurityIssuesResponse>('/security/issues').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const products = data?.items ?? []

  const allIssues       = products.flatMap((p) => p.repos.flatMap((r) => r.issues))
  const swCriticals     = products.reduce((s, p) => s + p.repos.reduce((rs, r) => rs + (r.softwareCriticalCount ?? 0), 0), 0)
  const swHighs         = products.reduce((s, p) => s + p.repos.reduce((rs, r) => rs + (r.softwareHighCount ?? 0), 0), 0)
  const ctnCriticals    = products.reduce((s, p) => s + p.repos.reduce((rs, r) => rs + (r.containerCriticalCount ?? 0), 0), 0)
  const ctnHighs        = products.reduce((s, p) => s + p.repos.reduce((rs, r) => rs + (r.containerHighCount ?? 0), 0), 0)
  const overdueSla      = allIssues.filter((i) => i.slaStatus === 'OVERDUE').length
  const noFixJob        = allIssues.filter((i) => !i.linkedJobId).length

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await api.get('/security/issues?refresh=true')
      await queryClient.invalidateQueries({ queryKey: ['security-issues'] })
    } finally {
      setIsRefreshing(false)
    }
  }

  const hasFilters = severityFilter || slaFilter || typeFilter

  return (
    <main className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Security Issues"
        subtitle={
          data?.cachedAt
            ? `Last updated ${new Date(data.cachedAt).toLocaleTimeString()}`
            : `${products.length} product${products.length !== 1 ? 's' : ''}`
        }
        actions={
          <Tooltip text="Force refresh from Aikido">
            <Button
              variant="ghost"
              size="sm"
              icon={
                <RefreshCw
                  size={14}
                  className={(isFetching || isRefreshing) ? 'animate-spin' : ''}
                />
              }
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              Refresh
            </Button>
          </Tooltip>
        }
      />

      {/* KPI strip — matches Dashboard StatCard style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="SW Criticals"
          value={isLoading ? '—' : swCriticals}
          icon={<Code2 size={15} />}
          accent="text-red-500"
          accentColor="#ef4444"
          tooltip="Critical software vulnerabilities (SCA, SAST, dependency). SLA: fix within 7 days."
        />
        <StatCard
          label="Container Criticals"
          value={isLoading ? '—' : ctnCriticals}
          icon={<Container size={15} />}
          accent={ctnCriticals > 0 ? 'text-red-500' : 'text-[var(--color-icons-icon)]'}
          accentColor={ctnCriticals > 0 ? '#ef4444' : undefined}
          tooltip="Critical container image vulnerabilities. Requires base-image rebuild or OS package update."
        />
        <StatCard
          label="SW Highs"
          value={isLoading ? '—' : swHighs}
          icon={<Code2 size={15} />}
          accent="text-orange-500"
          accentColor="#f97316"
          tooltip="High-severity software vulnerabilities (SCA, SAST, dependency). SLA: fix within 30 days."
        />
        <StatCard
          label="Container Highs"
          value={isLoading ? '—' : ctnHighs}
          icon={<Container size={15} />}
          accent={ctnHighs > 0 ? 'text-orange-500' : 'text-[var(--color-icons-icon)]'}
          accentColor={ctnHighs > 0 ? '#f97316' : undefined}
          tooltip="High-severity container image vulnerabilities. Requires base-image rebuild or OS package update."
        />
        <StatCard
          label="Overdue SLA"
          value={isLoading ? '—' : overdueSla}
          icon={<Clock size={15} />}
          accent={overdueSla > 0 ? 'text-red-500' : 'text-[var(--color-icons-icon)]'}
          accentColor={overdueSla > 0 ? '#ef4444' : undefined}
          tooltip="Issues that have exceeded their SLA deadline and require immediate attention."
        />
        <StatCard
          label="No Fix Job"
          value={isLoading ? '—' : noFixJob}
          icon={<Shield size={15} />}
          accent={noFixJob > 0 ? 'text-orange-500' : 'text-[var(--color-icons-icon)]'}
          accentColor={noFixJob > 0 ? '#f97316' : undefined}
          tooltip="Open issues that have no fix job created yet. Use the Fix or Fix All buttons to queue automated remediation."
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={TYPE_OPTIONS}
          placeholder="All Types"
        />
        <FilterSelect
          value={severityFilter}
          onChange={setSeverityFilter}
          options={SEVERITY_OPTIONS}
          placeholder="All Severities"
        />
        <FilterSelect
          value={slaFilter}
          onChange={setSlaFilter}
          options={SLA_OPTIONS}
          placeholder="All SLA Statuses"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSeverityFilter(''); setSlaFilter(''); setTypeFilter('') }}
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-[12px] text-[var(--color-fonts-font-color-support)]">
          {allIssues.length} issue{allIssues.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] skeleton-shimmer"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--color-fonts-font-color-support)]">
          <Shield size={32} className="opacity-40" />
          <p className="text-sm">Failed to load security issues.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-[var(--color-fonts-font-color-support)]">
          <Shield size={32} className="opacity-40" />
          <p className="text-sm">No open security issues found.</p>
          <p className="text-[11px]">Issues will appear here when Aikido reports open vulnerabilities for configured products.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product) => (
            <ProductRow
              key={product.productId}
              product={product}
              severityFilter={severityFilter}
              slaFilter={slaFilter}
              typeFilter={typeFilter}
            />
          ))}
        </div>
      )}
    </main>
  )
}
