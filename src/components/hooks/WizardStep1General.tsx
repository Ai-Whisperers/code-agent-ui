import type { Dispatch, SetStateAction } from 'react'
import type { AutomationHook } from '@/types/api'
import { TRIGGER_OPTIONS } from './hookConstants'

const inputCls = 'w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]'
const labelCls = 'block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide'

interface Props {
  form: AutomationHook
  setForm: Dispatch<SetStateAction<AutomationHook>>
  selectedCategory: string
}

export function WizardStep1General({ form, setForm, selectedCategory }: Props) {
  const triggers = TRIGGER_OPTIONS.find(o => o.category === selectedCategory)?.triggers ?? []

  return (
    <div className="space-y-5">
      {/* Name + Description */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className={labelCls}>
            Hook Name <span className="text-red-500 font-normal">*</span>
          </label>
          <input
            type="text"
            value={form.name ?? ''}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. update-docs-on-merge"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input
            type="text"
            value={form.description ?? ''}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Brief description of what this hook does"
            className={inputCls}
          />
        </div>
      </div>

      {/* Triggers for the selected category */}
      <div className="space-y-3">
        <label className={labelCls}>
          Triggers <span className="text-red-500 font-normal">*</span>
        </label>

        <div className="space-y-0.5">
          {triggers.map(trigger => {
            const checked = form.triggerTypes?.includes(trigger.value) ?? false
            return (
              <label
                key={trigger.value}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--border-radius-small)] border cursor-pointer transition-colors ${
                  checked
                    ? 'border-[var(--color-buttons-button-primary)] bg-blue-50 dark:bg-blue-900/10'
                    : 'border-transparent hover:border-[var(--color-inputs-input-border)] hover:bg-[var(--color-navigation-menu-item-hover-background)]'
                }`}
              >
                <input
                  type="checkbox"
                  value={trigger.value}
                  checked={checked}
                  onChange={e => {
                    const { value, checked: c } = e.target
                    setForm(p => ({
                      ...p,
                      triggerTypes: c
                        ? [...(p.triggerTypes || []), value]
                        : (p.triggerTypes || []).filter(t => t !== value),
                    }))
                  }}
                  className="shrink-0 accent-[var(--color-buttons-button-primary)]"
                />
                <span className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                  {trigger.label}
                </span>
                <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                  · {trigger.description}
                </span>
              </label>
            )
          })}
        </div>

        {(form.triggerTypes?.length ?? 0) === 0 && (
          <p className="text-xs text-[var(--color-fonts-font-color-support)]">
            Select at least one trigger to continue.
          </p>
        )}
      </div>
    </div>
  )
}
