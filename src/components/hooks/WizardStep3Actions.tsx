import { useState } from 'react'
import { Sparkles, MessageCircle } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { AutomationHook } from '@/types/api'
import { ACTION_TYPES } from './hookConstants'
import { AiPromptAssistant } from './AiPromptAssistant'
import { RadioGroup } from '@/components/ui/RadioGroup'
import type { RadioOption } from '@/components/ui/RadioGroup'

const inputCls = 'w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'
const labelCls = 'block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide'

// ── Segmented control ─────────────────────────────────────────────────────────

interface SegmentedOption { value: string; label: string }
function SegmentedControl({
  options, value, onChange,
}: { options: SegmentedOption[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-[var(--color-buttons-button-back)]">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-[var(--color-buttons-button-primary)] text-white shadow-sm'
              : 'text-[var(--color-fonts-font-color-buttons)] hover:text-[var(--color-fonts-font-color-primary)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Job types ─────────────────────────────────────────────────────────────────

const JOB_TYPES: RadioOption[] = [
  {
    value: 'QUALITY_REPORT',
    label: 'Quality Report',
    description: 'Clone, run quality measurements (coverage, linting, security, complexity) and persist a score',
  },
  {
    value: 'GENERATE_TESTS',
    label: 'Generate Tests',
    description: 'Scan the codebase for uncovered classes and generate unit tests automatically',
  },
  {
    value: 'METRICS',
    label: 'Complexity Metrics',
    description: 'Calculate cyclomatic complexity and flag methods exceeding the threshold',
  },
  {
    value: 'FIX',
    label: 'Code Fix',
    description: 'Apply a code fix driven by a Jira issue or custom prompt, then open a PR',
  },
  { separator: true, label: 'Roadmap Reviews' },
  {
    value: 'review_epic',
    label: 'Review Epic',
    description: 'AI readiness review for a Jira Epic — triggered by a Jira issue event',
  },
  {
    value: 'review_feature',
    label: 'Review Feature',
    description: 'AI readiness review for a Jira Feature — triggered by a Jira issue event',
  },
  {
    value: 'review_userstory',
    label: 'Review User Story',
    description: 'AI readiness review for a Jira User Story — triggered by a Jira issue event',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  form: AutomationHook
  setForm: Dispatch<SetStateAction<AutomationHook>>
  selectedActions: string[]
  toggleAction: (id: string) => void
}

export function WizardStep3Actions({ form, setForm, selectedActions, toggleAction }: Props) {
  const [showAiAssistant, setShowAiAssistant] = useState(false)

  const branchOptions: SegmentedOption[] = [
    { value: 'main', label: 'main' },
    { value: 'develop', label: 'develop' },
  ]

  return (
    <div className="space-y-5">

      {/* Action type pills */}
      <div>
        <label className={labelCls}>
          Target Action(s) <span className="text-red-500 font-normal">*</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_TYPES.map(action => {
            const Icon = action.icon
            const isSelected = selectedActions.includes(action.id)
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => toggleAction(action.id)}
                title={action.description}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--border-radius-button-small)] text-xs font-medium border transition-colors ${
                  isSelected
                    ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-buttons-button-primary)] text-white'
                    : 'border-[var(--color-inputs-input-border)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:border-[var(--color-buttons-button-primary)] hover:bg-[var(--color-buttons-button-back-hover)]'
                }`}
              >
                <Icon size={12} />
                {action.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* AI Prompt section */}
      {selectedActions.includes('ai_prompt') && (
        <div className="space-y-3 p-4 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)]">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide">
              AI Prompt
            </h5>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAiAssistant(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
              >
                <Sparkles size={12} />
                Assistant
              </button>
              <button
                type="button"
                onClick={() => setShowAiAssistant(true)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
              >
                <MessageCircle size={12} />
                Chat
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={form.prompt ?? ''}
            onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))}
            placeholder="Describe what the AI should do when this hook triggers…"
            className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-cards-card-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
          />

          {showAiAssistant && (
            <AiPromptAssistant
              triggerTypes={form.triggerTypes}
              onUse={prompt => setForm(p => ({ ...p, prompt }))}
              onClose={() => setShowAiAssistant(false)}
            />
          )}
        </div>
      )}

      {/* Execute Job — job type selector */}
      {selectedActions.includes('execute_job') && (
        <div className="p-4 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] space-y-3">
          <h5 className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide">
            Job Type
          </h5>
          <RadioGroup
            options={JOB_TYPES}
            value={form.jobName ?? ''}
            onChange={(v) => setForm(p => ({ ...p, jobName: v }))}
          />
        </div>
      )}

      {/* Branch from + New branch name + Commit Direct */}
      <div className="space-y-4 pt-1 border-t border-[var(--color-cards-card-stroke)]">
        <div>
          <label className={labelCls}>Branch from</label>
          <div className="flex items-center gap-3">
            <SegmentedControl
              options={branchOptions}
              value={form.targetBranch && ['main', 'develop'].includes(form.targetBranch) ? form.targetBranch : 'develop'}
              onChange={v => setForm(p => ({ ...p, targetBranch: v }))}
            />
            <input
              type="text"
              value={!form.targetBranch || ['main', 'develop'].includes(form.targetBranch) ? '' : form.targetBranch}
              onChange={e => setForm(p => ({ ...p, targetBranch: e.target.value || 'develop' }))}
              placeholder="or custom branch…"
              className="flex-1 px-3 py-1.5 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>New branch name</label>
          <input
            type="text"
            value={form.newBranchName ?? ''}
            onChange={e => setForm(p => ({ ...p, newBranchName: e.target.value }))}
            placeholder="agent/changes"
            className={inputCls}
          />
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5">
            The agent creates this branch from the base branch above.
          </p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.commitDirect ?? false}
            onChange={e => setForm(p => ({ ...p, commitDirect: e.target.checked }))}
            className="rounded accent-[var(--color-buttons-button-primary)]"
          />
          <span className="text-sm text-[var(--color-fonts-font-color-primary)]">
            Commit directly (skip PR creation)
          </span>
        </label>
      </div>
    </div>
  )
}
