import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { TableCard } from '@/components/ui/TableCard'
import { RepoRow } from '@/components/security/RepoRow'
import type { ProductSecuritySummary } from '@/types/api'

interface ProductRowProps {
  product: ProductSecuritySummary
  severityFilter: string
  slaFilter: string
}

export function ProductRow({ product, severityFilter, slaFilter }: ProductRowProps) {
  const [open, setOpen] = useState(true)

  const totalCriticals = product.repos.reduce((sum, r) => sum + r.criticalCount, 0)
  const totalHighs = product.repos.reduce((sum, r) => sum + r.highCount, 0)

  const visibleRepos = product.repos.filter((repo) => {
    const issues = repo.issues.filter((issue) => {
      if (severityFilter && issue.severity.toLowerCase() !== severityFilter.toLowerCase()) return false
      if (slaFilter && issue.slaStatus !== slaFilter) return false
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
          {totalCriticals > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold bg-[var(--color-tags-danger-background)] text-[var(--color-tags-font-danger)]">
              {totalCriticals} C
            </span>
          )}
          {totalHighs > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--border-radius-tag)] text-[10px] font-bold bg-[var(--color-tags-warning-background)] text-[var(--color-tags-font-warning)]">
              {totalHighs} H
            </span>
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
