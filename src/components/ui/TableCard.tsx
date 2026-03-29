interface TableCardProps {
  /** Primary heading shown on the left of the title bar */
  title: string
  /** Optional secondary label (e.g. item count) rendered next to the title */
  subtitle?: string
  /** Toolbar content rendered on the right of the title bar */
  toolbar?: React.ReactNode
  /**
   * Controls the scrollable body height.
   * - `'none'` (default): fills available flex space when the card is a flex child;
   *   renders at natural height otherwise.
   * - `'auto'`: natural height with no internal overflow; the nearest scrolling
   *   ancestor (typically an outer wrapper) handles scrolling. Use this when you
   *   want `position: sticky` on a `<thead>` to stick relative to an outer scroll
   *   container rather than an internal one.
   * - Any CSS length string (e.g. `'400px'`): applied as `max-height`.
   */
  maxHeight?: string
  className?: string
  children: React.ReactNode
}

export function TableCard({
  title,
  subtitle,
  toolbar,
  maxHeight = 'none',
  className = '',
  children,
}: TableCardProps) {
  const isFill = maxHeight === 'none'
  const isAuto = maxHeight === 'auto'

  return (
    <div
      className={`rounded-lg border border-[var(--color-cards-card-stroke)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] bg-[var(--color-cards-card-background)] ${isFill ? 'flex flex-col' : ''} ${className}`}
    >
      {/* Title bar — intentionally outside the scroll container so it always spans
          the card width and is never displaced by horizontal table scrolling.
          Consumers that add a sticky <thead> should use top-0 (no offset needed). */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] truncate">
            {title}
          </span>
          {subtitle && (
            <>
              <span className="h-3.5 w-px shrink-0 bg-[var(--color-borders-border-primary)] opacity-30" />
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                {subtitle}
              </span>
            </>
          )}
        </div>
        {toolbar && (
          <div className="shrink-0 flex items-center gap-1.5">{toolbar}</div>
        )}
      </div>

      {/* Body — three modes:
          - fill (maxHeight='none'): stretches via flex-1, scrolls internally.
          - auto (maxHeight='auto'): natural height, no overflow set; scrolling is
            delegated to the nearest outer scroll container so that a sticky <thead>
            sticks relative to that outer container instead of an inner one.
          - explicit (any CSS length): capped at maxHeight, scrolls internally. */}
      <div
        className={`${isAuto ? '' : isFill ? 'overflow-auto flex-1 min-h-0' : 'overflow-auto'}`}
        style={!isFill && !isAuto ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
