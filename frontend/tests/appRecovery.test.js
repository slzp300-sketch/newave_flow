import test from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { installAppLifecycle } from '../src/native/appLifecycle.js'
import { createReadRecovery } from '../src/api/readRecovery.js'
import { createApiClient } from '../src/api/createApiClient.js'
import { retryQuery } from '../src/api/queryRetry.js'
import { tokenNeedsRefresh } from '../src/auth/tokenExpiry.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
function lifecycle(options = {}) {
  const view = new EventTarget(), doc = new EventTarget(), listeners = new Map(), focus = [], resumes = []
  let time = 10, removed = 0
  view.document = doc; doc.visibilityState = 'visible'
  const app = {
    addListener: async (event, handler) => { listeners.set(event, handler); return { remove: () => { removed++; listeners.delete(event) } } },
    getState: async () => ({ isActive: true }), ...options.app,
  }
  const stop = installAppLifecycle({ app, view, now: () => time, focus: value => focus.push(value),
    onResume: since => { resumes.push(since); return options.onResume?.() } })
  return { stop, focus, resumes, listeners, removed: () => removed,
    advance: value => { time += value },
    show: value => { doc.visibilityState = value ? 'visible' : 'hidden'; doc.dispatchEvent(new Event('visibilitychange')) },
    native: value => listeners.get('appStateChange')?.({ isActive: value }),
    emit: name => listeners.get(name)?.(),
    pageshow: () => view.dispatchEvent(new Event('pageshow')),
  }
}

test('duplicate native/visibility resume events recover once and pause Query in background', async () => {
  const f = lifecycle(); await tick()
  f.native(false); f.emit('pause'); f.show(false); f.advance(30_000)
  f.emit('resume'); f.native(true) // WebView still hidden: wait for visibility.
  assert.deepEqual(f.focus, [true, false])
  f.show(true); f.native(true); f.emit('resume'); f.pageshow()
  assert.deepEqual(f.focus, [true, false, true]); assert.deepEqual(f.resumes, [10])
  f.stop(); await tick(); assert.equal(f.removed(), 3)
})
test('a late initial native state cannot override a newer background event', async () => {
  let resolve
  const f = lifecycle({ app: { getState: () => new Promise(done => { resolve = done }) } }); await tick()
  f.native(false); resolve({ isActive: true }); await tick()
  assert.deepEqual(f.focus, [true, false]); f.stop()
})
test('visibility fallback recovers when native plugins fail; recovery errors never block focus', async () => {
  const f = lifecycle({ app: { addListener: async () => { throw Error('unavailable') }, getState: async () => { throw Error('unavailable') } },
    onResume: async () => { throw Error('offline') } })
  await tick(); f.show(false); f.show(true); await tick()
  assert.deepEqual(f.focus, [true, false, true]); assert.equal(f.resumes.length, 1)
  f.stop(); f.show(false); f.show(true); assert.equal(f.resumes.length, 1)
})
test('late listener registration is removed after unmount', async () => {
  const releases = []; let removed = 0
  const f = lifecycle({ app: { addListener: () => new Promise(resolve => releases.push(() => resolve({ remove: () => removed++ }))) } })
  f.stop(); releases.forEach(resolve => resolve()); await tick()
  assert.equal(removed, 3); assert.deepEqual(f.focus, [true, undefined])
})

function apiFixture() {
  let time = 0
  const recovery = createReadRecovery({ now: () => time })
  const state = { user: { id: 1 }, accessToken: 'synthetic', refreshToken: 'synthetic-refresh' }
  const { client } = createApiClient({ axios, authStore: { getState: () => state }, baseURL: '/api',
    onSessionExpired() {}, readRecovery: recovery, wait: async () => {} })
  return { client, state, recovery, advance: value => { time += value } }
}
const ok = config => ({ config, status: 200, statusText: 'OK', headers: {}, data: 'latest' })
const pending = config => new Promise((resolve, reject) => {
  config.signal?.addEventListener('abort', () => reject(new axios.CanceledError('interrupted', config)), { once: true })
})
test('a read suspended over 15 seconds restarts once and resolves the original caller', async () => {
  const f = apiFixture(); let reads = 0
  f.client.defaults.adapter = config => ++reads === 1 ? pending(config) : Promise.resolve(ok(config))
  const result = f.client.get('/students'); await tick(); f.advance(20_000)
  f.recovery.resume(1); f.recovery.resume(1)
  assert.equal((await result).data, 'latest'); assert.equal(reads, 2)
  f.recovery.resume(1); assert.equal(reads, 2)
})
test('a short app switch leaves reads alone and never restarts writes', async () => {
  const f = apiFixture(); const requests = [], finish = []
  f.client.defaults.adapter = config => { requests.push(config); return new Promise(resolve => finish.push(() => resolve(ok(config)))) }
  const read = f.client.get('/students'), write = f.client.post('/attendance', { present: true })
  await tick(); f.advance(5_000); f.recovery.resume(1)
  assert.equal(requests[0].signal.aborted, false)
  assert.equal(requests[1].signal, undefined)
  finish.forEach(done => done()); await Promise.all([read, write]); f.advance(30_000); f.recovery.resume(1)
  assert.equal(requests.length, 2)
})
test('caller cancellation and changed account prohibit recovery replay', async () => {
  for (const scenario of ['cancel', 'logout']) {
    const f = apiFixture(), controller = new AbortController(); let calls = 0
    f.client.defaults.adapter = config => { calls++; return pending(config) }
    const result = f.client.get('/private', { signal: controller.signal })
    const rejected = assert.rejects(result)
    await tick(); f.advance(30_000)
    if (scenario === 'cancel') controller.abort()
    else f.state.user = null
    f.recovery.resume(1); await rejected; assert.equal(calls, 1, scenario)
  }
})
test('a new read begun after suspension is not mistaken for an old suspended read', async () => {
  const f = apiFixture(); f.advance(10)
  const controller = new AbortController(); let calls = 0
  f.client.defaults.adapter = config => { calls++; return pending(config) }
  const rejected = assert.rejects(f.client.get('/fresh', { signal: controller.signal }))
  await tick(); f.advance(30_000); f.recovery.resume(1)
  assert.equal(calls, 1); controller.abort(); await rejected
})
test('repeated background cycles cannot endlessly replay the same read', async () => {
  const f = apiFixture(), controller = new AbortController(); let calls = 0
  f.client.defaults.adapter = config => { calls++; return pending(config) }
  const rejected = assert.rejects(f.client.get('/slow', { signal: controller.signal }))
  await tick(); f.advance(30_000); f.recovery.resume(1); await tick()
  f.advance(30_000); f.recovery.resume(30_001); await tick()
  assert.equal(calls, 2); controller.abort(); await rejected
})
test('Query does not multiply Axios network retry timeouts', async () => {
  const f = apiFixture(); let calls = 0
  f.client.defaults.adapter = async config => { calls++; throw new axios.AxiosError('offline', 'ERR_NETWORK', config) }
  const query = new QueryClient({ defaultOptions: { queries: { retry: retryQuery, retryDelay: 0 } } })
  await assert.rejects(query.fetchQuery({ queryKey: ['offline'], queryFn: () => f.client.get('/students') }))
  assert.equal(calls, 2); query.clear()
  for (const status of [400, 401, 403, 404, 409, 422, 429]) assert.equal(retryQuery(0, { response: { status } }), false)
  assert.equal(retryQuery(0, { response: { status: 503 } }), true)
  assert.equal(retryQuery(1, { response: { status: 503 } }), false)
})
test('foreground renewal only runs with an existing near-expiry session', () => {
  const token = exp => `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`
  assert.equal(tokenNeedsRefresh(null), false)
  assert.equal(tokenNeedsRefresh(token(1_000), 600_000), false)
  assert.equal(tokenNeedsRefresh(token(1_000), 700_000), true)
  assert.equal(tokenNeedsRefresh('bad'), true)
})
