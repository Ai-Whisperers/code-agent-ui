// ── Divider ───────────────────────────────────────────────────────────────────
// A thin, low-contrast separator for splitting layout regions.
// Vertical dividers are used between side-by-side panels; horizontal ones
// separate stacked sections.

interface DividerProps {
  /** 'vertical' renders a full-height 1 px rule; 'horizontal' a full-width rule. */
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

export function Divider({ orientation = 'horizontal', className = '' }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        aria-hidden
        className={`w-px self-stretch bg-[var(--color-borders-border-primary)] opacity-60 shrink-0 ${className}`}
      />
    )
  }

  return (
    <hr
      aria-hidden
      className={`border-0 border-t border-[var(--color-borders-border-primary)] opacity-60 ${className}`}
    />
  )
}
