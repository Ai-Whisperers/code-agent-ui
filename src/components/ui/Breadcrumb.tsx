import { ChevronRight } from 'lucide-react'
import { Tooltip } from './Tooltip'

export interface BreadcrumbItem {
  /** Primary text label (e.g. issue key) */
  label: string
  /** Optional badge displayed before the label */
  badge?: {
    text: string
    className: string
  }
  /** Tooltip text shown on hover (bottom position) */
  tooltip?: string
  /** When provided the item becomes a link */
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

function BreadcrumbNode({ item }: { item: BreadcrumbItem }) {
  const inner = (
    <span className="flex items-center gap-1 text-[10px]">
      {item.badge && (
        <span className={`inline-flex items-center font-medium px-1 py-0 rounded-[var(--border-radius-tag)] text-[9px] ${item.badge.className}`}>
          {item.badge.text}
        </span>
      )}
      <span className="font-mono text-[var(--color-fonts-font-color-brand)]">{item.label}</span>
    </span>
  )

  const linked = item.href ? (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="hover:opacity-75 transition-opacity"
    >
      {inner}
    </a>
  ) : inner

  return item.tooltip ? (
    <Tooltip text={item.tooltip} position="bottom">
      {linked}
    </Tooltip>
  ) : linked
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  if (items.length === 0) return null

  return (
    <div className={`flex items-center gap-1 flex-nowrap overflow-hidden ${className}`}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1 min-w-0">
          {i > 0 && (
            <ChevronRight size={10} className="shrink-0 text-[var(--color-fonts-font-color-support)] opacity-50" />
          )}
          <span className="shrink-0">
            <BreadcrumbNode item={item} />
          </span>
        </span>
      ))}
    </div>
  )
}
