import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Play, CheckCircle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { ExecutionPlan, PlanStatus } from '@/types/api'

function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const map: Record<PlanStatus, string> = {
    DRAFT: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    APPROVED: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    RUNNING: 'bg-[var(--color-status-neutral-background)] text-[var(--color-fonts-font-color-brand)]',
    EXECUTING: 'bg-[var(--color-status-neutral-background)] text-[var(--color-fonts-font-color-brand)]',
    COMPLETED: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    FAILED: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${map[status]}`}>
      {status}
    </span>
  )
}

export default function PlansPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: plans, isLoading } = useQuery<ExecutionPlan[]>({
    queryKey: ['plans'],
    queryFn: () => api.get('/plans').then((r) => r.data).catch(() => []),
    refetchInterval: 15_000,
  })

  const approveMutation = useMutation({
    mutationFn: (planId: string) => api.post(`/plans/${planId}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })

  const executeMutation = useMutation({
    mutationFn: (planId: string) => api.post(`/plans/${planId}/execute`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })

  const list = Array.isArray(plans) ? plans : []

  return (
    <main>
      <PageHeader
        title="Execution Plans"
        subtitle="Create and manage multi-step execution plans."
        actions={
          <button
            onClick={() => navigate({ to: '/plans/new' })}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
          >
            <Plus size={15} />
            New Plan
          </button>
        }
      />

      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 skeleton-shimmer rounded-[var(--border-radius-card)]" />
            ))
          : list.length === 0
          ? (
            <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
              No plans found. Create your first plan!
            </div>
          )
          : list.map((plan) => (
              <div
                key={plan.planId}
                className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PlanStatusBadge status={plan.status} />
                      {plan.status === 'COMPLETED' && plan.prUrl && (
                        <span className="text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
                          PR PENDING
                        </span>
                      )}
                      {plan.sourceRef && (
                        <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                          {plan.sourceRef}
                        </span>
                      )}
                    </div>
                    <h3
                      className="cursor-pointer hover:text-[var(--color-fonts-font-color-brand)] transition-colors"
                      onClick={() => navigate({ to: '/plans/$id', params: { id: plan.planId } })}
                    >
                      {plan.title}
                    </h3>
                    {plan.summary && (
                      <p className="text-sm text-[var(--color-fonts-font-color-support)] mt-1 line-clamp-2">
                        {plan.summary}
                      </p>
                    )}
                    <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-2">
                      Created {new Date(plan.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {plan.status === 'DRAFT' && (
                      <button
                        onClick={() => approveMutation.mutate(plan.planId)}
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] text-xs font-medium hover:opacity-80 transition-opacity"
                      >
                        <CheckCircle size={13} />
                        Approve
                      </button>
                    )}
                    {plan.status === 'APPROVED' && (
                      <button
                        onClick={() => executeMutation.mutate(plan.planId)}
                        disabled={executeMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
                      >
                        <Play size={13} />
                        Execute
                      </button>
                    )}
                    {(plan.status === 'RUNNING' || plan.status === 'EXECUTING') && (
                      <RefreshCw size={16} className="animate-spin text-[var(--color-fonts-font-color-brand)]" />
                    )}
                    <button
                      onClick={() => navigate({ to: '/plans/$id', params: { id: plan.planId } })}
                      className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </main>
  )
}
