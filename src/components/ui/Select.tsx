import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const selected = options.find((o) => o.value === value)

  // Close on outside click (trigger or dropdown)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !triggerRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Compute fixed position whenever the dropdown opens or the viewport changes
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(openAbove
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  return (
    <div ref={triggerRef} className={`relative ${className ?? ''}`}>
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

      {/* Dropdown rendered via portal so it escapes overflow-hidden ancestors */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="rounded bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] shadow-lg overflow-auto py-0.5 max-h-56"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false) }}
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
        </div>,
        document.body,
      )}
    </div>
  )
}
