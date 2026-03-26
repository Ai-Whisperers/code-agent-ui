import { Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  /** Dialog heading */
  title: string
  /** Body content — use JSX for rich text or a string for plain text */
  children: React.ReactNode
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string
  /** Visual variant — 'danger' renders the confirm button in red */
  variant?: 'danger' | 'default'
  /** Icon shown in the header badge (optional) */
  icon?: React.ReactNode
  isPending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  icon,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] shadow-xl p-6">
        <div className="flex items-start gap-3 mb-5">
          {icon && (
            <div
              className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full ${
                isDanger
                  ? 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'
                  : 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] mb-1">
              {title}
            </h2>
            <div className="text-xs text-[var(--color-fonts-font-color-support)] leading-relaxed">
              {children}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--border-radius-button-small)] disabled:opacity-50 transition-opacity ${
              isDanger
                ? 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] hover:opacity-80'
                : 'bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)]'
            }`}
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
