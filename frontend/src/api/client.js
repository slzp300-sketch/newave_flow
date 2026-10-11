import axios from 'axios'
import useAuthStore from '../store/authStore'
import { createApiClient, resolveApiBaseUrl } from './createApiClient'
import { queryClient } from '../queryClient'
import { invalidateAfterWrite } from './queryPolicy'

export const API = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD)
const api = createApiClient({ axios, authStore: useAuthStore, baseURL: API,
  onSessionExpired: () => { window.location.href = '/login' },
  onWriteSuccess: config => { void invalidateAfterWrite(queryClient, config.url) },
})
export const refreshSession = api.refreshSession
export default api.client
