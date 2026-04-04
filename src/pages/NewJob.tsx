import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
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
  const searchParams = new URLSearchParams(window.location.search)
  const initialType = SUPPORTED_TYPES.includes(searchParams.get('type') ?? '') ? (searchParams.get('type') as string) : SUPPORTED_TYPES[0]
  const initialPrompt = searchParams.get('prompt') ?? ''

  const [jobType, setJobType] = useState<string>(initialType)
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, string>>(initialPrompt ? { prompt: initialPrompt } : {})
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

  const JOB_TYPE_OPTIONS: SelectOption[] = SUPPORTED_TYPES.map((t) => ({
    value: t,
    label: JOB_TYPE_CONFIG[t].label,
  }))

  const repoOptions: SelectOption[] = filteredRepos.map((r) => ({
    value: String(r.id),
    label: `${r.workspace}/${r.repoSlug}`,
  }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <main>
      <PageHeader
        title="New Job"
        subtitle="Trigger a new agent job."
        actions={
          <Button
            variant="ghost"
            size="md"
            icon={<ArrowLeft size={15} />}
            onClick={() => navigate({ to: '/jobs' })}
          >
            Back to Jobs
          </Button>
        }
      />

      <TableCard title="Job Configuration" maxHeight="none" className="max-w-xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Job type selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
              Job Type
            </label>
            <Select
              value={jobType}
              onChange={(val) => {
                setJobType(val)
                setSelectedRepoId('')
                setFormData({})
              }}
              options={JOB_TYPE_OPTIONS}
            />
          </div>

          {/* Repository selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
              Repository <span className="text-[var(--color-status-border-critical)]">*</span>
            </label>
            <Select
              value={selectedRepoId}
              onChange={setSelectedRepoId}
              options={repoOptions}
              placeholder={
                reposLoading
                  ? 'Loading repositories…'
                  : filteredRepos.length === 0
                    ? 'No repositories available'
                    : 'Select a repository…'
              }
              disabled={reposLoading || filteredRepos.length === 0}
            />
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
                <Input
                  type="text"
                  value={formData[field.name] ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, [field.name]: e.target.value }))}
                  required={field.required}
                  className="w-full px-3 py-2 text-sm"
                  placeholder={`Enter ${field.label.toLowerCase()}…`}
                />
              )}
            </div>
          ))}

          {error && (
            <p className="text-sm text-[var(--color-status-border-critical)]">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={<Send size={15} />}
            loading={mutation.isPending}
            disabled={!selectedRepoId}
          >
            {mutation.isPending ? 'Submitting…' : 'Submit Job'}
          </Button>
        </form>
      </TableCard>
    </main>
  )
}
