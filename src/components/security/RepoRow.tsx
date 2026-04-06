import { useState } from 'react'
import { ChevronDown, FolderGit2, Container, Code2 } from 'lucide-react'
import { IssueTable } from '@/components/security/IssueTable'
import { CreateFixAllButton } from '@/components/security/CreateFixAllButton'
import { Tooltip } from '@/components/ui/Tooltip'
import type { RepoSecuritySummary } from '@/types/api'

interface RepoRowProps {
  repo: RepoSecuritySummary
  defaultOpen?: boolean
}

function CountPill({
  count,
  variant,
  kind,
}: {
  count: number
  variant: 'critical' | 'high'
  kind: 'software' | 'container'
}) {
  if (count === 0) return null
  const cls =
    variant === 'critical'
      ? 'bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]'
      : 'bg-[var(--color-tags-warning-background)] text-[var(--color-tags-font-warning)]'
  const label = variant === 'critical' ? 'C' : 'H'
  const kindLabel = kind === 'container' ? ' (container)' : ' (software)'
  const tip =
    variant === 'critical'
      ? `${count} critical${kindLabel} vulnerabilit${count !== 1 ? 'ies' : 'y'} — fix within 7 days`
      : `${count} high${kindLabel} vulnerabilit${count !== 1 ? 'ies' : 'y'} — fix within 30 days`
  const Icon = kind === 'container' ? Container : Code2
  return (
    <Tooltip text={tip}>
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold cursor-default ${cls}`}>
        <Icon size={9} />
        {count}{label}
      </span>
    </Tooltip>
  )
}

export function RepoRow({ repo, defaultOpen = false }: RepoRowProps) {
  const [open, setOpen] = useState(defaultOpen)

  const hasIssues = repo.issues.length > 0

  const accentColor =
    repo.softwareCriticalCount > 0 ? '#dc2626' :
    repo.containerCriticalCount > 0 ? '#dc2626' :
    repo.softwareHighCount > 0     ? '#f97316' :
    repo.containerHighCount > 0    ? '#f97316' :
    'var(--color-cards-card-stroke)'

  return (
    <div
      className="rounded-[var(--border-radius-card)] shadow-sm overflow-hidden border-l-4"
      style={{ borderLeftColor: accentColor }}
    >
      {/* Repo header row */}
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-cards-card-background-hover)] transition-colors">
        <button
          className="flex items-center gap-3 text-left flex-1 min-w-0"
          onClick={() => hasIssues && setOpen((o) => !o)}
          disabled={!hasIssues}
        >
          <FolderGit2 size={14} className="text-[var(--color-icons-icon)] shrink-0" />
          <span className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] flex-1 truncate">
            {repo.repoSlug}
          </span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <CountPill count={repo.softwareCriticalCount} variant="critical" kind="software" />
          <CountPill count={repo.containerCriticalCount} variant="critical" kind="container" />
          <CountPill count={repo.softwareHighCount} variant="high" kind="software" />
          <CountPill count={repo.containerHighCount} variant="high" kind="container" />
          {repo.issues.length > 0 && (
            <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
              {repo.issues.length} issue{repo.issues.length !== 1 ? 's' : ''}
            </span>
          )}
          <CreateFixAllButton issues={repo.issues} />
          {hasIssues && (
            <button
              className="p-0.5 rounded hover:bg-[var(--color-cards-card-background-hover)]"
              onClick={() => setOpen((o) => !o)}
            >
              <ChevronDown
                size={13}
                className={`text-[var(--color-icons-icon)] transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Container image chips */}
      {repo.containers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-1.5">
          {repo.containers.map((img) => (
            <Tooltip key={img} text={`Container image with vulnerabilities: ${img}`}>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] cursor-default">
                <Container size={10} />
                {img}
              </span>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Issue table — indented under the repo row */}
      {open && hasIssues && (
        <div className="border-t border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)]">
          <IssueTable issues={repo.issues} />
        </div>
      )}
    </div>
  )
}
