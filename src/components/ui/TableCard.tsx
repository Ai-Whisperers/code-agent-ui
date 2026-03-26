interface TableCardProps {
  /** Primary heading shown on the left of the title bar */
  title: string
  /** Optional secondary label (e.g. item count) rendered next to the title */
  subtitle?: string
  /** Toolbar content rendered on the right of the title bar */
  toolbar?: React.ReactNode
  /** Max height CSS value for the scrollable body (default: calc(100vh - 18rem)) */
  maxHeight?: string
  className?: string
  children: React.ReactNode
}

export function TableCard({
  title,
  subtitle,
  toolbar,
  maxHeight = 'calc(100vh - 18rem)',
  className = '',
  children,
}: TableCardProps) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-cards-card-stroke)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] bg-[var(--color-cards-card-background)] ${className}`}
    >
      {/* Scrollable body — title bar sticks inside this container */}
      <div className="overflow-auto" style={{ maxHeight }}>
        {/* Sticky title bar — height: py-1.5 (12px) + text-sm (20px) + border-b (1px) = 33px.
            Consumers that add a sticky <thead> should use top-[33px] to sit flush below this bar. */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-3 py-1.5 border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
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

        {children}
      </div>
    </div>
  )
}
