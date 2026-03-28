import { useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastConfig {
  message: string
  variant?: ToastVariant
  /** Optional call-to-action rendered as a button inside the toast */
  action?: { label: string; onClick: () => void }
  /** Auto-dismiss delay in ms. Pass 0 to disable. Defaults to 5000. */
  duration?: number
}

interface ToastProps extends ToastConfig {
  onClose: () => void
}

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle size={15} />,
  error:   <XCircle    size={15} />,
  info:    <Info        size={15} />,
}

const COLORS: Record<ToastVariant, { wrap: string; icon: string }> = {
  success: {
    wrap: 'border-[var(--color-status-border-success)] bg-[var(--color-tags-success-background)]',
    icon: 'text-[var(--color-tags-font-success)]',
  },
  error: {
    wrap: 'border-[var(--color-status-border-critical)] bg-[var(--color-tags-critical-background)]',
    icon: 'text-[var(--color-tags-font-critical)]',
  },
  info: {
    wrap: 'border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)]',
    icon: 'text-[var(--color-fonts-font-color-support)]',
  },
}

export function Toast({
  message,
  variant = 'info',
  action,
  duration = 5000,
  onClose,
}: ToastProps) {
  const { wrap, icon } = COLORS[variant]

  useEffect(() => {
    if (!duration) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [duration, onClose])

  return (
    <div
      role="alert"
      className={`fixed bottom-5 right-5 z-50 flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-lg max-w-sm animate-in slide-in-from-bottom-2 ${wrap}`}
    >
      <span className={`shrink-0 mt-px ${icon}`}>{ICONS[variant]}</span>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] leading-snug">
          {message}
        </p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-1 text-[11px] font-semibold underline underline-offset-2 text-[var(--color-fonts-font-color-primary)] hover:opacity-70 transition-opacity"
          >
            {action.label} →
          </button>
        )}
      </div>

      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 mt-px text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}
