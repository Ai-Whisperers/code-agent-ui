import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle, Play, RefreshCw, ExternalLink, XCircle, FileText } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import ProgressTimeline from '@/components/plans/ProgressTimeline'
import ExecutionControls from '@/components/plans/ExecutionControls'
import { PlanStatusBadge } from '@/components/plans/PlanStatusBadge'
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
  const [markdownDraft, setMarkdownDraft] = useState<string | null>(null)

  const { data: plan, isLoading } = useQuery<ExecutionPlan>({
    queryKey: ['plan', planId],
    queryFn: () => api.get(`/plans/${planId}`).then((r) => r.data),
    refetchInterval: (q) => {
      const status = q.state.data?.status
      return status === 'EXECUTING' || status === 'PAUSED' ? 5_000 : false
    },
  })

  // Initialise markdown draft when plan loads or status changes to PAUSED
  useEffect(() => {
    if (plan?.status === 'PAUSED' && markdownDraft === null) {
      setMarkdownDraft(plan.markdownContent ?? '')
    }
    if (plan?.status !== 'PAUSED') {
      setMarkdownDraft(null)
    }
  }, [plan?.status, plan?.markdownContent, markdownDraft])

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

  const saveMarkdownMutation = useMutation({
    mutationFn: (content: string) =>
      api.patch(`/plans/${planId}/markdown`, { markdownContent: content }),
  })

  const replanMutation = useMutation({
    mutationFn: async () => {
      if (markdownDraft !== null) {
        await api.patch(`/plans/${planId}/markdown`, { markdownContent: markdownDraft })
      }
      return api.post(`/plans/${planId}/replan`).then((r) => r.data)
    },
    onSuccess: () => {
      setMarkdownDraft(null)
      qc.invalidateQueries({ queryKey: ['plan', planId] })
    },
  })

  const handleExecutionAction = (_action: 'pause' | 'resume' | 'cancel', success: boolean) => {
    if (success) {
      qc.invalidateQueries({ queryKey: ['plan', planId] })
    }
  }

  // SSE for real-time updates while EXECUTING
  useEffect(() => {
    const isExecuting = plan?.status === 'EXECUTING'

    if (!plan || !isExecuting) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsLiveUpdating(false)
      }
      return
    }

    if (!eventSourceRef.current) {
      const es = new EventSource(`/api/plans/${planId}/events`)
      eventSourceRef.current = es
      es.onopen = () => setIsLiveUpdating(true)
      es.onmessage = () => qc.invalidateQueries({ queryKey: ['plan', planId] })
      es.onerror = () => {
        es.close()
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
        <div className="space-y-4">
          {/* Meta */}
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Detail label="Status" value={<PlanStatusBadge status={plan.status} />} />
              {plan.createdBy && <Detail label="Author" value={plan.createdBy} />}
              {plan.sourceRef && <Detail label="Source" value={plan.sourceRef} />}
              {plan.repoUrl && (
                <Detail
                  label="Repository"
                  value={
                    <span className="truncate block max-w-[180px]" title={plan.repoUrl}>
                      {plan.repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
                    </span>
                  }
                />
              )}
              {plan.targetBranch && <Detail label="Target Branch" value={plan.targetBranch} />}
              <Detail label="Created" value={new Date(plan.createdAt).toLocaleString()} />
              {plan.approvedAt && (
                <Detail label="Approved" value={new Date(plan.approvedAt).toLocaleString()} />
              )}
            </div>
            {plan.summary && (
              <div className="mt-3 pt-3 border-t border-[var(--color-cards-card-stroke)]">
                <p className="text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap">
                  {plan.summary}
                </p>
              </div>
            )}
          </div>

          {/* PR link */}
          {plan.prUrl && (
            <div className="bg-[var(--color-status-neutral-background)] border border-[var(--color-status-border-neutral)] rounded-[var(--border-radius-card)] p-3">
              <a
                href={plan.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-fonts-font-color-brand)] hover:underline"
              >
                <ExternalLink size={14} />
                View Pull Request
              </a>
            </div>
          )}

          {/* PAUSED: markdown editor + replan */}
          {plan.status === 'PAUSED' && (
            <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-tags-attention-background)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-[var(--color-tags-font-attention)]" />
                  <h3 className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                    Edit Plan (Paused)
                  </h3>
                </div>
                <button
                  onClick={() => replanMutation.mutate()}
                  disabled={replanMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
                >
                  {replanMutation.isPending ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  {replanMutation.isPending ? 'Replanning…' : 'Save & Replan'}
                </button>
              </div>
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-2">
                Edit the plan checklist below. Click "Save & Replan" to regenerate the execution steps and transition to APPROVED.
              </p>
              <textarea
                value={markdownDraft ?? ''}
                onChange={(e) => setMarkdownDraft(e.target.value)}
                onBlur={() => {
                  if (markdownDraft !== null) {
                    saveMarkdownMutation.mutate(markdownDraft)
                  }
                }}
                rows={12}
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm font-mono text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-y"
              />
              {replanMutation.isError && (
                <p className="text-xs text-[var(--color-status-border-critical)] mt-1">
                  Replan failed — check that your markdown has at least one checklist item (<code>- [ ] …</code>).
                </p>
              )}
            </div>
          )}

          {/* Progress / controls */}
          {plan.planData?.phases && plan.planData.phases.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
                <ProgressTimeline plan={plan} isLive={isLiveUpdating} />
              </div>
              <div className="lg:col-span-1 space-y-3">
                <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
                  <ExecutionControls
                    planId={planId}
                    status={plan.status}
                    onAction={handleExecutionAction}
                  />
                </div>
                <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
                  <h4 className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide mb-2">
                    Stats
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-fonts-font-color-support)]">Phases</span>
                      <span>{plan.planData?.phases?.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--color-fonts-font-color-support)]">Steps</span>
                      <span>
                        {plan.planData?.phases?.reduce(
                          (t, p) => t + (p.steps?.length ?? 0), 0,
                        ) ?? 0}
                      </span>
                    </div>
                    {isLiveUpdating && (
                      <div className="flex items-center gap-1 pt-1.5 border-t border-[var(--color-cards-card-stroke)]">
                        <RefreshCw size={10} className="animate-spin text-[var(--color-buttons-button-primary)]" />
                        <span className="text-[var(--color-buttons-button-primary)]">Live</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : plan.markdownContent && plan.status !== 'PAUSED' ? (
            <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
              <div className="px-4 py-2.5 bg-[var(--color-cards-small-section-background)] border-b border-[var(--color-cards-card-stroke)]">
                <h3 className="text-sm font-medium">Plan</h3>
              </div>
              <pre className="px-4 py-3 text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap font-mono overflow-x-auto">
                {plan.markdownContent}
              </pre>
            </div>
          ) : plan.status !== 'PAUSED' ? (
            <div className="space-y-3">
              <ExecutionControls
                planId={planId}
                status={plan.status}
                onAction={handleExecutionAction}
              />
            </div>
          ) : null}

          {plan.status === 'EXECUTING' && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] flex items-center gap-1.5">
              <RefreshCw size={11} className="animate-spin" />
              Plan is executing — auto-refreshing…
            </p>
          )}

          {plan.errorMessage && (
            <div className="bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)] rounded-[var(--border-radius-card)] p-4">
              <h3 className="mb-2 text-sm font-medium text-[var(--color-tags-font-critical)]">Error</h3>
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
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-0.5">{label}</p>
      <div className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">{value}</div>
    </div>
  )
}
