import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Play, CheckCircle, RefreshCw, Archive, Trash2 } from 'lucide-react'
import type { ExecutionPlan } from '@/types/api'
import { PlanStatusBadge } from './PlanStatusBadge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'

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

  return (
    <>
      <div className="flex items-start gap-3 min-w-0">
        {/* Left: status + title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <PlanStatusBadge status={plan.status} />
            {plan.sourceRef && (
              <span className="text-xs text-[var(--color-fonts-font-color-support)] shrink-0 font-mono">
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
              <RefreshCw size={13} className="animate-spin text-[var(--color-fonts-font-color-brand)] shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-fonts-font-color-support)]">
            {plan.createdBy && <span>{plan.createdBy}</span>}
            {plan.repoUrl && (
              <span className="truncate max-w-[200px]" title={plan.repoUrl}>
                {plan.repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
              </span>
            )}
            <span className="shrink-0">{new Date(plan.createdAt).toLocaleString()}</span>
            {plan.summary && (
              <span className="truncate max-w-[260px] hidden md:inline">{plan.summary}</span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          {plan.status === 'DRAFT' && (
            <Button
              variant="success"
              size="xs"
              icon={<CheckCircle size={12} />}
              loading={approvePending}
              onClick={() => onApprove(plan.planId)}
            >
              Approve
            </Button>
          )}
          {plan.status === 'APPROVED' && (
            <Button
              variant="primary"
              size="xs"
              icon={<Play size={12} />}
              loading={executePending}
              onClick={() => onExecute(plan.planId)}
            >
              Execute
            </Button>
          )}

          <Button
            variant="secondary"
            size="xs"
            onClick={() => navigate({ to: '/plans/$id', params: { id: plan.planId } })}
          >
            View
          </Button>

          {!isActive && !plan.archived && (
            <Tooltip text="Archive plan">
              <Button
                variant="ghost"
                size="xs"
                icon={<Archive size={13} />}
                onClick={() => setConfirmArchive(true)}
              />
            </Tooltip>
          )}
          {!isActive && (
            <Tooltip text="Delete plan">
              <Button
                variant="ghost"
                size="xs"
                icon={<Trash2 size={13} />}
                className="hover:!text-[var(--color-tags-font-critical)] hover:!bg-[var(--color-tags-critical-background)]"
                onClick={() => setConfirmDelete(true)}
              />
            </Tooltip>
          )}
        </div>
      </div>

      {confirmArchive && (
        <ConfirmDialog
          title="Archive plan?"
          confirmLabel="Archive"
          variant="default"
          icon={<Archive size={16} />}
          onConfirm={() => { onArchive(plan.planId); setConfirmArchive(false) }}
          onCancel={() => setConfirmArchive(false)}
        >
          The plan will be hidden from the default view. You can show archived plans using the toggle in the header.
        </ConfirmDialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete plan?"
          confirmLabel="Delete"
          variant="danger"
          icon={<Trash2 size={16} />}
          onConfirm={() => { onDelete(plan.planId); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        >
          This action is permanent and cannot be undone.
        </ConfirmDialog>
      )}
    </>
  )
}
