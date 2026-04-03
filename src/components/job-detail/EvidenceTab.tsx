import { RefreshCw, ShieldCheck, ExternalLink, CheckCircle, XCircle, GitBranch, MessageSquare, Printer } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { TableCard } from '@/components/ui/TableCard'
import { Button } from '@/components/ui/Button'
import type { JobStatusResponse, JobEvidenceResponse } from '@/types/api'

interface EvidenceTabProps {
  job: JobStatusResponse
  evidenceData: JobEvidenceResponse | undefined
  uploadScytalePending: boolean
  onUploadScytale: () => void
}

export function EvidenceTab({ job, evidenceData, uploadScytalePending, onUploadScytale }: EvidenceTabProps) {
  const navigate = useNavigate()

  if (!evidenceData) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[var(--color-fonts-font-color-support)]">
        <RefreshCw size={14} className="animate-spin" />
        Loading evidence…
      </div>
    )
  }

  const { complianceApplicable, complianceChecks, auditTrail, scytaleEvidenceRef, scytaleEnabled } = evidenceData

  return (
    <div className="space-y-3 pb-6">
      {job.aikidoIssueId && (
        <TableCard title="Vulnerability Source">
          <div className="px-4 py-3 flex items-center gap-2 text-sm">
            <ShieldCheck size={14} className="text-[var(--color-tags-font-critical)] shrink-0" />
            <span>Aikido issue:</span>
            <a
              href={`https://app.aikido.dev/queue?sidebarIssue=${job.aikidoIssueId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-fonts-font-color-brand)] hover:underline inline-flex items-center gap-1"
            >
              {job.aikidoIssueId}
              <ExternalLink size={11} />
            </a>
            <span className="text-xs text-[var(--color-fonts-font-color-support)] ml-2">
              Post-fix re-scan verification is a future phase.
            </span>
          </div>
        </TableCard>
      )}

      {complianceApplicable ? (
        <TableCard
          title="SOC II CC8.1 Compliance"
          subtitle="Change Management"
          toolbar={
            <Button
              variant="ghost"
              size="sm"
              icon={<Printer size={11} />}
              onClick={() => window.print()}
            >
              Print / Export
            </Button>
          }
        >
          <div className="divide-y divide-[var(--color-cards-card-stroke)]">
            {complianceChecks.map((check) => (
              <div key={check.name} className="flex items-start gap-3 px-4 py-2.5">
                {check.passed
                  ? <CheckCircle size={14} className="text-[var(--color-tags-font-success)] shrink-0 mt-0.5" />
                  : <XCircle    size={14} className="text-[var(--color-tags-font-critical)] shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)]">{check.name}</p>
                  {check.detail && (
                    <p className="text-[11px] text-[var(--color-fonts-font-color-support)] mt-0.5 truncate">{check.detail}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  check.passed
                    ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
                    : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
                }`}>
                  {check.passed ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        </TableCard>
      ) : (
        <div className="px-1 text-sm text-[var(--color-fonts-font-color-support)]">
          Compliance controls apply to Jira Bug tickets only. Showing audit trail below.
        </div>
      )}

      {evidenceData.promotionJobId && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-[var(--border-radius-card)] bg-[var(--color-status-neutral-background)] border border-[var(--color-cards-card-stroke)]">
          <GitBranch size={14} className="text-[var(--color-fonts-font-color-brand)]" />
          <span className="text-sm text-[var(--color-fonts-font-color-primary)]">
            Production promotion:
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<ExternalLink size={11} />}
            onClick={() => navigate({ to: '/jobs/$id', params: { id: evidenceData.promotionJobId! } })}
          >
            {evidenceData.promotionJobId.slice(0, 8)}…
          </Button>
        </div>
      )}

      {complianceApplicable && (
        <TableCard title="Scytale Evidence Upload">
          <div className="px-4 py-3">
            {scytaleEvidenceRef ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-tags-font-success)]">
                <CheckCircle size={14} />
                Uploaded to Scytale · Ref: <span className="font-mono">{scytaleEvidenceRef}</span>
              </div>
            ) : scytaleEnabled ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ShieldCheck size={12} />}
                  loading={uploadScytalePending}
                  onClick={onUploadScytale}
                >
                  Upload to Scytale
                </Button>
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  Upload SOC II evidence to your Scytale workspace for CC8.1
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-fonts-font-color-support)]">
                Scytale integration not configured. Add credentials in System Settings → Compliance.
              </p>
            )}
          </div>
        </TableCard>
      )}

      <TableCard title="Audit Trail" subtitle={`${auditTrail.length} events`}>
        {auditTrail.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--color-fonts-font-color-support)]">No audit events found.</p>
        ) : (
          <div className="relative">
            {auditTrail.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5 relative">
                {i < auditTrail.length - 1 && (
                  <div className="absolute left-[23px] top-8 bottom-0 w-px bg-[var(--color-cards-card-stroke)]" />
                )}
                <div className="shrink-0 w-5 h-5 rounded-full bg-[var(--color-tags-neutral-background)] flex items-center justify-center mt-0.5 z-10">
                  <MessageSquare size={9} className="text-[var(--color-fonts-font-color-support)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">{entry.action}</span>
                    <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-[10px] italic text-[var(--color-fonts-font-color-support)]">{entry.actor}</span>
                  </div>
                  {entry.detail && (
                    <p className="text-[11px] text-[var(--color-fonts-font-color-support)] mt-0.5 font-mono break-all">
                      {entry.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TableCard>
    </div>
  )
}
