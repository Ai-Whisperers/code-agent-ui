import type { PlanStatus } from '@/types/api'

const STATUS_STYLES: Record<PlanStatus, string> = {
  DRAFT: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  APPROVED: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  EXECUTING: 'bg-[var(--color-status-neutral-background)] text-[var(--color-fonts-font-color-brand)]',
  PAUSED: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
  CANCELLED: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
  COMPLETED: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  FAILED: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
}

export function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}
    >
      {status}
    </span>
  )
}
