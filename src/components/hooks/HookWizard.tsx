import { useState } from 'react'
import { X, ArrowLeft, ArrowRight, Save, Check } from 'lucide-react'
import type { AutomationHook } from '@/types/api'
import { TRIGGER_OPTIONS, getTriggerLabel } from './hookConstants'
import { WizardStep1General } from './WizardStep1General'
import { WizardStep2Filters } from './WizardStep2Filters'
import { WizardStep3Actions } from './WizardStep3Actions'

type WizardStep = 1 | 2 | 3

interface Props {
  hook: AutomationHook
  initialCategory?: string
  onSave: (h: AutomationHook) => void
  onCancel: () => void
  isSaving: boolean
}

export function HookWizard({ hook, initialCategory, onSave, onCancel, isSaving }: Props) {
  const REVIEW_ACTIONS = ['review_epic', 'review_feature', 'review_userstory']

  const [step, setStep] = useState<WizardStep>(1)

  // When editing a hook whose actionType is a review type, treat it as execute_job
  // and pre-populate jobName so the correct radio is selected inside the panel.
  const [form, setForm] = useState<AutomationHook>(() => {
    if (REVIEW_ACTIONS.includes(hook.actionType ?? '')) {
      return { ...hook, jobName: hook.actionType! }
    }
    return hook
  })

  const [selectedCategory] = useState(() => {
    if (initialCategory) return initialCategory
    if (form.triggerTypes?.length) {
      const opt = TRIGGER_OPTIONS.find(o => o.triggers.some(t => form.triggerTypes!.includes(t.value)))
      return opt?.category ?? 'SCM'
    }
    return 'SCM'
  })

  const [selectedActions, setSelectedActions] = useState<string[]>(() => {
    if (form.actionType) {
      // Review action types are displayed as execute_job + a job-type sub-option
      const types = form.actionType.split(',').map(s => s.trim()).filter(Boolean)
      return types.map(t => REVIEW_ACTIONS.includes(t) ? 'execute_job' : t)
    }
    if (form.prompt) return ['ai_prompt']
    return []
  })

  // Derived flags
  const needsCronExpr     = !!form.triggerTypes?.includes('cron')
  const needsPrEvent      = !!form.triggerTypes?.includes('pr_event')
  const hasScmTriggers    = !!form.triggerTypes?.some(t => t.startsWith('scm.') || t === 'pr_event')
  const hasAikidoTriggers   = !!form.triggerTypes?.some(t => t.startsWith('aikido.'))
  const hasJiraTriggers     = !!form.triggerTypes?.some(t => t.startsWith('jira.'))
  const hasQualityTriggers  = !!form.triggerTypes?.some(t => t.startsWith('quality.'))

  const toggleAction = (id: string) =>
    setSelectedActions(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id])

  const canNextStep1 = !!form.name?.trim() && (form.triggerTypes?.length ?? 0) > 0
  const canSave =
    !!form.name?.trim() &&
    (form.triggerTypes?.length ?? 0) > 0 &&
    selectedActions.length > 0 &&
    (!selectedActions.includes('ai_prompt') || !!form.prompt?.trim())

  function handleSave() {
    // When execute_job is selected and the chosen job type is a review action,
    // persist the review type as actionType so the backend can route correctly.
    const isReviewJobSelected = selectedActions.includes('execute_job')
      && REVIEW_ACTIONS.includes(form.jobName ?? '')
    const finalActionType = isReviewJobSelected
      ? form.jobName!
      : selectedActions.join(',')
    onSave({ ...form, actionType: finalActionType })
  }

  const prevStep = () => setStep(s => Math.max(1, s - 1) as WizardStep)
  const nextStep = () => setStep(s => Math.min(3, s + 1) as WizardStep)

  // Subtitle: show trigger context on steps 2 and 3
  const triggerContext = form.triggerTypes?.length
    ? `${selectedCategory} · ${form.triggerTypes.map(getTriggerLabel).join(', ')}`
    : null

  const STEPS: { n: WizardStep; label: string }[] = [
    { n: 1, label: 'General' },
    { n: 2, label: 'Filters' },
    { n: 3, label: 'Actions' },
  ]

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal card */}
      <div className="relative bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-fonts-font-color-headings)]">
              {form.name || 'New Hook'}
            </h3>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
              {triggerContext ?? 'Configure automation hook'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center px-6 py-4 shrink-0">
          {STEPS.map((s, idx) => (
            <div key={s.n} className={`flex items-center ${idx < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <button
                type="button"
                onClick={() => step > s.n && setStep(s.n)}
                disabled={step <= s.n}
                className="flex items-center gap-2 disabled:cursor-default"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  step === s.n
                    ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-buttons-button-primary)] text-white'
                    : step > s.n
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'border-[var(--color-inputs-input-border)] bg-transparent text-[var(--color-fonts-font-color-support)]'
                }`}>
                  {step > s.n ? <Check size={12} /> : s.n}
                </div>
                <span className={`text-sm font-medium ${
                  step === s.n
                    ? 'text-[var(--color-buttons-button-primary)]'
                    : step > s.n
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-[var(--color-fonts-font-color-support)]'
                }`}>
                  {s.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 transition-colors ${
                  step > s.n ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-[var(--color-inputs-input-border)]'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step Content ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
          {step === 1 && (
            <WizardStep1General
              form={form}
              setForm={setForm}
              selectedCategory={selectedCategory}
            />
          )}
          {step === 2 && (
            <WizardStep2Filters
              form={form}
              setForm={setForm}
              hasScmTriggers={hasScmTriggers}
              hasAikidoTriggers={hasAikidoTriggers}
              hasJiraTriggers={hasJiraTriggers}
              hasQualityTriggers={hasQualityTriggers}
              needsCronExpr={needsCronExpr}
              needsPrEvent={needsPrEvent}
            />
          )}
          {step === 3 && (
            <WizardStep3Actions
              form={form}
              setForm={setForm}
              selectedActions={selectedActions}
              toggleAction={toggleAction}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-cards-card-stroke)] shrink-0">
          <button
            type="button"
            onClick={step === 1 ? onCancel : prevStep}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-sm font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
          >
            <ArrowLeft size={14} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-fonts-font-color-support)]">
              Step {step} of 3
            </span>
            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 && !canNextStep1}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
              >
                Next
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !canSave}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
              >
                <Save size={14} />
                {isSaving ? 'Saving…' : 'Save Hook'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
