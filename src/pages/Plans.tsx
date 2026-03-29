import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, Archive } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { FilterSelect } from '@/components/ui/FilterSelect'
import type { FilterSelectOption } from '@/components/ui/FilterSelect'
import { PlanCard } from '@/components/plans/PlanCard'
import api from '@/lib/api'
import type { ExecutionPlan, PlanStatus } from '@/types/api'

const ARCHIVED_KEY = 'plans:showArchived'

const STATUS_OPTIONS: FilterSelectOption[] = [
  { value: 'DRAFT',     label: 'Draft',     dotClass: 'bg-[var(--color-tags-neutral-background)]' },
  { value: 'APPROVED',  label: 'Approved',  dotClass: 'bg-[var(--color-tags-success-background)]' },
  { value: 'EXECUTING', label: 'Executing', dotClass: 'bg-[var(--color-status-border-neutral)]' },
  { value: 'PAUSED',    label: 'Paused',    dotClass: 'bg-[var(--color-tags-attention-background)]' },
  { value: 'COMPLETED', label: 'Completed', dotClass: 'bg-[var(--color-status-border-success)]' },
  { value: 'FAILED',    label: 'Failed',    dotClass: 'bg-[var(--color-status-border-critical)]' },
  { value: 'CANCELLED', label: 'Cancelled', dotClass: 'bg-[var(--color-tags-neutral-background)]' },
]

export default function PlansPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showArchived, setShowArchived] = useState<boolean>(
    () => localStorage.getItem(ARCHIVED_KEY) === 'true',
  )
  const [statusFilter, setStatusFilter] = useState('')

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

  const allPlans = Array.isArray(plans) ? plans : []
  const filtered = statusFilter
    ? allPlans.filter((p) => p.status === (statusFilter as PlanStatus))
    : allPlans

  return (
    <main className="flex flex-col flex-1 min-h-0">
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

      <TableCard
        className="flex-1 min-h-0"
        title="Plans"
        subtitle={filtered.length > 0 ? `${filtered.length} ${filtered.length === 1 ? 'plan' : 'plans'}` : undefined}
        toolbar={
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
          />
        }
      >
        <div className="divide-y divide-[var(--color-tables-table-cell-stroke)]">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="h-4 skeleton-shimmer rounded mb-2" />
                  <div className="h-3 skeleton-shimmer rounded w-2/3" />
                </div>
              ))
            : filtered.length === 0
            ? (
              <div className="text-center py-10 text-[var(--color-fonts-font-color-support)] text-sm">
                {statusFilter
                  ? `No ${statusFilter.toLowerCase()} plans found.`
                  : showArchived
                  ? 'No archived plans found.'
                  : 'No plans yet. Create your first plan!'}
              </div>
            )
            : filtered.map((plan) => (
                <div key={plan.planId} className="px-3 py-2.5 hover:bg-[var(--color-tables-table-hover)] transition-colors">
                  <PlanCard
                    plan={plan}
                    onApprove={(id) => approveMutation.mutate(id)}
                    onExecute={(id) => executeMutation.mutate(id)}
                    onArchive={(id) => archiveMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    approvePending={approveMutation.isPending}
                    executePending={executeMutation.isPending}
                  />
                </div>
              ))}
        </div>
      </TableCard>
    </main>
  )
}
