import { X, ExternalLink, ShieldAlert, Container, Code2, Clock, CalendarDays, CalendarClock } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { SlaBadge } from '@/components/ui/SlaBadge'
import { CreateFixButton } from '@/components/security/CreateFixButton'
import type { SecurityIssueRow, SecuritySlaStatus } from '@/types/api'

const CONTAINER_TYPES = new Set(['container', 'container_security'])

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

function formatType(type: string | undefined) {
  if (!type) return '—'
  return ISSUE_TYPE_LABELS[type.toLowerCase()] ?? type
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

function isOverdue(iso: string | undefined): boolean {
  if (!iso) return false
  try { return new Date(iso) < new Date() } catch { return false }
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
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[var(--border-radius-tag)] text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {severity}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-1.5">
        {title}
      </h3>
      <div className="text-[12px] text-[var(--color-fonts-font-color-primary)] leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-[12px] text-[var(--color-fonts-font-color-primary)]">{children}</span>
    </div>
  )
}

interface Props {
  issue: SecurityIssueRow
  onClose: () => void
}

export function AikidoIssueDetailDialog({ issue, onClose }: Props) {
  const isContainer = issue.issueType
    ? CONTAINER_TYPES.has(issue.issueType.toLowerCase())
    : false

  const TypeIcon = isContainer ? Container : Code2

  const cveList = [
    ...(issue.cveId ? [issue.cveId] : []),
    ...(issue.relatedCveIds ?? []).filter((c) => c !== issue.cveId),
  ]

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-2xl rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[var(--color-cards-card-stroke)]">
          <div className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full ${
            isContainer
              ? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
              : 'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]'
          }`}>
            <TypeIcon size={16} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <SeverityBadge severity={issue.severity} />
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-medium bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                {formatType(issue.issueType)}
              </span>
              {issue.severityScore != null && (
                <Tooltip text="CVSS-style severity score from Aikido">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-medium bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)] cursor-default">
                    <ShieldAlert size={9} />
                    Score {issue.severityScore.toFixed(1)}
                  </span>
                </Tooltip>
              )}
            </div>
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] leading-snug">
              {issue.title ?? issue.packageName ?? `Issue #${issue.issueGroupId}`}
            </h2>
            {issue.repoName && (
              <p className="text-[11px] text-[var(--color-fonts-font-color-support)] mt-0.5">
                {issue.repoName}
                {issue.containerImage ? ` · ${issue.containerImage}` : ''}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded hover:bg-[var(--color-cards-card-background-hover)] text-[var(--color-icons-icon)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-5 overflow-y-auto">

          {/* Quick-facts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Package">
              {issue.packageName && issue.packageName !== 'unknown'
                ? issue.packageName
                : '—'}
            </Field>
            <Field label="Version">
              {issue.currentVersion
                ? <>
                    <span>{issue.currentVersion}</span>
                    {issue.fixedVersion && (
                      <span className="text-[var(--color-fonts-font-color-support)]"> → {issue.fixedVersion}</span>
                    )}
                  </>
                : '—'}
            </Field>
            <Field label="Time to fix">
              {issue.timeToFixMinutes != null ? (
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} className="text-[var(--color-fonts-font-color-support)]" />
                  {issue.timeToFixMinutes < 60
                    ? `${issue.timeToFixMinutes} min`
                    : `${Math.round(issue.timeToFixMinutes / 60)} hr`}
                </span>
              ) : '—'}
            </Field>
            <Field label="Discovered">
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={11} className="text-[var(--color-fonts-font-color-support)]" />
                {formatDate(issue.discoveredAt)}
              </span>
            </Field>
            <Field label="Due date">
              {issue.aikidoDueDate ? (
                <span className={`inline-flex items-center gap-1 ${isOverdue(issue.aikidoDueDate) ? 'text-red-500' : ''}`}>
                  <CalendarClock size={11} className={isOverdue(issue.aikidoDueDate) ? 'text-red-500' : 'text-[var(--color-fonts-font-color-support)]'} />
                  {formatDate(issue.aikidoDueDate)}
                  {isOverdue(issue.aikidoDueDate) && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide ml-0.5">Overdue</span>
                  )}
                </span>
              ) : '—'}
            </Field>
            <Field label="SLA">
              <SlaBadge
                status={issue.slaStatus as SecuritySlaStatus}
                deadline={issue.slaDeadline}
              />
            </Field>
          </div>

          {/* CVE IDs */}
          {cveList.length > 0 && (
            <Section title="CVE Identifiers">
              <div className="flex flex-wrap gap-1.5">
                {cveList.map((cve) => (
                  <a
                    key={cve}
                    href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--border-radius-tag)] text-[11px] font-mono bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-brand)] hover:underline"
                  >
                    {cve}
                    <ExternalLink size={9} />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Description */}
          {issue.description && (
            <Section title="Description">
              <p className="whitespace-pre-wrap">{issue.description}</p>
            </Section>
          )}

          {/* How to fix */}
          {issue.howToFix && (
            <Section title="How to Fix">
              <p className="whitespace-pre-wrap">{issue.howToFix}</p>
            </Section>
          )}

          {/* Repo URL */}
          {issue.repoUrl && (
            <Section title="Repository">
              <a
                href={issue.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--color-fonts-font-color-brand)] hover:underline"
              >
                {issue.repoUrl}
                <ExternalLink size={11} />
              </a>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-cards-card-stroke)]">
          <span className="text-[11px] text-[var(--color-fonts-font-color-support)]">
            Group #{issue.issueGroupId}
            {issue.groupStatus ? ` · ${issue.groupStatus}` : ''}
          </span>
          <CreateFixButton issue={issue} />
        </div>
      </div>
    </div>
  )
}
