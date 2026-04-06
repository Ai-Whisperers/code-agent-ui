import { useState } from 'react'
import { ChevronDown, Code2, Container } from 'lucide-react'
import { TableCard } from '@/components/ui/TableCard'
import { RepoRow } from '@/components/security/RepoRow'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ProductSecuritySummary } from '@/types/api'

const CONTAINER_ISSUE_TYPES = new Set(['container', 'container_security'])

interface ProductRowProps {
  product: ProductSecuritySummary
  severityFilter: string
  slaFilter: string
  typeFilter: string
}

export function ProductRow({ product, severityFilter, slaFilter, typeFilter }: ProductRowProps) {
  const [open, setOpen] = useState(true)

  const swCriticals   = product.repos.reduce((sum, r) => sum + (r.softwareCriticalCount ?? 0), 0)
  const swHighs       = product.repos.reduce((sum, r) => sum + (r.softwareHighCount ?? 0), 0)
  const ctnCriticals  = product.repos.reduce((sum, r) => sum + (r.containerCriticalCount ?? 0), 0)
  const ctnHighs      = product.repos.reduce((sum, r) => sum + (r.containerHighCount ?? 0), 0)

  function matchesTypeFilter(issueType: string | undefined) {
    if (!typeFilter) return true
    const isContainer = issueType
      ? CONTAINER_ISSUE_TYPES.has(issueType.toLowerCase())
      : false
    if (typeFilter === 'container') return isContainer
    if (typeFilter === 'software') return !isContainer
    return true
  }

  const visibleRepos = product.repos.filter((repo) => {
    const issues = repo.issues.filter((issue) => {
      if (severityFilter && issue.severity.toLowerCase() !== severityFilter.toLowerCase()) return false
      if (slaFilter && issue.slaStatus !== slaFilter) return false
      if (!matchesTypeFilter(issue.issueType)) return false
      return true
    })
    return issues.length > 0
  })

  if (visibleRepos.length === 0) return null

  const repoCount = `${visibleRepos.length} repo${visibleRepos.length !== 1 ? 's' : ''}`

  return (
    <TableCard
      title={product.displayName}
      subtitle={repoCount}
      maxHeight="auto"
      toolbar={
        <div className="flex items-center gap-1.5">
          {swCriticals > 0 && (
            <Tooltip text={`${swCriticals} critical software vulnerabilit${swCriticals !== 1 ? 'ies' : 'y'}`}>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]">
                <Code2 size={9} />{swCriticals}C
              </span>
            </Tooltip>
          )}
          {ctnCriticals > 0 && (
            <Tooltip text={`${ctnCriticals} critical container vulnerabilit${ctnCriticals !== 1 ? 'ies' : 'y'}`}>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]">
                <Container size={9} />{ctnCriticals}C
              </span>
            </Tooltip>
          )}
          {swHighs > 0 && (
            <Tooltip text={`${swHighs} high software vulnerabilit${swHighs !== 1 ? 'ies' : 'y'}`}>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold bg-[var(--color-tags-warning-background)] text-[var(--color-tags-font-warning)]">
                <Code2 size={9} />{swHighs}H
              </span>
            </Tooltip>
          )}
          {ctnHighs > 0 && (
            <Tooltip text={`${ctnHighs} high container vulnerabilit${ctnHighs !== 1 ? 'ies' : 'y'}`}>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold bg-[var(--color-tags-warning-background)] text-[var(--color-tags-font-warning)]">
                <Container size={9} />{ctnHighs}H
              </span>
            </Tooltip>
          )}
          <button
            className="p-0.5 rounded hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
            onClick={() => setOpen((o) => !o)}
            title={open ? 'Collapse' : 'Expand'}
          >
            <ChevronDown
              size={14}
              className={`text-[var(--color-icons-icon)] transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      }
    >
      {open && (
        <div className="flex flex-col gap-2 p-2">
          {visibleRepos.map((repo) => {
            const filteredIssues = repo.issues.filter((issue) => {
              if (severityFilter && issue.severity.toLowerCase() !== severityFilter.toLowerCase()) return false
              if (slaFilter && issue.slaStatus !== slaFilter) return false
              if (!matchesTypeFilter(issue.issueType)) return false
              return true
            })
            return (
              <RepoRow
                key={repo.repoSlug}
                repo={{ ...repo, issues: filteredIssues }}
                defaultOpen={filteredIssues.length <= 10}
              />
            )
          })}
        </div>
      )}
    </TableCard>
  )
}
