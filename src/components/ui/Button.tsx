import { Loader2 } from 'lucide-react'

// ── Variant & size maps ──────────────────────────────────────────────────────

const VARIANT_CLASSES = {
  primary:
    'bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)]',
  secondary:
    'bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)]',
  ghost:
    'bg-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)]',
  danger:
    'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] hover:opacity-80',
  success:
    'text-[var(--color-tags-font-success)] hover:bg-[var(--color-tags-success-background)]',
  ai:
    'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 dark:hover:bg-violet-900/40',
} as const

const SIZE_CLASSES = {
  xs: 'px-2 py-1 text-[11px] gap-1',
  sm: 'px-2.5 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-xs gap-1.5',
  lg: 'px-4 py-2 text-sm gap-2',
} as const

export type ButtonVariant = keyof typeof VARIANT_CLASSES
export type ButtonSize    = keyof typeof SIZE_CLASSES

// ── Component ────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Icon rendered before children */
  icon?: React.ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center font-medium',
        'rounded',
        'transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
    >
      {loading
        ? <Loader2 size={size === 'lg' ? 14 : 11} className="animate-spin shrink-0" />
        : icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
