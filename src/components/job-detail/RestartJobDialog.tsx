import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface RestartJobDialogProps {
  jobId: string
  checkpointIteration: number
  iterationCap: number
  isPending: boolean
  onConfirm: (additionalIterations: number) => void
  onCancel: () => void
}

const PRESETS = [10, 25, 50]

export function RestartJobDialog({
  checkpointIteration,
  iterationCap,
  isPending,
  onConfirm,
  onCancel,
}: RestartJobDialogProps) {
  const [additionalIterations, setAdditionalIterations] = useState(0)
  const [customInput, setCustomInput] = useState('')

  const defaultRemaining = Math.max(iterationCap - checkpointIteration, 0)
  const totalBudget = defaultRemaining + additionalIterations

  function applyPreset(n: number) {
    setAdditionalIterations(n)
    setCustomInput('')
  }

  function handleCustomChange(value: string) {
    setCustomInput(value)
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 200) {
      setAdditionalIterations(parsed)
    } else if (value === '') {
      setAdditionalIterations(0)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
            <RotateCcw size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] mb-1">
              Restart Job
            </h2>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] leading-relaxed">
              Resuming from iteration <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{checkpointIteration + 1}</span> of{' '}
              <span className="font-medium">{iterationCap}</span>.{' '}
              Remaining budget: <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{defaultRemaining}</span> iteration{defaultRemaining !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>

        {/* Extra iterations */}
        <div className="mb-4">
          <p className="text-xs font-medium text-[var(--color-fonts-font-color-body)] mb-2">
            Add extra iterations <span className="text-[var(--color-fonts-font-color-support)] font-normal">(optional)</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => applyPreset(n)}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                  additionalIterations === n && customInput === ''
                    ? 'bg-[var(--color-fonts-font-color-brand)] text-white border-[var(--color-fonts-font-color-brand)]'
                    : 'bg-transparent text-[var(--color-fonts-font-color-body)] border-[var(--color-tables-table-cell-stroke)] hover:border-[var(--color-fonts-font-color-brand)]'
                }`}
              >
                +{n}
              </button>
            ))}
            <input
              type="number"
              min={0}
              max={200}
              placeholder="custom"
              value={customInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-20 px-2 py-1 rounded border border-[var(--color-tables-table-cell-stroke)] bg-transparent text-xs text-[var(--color-fonts-font-color-body)] focus:outline-none focus:border-[var(--color-fonts-font-color-brand)]"
            />
          </div>
        </div>

        {/* Total budget summary */}
        <div className="mb-5 rounded-md px-3 py-2 bg-[var(--color-tags-neutral-background)] text-xs text-[var(--color-fonts-font-color-body)]">
          Total budget:{' '}
          <span className="font-semibold text-[var(--color-fonts-font-color-primary)]">
            {totalBudget} iteration{totalBudget !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={isPending}
            onClick={() => onConfirm(additionalIterations)}
            disabled={isPending}
          >
            Restart
          </Button>
        </div>
      </div>
    </div>
  )
}
