import { Button } from '@/components/ui/Button'

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
      <div className="w-full max-w-sm rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-6">
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
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={isDanger ? 'danger' : 'primary'}
            loading={isPending}
            onClick={onConfirm}
            disabled={isPending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
