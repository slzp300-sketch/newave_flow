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

test('late account A token rotation finishes before detach and account B registration', async () => {
  const f = fixture({ prefs: { pushEnabled: true } }), late = deferred()
  let owner = null
  f.api.registerDevice = async (session, id, data) => {
    f.calls.push(['device-start', session.scope, data.token])
    if (data.token === 'late-A-token') await late.promise
    owner = session.scope
    f.calls.push(['device-finish', session.scope, data.token])
  }
  f.api.deleteDevice = async session => {
    f.calls.push(['delete-owner', session.scope])
    if (owner === session.scope) owner = null
  }
  f.setSession({ scope: 'production:1:session1' })
  await f.controller.start()
  f.calls.length = 0
  f.handlers.get('registration')({ value: 'late-A-token' })
  await tick()
  const detach = f.controller.detach()
  f.setSession({ scope: 'production:2:session2' })
  const refreshB = f.controller.refresh()
  await tick()
  assert.equal(f.calls.some(c => c[0] === 'delete-owner'), false)
  assert.equal(f.calls.some(c => c[0] === 'device-start' && c[1] === 'production:2:session2'), false)
  late.resolve()
  await detach; await refreshB
  assert.equal(owner, 'production:2:session2')
  assert.ok(f.calls.findIndex(c => c[0] === 'delete-owner' && c[1] === 'production:1:session1')
    < f.calls.findIndex(c => c[0] === 'device-start' && c[1] === 'production:2:session2'))
  f.controller.stop()
})

test('disable drains a late rotation before deleting and ignores rotations while disabling', async () => {
  const f = fixture({ prefs: { pushEnabled: true } }), late = deferred()
  let registered = false
  f.api.registerDevice = async (session, id, data) => {
    if (data.token === 'late-token') await late.promise
    registered = true
    f.calls.push(['device-saved', data.token])
  }
  f.api.deleteDevice = async () => { registered = false; f.calls.push(['device-deleted']) }
  await f.controller.start()
  f.calls.length = 0
  f.handlers.get('registration')({ value: 'late-token' })
  await tick()
  const disable = f.controller.disable()
  f.handlers.get('registration')({ value: 'during-disable-token' })
  await tick()
  assert.equal(f.calls.some(c => c[0] === 'device-deleted'), false)
  late.resolve()
  await disable
  assert.equal(registered, false)
  assert.equal(f.prefs.pushEnabled, false)
  assert.equal(f.calls.some(c => c[1] === 'during-disable-token'), false)
  assert.ok(f.calls.findIndex(c => c[0] === 'device-saved') < f.calls.findIndex(c => c[0] === 'device-deleted'))
  f.controller.stop()
})

test('uncertain registration stays closed until a deletion successfully reconciles it', async () => {
  const f = fixture({ prefs: { pushEnabled: true } })
  await f.controller.start()
  f.api.registerDevice = async () => { throw new Error('synthetic uncertain transport result') }
  f.handlers.get('registration')({ value: 'uncertain-token' })
  await tick()
  const registrations = []
  f.api.registerDevice = async (session, id, data) => { registrations.push(data.token) }
  f.api.deleteDevice = async () => { throw new Error('synthetic reconciliation failure') }
  await f.controller.refresh()
  assert.deepEqual(registrations, [])
  f.api.deleteDevice = async () => { f.calls.push(['reconciled']) }
  await f.controller.refresh()
  assert.deepEqual(registrations, ['synthetic-device-token'])
  assert.equal(f.controller.getSnapshot().error, '')
  f.controller.stop()
})

test('bounded detach leaves a pending transport barrier in place for the next account', async () => {
  const f = fixture({ prefs: { pushEnabled: true }, controller: { deviceWriteTimeout: 20 } }), late = deferred()
  let owner = null
  f.api.registerDevice = async (session, id, data) => {
    if (data.token === 'blocked-token') await late.promise
    owner = session.scope
  }
  f.api.deleteDevice = async session => { if (owner === session.scope) owner = null }
  f.setSession({ scope: 'production:1:session1' })
  await f.controller.start()
  f.handlers.get('registration')({ value: 'blocked-token' })
  await tick()
  await f.controller.detach()
  assert.equal(f.controller.getSnapshot().busy, false)
  f.setSession({ scope: 'production:2:session2' })
  const refreshB = f.controller.refresh()
  await tick()
  assert.equal(owner, 'production:1:session1')
  late.resolve()
  await refreshB
  assert.equal(owner, 'production:2:session2')
  f.controller.stop()
})

test('an unresponsive OS cleanup cannot keep logout busy indefinitely', async () => {
  const f = fixture({ controller: { nativeCleanupTimeout: 5 } })
  await f.controller.enable()
  f.plugin.unregister = () => new Promise(() => {})
  await f.controller.detach()
  assert.equal(f.controller.getSnapshot().busy, false)
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
