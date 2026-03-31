// ── Tabs ──────────────────────────────────────────────────────────────────────
// Underline-style tab bar extracted from JobDetail.tsx for shared use.

// ── TabBar ────────────────────────────────────────────────────────────────────

interface TabBarProps {
  children: React.ReactNode
  className?: string
}

export function TabBar({ children, className = '' }: TabBarProps) {
  return (
    <div
      className={`flex items-center gap-1 border-b border-[var(--color-borders-border-primary)] overflow-x-auto scrollbar-none ${className}`}
    >
      {children}
    </div>
  )
}

// ── TabButton ─────────────────────────────────────────────────────────────────

export interface TabButtonProps {
  active: boolean
  onClick: () => void
  /** Optional numeric/string badge rendered as a pill */
  badge?: string
  children: React.ReactNode
}

export function TabButton({ active, onClick, badge, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors shrink-0',
        'border-b-2 -mb-px',
        active
          ? 'border-[var(--color-fonts-font-color-brand)] text-[var(--color-fonts-font-color-primary)]'
          : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-borders-border-primary)]',
      ].join(' ')}
    >
      {children}
      {badge && (
        <span className="inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[10px] font-semibold bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]">
          {badge}
        </span>
      )}
    </button>
  )
}
