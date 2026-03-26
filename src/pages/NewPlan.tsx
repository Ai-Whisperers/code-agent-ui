import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { RepoCombobox } from '@/components/plan/RepoCombobox'
import { JiraCombobox } from '@/components/plan/JiraCombobox'
import api from '@/lib/api'

type PlanSource = 'custom' | 'jira' | 'quality'

export default function NewPlan() {
  const navigate = useNavigate()
  const [source, setSource] = useState<PlanSource>('custom')
  const [form, setForm] = useState({ specText: '', repoUrl: '', targetBranch: 'develop', jiraKey: '' })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (source === 'jira') {
        return api.post(`/plans/from-jira/${form.jiraKey}`, {
          repoUrl: form.repoUrl,
          targetBranch: form.targetBranch,
        }).then((r) => r.data)
      }
      if (source === 'quality') {
        return api.post('/plans/improve-quality', {
          repoUrl: form.repoUrl,
          branch: form.targetBranch,
          targetBranch: form.targetBranch,
        }).then((r) => r.data)
      }
      return api.post('/plans', {
        specText: form.specText,
        repoUrl: form.repoUrl,
        targetBranch: form.targetBranch,
        sourceType: 'FREE_TEXT',
      }).then((r) => r.data)
    },
    onSuccess: (data: { planId?: string }) => {
      if (data?.planId) {
        navigate({ to: '/plans/$id', params: { id: data.planId } })
      } else {
        navigate({ to: '/plans' })
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? (err instanceof Error ? err.message : 'Failed to create plan'))
    },
  })

  const field = (name: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [name]: e.target.value }))

  const set = (name: keyof typeof form) => (value: string) =>
    setForm((p) => ({ ...p, [name]: value }))

  return (
    <main>
      <div className="mb-4">
        <button
          onClick={() => navigate({ to: '/plans' })}
          className="flex items-center gap-1.5 text-sm text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Plans
        </button>
      </div>

      <PageHeader title="New Plan" subtitle="Create a new execution plan." />

      <div className="max-w-xl bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-6 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        {/* Source tabs */}
        <div className="flex gap-1 mb-5 p-1 bg-[var(--color-filters-segmented-control-background)] rounded-lg">
          {(['custom', 'jira', 'quality'] as PlanSource[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                source === s
                  ? 'bg-[var(--color-filters-segmented-control-active)] text-[var(--color-fonts-font-color-buttons)] shadow-sm'
                  : 'text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {s === 'jira' ? 'From JIRA' : s === 'quality' ? 'Quality Plan' : 'Custom'}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            mutation.mutate()
          }}
          className="space-y-4"
        >
          {source === 'jira' ? (
            <JiraCombobox value={form.jiraKey} onChange={set('jiraKey')} required />
          ) : (
            <>
              {source === 'custom' && (
                <SpecField
                  label="Specification"
                  value={form.specText}
                  onChange={field('specText')}
                  placeholder="Describe what you want the agent to implement…"
                  required
                />
              )}
              <RepoCombobox
                value={form.repoUrl}
                onChange={set('repoUrl')}
                required
                filterQualityEnabled={source === 'quality'}
              />
              <InputField label="Target Branch" value={form.targetBranch} onChange={field('targetBranch')} />
            </>
          )}

          {error && (
            <p className="text-sm text-[var(--color-status-border-critical)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--border-radius-button)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
          >
            <Send size={15} />
            {mutation.isPending ? 'Creating…' : 'Create Plan'}
          </button>
        </form>
      </div>
    </main>
  )
}

function labelClass() {
  return 'block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide'
}

function inputClass() {
  return 'w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'
}

function SpecField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className={labelClass()}>
        {label}
        {required && <span className="text-[var(--color-status-border-critical)] ml-1">*</span>}
      </label>
      <textarea
        value={value}
        onChange={onChange}
        required={required}
        rows={5}
        placeholder={placeholder}
        maxLength={10000}
        className={`${inputClass()} resize-y min-h-[80px]`}
      />
      <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1 text-right">
        {value.length}/10,000
      </p>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  required,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
}) {
  return (
    <div>
      <label className={labelClass()}>
        {label}
        {required && <span className="text-[var(--color-status-border-critical)] ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        required={required}
        className={inputClass()}
      />
    </div>
  )
}
