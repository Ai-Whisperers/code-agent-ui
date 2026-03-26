import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Shown when no option is selected */
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={`flex items-center gap-1.5 w-full px-3 py-2 text-sm rounded border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          open
            ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)]'
            : 'bg-[var(--color-cards-card-background)] border-[var(--color-cards-card-stroke)] hover:border-[var(--color-buttons-button-primary)] hover:text-[var(--color-fonts-font-color-primary)]'
        }`}
      >
        <span
          className={`flex-1 text-left truncate ${
            selected
              ? 'text-[var(--color-fonts-font-color-user-input)]'
              : 'text-[var(--color-fonts-font-color-support)]'
          }`}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-[var(--color-icons-icon)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg overflow-hidden py-0.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-tables-table-hover)] ${
                value === opt.value
                  ? 'text-[var(--color-fonts-font-color-primary)] font-medium'
                  : 'text-[var(--color-fonts-font-color-support)]'
              }`}
            >
              <Check size={11} className={`shrink-0 ${value === opt.value ? 'opacity-100' : 'opacity-0'}`} />
              <span className="text-left whitespace-nowrap">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
