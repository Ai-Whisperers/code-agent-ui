import { useEffect, useRef } from 'react'
import { GitBranch, Ticket, BookOpen, ShieldAlert, Clock, MessageSquare, BarChart2, X } from 'lucide-react'
import type { FC } from 'react'

type HookType = {
  category: string
  icon: FC<{ size?: number; className?: string }>
  description: string
  accent: string
}

const HOOK_TYPES: HookType[] = [
  { category: 'SCM',        icon: GitBranch,    description: 'PR events, branch merges',      accent: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  { category: 'Jira',       icon: Ticket,       description: 'Issue lifecycle events',         accent: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { category: 'Confluence', icon: BookOpen,     description: 'Page create / update events',   accent: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400' },
  { category: 'Aikido',     icon: ShieldAlert,  description: 'Security vulnerabilities',       accent: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' },
  { category: 'Schedule',   icon: Clock,        description: 'Time-based / cron triggers',    accent: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400' },
  { category: 'Teams',      icon: MessageSquare, description: 'Microsoft Teams messages',      accent: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400' },
  { category: 'Quality',    icon: BarChart2,     description: 'Quality report thresholds',     accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
]

interface Props {
  onSelect: (category: string) => void
  onClose: () => void
}

export function HookTypeMenu({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 z-50 w-72 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-cards-card-stroke)]">
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide">
          Select hook type
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Options */}
      <div className="py-1">
        {HOOK_TYPES.map(({ category, icon: Icon, description, accent }) => (
          <button
            key={category}
            type="button"
            onClick={() => { onSelect(category); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors"
          >
            <div className={`p-1.5 rounded-md shrink-0 ${accent}`}>
              <Icon size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                {category}
              </div>
              <div className="text-xs text-[var(--color-fonts-font-color-support)]">
                {description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
