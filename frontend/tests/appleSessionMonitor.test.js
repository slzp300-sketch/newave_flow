import test from 'node:test'
import assert from 'node:assert/strict'
import { startAppleSessionMonitor } from '../src/auth/appleSessionMonitor.js'
import { appleSessionIdentity, validAuthIdentity } from '../src/auth/authIdentity.js'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
function emitter() {
  const listeners = new Map()
  return {
    removed: 0,
    async addListener(event, callback) {
      listeners.set(event, callback)
      return { remove: async () => { listeners.delete(event); this.removed++ } }
    },
    emit(event, data = {}) { listeners.get(event)?.(data) },
  }
}
function setup({ identity = appleSessionIdentity('synthetic-subject'), credentialState = async () => ({ state: 'authorized' }), logout = async () => {}, flush = async () => {} } = {}) {
  const listeners = new Set(), calls = [], native = emitter(), app = emitter()
  let state = { user: { id: 1 }, accessToken: 'synthetic-access', authIdentity: identity,
    clearAuth: () => update({ user: null, accessToken: null, authIdentity: null }) }
  const update = value => { const previous = state; state = { ...state, ...value }; listeners.forEach(fn => fn(state, previous)) }
  const store = { getState: () => state, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback) } }
  native.getCredentialState = async data => { calls.push(['state', data]); return credentialState(data) }
  const stop = startAppleSessionMonitor({ native, app, store,
    logout: async config => { calls.push(['logout', config]); return logout(config) },
    clearCache: () => calls.push(['clearCache']), flush: async () => { calls.push(['flush']); return flush() },
    onSignedOut: result => calls.push(['signedOut', result]),
  })
  return { native, app, store, calls, update, stop, listeners }
}

test('Apple session metadata is explicit and a fresh sign-in has a distinct identity', () => {
  const first = appleSessionIdentity('subject'), second = appleSessionIdentity('subject')
  assert.equal(validAuthIdentity(first), true)
  assert.notEqual(first.sessionId, second.sessionId)
  for (const value of [null, { provider: 'email', subject: 'subject' }, { provider: 'apple', subject: '' }, { ...first, subject: 'bad\nsubject' }]) assert.equal(validAuthIdentity(value), false)
  assert.throws(() => appleSessionIdentity(undefined), /확인하지/)
})

test('Startup and foreground verify Apple state; background does not and transient failure preserves session', async () => {
  let attempts = 0
  const task = setup({ credentialState: async () => { if (++attempts === 2) throw new Error('temporary provider failure'); return { state: 'authorized' } } })
  await tick(); assert.equal(attempts, 1)
  task.app.emit('appStateChange', { isActive: false }); await tick(); assert.equal(attempts, 1)
  task.app.emit('appStateChange', { isActive: true }); await tick(); assert.equal(attempts, 2)
  assert.equal(task.store.getState().accessToken, 'synthetic-access')
  assert.equal(task.calls.some(c => c[0] === 'logout'), false)
  task.stop()
})

test('Credential notification rechecks and revoked/notFound sign out only the verified Apple session', async () => {
  for (const revoked of ['revoked', 'notFound']) {
    let state = 'authorized'
    const task = setup({ credentialState: async () => ({ state }) })
    await tick(); state = revoked; task.native.emit('credentialRevoked'); await tick()
    assert.deepEqual(task.calls.map(c => c[0]), ['state', 'state', 'logout', 'clearCache', 'flush', 'signedOut'])
    assert.equal(task.calls.find(c => c[0] === 'logout')[1].expectedAuthSessionId.length, 36)
    assert.equal(task.store.getState().accessToken, null)
    task.stop()
  }
})

test('Email/Kakao sessions are not checked, even when linked Apple credentials emit a notification', async () => {
  const task = setup({ identity: null })
  await tick(); task.native.emit('credentialRevoked'); task.app.emit('appStateChange', { isActive: true }); await tick()
  assert.equal(task.calls.length, 0)
  assert.equal(task.store.getState().accessToken, 'synthetic-access')
  task.stop()
})

test('An old state response cannot log out a later email session or a newly signed-in Apple session', async () => {
  for (const identity of [null, appleSessionIdentity('synthetic-subject')]) {
    let finish
    const task = setup({ credentialState: () => new Promise(resolve => { finish = resolve }) })
    task.update({ authIdentity: identity, accessToken: 'new-session' })
    finish({ state: 'revoked' }); await tick()
    assert.equal(task.calls.some(c => c[0] === 'logout'), false)
    assert.equal(task.store.getState().accessToken, 'new-session')
    task.stop()
  }
})

test('A late server logout cannot clear a replacement session; offline logout still clears the local revoked session', async () => {
  let finish
  const task = setup({ credentialState: async () => ({ state: 'revoked' }), logout: () => new Promise(resolve => { finish = resolve }) })
  await tick(); task.update({ authIdentity: null, accessToken: 'new-email-session' }); finish(); await tick()
  assert.equal(task.store.getState().accessToken, 'new-email-session')
  assert.equal(task.calls.some(c => c[0] === 'clearCache'), false)
  task.stop()
  const offline = setup({ credentialState: async () => ({ state: 'revoked' }), logout: async () => { throw new Error('offline') } })
  await tick(); assert.equal(offline.store.getState().accessToken, null)
  assert.equal(offline.calls.at(-1)[1].serverRevoked, false)
  offline.stop()
})

test('Disposal removes event subscriptions and late registrations and cancels stale state results', async () => {
  let finish
  const task = setup({ credentialState: () => new Promise(resolve => { finish = resolve }) })
  task.stop(); finish({ state: 'revoked' }); await tick()
  assert.equal(task.native.removed, 1); assert.equal(task.app.removed, 1); assert.equal(task.listeners.size, 0)
  assert.equal(task.calls.some(c => c[0] === 'logout'), false)
})

test('Deletion receipt saving pauses Apple revocation checks, including an already pending response', async () => {
  let finish
  const task = setup({ credentialState: () => new Promise(resolve => { finish = resolve }) })
  task.update({ appleCheckPaused: true })
  finish({ state: 'revoked' }); await tick()
  task.native.emit('credentialRevoked'); await tick()
  assert.equal(task.calls.some(c => c[0] === 'logout'), false)
  assert.equal(task.store.getState().accessToken, 'synthetic-access')
  task.store.getState().clearAuth()
  task.update({ appleCheckPaused: false }); await tick()
  assert.equal(task.calls.filter(c => c[0] === 'state').length, 1)
  task.stop()
})
