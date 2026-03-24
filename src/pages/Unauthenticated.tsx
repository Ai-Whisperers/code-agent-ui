import { LogIn } from 'lucide-react'
import { login } from '@/store/auth-store'
import codeAgentLogo from '@/assets/code-agent-logo.png'

export default function Unauthenticated() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-page-background)]">
      <div className="text-center max-w-sm px-6">
        <img
          src={codeAgentLogo}
          alt="Code Agent"
          className="w-14 h-14 object-contain mx-auto mb-5 opacity-80"
        />
        <h1 className="text-xl font-semibold text-[var(--color-fonts-font-color-headings)] mb-2">
          Sign in required
        </h1>
        <p className="text-sm text-[var(--color-fonts-font-color-support)] mb-7">
          Your session has expired or you are not signed in. Please sign in to continue.
        </p>
        <button
          onClick={() => login()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--border-radius-button)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
        >
          <LogIn size={15} />
          Sign in
        </button>
      </div>
    </div>
  )
}
