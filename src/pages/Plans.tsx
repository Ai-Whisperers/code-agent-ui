import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Archive } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
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
            <Button
              variant="secondary"
              size="md"
              icon={<Archive size={13} />}
              onClick={toggleArchived}
              className={showArchived ? '!bg-[var(--color-tags-attention-background)] !text-[var(--color-tags-font-attention)] hover:!bg-[var(--color-tags-attention-background)]' : ''}
            >
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </Button>
            <Button
              variant="primary"
              size="lg"
              icon={<Plus size={15} />}
              onClick={() => navigate({ to: '/plans/new' })}
            >
              New Plan
            </Button>
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
