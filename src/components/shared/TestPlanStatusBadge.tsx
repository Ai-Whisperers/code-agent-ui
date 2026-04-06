import type { TestPlanStatus } from '@/types/api'

const STATUS_CONFIG: Record<TestPlanStatus, { text: string; className: string }> = {
  none: {
    text: 'No Plan',
    className: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  },
  analysis: {
    text: 'Analysis Ready',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  json_ready: {
    text: 'JSON Ready',
    className: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  },
  stale: {
    text: 'Stale',
    className: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
  },
}

interface TestPlanStatusBadgeProps {
  status: TestPlanStatus
  analysisEdited?: boolean
}

export function TestPlanStatusBadge({ status, analysisEdited }: TestPlanStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.none
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${config.className}`}
      >
        {config.text}
      </span>
      {analysisEdited && (
        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
          Edited
        </span>
      )}
    </span>
  )
}
