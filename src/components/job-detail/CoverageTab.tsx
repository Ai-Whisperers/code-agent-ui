import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react'
import { TableCard } from '@/components/ui/TableCard'
import type { JobCoverageData, PackageLineCoverage, CoverageSection } from '@/types/api'

function pkgLineRate(p: PackageLineCoverage) {
  const total = p.linesCovered + p.linesMissed
  return total > 0 ? (100 * p.linesCovered) / total : 0
}

function rateBadgeClass(rate: number) {
  const base = 'text-xs font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)]'
  if (rate >= 80) return `${base} bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]`
  if (rate >= 50) return `${base} bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]`
  return `${base} bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]`
}

function deltaBadge(delta: number | null) {
  if (delta === null) return <span className="text-[var(--color-fonts-font-color-support)]">—</span>
  const abs = Math.abs(delta).toFixed(1)
  if (delta > 0.05)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-tags-font-success)]">
        <TrendingUp size={11} />+{abs}%
      </span>
    )
  if (delta < -0.05)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-tags-font-critical)]">
        <TrendingDown size={11} />−{abs}%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-[var(--color-fonts-font-color-support)]">
      <Minus size={11} />{abs}%
    </span>
  )
}

function CoverageMetricCard({ label, before, after }: { label: string; before?: number; after?: number }) {
  const hasAfter = after !== undefined
  const displayVal = hasAfter ? after! : (before ?? 0)
  const showFrom = hasAfter && before !== undefined
  const delta = before != null && after != null ? after - before : null
  const color =
    displayVal >= 80
      ? 'var(--color-status-border-success)'
      : displayVal >= 50
      ? 'var(--color-status-border-attention)'
      : 'var(--color-status-border-critical)'

  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 flex flex-col gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color }}>
          {before !== undefined || after !== undefined ? `${displayVal.toFixed(1)}%` : '—'}
        </span>
        {showFrom && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)] mb-0.5">
            from {before!.toFixed(1)}%
          </span>
        )}
        {!hasAfter && before !== undefined && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)] mb-0.5">baseline</span>
        )}
      </div>
      {delta !== null && (
        <div className="flex items-center gap-1">
          {deltaBadge(delta)}
        </div>
      )}
      <div className="w-full h-1.5 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, displayVal)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

type SortKey = 'name' | 'beforeRate' | 'afterRate' | 'delta'
type SortDir = 'asc' | 'desc'

function CovSortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] cursor-pointer select-none hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? (dir === 'asc' ? <ChevronDown size={11} className="rotate-180" /> : <ChevronDown size={11} />)
          : <ChevronDown size={11} className="opacity-30" />}
      </span>
    </th>
  )
}

interface CoverageTabProps {
  coverageData: JobCoverageData
  qualityReportCoverage?: CoverageSection
}

export function CoverageTab({ coverageData, qualityReportCoverage }: CoverageTabProps) {
  const hasQualityBaseline = qualityReportCoverage != null
  const before: CoverageSection | undefined = hasQualityBaseline
    ? qualityReportCoverage
    : coverageData.before
  const after: CoverageSection | undefined = hasQualityBaseline
    ? (coverageData.after ?? coverageData.before)
    : coverageData.after

  const baselineOnly = after == null

  const [sortKey, setSortKey] = useState<SortKey>('delta')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const mergedPackages = useMemo(() => {
    const map = new Map<string, { before?: PackageLineCoverage; after?: PackageLineCoverage }>()
    for (const p of before?.packages ?? []) {
      map.set(p.name, { before: p })
    }
    for (const p of after?.packages ?? []) {
      const existing = map.get(p.name) ?? {}
      map.set(p.name, { ...existing, after: p })
    }
    return Array.from(map.entries()).map(([name, { before: b, after: a }]) => ({
      name,
      beforeRate: b ? pkgLineRate(b) : null,
      afterRate: a ? pkgLineRate(a) : null,
      delta: b != null && a != null ? pkgLineRate(a) - pkgLineRate(b) : null,
    }))
  }, [before, after])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...mergedPackages].sort((a, b) => {
    let av: number | string, bv: number | string
    if (sortKey === 'name') { av = a.name; bv = b.name }
    else if (sortKey === 'beforeRate') { av = a.beforeRate ?? -1; bv = b.beforeRate ?? -1 }
    else if (sortKey === 'afterRate') { av = a.afterRate ?? -1; bv = b.afterRate ?? -1 }
    else { av = a.delta ?? -999; bv = b.delta ?? -999 }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const improved = mergedPackages.filter(p => (p.delta ?? 0) > 0.05).length
  const regressed = mergedPackages.filter(p => (p.delta ?? 0) < -0.05).length

  const beforeLabel = hasQualityBaseline ? 'Quality Report' : 'Before'
  const afterLabel = 'After'

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CoverageMetricCard label="Line Coverage"   before={before?.lineRate}   after={after?.lineRate} />
        <CoverageMetricCard label="Branch Coverage" before={before?.branchRate} after={after?.branchRate} />
        <CoverageMetricCard label="Method Coverage" before={before?.methodRate} after={after?.methodRate} />
        <CoverageMetricCard label="Class Coverage"  before={before?.classRate}  after={after?.classRate} />
      </div>

      {mergedPackages.length > 0 && (
        <TableCard
          title="Package / Namespace Coverage"
          subtitle={
            mergedPackages.length > 0
              ? `${mergedPackages.length} packages · ${improved} improved · ${regressed} regressed`
              : undefined
          }
          maxHeight="9999px"
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
                <CovSortHeader label="Package / Namespace" sortKey="name"       current={sortKey} dir={sortDir} onSort={handleSort} />
                {baselineOnly ? (
                  <CovSortHeader label={`Coverage (${beforeLabel.toLowerCase()})`} sortKey="beforeRate" current={sortKey} dir={sortDir} onSort={handleSort} />
                ) : (
                  <>
                    <CovSortHeader label={beforeLabel}  sortKey="beforeRate" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <CovSortHeader label={afterLabel}   sortKey="afterRate"  current={sortKey} dir={sortDir} onSort={handleSort} />
                    <CovSortHeader label="Change"       sortKey="delta"      current={sortKey} dir={sortDir} onSort={handleSort} />
                  </>
                )}
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)] w-40">
                  Coverage Bar
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(pkg => {
                const displayRate = baselineOnly ? pkg.beforeRate : pkg.afterRate
                return (
                  <tr
                    key={pkg.name}
                    className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
                  >
                    <td className="px-4 py-1.5 font-mono text-[11px] text-[var(--color-fonts-font-color-primary)] max-w-xs truncate">
                      {pkg.name.replace(/\//g, '.')}
                    </td>
                    {baselineOnly ? (
                      <td className="px-4 py-1.5">
                        {pkg.beforeRate != null
                          ? <span className={rateBadgeClass(pkg.beforeRate)}>{pkg.beforeRate.toFixed(1)}%</span>
                          : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-1.5">
                          {pkg.beforeRate != null
                            ? <span className={rateBadgeClass(pkg.beforeRate)}>{pkg.beforeRate.toFixed(1)}%</span>
                            : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                        </td>
                        <td className="px-4 py-1.5">
                          {pkg.afterRate != null
                            ? <span className={rateBadgeClass(pkg.afterRate)}>{pkg.afterRate.toFixed(1)}%</span>
                            : <span className="text-[var(--color-fonts-font-color-support)]">—</span>}
                        </td>
                        <td className="px-4 py-1.5">
                          {deltaBadge(pkg.delta)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-1.5 w-40">
                      <div className="relative w-full h-2 rounded-full bg-[var(--color-neutral-200)] overflow-hidden">
                        {pkg.beforeRate != null && !baselineOnly && (
                          <div
                            className="absolute h-full rounded-full opacity-30"
                            style={{
                              width: `${Math.min(100, pkg.beforeRate)}%`,
                              backgroundColor: 'var(--color-fonts-font-color-support)',
                            }}
                          />
                        )}
                        {displayRate != null && (
                          <div
                            className="absolute h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, displayRate)}%`,
                              backgroundColor:
                                displayRate >= 80 ? 'var(--color-status-border-success)'
                                : displayRate >= 50 ? 'var(--color-status-border-attention)'
                                : 'var(--color-status-border-critical)',
                            }}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}
