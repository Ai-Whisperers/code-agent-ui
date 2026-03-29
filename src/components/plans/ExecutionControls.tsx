import { useState } from 'react'
import { Pause, Play, Square, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import api from '@/lib/api'

interface ExecutionControlsProps {
  planId: string
  status: string
  onAction?: (action: 'pause' | 'resume' | 'cancel', success: boolean) => void
}

export default function ExecutionControls({ planId, status, onAction }: ExecutionControlsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const handleAction = async (action: 'pause' | 'resume' | 'cancel') => {
    setLoading(action)
    setShowCancelConfirm(false)
    try {
      await api.post(`/plans/${planId}/${action}`)
      onAction?.(action, true)
    } catch {
      onAction?.(action, false)
    } finally {
      setLoading(null)
    }
  }

  if (status !== 'EXECUTING' && status !== 'PAUSED') return null

  return (
    <>
      <div className="flex items-center gap-2">
        {status === 'EXECUTING' && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Pause size={13} />}
            loading={loading === 'pause'}
            disabled={loading !== null}
            onClick={() => handleAction('pause')}
          >
            Pause
          </Button>
        )}
        {status === 'PAUSED' && (
          <Button
            variant="primary"
            size="sm"
            icon={<Play size={13} />}
            loading={loading === 'resume'}
            disabled={loading !== null}
            onClick={() => handleAction('resume')}
          >
            Resume
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          icon={<Square size={13} />}
          loading={loading === 'cancel'}
          disabled={loading !== null}
          onClick={() => setShowCancelConfirm(true)}
        >
          Cancel
        </Button>
      </div>

      <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-2">
        {status === 'EXECUTING' && 'Plan is executing. You can pause or cancel at any time.'}
        {status === 'PAUSED' && 'Execution paused. Resume to continue or cancel to stop.'}
      </p>

      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel execution?"
          confirmLabel="Yes, Cancel"
          cancelLabel="Keep Running"
          variant="danger"
          icon={<AlertTriangle size={16} />}
          isPending={loading === 'cancel'}
          onConfirm={() => handleAction('cancel')}
          onCancel={() => setShowCancelConfirm(false)}
        >
          This will stop all running tasks immediately and cannot be undone. Progress will be lost.
        </ConfirmDialog>
      )}
    </>
  )
}
