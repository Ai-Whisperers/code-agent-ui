import { CheckCircle, Clock, XCircle, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { ExecutionPlan, PlanPhase, PlanStep } from '@/types/api'

interface ProgressTimelineProps {
  plan: ExecutionPlan
  isLive?: boolean
}

type PhaseStatus = 'completed' | 'running' | 'pending' | 'failed'

function getPhaseStatus(phase: PlanPhase): PhaseStatus {
  if (!phase.steps?.length) return 'pending'
  const statuses = phase.steps.map((s) => s.status)
  if (statuses.some((s) => s === 'FAILED')) return 'failed'
  if (statuses.some((s) => s === 'EXECUTING')) return 'running'
  if (statuses.every((s) => s === 'SUCCESS' || s === 'COMPLETED')) return 'completed'
  return 'pending'
}

const PHASE_STATUS_CLASSES: Record<PhaseStatus, string> = {
  completed: 'text-[var(--color-tags-font-success)] bg-[var(--color-tags-success-background)]',
  running:   'text-[var(--color-fonts-font-color-brand)] bg-[var(--color-status-neutral-background)]',
  failed:    'text-[var(--color-tags-font-critical)] bg-[var(--color-tags-critical-background)]',
  pending:   'text-[var(--color-fonts-font-color-support)] bg-[var(--color-filters-filter-background)]',
}

const PHASE_CONNECTOR_CLASSES: Record<PhaseStatus, string> = {
  completed: 'bg-[var(--color-status-border-success)]',
  running:   'bg-[var(--color-cards-card-stroke)]',
  failed:    'bg-[var(--color-status-border-critical)]',
  pending:   'bg-[var(--color-cards-card-stroke)]',
}

function StepIcon({ step }: { step: PlanStep }) {
  const cls = 'shrink-0'
  switch (step.status) {
    case 'SUCCESS':
    case 'COMPLETED':
      return <CheckCircle size={14} className={`${cls} text-[var(--color-status-border-success)]`} />
    case 'EXECUTING':
      return <RefreshCw size={14} className={`${cls} text-[var(--color-buttons-button-primary)] animate-spin`} />
    case 'FAILED':
      return <XCircle size={14} className={`${cls} text-[var(--color-status-border-critical)]`} />
    case 'SKIPPED':
      return <AlertCircle size={14} className={`${cls} text-[var(--color-fonts-font-color-support)]`} />
    default:
      return <Clock size={14} className={`${cls} text-[var(--color-fonts-font-color-support)]`} />
  }
}

const STEP_STATUS_CLASSES: Record<string, string> = {
  SUCCESS:   'text-[var(--color-tags-font-success)]',
  COMPLETED: 'text-[var(--color-tags-font-success)]',
  EXECUTING: 'text-[var(--color-buttons-button-primary)]',
  FAILED:    'text-[var(--color-tags-font-critical)]',
}

export default function ProgressTimeline({ plan, isLive = false }: ProgressTimelineProps) {
  const navigate = useNavigate()
  if (!plan.planData?.phases?.length) {
    return (
      <p className="text-sm text-[var(--color-fonts-font-color-support)]">No structured phases available.</p>
    )
  }

  const totalSteps = plan.planData.phases.reduce((t, p) => t + (p.steps?.length ?? 0), 0)
  const doneSteps  = plan.planData.phases.reduce(
    (t, p) => t + (p.steps?.filter((s) => s.status === 'SUCCESS' || s.status === 'COMPLETED').length ?? 0),
    0,
  )
  const progress = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0

  const phases = [...plan.planData.phases].sort((a, b) => a.phaseOrder - b.phaseOrder)

  return (
    <div className="space-y-4">
      {/* Header + progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">
              Execution Progress
            </span>
            {isLive && plan.status === 'EXECUTING' && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-brand)]">
                <RefreshCw size={10} className="animate-spin" />
                Live
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">
            {doneSteps}/{totalSteps} steps
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-cards-card-stroke)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-buttons-button-primary)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-3">
        {phases.map((phase, idx) => {
          const phaseStatus = getPhaseStatus(phase)
          const isLast = idx === phases.length - 1

          return (
            <div key={phase.phaseOrder} className="relative">
              {/* Phase header */}
              <div className="flex items-center gap-2.5">
                {/* Connector line */}
                <div className="relative flex flex-col items-center self-stretch">
                  <div
                    className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center ${
                      phaseStatus === 'completed' ? 'bg-[var(--color-status-border-success)]' :
                      phaseStatus === 'running'   ? 'bg-[var(--color-buttons-button-primary)]' :
                      phaseStatus === 'failed'    ? 'bg-[var(--color-status-border-critical)]' :
                                                   'bg-[var(--color-cards-card-stroke)]'
                    }`}
                  >
                    {phaseStatus === 'running' && (
                      <RefreshCw size={9} className="text-white animate-spin" />
                    )}
                    {phaseStatus === 'completed' && (
                      <CheckCircle size={10} className="text-white" />
                    )}
                    {phaseStatus === 'failed' && (
                      <XCircle size={10} className="text-white" />
                    )}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 mt-1 ${PHASE_CONNECTOR_CLASSES[phaseStatus]}`} style={{ minHeight: '12px' }} />
                  )}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0 pb-1">
                  <span className="text-sm font-medium text-[var(--color-fonts-font-color-primary)] truncate">
                    {phase.title}
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${PHASE_STATUS_CLASSES[phaseStatus]} shrink-0`}>
                    {phaseStatus}
                  </span>
                  <span className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0">
                    {phase.steps?.length ?? 0} step{(phase.steps?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Steps */}
              {phase.steps?.length > 0 && (
                <div className="ml-6 mt-1.5 space-y-1.5 pb-2">
                  {phase.steps.map((step) => (
                    <div
                      key={step.stepId}
                      className="flex items-start gap-2.5 p-2.5 rounded bg-[var(--color-cards-small-section-background)] border border-[var(--color-cards-card-stroke)]"
                    >
                      <StepIcon step={step} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] truncate">
                            {step.title}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-medium ${STEP_STATUS_CLASSES[step.status] ?? 'text-[var(--color-fonts-font-color-support)]'}`}>
                              {step.status}
                            </span>
                            {step.jobId && (
                              <button
                                onClick={() => navigate({ to: '/jobs/$id', params: { id: step.jobId! } })}
                                className="flex items-center gap-0.5 text-[10px] font-medium text-[var(--color-fonts-font-color-brand)] hover:underline"
                                title={`View job ${step.jobId}`}
                              >
                                <ExternalLink size={10} />
                                Job
                              </button>
                            )}
                          </div>
                        </div>
                        {step.description && (
                          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 truncate">
                            {step.description}
                          </p>
                        )}
                        {step.jobId && (
                          <p className="text-[10px] text-[var(--color-fonts-font-color-support)] mt-0.5 font-mono">
                            {step.jobId}
                          </p>
                        )}
                        {step.status === 'FAILED' && step.errorMessage && (
                          <div className="mt-1.5 p-2 rounded bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)]">
                            <p className="text-xs text-[var(--color-tags-font-critical)]">{step.errorMessage}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
