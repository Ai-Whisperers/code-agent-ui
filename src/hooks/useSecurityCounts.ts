import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { SecurityCountsResponse } from '@/types/api'

/**
 * Polls GET /security/issues/counts every 2 minutes.
 * Returns { criticals, highs } for sidebar badge display.
 * Only call this hook when the user has the VIEW_SECURITY permission.
 */
export function useSecurityCounts() {
  return useQuery<SecurityCountsResponse>({
    queryKey: ['security-counts'],
    queryFn: () => api.get<SecurityCountsResponse>('/security/issues/counts').then((r) => r.data),
    refetchInterval: 120_000,
    staleTime: 60_000,
  })
}
