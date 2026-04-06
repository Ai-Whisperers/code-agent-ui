const RISK_CONFIG: Record<string, { className: string }> = {
  Critical: { className: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]' },
  High:     { className: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]' },
  Medium:   { className: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]' },
  Low:      { className: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
}

interface RiskBadgeProps {
  level?: string
}

export function RiskBadge({ level }: RiskBadgeProps) {
  if (!level) return <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
  const config = RISK_CONFIG[level] ?? RISK_CONFIG.Low
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${config.className}`}
    >
      {level}
    </span>
  )
}
