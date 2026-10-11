// Accept either a server origin or an API base path from deployment settings.
export function resolveApiBaseUrl(configuredUrl, production = false) {
  const base = (configuredUrl?.trim() || (production
    ? 'https://newaveflow-production.up.railway.app/api' : '/api')).replace(/\/+$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

// Dependencies are injected so retry/session behavior can be tested without a live server.
export function createApiClient({ axios, authStore, baseURL, onSessionExpired, onWriteSuccess = () => {}, wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  const client = axios.create({ baseURL, timeout: 20000, headers: { 'Content-Type': 'application/json' } })
  let refreshPromise = null

  const refreshSession = () => {
    if (refreshPromise) return refreshPromise
    const originalSession = authStore.getState().refreshToken
    refreshPromise = (async () => {
      if (!originalSession) throw Object.assign(new Error('로그인이 필요합니다.'), { response: { status: 401 } })
      const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken: originalSession }, { timeout: 15000 })
      if (authStore.getState().refreshToken !== originalSession) throw new Error('로그인 상태가 변경되었습니다.')
      authStore.getState().setAuth(data.user, data.accessToken, data.refreshToken)
      return data
    })().catch(error => {
      if ([401, 403].includes(error.response?.status) && authStore.getState().refreshToken === originalSession) {
        authStore.getState().clearAuth()
        onSessionExpired()
      }
      throw error
    }).finally(() => { refreshPromise = null })
    return refreshPromise
  }

  client.interceptors.request.use(config => {
    // The key stays on this request if it is replayed after authentication refresh.
    if (config.method === 'post' && ['/events', '/events/bulk', '/admin/students/bulk-advance'].includes(config.url)
        && !config.headers['Idempotency-Key']) config.headers['Idempotency-Key'] = crypto.randomUUID()
    const token = authStore.getState().accessToken
    if (token) config.headers.Authorization = `Bearer ${token}`
    else delete config.headers.Authorization
    return config
  })

  client.interceptors.response.use(response => {
    if (['post', 'put', 'patch', 'delete'].includes(response.config.method)) onWriteSuccess(response.config)
    return response
  }, async error => {
    const original = error.config
    if (!original) throw error
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
