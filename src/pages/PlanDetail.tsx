import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle, Play, RefreshCw, ExternalLink, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import ProgressTimeline from '@/components/plans/ProgressTimeline'
import ExecutionControls from '@/components/plans/ExecutionControls'
import api from '@/lib/api'
import type { ExecutionPlan } from '@/types/api'

interface PlanDetailProps {
  planId: string
}

export default function PlanDetail({ planId }: PlanDetailProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [isLiveUpdating, setIsLiveUpdating] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

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

  // Handle execution control actions
  const handleExecutionAction = (_action: 'pause' | 'resume' | 'cancel', success: boolean) => {
    if (success) {
      // Invalidate queries to refresh plan status
      qc.invalidateQueries({ queryKey: ['plan', planId] })
    }
  }

  // SSE connection for real-time updates
  useEffect(() => {
    const isExecuting = plan?.status === 'RUNNING' || plan?.status === 'EXECUTING'
    
    if (!plan || !isExecuting) {
      // Clean up existing connection if plan is not executing
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    // Only create SSE connection for executing plans
    if (!eventSourceRef.current) {
      const eventSource = new EventSource(`/api/plans/${planId}/events`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('SSE connection opened for plan:', planId)
        setIsLiveUpdating(true)
      }

      eventSource.onmessage = (event) => {
        try {
          const progressEvent = JSON.parse(event.data)
          console.log('Plan progress event:', progressEvent)
          
          // Invalidate queries to refresh the plan data
          qc.invalidateQueries({ queryKey: ['plan', planId] })
        } catch (error) {
          console.error('Failed to parse SSE event:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        eventSource.close()
        eventSourceRef.current = null
        setIsLiveUpdating(false)
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [plan, planId, qc])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsLiveUpdating(false)
    }
  }, [])

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

          {/* Markdown content — shown when no structured phases exist */}
          {(!plan.planData?.phases || plan.planData.phases.length === 0) && plan.markdownContent && (
            <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
              <div className="px-5 py-3 bg-[var(--color-cards-small-section-background)] border-b border-[var(--color-cards-card-stroke)]">
                <h3>Plan</h3>
              </div>
              <pre className="px-5 py-4 text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap font-mono overflow-x-auto">
                {plan.markdownContent}
              </pre>
            </div>
          )}

          {/* Enhanced Progress Timeline */}
          {plan.planData?.phases && plan.planData.phases.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-6 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
                  <ProgressTimeline plan={plan} isLive={isLiveUpdating} />
                </div>
              </div>
              <div className="lg:col-span-1 space-y-4">
                {/* Execution Controls */}
                <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
                  <ExecutionControls 
                    planId={planId} 
                    status={plan.status} 
                    onAction={handleExecutionAction}
                  />
                </div>
                
                {/* Plan Status Info */}
                <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
                  <h4 className="text-sm font-medium text-[var(--color-fonts-font-color-primary)] mb-3">
                    Status Information
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-fonts-font-color-support)]">Current Status:</span>
                      <span className={`font-medium ${
                        plan.status === 'COMPLETED' ? 'text-[var(--color-tags-font-success)]' :
                        plan.status === 'RUNNING' || plan.status === 'EXECUTING' ? 'text-[var(--color-buttons-button-primary)]' :
                        plan.status === 'FAILED' ? 'text-[var(--color-tags-font-critical)]' :
                        'text-[var(--color-fonts-font-color-support)]'
                      }`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-fonts-font-color-support)]">Total Phases:</span>
                      <span className="text-[var(--color-fonts-font-color-primary)]">
                        {plan.planData?.phases?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-fonts-font-color-support)]">Total Steps:</span>
                      <span className="text-[var(--color-fonts-font-color-primary)]">
                        {plan.planData?.phases?.reduce((total, phase) => total + (phase.steps?.length || 0), 0) || 0}
                      </span>
                    </div>
                    {isLiveUpdating && (
                      <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--color-cards-card-stroke)]">
                        <RefreshCw size={12} className="text-[var(--color-buttons-button-primary)] animate-spin" />
                        <span className="text-[var(--color-buttons-button-primary)]">
                          Live updates active
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fallback for plans without structured phases */
            <div className="space-y-4">
              <ExecutionControls 
                planId={planId} 
                status={plan.status} 
                onAction={handleExecutionAction}
              />
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
