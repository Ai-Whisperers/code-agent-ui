import type { LatestVersionsResponse } from '@/types/api'

type VersionStatus = 'up-to-date' | 'warning' | 'critical'

export function parseSemver(v: string): [number, number, number] {
  const parts = v
    .replace(/^v/, '')
    .split('.')
    .map((p) => {
      const n = parseInt(p, 10)
      return isNaN(n) ? 0 : n
    })
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

export function getVersionStatus(current: string, latest: string): VersionStatus {
  const [cMaj, cMin, cPat] = parseSemver(current)
  const [lMaj, lMin, lPat] = parseSemver(latest)

  if (lMaj !== cMaj) return 'critical'

  if (lMin !== cMin) {
    const diff = lMin - cMin
    if (diff <= 0) return 'up-to-date'
    if (diff <= 3) return 'warning'
    return 'critical'
  }

  const diff = lPat - cPat
  if (diff <= 0) return 'up-to-date'
  if (diff <= 3) return 'warning'
  return 'critical'
}

export function isVersionOutdated(
  version: string | undefined,
  archetype: string | undefined,
  latestVersions: LatestVersionsResponse | undefined,
): boolean {
  if (!version || !archetype || !latestVersions) return false
  const latest = latestVersions[archetype]
  if (!latest) return false
  return getVersionStatus(version, latest) !== 'up-to-date'
}
