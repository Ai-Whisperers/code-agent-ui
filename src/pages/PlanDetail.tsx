import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, CheckCircle, Play, RefreshCw, ExternalLink, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { ExecutionPlan, PlanPhase } from '@/types/api'

interface PlanDetailProps {
  planId: string
}

export default function PlanDetail({ planId }: PlanDetailProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: plan, isLoading } = useQuery<ExecutionPlan>({
    queryKey: ['plan', planId],
    queryFn: () => api.get(`/plans/${planId}`).then((r) => r.data),
    refetchInterval: (q) => (q.state.data?.status === 'RUNNING' ? 5_000 : false),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/plans/${planId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan', planId] }),
  })

  const executeMutation = useMutation({
    mutationFn: () => api.post(`/plans/${planId}/execute`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan', planId] }),
  })

  const approvePrMutation = useMutation({
    mutationFn: () => api.post(`/plans/${planId}/approve-pr`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan', planId] }),
  })

  const rejectPrMutation = useMutation({
    mutationFn: () => api.post(`/plans/${planId}/reject-pr`, { reason: 'Rejected via UI' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan', planId] }),
  })

  return (
    <main>
      <div className="mb-4">
        <button
          onClick={() => navigate({ to: '/plans' })}
          className="flex items-center gap-1.5 text-sm text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Plans
        </button>
      </div>

      <PageHeader
        title={plan?.title ?? (isLoading ? 'Loading…' : 'Plan')}
        actions={
          plan?.status === 'DRAFT' ? (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] text-sm font-medium hover:opacity-80 transition-opacity"
            >
              <CheckCircle size={15} />
              Approve
            </button>
          ) : plan?.status === 'APPROVED' ? (
            <button
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
            >
              <Play size={15} />
              Execute Plan
            </button>
          ) : plan?.status === 'COMPLETED' && plan?.prUrl ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => approvePrMutation.mutate()}
                disabled={approvePrMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-status-border-success)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <CheckCircle size={15} />
                Approve & Merge PR
              </button>
              <button
                onClick={() => rejectPrMutation.mutate()}
                disabled={rejectPrMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <XCircle size={15} />
                Reject PR
              </button>
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : plan ? (
        <div className="space-y-5">
          {/* Meta */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Detail label="Status" value={plan.status} />
              {plan.sourceRef && <Detail label="Source" value={plan.sourceRef} />}
              {plan.repoUrl && <Detail label="Repository" value={plan.repoUrl} />}
              {plan.targetBranch && <Detail label="Target Branch" value={plan.targetBranch} />}
              <Detail label="Created" value={new Date(plan.createdAt).toLocaleString()} />
              {plan.approvedAt && (
                <Detail label="Approved" value={new Date(plan.approvedAt).toLocaleString()} />
              )}
            </div>
            {plan.summary && (
              <div className="mt-4 pt-4 border-t border-[var(--color-cards-card-stroke)]">
                <p className="text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap">
                  {plan.summary}
                </p>
              </div>
            )}
          </div>

          {/* PR link */}
          {plan.prUrl && (
            <div className="bg-[var(--color-status-neutral-background)] border border-[var(--color-status-border-neutral)] rounded-[var(--border-radius-card)] p-4">
              <a
                href={plan.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-fonts-font-color-brand)] hover:underline"
              >
                <ExternalLink size={15} />
                View Pull Request
              </a>
            </div>
          )}

          {/* Phases & Steps */}
          {plan.planData?.phases && plan.planData.phases.length > 0 && (
            <div className="space-y-4">
              <h3>Phases</h3>
              {plan.planData.phases.map((phase: PlanPhase) => (
                <div
                  key={phase.phaseOrder}
                  className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]"
                >
                  <div className="px-5 py-3 bg-[var(--color-cards-small-section-background)] border-b border-[var(--color-cards-card-stroke)]">
                    <h3>
                      Phase {phase.phaseOrder}: {phase.title}
                    </h3>
                  </div>
                  <div className="divide-y divide-[var(--color-tables-table-cell-stroke)]">
                    {phase.steps.map((step) => (
                      <div key={step.stepId} className="px-5 py-3 flex items-start gap-3">
                        <span className="w-6 h-6 mt-0.5 shrink-0 rounded-full bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-buttons)] text-xs flex items-center justify-center font-semibold">
                          {step.order}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                            {step.title}
                          </p>
                          {step.description && (
                            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                              {step.description}
                            </p>
                          )}
                          {step.status === 'FAILED' && step.errorMessage && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-tags-font-critical)]">
                              <AlertCircle size={13} className="mt-0.5 shrink-0" />
                              <span>{step.errorMessage}</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs shrink-0 ${step.status === 'FAILED' ? 'text-[var(--color-tags-font-critical)]' : 'text-[var(--color-fonts-font-color-support)]'}`}>
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {plan.status === 'RUNNING' && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin" />
              Plan is executing — auto-refreshing…
            </p>
          )}

          {plan.errorMessage && (
            <div className="bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)] rounded-[var(--border-radius-card)] p-5">
              <h3 className="mb-2 text-[var(--color-tags-font-critical)]">Error</h3>
              <p className="text-sm text-[var(--color-tags-font-critical)] whitespace-pre-wrap font-mono">
                {plan.errorMessage}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[var(--color-fonts-font-color-support)]">Plan not found.</p>
      )}
    </main>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-1">{label}</p>
      <div className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">{value}</div>
    </div>
  )
}
