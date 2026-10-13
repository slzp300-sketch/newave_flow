// Accept either a server origin or an API base path from deployment settings.
export function resolveApiBaseUrl(configuredUrl, production = false) {
  const base = (configuredUrl?.trim() || (production
    ? 'https://newaveflow-production.up.railway.app/api' : '/api')).replace(/\/+$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

// Dependencies are injected so retry/session behavior can be tested without a live server.
export function createApiClient({ axios, authStore, baseURL, reviewBaseURL, onSessionExpired, onWriteSuccess = () => {}, wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  const client = axios.create({ baseURL, timeout: 20000, headers: { 'Content-Type': 'application/json' } })
  let refreshPromise = null
  const environment = () => authStore.getState().apiEnvironment || 'production'
  const sessionScope = () => `${environment()}:${authStore.getState().user?.id ?? 'anonymous'}`
  const resolveBase = async selected => {
    if (selected === 'production') return baseURL
    if (selected !== 'review') throw new Error('로그인 환경이 올바르지 않습니다.')
    const resolved = typeof reviewBaseURL === 'function' ? await reviewBaseURL() : reviewBaseURL
    if (!resolved) throw new Error('심사 서버에 연결할 수 없습니다.')
    return resolved
  }

  const refreshSession = () => {
    if (refreshPromise) return refreshPromise
    const originalSession = authStore.getState().refreshToken
    const originalEnvironment = environment()
    refreshPromise = (async () => {
      if (!originalSession) throw Object.assign(new Error('로그인이 필요합니다.'), { response: { status: 401 } })
      const selectedBase = await resolveBase(originalEnvironment)
      if (authStore.getState().refreshToken !== originalSession || environment() !== originalEnvironment) throw new Error('로그인 상태가 변경되었습니다.')
      const { data } = await axios.post(`${selectedBase}/auth/refresh`, { refreshToken: originalSession }, { timeout: 15000 })
      if (authStore.getState().refreshToken !== originalSession || environment() !== originalEnvironment) throw new Error('로그인 상태가 변경되었습니다.')
      authStore.getState().setAuth(data.user, data.accessToken, data.refreshToken, originalEnvironment)
      return data
    })().catch(error => {
      if ([401, 403].includes(error.response?.status) && authStore.getState().refreshToken === originalSession && environment() === originalEnvironment) {
        authStore.getState().clearAuth()
        onSessionExpired()
      }
      throw error
    }).finally(() => { refreshPromise = null })
    return refreshPromise
  }

  client.interceptors.request.use(async config => {
    const selected = config._apiEnvironment ?? config.apiEnvironment ?? environment()
    const scope = config._sessionScope ?? sessionScope()
    if (!config.skipAuth && (selected !== environment() || scope !== sessionScope())) throw new Error('로그인 상태가 변경되었습니다.')
    config.baseURL = await resolveBase(selected)
    if (!config.skipAuth && (selected !== environment() || scope !== sessionScope())) throw new Error('로그인 상태가 변경되었습니다.')
    config._apiEnvironment = selected
    config._sessionScope = scope
    // The key stays on this request if it is replayed after authentication refresh.
    if (config.method === 'post' && ['/events', '/events/bulk', '/admin/students/bulk-advance'].includes(config.url)
        && !config.headers['Idempotency-Key']) config.headers['Idempotency-Key'] = crypto.randomUUID()
    const token = authStore.getState().accessToken
    if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`
    else delete config.headers.Authorization
    return config
  })

  client.interceptors.response.use(response => {
    if (!response.config.skipAuth && response.config._sessionScope !== sessionScope()) throw new Error('로그인 상태가 변경되었습니다.')
    if (['post', 'put', 'patch', 'delete'].includes(response.config.method)) onWriteSuccess(response.config)
    return response
  }, async error => {
    const original = error.config
    if (!original) throw error
    if (!original.skipAuth && original._sessionScope !== sessionScope()) throw new Error('로그인 상태가 변경되었습니다.')
    const method = (original.method || 'get').toLowerCase()
    if (!error.response && ['get', 'head'].includes(method) && !original._networkRetry && error.code !== 'ERR_CANCELED') {
      original._networkRetry = true
      await wait(1000)
      return client(original)
    }
    const publicAuthRequest = original.url.includes('/auth/') && original.url !== '/auth/logout'
    if (error.response?.status !== 401 || original._retry || publicAuthRequest) throw error
    original._retry = true
    const currentToken = authStore.getState().accessToken
    if (!currentToken || original.headers.Authorization === `Bearer ${currentToken}`) await refreshSession()
    return client(original)
  })
  return { client, refreshSession }
}
