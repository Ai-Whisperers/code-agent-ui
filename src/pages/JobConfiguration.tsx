import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JobConfigView {
  jobType: string
  modelTier: string
  thinkingEnabled: boolean
  storedThinkingBudget: number | null
  effectiveThinkingBudget: number
  storedMaxOutputTokens: number | null
  effectiveMaxTokens: number
  effectiveModel: string
  thinkingSupported: boolean
  hasOverride: boolean
}

interface JobConfigRequest {
  modelTier: string
  thinkingEnabled: boolean
  thinkingBudget: number | null
  maxOutputTokens: number | null
}

interface DraftState {
  modelTier: string
  thinkingEnabled: boolean
  thinkingBudget: string
  maxOutputTokens: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  FAST: 'Fast (Haiku)',
  DEFAULT: 'Default (Sonnet)',
  HIGH: 'High-end (Opus)',
}

const JOB_TYPE_LABELS: Record<string, string> = {
  CHAT: 'Chat',
  FIX: 'Fix (incl. Quick Fix & Aikido Fix)',
  REVIEW: 'Review',
  FIX_PR: 'Fix PR',
  GENERATE_TESTS: 'Generate Tests',
  GENERATE_DOCS: 'Generate Docs',
  REWRITE: 'Rewrite',
  SELF_ANALYSIS: 'Self Analysis',
  LOG_ANALYSIS_TRIAGE: 'Log Analysis — Triage',
  LOG_ANALYSIS_DEEP: 'Log Analysis — Deep',
}

// ── API helpers ───────────────────────────────────────────────────────────────

function fetchJobConfigs(): Promise<JobConfigView[]> {
  return api.get('/job-configs').then((r) => r.data)
}

function saveJobConfig(jobType: string, body: JobConfigRequest): Promise<JobConfigView> {
  return api.put(`/job-configs/${jobType}`, body).then((r) => r.data)
}

function resetJobConfig(jobType: string): Promise<JobConfigView> {
  return api.delete(`/job-configs/${jobType}`).then((r) => r.data)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDraft(cfg: JobConfigView): DraftState {
  return {
    modelTier: cfg.modelTier,
    thinkingEnabled: cfg.thinkingEnabled,
    thinkingBudget: cfg.storedThinkingBudget != null ? String(cfg.storedThinkingBudget) : '',
    maxOutputTokens: cfg.storedMaxOutputTokens != null ? String(cfg.storedMaxOutputTokens) : '',
  }
}

function isDirty(draft: DraftState, cfg: JobConfigView): boolean {
  const storedBudget = cfg.storedThinkingBudget != null ? String(cfg.storedThinkingBudget) : ''
  const storedMax = cfg.storedMaxOutputTokens != null ? String(cfg.storedMaxOutputTokens) : ''
  return (
    draft.modelTier !== cfg.modelTier ||
    draft.thinkingEnabled !== cfg.thinkingEnabled ||
    draft.thinkingBudget !== storedBudget ||
    draft.maxOutputTokens !== storedMax
  )
}

// ── Job card ──────────────────────────────────────────────────────────────────

interface JobCardProps {
  cfg: JobConfigView
  onSaved: (updated: JobConfigView) => void
}

function JobCard({ cfg, onSaved }: JobCardProps) {
  const [draft, setDraft] = useState<DraftState>(() => makeDraft(cfg))
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null)

  useEffect(() => {
    setDraft(makeDraft(cfg))
  }, [cfg])

  const dirty = isDirty(draft, cfg)

  const saveMut = useMutation({
    mutationFn: () => {
      const body: JobConfigRequest = {
        modelTier: draft.modelTier,
        thinkingEnabled: draft.thinkingEnabled,
        thinkingBudget: draft.thinkingBudget !== '' ? Number(draft.thinkingBudget) : null,
        maxOutputTokens: draft.maxOutputTokens !== '' ? Number(draft.maxOutputTokens) : null,
      }
      return saveJobConfig(cfg.jobType, body)
    },
    onSuccess: (updated) => {
      onSaved(updated)
      setToast({ message: 'Configuration saved', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to save configuration', variant: 'error' }),
  })

  const resetMut = useMutation({
    mutationFn: () => resetJobConfig(cfg.jobType),
    onSuccess: (updated) => {
      onSaved(updated)
      setToast({ message: 'Reset to defaults', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to reset configuration', variant: 'error' }),
  })

  const isFast = draft.modelTier === 'FAST'
  const thinkingSupported = cfg.thinkingSupported && !isFast
  const busy = saveMut.isPending || resetMut.isPending

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 ${cfg.hasOverride ? 'border-blue-200' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 text-sm">
              {JOB_TYPE_LABELS[cfg.jobType] ?? cfg.jobType}
            </h3>
            {cfg.hasOverride && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                overridden
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{cfg.effectiveModel}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {cfg.hasOverride && (
            <button
              onClick={() => resetMut.mutate()}
              disabled={busy}
              title="Reset to defaults"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
          <Button
            size="sm"
            disabled={!dirty || busy}
            onClick={() => saveMut.mutate()}
            className="flex items-center gap-1"
          >
            <Save size={12} />
            Save
          </Button>
        </div>
      </div>

      {/* Model tier */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
        {(['FAST', 'DEFAULT', 'HIGH'] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => {
              setDraft((d) => ({
                ...d,
                modelTier: tier,
                thinkingEnabled: tier === 'FAST' ? false : d.thinkingEnabled,
              }))
            }}
            disabled={busy}
            className={`py-1.5 px-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
              draft.modelTier === tier
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {TIER_LABELS[tier]}
          </button>
        ))}
      </div>

      {/* Thinking + tokens row */}
      <div className="flex flex-wrap gap-4">
        {/* Thinking toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={draft.thinkingEnabled}
            onClick={() =>
              thinkingSupported && setDraft((d) => ({ ...d, thinkingEnabled: !d.thinkingEnabled }))
            }
            disabled={!thinkingSupported || busy}
            title={!thinkingSupported ? 'Thinking not supported for FAST tier' : undefined}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
              draft.thinkingEnabled && thinkingSupported ? 'bg-purple-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                draft.thinkingEnabled && thinkingSupported ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
          <span className="text-xs text-gray-700">
            Thinking{!thinkingSupported && ' (FAST tier)'}
          </span>
        </div>

        {/* Thinking budget — only when thinking is on and supported */}
        {thinkingSupported && draft.thinkingEnabled && (
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-600 whitespace-nowrap">Budget tokens</label>
            <input
              type="number"
              min={1024}
              max={100000}
              step={1000}
              value={draft.thinkingBudget}
              onChange={(e) => setDraft((d) => ({ ...d, thinkingBudget: e.target.value }))}
              placeholder={`${cfg.effectiveThinkingBudget}`}
              disabled={busy}
              className="w-24 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        )}

        {/* Max output tokens */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-600 whitespace-nowrap">Max tokens</label>
          <input
            type="number"
            min={256}
            max={isFast ? 8192 : 200000}
            step={256}
            value={draft.maxOutputTokens}
            onChange={(e) => setDraft((d) => ({ ...d, maxOutputTokens: e.target.value }))}
            placeholder={`${cfg.effectiveMaxTokens}`}
            disabled={busy || isFast}
            title={isFast ? 'FAST tier is capped at 8192' : undefined}
            className="w-24 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
          />
          {isFast && <span className="text-[10px] text-gray-400">cap 8192</span>}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobConfigurationPage() {
  const queryClient = useQueryClient()

  const { data: configs = [], isLoading, isError } = useQuery<JobConfigView[]>({
    queryKey: ['job-configs'],
    queryFn: fetchJobConfigs,
  })

  const handleSaved = (updated: JobConfigView) => {
    queryClient.setQueryData<JobConfigView[]>(['job-configs'], (old) =>
      old ? old.map((c) => (c.jobType === updated.jobType ? updated : c)) : [updated]
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Job Configuration"
        subtitle="Configure the AI model tier, extended thinking, and token limits for each job type."
      />

      {isLoading && (
        <div className="text-sm text-gray-500 px-1">Loading configurations…</div>
      )}

      {isError && (
        <div className="text-sm text-red-600 px-1">
          Failed to load job configurations. Make sure you have admin access.
        </div>
      )}

      {configs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {configs.map((cfg: JobConfigView) => (
            <JobCard key={cfg.jobType} cfg={cfg} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </div>
  )
}
