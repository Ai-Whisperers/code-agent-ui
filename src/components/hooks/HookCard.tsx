import { useState } from 'react'
import { Power, Trash2 } from 'lucide-react'
import type { AutomationHook } from '@/types/api'
import { getCategories, subTriggerLabel, CATEGORY_COLORS } from './hookConstants'

interface Props {
  hook: AutomationHook
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  isToggling: boolean
  isDeleting: boolean
}

export function HookCard({ hook, onEdit, onToggle, onDelete, isToggling, isDeleting }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const categories = getCategories(hook.triggerTypes)
  const subLabel = subTriggerLabel(hook)

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    } else {
      onDelete()
    }
  }

  return (
    <div className="flex items-center justify-between bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-5 py-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex flex-wrap gap-1 mt-0.5 shrink-0">
          {categories.map(cat => (
            <span
              key={cat}
              className={`inline-flex items-center px-2 py-0.5 rounded-[var(--border-radius-tag)] text-xs font-semibold ${CATEGORY_COLORS[cat]}`}
            >
              {cat}
            </span>
          ))}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)] truncate">
            {hook.name}
          </p>
          {hook.description && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 truncate">
              {hook.description}
            </p>
          )}
          {subLabel && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 font-mono opacity-70">
              {subLabel}
            </p>
          )}
          {hook.triggerFilter && Object.keys(hook.triggerFilter).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {hook.triggerFilter.repoSlug &&
                hook.triggerFilter.repoSlug.split(',').map(r => r.trim()).filter(Boolean).map(r => (
                  <span key={r} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    repo:{r}
                  </span>
                ))}
              {hook.triggerFilter.severity && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                  sev:{hook.triggerFilter.severity}
                </span>
              )}
              {hook.triggerFilter.issueType && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                  type:{hook.triggerFilter.issueType}
                </span>
              )}
              {hook.triggerFilter.projectKeys && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  projects:{hook.triggerFilter.projectKeys}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button
          onClick={onToggle}
          disabled={isToggling}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] text-xs font-medium transition-colors disabled:opacity-60 ${
            hook.enabled
              ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] hover:opacity-80'
              : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] hover:opacity-80'
          }`}
        >
          <Power size={12} />
          {hook.enabled ? 'Enabled' : 'Disabled'}
        </button>

        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
        >
          Edit
        </button>

        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          title={confirmDelete ? 'Click again to confirm deletion' : 'Delete hook'}
          className={`p-1.5 rounded-[var(--border-radius-button-small)] transition-colors disabled:opacity-60 ${
            confirmDelete
              ? 'bg-[var(--color-status-critical-background)] text-[var(--color-status-border-critical)]'
              : 'text-[var(--color-icons-icon)] hover:bg-[var(--color-status-critical-background)] hover:text-[var(--color-status-border-critical)]'
          }`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
