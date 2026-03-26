import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Archive } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { PlanCard } from '@/components/plans/PlanCard'
import api from '@/lib/api'
import type { ExecutionPlan } from '@/types/api'

const ARCHIVED_KEY = 'plans:showArchived'

export default function PlansPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showArchived, setShowArchived] = useState<boolean>(
    () => localStorage.getItem(ARCHIVED_KEY) === 'true',
  )

  const toggleArchived = () => {
    setShowArchived((prev) => {
      const next = !prev
      localStorage.setItem(ARCHIVED_KEY, String(next))
      return next
    })
  }

  const { data: plans, isLoading } = useQuery<ExecutionPlan[]>({
    queryKey: ['plans', { showArchived }],
    queryFn: () =>
      api.get('/plans', { params: { includeArchived: showArchived } }).then((r) => r.data).catch(() => []),
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

  const archiveMutation = useMutation({
    mutationFn: (planId: string) => api.post(`/plans/${planId}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (planId: string) => api.delete(`/plans/${planId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans'] }),
  })

  const list = Array.isArray(plans) ? plans : []

  return (
    <main>
      <PageHeader
        title="Execution Plans"
        subtitle="Create and manage multi-step execution plans."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={toggleArchived}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] text-xs font-medium transition-colors ${
                showArchived
                  ? 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
                  : 'bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)]'
              }`}
            >
              <Archive size={13} />
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
            <button
              onClick={() => navigate({ to: '/plans/new' })}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
            >
              <Plus size={15} />
              New Plan
            </button>
          </div>
        }
      />

      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 skeleton-shimmer rounded-[var(--border-radius-card)]" />
            ))
          : list.length === 0
          ? (
            <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
              {showArchived ? 'No archived plans found.' : 'No plans found. Create your first plan!'}
            </div>
          )
          : list.map((plan) => (
              <PlanCard
                key={plan.planId}
                plan={plan}
                onApprove={(id) => approveMutation.mutate(id)}
                onExecute={(id) => executeMutation.mutate(id)}
                onArchive={(id) => archiveMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
                approvePending={approveMutation.isPending}
                executePending={executeMutation.isPending}
              />
            ))}
      </div>
    </main>
  )
}
