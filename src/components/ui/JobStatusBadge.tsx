export function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    FAILED: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
    RUNNING: 'bg-[var(--color-status-neutral-background)] text-[var(--color-fonts-font-color-brand)]',
    PENDING: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    QUEUED: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    AWAITING_APPROVAL:
      'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
  }
  const cls =
    map[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
