import Keycloak from 'keycloak-js'

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
  return {
    username: (tokenParsed['preferred_username'] as string) ?? '',
    name: (tokenParsed['name'] as string) ?? '',
    email: (tokenParsed['email'] as string) ?? '',
    roles: (keycloak.realmAccess?.roles ?? []) as string[],
  }
}

export default keycloak
