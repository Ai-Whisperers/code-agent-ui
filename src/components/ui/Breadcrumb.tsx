import { ChevronRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const navigate = useNavigate()

  return (
    <nav className="flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-support)]">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="opacity-40 shrink-0" />}
            {item.to && !isLast ? (
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
      })}
    </nav>
  )
}
