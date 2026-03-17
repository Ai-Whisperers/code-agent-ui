import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { JobType, RepoSettings } from '@/types/api'

const BITBUCKET_BASE_URL = import.meta.env.VITE_BITBUCKET_URL ?? 'https://bitbucket.org'

interface FieldConfig {
  name: string
  label: string
  required: boolean
  type?: string
  isPathParam?: boolean
}

interface JobTypeConfig {
  label: string
  endpoint: string
  repoFilter: (repo: RepoSettings) => boolean
  fields: FieldConfig[]
}

const JOB_TYPE_CONFIG: Record<string, JobTypeConfig> = {
  FIX: {
    label: 'Fix (AI-driven code fix)',
    endpoint: '/run-fix',
    repoFilter: (r) => !r.archived,
    fields: [
      { name: 'jiraKey', label: 'JIRA Key (optional)', required: false },
      { name: 'prompt', label: 'Prompt / description', required: false, type: 'textarea' },
      { name: 'branchName', label: 'Branch name (optional)', required: false },
      { name: 'targetBranch', label: 'Target branch (optional)', required: false },
    ],
  },
  REVIEW: {
    label: 'Review PR',
    endpoint: '/review-pr',
    repoFilter: (r) => !r.archived && r.reviewEnabled,
    fields: [
      { name: 'prId', label: 'PR ID', required: true },
    ],
  },
  GENERATE_TESTS: {
    label: 'Generate Tests',
    endpoint: '/generate-tests',
    repoFilter: (r) => !r.archived,
    fields: [
      { name: 'branchName', label: 'Branch name (optional)', required: false },
    ],
  },
  GENERATE_DOCS: {
    label: 'Generate Docs',
    endpoint: '/generate-docs',
    repoFilter: (r) => !r.archived && r.docsEnabled,
    fields: [
      { name: 'branchName', label: 'Branch name (optional)', required: false },
    ],
  },
  METRICS: {
    label: 'Metrics (Cyclomatic Complexity)',
    endpoint: '/plans/improve-quality',
    repoFilter: (r) => !r.archived,
    fields: [
      { name: 'branch', label: 'Branch', required: true },
      { name: 'targetBranch', label: 'Target branch (optional)', required: false },
    ],
  },
  QUALITY_REPORT: {
    label: 'Quality Report',
    endpoint: '/metrics/quality-reports/{workspace}/{repoSlug}/{branch}',
    repoFilter: (r) => !r.archived && r.qualityReportEnabled,
    fields: [
      { name: 'branch', label: 'Branch', required: true, isPathParam: true },
    ],
  },
  SYNC_CONFLUENCE: {
    label: 'Sync to Confluence',
    endpoint: '/sync-confluence',
    repoFilter: (r) => !r.archived && r.docsEnabled,
    fields: [
      { name: 'branchName', label: 'Branch name (optional)', required: false },
    ],
  },
}

const SUPPORTED_TYPES = Object.keys(JOB_TYPE_CONFIG) as JobType[]

export default function NewJob() {
  const navigate = useNavigate()
  const [jobType, setJobType] = useState<string>(SUPPORTED_TYPES[0])
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const config = JOB_TYPE_CONFIG[jobType]

  const { data: allRepos = [], isLoading: reposLoading } = useQuery<RepoSettings[]>({
    queryKey: ['repos'],
    queryFn: () => api.get('/settings/repos').then((r) => r.data),
  })

  const filteredRepos = allRepos.filter(config.repoFilter)
  const selectedRepo = filteredRepos.find((r) => String(r.id) === selectedRepoId) ?? null

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedRepo) throw new Error('Please select a repository')

      const repoUrl =
        selectedRepo.gitPlatformUrl ??
        `${BITBUCKET_BASE_URL}/${selectedRepo.workspace}/${selectedRepo.repoSlug}.git`

      const pathData: Record<string, string> = {
        workspace: selectedRepo.workspace,
        repoSlug: selectedRepo.repoSlug,
      }
      const bodyData: Record<string, string> = { repoUrl }

      config.fields.forEach((field) => {
        const val = formData[field.name]
        if (!val) return
        if (field.isPathParam) {
          pathData[field.name] = val
        } else {
          bodyData[field.name] = val
        }
      })

      let endpoint = config.endpoint
      Object.entries(pathData).forEach(([k, v]) => {
        endpoint = endpoint.replace(`{${k}}`, encodeURIComponent(v))
      })

      return api.post(endpoint, bodyData).then((r) => r.data)
    },
    onSuccess: (data: { jobId?: string }) => {
      if (data?.jobId) {
        navigate({ to: '/jobs/$id', params: { id: data.jobId } })
      } else {
        navigate({ to: '/jobs' })
      }
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to submit job')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <main>
      <div className="mb-4">
        <button
          onClick={() => navigate({ to: '/jobs' })}
          className="flex items-center gap-1.5 text-sm text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Jobs
        </button>
      </div>

      <PageHeader title="New Job" subtitle="Trigger a new agent job." />

      <div className="max-w-xl bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-6 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Job type selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
              Job Type
            </label>
            <div className="relative">
              <select
                value={jobType}
                onChange={(e) => {
                  setJobType(e.target.value)
                  setSelectedRepoId('')
                  setFormData({})
                }}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              >
                {SUPPORTED_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {JOB_TYPE_CONFIG[t].label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-icons-icon)]" />
            </div>
          </div>

          {/* Repository selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
              Repository <span className="text-[var(--color-status-border-critical)]">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                required
                disabled={reposLoading}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] disabled:opacity-50"
              >
                <option value="">
                  {reposLoading
                    ? 'Loading repositories…'
                    : filteredRepos.length === 0
                      ? 'No repositories available'
                      : 'Select a repository…'}
                </option>
                {filteredRepos.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.workspace}/{r.repoSlug}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-icons-icon)]" />
            </div>
            {!reposLoading && filteredRepos.length === 0 && (
              <p className="mt-1 text-xs text-[var(--color-fonts-font-color-support)]">
                No repositories are configured for this job type.
              </p>
            )}
          </div>

          {/* Dynamic fields */}
          {config.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                {field.label}
                {field.required && <span className="text-[var(--color-status-border-critical)] ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={formData[field.name] ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, [field.name]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
                  placeholder={`Enter ${field.label.toLowerCase()}…`}
                />
              ) : (
                <input
                  type="text"
                  value={formData[field.name] ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, [field.name]: e.target.value }))}
                  required={field.required}
                  className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                  placeholder={`Enter ${field.label.toLowerCase()}…`}
                />
              )}
            </div>
          ))}

          {error && (
            <p className="text-sm text-[var(--color-status-border-critical)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !selectedRepoId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--border-radius-button)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
          >
            <Send size={15} />
            {mutation.isPending ? 'Submitting…' : 'Submit Job'}
          </button>
        </form>
      </div>
    </main>
  )
}
