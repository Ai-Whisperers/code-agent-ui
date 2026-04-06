import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, CheckCircle, Play, RefreshCw, ExternalLink, XCircle,
  FileText, AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
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
    if (success) qc.invalidateQueries({ queryKey: ['plan', planId] })
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

  // Derive header action buttons
  const headerActions = plan?.status === 'DRAFT' ? (
    <Button
      variant="success"
      size="md"
      icon={<CheckCircle size={14} />}
      loading={approveMutation.isPending}
      onClick={() => approveMutation.mutate()}
    >
      Approve
    </Button>
  ) : plan?.status === 'APPROVED' ? (
    <Button
      variant="primary"
      size="md"
      icon={<Play size={14} />}
      loading={executeMutation.isPending}
      onClick={() => executeMutation.mutate()}
    >
      Execute Plan
    </Button>
  ) : plan?.status === 'COMPLETED' && plan?.prUrl ? (
    <div className="flex items-center gap-2">
      <Button
        variant="success"
        size="md"
        icon={<CheckCircle size={14} />}
        loading={approvePrMutation.isPending}
        onClick={() => approvePrMutation.mutate()}
      >
        Approve & Merge PR
      </Button>
      <Button
        variant="danger"
        size="md"
        icon={<XCircle size={14} />}
        loading={rejectPrMutation.isPending}
        onClick={() => rejectPrMutation.mutate()}
      >
        Reject PR
      </Button>
    </div>
  ) : undefined

  const hasPhases = (plan?.planData?.phases?.length ?? 0) > 0
  const totalSteps = plan?.planData?.phases?.reduce((t, p) => t + (p.steps?.length ?? 0), 0) ?? 0

  return (
    <main>
      {/* Back navigation */}
      <div className="mb-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate({ to: '/plans' })}
        >
          Back to Plans
        </Button>
      </div>

      <PageHeader
        title={plan?.title ?? (isLoading ? 'Loading…' : 'Plan')}
        actions={headerActions}
      />

      {isLoading ? (
        <div className="space-y-3 mt-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      ) : plan ? (
        <div className="space-y-4 mt-1">
          {/* Error banner */}
          {plan.errorMessage && (
            <div className="flex items-start gap-3 p-3 rounded-[var(--border-radius-card)] bg-[var(--color-status-critical-background)] border border-[var(--color-status-border-critical)]">
              <AlertTriangle size={16} className="text-[var(--color-tags-font-critical)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-tags-font-critical)] mb-0.5">Execution error</p>
                <p className="text-xs text-[var(--color-tags-font-critical)] font-mono whitespace-pre-wrap">
                  {plan.errorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Meta card */}
          <TableCard
            title="Details"
            maxHeight="auto"
          >
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
              <MetaItem label="Status" value={<PlanStatusBadge status={plan.status} />} />
              {plan.createdBy && <MetaItem label="Author" value={plan.createdBy} />}
              {plan.sourceRef && <MetaItem label="Source Ref" value={<code className="font-mono text-xs">{plan.sourceRef}</code>} />}
              {plan.repoUrl && (
                <MetaItem
                  label="Repository"
                  value={
                    <span className="truncate block" title={plan.repoUrl}>
                      {plan.repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
                    </span>
                  }
                />
              )}
              {plan.targetBranch && <MetaItem label="Target Branch" value={<code className="font-mono text-xs">{plan.targetBranch}</code>} />}
              <MetaItem label="Created" value={new Date(plan.createdAt).toLocaleString()} />
              {plan.approvedAt && (
                <MetaItem label="Approved" value={new Date(plan.approvedAt).toLocaleString()} />
              )}
              {hasPhases && <MetaItem label="Phases" value={plan.planData!.phases!.length} />}
              {hasPhases && <MetaItem label="Steps" value={totalSteps} />}
            </div>
            {plan.summary && (
              <div className="px-4 pb-3 pt-0 border-t border-[var(--color-cards-card-stroke)]">
                <p className="text-sm text-[var(--color-fonts-font-color-primary)] pt-3 whitespace-pre-wrap">
                  {plan.summary}
                </p>
              </div>
            )}
          </TableCard>

          {/* PR link */}
          {plan.prUrl && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--border-radius-card)] bg-[var(--color-status-neutral-background)] border border-[var(--color-status-border-neutral)]">
              <ExternalLink size={14} className="shrink-0 text-[var(--color-fonts-font-color-brand)]" />
              <a
                href={plan.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--color-fonts-font-color-brand)] hover:underline"
              >
                View Pull Request
              </a>
            </div>
          )}

          {/* PAUSED: markdown editor */}
          {plan.status === 'PAUSED' && (
            <div className="rounded-[var(--border-radius-card)] border border-[var(--color-tags-attention-background)] bg-[var(--color-cards-card-background)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-tags-attention-background)] bg-[var(--color-cards-small-section-background)] rounded-t-[var(--border-radius-card)]">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-[var(--color-tags-font-attention)]" />
                  <span className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                    Edit Plan Checklist
                  </span>
                  <span className="text-xs text-[var(--color-tags-font-attention)] bg-[var(--color-tags-attention-background)] px-1.5 py-0.5 rounded">
                    Paused
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={replanMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                  loading={replanMutation.isPending}
                  onClick={() => replanMutation.mutate()}
                >
                  {replanMutation.isPending ? 'Replanning…' : 'Save & Replan'}
                </Button>
              </div>
              <div className="p-4">
                <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-2">
                  Edit the checklist below. Click "Save & Replan" to regenerate the execution steps and transition to APPROVED.
                </p>
                <textarea
                  value={markdownDraft ?? ''}
                  onChange={(e) => setMarkdownDraft(e.target.value)}
                  onBlur={() => {
                    if (markdownDraft !== null) saveMarkdownMutation.mutate(markdownDraft)
                  }}
                  rows={12}
                  className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm font-mono text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-y"
                />
                {replanMutation.isError && (
                  <p className="text-xs text-[var(--color-status-border-critical)] mt-1.5 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Replan failed — ensure the checklist has at least one item (<code>- [ ] …</code>).
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Phases + controls layout */}
          {hasPhases ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Timeline — takes 2/3 */}
              <TableCard
                title="Execution Timeline"
                maxHeight="auto"
                className="lg:col-span-2"
                toolbar={
                  isLiveUpdating ? (
                    <span className="flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-brand)]">
                      <RefreshCw size={10} className="animate-spin" />
                      Live
                    </span>
                  ) : undefined
                }
              >
                <div className="p-4">
                  <ProgressTimeline plan={plan} isLive={isLiveUpdating} />
                </div>
              </TableCard>

              {/* Sidebar — 1/3 */}
              <div className="space-y-4">
                {(plan.status === 'EXECUTING' || plan.status === 'PAUSED') && (
                  <TableCard title="Controls" maxHeight="auto">
                    <div className="p-4">
                      <ExecutionControls
                        planId={planId}
                        status={plan.status}
                        onAction={handleExecutionAction}
                      />
                    </div>
                  </TableCard>
                )}

                {plan.status === 'EXECUTING' && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)] px-1">
                    <RefreshCw size={11} className="animate-spin" />
                    Auto-refreshing every 5 s…
                  </div>
                )}
              </div>
            </div>
          ) : plan.markdownContent && plan.status !== 'PAUSED' ? (
            /* Markdown-only view (pre-structured plan) */
            <TableCard title="Plan Checklist" maxHeight="auto">
              <pre className="px-4 py-3 text-sm text-[var(--color-fonts-font-color-primary)] whitespace-pre-wrap font-mono overflow-x-auto">
                {plan.markdownContent}
              </pre>
            </TableCard>
          ) : plan.status !== 'PAUSED' ? (
            /* Controls when no phases yet */
            <TableCard title="Controls" maxHeight="auto">
              <div className="p-4">
                <ExecutionControls
                  planId={planId}
                  status={plan.status}
                  onAction={handleExecutionAction}
                />
              </div>
            </TableCard>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-fonts-font-color-support)] mt-4">Plan not found.</p>
      )}
    </main>
  )
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-0.5">
        {label}
      </p>
      <div className="text-sm font-medium text-[var(--color-fonts-font-color-primary)] truncate">
        {value}
      </div>
    </div>
  )
}
