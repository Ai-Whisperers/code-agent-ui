import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  statusMessage?: ReactNode
}

export function PageHeader({ title, subtitle, actions, statusMessage }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[var(--color-fonts-font-color-headings)]">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-[var(--color-fonts-font-color-support)]">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {statusMessage && <div className="mt-3">{statusMessage}</div>}
    </div>
  )
}
