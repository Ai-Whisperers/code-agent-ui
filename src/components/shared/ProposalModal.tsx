import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  CheckCircle2,
  XCircle,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import api from '@/lib/api'
import type { ScopeProposal } from '@/types/api'

type Props =
  | { variant: 'scope'; scopeId: string; roadmapId?: never; proposal: ScopeProposal; onClose: () => void }
  | { variant: 'roadmap'; roadmapId: string; scopeId?: never; proposal: ScopeProposal; onClose: () => void }

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ACCEPTED: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
  REJECTED: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
}

const TYPE_COLORS: Record<string, string> = {
  EPIC:      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  FEATURE:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  USERSTORY: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
}

const TYPE_LABEL: Record<string, string> = {
  EPIC: 'Epic', FEATURE: 'Feature', USERSTORY: 'Story',
}

export function ProposalModal(props: Props) {
  const { variant, onClose } = props
  const entityId = variant === 'scope' ? props.scopeId : props.roadmapId
  const basePath = variant === 'scope' ? `/scope/${entityId}` : `/roadmap/${entityId}`
  const treeQueryKey = variant === 'scope' ? ['scope-tree', entityId] : ['roadmap-tree', entityId]
  const proposalsQueryKey = variant === 'scope'
    ? ['scope-proposals', entityId, props.proposal.issueKey]
    : ['roadmap-proposals', entityId, props.proposal.issueKey]

  const qc = useQueryClient()

  const [proposal, setProposal] = useState(props.proposal)
  const [summary, setSummary]         = useState(proposal.proposedSummary ?? '')
  const [description, setDescription] = useState(proposal.proposedDescription ?? '')
  const [criteria, setCriteria]       = useState(proposal.proposedCriteria ?? '')
  const [technical, setTechnical]     = useState(proposal.proposedTechnical ?? '')
  const [explanationOpen, setExplanationOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const originalRef = useRef({ summary, description, criteria, technical })

  function markDirty() { setIsDirty(true) }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDirty && !confirm('You have unsaved changes. Close anyway?')) return
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isDirty, onClose])

  const saveMutation = useMutation({
    mutationFn: () => api.put(`${basePath}/proposals/${proposal.id}`, {
      proposedSummary: summary,
      proposedDescription: description,
      proposedCriteria: criteria,
      proposedTechnical: technical,
    }),
    onSuccess: (res) => {
      setProposal(res.data)
      originalRef.current = { summary, description, criteria, technical }
      setIsDirty(false)
    },
  })

  const acceptMutation = useMutation({
    mutationFn: () => api.post(`${basePath}/proposals/${proposal.id}/accept`),
    onSuccess: (res) => {
      setProposal(res.data)
      setIsDirty(false)
      qc.invalidateQueries({ queryKey: treeQueryKey })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`${basePath}/proposals/${proposal.id}/reject`),
    onSuccess: (res) => {
      setProposal(res.data)
      setIsDirty(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`${basePath}/proposals/${proposal.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalsQueryKey })
      onClose()
    },
  })

  const isBusy = saveMutation.isPending || acceptMutation.isPending
      || rejectMutation.isPending || deleteMutation.isPending

  const fieldClass = `w-full px-3 py-2 text-xs rounded-[var(--border-radius-input)] bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:ring-1 focus:ring-[var(--color-buttons-button-primary)] resize-none`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => {
          if (isDirty && !confirm('You have unsaved changes. Close anyway?')) return
          onClose()
        }}
      />

      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[var(--border-radius-card)] bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background-hover)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono font-semibold text-[var(--color-fonts-font-color-brand)]">
              {proposal.issueKey}
            </span>
            <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${TYPE_COLORS[proposal.issueType] ?? ''}`}>
              {TYPE_LABEL[proposal.issueType] ?? proposal.issueType}
            </span>
            <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${STATUS_COLORS[proposal.status] ?? ''}`}>
              {proposal.status}
            </span>
            {proposal.jiraResultKey && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-fonts-font-color-support)]">
                <ExternalLink size={10} />
                {proposal.jiraResultKey}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (isDirty && !confirm('You have unsaved changes. Close anyway?')) return
              onClose()
            }}
            className="shrink-0 p-1 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {(acceptMutation.isError || rejectMutation.isError || deleteMutation.isError) && (
            <div className="p-3 rounded-[var(--border-radius-card)] bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] text-xs">
              {(acceptMutation.error as Error)?.message
                ?? (rejectMutation.error as Error)?.message
                ?? (deleteMutation.error as Error)?.message
                ?? 'An error occurred'}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">
              Proposed Summary
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => { setSummary(e.target.value); markDirty() }}
              className={fieldClass}
              placeholder="Improved summary…"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">
              Proposed Description
            </label>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty() }}
              className={fieldClass}
              placeholder="Improved description…"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">
              Acceptance Criteria
            </label>
            <textarea
              rows={5}
              value={criteria}
              onChange={(e) => { setCriteria(e.target.value); markDirty() }}
              className={fieldClass}
              placeholder="Acceptance criteria…"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] mb-1">
              Technical Notes
            </label>
            <textarea
              rows={4}
              value={technical}
              onChange={(e) => { setTechnical(e.target.value); markDirty() }}
              className={fieldClass}
              placeholder="Technical constraints or notes…"
            />
          </div>

          {proposal.aiExplanation && (
            <div className="border border-[var(--color-borders-border-primary)] rounded-[var(--border-radius-card)] overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--color-fonts-font-color-support)] bg-[var(--color-cards-card-background-hover)] hover:bg-[var(--color-cards-card-background)] transition-colors"
                onClick={() => setExplanationOpen((v) => !v)}
              >
                AI Explanation
                {explanationOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {explanationOpen && (
                <p className="px-3 py-2.5 text-xs text-[var(--color-fonts-font-color-primary)] leading-relaxed">
                  {proposal.aiExplanation}
                </p>
              )}
            </div>
          )}

          <p className="text-[10px] text-[var(--color-fonts-font-color-support)]">
            Created {new Date(proposal.createdAt).toLocaleString()}
            {proposal.updatedAt !== proposal.createdAt && ` · Updated ${new Date(proposal.updatedAt).toLocaleString()}`}
          </p>
        </div>

        <div className="shrink-0 border-t border-[var(--color-borders-border-primary)] px-5 py-3 bg-[var(--color-cards-card-background-hover)] flex items-center gap-2">
          <button
            onClick={() => acceptMutation.mutate()}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 transition-colors"
          >
            {acceptMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {proposal.status === 'ACCEPTED' ? 'Re-accept' : 'Accept'}
          </button>

          <button
            onClick={() => rejectMutation.mutate()}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)] hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {rejectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            Reject
          </button>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={isBusy || !isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>

          <div className="flex-1" />

          <button
            onClick={() => {
              if (!confirm('Permanently delete this proposal?')) return
              deleteMutation.mutate()
            }}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--border-radius-button-small)] text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] disabled:opacity-50 transition-colors"
          >
            {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
