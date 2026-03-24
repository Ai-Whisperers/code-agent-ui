import Keycloak from 'keycloak-js'
import { mapKcRolesToAppRoles, resolvePermissions, type AppRole, type Permission } from '@/lib/permissions'

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
})

let _initPromise: Promise<boolean> | null = null

export async function initKeycloak(): Promise<boolean> {
  if (_initPromise) return _initPromise
  _initPromise = keycloak.init({
    onLoad: 'login-required',
    checkLoginIframe: false,
    scope: 'openid email profile',
  })
  return _initPromise
}

export async function login(): Promise<void> {
  return keycloak.login()
}

export async function logout(): Promise<void> {
  return keycloak.logout({ redirectUri: window.location.origin })
}

export function getToken(): string | undefined {
  return keycloak.token
}

export async function refreshToken(): Promise<boolean> {
  return keycloak.updateToken(30)
}

export function getUserInfo() {
  const tokenParsed = keycloak.tokenParsed
  if (!tokenParsed) return null

  const realmRoles: string[] = keycloak.realmAccess?.roles ?? []
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string | undefined
  const clientRoles: string[] = (clientId ? keycloak.resourceAccess?.[clientId]?.roles : undefined) ?? []

  const appRoles: AppRole[] = mapKcRolesToAppRoles(realmRoles, clientRoles)
  const permissionsSet: Set<Permission> = resolvePermissions(appRoles)
  const permissions: Permission[] = Array.from(permissionsSet)

  // Groups claim requires an explicit KC group mapper; default to [] if absent
  const groups: string[] = Array.isArray(tokenParsed['groups'])
    ? (tokenParsed['groups'] as string[])
    : []

  const kcRoles: string[] = [...new Set([...realmRoles, ...clientRoles])]

  return {
    username: (tokenParsed['preferred_username'] as string) ?? '',
    name: (tokenParsed['name'] as string) ?? '',
    email: (tokenParsed['email'] as string) ?? '',
    sub: (tokenParsed['sub'] as string) ?? '',
    roles: realmRoles,
    kcRoles,
    groups,
    appRoles,
    permissions,
  }
}

export default keycloak
