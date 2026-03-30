import type { ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A selectable option or a visual divider between groups. */
export type RadioOption =
  | { value: string; label: string; description?: ReactNode }
  | { separator: true; label?: string }

export interface RadioGroupProps {
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  /**
   * 'card' (default): bordered card rows with a radio-circle indicator and
   * optional description text. Supports separator entries between groups.
   *
   * 'pills': compact rounded-full pill buttons for filter/tab-style selection.
   * Separator entries are ignored in this variant.
   */
  variant?: 'card' | 'pills'
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSeparator(opt: RadioOption): opt is { separator: true; label?: string } {
  return 'separator' in opt && opt.separator === true
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RadioGroup({
  options,
  value,
  onChange,
  variant = 'card',
  className,
}: RadioGroupProps) {
  // ── Pills variant ──────────────────────────────────────────────────────────

  if (variant === 'pills') {
    return (
      <div role="radiogroup" className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
        {options.map((opt) => {
          if (isSeparator(opt)) return null
          const isActive = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                isActive
                  ? 'bg-[var(--color-filters-filter-active)] text-[var(--color-fonts-font-color-buttons)]'
                  : 'bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-filters-filter-hover)]'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  // ── Card variant ───────────────────────────────────────────────────────────

  return (
    <div role="radiogroup" className={`space-y-1.5 ${className ?? ''}`}>
      {options.map((opt, i) => {
        if (isSeparator(opt)) {
          return (
            <div key={`sep-${i}`} className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-[var(--color-inputs-input-border)]" />
              {opt.label && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
                  {opt.label}
                </span>
              )}
              <div className="flex-1 h-px bg-[var(--color-inputs-input-border)]" />
            </div>
          )
        }

        const isSelected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-[var(--border-radius-small)] border text-left transition-colors ${
              isSelected
                ? 'border-[var(--color-buttons-button-primary)] bg-blue-50 dark:bg-blue-900/10'
                : 'border-[var(--color-inputs-input-border)] bg-[var(--color-cards-card-background)] hover:border-[var(--color-buttons-button-primary)] hover:bg-[var(--color-navigation-menu-item-hover-background)]'
            }`}
          >
            {/* Radio indicator: outer ring + inner dot — no checkmark */}
            <div
              className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSelected
                  ? 'border-[var(--color-buttons-button-primary)]'
                  : 'border-[var(--color-inputs-input-border)]'
              }`}
            >
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-buttons-button-primary)]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                {opt.label}
              </p>
              {opt.description && (
                <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 leading-relaxed">
                  {opt.description}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
