import type { LatestVersionsResponse } from '@/types/api'
import { getVersionStatus } from '@/lib/version'

const BADGE_BASE = 'text-xs font-semibold px-2 py-0.5 rounded-[var(--border-radius-tag)]'
const GREEN = `${BADGE_BASE} bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]`
const ORANGE = `${BADGE_BASE} bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]`
const RED = `${BADGE_BASE} bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]`

function badgeClass(status: 'up-to-date' | 'warning' | 'critical'): string {
  if (status === 'up-to-date') return GREEN
  if (status === 'warning') return ORANGE
  return RED
}

interface VersionBadgeProps {
  version?: string
  archetype?: string
  latestVersions?: LatestVersionsResponse
}

export function VersionBadge({ version, archetype, latestVersions }: VersionBadgeProps) {
  if (!version) {
    return <span className="text-[var(--color-fonts-font-color-support)]">—</span>
  }

  const latest = archetype && latestVersions ? latestVersions[archetype] : undefined

  if (!latest) {
    return <span className="text-[var(--color-fonts-font-color-support)]">{version}</span>
  }

  const status = getVersionStatus(version, latest)
  const isOutdated = status !== 'up-to-date'

  return (
    <span className="relative inline-flex group">
      <span className={badgeClass(status)}>{version}</span>
      {isOutdated && (
        <span
          className="
            pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
            whitespace-nowrap rounded px-2 py-1
            bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)]
            text-xs text-[var(--color-fonts-font-color-primary)] shadow-md
            opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50
          "
        >
          Latest: {latest}
        </span>
      )}
    </span>
  )
}
