import { CheckCircle, Clock, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import type { ExecutionPlan, PlanPhase, PlanStep } from '@/types/api'

interface ProgressTimelineProps {
  plan: ExecutionPlan
  isLive?: boolean
}

export default function ProgressTimeline({ plan, isLive = false }: ProgressTimelineProps) {
  if (!plan.planData?.phases || plan.planData.phases.length === 0) {
    return (
      <div className="text-sm text-[var(--color-fonts-font-color-support)]">
        No structured phases available
      </div>
    )
  }

  const phases = plan.planData.phases.sort((a, b) => a.phaseOrder - b.phaseOrder)

  const getPhaseStatus = (phase: PlanPhase): 'completed' | 'running' | 'pending' | 'failed' => {
    if (!phase.steps || phase.steps.length === 0) return 'pending'
    
    const stepStatuses = phase.steps.map(step => step.status)
    const hasRunning = stepStatuses.some(status => status === 'RUNNING')
    const hasFailed = stepStatuses.some(status => status === 'FAILED')
    const allCompleted = stepStatuses.every(status => status === 'SUCCESS' || status === 'COMPLETED')
    
    if (hasFailed) return 'failed'
    if (hasRunning) return 'running'
    if (allCompleted) return 'completed'
    return 'pending'
  }

  const getStepIcon = (step: PlanStep) => {
    switch (step.status) {
      case 'SUCCESS':
      case 'COMPLETED':
        return <CheckCircle className="text-[var(--color-status-border-success)]" size={16} />
      case 'RUNNING':
        return <RefreshCw className="text-[var(--color-buttons-button-primary)] animate-spin" size={16} />
      case 'FAILED':
        return <XCircle className="text-[var(--color-status-border-critical)]" size={16} />
      case 'SKIPPED':
        return <AlertCircle className="text-[var(--color-fonts-font-color-support)]" size={16} />
      default:
        return <Clock className="text-[var(--color-fonts-font-color-support)]" size={16} />
    }
  }

  const getPhaseIcon = (phase: PlanPhase) => {
    const status = getPhaseStatus(phase)
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-[var(--color-status-border-success)]" size={20} />
      case 'running':
        return <RefreshCw className="text-[var(--color-buttons-button-primary)] animate-spin" size={20} />
      case 'failed':
        return <XCircle className="text-[var(--color-status-border-critical)]" size={20} />
      default:
        return <Clock className="text-[var(--color-fonts-font-color-support)]" size={20} />
    }
  }

  const getStepDuration = (): string | null => {
    // This would be calculated from step timing data if available
    // For now, return null since we don't have timing information in the current step structure
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-medium text-[var(--color-fonts-font-color-primary)]">
          Execution Progress
        </h3>
        {isLive && plan.status === 'RUNNING' && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)]">
            <RefreshCw size={12} className="animate-spin" />
            Live updates
          </div>
        )}
      </div>

      <div className="space-y-4">
        {phases.map((phase, phaseIndex) => {
          const phaseStatus = getPhaseStatus(phase)
          const isLastPhase = phaseIndex === phases.length - 1

          return (
            <div key={phase.phaseOrder} className="relative">
              {/* Phase Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="relative">
                  {getPhaseIcon(phase)}
                  {!isLastPhase && (
                    <div 
                      className={`absolute top-6 left-1/2 transform -translate-x-1/2 w-0.5 h-8 ${
                        phaseStatus === 'completed' 
                          ? 'bg-[var(--color-status-border-success)]' 
                          : 'bg-[var(--color-cards-card-stroke)]'
                      }`}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-[var(--color-fonts-font-color-primary)]">
                    Phase {phase.phaseOrder}: {phase.title}
                  </h4>
                  <div className="flex items-center gap-4 mt-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      phaseStatus === 'completed' ? 'bg-[var(--color-status-success-background)] text-[var(--color-tags-font-success)]' :
                      phaseStatus === 'running' ? 'bg-[var(--color-status-neutral-background)] text-[var(--color-buttons-button-primary)]' :
                      phaseStatus === 'failed' ? 'bg-[var(--color-status-critical-background)] text-[var(--color-tags-font-critical)]' :
                      'bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-support)]'
                    }`}>
                      {phaseStatus}
                    </span>
                    <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                      {phase.steps?.length || 0} step{(phase.steps?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase Steps */}
              {phase.steps && phase.steps.length > 0 && (
                <div className="ml-8 space-y-2">
                  {phase.steps.map((step) => {
                    const duration = getStepDuration()
                    
                    return (
                      <div 
                        key={step.stepId}
                        className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-cards-small-section-background)] border border-[var(--color-cards-card-stroke)]"
                      >
                        <div className="mt-0.5">
                          {getStepIcon(step)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)] truncate">
                                {step.title}
                              </p>
                              {step.description && (
                                <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                                  {step.description}
                                </p>
                              )}
                              {step.status === 'FAILED' && step.errorMessage && (
                                <div className="mt-2 p-2 rounded bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)]">
                                  <div className="flex items-start gap-1.5">
                                    <AlertCircle size={14} className="text-[var(--color-tags-font-critical)] mt-0.5 shrink-0" />
                                    <span className="text-xs text-[var(--color-tags-font-critical)]">
                                      {step.errorMessage}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              {duration && (
                                <span className="text-xs text-[var(--color-fonts-font-color-support)] bg-[var(--color-filters-filter-background)] px-2 py-1 rounded">
                                  {duration}
                                </span>
                              )}
                              <span className={`text-xs font-medium ${
                                step.status === 'SUCCESS' || step.status === 'COMPLETED' ? 'text-[var(--color-tags-font-success)]' :
                                step.status === 'RUNNING' ? 'text-[var(--color-buttons-button-primary)]' :
                                step.status === 'FAILED' ? 'text-[var(--color-tags-font-critical)]' :
                                'text-[var(--color-fonts-font-color-support)]'
                              }`}>
                                {step.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Overall Progress */}
      <div className="mt-6 pt-4 border-t border-[var(--color-cards-card-stroke)]">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-fonts-font-color-support)]">
            Overall Progress
          </span>
          <div className="flex items-center gap-2">
            {plan.status === 'RUNNING' && (
              <RefreshCw size={12} className="text-[var(--color-buttons-button-primary)] animate-spin" />
            )}
            <span className={`font-medium ${
              plan.status === 'COMPLETED' ? 'text-[var(--color-tags-font-success)]' :
              plan.status === 'RUNNING' ? 'text-[var(--color-buttons-button-primary)]' :
              plan.status === 'FAILED' ? 'text-[var(--color-tags-font-critical)]' :
              'text-[var(--color-fonts-font-color-support)]'
            }`}>
              {plan.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
