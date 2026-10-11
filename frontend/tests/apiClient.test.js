import test from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { createApiClient, resolveApiBaseUrl } from '../src/api/createApiClient.js'

test('deployment URL supports server origins and existing API paths', () => {
  for (const value of ['https://backend.example', 'https://backend.example/', 'https://backend.example/api', ' https://backend.example/api/ ']) {
    assert.equal(resolveApiBaseUrl(value, true), 'https://backend.example/api')
  }
  assert.equal(resolveApiBaseUrl('/api/'), '/api')
  assert.equal(resolveApiBaseUrl('/service/'), '/service/api')
  assert.equal(resolveApiBaseUrl(undefined), '/api')
  assert.equal(resolveApiBaseUrl('  ', true), 'https://newaveflow-production.up.railway.app/api')
})

test('origin-only deployment setting routes login and refresh under /api', async () => {
  const requests = []
  const state = { accessToken: null, refreshToken: 'synthetic-refresh', setAuth() {}, clearAuth() {} }
  const api = createApiClient({
    axios: { create: axios.create, post: async (url) => {
      requests.push(url)
      return { data: { user: {}, accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' } }
    } },
    authStore: { getState: () => state },
    baseURL: resolveApiBaseUrl('https://backend.example', true),
    onSessionExpired() {},
  })
  api.client.defaults.adapter = async config => {
    requests.push(api.client.getUri(config))
    return { config, status: 200, statusText: 'OK', headers: {}, data: {} }
  }
  await api.client.post('/auth/login', { email: 'test@example.invalid', password: 'synthetic' })
  await api.refreshSession()
  assert.deepEqual(requests, ['https://backend.example/api/auth/login', 'https://backend.example/api/auth/refresh'])
})

function setup(refresh = async () => ({ data: { user: { id: 1 }, accessToken: 'new-access', refreshToken: 'new-refresh' } })) {
  const state = { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 1 },
    setAuth(user, accessToken, refreshToken) { Object.assign(state, { user, accessToken, refreshToken }) },
    clearAuth() { state.user = null; state.accessToken = null; state.refreshToken = null },
  }
  let refreshes = 0, redirects = 0
  const api = createApiClient({ axios: { create: axios.create, post: (...args) => { refreshes++; return refresh(...args) } },
    authStore: { getState: () => state }, baseURL: '/api', wait: async () => {}, onSessionExpired: () => redirects++ })
  return { ...api, state, refreshes: () => refreshes, redirects: () => redirects }
}
const ok = config => ({ config, status: 200, statusText: 'OK', headers: {}, data: { saved: true } })
const unauthorized = config => new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401 })

test('ambiguous POST response is not replayed', async () => {
  const { client } = setup(); let writes = 0
  client.defaults.adapter = async config => { writes++; throw new axios.AxiosError('response lost', 'ERR_NETWORK', config) }
  await assert.rejects(client.post('/events', { title: 'synthetic' })); assert.equal(writes, 1)
})
test('GET retries once, cancellation does not retry', async () => {
  const { client } = setup(); let calls = 0
  client.defaults.adapter = async config => { if (++calls === 1) throw new axios.AxiosError('offline', 'ERR_NETWORK', config); return ok(config) }
  await client.get('/events'); assert.equal(calls, 2)
  calls = 0; client.defaults.adapter = async config => { calls++; throw new axios.AxiosError('cancelled', 'ERR_CANCELED', config) }
  await assert.rejects(client.get('/events')); assert.equal(calls, 1)
})
test('concurrent 401 requests share one refresh and both finish', async () => {
  const api = setup(async () => { await new Promise(r => setTimeout(r, 15)); return { data: { user: { id: 1 }, accessToken: 'new-access', refreshToken: 'new-refresh' } } })
  api.client.defaults.adapter = async config => { if (config.headers.Authorization === 'Bearer old-access') throw unauthorized(config); return ok(config) }
  const results = await Promise.all([api.client.get('/one'), api.client.get('/two')])
  assert.equal(results.length, 2); assert.equal(api.refreshes(), 1)
})
test('failed refresh rejects every waiting request and clears session', async () => {
  const api = setup(async () => { await new Promise(r => setTimeout(r, 15)); throw Object.assign(new Error('rejected'), { response: { status: 401 } }) })
  api.client.defaults.adapter = async config => { throw unauthorized(config) }
  const results = await Promise.allSettled([api.client.get('/one'), api.client.get('/two')])
  assert.ok(results.every(r => r.status === 'rejected')); assert.equal(api.refreshes(), 1); assert.equal(api.state.user, null); assert.equal(api.redirects(), 1)
})
test('network failure while refreshing preserves credentials for a later attempt', async () => {
  const api = setup(async () => { throw new Error('offline') })
  await assert.rejects(api.refreshSession()); assert.equal(api.state.accessToken, 'old-access'); assert.equal(api.redirects(), 0)
})
test('late refresh cannot restore a logged-out session', async () => {
  let finish; const api = setup(() => new Promise(resolve => { finish = resolve }))
  const pending = api.refreshSession(); api.state.clearAuth()
  finish({ data: { user: { id: 1 }, accessToken: 'late', refreshToken: 'late' } })
  await assert.rejects(pending); assert.equal(api.state.user, null)
})
test('operation key remains the same after token refresh', async () => {
  const api = setup(); const keys = []
  api.client.defaults.adapter = async config => { keys.push(config.headers['Idempotency-Key']); if (keys.length === 1) throw unauthorized(config); return ok(config) }
  await api.client.post('/admin/students/bulk-advance', { a: 'b' })
  assert.ok(keys[0]); assert.equal(keys[0], keys[1])
})

test('expired access token can refresh to complete authenticated logout', async () => {
  const api = setup(); let logouts = 0
  api.client.defaults.adapter = async config => {
    if (config.headers.Authorization === 'Bearer old-access') throw unauthorized(config)
    logouts++; return ok(config)
  }
  await api.client.post('/auth/logout')
  assert.equal(api.refreshes(), 1); assert.equal(logouts, 1)
})

test('invalid login credentials do not try to refresh an old session', async () => {
  const api = setup()
  api.client.defaults.adapter = async config => { throw unauthorized(config) }
  await assert.rejects(api.client.post('/auth/login', { email: 'test@example.invalid', password: 'synthetic' }))
  assert.equal(api.refreshes(), 0)
})
