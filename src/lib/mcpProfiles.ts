import api from '@/lib/api'

export interface LinkedAccount {
  provider: string
  baseUrl: string
  username: string
  apiToken: string
}

export interface LinkedAccountResponse {
  provider: string
  displayName: string | null
  baseUrl: string
  username: string
  apiTokenMasked: string
  /** "oauth" | "apitoken" */
  authType: string
  createdAt: string | null
  updatedAt: string | null
}

export interface SystemConfig {
  jira: { baseUrl: string; username: string }
  confluence: { baseUrl: string; username: string }
  xray: { baseUrl: string }
}

export interface OAuthStatus {
  atlassian: boolean
}

export const mcpProfilesApi = {
  getSystemConfig(): Promise<SystemConfig> {
    return api.get('/mcp/profiles/system-config').then((r) => r.data)
  },

  getOAuthStatus(): Promise<OAuthStatus> {
    return api.get('/mcp/profiles/oauth/status').then((r) => r.data)
  },

  list(): Promise<LinkedAccountResponse[]> {
    return api.get('/mcp/profiles').then((r) => r.data)
  },

  get(provider: string): Promise<LinkedAccountResponse> {
    return api.get(`/mcp/profiles/${provider}`).then((r) => r.data)
  },

  upsert(provider: string, account: LinkedAccount): Promise<LinkedAccountResponse> {
    return api.put(`/mcp/profiles/${provider}`, account).then((r) => r.data)
  },

  delete(provider: string): Promise<void> {
    return api.delete(`/mcp/profiles/${provider}`).then(() => undefined)
  },

  testConnection(provider: string): Promise<{ success: boolean; message: string }> {
    return api.post(`/mcp/profiles/${provider}/test`).then((r) => r.data)
  },

  /**
   * Returns the Atlassian OAuth 2.0 authorization URL.
   * The `redirectUri` must be the exact URL registered in your Atlassian OAuth app
   * and must point to the backend callback endpoint:
   *   `{API_BASE}/mcp/oauth/callback`
   */
  getOAuthUrl(
    provider: string,
    redirectUri: string,
  ): Promise<{ url: string; state: string }> {
    return api
      .get(`/mcp/profiles/${provider}/oauth/authorize`, {
        params: { redirect_uri: redirectUri },
      })
      .then((r) => r.data)
  },
}
