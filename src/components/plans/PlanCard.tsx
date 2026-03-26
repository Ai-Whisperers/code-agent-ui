import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Play, CheckCircle, RefreshCw, Archive, Trash2, AlertTriangle } from 'lucide-react'
import type { ExecutionPlan } from '@/types/api'
import { PlanStatusBadge } from './PlanStatusBadge'

interface PlanCardProps {
  plan: ExecutionPlan
  onApprove: (planId: string) => void
  onExecute: (planId: string) => void
  onArchive: (planId: string) => void
  onDelete: (planId: string) => void
  approvePending?: boolean
  executePending?: boolean
}

export function PlanCard({
  plan,
  onApprove,
  onExecute,
  onArchive,
  onDelete,
  approvePending,
  executePending,
}: PlanCardProps) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const isActive = plan.status === 'EXECUTING' || plan.status === 'PAUSED'
  const canArchive = !isActive
  const canDelete = !isActive

  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-4 py-3 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      {/* Header row */}
      <div className="flex items-center gap-2 min-w-0">
        <PlanStatusBadge status={plan.status} />
        {plan.sourceRef && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0">
            {plan.sourceRef}
          </span>
        )}
        <button
          className="text-sm font-medium text-[var(--color-fonts-font-color-primary)] hover:text-[var(--color-fonts-font-color-brand)] truncate text-left flex-1 transition-colors"
          onClick={() => navigate({ to: '/plans/$id', params: { id: plan.planId } })}
        >
          {plan.title}
        </button>
        {plan.status === 'EXECUTING' && (
          <RefreshCw size={14} className="animate-spin text-[var(--color-fonts-font-color-brand)] shrink-0" />
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--color-fonts-font-color-support)]">
        {plan.createdBy && <span>{plan.createdBy}</span>}
        {plan.repoUrl && (
          <span className="truncate max-w-[200px]" title={plan.repoUrl}>
            {plan.repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
          </span>
        )}
        <span className="shrink-0">{new Date(plan.createdAt).toLocaleString()}</span>
      </div>

      {plan.summary && (
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5 line-clamp-1">
          {plan.summary}
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-1.5 mt-2.5">
        {plan.status === 'DRAFT' && (
          <button
            onClick={() => onApprove(plan.planId)}
            disabled={approvePending}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] text-xs font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            <CheckCircle size={11} />
            Approve
          </button>
        )}
        {plan.status === 'APPROVED' && (
          <button
            onClick={() => onExecute(plan.planId)}
            disabled={executePending}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
          >
            <Play size={11} />
            Execute
          </button>
        )}

        <button
          onClick={() => navigate({ to: '/plans/$id', params: { id: plan.planId } })}
          className="px-2.5 py-1 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
        >
          View
        </button>

        <div className="ml-auto flex items-center gap-1">
          {canArchive && !plan.archived && (
            confirmArchive ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">Archive?</span>
                <button
                  onClick={() => { onArchive(plan.planId); setConfirmArchive(false) }}
                  className="px-2 py-0.5 text-xs rounded bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)] hover:opacity-80 transition-opacity"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmArchive(false)}
                  className="px-2 py-0.5 text-xs rounded bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-support)] hover:opacity-80 transition-opacity"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmArchive(true)}
                title="Archive"
                className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-filters-filter-background)] transition-colors"
              >
                <Archive size={13} />
              </button>
            )
          )}
          {canDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <AlertTriangle size={12} className="text-[var(--color-tags-font-critical)]" />
                <button
                  onClick={() => { onDelete(plan.planId); setConfirmDelete(false) }}
                  className="px-2 py-0.5 text-xs rounded bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] hover:opacity-80 transition-opacity"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 text-xs rounded bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-support)] hover:opacity-80 transition-opacity"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete"
                className="p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-status-border-critical)] hover:bg-[var(--color-status-critical-background)] transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
