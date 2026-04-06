import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

/**
 * Minimal popup page that handles the OAuth redirect after a user authorises
 * (or denies) an OAuth 2.0 connection.
 *
 * Flow:
 *  1. Backend redirects the user's browser here with ?status=success|error&provider=…&message=…
 *  2. This page immediately posts a message to its opener (the ProfileDialog popup handler)
 *  3. The popup closes itself after 1.5 seconds so the user sees brief feedback
 *
 * If there is no opener (user navigated here directly), the page shows the status
 * and offers a "Close tab" button.
 */
export default function OAuthCallbackPage() {
  const [status, setStatus]   = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('')
  const [hasOpener, setHasOpener] = useState(false)

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const st       = (params.get('status') ?? 'error') as 'success' | 'error'
    const msg      = params.get('message') ?? 'Unknown error'
    const provider = params.get('provider') ?? 'jira'

    setStatus(st)
    setMessage(msg)
    setHasOpener(!!window.opener)

    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'oauth-callback', status: st, message: msg, provider },
          window.location.origin,
        )
      } catch {
        // Opener may have closed — ignore
      }
      // Give user brief visual feedback before closing
      setTimeout(() => window.close(), 1500)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-page-background)] p-6">
      <div className="text-center space-y-4 max-w-sm">
        {status === 'pending' && (
          <Loader2
            size={40}
            className="animate-spin text-[var(--color-buttons-button-primary)] mx-auto"
          />
        )}
        {status === 'success' && (
          <CheckCircle
            size={40}
            className="text-[var(--color-status-text-active)] mx-auto"
          />
        )}
        {status === 'error' && (
          <XCircle
            size={40}
            className="text-[var(--color-status-text-critical)] mx-auto"
          />
        )}

        <p
          className={`text-sm font-medium ${
            status === 'success'
              ? 'text-[var(--color-status-text-active)]'
              : status === 'error'
                ? 'text-[var(--color-status-text-critical)]'
                : 'text-[var(--color-fonts-font-color-primary)]'
          }`}
        >
          {status === 'pending' && 'Completing authentication…'}
          {status === 'success' && message}
          {status === 'error'   && message}
        </p>

        {hasOpener && status !== 'pending' && (
          <p className="text-xs text-[var(--color-fonts-font-color-support)]">
            This window will close automatically…
          </p>
        )}

        {!hasOpener && status !== 'pending' && (
          <button
            onClick={() => window.close()}
            className="text-sm px-4 py-2 rounded bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
          >
            Close tab
          </button>
        )}
      </div>
    </div>
  )
}
