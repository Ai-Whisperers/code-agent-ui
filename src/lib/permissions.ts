/**
 * UI-ONLY: The types, mappings, and helper functions in this file are used exclusively
 * for rendering decisions (showing/hiding UI elements, populating the profile dialog).
 *
 * They are NOT a security boundary. All authorization is enforced server-side via
 * @RolesAllowed annotations backed by Keycloak OIDC tokens.
 */

// ── Keycloak role constants ───────────────────────────────────────────────────

export const KC_ADMIN     = 'app_admin'
export const KC_DEVELOPER = 'app_developer'
export const KC_STAFF     = 'app_staff'
export const KC_USER      = 'app_user'

// ── Application role types ────────────────────────────────────────────────────

export type AppRole = 'USER' | 'STAFF' | 'DEVELOPER' | 'ADMINISTRATOR'

export interface AppRoleMeta {
  label: string
  description: string
  /** Numeric rank — higher value = broader access; used to determine "primary" role */
  rank: number
}

export const APP_ROLE_META: Record<AppRole, AppRoleMeta> = {
  USER: {
    label: 'User',
    description: 'Basic access to view projects and run analysis.',
    rank: 1,
  },
  STAFF: {
    label: 'Staff',
    description: 'Can run analysis; cannot start fix or plan jobs.',
    rank: 2,
  },
  DEVELOPER: {
    label: 'Developer',
    description: 'Can run analysis, fix, and plan jobs.',
    rank: 3,
  },
  ADMINISTRATOR: {
    label: 'Administrator',
    description: 'Full access including settings management and all job types.',
    rank: 4,
  },
}

// ── Permission types ──────────────────────────────────────────────────────────

export type Permission =
  | 'USE_CHAT'
  | 'EXECUTE_ANALYSIS'
  | 'EXECUTE_FIX_JOBS'
  | 'EXECUTE_PLAN_JOBS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_USERS'
  | 'VIEW_ROADMAP'

export interface PermissionMeta {
  label: string
  description: string
  category: string
}

export const PERMISSION_META: Record<Permission, PermissionMeta> = {
  USE_CHAT: {
    label: 'Use chat',
    description: 'Use the AI chat assistant.',
    category: 'Chat',
  },
  EXECUTE_ANALYSIS: {
    label: 'Run analysis',
    description: 'Trigger read-only analysis jobs.',
    category: 'Analysis',
  },
  EXECUTE_FIX_JOBS: {
    label: 'Run fix jobs',
    description: 'Start fix jobs that modify code.',
    category: 'Jobs',
  },
  EXECUTE_PLAN_JOBS: {
    label: 'Run plan jobs',
    description: 'Start plan jobs that propose changes.',
    category: 'Jobs',
  },
  MANAGE_SETTINGS: {
    label: 'Manage settings',
    description: 'Change global or workspace settings.',
    category: 'Administration',
  },
  MANAGE_USERS: {
    label: 'Manage users',
    description: 'Manage users and invitations.',
    category: 'Administration',
  },
  VIEW_ROADMAP: {
    label: 'View roadmap',
    description: 'Access the product roadmap and Jira readiness reviews.',
    category: 'Analysis',
  },
}

export const PERMISSION_CATEGORY_ORDER = ['Chat', 'Analysis', 'Jobs', 'Administration']

// ── Role → permission mapping (mirrors backend PermissionResolver) ────────────

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  USER:          ['USE_CHAT', 'EXECUTE_ANALYSIS'],
  STAFF:         ['USE_CHAT', 'EXECUTE_ANALYSIS', 'VIEW_ROADMAP'],
  DEVELOPER:     ['USE_CHAT', 'EXECUTE_ANALYSIS', 'EXECUTE_FIX_JOBS', 'EXECUTE_PLAN_JOBS', 'VIEW_ROADMAP'],
  ADMINISTRATOR: ['USE_CHAT', 'EXECUTE_ANALYSIS', 'EXECUTE_FIX_JOBS', 'EXECUTE_PLAN_JOBS', 'MANAGE_SETTINGS', 'MANAGE_USERS', 'VIEW_ROADMAP'],
}

// ── Mapping functions ─────────────────────────────────────────────────────────

/**
 * Maps raw Keycloak role names (from both realm_access and resource_access) to
 * internal AppRoles. Mirrors backend RoleMapper logic exactly.
 *
 * - app_developer takes priority over app_staff when both are present
 * - USER is always included as the baseline
 */
export function mapKcRolesToAppRoles(realmRoles: string[], clientRoles: string[]): AppRole[] {
  const allRoles = new Set([...realmRoles, ...clientRoles])
  const result = new Set<AppRole>(['USER'])

  if (allRoles.has(KC_ADMIN))     result.add('ADMINISTRATOR')
  if (allRoles.has(KC_DEVELOPER)) {
    result.add('DEVELOPER')
  } else if (allRoles.has(KC_STAFF)) {
    result.add('STAFF')
  }

  return Array.from(result)
}

/**
 * Resolves the union of permissions across all assigned app roles.
 * Mirrors backend PermissionResolver logic exactly.
 */
export function resolvePermissions(appRoles: AppRole[]): Set<Permission> {
  const result = new Set<Permission>()
  for (const role of appRoles) {
    for (const p of ROLE_PERMISSIONS[role]) {
      result.add(p)
    }
  }
  return result
}

export function hasPermission(permissions: Set<Permission> | Permission[], p: Permission): boolean {
  if (Array.isArray(permissions)) return permissions.includes(p)
  return permissions.has(p)
}

/**
 * Returns the single "primary" app role — the one with the highest rank.
 * Used for display purposes (profile dialog badge, menu filtering).
 */
export function primaryRole(appRoles: AppRole[]): AppRole {
  return appRoles.reduce((best, r) =>
    APP_ROLE_META[r].rank > APP_ROLE_META[best].rank ? r : best,
    'USER' as AppRole
  )
}
