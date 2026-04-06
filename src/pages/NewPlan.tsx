import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Send, GitMerge, Wand2, Zap, FileCode2, Layers } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { TableCard } from '@/components/ui/TableCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { RepoCombobox } from '@/components/plan/RepoCombobox'
import { JiraCombobox } from '@/components/plan/JiraCombobox'
import api from '@/lib/api'

type PlanSource = 'custom' | 'jira' | 'quality' | 'rewrite'

type RewriteMode = 'full_rewrite' | 'framework_migration' | 'extraction'

const REWRITE_MODE_OPTIONS = [
  { value: 'full_rewrite',        label: 'Full Rewrite' },
  { value: 'framework_migration', label: 'Framework Migration' },
  { value: 'extraction',          label: 'Microservice Extraction' },
]

const REWRITE_MODE_META: Record<RewriteMode, { icon: React.ReactNode; description: string }> = {
  full_rewrite: {
    icon: <FileCode2 size={14} />,
    description: 'Rewrite the entire codebase in a different language or stack (e.g. PHP → C# .NET).',
  },
  framework_migration: {
    icon: <Layers size={14} />,
    description: 'Migrate to a different framework within the same language (e.g. Angular → React).',
  },
  extraction: {
    icon: <GitMerge size={14} />,
    description: 'Extract a bounded context or module into a standalone microservice.',
  },
}

export default function NewPlan() {
  const navigate = useNavigate()
  const [source, setSource] = useState<PlanSource>('custom')

  const [form, setForm] = useState({
    specText: '',
    repoUrl: '',
    targetBranch: 'develop',
    jiraKey: '',
    // rewrite-specific
    sourceRepoUrl: '',
    sourceLanguage: '',
    targetLanguage: '',
    rewriteMode: 'full_rewrite' as RewriteMode,
    scopeHint: '',
  })

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
      if (source === 'rewrite') {
        return api.post('/plans', {
          specText: form.specText,
          repoUrl: form.repoUrl,
          targetBranch: form.targetBranch,
          sourceType: 'FREE_TEXT',
          sourceRepoUrl: form.sourceRepoUrl,
          sourceLanguage: form.sourceLanguage || undefined,
          targetLanguage: form.targetLanguage || undefined,
          rewriteMode: form.rewriteMode,
          scopeHint: form.scopeHint || undefined,
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

  const TAB_LABELS: Record<PlanSource, string> = {
    custom:  'Custom',
    jira:    'From JIRA',
    quality: 'Quality Plan',
    rewrite: 'Rewrite / Migrate',
  }

  const isRewrite = source === 'rewrite'
  const rewriteModeMeta = REWRITE_MODE_META[form.rewriteMode]

  return (
    <main>
      <PageHeader
        title="New Plan"
        subtitle="Create a new execution plan."
        actions={
          <Button
            variant="ghost"
            size="md"
            icon={<ArrowLeft size={15} />}
            onClick={() => navigate({ to: '/plans' })}
          >
            Back to Plans
          </Button>
        }
      />

      <TableCard
        title="Plan Configuration"
        maxHeight="none"
        className={`mx-auto ${isRewrite ? 'max-w-2xl' : 'max-w-xl'}`}
      >
        {/* Source tabs */}
        <div className="flex border-b border-[var(--color-borders-border-primary)]">
          {(['custom', 'jira', 'quality', 'rewrite'] as PlanSource[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSource(s); setError(null) }}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                source === s
                  ? 'text-[var(--color-buttons-button-primary)] border-[var(--color-buttons-button-primary)]'
                  : 'text-[var(--color-fonts-font-color-support)] border-transparent hover:text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {s === 'rewrite' && <Wand2 size={11} className="shrink-0" />}
              {TAB_LABELS[s]}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            mutation.mutate()
          }}
          className="space-y-4 p-5 pt-4"
        >
          {source === 'jira' ? (
            <JiraCombobox value={form.jiraKey} onChange={set('jiraKey')} required />
          ) : source === 'rewrite' ? (
            <RewriteFields
              form={form}
              field={field}
              set={set}
              rewriteModeMeta={rewriteModeMeta}
            />
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

          <Button
            type="submit"
            variant="primary"
            size="lg"
            icon={isRewrite ? <Zap size={15} /> : <Send size={15} />}
            loading={mutation.isPending}
          >
            {mutation.isPending
              ? 'Creating…'
              : isRewrite
              ? 'Generate Rewrite Plan'
              : 'Create Plan'}
          </Button>
        </form>
      </TableCard>
    </main>
  )
}

// ── Rewrite tab ──────────────────────────────────────────────────────────────

interface RewriteFieldsProps {
  form: {
    specText: string
    repoUrl: string
    targetBranch: string
    sourceRepoUrl: string
    sourceLanguage: string
    targetLanguage: string
    rewriteMode: RewriteMode
    scopeHint: string
  }
  field: (name: 'specText' | 'sourceLanguage' | 'targetLanguage' | 'scopeHint' | 'targetBranch') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  set: (name: 'repoUrl' | 'sourceRepoUrl' | 'rewriteMode') => (value: string) => void
  rewriteModeMeta: { icon: React.ReactNode; description: string }
}

function RewriteFields({ form, field, set, rewriteModeMeta }: RewriteFieldsProps) {
  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div>
        <label className={labelClass()}>Rewrite Mode <span className="text-[var(--color-status-border-critical)] ml-1">*</span></label>
        <Select
          value={form.rewriteMode}
          onChange={set('rewriteMode')}
          options={REWRITE_MODE_OPTIONS}
        />
        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded bg-[var(--color-tags-neutral-background)] border border-[var(--color-borders-border-primary)]">
          <span className="mt-0.5 shrink-0 text-[var(--color-fonts-font-color-support)]">{rewriteModeMeta.icon}</span>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] leading-relaxed">{rewriteModeMeta.description}</p>
        </div>
      </div>

      {/* Repo row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass()}>
            Source Repository
            <span className="text-[var(--color-status-border-critical)] ml-1">*</span>
            <span className="ml-1.5 normal-case font-normal text-[var(--color-fonts-font-color-support)]">(read-only)</span>
          </label>
          <RepoCombobox
            value={form.sourceRepoUrl}
            onChange={set('sourceRepoUrl')}
            required
            allowFreeText
            label={null}
          />
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
            Cloned read-only using the git credentials from System Settings.
          </p>
        </div>
        <div>
          <label className={labelClass()}>
            Target Repository
            <span className="text-[var(--color-status-border-critical)] ml-1">*</span>
            <span className="ml-1.5 normal-case font-normal text-[var(--color-fonts-font-color-support)]">(write)</span>
          </label>
          <RepoCombobox value={form.repoUrl} onChange={set('repoUrl')} required label={null} />
        </div>
      </div>

      {/* Language hints row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass()}>Source Language / Framework</label>
          <input
            type="text"
            value={form.sourceLanguage}
            onChange={field('sourceLanguage')}
            placeholder="e.g. php/laravel, typescript/angular"
            className={inputClass()}
          />
        </div>
        <div>
          <label className={labelClass()}>Target Language / Framework</label>
          <input
            type="text"
            value={form.targetLanguage}
            onChange={field('targetLanguage')}
            placeholder="e.g. dotnet/csharp, typescript/react"
            className={inputClass()}
          />
        </div>
      </div>

      {/* Target branch */}
      <div>
        <label className={labelClass()}>Target Branch</label>
        <input
          type="text"
          value={form.targetBranch}
          onChange={field('targetBranch')}
          placeholder="develop"
          className={inputClass()}
        />
      </div>

      {/* Scope hint — only shown for extraction mode */}
      {form.rewriteMode === 'extraction' && (
        <div>
          <label className={labelClass()}>
            Scope / Bounded Context
            <span className="text-[var(--color-status-border-critical)] ml-1">*</span>
          </label>
          <input
            type="text"
            value={form.scopeHint}
            onChange={field('scopeHint')}
            required
            placeholder="e.g. Order management module, /src/orders/**"
            className={inputClass()}
          />
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
            Describe the module or bounded context to extract into its own service.
          </p>
        </div>
      )}

      {/* Spec / instructions */}
      <SpecField
        label="Instructions"
        value={form.specText}
        onChange={field('specText')}
        placeholder={
          form.rewriteMode === 'extraction'
            ? 'Describe any additional requirements for the extracted microservice…'
            : 'Describe any additional requirements or constraints for the rewrite…'
        }
      />
    </div>
  )
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function labelClass() {
  return 'block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide'
}

function inputClass() {
  return 'w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] transition-colors'
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
      <Input
        type="text"
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2 text-sm"
      />
    </div>
  )
}
