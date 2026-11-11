import test from 'node:test'
import assert from 'node:assert/strict'
import { createWidgetController, widgetDestination } from '../src/native/widgetController.js'

const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function fixture() {
  let session = { scope: 'live:1:TEACHER' }, saved, changes = 0, calls = []
  const state = () => saved ? { connected: true, scope: saved.scope, expiresAt: saved.expiresAt, lastCheckAt: saved.lastCheckAt } : { connected: false }
  const native = { getState: async () => state(), clear: async () => { calls.push('clear'); saved = null },
    configure: async ({ session }) => { saved = JSON.parse(session); calls.push(saved.scope); return state() }, refresh: async () => state() }
  const controller = createWidgetController({ getSession: () => session, native, now: () => 0,
    connect: s => fixtureConnect(s), onWidgetCheck: () => { changes++ } })
  let fixtureConnect = async () => ({ token: 'synthetic', expiresAt: '2030-01-01T00:00:00Z' })
  return { controller, native, calls, state, setSession: s => { session = s }, setConnect: fn => { fixtureConnect = fn },
    setSaved: s => { saved = s }, saved: () => saved, changes: () => changes }
}

test('widget links only open supported app destinations', () => {
  for (const path of ['/','/tts','/meeting/prayer','/attendance','/calendar?date=2026-11-09','/profile/widgets','/event-attendance/12'])
    assert.equal(widgetDestination(`newaveflow://widget/open?path=${encodeURIComponent(path)}`), path)
  for (const raw of ['https://evil.invalid','newaveflow://auth/open?path=/tts','newaveflow://widget/open?path=https://evil.invalid','newaveflow://widget/open?path=//evil.invalid','newaveflow://widget/open?path=/admin','newaveflow://widget/open?path=/calendar?date=2026-11-09%26token=bad'])
    assert.equal(widgetDestination(raw), null)
})
test('late session credentials cannot restore a widget after logout', async () => {
  const f = fixture(), pending = deferred(); f.setConnect(() => pending.promise)
  void f.controller.start(); await tick(); f.setSession(null); const logout = f.controller.sessionChanged()
  await logout // Logout never waits for a stalled credential request.
  pending.resolve({ token: 'old' }); await tick()
  assert.equal(f.saved(), null); assert.deepEqual(f.calls, ['clear','clear']); assert.equal(f.controller.getSnapshot().connected, false)
})
test('account switch waits for an in-progress configure then clears the previous account', async () => {
  const f = fixture(), pending = deferred(), configure = f.native.configure
  f.native.configure = async v => { if (JSON.parse(v.session).scope.includes(':1:')) await pending.promise; return configure(v) }
  void f.controller.start(); await tick(); f.setSession({scope:'live:2:TEACHER'}); const switched = f.controller.sessionChanged()
  pending.resolve(); await switched
  assert.equal(f.saved().scope,'live:2:TEACHER'); assert.deepEqual(f.calls,['clear','live:1:TEACHER','clear','live:2:TEACHER'])
})
test('existing same-account widget remains usable without reconnecting on every launch', async () => {
  const f = fixture(); f.setSaved({scope:'live:1:TEACHER',expiresAt:'2030-01-01T00:00:00Z',lastCheckAt:'new-check'})
  f.setConnect(() => { throw Error('offline') }); await f.controller.start()
  assert.equal(f.controller.getSnapshot().connected,true); assert.equal(f.changes(),1); assert.equal(f.calls.length,0)
  await f.controller.refresh(); assert.equal(f.changes(),1)
})
test('failed initial connection is retried on a later foreground refresh', async () => {
  const f = fixture(); f.setConnect(() => { throw Error('offline') }); await f.controller.start()
  assert.ok(f.controller.getSnapshot().error); f.setConnect(async () => ({ token:'fresh' })); await f.controller.refresh()
  assert.equal(f.controller.getSnapshot().connected,true); assert.equal(f.controller.getSnapshot().error,'')
})
test('foreground reconnects an expired widget credential using the signed-in app session', async () => {
  const f = fixture(); await f.controller.start(); f.native.refresh = async () => { f.setSaved(null); return {connected:false} }
  await f.controller.refresh(); assert.equal(f.controller.getSnapshot().connected,true)
})
test('refreshes coalesce within one account but never reuse another account response', async () => {
  const f = fixture(); await f.controller.start(); const pending = deferred(); f.native.refresh = () => pending.promise
  const first = f.controller.refresh(); assert.equal(first,f.controller.refresh()); await tick()
  f.setSession({scope:'live:2:TEACHER'}); await f.controller.sessionChanged()
  f.native.refresh = async () => f.state(); const second = f.controller.refresh(); assert.notEqual(first,second); await second
  pending.resolve({connected:false,lastCheckAt:'old-check'}); await first
  assert.equal(f.controller.getSnapshot().connected,true); assert.equal(f.changes(),0)
})
test('stop and restart discard the earlier connection without deleting a persisted session', async () => {
  const f = fixture(), pending = deferred(); f.setConnect(() => pending.promise)
  void f.controller.start(); await tick(); f.controller.stop(); f.setConnect(async () => ({token:'new'})); const restarted = f.controller.start()
  pending.resolve({token:'stale'}); await restarted; assert.equal(f.saved().token,'new')
  f.controller.stop(); assert.equal(f.saved().token,'new')
})
