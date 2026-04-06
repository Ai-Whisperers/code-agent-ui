import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import type { SlaStatus } from '@/types/api'

export function SlaBadge({ status, deadline }: { status: SlaStatus; deadline?: string }) {
  const map: Record<SlaStatus, { icon: React.ReactNode; label: string; cls: string }> = {
    ON_TRACK:       { icon: <CheckCircle2 size={12} />, label: 'On Track',   cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
    AT_RISK:        { icon: <AlertTriangle size={12} />, label: 'At Risk',    cls: 'bg-[var(--color-tags-warning-background)] text-[var(--color-tags-font-warning)]' },
    OVERDUE:        { icon: <XCircle size={12} />,      label: 'Overdue',    cls: 'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]' },
    MET:            { icon: <CheckCircle2 size={12} />, label: 'SLA Met',    cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
    MISSED:         { icon: <XCircle size={12} />,      label: 'SLA Missed', cls: 'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]' },
    NOT_APPLICABLE: { icon: <Clock size={12} />,        label: 'N/A',        cls: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
  }
  const entry = map[status] ?? map.NOT_APPLICABLE
  const deadlineStr = deadline ? new Date(deadline).toLocaleDateString() : null
  return (
    <Tooltip text={deadlineStr ? `Deadline: ${deadlineStr}` : 'No SLA configured'}>
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${entry.cls}`}>
        {entry.icon}
        {entry.label}
      </span>
    </Tooltip>
  )
}
