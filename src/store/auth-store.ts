import { Store } from '@tanstack/react-store'
import { getUserInfo, initKeycloak, login, logout } from '@/lib/keycloak'

export interface AuthUser {
  username: string
  name: string
  email: string
  roles: string[]
}

interface AuthState {
  isInitialized: boolean
  isAuthenticated: boolean
  user: AuthUser | null
}

export const authStore = new Store<AuthState>({
  isInitialized: false,
  isAuthenticated: false,
  user: null,
})

export async function checkAuth(): Promise<void> {
  try {
    const authenticated = await initKeycloak()
    const user = authenticated ? getUserInfo() : null
    authStore.setState(() => ({
      isInitialized: true,
      isAuthenticated: authenticated,
      user,
    }))
  } catch {
    authStore.setState(() => ({
      isInitialized: true,
      isAuthenticated: false,
      user: null,
    }))
  }
}

export function setInitialized(value: boolean): void {
  authStore.setState((s) => ({ ...s, isInitialized: value }))
}

export { login, logout }
