import type { ReadinessLabel } from '@/types/api'

const LABEL_CONFIG: Record<ReadinessLabel, { text: string; className: string }> = {
  poor: {
    text: 'Poor',
    className: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
  },
  needs_refinement: {
    text: 'Needs Refinement',
    className: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
  },
  ready_with_minor_improvements: {
    text: 'Minor Improvements',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  fully_ready: {
    text: 'Fully Ready',
    className: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  },
}

interface ReadinessBadgeProps {
  label?: ReadinessLabel | string
  score?: number
  showScore?: boolean
}

export function ReadinessBadge({ label, score, showScore = false }: ReadinessBadgeProps) {
  const config = label ? LABEL_CONFIG[label as ReadinessLabel] : null

  if (!config && score == null) {
    return (
      <span className="text-[var(--color-fonts-font-color-support)] text-xs">—</span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${
        config?.className ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
      }`}
    >
      {config?.text ?? label}
      {showScore && score != null && (
        <span className="opacity-70">({score})</span>
      )}
    </span>
  )
}
