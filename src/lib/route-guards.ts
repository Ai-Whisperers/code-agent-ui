import { redirect } from '@tanstack/react-router'
import { authStore } from '@/store/auth-store'

export interface RouteGuardConfig {
  requiredRoles?: string[]
}

export function createRouteGuard(config: RouteGuardConfig) {
  return async () => {
    const { isAuthenticated, user } = authStore.state

    if (!isAuthenticated) {
      throw redirect({ to: '/' })
    }

    if (config.requiredRoles && config.requiredRoles.length > 0) {
      const userRoles = user?.roles ?? []
      const hasRole = config.requiredRoles.some((r) => userRoles.includes(r))
      if (!hasRole) {
        throw redirect({ to: '/access-denied' })
      }
    }
  }
}
