import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface FilterSelectOption {
  value: string
  label: string
  /** Optional colored dot shown next to the label */
  dotClass?: string
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  /** Shown when no option is selected */
  placeholder: string
  className?: string
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const isActive = Boolean(value)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const hasDots = options.some((o) => o.dotClass)

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-all ${
          isActive
            ? 'bg-[var(--color-buttons-button-primary)] text-white border-transparent'
            : 'bg-[var(--color-cards-card-background)] border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-support)] hover:border-[var(--color-buttons-button-primary)] hover:text-[var(--color-fonts-font-color-primary)]'
        }`}
      >
        {selected?.dotClass && (
          <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${selected.dotClass}`} />
        )}
        <span className="whitespace-nowrap">{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={11}
          className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-max min-w-full rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg overflow-hidden py-0.5">
          {/* "All" / clear option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors hover:bg-[var(--color-tables-table-hover)] ${
              !value
                ? 'text-[var(--color-fonts-font-color-primary)] font-medium'
                : 'text-[var(--color-fonts-font-color-support)]'
            }`}
          >
            <Check size={10} className={value ? 'opacity-0' : 'opacity-100'} />
            {hasDots && <span className="inline-block w-1.5 h-1.5 shrink-0" />}
            <span className="text-left">{placeholder}</span>
          </button>

          <div className="my-0.5 border-t border-[var(--color-cards-card-stroke)]" />

          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors hover:bg-[var(--color-tables-table-hover)] ${
                value === opt.value
                  ? 'text-[var(--color-fonts-font-color-primary)] font-medium'
                  : 'text-[var(--color-fonts-font-color-support)]'
              }`}
            >
              <Check size={10} className={value === opt.value ? 'opacity-100' : 'opacity-0'} />
              {hasDots && (
                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${opt.dotClass ?? 'opacity-0'}`} />
              )}
              <span className="text-left whitespace-nowrap">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
