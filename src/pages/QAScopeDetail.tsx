import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  RefreshCw, Loader2, X, Save, Wand2, FileText, Eye, Pencil,
  FlaskConical, BookOpen, ShieldAlert, AlertTriangle,
  ChevronUp, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Search, Download,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb'
import { Tooltip } from '@/components/ui/Tooltip'
import { Toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Input } from '@/components/ui/Input'
import { IssueTypeIcon } from '@/components/ui/IssueTypeIcon'
import { JiraIssueLink } from '@/components/ui/JiraIssueLink'
import { MarkdownMessage } from '@/components/chat/MarkdownMessage'
import { TestPlanStatusBadge } from '@/components/shared/TestPlanStatusBadge'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import api from '@/lib/api'
import { mcpProfilesApi } from '@/lib/mcpProfiles'
import type { Scope, QaFeatureItem, ScopeTreeItem } from '@/types/api'

type ToastState = { message: string; variant: 'success' | 'error'; action?: { label: string; onClick: () => void } }
type SortCol = 'key' | 'summary' | 'jiraStatus' | 'testPlanStatus' | 'generatedAt'

const TERMINAL_JOB_STATUSES = ['SUCCESS', 'FAILED', 'CANCELLED']

const jobStorageKey = (scopeId: string, issueKey: string) => `qa-job:${scopeId}:${issueKey}`

const STATUS_ORDER: Record<string, number> = {
  none: 0, analysis: 1, stale: 2, json_ready: 3,
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diffD = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (diffD === 0) return 'today'
  if (diffD === 1) return 'yesterday'
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// ── KPI chip ──────────────────────────────────────────────────────────────────

function KpiChip({ icon: Icon, value, label, warn }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  value?: number | null
  label: string
  warn?: boolean
}) {
  if (value == null) return null
  const color = warn && value > 0
    ? 'text-[var(--color-tags-font-attention)]'
    : 'text-[var(--color-fonts-font-color-support)]'
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      <Icon size={11} className="shrink-0" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  )
}

// ── Sortable table header ─────────────────────────────────────────────────────

function SortableHeader({
  col, label, tooltip, currentCol, currentDir, onSort, className = '',
}: {
  col: SortCol
  label: string
  tooltip: string
  currentCol: SortCol
  currentDir: 'asc' | 'desc'
  onSort: (col: SortCol) => void
  className?: string
}) {
  const active = col === currentCol
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide
        text-[var(--color-fonts-font-color-support)] whitespace-nowrap select-none
        cursor-pointer hover:text-[var(--color-fonts-font-color-primary)] transition-colors ${className}`}
    >
      <Tooltip text={tooltip} position="bottom">
        <span className="inline-flex items-center gap-1">
          {label}
          {active
            ? (currentDir === 'asc'
              ? <ChevronUp size={10} className="text-[var(--color-buttons-button-primary)]" />
              : <ChevronDown size={10} className="text-[var(--color-buttons-button-primary)]" />)
            : <ChevronDown size={10} className="opacity-20" />}
        </span>
      </Tooltip>
    </th>
  )
}

// ── Resizable drawer shell ────────────────────────────────────────────────────

const DRAWER_WIDTH_KEY = 'qa-drawer-width'

function ResizableDrawer({
  onClose,
  children,
  defaultWidth = 768,
  minWidth = 360,
  maxWidth,
}: {
  onClose: () => void
  children: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
}) {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(DRAWER_WIDTH_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed)) return parsed
    }
    return defaultWidth
  })
  const widthRef = useRef(width)
  widthRef.current = width

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthRef.current

      const onMouseMove = (mv: MouseEvent) => {
        const maxW = maxWidth ?? window.innerWidth - 60
        const newWidth = Math.max(minWidth, Math.min(maxW, startWidth + (startX - mv.clientX)))
        setWidth(newWidth)
        localStorage.setItem(DRAWER_WIDTH_KEY, String(newWidth))
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [minWidth, maxWidth],
  )

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div
        style={{ width }}
        className="relative bg-[var(--color-cards-card-background)] border-l border-[var(--color-borders-border-primary)] flex flex-col shadow-xl"
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className="absolute left-0 inset-y-0 w-1.5 cursor-col-resize z-10 group hover:bg-[var(--color-buttons-button-primary)]/40 transition-colors"
          title="Drag to resize"
        />
        {children}
      </div>
    </div>
  )
}

// ── Analysis View Drawer (read-only) ─────────────────────────────────────────

function AnalysisViewDrawer({
  scopeId,
  feature,
  onClose,
  onEdit,
}: {
  scopeId: string
  feature: QaFeatureItem
  onClose: () => void
  onEdit: () => void
}) {
  const { data: plan, isLoading } = useQuery({
    queryKey: ['qa-test-plan', scopeId, feature.issueKey],
    queryFn: () =>
      api.get(`/qa-scope/${scopeId}/features/${feature.issueKey}/test-plan`).then((r) => r.data),
    staleTime: 0,
    enabled: feature.testPlanStatus !== 'none',
  })

  return (
    <ResizableDrawer onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-borders-border-primary)] shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              Analysis — {feature.issueKey}
            </h2>
            <TestPlanStatusBadge status={feature.testPlanStatus} analysisEdited={feature.analysisEdited} />
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] truncate mt-0.5">
            {feature.summary}
          </p>
        </div>
        <Tooltip text="Close">
          <button
            onClick={onClose}
            className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] shrink-0 ml-3"
          >
            <X size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Body — scrollable markdown content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 size={20} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
          </div>
        ) : !plan?.analysisText ? (
          <div className="flex items-center justify-center h-24 text-[var(--color-fonts-font-color-support)] text-sm">
            No analysis yet — use the <strong className="mx-1">Analyse</strong> button to generate one.
          </div>
        ) : (
          <MarkdownMessage content={plan.analysisText} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--color-borders-border-primary)] shrink-0">
        <Button variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>
        {plan?.analysisText && (
          <Tooltip text="Switch to the editor to modify the analysis text">
            <Button variant="secondary" size="md" icon={<Pencil size={13} />} onClick={onEdit}>
              Edit Analysis
            </Button>
          </Tooltip>
        )}
      </div>
    </ResizableDrawer>
  )
}

// ── Analysis Edit Drawer ──────────────────────────────────────────────────────

function AnalysisEditDrawer({
  scopeId,
  feature,
  onClose,
  onToast,
}: {
  scopeId: string
  feature: QaFeatureItem
  onClose: () => void
  onToast: (t: ToastState) => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [editText, setEditText] = useState<string | null>(null)

  const { data: plan, isLoading } = useQuery({
    queryKey: ['qa-test-plan', scopeId, feature.issueKey],
    queryFn: () => api.get(`/qa-scope/${scopeId}/features/${feature.issueKey}/test-plan`).then((r) => r.data),
    staleTime: 0,
  })

  const currentText = editText ?? plan?.analysisText ?? ''
  const isDirty = editText !== null && editText !== (plan?.analysisText ?? '')

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/qa-scope/${scopeId}/features/${feature.issueKey}/test-plan/analysis`, {
        analysisText: currentText,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qa-features', scopeId] })
      qc.invalidateQueries({ queryKey: ['qa-test-plan', scopeId, feature.issueKey] })
      setEditText(null)
      onToast({ message: 'Analysis saved.', variant: 'success' })
    },
    onError: () => onToast({ message: 'Failed to save analysis.', variant: 'error' }),
  })

  const generateJsonMutation = useMutation({
    mutationFn: () =>
      api.post(`/qa-scope/${scopeId}/features/${feature.issueKey}/test-plan/generate-json`),
    onSuccess: (res) => {
      const jobId = res.data?.jobId
      qc.invalidateQueries({ queryKey: ['qa-features', scopeId] })
      onToast({
        message: 'JSON conversion queued.',
        variant: 'success',
        action: jobId ? { label: 'View job', onClick: () => navigate({ to: '/jobs/$id', params: { id: jobId } }) } : undefined,
      })
      onClose()
    },
    onError: () => onToast({ message: 'JSON generation failed.', variant: 'error' }),
  })

  return (
    <ResizableDrawer onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-borders-border-primary)] shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
              Analysis — {feature.issueKey}
            </h2>
            {plan?.analysisEdited && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]">
                Edited
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] truncate mt-0.5">
            {feature.summary}
          </p>
        </div>
        <Tooltip text="Close drawer">
          <button onClick={onClose} className="text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] shrink-0 ml-3">
            <X size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col p-5 gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 size={20} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
          </div>
        ) : !plan?.analysisText ? (
          <div className="flex-1 flex items-center justify-center text-[var(--color-fonts-font-color-support)] text-sm">
            No analysis yet. Generate analysis first.
          </div>
        ) : (
          <RichTextEditor
            value={currentText}
            onChange={(md) => setEditText(md)}
            placeholder="Analysis text…"
            fill
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--color-borders-border-primary)] shrink-0">
        <Button variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Tooltip text="Save manual edits to the analysis text">
              <Button
                variant="secondary"
                size="md"
                loading={saveMutation.isPending}
                icon={<Save size={13} />}
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                Save
              </Button>
            </Tooltip>
          )}
          <Tooltip text="Convert analysis to structured JSON test plan (step 2)">
            <Button
              variant="primary"
              size="md"
              loading={generateJsonMutation.isPending}
              icon={<Wand2 size={13} />}
              onClick={() => generateJsonMutation.mutate()}
              disabled={generateJsonMutation.isPending || !plan?.analysisText}
            >
              Generate JSON
            </Button>
          </Tooltip>
        </div>
      </div>
    </ResizableDrawer>
  )
}

// ── Feature row ───────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
  scopeId,
  jiraBaseUrl,
  expanded,
  hasStories,
  onToggle,
  onViewAnalysis,
  onEditAnalysis,
  onToast,
}: {
  feature: QaFeatureItem
  scopeId: string
  jiraBaseUrl: string
  expanded: boolean
  hasStories: boolean
  onToggle: () => void
  onViewAnalysis: (f: QaFeatureItem) => void
  onEditAnalysis: (f: QaFeatureItem) => void
  onToast: (t: ToastState) => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeJobId, setActiveJobId] = useState<string | null>(
    () => localStorage.getItem(jobStorageKey(scopeId, feature.issueKey))
  )

  const setJob = useCallback((jobId: string | null) => {
    setActiveJobId(jobId)
    if (jobId) localStorage.setItem(jobStorageKey(scopeId, feature.issueKey), jobId)
    else localStorage.removeItem(jobStorageKey(scopeId, feature.issueKey))
  }, [scopeId, feature.issueKey])

  const { data: jobStatus } = useQuery<{ status: string }>({
    queryKey: ['job-status', activeJobId],
    queryFn: () => api.get(`/jobs/status/${activeJobId}`).then((r) => r.data),
    enabled: !!activeJobId,
    refetchInterval: (query) =>
      query.state.data?.status && TERMINAL_JOB_STATUSES.includes(query.state.data.status)
        ? false
        : query.state.data?.status === 'RUNNING' ? 5_000 : 3_000,
    staleTime: 0,
  })

  useEffect(() => {
    if (!jobStatus?.status || !TERMINAL_JOB_STATUSES.includes(jobStatus.status)) return
    setJob(null)
    qc.invalidateQueries({ queryKey: ['qa-features', scopeId] })
  }, [jobStatus?.status, qc, scopeId, setJob])

  const isJobActive = !!activeJobId

  const generateAnalysisMutation = useMutation({
    mutationFn: () =>
      api.post(`/qa-scope/${scopeId}/features/${feature.issueKey}/test-plan/generate-analysis`),
    onSuccess: (res) => {
      const jobId = res.data?.jobId
      if (jobId) setJob(jobId)
      onToast({
        message: `Analysis queued for ${feature.issueKey}.`,
        variant: 'success',
        action: jobId ? { label: 'View job', onClick: () => navigate({ to: '/jobs/$id', params: { id: jobId } }) } : undefined,
      })
    },
    onError: () => onToast({ message: `Analysis generation failed for ${feature.issueKey}.`, variant: 'error' }),
  })

  const generateJsonMutation = useMutation({
    mutationFn: () =>
      api.post(`/qa-scope/${scopeId}/features/${feature.issueKey}/test-plan/generate-json`),
    onSuccess: (res) => {
      const jobId = res.data?.jobId
      if (jobId) setJob(jobId)
      onToast({
        message: `JSON conversion queued for ${feature.issueKey}.`,
        variant: 'success',
        action: jobId ? { label: 'View job', onClick: () => navigate({ to: '/jobs/$id', params: { id: jobId } }) } : undefined,
      })
    },
    onError: () => onToast({ message: `JSON generation failed for ${feature.issueKey}.`, variant: 'error' }),
  })

  const isGenerating = generateAnalysisMutation.isPending || generateJsonMutation.isPending

  return (
    <tr
      className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] group cursor-pointer"
      onClick={() => onViewAnalysis(feature)}
    >
      {/* Issue key + type icon + expand toggle */}
      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          {hasStories ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle() }}
              className="shrink-0 p-0.5 rounded text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          ) : (
            <span className="w-[18px] shrink-0" />
          )}
          <IssueTypeIcon issueType="FEATURE" size={12} />
          <JiraIssueLink
            issueKey={feature.issueKey}
            jiraBaseUrl={jiraBaseUrl}
            className="font-mono text-xs font-semibold text-[var(--color-fonts-font-color-brand)]"
          />
        </div>
      </td>

      {/* Summary */}
      <td className="px-4 py-3">
        <p className="text-sm text-[var(--color-fonts-font-color-primary)] line-clamp-2">{feature.summary}</p>
        {(feature.kpiBehaviourTcCount != null || feature.kpiCapabilityTcCount != null) && (
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <KpiChip icon={BookOpen} value={feature.childStoryCount} label="stories" />
            <KpiChip icon={FlaskConical} value={feature.kpiBehaviourTcCount} label="behaviour TCs" />
            <KpiChip icon={FlaskConical} value={feature.kpiCapabilityTcCount} label="capability TCs" />
            <KpiChip icon={ShieldAlert} value={feature.kpiRiskCount} label="risks" />
            <KpiChip icon={AlertTriangle} value={feature.kpiOpenClarifications} label="open clarifications" warn />
          </div>
        )}
      </td>

      {/* Jira status */}
      <td className="px-4 py-3 whitespace-nowrap">
        {feature.jiraStatus ? (
          <span className="inline-flex items-center text-xs font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
            {feature.jiraStatus}
          </span>
        ) : (
          <span className="text-[var(--color-fonts-font-color-support)]">—</span>
        )}
      </td>

      {/* Test plan status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <TestPlanStatusBadge status={feature.testPlanStatus} analysisEdited={feature.analysisEdited} />
      </td>

      {/* Jira test plan link */}
      <td className="px-4 py-3 whitespace-nowrap">
        {feature.jiraIssueKey ? (
          <JiraIssueLink
            issueKey={feature.jiraIssueKey}
            jiraBaseUrl={jiraBaseUrl}
            className="font-mono text-xs font-semibold text-[var(--color-fonts-font-color-brand)]"
          />
        ) : (
          <span className="text-[var(--color-fonts-font-color-support)]">—</span>
        )}
      </td>

      {/* Last generated */}
      <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--color-fonts-font-color-support)]">
        {fmtDate(feature.generatedAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        {isJobActive ? (
          <button
            onClick={() => navigate({ to: '/jobs/$id', params: { id: activeJobId! } })}
            className="flex items-center gap-1.5 text-xs text-[var(--color-tags-font-attention)] hover:underline"
          >
            <Loader2 size={11} className="animate-spin shrink-0" />
            <span>Job #{activeJobId!.slice(0, 8)} · {jobStatus?.status ? jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1).toLowerCase() : 'Starting…'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip text="Queue an AI analysis job (step 1)" position="left">
              <Button
                variant="secondary"
                size="sm"
                loading={generateAnalysisMutation.isPending}
                icon={<Wand2 size={12} />}
                onClick={() => generateAnalysisMutation.mutate()}
                disabled={isGenerating}
              >
                Analyse
              </Button>
            </Tooltip>

            {(feature.testPlanStatus === 'analysis' || feature.testPlanStatus === 'json_ready' || feature.testPlanStatus === 'stale') && (
              <Tooltip text="View and manually edit the AI analysis before converting to JSON" position="left">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Pencil size={12} />}
                  onClick={() => onEditAnalysis(feature)}
                >
                  Edit
                </Button>
              </Tooltip>
            )}

            {(feature.testPlanStatus === 'analysis' || feature.testPlanStatus === 'stale') && (
              <Tooltip text="Queue a JSON conversion job (step 2)" position="left">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={generateJsonMutation.isPending}
                  icon={<FileText size={12} />}
                  onClick={() => generateJsonMutation.mutate()}
                  disabled={isGenerating}
                >
                  Convert
                </Button>
              </Tooltip>
            )}

            {feature.testPlanStatus === 'json_ready' && (
              <Tooltip text="Open the full structured test plan" position="left">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Eye size={12} />}
                  onClick={() => navigate({ to: `/qa/scope/${scopeId}/test-plan/${feature.issueKey}` })}
                >
                  View Plan
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── User story row (child of feature in tree) ─────────────────────────────────

function UserStoryRow({ story, jiraBaseUrl }: { story: ScopeTreeItem; jiraBaseUrl: string }) {
  return (
    <tr className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] bg-[var(--color-page-background)]">
      {/* Indented issue key with type icon + Jira link */}
      <td className="px-4 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 pl-7">
          <IssueTypeIcon issueType="USERSTORY" size={12} />
          <JiraIssueLink
            issueKey={story.issueKey}
            jiraBaseUrl={jiraBaseUrl}
            className="font-mono text-xs text-[var(--color-fonts-font-color-brand)]"
          />
        </div>
      </td>

      {/* Summary */}
      <td className="px-4 py-2">
        <p className="text-xs text-[var(--color-fonts-font-color-support)] line-clamp-1">{story.summary}</p>
      </td>

      {/* Jira status */}
      <td className="px-4 py-2 whitespace-nowrap">
        {story.jiraStatus ? (
          <span className="inline-flex items-center text-xs font-medium px-1.5 py-0 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
            {story.jiraStatus}
          </span>
        ) : (
          <span className="text-[var(--color-fonts-font-color-support)]">—</span>
        )}
      </td>

      {/* Test plan, Jira TP, last generated, actions — not applicable for stories */}
      <td className="px-4 py-2" />
      <td className="px-4 py-2" />
      <td className="px-4 py-2" />
      <td className="px-4 py-2" />
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface QAScopeDetailProps {
  scopeId: string
}

export default function QAScopeDetail({ scopeId }: QAScopeDetailProps) {
  const qc = useQueryClient()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [viewDrawerFeature, setViewDrawerFeature] = useState<QaFeatureItem | null>(null)
  const [analysisDrawerFeature, setAnalysisDrawerFeature] = useState<QaFeatureItem | null>(null)

  // ── Sort & filter state ───────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('key')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // ── Tree expand state ─────────────────────────────────────────────────────
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const { data: scope } = useQuery<Scope>({
    queryKey: ['scope', scopeId],
    queryFn: () => api.get(`/scope/${scopeId}`).then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: features = [], isLoading } = useQuery<QaFeatureItem[]>({
    queryKey: ['qa-features', scopeId],
    queryFn: () => api.get(`/qa-scope/${scopeId}/features`).then((r) => r.data),
    refetchInterval: 10_000,
  })

  const { data: systemConfig } = useQuery({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 5 * 60_000,
  })
  const jiraBaseUrl = systemConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  const { data: treeItems = [] } = useQuery<ScopeTreeItem[]>({
    queryKey: ['scope-tree', scopeId],
    queryFn: () => api.get(`/scope/${scopeId}/evaluation/tree`).then((r) => r.data).catch(() => []),
    staleTime: 30_000,
  })

  // Map each feature key → its user story items (for tree expand/collapse)
  const storyMap = useMemo(() => {
    const map = new Map<string, ScopeTreeItem[]>()
    treeItems.filter((i) => i.issueType === 'USERSTORY').forEach((story) => {
      if (story.parentKey) {
        if (!map.has(story.parentKey)) map.set(story.parentKey, [])
        map.get(story.parentKey)!.push(story)
      }
    })
    return map
  }, [treeItems])


  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/scope/${scopeId}/sync`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qa-features', scopeId] })
      qc.invalidateQueries({ queryKey: ['scope-tree', scopeId] })
      setToast({ message: 'Sync started.', variant: 'success' })
    },
    onError: () => setToast({ message: 'Sync failed.', variant: 'error' }),
  })

  // ── Sorting ───────────────────────────────────────────────────────────────

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  // ── Derived lists ─────────────────────────────────────────────────────────

  const filteredSorted = useMemo(() => {
    let list = [...features]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (f) => f.issueKey.toLowerCase().includes(q) || (f.summary ?? '').toLowerCase().includes(q),
      )
    }
    if (statusFilter) {
      list = list.filter((f) => f.testPlanStatus === statusFilter)
    }
    list.sort((a, b) => {
      if (sortCol === 'testPlanStatus') {
        const aO = STATUS_ORDER[a.testPlanStatus ?? ''] ?? 99
        const bO = STATUS_ORDER[b.testPlanStatus ?? ''] ?? 99
        return sortDir === 'asc' ? aO - bO : bO - aO
      }
      if (sortCol === 'generatedAt') {
        const aT = a.generatedAt ? new Date(a.generatedAt).getTime() : 0
        const bT = b.generatedAt ? new Date(b.generatedAt).getTime() : 0
        return sortDir === 'asc' ? aT - bT : bT - aT
      }
      const aVal = sortCol === 'key' ? a.issueKey
        : sortCol === 'summary' ? (a.summary ?? '')
        : (a.jiraStatus ?? '')
      const bVal = sortCol === 'key' ? b.issueKey
        : sortCol === 'summary' ? (b.summary ?? '')
        : (b.jiraStatus ?? '')
      const cmp = aVal.localeCompare(bVal)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [features, search, statusFilter, sortCol, sortDir])

  const noPlan   = features.filter((f) => f.testPlanStatus === 'none').length
  const analysis = features.filter((f) => f.testPlanStatus === 'analysis').length
  const jsonReady = features.filter((f) => f.testPlanStatus === 'json_ready').length
  const stale    = features.filter((f) => f.testPlanStatus === 'stale').length

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'QA Scopes', to: '/qa/scope' },
    { label: scope?.name ?? scopeId },
  ]

  const handleViewAnalysis = useCallback((f: QaFeatureItem) => {
    setViewDrawerFeature(f)
  }, [])

  const handleEditAnalysis = useCallback((f: QaFeatureItem) => {
    setAnalysisDrawerFeature(f)
  }, [])

  // ── Status filter options ─────────────────────────────────────────────────

  const statusOptions = [
    { value: 'none',       label: 'No Plan',    dotClass: 'bg-[var(--color-tags-font-neutral)]' },
    { value: 'analysis',   label: 'Analysis',   dotClass: 'bg-blue-400' },
    { value: 'json_ready', label: 'JSON Ready', dotClass: 'bg-[var(--color-tags-font-success)]' },
    { value: 'stale',      label: 'Stale',      dotClass: 'bg-[var(--color-tags-font-attention)]' },
  ]

  function handleExport() {
    const esc = (v: string | number | undefined | null) => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    const headers = ['Key', 'Type', 'Parent', 'Summary', 'Jira Status', 'Test Plan Status', 'Jira TP', 'Last Generated']
    const rows: string[] = []
    filteredSorted.forEach((f) => {
      rows.push([f.issueKey, 'Feature', '', f.summary, f.jiraStatus ?? '', f.testPlanStatus, f.jiraIssueKey ?? '', f.generatedAt ?? ''].map(esc).join(','))
      const stories = storyMap.get(f.issueKey) ?? []
      stories.forEach((s) => {
        rows.push([s.issueKey, 'Story', f.issueKey, s.summary, s.jiraStatus ?? '', '', '', ''].map(esc).join(','))
      })
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${scope?.name ?? 'qa-scope'}-features.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main>
      <div className="mb-4">
        <Breadcrumb items={breadcrumbs} />
      </div>

      <PageHeader
        title={scope?.name ?? 'QA Scope'}
        subtitle={`${features.length} feature${features.length !== 1 ? 's' : ''} · ${jsonReady} plans ready · ${stale} stale · ${noPlan} not started`}
        actions={
          <Tooltip text="Re-sync features and issues from Jira for this scope" position="bottom">
            <Button
              variant="secondary"
              size="md"
              loading={syncMutation.isPending}
              icon={<RefreshCw size={14} />}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              Sync
            </Button>
          </Tooltip>
        }
      />

      {/* Summary chips */}
      {features.length > 0 && (
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {[
            { label: 'No Plan',    count: noPlan,    cls: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]' },
            { label: 'Analysis',   count: analysis,  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
            { label: 'JSON Ready', count: jsonReady, cls: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]' },
            { label: 'Stale',      count: stale,     cls: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]' },
          ].filter((s) => s.count > 0).map((s) => (
            <button
              key={s.label}
              onClick={() => setStatusFilter(statusFilter === s.label.toLowerCase().replace(' ', '_').replace('json_', 'json_') ? '' : statusOptions.find(o => o.label === s.label)?.value ?? '')}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] cursor-pointer transition-opacity hover:opacity-80 ${s.cls}`}
            >
              {s.count} {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Feature table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : features.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No features found</p>
          <p className="text-sm">Sync this scope from Jira to load features.</p>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none" />
              <Input
                placeholder="Search features…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-6 w-48"
              />
            </div>
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All statuses"
            />
          </div>

        <TableCard
          title="Features"
          subtitle={filteredSorted.length !== features.length
            ? `${filteredSorted.length} of ${features.length}`
            : `${features.length}`}
          toolbar={
            <>
              <Tooltip text="Expand all features to show their user stories" position="bottom">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ChevronsDown size={12} />}
                  onClick={() => setExpandedKeys(new Set(storyMap.keys()))}
                >
                  Expand All
                </Button>
              </Tooltip>
              <Tooltip text="Collapse all features" position="bottom">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ChevronsUp size={12} />}
                  onClick={() => setExpandedKeys(new Set())}
                >
                  Collapse All
                </Button>
              </Tooltip>
              <Tooltip text="Export visible rows to CSV" position="bottom">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download size={12} />}
                  onClick={handleExport}
                >
                  Export
                </Button>
              </Tooltip>
            </>
          }
          maxHeight="auto"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-tables-table-header-background)] border-b border-[var(--color-tables-table-header-stroke)]">
                <SortableHeader
                  col="key" label="Issue"
                  tooltip="Jira issue key — click to sort"
                  currentCol={sortCol} currentDir={sortDir} onSort={handleSort}
                />
                <SortableHeader
                  col="summary" label="Summary"
                  tooltip="Feature title from Jira, plus test plan KPIs when available"
                  currentCol={sortCol} currentDir={sortDir} onSort={handleSort}
                />
                <SortableHeader
                  col="jiraStatus" label="Jira Status"
                  tooltip="Current workflow status of the feature in Jira"
                  currentCol={sortCol} currentDir={sortDir} onSort={handleSort}
                />
                <SortableHeader
                  col="testPlanStatus" label="Test Plan"
                  tooltip="AI test plan generation stage: None → Analysis → JSON Ready (or Stale when requirements drifted)"
                  currentCol={sortCol} currentDir={sortDir} onSort={handleSort}
                />
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap">
                  <Tooltip text="Jira test plan ticket linked to this feature via 'is tested by'" position="bottom">
                    <span>Jira TP</span>
                  </Tooltip>
                </th>
                <SortableHeader
                  col="generatedAt" label="Last Generated"
                  tooltip="When the test plan was last generated or regenerated"
                  currentCol={sortCol} currentDir={sortDir} onSort={handleSort}
                />
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] whitespace-nowrap w-0">
                  <Tooltip text="Generate analysis, edit analysis, convert to JSON, or view full test plan" position="bottom">
                    <span>Actions</span>
                  </Tooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-fonts-font-color-support)]">
                    No features match the current filter.
                  </td>
                </tr>
              ) : (
                filteredSorted.flatMap((feature) => {
                  const stories = storyMap.get(feature.issueKey) ?? []
                  const isExpanded = expandedKeys.has(feature.issueKey)
                  const rows = [
                    <FeatureRow
                      key={feature.issueKey}
                      feature={feature}
                      scopeId={scopeId}
                      jiraBaseUrl={jiraBaseUrl}
                      expanded={isExpanded}
                      hasStories={stories.length > 0}
                      onToggle={() => toggleExpand(feature.issueKey)}
                      onViewAnalysis={handleViewAnalysis}
                      onEditAnalysis={handleEditAnalysis}
                      onToast={setToast}
                    />,
                  ]
                  if (isExpanded) {
                    stories.forEach((story) => {
                      rows.push(
                        <UserStoryRow
                          key={story.issueKey}
                          story={story}
                          jiraBaseUrl={jiraBaseUrl}
                        />
                      )
                    })
                  }
                  return rows
                })
              )}
            </tbody>
          </table>
        </TableCard>
        </>
      )}

      {/* Analysis view drawer (read-only) */}
      {viewDrawerFeature && (
        <AnalysisViewDrawer
          scopeId={scopeId}
          feature={viewDrawerFeature}
          onClose={() => setViewDrawerFeature(null)}
          onEdit={() => {
            setAnalysisDrawerFeature(viewDrawerFeature)
            setViewDrawerFeature(null)
          }}
        />
      )}

      {/* Analysis edit drawer */}
      {analysisDrawerFeature && (
        <AnalysisEditDrawer
          scopeId={scopeId}
          feature={analysisDrawerFeature}
          onClose={() => setAnalysisDrawerFeature(null)}
          onToast={setToast}
        />
      )}

      {toast && <Toast message={toast.message} variant={toast.variant} action={toast.action} onClose={() => setToast(null)} />}
    </main>
  )
}
