import { useState, useRef, KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (labels: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  hint?: string
  label?: string
}

/**
 * Multi-value chip/tag input component.
 * Press Enter, Tab, or comma to add a chip. Backspace removes the last chip when input is empty.
 */
export function ChipInput({
  value,
  onChange,
  placeholder = 'Type and press Enter…',
  className = '',
  disabled = false,
  hint,
  label,
}: Props) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addChip = (raw: string) => {
    const trimmed = raw.trim().replace(/,$/, '').trim()
    if (!trimmed || value.includes(trimmed)) {
      setInputValue('')
      return
    }
    onChange([...value, trimmed])
    setInputValue('')
  }

  const removeChip = (idx: number) => {
    const next = [...value]
    next.splice(idx, 1)
    onChange(next)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      e.preventDefault()
      addChip(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeChip(value.length - 1)
    }
  }

  const handleBlur = () => {
    if (inputValue.trim()) addChip(inputValue)
  }

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1">
          {label}
        </label>
      )}
      <div
        className={`flex flex-wrap gap-1.5 items-center min-h-[38px] px-2 py-1.5 rounded bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)] focus-within:ring-2 focus-within:ring-[var(--color-buttons-button-primary)] cursor-text ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((chip, idx) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] border border-[var(--color-borders-border-primary)]"
          >
            <code className="font-mono">{chip}</code>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); removeChip(idx) }}
              className="hover:text-[var(--color-tags-font-critical)] transition-colors"
              aria-label={`Remove ${chip}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] outline-none"
        />
      </div>
      {hint && (
        <p className="mt-1 text-xs text-[var(--color-fonts-font-color-support)]">{hint}</p>
      )}
    </div>
  )
}
