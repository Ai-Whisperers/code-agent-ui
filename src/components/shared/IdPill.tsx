interface IdPillProps {
  id: string
  className?: string
}

export function IdPill({ id, className = '' }: IdPillProps) {
  return (
    <code
      className={`inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] border border-[var(--color-borders-border-primary)] ${className}`}
    >
      {id}
    </code>
  )
}
