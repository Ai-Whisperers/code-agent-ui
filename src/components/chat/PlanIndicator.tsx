import { useState } from 'react'
import { FileText, Eye, Zap, ExternalLink, X, Loader2 } from 'lucide-react'
import { getToken } from '@/lib/keycloak'
import type { ExecutionPlan } from '@/types/api'

export interface PlanIndicatorProps {
  plan: ExecutionPlan
  onViewPlan?: (plan: ExecutionPlan) => void
  onImplementPlan?: (planId: string) => void
  onDismiss?: () => void
  onClick?: (plan: ExecutionPlan) => void
}

export function PlanIndicator({
  plan,
  onViewPlan,
  onImplementPlan,
  onDismiss,
  onClick
}: PlanIndicatorProps) {
  const [isImplementing, setIsImplementing] = useState(false)
  const [implementError, setImplementError] = useState<string | null>(null)

  const handleImplement = async () => {
    if (plan.status !== 'DRAFT') return
    
    setIsImplementing(true)
    setImplementError(null)
    try {
      // First approve the plan
      const approveResponse = await fetch(`${import.meta.env.VITE_API_URL}/plans/${plan.planId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      })

      if (!approveResponse.ok) {
        throw new Error('Failed to approve plan')
      }

      // Then execute the plan
      const executeResponse = await fetch(`${import.meta.env.VITE_API_URL}/plans/${plan.planId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      })

      if (!executeResponse.ok) {
        throw new Error('Failed to execute plan')
      }

      onImplementPlan?.(plan.planId)
    } catch (error) {
      console.error('Failed to implement plan:', error)
      setImplementError(error instanceof Error ? error.message : 'Failed to implement plan')
    } finally {
      setIsImplementing(false)
    }
  }

  const getStatusColor = () => {
    switch (plan.status) {
      case 'DRAFT':
        return 'text-blue-600 dark:text-blue-400'
      case 'APPROVED':
        return 'text-green-600 dark:text-green-400'
      case 'EXECUTING':
        return 'text-orange-600 dark:text-orange-400'
      case 'COMPLETED':
        return 'text-green-700 dark:text-green-300'
      case 'FAILED':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-[var(--color-fonts-font-color-support)]'
    }
  }

  const getStatusText = () => {
    switch (plan.status) {
      case 'DRAFT':
        return 'Ready to implement'
      case 'APPROVED':
        return 'Approved - ready to execute'
      case 'EXECUTING':
        return 'Executing...'
      case 'COMPLETED':
        return 'Completed'
      case 'FAILED':
        return 'Failed'
      default:
        return plan.status
    }
  }

  return (
    <div 
      className={`mx-4 sm:mx-8 mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-[var(--border-radius-card)] p-4 shadow-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700' : ''
      }`}
      onClick={onClick ? () => onClick(plan) : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0 mt-0.5">
            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-[var(--color-fonts-font-color-headings)] text-sm truncate">
                📄 Execution Plan: {plan.title}
              </h3>
              <span className={`text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            
            {plan.summary && (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] line-clamp-2 mb-2">
                {plan.summary}
              </p>
            )}

            {implementError && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-2">{implementError}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {!onClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewPlan?.(plan)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <Eye size={12} />
                  View Plan
                </button>
              )}

              {plan.status === 'DRAFT' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleImplement()
                  }}
                  disabled={isImplementing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                >
                  {isImplementing ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Zap size={12} />
                      Implement ⚡️
                    </>
                  )}
                </button>
              )}

              {(plan.status === 'EXECUTING' || plan.status === 'APPROVED') && (
                <button
                  disabled
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 text-xs font-medium opacity-75 cursor-not-allowed"
                >
                  <Loader2 size={12} className="animate-spin" />
                  Executing...
                </button>
              )}

              {plan.status === 'COMPLETED' && plan.prUrl && (
                <a
                  href={plan.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 text-xs font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <ExternalLink size={12} />
                  View PR
                </a>
              )}
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            className="p-1 rounded hover:bg-white/50 dark:hover:bg-gray-800/50 text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export default PlanIndicator
