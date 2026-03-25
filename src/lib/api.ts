import axios from 'axios'
import { getToken, refreshToken, login } from '@/lib/keycloak'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(async (config) => {
  try {
    await refreshToken()
  } catch {
    // Token refresh failed — will attempt with existing token or redirect to login
  }

  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Let the browser set Content-Type (including the multipart boundary) for FormData requests.
  // The default 'application/json' header would otherwise override it and break multipart uploads.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await login()
    }
    return Promise.reject(error)
  },
)

export default api
