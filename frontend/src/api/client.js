import axios from 'axios'
import useAuthStore from '../store/authStore'
import { createApiClient, resolveApiBaseUrl } from './createApiClient'
import { queryClient } from '../queryClient'
import { invalidateAfterWrite } from './queryPolicy'
import { validatedReviewApiUrl } from '../auth/reviewEnvironment'

export const API = resolveApiBaseUrl(import.meta.env.VITE_API_URL, import.meta.env.PROD)
let reviewUrlPromise
const reviewBaseURL = async () => {
  if (!reviewUrlPromise) reviewUrlPromise = axios.get(`${API}/auth/review-config`, { timeout: 15000 }).then(({ data }) => {
    if (!data.enabled) throw new Error('심사 환경을 준비하고 있습니다. 잠시 후 다시 시도해주세요.')
    return validatedReviewApiUrl(data.apiUrl, import.meta.env.DEV)
  }).catch(error => { reviewUrlPromise = null; throw error })
  return reviewUrlPromise
}
const api = createApiClient({ axios, authStore: useAuthStore, baseURL: API,
  reviewBaseURL,
  onSessionExpired: () => { window.location.href = '/login' },
  onWriteSuccess: config => { void invalidateAfterWrite(queryClient, config.url) },
})
export const refreshSession = api.refreshSession
export default api.client
