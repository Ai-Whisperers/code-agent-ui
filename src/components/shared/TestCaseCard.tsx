import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Clock, FlaskConical, Target, CheckCircle2, Circle, XCircle, AlertTriangle,
  ListChecks, CheckCheck, ExternalLink,
} from 'lucide-react'
import api from '@/lib/api'
import type { QaTestCase } from '@/types/api'

// ── Local badge helpers ───────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const isCap = type === 'Capability'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)]
      ${isCap
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'}`}
    >
      {isCap ? <Target size={10} /> : <FlaskConical size={10} />}
      {type}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    High: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
    Medium: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
    Low: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  }
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${map[priority] ?? map.Low}`}>
      {priority}
    </span>
  )
}

const STATUS_STYLES: Record<string, { cls: string; icon: React.ComponentType<{ size?: number }> }> = {
  Open:    { cls: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]', icon: Circle },
  Pass:    { cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]', icon: CheckCircle2 },
  Fail:    { cls: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]', icon: XCircle },
  Blocked: { cls: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]', icon: AlertTriangle },
}

function StatusBadge({ status, id, planId, onStatusChange }: {
  status: string
  id: string
  planId: string
  onStatusChange?: () => void
}) {
  const qc = useQueryClient()
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.Open
  const Icon = s.icon

  const mutation = useMutation({
    mutationFn: (newStatus: string) =>
      api.put(`/qa/test-plans/${planId}/test-cases/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qa-test-cases', planId] })
      onStatusChange?.()
    },
  })

  return (
    <div className="relative group/status">
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] cursor-pointer ${s.cls}`}>
        <Icon size={10} />
        {status}
      </span>
      <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover/status:flex flex-col bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-lg overflow-hidden min-w-[90px]">
        {Object.keys(STATUS_STYLES).map((s) => (
          <button
            key={s}
            onClick={() => mutation.mutate(s)}
            className="px-3 py-1.5 text-xs text-left hover:bg-[var(--color-cards-card-background-hover)] text-[var(--color-fonts-font-color-primary)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-1.5">
      {children}
    </p>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TestCaseCardProps {
  tc: QaTestCase
  planId: string
  jiraBaseUrl?: string
}

export function TestCaseCard({ tc, planId, jiraBaseUrl }: TestCaseCardProps) {
  const preConditions: string[] = tryParseArray(tc.preConditions)
  const testSteps: string[] = tryParseArray(tc.testSteps)
  const expectedResults: string[] = tryParseArray(tc.expectedResults)

  return (
    <div className="rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-[var(--color-cards-card-stroke)]">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <code className="font-mono text-xs font-bold text-[var(--color-fonts-font-color-brand)]">
              {tc.testCaseId}
            </code>
            <TypeBadge type={tc.testCaseType} />
            <PriorityBadge priority={tc.priority} />
            <StatusBadge status={tc.status} id={tc.id} planId={planId} />
            {tc.jiraIssueKey && jiraBaseUrl && (
              <a
                href={`${jiraBaseUrl}/browse/${tc.jiraIssueKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:underline"
              >
                {tc.jiraIssueKey} <ExternalLink size={9} />
              </a>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)]">{tc.title}</p>
          {tc.description && (
            <p className="text-xs mt-0.5 text-[var(--color-fonts-font-color-support)]">{tc.description}</p>
          )}
        </div>
        {tc.estimatedDuration && (
          <div className="flex items-center gap-1 text-[11px] text-[var(--color-fonts-font-color-support)] shrink-0">
            <Clock size={11} />
            {tc.estimatedDuration}
          </div>
        )}
      </div>

      {/* Body — 3-column grid */}
      <div className="grid grid-cols-1 divide-y divide-[var(--color-cards-card-stroke)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {/* Pre-conditions */}
        <div className="p-4">
          <SectionLabel>Pre-conditions</SectionLabel>
          {preConditions.length === 0 ? (
            <p className="text-xs text-[var(--color-fonts-font-color-support)]">None</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {preConditions.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-fonts-font-color-primary)]">
                  <span className="shrink-0 font-mono text-[10px] mt-0.5 text-[var(--color-fonts-font-color-support)]">{i + 1}.</span>
                  {c}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Test steps */}
        <div className="p-4">
          <SectionLabel>
            <span className="flex items-center gap-1"><ListChecks size={10} /> Test Steps</span>
          </SectionLabel>
          <ol className="flex flex-col gap-1">
            {testSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-fonts-font-color-primary)]">
                <span className="shrink-0 font-mono text-[10px] mt-0.5 font-bold text-[var(--color-fonts-font-color-brand)]">{i + 1}.</span>
                {s.replace(/^\d+\.\s*/, '')}
              </li>
            ))}
          </ol>
        </div>

        {/* Expected results */}
        <div className="p-4">
          <SectionLabel>
            <span className="flex items-center gap-1"><CheckCheck size={10} /> Expected Results</span>
          </SectionLabel>
          <ul className="flex flex-col gap-1">
            {expectedResults.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-fonts-font-color-primary)]">
                <CheckCircle2 size={11} className="shrink-0 mt-0.5 text-[var(--color-tags-font-success)]" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function tryParseArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
