import test from 'node:test'
import assert from 'node:assert/strict'
import { createPushController, safeNotificationPath } from '../src/native/pushController.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function fixture(options = {}) {
  let session = { scope: 'production:1:session1' }
  const calls = [], handlers = new Map()
  const prefs = { available: true, pushEnabled: false, ...options.prefs }
  const plugin = {
    addListener: async (name, fn) => { handlers.set(name, fn); return { remove: async () => { if (handlers.get(name) === fn) handlers.delete(name) } } },
    checkPermissions: async () => ({ receive: options.permission || 'granted' }),
    requestPermissions: async () => { calls.push(['permission']); return { receive: options.requestPermission || 'granted' } },
    register: async () => { calls.push(['register']); if (!options.noToken) handlers.get('registration')?.({ value: 'synthetic-device-token' }) },
    unregister: async () => { calls.push(['unregister']) },
    removeAllDeliveredNotifications: async () => { calls.push(['clear']) },
    createChannel: async () => {},
  }
  const api = {
    preferences: async () => ({ ...prefs }),
    setPreferences: async (s, data) => { calls.push(['prefs', s.scope, data]); Object.assign(prefs, data) },
    registerDevice: async (s, id, data) => { calls.push(['device', s.scope, data.token]) },
    deleteDevice: async s => { calls.push(['delete', s.scope]) },
    list: async () => options.rows || [],
    markRead: async (s, id) => { calls.push(['read', id]) },
  }
  const controller = createPushController({ plugin, api, getSession: () => session, installationId: () => 'test-installation',
    platform: 'IOS', registrationTimeout: 20, navigate: path => calls.push(['navigate', path]), ...options.controller })
  return { controller, plugin, api, prefs, calls, handlers, setSession: value => { session = value; controller.sessionChanged() } }
}

test('notification targets only allow known in-app paths and numeric context', () => {
  assert.equal(safeNotificationPath('/event-attendance/42'), '/event-attendance/42')
  assert.equal(safeNotificationPath('/attendance?date=2026-10-18'), '/attendance?date=2026-10-18')
  for (const path of ['https://evil.test', '//evil.test', '/admin', '/tts?redirect=https://evil.test', '/tts#x', '/tts\\evil', '/%2f%2fevil.test']) {
    assert.equal(safeNotificationPath(path), null, path)
  }
})

test('startup never asks permission; unavailable or denied opt-in does not register', async () => {
  for (const options of [{ prefs: { available: false } }, { permission: 'denied' }]) {
    const f = fixture(options)
    await f.controller.start(); await f.controller.enable()
    assert.equal(f.calls.some(c => c[0] === 'register'), false)
    assert.equal(f.calls.some(c => c[0] === 'permission'), false)
    assert.equal(f.controller.getSnapshot().enabled, false)
    f.controller.stop()
  }
})

test('explicit opt-in requests permission then saves token before enabling', async () => {
  const f = fixture({ permission: 'prompt' })
  await f.controller.start()
  assert.equal(f.calls.some(c => c[0] === 'permission'), false)
  await f.controller.enable()
  assert.equal(f.controller.getSnapshot().enabled, true)
  assert.ok(f.calls.findIndex(c => c[0] === 'device') < f.calls.findIndex(c => c[0] === 'prefs'))
  f.controller.stop()
})

test('denying the OS prompt leaves server preference off', async () => {
  const f = fixture({ permission: 'prompt', requestPermission: 'denied' })
  await f.controller.enable()
  assert.equal(f.calls.some(c => c[0] === 'prefs'), false)
  assert.equal(f.controller.getSnapshot().enabled, false)
  f.controller.stop()
})

test('registration timeout cleans up and allows an immediate successful retry', async () => {
  const f = fixture({ noToken: true })
  await f.controller.enable()
  assert.match(f.controller.getSnapshot().error, /초과/)
  f.plugin.register = async () => f.handlers.get('registration')({ value: 'retry-token' })
  await f.controller.enable()
  assert.equal(f.controller.getSnapshot().enabled, true)
  assert.equal(f.calls.find(c => c[0] === 'device')[2], 'retry-token')
  f.controller.stop()
})

test('repeated opt-in while busy does not cancel the active request', async () => {
  const f = fixture(), request = deferred()
  f.api.preferences = () => request.promise
  const first = f.controller.enable()
  await f.controller.enable()
  request.resolve({ available: true, pushEnabled: false })
  await first
  assert.equal(f.controller.getSnapshot().enabled, true)
  f.controller.stop()
})

test('changing accounts during permission request cannot attach the old token', async () => {
  const f = fixture({ permission: 'prompt' }), permission = deferred()
  f.plugin.requestPermissions = () => permission.promise
  const action = f.controller.enable()
  await tick()
  f.setSession({ scope: 'production:2:session2' })
  permission.resolve({ receive: 'granted' })
  await action; await tick()
  assert.equal(f.calls.some(c => c[0] === 'device'), false)
  assert.equal(f.calls.some(c => c[0] === 'prefs'), false)
  f.controller.stop()
})

test('token rotation is registered only for the enabled current account', async () => {
  const f = fixture()
  await f.controller.enable()
  f.handlers.get('registration')({ value: 'rotated-token' })
  await tick()
  assert.ok(f.calls.some(c => c[0] === 'device' && c[2] === 'rotated-token'))
  await f.controller.disable()
  const count = f.calls.filter(c => c[0] === 'device').length
  f.handlers.get('registration')({ value: 'disabled-token' })
  await tick()
  assert.equal(f.calls.filter(c => c[0] === 'device').length, count)
  assert.equal(f.controller.getSnapshot().enabled, false)
  f.controller.stop()
})

test('push tap verifies ownership and uses stored target instead of payload URL', async () => {
  const f = fixture({ rows: [{ id: 3, read: false, targetPath: '/tts' }] })
  await f.controller.start()
  f.handlers.get('pushNotificationActionPerformed')({ notification: { data: { notificationId: '99', url: 'https://evil.test' } } })
  await tick()
  assert.equal(f.calls.some(c => c[0] === 'navigate'), false)
  f.handlers.get('pushNotificationActionPerformed')({ notification: { data: { notificationId: '3', url: 'https://evil.test' } } })
  await tick()
  assert.deepEqual(f.calls.find(c => c[0] === 'navigate'), ['navigate', '/tts'])
  f.controller.stop()
})

test('stop and restart restore listeners; logout deregisters while authenticated', async () => {
  const f = fixture()
  await f.controller.start(); f.controller.stop(); await f.controller.start()
  assert.equal(f.handlers.size, 4)
  await f.controller.enable(); await f.controller.detach()
  assert.ok(f.calls.some(c => c[0] === 'delete' && c[1] === 'production:1:session1'))
  assert.ok(f.calls.some(c => c[0] === 'clear'))
  f.controller.stop()
  assert.equal(f.handlers.size, 0)
})

test('partial listener failure is cleaned up and can retry without duplicate handlers', async () => {
  const f = fixture(), add = f.plugin.addListener
  let failed = false
  f.plugin.addListener = async (name, handler) => {
    if (name === 'registrationError' && !failed) { failed = true; throw new Error('synthetic failure') }
    return add(name, handler)
  }
  await assert.rejects(f.controller.start(), /synthetic failure/)
  assert.equal(f.handlers.size, 0)
  await f.controller.start()
  assert.equal(f.handlers.size, 4)
  f.controller.stop()
})

test('account change during Android channel creation prevents obsolete registration', async () => {
  const f = fixture({ controller: { platform: 'ANDROID' } }), channel = deferred()
  f.plugin.createChannel = () => channel.promise
  const action = f.controller.enable()
  await tick()
  f.setSession({ scope: 'production:2:session2' })
  channel.resolve()
  await action; await tick()
  assert.equal(f.calls.some(c => c[0] === 'register'), false)
  assert.equal(f.calls.some(c => c[0] === 'device'), false)
  f.controller.stop()
})

test('failed opt-in cannot clear a new account registration after cleanup awaits', async () => {
  const f = fixture(), deletion = deferred()
  f.api.registerDevice = async () => { throw new Error('synthetic registration failure') }
  f.api.deleteDevice = () => deletion.promise
  const action = f.controller.enable()
  await tick()
  f.setSession({ scope: 'production:2:session2' })
  await tick()
  const clears = f.calls.filter(c => c[0] === 'unregister').length
  deletion.resolve()
  await action; await tick()
  // The new session's normal refresh may clean its disabled preference once;
  // the failed old opt-in must not perform a second unregister.
  assert.equal(f.calls.filter(c => c[0] === 'unregister').length - clears, 1)
  f.controller.stop()
})
