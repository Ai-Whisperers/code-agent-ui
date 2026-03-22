import { useState } from 'react'
import { Pause, Play, Square, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'

interface ExecutionControlsProps {
  planId: string
  status: string
  onAction?: (action: 'pause' | 'resume' | 'cancel', success: boolean) => void
}

export default function ExecutionControls({ planId, status, onAction }: ExecutionControlsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<'cancel' | null>(null)

  const handleAction = async (action: 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel' && !showConfirm) {
      setShowConfirm('cancel')
      return
    }

    setLoading(action)
    setShowConfirm(null)

    try {
      await api.post(`/plans/${planId}/${action}`)
      onAction?.(action, true)
    } catch (error) {
      console.error(`Failed to ${action} plan:`, error)
      onAction?.(action, false)
    } finally {
      setLoading(null)
    }
  }

  // Only show controls for RUNNING or PAUSED plans
  if (status !== 'RUNNING' && status !== 'PAUSED') {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h4 className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
          Execution Controls
        </h4>
        <div className="h-px flex-1 bg-[var(--color-cards-card-stroke)]" />
      </div>

      <div className="flex items-center gap-2">
        {status === 'RUNNING' && (
          <>
            <button
              onClick={() => handleAction('pause')}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-status-neutral-background)] text-[var(--color-fonts-font-color-primary)] border border-[var(--color-cards-card-stroke)] hover:bg-[var(--color-filters-filter-background)] transition-colors disabled:opacity-50"
            >
              {loading === 'pause' ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
              ) : (
                <Pause size={12} />
              )}
              Pause
            </button>
            
            <button
              onClick={() => handleAction('cancel')}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-status-critical-background)] text-[var(--color-tags-font-critical)] border border-[var(--color-status-border-critical)] hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading === 'cancel' ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
              ) : (
                <Square size={12} />
              )}
              Cancel
            </button>
          </>
        )}

        {status === 'PAUSED' && (
          <>
            <button
              onClick={() => handleAction('resume')}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading === 'resume' ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
              ) : (
                <Play size={12} />
              )}
              Resume
            </button>
            
            <button
              onClick={() => handleAction('cancel')}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-status-critical-background)] text-[var(--color-tags-font-critical)] border border-[var(--color-status-border-critical)] hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading === 'cancel' ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
              ) : (
                <Square size={12} />
              )}
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      {showConfirm === 'cancel' && (
        <div className="p-3 rounded-lg bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)]">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-[var(--color-tags-font-critical)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--color-tags-font-critical)]">
                Cancel Plan Execution?
              </p>
              <p className="text-xs text-[var(--color-tags-font-critical)] mt-1">
                This will stop all running tasks and cannot be undone. Progress will be lost.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleAction('cancel')}
                  disabled={loading !== null}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--color-tags-critical-background)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading === 'cancel' ? (
                    <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
                  ) : (
                    'Yes, Cancel'
                  )}
                </button>
                <button
                  onClick={() => setShowConfirm(null)}
                  disabled={loading !== null}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-stroke)] transition-colors disabled:opacity-50"
                >
                  Keep Running
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Info */}
      <div className="text-xs text-[var(--color-fonts-font-color-support)]">
        {status === 'RUNNING' && 'Plan is currently executing. You can pause or cancel at any time.'}
        {status === 'PAUSED' && 'Plan execution is paused. Resume to continue or cancel to stop permanently.'}
      </div>
    </div>
  )
}
