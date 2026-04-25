import axios from 'axios'
import useAuthStore from '../store/authStore'

const API = import.meta.env.PROD 
  ? "https://newaveflow-production.up.railway.app/api" 
  : "/api";

const getInitialToken = () => {
  try {
    const authStorage = localStorage.getItem('newave-auth')
    if (authStorage) {
      const { state } = JSON.parse(authStorage)
      return state?.accessToken
    }
  } catch (error) {
    console.error("Initial token fetch failed", error)
  }
  return null
}

const client = axios.create({
  baseURL: API,
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': getInitialToken() ? `Bearer ${getInitialToken()}` : undefined
  },
})

// 요청 인터셉터
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken || getInitialToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Refresh Token Race Condition 방지용 변수
let isRefreshing = false
let refreshSubscribers = []

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb)
}

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

// 응답 인터셉터
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // 네트워크 오류 (백엔드 응답 없음) → 1회 재시도
    if (!error.response && !original._networkRetry) {
      original._networkRetry = true
      await new Promise(resolve => setTimeout(resolve, 3000))
      return client(original)
    }

    if (error.response?.status === 401 && !original._retry) {
      if (original.url.includes('/auth/login') || original.url.includes('/auth/refresh')) {
        return Promise.reject(error)
      }
      original._retry = true
      const { refreshToken, clearAuth, user } = useAuthStore.getState()

      if (!refreshToken) {
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (!isRefreshing) {
        isRefreshing = true
        try {
          const { data } = await axios.post(`${API}/auth/refresh`, { refreshToken })
          const { user: refreshedUser, accessToken: newAccess, refreshToken: newRefresh } = data
          
          // 스토어 업데이트
          useAuthStore.getState().setAuth(refreshedUser || user, newAccess, newRefresh)

          isRefreshing = false
          onRefreshed(newAccess)
          
          // 원래 요청 재실행
          original.headers.Authorization = `Bearer ${newAccess}`
          return client(original)
        } catch (err) {
          isRefreshing = false
          refreshSubscribers = []
          useAuthStore.getState().clearAuth()
          window.location.href = '/login'
          return Promise.reject(err)
        }
      }

      // 이미 다른 요청에 의해 Refresh가 진행 중이면, 완료될 때까지 대기
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(client(original))
        })
      })
    }
    return Promise.reject(error)
  }
)

export default client
