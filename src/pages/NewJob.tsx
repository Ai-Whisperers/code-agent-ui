import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ChevronDown, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { JobType } from '@/types/api'

const JOB_TYPE_CONFIG: Record<
  string,
  { endpoint: string; fields: { name: string; label: string; required: boolean; type?: string }[] }
> = {
  FIX: {
    endpoint: '/run-fix',
    fields: [
      { name: 'repoUrl', label: 'Repository URL', required: true },
      { name: 'jiraKey', label: 'JIRA Key (optional)', required: false },
      { name: 'prompt', label: 'Prompt / description', required: false, type: 'textarea' },
      { name: 'branchName', label: 'Branch name (optional)', required: false },
      { name: 'targetBranch', label: 'Target branch (optional)', required: false },
    ],
  },
  REVIEW: {
    endpoint: '/review-pr',
    fields: [
      { name: 'repoUrl', label: 'Repository URL', required: true },
      { name: 'prId', label: 'PR ID', required: true },
    ],
  },
  GENERATE_TESTS: {
    endpoint: '/generate-tests',
    fields: [
      { name: 'repoUrl', label: 'Repository URL', required: true },
      { name: 'branchName', label: 'Branch name (optional)', required: false },
    ],
  },
  GENERATE_DOCS: {
    endpoint: '/generate-docs',
    fields: [
      { name: 'repoUrl', label: 'Repository URL', required: true },
      { name: 'branchName', label: 'Branch name (optional)', required: false },
    ],
  },
  METRICS: {
    endpoint: '/run-fix',
    fields: [
      { name: 'repoUrl', label: 'Repository URL', required: true },
      { name: 'branchName', label: 'Branch name (optional)', required: false },
    ],
  },
}

const SUPPORTED_TYPES = Object.keys(JOB_TYPE_CONFIG) as JobType[]

export default function NewJob() {
  const navigate = useNavigate()
  const [jobType, setJobType] = useState<string>(SUPPORTED_TYPES[0])
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const config = JOB_TYPE_CONFIG[jobType]

  const mutation = useMutation({
    mutationFn: () => api.post(config.endpoint, formData).then((r) => r.data),
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
                  setFormData({})
                }}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              >
                {SUPPORTED_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-icons-icon)]" />
            </div>
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
            disabled={mutation.isPending}
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
