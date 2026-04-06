const PRIORITY_CONFIG: Record<string, { className: string }> = {
  High:     { className: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]' },
  Medium:   { className: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]' },
  Low:      { className: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
  Critical: { className: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]' },
}

interface PriorityBadgeProps {
  priority?: string
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (!priority) return <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.Low
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${config.className}`}
    >
      {priority}
    </span>
  )
}
