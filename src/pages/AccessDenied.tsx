import { useNavigate } from '@tanstack/react-router'
import { ShieldX } from 'lucide-react'

export default function AccessDenied() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-page-background)]">
      <div className="text-center max-w-md px-6">
        <ShieldX size={56} className="mx-auto mb-4 text-[var(--color-status-border-critical)]" />
        <h1 className="mb-2">Access Denied</h1>
        <p className="text-[var(--color-fonts-font-color-support)] mb-6">
          You don't have permission to view this page.
        </p>
        <button
          className="px-5 py-2.5 rounded-[var(--border-radius-button)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
          onClick={() => navigate({ to: '/' })}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
