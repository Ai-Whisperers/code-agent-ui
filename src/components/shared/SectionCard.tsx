import { type LucideIcon } from 'lucide-react'

interface SectionCardProps {
  id?: string
  icon?: LucideIcon
  title: string
  children: React.ReactNode
  className?: string
}

export function SectionCard({ id, icon: Icon, title, children, className = '' }: SectionCardProps) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      <div className="rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)]">
          {Icon && (
            <Icon
              size={15}
              className="shrink-0 text-[var(--color-fonts-font-color-brand)]"
            />
          )}
          <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
            {title}
          </h2>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </section>
  )
}
