import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  RefreshCw,
  Download,
  Pin,
  PinOff,
  Save,
  ChevronDown,
  ChevronRight,
  History,
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  PlayCircle,
} from 'lucide-react'
import { useStore } from '@tanstack/react-store'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Toast } from '@/components/ui/Toast'
import type { ToastConfig } from '@/components/ui/Toast'
import { MermaidDiagram } from '@/components/chat/MermaidDiagram'
import { RepoCombobox } from '@/components/plan/RepoCombobox'
import { JobStatusBadge } from '@/components/ui/JobStatusBadge'
import { authStore } from '@/store/auth-store'
import api from '@/lib/api'
import type { CustomerConfig, JobStatusResponse } from '@/types/api'

// ── Types ──────────────────────────────────────────────────────────────────

interface ArchitectureDiagramVersion {
  id: number
  repoSlug?: string
  customerId?: string
  environment?: string
  viewName: string
  viewType: string
  version: number
  source: 'ai' | 'human'
  pinned: boolean
  dslSrc: string
  mermaidSrc: string
  createdAt: string
}

interface CloudEnvironmentKey {
  customerId: string
  environment: string
}

// ── API helpers ────────────────────────────────────────────────────────────

const archApi = {
  listRepos: () => api.get<string[]>('/architecture/repos').then((r) => r.data),
  getDiagrams: (repo: string) =>
    api.get<ArchitectureDiagramVersion[]>('/architecture', { params: { repo } }).then((r) => r.data),
  getVersions: (viewId: number) =>
    api.get<ArchitectureDiagramVersion[]>(`/architecture/${viewId}/versions`).then((r) => r.data),
  generate: (body: { repoUrl: string; commitDirect: boolean }) =>
    api.post<{ jobId: string }>('/architecture/generate', body).then((r) => r.data),
  saveDsl: (viewId: number, dslSrc: string) =>
    api.put<{ id: number }>(`/architecture/${viewId}/dsl`, { dslSrc }).then((r) => r.data),
  pin: (viewId: number) => api.post(`/architecture/${viewId}/pin`),
  unpin: (viewId: number) => api.post(`/architecture/${viewId}/unpin`),
  exportRepo: (repo: string) =>
    `${import.meta.env.VITE_API_URL}/architecture/export?repo=${encodeURIComponent(repo)}`,
  exportVersion: (viewId: number) =>
    `${import.meta.env.VITE_API_URL}/architecture/${viewId}/export`,

  listCustomers: () =>
    api.get<CustomerConfig[]>('/customer-registry/customers').then((r) => r.data).catch(() => [] as CustomerConfig[]),
  listCloudEnvs: () =>
    api.get<CloudEnvironmentKey[]>('/architecture/cloud/environments').then((r) => r.data),
  getCloudDiagrams: (customerId: string, environment: string) =>
    api
      .get<ArchitectureDiagramVersion[]>('/architecture/cloud', {
        params: { customerId, environment },
      })
      .then((r) => r.data),
  getCloudVersions: (viewId: number) =>
    api.get<ArchitectureDiagramVersion[]>(`/architecture/${viewId}/versions`).then((r) => r.data),
  generateCloud: (body: { customerId: string; environmentName: string }) =>
    api.post<{ jobId: string }>('/architecture/cloud/generate', body).then((r) => r.data),
  exportCloud: (customerId: string, environment: string) =>
    `${import.meta.env.VITE_API_URL}/architecture/cloud/export?customerId=${encodeURIComponent(customerId)}&environment=${encodeURIComponent(environment)}`,
  generateAll: () =>
    api.post<{ reposQueued: number; reposSkipped: number; cloudQueued: number; cloudSkipped: number }>(
      '/architecture/generate-all',
    ).then((r) => r.data),
}

// ── Job poller ─────────────────────────────────────────────────────────────

/**
 * Polls a job by ID every `intervalMs` until it reaches a terminal state
 * (SUCCESS, FAILED, AWAITING_APPROVAL), then calls `onDone`.
 */
function useJobPoller(
  jobId: string | null,
  onDone: (status: string) => void,
  intervalMs = 5_000,
) {
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!jobId) return
    let cancelled = false

    const poll = async () => {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, intervalMs))
        if (cancelled) break
        try {
          const res = await api.get<JobStatusResponse>(`/status/${jobId}`)
          const status = res.data?.status
          if (status === 'SUCCESS' || status === 'FAILED' || status === 'AWAITING_APPROVAL') {
            if (!cancelled) onDoneRef.current(status)
            break
          }
        } catch {
          // network hiccup — keep polling
        }
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId, intervalMs])
}

// ── Generate-all button (admin only) ──────────────────────────────────────

function GenerateAllButton() {
  const user = useStore(authStore, (s) => s.user)
  const qc = useQueryClient()
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const [loading, setLoading] = useState(false)

  if (!user?.appRoles.includes('ADMINISTRATOR')) return null

  const handleGenerateAll = async () => {
    setLoading(true)
    try {
      const result = await archApi.generateAll()
      const total = result.reposQueued + result.cloudQueued
      setToast({
        variant: 'success',
        message: `Queued ${total} job${total !== 1 ? 's' : ''} — ${result.reposQueued} repo${result.reposQueued !== 1 ? 's' : ''}, ${result.cloudQueued} cloud env${result.cloudQueued !== 1 ? 's' : ''}`,
      })
      qc.invalidateQueries({ queryKey: ['arch-running-jobs'] })
    } catch {
      setToast({ variant: 'error', message: 'Failed to queue generate-all jobs' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <Button
        variant="secondary"
        size="sm"
        icon={<PlayCircle size={13} />}
        loading={loading}
        onClick={handleGenerateAll}
        title="Queue architecture generation for all repos and cloud environments"
      >
        Generate All
      </Button>
    </>
  )
}

// ── Running jobs badge ─────────────────────────────────────────────────────

const ARCH_JOB_TYPES = new Set(['GENERATE_ARCHITECTURE', 'GENERATE_CLOUD_ARCHITECTURE'])

function RunningJobsBadge() {
  const { data: jobs = [] } = useQuery<JobStatusResponse[]>({
    queryKey: ['arch-running-jobs'],
    queryFn: () =>
      api
        .get<JobStatusResponse[]>('/jobs', { params: { status: 'RUNNING', limit: 50 } })
        .then((r) => (Array.isArray(r.data) ? r.data : []))
        .catch(() => []),
    refetchInterval: 8_000,
  })

  const archJobs = jobs.filter((j) => ARCH_JOB_TYPES.has(j.jobType))

  if (archJobs.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)]">
      <Loader2 size={13} className="animate-spin text-[var(--color-fonts-font-color-brand)] shrink-0" />
      <span className="text-xs text-[var(--color-fonts-font-color-support)]">
        {archJobs.length} architecture job{archJobs.length > 1 ? 's' : ''} running
      </span>
      <div className="flex gap-1">
        {archJobs.slice(0, 3).map((j) => (
          <JobStatusBadge key={j.jobId} status={j.status} />
        ))}
      </div>
    </div>
  )
}

// ── Zoom-able diagram wrapper ──────────────────────────────────────────────

function ZoomableDiagram({ code }: { code: string }) {
  const [scale, setScale] = useState(1)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const clampScale = (s: number) => Math.min(4, Math.max(0.25, s))

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((s) => clampScale(s + delta))
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsPanning(true)
    panStart.current = { mx: e.clientX, my: e.clientY, ox: origin.x, oy: origin.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return
    setOrigin({
      x: panStart.current.ox + (e.clientX - panStart.current.mx),
      y: panStart.current.oy + (e.clientY - panStart.current.my),
    })
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    panStart.current = null
  }

  const reset = () => { setScale(1); setOrigin({ x: 0, y: 0 }) }

  // Fullscreen
  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        containerRef.current.requestFullscreen()
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="flex items-center gap-1.5 justify-end">
        <button
          onClick={() => setScale((s) => clampScale(s - 0.2))}
          className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={reset}
          className="px-2 py-0.5 text-xs rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)] transition-colors font-mono min-w-[44px] text-center"
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => setScale((s) => clampScale(s + 0.2))}
          className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleFullscreen}
          className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
          title="Fullscreen"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Diagram canvas */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] select-none"
        style={{ minHeight: 240, cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${origin.x}px, ${origin.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.1s ease',
          }}
        >
          <MermaidDiagram code={code} />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: 'ai' | 'human' }) {
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] font-medium ${
        source === 'human'
          ? 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
          : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
      }`}
    >
      {source}
    </span>
  )
}

function VersionHistory({
  versions,
  currentId,
  onSelect,
  onPin,
}: {
  versions: ArchitectureDiagramVersion[]
  currentId: number
  onSelect: (v: ArchitectureDiagramVersion) => void
  onPin: (v: ArchitectureDiagramVersion) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-[var(--color-cards-card-stroke)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors"
      >
        <History size={14} />
        <span className="font-medium">Version history</span>
        <span className="ml-auto text-xs">({versions.length})</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-2 px-4 py-2 text-xs cursor-pointer transition-colors ${
                v.id === currentId
                  ? 'bg-[var(--color-navigation-menu-item-active)]'
                  : 'hover:bg-[var(--color-navigation-menu-item-hover-background)]'
              }`}
              onClick={() => onSelect(v)}
            >
              <span className="font-mono text-[var(--color-fonts-font-color-support)] w-6">
                v{v.version}
              </span>
              <SourceBadge source={v.source} />
              {v.pinned && (
                <Pin size={11} className="text-[var(--color-buttons-button-primary)] shrink-0" />
              )}
              <span className="text-[var(--color-fonts-font-color-support)] truncate flex-1">
                {new Date(v.createdAt).toLocaleString()}
              </span>
              <a
                href={archApi.exportVersion(v.id)}
                download
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]"
                title="Download this version"
              >
                <Download size={12} />
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPin(v)
                }}
                className="shrink-0 text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]"
                title={v.pinned ? 'Unpin' : 'Pin as AI baseline'}
              >
                {v.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Diagram panel (shared between code and cloud tabs) ─────────────────────

type DiagramTab = 'diagram' | 'source'

function DiagramPanel({
  diagram,
  onSave,
  onPin,
  onUnpin,
  exportUrl,
}: {
  diagram: ArchitectureDiagramVersion
  onSave: (viewId: number, dsl: string) => void
  onPin: (viewId: number) => void
  onUnpin: (viewId: number) => void
  exportUrl: string
}) {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<DiagramTab>('diagram')
  const [editDsl, setEditDsl] = useState(diagram.dslSrc)
  const [previewMermaid, setPreviewMermaid] = useState(diagram.mermaidSrc)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastConfig | null>(null)

  useEffect(() => {
    setEditDsl(diagram.dslSrc)
    setPreviewMermaid(diagram.mermaidSrc)
  }, [diagram.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(diagram.id, editDsl)
      setToast({ variant: 'success', message: 'Saved as new version' })
      qc.invalidateQueries({ queryKey: ['arch-versions', diagram.id] })
    } catch {
      setToast({ variant: 'error', message: 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const { data: versions = [] } = useQuery({
    queryKey: ['arch-versions', diagram.id],
    queryFn: () => archApi.getVersions(diagram.id),
  })

  const [selectedVersion, setSelectedVersion] = useState<ArchitectureDiagramVersion>(diagram)

  const handleSelectVersion = (v: ArchitectureDiagramVersion) => {
    setSelectedVersion(v)
    setEditDsl(v.dslSrc)
    setPreviewMermaid(v.mermaidSrc)
  }

  const handlePinVersion = async (v: ArchitectureDiagramVersion) => {
    if (v.pinned) {
      await archApi.unpin(v.id)
    } else {
      await archApi.pin(v.id)
    }
    qc.invalidateQueries({ queryKey: ['arch-versions', diagram.id] })
    qc.invalidateQueries({ queryKey: ['arch-diagrams'] })
    qc.invalidateQueries({ queryKey: ['arch-cloud-diagrams'] })
  }

  return (
    <div className="flex flex-col">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-cards-card-stroke)]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[var(--color-fonts-font-color-primary)]">
            {diagram.viewName}
          </span>
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">
            {diagram.viewType}
          </span>
          <SourceBadge source={selectedVersion.source} />
          {selectedVersion.pinned && (
            <Pin size={13} className="text-[var(--color-buttons-button-primary)]" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">
            {new Date(selectedVersion.createdAt).toLocaleString()}
          </span>
          <a href={exportUrl} download>
            <Button variant="secondary" size="sm" icon={<Download size={13} />}>
              Export DSL
            </Button>
          </a>
          {selectedVersion.pinned ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<PinOff size={13} />}
              onClick={() => onUnpin(selectedVersion.id)}
            >
              Unpin
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pin size={13} />}
              onClick={() => onPin(selectedVersion.id)}
            >
              Pin as baseline
            </Button>
          )}
        </div>
      </div>

      {/* Diagram / Source tab bar */}
      <div className="flex gap-0 border-b border-[var(--color-cards-card-stroke)] px-4">
        {(['diagram', 'source'] as DiagramTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-fonts-font-color-primary)]'
                : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {activeTab === 'diagram' ? (
          <ZoomableDiagram code={previewMermaid} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
                Structurizr DSL
              </span>
              <Button
                variant="primary"
                size="sm"
                icon={<Save size={13} />}
                loading={saving}
                onClick={handleSave}
              >
                Save as new version
              </Button>
            </div>
            <textarea
              value={editDsl}
              onChange={(e) => setEditDsl(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--border-radius-card)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-xs font-mono text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-y"
              style={{ minHeight: 320 }}
              spellCheck={false}
            />
          </div>
        )}
      </div>

      {/* Version history */}
      <VersionHistory
        versions={versions}
        currentId={selectedVersion.id}
        onSelect={handleSelectVersion}
        onPin={handlePinVersion}
      />
    </div>
  )
}

// ── View list with filter ──────────────────────────────────────────────────

function ViewList({
  diagrams,
  loading,
  selectedId,
  emptyMessage,
  onSelect,
}: {
  diagrams: ArchitectureDiagramVersion[]
  loading: boolean
  selectedId?: number
  emptyMessage: string
  onSelect: (d: ArchitectureDiagramVersion) => void
}) {
  const [filter, setFilter] = useState('')
  const filtered = filter.trim()
    ? diagrams.filter((d) =>
        d.viewName.toLowerCase().includes(filter.toLowerCase()) ||
        d.viewType.toLowerCase().includes(filter.toLowerCase()),
      )
    : diagrams

  return (
    <div className="flex flex-col gap-2 w-52 shrink-0">
      <div className="relative">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none"
        />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter views…"
          className="w-full pl-7 pr-2 py-1.5 text-xs rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
        />
      </div>

      <div className="space-y-1">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 skeleton-shimmer rounded-[var(--border-radius-small)]" />
            ))
          : filtered.length === 0
          ? (
            <div className="text-sm text-[var(--color-fonts-font-color-support)] px-2 py-4">
              {filter ? 'No views match the filter.' : emptyMessage}
            </div>
          )
          : filtered.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelect(d)}
                className={`w-full text-left px-3 py-2.5 rounded-[var(--border-radius-small)] text-sm transition-colors ${
                  selectedId === d.id
                    ? 'bg-[var(--color-navigation-menu-item-active)] text-[var(--color-navigation-menu-item-hover-font)]'
                    : 'hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-primary)]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium">{d.viewName}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.pinned && <Pin size={11} className="text-[var(--color-buttons-button-primary)]" />}
                    <SourceBadge source={d.source} />
                  </div>
                </div>
                <div className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                  {d.viewType}
                </div>
              </button>
            ))}
      </div>
    </div>
  )
}

// ── Code Architecture tab ──────────────────────────────────────────────────

function slugFromUrl(url: string): string {
  return url.replace(/\.git$/, '').split('/').pop() ?? ''
}

function CodeArchitectureTab() {
  const qc = useQueryClient()
  const [repoUrl, setRepoUrl] = useState('')
  const [selectedView, setSelectedView] = useState<ArchitectureDiagramVersion | null>(null)
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const [generating, setGenerating] = useState(false)
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)

  const repoSlug = slugFromUrl(repoUrl)

  useJobPoller(pollingJobId, (status) => {
    setPollingJobId(null)
    setGenerating(false)
    if (status === 'SUCCESS') {
      setToast({ variant: 'success', message: 'Architecture diagrams generated successfully' })
      qc.invalidateQueries({ queryKey: ['arch-diagrams', repoSlug] })
      qc.invalidateQueries({ queryKey: ['arch-running-jobs'] })
    } else if (status === 'FAILED') {
      setToast({ variant: 'error', message: 'Architecture generation job failed' })
      qc.invalidateQueries({ queryKey: ['arch-running-jobs'] })
    }
  })

  const { data: diagrams = [], isLoading: diagramsLoading } = useQuery({
    queryKey: ['arch-diagrams', repoSlug],
    queryFn: () => archApi.getDiagrams(repoSlug),
    enabled: !!repoSlug,
  })

  useEffect(() => {
    if (diagrams.length > 0) {
      setSelectedView(diagrams[0])
    } else {
      setSelectedView(null)
    }
  }, [repoSlug, diagrams.length])

  const saveMutation = useMutation({
    mutationFn: ({ viewId, dsl }: { viewId: number; dsl: string }) =>
      archApi.saveDsl(viewId, dsl),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arch-diagrams', repoSlug] }),
  })

  const pinMutation = useMutation({
    mutationFn: (viewId: number) => archApi.pin(viewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arch-diagrams', repoSlug] })
      setToast({ variant: 'success', message: 'Version pinned as AI baseline' })
    },
  })

  const unpinMutation = useMutation({
    mutationFn: (viewId: number) => archApi.unpin(viewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arch-diagrams', repoSlug] })
      setToast({ variant: 'success', message: 'Version unpinned' })
    },
  })

  const handleGenerate = async () => {
    if (!repoUrl) return
    setGenerating(true)
    try {
      const { jobId } = await archApi.generate({ repoUrl, commitDirect: false })
      setToast({ variant: 'info', message: `Generation job queued — waiting for completion…`, duration: 0 })
      setPollingJobId(jobId)
      qc.invalidateQueries({ queryKey: ['arch-running-jobs'] })
    } catch {
      setGenerating(false)
      setToast({ variant: 'error', message: 'Failed to queue generation job' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Toolbar */}
      <div className="flex items-end gap-3">
        <div className="w-80">
          <RepoCombobox value={repoUrl} onChange={setRepoUrl} />
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw size={13} />}
          loading={generating}
          disabled={!repoUrl}
          onClick={handleGenerate}
        >
          Generate / Refresh
        </Button>
        {repoUrl && (
          <a href={archApi.exportRepo(repoSlug)} download>
            <Button variant="secondary" size="sm" icon={<Download size={13} />}>
              Export DSL
            </Button>
          </a>
        )}
      </div>

      {repoUrl ? (
        <div className="flex gap-4 items-start">
          <ViewList
            diagrams={diagrams}
            loading={diagramsLoading}
            selectedId={selectedView?.id}
            emptyMessage="No diagrams yet. Click Generate / Refresh to create them."
            onSelect={setSelectedView}
          />

          <div className="flex-1 min-w-0 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden">
            {selectedView ? (
              <DiagramPanel
                diagram={selectedView}
                onSave={(viewId, dsl) => saveMutation.mutateAsync({ viewId, dsl })}
                onPin={(viewId) => pinMutation.mutate(viewId)}
                onUnpin={(viewId) => unpinMutation.mutate(viewId)}
                exportUrl={archApi.exportRepo(repoSlug)}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-[var(--color-fonts-font-color-support)] text-sm">
                Select a view from the list
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--color-fonts-font-color-support)]">
          <Network size={40} strokeWidth={1.2} />
          <p className="text-sm">Select a repository above to view or generate architecture diagrams</p>
        </div>
      )}
    </div>
  )
}

// ── Cloud Architecture tab ─────────────────────────────────────────────────

function CloudArchitectureTab() {
  const qc = useQueryClient()
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedEnvironment, setSelectedEnvironment] = useState('')
  const [selectedView, setSelectedView] = useState<ArchitectureDiagramVersion | null>(null)
  const [toast, setToast] = useState<ToastConfig | null>(null)
  const [generating, setGenerating] = useState(false)
  const [pollingJobId, setPollingJobId] = useState<string | null>(null)

  useJobPoller(pollingJobId, (status) => {
    setPollingJobId(null)
    setGenerating(false)
    if (status === 'SUCCESS') {
      setToast({ variant: 'success', message: 'Cloud architecture diagrams generated successfully' })
      qc.invalidateQueries({ queryKey: ['arch-cloud-diagrams', selectedCustomerId, selectedEnvironment] })
      qc.invalidateQueries({ queryKey: ['arch-running-jobs'] })
    } else if (status === 'FAILED') {
      setToast({ variant: 'error', message: 'Cloud architecture discovery job failed' })
      qc.invalidateQueries({ queryKey: ['arch-running-jobs'] })
    }
  })

  const { data: customers = [] } = useQuery<CustomerConfig[]>({
    queryKey: ['customers'],
    queryFn: archApi.listCustomers,
  })

  const { data: selectedCustomer, isLoading: customerLoading } = useQuery<CustomerConfig>({
    queryKey: ['customer', selectedCustomerId],
    queryFn: () =>
      api.get<CustomerConfig>(`/customer-registry/customers/${selectedCustomerId}`).then((r) => r.data),
    enabled: !!selectedCustomerId,
  })

  const customerOptions = customers.map((c) => ({
    value: c.customerId,
    label: c.name || c.customerId,
  }))

  const envOptions = (selectedCustomer?.environments ?? []).map((e) => {
    const label = (e.name && e.name.trim()) || (e.type && e.type.trim()) || 'unknown'
    return { value: label, label }
  })

  const { data: diagrams = [], isLoading: diagramsLoading } = useQuery({
    queryKey: ['arch-cloud-diagrams', selectedCustomerId, selectedEnvironment],
    queryFn: () => archApi.getCloudDiagrams(selectedCustomerId, selectedEnvironment),
    enabled: !!selectedCustomerId && !!selectedEnvironment,
  })

  useEffect(() => {
    if (diagrams.length > 0 && !selectedView) {
      setSelectedView(diagrams[0])
    }
  }, [diagrams])

  useEffect(() => {
    setSelectedView(null)
    setSelectedEnvironment('')
  }, [selectedCustomerId])

  useEffect(() => {
    setSelectedView(null)
  }, [selectedEnvironment])

  const saveMutation = useMutation({
    mutationFn: ({ viewId, dsl }: { viewId: number; dsl: string }) =>
      archApi.saveDsl(viewId, dsl),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['arch-cloud-diagrams', selectedCustomerId, selectedEnvironment],
      }),
  })

  const pinMutation = useMutation({
    mutationFn: (viewId: number) => archApi.pin(viewId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['arch-cloud-diagrams', selectedCustomerId, selectedEnvironment],
      })
      setToast({ variant: 'success', message: 'Version pinned as AI baseline' })
    },
  })

  const unpinMutation = useMutation({
    mutationFn: (viewId: number) => archApi.unpin(viewId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['arch-cloud-diagrams', selectedCustomerId, selectedEnvironment],
      })
      setToast({ variant: 'success', message: 'Version unpinned' })
    },
  })

  const handleDiscover = async () => {
    if (!selectedCustomerId || !selectedEnvironment) return
    setGenerating(true)
    try {
      const { jobId } = await archApi.generateCloud({
        customerId: selectedCustomerId,
        environmentName: selectedEnvironment,
      })
      setToast({ variant: 'info', message: 'Discovery job queued — waiting for completion…', duration: 0 })
      setPollingJobId(jobId)
      qc.invalidateQueries({ queryKey: ['arch-running-jobs'] })
    } catch {
      setGenerating(false)
      setToast({ variant: 'error', message: 'Failed to queue discovery job' })
    }
  }

  const hasSelection = !!selectedCustomerId && !!selectedEnvironment

  return (
    <div className="flex flex-col gap-4">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-56">
          <Select
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            options={customerOptions}
            placeholder="Select customer…"
          />
        </div>
        <div className="w-48">
          <Select
            value={selectedEnvironment}
            onChange={setSelectedEnvironment}
            options={envOptions}
            placeholder={customerLoading ? 'Loading…' : envOptions.length === 0 && selectedCustomerId ? 'No environments' : 'Select environment…'}
            disabled={!selectedCustomerId || customerLoading || envOptions.length === 0}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw size={13} />}
          loading={generating}
          disabled={!hasSelection}
          onClick={handleDiscover}
        >
          Discover / Refresh
        </Button>
        {hasSelection && (
          <a href={archApi.exportCloud(selectedCustomerId, selectedEnvironment)} download>
            <Button variant="secondary" size="sm" icon={<Download size={13} />}>
              Export DSL
            </Button>
          </a>
        )}
      </div>

      {hasSelection ? (
        <div className="flex gap-4 items-start">
          <ViewList
            diagrams={diagrams}
            loading={diagramsLoading}
            selectedId={selectedView?.id}
            emptyMessage="No diagrams yet. Click Discover to generate them."
            onSelect={setSelectedView}
          />

          <div className="flex-1 min-w-0 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden">
            {selectedView ? (
              <DiagramPanel
                diagram={selectedView}
                onSave={(viewId, dsl) => saveMutation.mutateAsync({ viewId, dsl })}
                onPin={(viewId) => pinMutation.mutate(viewId)}
                onUnpin={(viewId) => unpinMutation.mutate(viewId)}
                exportUrl={archApi.exportCloud(selectedCustomerId, selectedEnvironment)}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-[var(--color-fonts-font-color-support)] text-sm">
                Select a view from the list
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-[var(--color-fonts-font-color-support)]">
          <Network size={40} strokeWidth={1.2} />
          <p className="text-sm">Select a customer and environment to view cloud architecture</p>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

type Tab = 'code' | 'cloud'

export default function ArchitecturePage() {
  const [activeTab, setActiveTab] = useState<Tab>('code')

  return (
    <main className="flex flex-col">
      <PageHeader
        title="Architecture"
        subtitle="View, generate, and edit C4 model architecture diagrams for repositories and cloud environments."
        actions={
          <div className="flex items-center gap-2">
            <GenerateAllButton />
            <RunningJobsBadge />
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 px-1 mb-4">
        {(
          [
            { id: 'code', label: 'Code Architecture' },
            { id: 'cloud', label: 'Cloud Architecture' },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-[var(--border-radius-small)] transition-colors font-medium ${
              activeTab === tab.id
                ? 'bg-[var(--color-navigation-menu-item-active)] text-[var(--color-navigation-menu-item-hover-font)]'
                : 'text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-navigation-menu-item-hover-background)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="px-1 pb-8">
        {activeTab === 'code' ? <CodeArchitectureTab /> : <CloudArchitectureTab />}
      </div>
    </main>
  )
}
