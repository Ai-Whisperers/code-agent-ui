import { useState, useEffect } from 'react'
import { X, Save, RotateCcw } from 'lucide-react'
import type { ExecutionPlan } from '@/types/api'

export interface PlanDialogProps {
  plan: ExecutionPlan
  isOpen: boolean
  onClose: () => void
  onSave?: (planId: string, content: string) => void
  onDiscard?: () => void
}

export function PlanDialog({
  plan,
  isOpen,
  onClose,
  onSave,
  onDiscard
}: PlanDialogProps) {
  const [content, setContent] = useState(plan.markdownContent || '')
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setContent(plan.markdownContent || '')
    setHasChanges(false)
  }, [plan.markdownContent])

  useEffect(() => {
    setHasChanges(content !== (plan.markdownContent || ''))
  }, [content, plan.markdownContent])

  const handleSave = async () => {
    if (!onSave || !hasChanges) return
    
    setIsSaving(true)
    try {
      await onSave(plan.planId, content)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save plan:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    setContent(plan.markdownContent || '')
    setHasChanges(false)
    if (onDiscard) {
      onDiscard()
    } else {
      onClose()
    }
  }

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        handleDiscard()
      }
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
              📄 {plan.title}
            </h2>
            {plan.summary && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {plan.summary}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="ml-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Editor Container */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your execution plan in Markdown format..."
              className="w-full h-full p-4 border-none outline-none resize-none text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              style={{ 
                minHeight: '400px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }}
            />
          </div>
          
          {/* Status indicator */}
          {hasChanges && (
            <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
              • Unsaved changes
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Status: {plan.status}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              disabled={!hasChanges}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw size={16} />
              Discard
            </button>
            
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlanDialog
