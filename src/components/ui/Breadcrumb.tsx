import { ChevronRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Tooltip } from '@/components/ui/Tooltip'

export interface BreadcrumbItem {
  label: string
  to?: string
  href?: string
  badge?: { text: React.ReactNode; className?: string }
  tooltip?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const navigate = useNavigate()

  return (
    <nav className={`flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-support)]${className ? ` ${className}` : ''}`}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1

        const inner = (
          <span className="flex items-center gap-1">
            {item.badge && (
              <span className={item.badge.className ?? ''}>{item.badge.text}</span>
            )}
            {item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-fonts-font-color-primary)] hover:underline underline-offset-2 transition-colors"
              >
                {item.label}
              </a>
            ) : item.to && !isLast ? (
              <button
                onClick={() => navigate({ to: item.to! })}
                className="hover:text-[var(--color-fonts-font-color-primary)] hover:underline underline-offset-2 transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-[var(--color-fonts-font-color-primary)] font-medium' : ''}>
                {item.label}
              </span>
            )}
          </span>
        )

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="opacity-40 shrink-0" />}
            {item.tooltip ? (
              <Tooltip text={item.tooltip}>{inner}</Tooltip>
            ) : (
              inner
            )}
          </span>
        )
      })}
    </nav>
  )
}
