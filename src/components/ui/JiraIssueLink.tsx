import { ExternalLink } from 'lucide-react'

interface JiraIssueLinkProps {
  issueKey: string
  jiraBaseUrl: string
  className?: string
}

/**
 * Renders an issue key as a clickable external link to Jira when a base URL is
 * available and the key is not synthetic (NEW-* / VIRTUAL-*). Falls back to a
 * plain <span> when no URL can be built.
 *
 * Must NOT be nested inside a <button> — uses window.open() via onClick so it
 * works correctly regardless of the parent element type.
 */
export function JiraIssueLink({ issueKey, jiraBaseUrl, className = '' }: JiraIssueLinkProps) {
  const isSynthetic = issueKey.startsWith('NEW-') || issueKey.startsWith('VIRTUAL-')
  const url = jiraBaseUrl && !isSynthetic ? `${jiraBaseUrl}/browse/${issueKey}` : null

  if (!url) {
    return <span className={className}>{issueKey}</span>
  }

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        window.open(url, '_blank', 'noopener,noreferrer')
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation()
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      }}
      className={`inline-flex items-center gap-0.5 cursor-pointer hover:underline underline-offset-2 ${className}`}
    >
      {issueKey}
      <ExternalLink size={10} className="opacity-50 shrink-0" />
    </span>
  )
}
