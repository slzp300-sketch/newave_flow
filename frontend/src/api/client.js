import axios from 'axios'
import useAuthStore from '../store/authStore'

const API = import.meta.env.PROD 
  ? "https://newaveflow-production.up.railway.app/api" 
  : "/api";

const client = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
})

// 요청 인터셉터: 토큰 자동 첨부
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 응답 인터셉터: 401 시 토큰 갱신 후 재시도
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (original.url.includes('/auth/login')) {
        return Promise.reject(error)
      }
      original._retry = true
      const { refreshToken, setAuth, clearAuth, user } = useAuthStore.getState()

      if (!refreshToken) {
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${API}/auth/refresh`, { refreshToken })
        setAuth(data.user ?? user, data.accessToken, data.refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return client(original)
      } catch {
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default client
