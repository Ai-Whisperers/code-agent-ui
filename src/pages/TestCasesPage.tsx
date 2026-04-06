import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FlaskConical, Target, AlertTriangle, Loader2, TestTube2, Search, Upload,
  CheckCircle2, XCircle, Trash2,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { Input } from '@/components/ui/Input'
import { TestCaseCard } from '@/components/shared/TestCaseCard'
import api from '@/lib/api'
import { mcpProfilesApi } from '@/lib/mcpProfiles'
import type { QaTestCase, QaTestPlanRecord } from '@/types/api'

const TERMINAL_JOB_STATUSES = ['SUCCESS', 'FAILED', 'CANCELLED']
const jobStorageKey = (issueKey: string) => `qa-testcase-job:${issueKey}`

// ── KPI counter ───────────────────────────────────────────────────────────────

function KpiCounter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] px-5 py-3 text-center min-w-[80px]">
      <span className="text-2xl font-bold text-[var(--color-fonts-font-color-brand)] tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">{label}</span>
    </div>
  )
}

// ── Story section ─────────────────────────────────────────────────────────────

function StorySection({ storyKey, cases, planId, jiraBaseUrl }: {
  storyKey: string
  cases: QaTestCase[]
  planId: string
  jiraBaseUrl?: string
}) {
  const behaviourCases = cases.filter((c) => c.testCaseType === 'Behaviour')
  const capabilityCases = cases.filter((c) => c.testCaseType === 'Capability')

  return (
    <div className="flex flex-col gap-4">
      {/* Story header */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-[var(--color-fonts-font-color-brand)]">{storyKey}</span>
        <span className="text-xs text-[var(--color-fonts-font-color-support)]">
          {cases.length} test case{cases.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {behaviourCases.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-fonts-font-color-support)]">
              <FlaskConical size={10} /> {behaviourCases.length} B
            </span>
          )}
          {capabilityCases.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-fonts-font-color-support)]">
              <Target size={10} /> {capabilityCases.length} C
            </span>
          )}
        </div>
      </div>

      {/* Behaviour cases */}
      {behaviourCases.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">
            <FlaskConical size={12} className="text-[var(--color-fonts-font-color-brand)]" />
            Behaviour Tests ({behaviourCases.length})
          </h3>
          {behaviourCases.map((tc) => (
            <TestCaseCard key={tc.id} tc={tc} planId={planId} jiraBaseUrl={jiraBaseUrl} />
          ))}
        </div>
      )}

      {/* Capability cases */}
      {capabilityCases.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">
            <Target size={12} className="text-[var(--color-fonts-font-color-brand)]" />
            Capability Tests ({capabilityCases.length})
          </h3>
          {capabilityCases.map((tc) => (
            <TestCaseCard key={tc.id} tc={tc} planId={planId} jiraBaseUrl={jiraBaseUrl} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sync toast ────────────────────────────────────────────────────────────────

interface SyncToast {
  type: 'success' | 'error'
  message: string
}

function SyncResultToast({ toast, onDismiss }: { toast: SyncToast; onDismiss: () => void }) {
  const Icon = toast.type === 'success' ? CheckCircle2 : XCircle
  const cls = toast.type === 'success'
    ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] border-[var(--color-tags-font-success)]'
    : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] border-[var(--color-tags-font-critical)]'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-[var(--border-radius-card)] border text-sm font-medium shadow-lg ${cls}`}>
      <Icon size={15} />
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface TestCasesPageProps {
  issueKey: string
}

export default function TestCasesPage({ issueKey }: TestCasesPageProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [storyFilter, setStoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [syncToast, setSyncToast] = useState<SyncToast | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // ── Active job state (persisted across navigation) ────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(
    () => localStorage.getItem(jobStorageKey(issueKey))
  )

  const setJob = useCallback((jobId: string | null) => {
    setActiveJobId(jobId)
    if (jobId) localStorage.setItem(jobStorageKey(issueKey), jobId)
    else localStorage.removeItem(jobStorageKey(issueKey))
  }, [issueKey])

  // ── Job status polling ────────────────────────────────────────────────────
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

  const { data: plan, isLoading: planLoading } = useQuery<QaTestPlanRecord>({
    queryKey: ['qa-test-plan-by-key', issueKey],
    queryFn: () => api.get(`/qa/test-plans/by-key/${issueKey}`).then((r) => r.data),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!jobStatus?.status || !TERMINAL_JOB_STATUSES.includes(jobStatus.status)) return
    setJob(null)
    qc.invalidateQueries({ queryKey: ['qa-test-cases', plan?.id] })
    qc.invalidateQueries({ queryKey: ['qa-test-plan-by-key', issueKey] })
  }, [jobStatus?.status, qc, plan?.id, issueKey, setJob])

  const { data: cases = [], isLoading: casesLoading, isError } = useQuery<QaTestCase[]>({
    queryKey: ['qa-test-cases', plan?.id],
    queryFn: () => api.get(`/qa/test-plans/${plan!.id}/test-cases`).then((r) => r.data),
    enabled: !!plan?.id,
    staleTime: 30_000,
  })

  const { data: mcpConfig } = useQuery({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig().catch(() => ({ jira: { baseUrl: '', username: '' }, confluence: { baseUrl: '', username: '' }, xray: { baseUrl: '' } })),
    staleTime: 5 * 60_000,
  })
  const jiraBaseUrl = mcpConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  // ── Generate test cases mutation ──────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: () => api.post(`/qa/test-plans/${plan!.id}/test-cases/generate`),
    onSuccess: (res) => {
      const jobId = res.data?.jobId
      if (jobId) setJob(jobId)
      setSyncToast({ type: 'success', message: `Test case generation queued${jobId ? ` (job ${jobId.slice(0, 8)})` : ''}` })
    },
    onError: () => setSyncToast({ type: 'error', message: 'Failed to queue test case generation' }),
  })

  const isJobActive = !!activeJobId
  const jobStatusLabel = jobStatus?.status
    ? jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1).toLowerCase()
    : 'Starting…'

  const syncMutation = useMutation({
    mutationFn: () =>
      api.post(`/qa/test-plans/${plan!.id}/test-cases/sync-to-jira`).then((r) => r.data),
    onSuccess: (data: { created: number; updated: number; failed: number }) => {
      qc.invalidateQueries({ queryKey: ['qa-test-cases', plan?.id] })
      const parts: string[] = []
      if (data.created > 0) parts.push(`${data.created} created`)
      if (data.updated > 0) parts.push(`${data.updated} updated`)
      if (data.failed > 0) parts.push(`${data.failed} failed`)
      const msg = parts.length > 0
        ? `Jira sync complete — ${parts.join(', ')}`
        : 'Jira sync complete — no changes'
      setSyncToast({ type: data.failed > 0 ? 'error' : 'success', message: msg })
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Jira sync failed'
      setSyncToast({ type: 'error', message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/qa/test-plans/${plan!.id}/test-cases`),
    onSuccess: () => {
      setDeleteDialogOpen(false)
      qc.invalidateQueries({ queryKey: ['qa-test-cases', plan?.id] })
      qc.invalidateQueries({ queryKey: ['qa-test-plan-by-key', issueKey] })
      setSyncToast({ type: 'success', message: 'All test cases deleted' })
    },
    onError: () => {
      setDeleteDialogOpen(false)
      setSyncToast({ type: 'error', message: 'Failed to delete test cases' })
    },
  })

  const featureKey = issueKey
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Test Plans', to: '/qa/test-plans' },
    { label: featureKey, to: `/qa/test-plans/${featureKey}` },
    { label: 'Test Cases' },
  ]

  const isLoading = planLoading || casesLoading

  // Derived story keys for the filter dropdown (all stories, unfiltered)
  const allStoryKeys = useMemo(
    () => Array.from(new Set(cases.map((c) => c.storyKey))).sort(),
    [cases],
  )

  // Apply filters
  const lowerSearch = search.toLowerCase()
  const filtered = useMemo(
    () => cases.filter((tc) => {
      const matchesStory = !storyFilter || tc.storyKey === storyFilter
      const matchesSearch = !lowerSearch || tc.title.toLowerCase().includes(lowerSearch)
      return matchesStory && matchesSearch
    }),
    [cases, storyFilter, lowerSearch],
  )

  // Group filtered cases by story key
  const byStory = useMemo(
    () => filtered.reduce<Record<string, QaTestCase[]>>((acc, tc) => {
      if (!acc[tc.storyKey]) acc[tc.storyKey] = []
      acc[tc.storyKey].push(tc)
      return acc
    }, {}),
    [filtered],
  )

  const behaviourCount = filtered.filter((c) => c.testCaseType === 'Behaviour').length
  const capabilityCount = filtered.filter((c) => c.testCaseType === 'Capability').length
  const storiesCount = Object.keys(byStory).length
  const isFiltering = Boolean(storyFilter || search)

  if (isLoading) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
        </div>
      </main>
    )
  }

  if (isError) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <AlertTriangle size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Failed to load test cases</p>
          <button
            onClick={() => navigate({ to: `/qa/test-plans/${featureKey}` })}
            className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ArrowLeft size={14} /> Back to test plan
          </button>
        </div>
      </main>
    )
  }

  if (cases.length === 0) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <TestTube2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No test cases yet</p>
          <p className="text-sm">Use "Generate Test Cases" from the test plan page.</p>
          <button
            onClick={() => navigate({ to: `/qa/test-plans/${featureKey}` })}
            className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ArrowLeft size={14} /> Back to test plan
          </button>
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">
              Test Cases — {featureKey}
            </h1>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
              {storiesCount} stor{storiesCount !== 1 ? 'ies' : 'y'} ·{' '}
              {isFiltering
                ? <>{filtered.length} of {cases.length} test case{cases.length !== 1 ? 's' : ''}</>
                : <>{cases.length} test case{cases.length !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isJobActive ? (
              <button
                onClick={() => navigate({ to: '/jobs/$id', params: { id: activeJobId! } })}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--border-radius-button)] border border-[var(--color-cards-card-stroke)] text-[var(--color-tags-font-attention)] hover:underline"
              >
                <Loader2 size={12} className="animate-spin shrink-0" />
                Job #{activeJobId!.slice(0, 8)} · {jobStatusLabel}
              </button>
            ) : (
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || !plan?.id}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--border-radius-button)] bg-[var(--color-fonts-font-color-brand)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {generateMutation.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <TestTube2 size={13} />}
                Regenerate Test Cases
              </button>
            )}
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !plan?.id || isJobActive}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--border-radius-button)] bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncMutation.isPending
                ? <Loader2 size={14} className="animate-spin" />
                : <Upload size={14} />}
              Upload to Jira
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isJobActive || !plan?.id || deleteMutation.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--border-radius-button)] border border-[var(--color-tags-font-critical)] text-[var(--color-tags-font-critical)] hover:bg-[var(--color-tags-critical-background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 size={13} />
              Delete All
            </button>
            <button
              onClick={() => navigate({ to: `/qa/test-plans/${featureKey}` })}
              className="flex items-center gap-1.5 text-sm text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]"
            >
              <ArrowLeft size={14} /> Back to test plan
            </button>
          </div>
        </div>

        {/* KPI counters */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <KpiCounter value={filtered.length} label={isFiltering ? 'Filtered' : 'Total'} />
          <KpiCounter value={behaviourCount} label="Behaviour" />
          <KpiCounter value={capabilityCount} label="Capability" />
          <KpiCounter value={storiesCount} label="Stories" />
        </div>

        {/* Filter toolbar */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <FilterSelect
            value={storyFilter}
            onChange={setStoryFilter}
            placeholder="All stories"
            options={allStoryKeys.map((k) => ({ value: k, label: k }))}
          />
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search test cases…"
              className="h-7 pl-7 w-52 text-xs"
            />
          </div>
          {isFiltering && (
            <button
              onClick={() => { setStoryFilter(''); setSearch('') }}
              className="text-xs text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Empty state when filters yield no results */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <TestTube2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No test cases match your filters</p>
          <button
            onClick={() => { setStoryFilter(''); setSearch('') }}
            className="mt-2 text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Stories */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-10">
          {Object.entries(byStory).map(([storyKey, storyCases]) => (
            <StorySection
              key={storyKey}
              storyKey={storyKey}
              cases={storyCases}
              planId={plan?.id ?? ''}
              jiraBaseUrl={jiraBaseUrl}
            />
          ))}
        </div>
      )}

      {syncToast && (
        <SyncResultToast toast={syncToast} onDismiss={() => setSyncToast(null)} />
      )}

      {deleteDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeleteDialogOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <Trash2 size={18} className="text-[var(--color-tags-font-critical)] shrink-0" />
              <h2 className="text-base font-semibold text-[var(--color-fonts-font-color-headings)]">
                Delete all test cases?
              </h2>
            </div>
            <p className="text-sm text-[var(--color-fonts-font-color-support)] mb-5">
              This will permanently delete all{' '}
              <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
                {cases.length} test case{cases.length !== 1 ? 's' : ''}
              </span>{' '}
              for <span className="font-mono font-medium">{featureKey}</span>. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteMutation.isPending}
                className="text-sm px-4 py-1.5 rounded-[var(--border-radius-button)] border border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-[var(--border-radius-button)] bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />}
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
