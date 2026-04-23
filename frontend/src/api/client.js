import axios from 'axios'
import useAuthStore from '../store/authStore'

const API = import.meta.env.PROD 
  ? "https://newaveflow-production.up.railway.app/api" 
  : "/api";

const client = axios.create({
  baseURL: API,
  headers: { 'Content-Type': 'application/json' },
})

// 앱 초기화 시 동기적으로 로컬스토리지에서 직접 토큰 읽어 헤더 세팅
try {
  const authStorage = localStorage.getItem('newave-auth')
  if (authStorage) {
    const { state } = JSON.parse(authStorage)
    if (state?.accessToken) {
      client.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`
    }
  }
} catch (error) {
  console.error("Failed to parse auth storage on init", error)
}

// 요청 인터셉터
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
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
    if (error.response?.status === 401 && !original._retry) {
      if (original.url.includes('/auth/login') || original.url.includes('/auth/refresh')) {
        return Promise.reject(error)
      }
      original._retry = true
      const { refreshToken, setAuth, clearAuth, user } = useAuthStore.getState()

      if (!refreshToken) {
        clearAuth()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (!isRefreshing) {
        isRefreshing = true
        try {
          const { data } = await axios.post(`${API}/auth/refresh`, { refreshToken })
          setAuth(data.user ?? user, data.accessToken, data.refreshToken)
          client.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
          
          isRefreshing = false
          onRefreshed(data.accessToken)
          
          // 리프레시를 트리거한 원래 요청 재실행
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return client(original)
        } catch (err) {
          isRefreshing = false
          refreshSubscribers = []
          clearAuth()
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
