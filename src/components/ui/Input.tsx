import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`px-2 py-1 text-xs rounded border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] placeholder:text-[var(--color-fonts-font-color-support)] hover:border-[var(--color-buttons-button-primary)] focus:border-[var(--color-buttons-button-primary)] focus:outline-none transition-all ${className}`}
    />
  )
}
