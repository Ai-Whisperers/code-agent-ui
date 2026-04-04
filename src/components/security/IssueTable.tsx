import { useState } from 'react'
import { SlaBadge } from '@/components/ui/SlaBadge'
import { JobStatusBadge } from '@/components/ui/JobStatusBadge'
import { Tooltip } from '@/components/ui/Tooltip'
import { CreateFixButton } from '@/components/security/CreateFixButton'
import { AikidoIssueDetailDialog } from '@/components/security/AikidoIssueDetailDialog'
import type { SecurityIssueRow, SecuritySlaStatus } from '@/types/api'
import { useNavigate } from '@tanstack/react-router'

const ISSUE_TYPE_LABELS: Record<string, string> = {
  open_source: 'Open Source',
  sca: 'SCA',
  software_composition_analysis: 'SCA',
  dependency: 'Dependency',
  dependencies: 'Dependency',
  sast: 'SAST',
  code: 'SAST',
  static_analysis: 'SAST',
  code_security: 'SAST',
  secret: 'Secret',
  secrets: 'Secret',
  exposed_secret: 'Secret',
  hardcoded_secret: 'Secret',
  container: 'Container',
  container_security: 'Container',
  iac: 'IaC',
  infrastructure_as_code: 'IaC',
}

const ISSUE_TYPE_DESCRIPTIONS: Record<string, string> = {
  'Open Source': 'Known vulnerability in an open-source dependency (SCA)',
  'SCA':         'Software Composition Analysis — vulnerable third-party library',
  'Dependency':  'Vulnerable third-party dependency detected',
  'SAST':        'Static Application Security Testing — insecure code pattern found in source',
  'Secret':      'Hardcoded secret or credential exposed in source code',
  'Container':   'Vulnerability found in a container image layer',
  'IaC':         'Infrastructure-as-Code misconfiguration detected',
}

const SEVERITY_DESCRIPTIONS: Record<string, string> = {
  critical: 'Critical — fix within 7 days. Actively exploitable or severe data exposure risk.',
  high:     'High — fix within 30 days. Significant risk requiring prompt attention.',
  medium:   'Medium — fix within 90 days. Moderate risk, lower exploitability.',
  low:      'Low — fix when convenient. Minimal direct risk.',
}

function formatIssueType(type: string | undefined): string {
  if (!type) return '—'
  return ISSUE_TYPE_LABELS[type.toLowerCase()] ?? type
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity.toLowerCase() === 'critical'
      ? 'bg-red-600 text-white'
      : severity.toLowerCase() === 'high'
        ? 'bg-orange-500 text-white'
        : severity.toLowerCase() === 'medium'
          ? 'bg-yellow-400 text-yellow-900'
          : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  const tip = SEVERITY_DESCRIPTIONS[severity.toLowerCase()] ?? severity
  return (
    <Tooltip text={tip}>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold uppercase tracking-wide cursor-default ${cls}`}>
        {severity}
      </span>
    </Tooltip>
  )
}

function IssueRow({
  issue,
  isEven,
  onOpenDetail,
}: {
  issue: SecurityIssueRow
  isEven: boolean
  onOpenDetail: (issue: SecurityIssueRow) => void
}) {
  const navigate = useNavigate()

  return (
    <tr
      className={`border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] cursor-pointer transition-colors ${isEven ? 'bg-[var(--color-tables-table-row-a)]' : ''}`}
      onClick={() => onOpenDetail(issue)}
    >
      {/* Severity */}
      <td className="px-3 py-2 whitespace-nowrap">
        <SeverityBadge severity={issue.severity} />
      </td>

      {/* Type */}
      <td className="px-3 py-2 whitespace-nowrap">
        <Tooltip text={ISSUE_TYPE_DESCRIPTIONS[formatIssueType(issue.issueType)] ?? formatIssueType(issue.issueType)}>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-medium bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] cursor-default">
            {formatIssueType(issue.issueType)}
          </span>
        </Tooltip>
      </td>

      {/* Vulnerability — title + package/version + optional CVE */}
      <td className="px-3 py-2 min-w-0">
        <div className="flex flex-col gap-0.5">
          {issue.title ? (
            <span className="text-[12px] font-medium text-[var(--color-fonts-font-color-primary)] truncate" title={issue.title}>
              {issue.title}
            </span>
          ) : (
            <span className="text-[12px] font-medium text-[var(--color-fonts-font-color-primary)] truncate">
              {issue.packageName || '—'}
            </span>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {issue.packageName && issue.packageName !== 'unknown' && (
              <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                {issue.packageName}
                {issue.currentVersion ? ` ${issue.currentVersion}` : ''}
                {issue.fixedVersion ? ` → ${issue.fixedVersion}` : ''}
              </span>
            )}
            {issue.cveId && (
              <span className="text-[10px] font-mono text-[var(--color-fonts-font-color-brand)]">
                {issue.cveId}
                {issue.cvssScore != null ? ` (${issue.cvssScore.toFixed(1)})` : ''}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* SLA */}
      <td className="px-3 py-2 whitespace-nowrap">
        <SlaBadge
          status={issue.slaStatus as SecuritySlaStatus}
          deadline={issue.slaDeadline}
        />
      </td>

      {/* Job */}
      <td
        className="px-3 py-2 whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        {issue.linkedJobId ? (
          <Tooltip text={`Job: ${issue.linkedJobId.slice(0, 8)}…`}>
            <button
              className="cursor-pointer"
              onClick={() => navigate({ to: '/jobs/$id', params: { id: issue.linkedJobId! } })}
            >
              <JobStatusBadge status={issue.linkedJobStatus ?? 'PENDING'} />
            </button>
          </Tooltip>
        ) : (
          <CreateFixButton issue={issue} />
        )}
      </td>
    </tr>
  )
}

export function IssueTable({ issues }: { issues: SecurityIssueRow[] }) {
  const [selected, setSelected] = useState<SecurityIssueRow | null>(null)

  if (issues.length === 0) return null

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[90px]" />
            <col className="w-[100px]" />
            <col />
            <col className="w-[110px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--color-tables-table-cell-stroke)] bg-[var(--color-tables-table-header)]">
              {['Severity', 'Type', 'Vulnerability', 'SLA', 'Job'].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-[11px] font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, i) => (
              <IssueRow
                key={issue.issueGroupId}
                issue={issue}
                isEven={i % 2 === 0}
                onOpenDetail={setSelected}
              />
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <AikidoIssueDetailDialog
          issue={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
