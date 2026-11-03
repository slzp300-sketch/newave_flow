import test from 'node:test'
import assert from 'node:assert/strict'
import { compareStoreVersions, iosVersionFromUserAgent, readStoreRelease, startStoreUpdateMonitor,
  STORE_APP_ID, STORE_BUNDLE_ID, STORE_URL, STORE_LOOKUP_URL, STORE_CACHE_KEY, STORE_DISMISS_KEY,
  STORE_CHECK_INTERVAL, STORE_RETRY_INTERVAL, STORE_REMIND_INTERVAL } from '../src/native/storeUpdate.js'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const epoch = Date.UTC(2026, 9, 31)
const response = (version = '1.0.3', extra = {}) => ({ status: 200, data: { results: [{
  trackId: Number(STORE_APP_ID), bundleId: STORE_BUNDLE_ID, kind: 'software', version,
  minimumOsVersion: '15.4', currentVersionReleaseDate: '2026-10-30T19:26:16Z', ...extra,
}] } })

function setup(options = {}) {
  let time = epoch, online = true, installed = options.installed || '1.0.2', removed = 0, calls = 0
  const values = options.values || new Map(), listeners = new Map(), notices = [], requests = [], events = new EventTarget()
  const storage = options.storage || { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const task = startStoreUpdateMonitor({ platform: options.platform || 'ios', storage, events,
    userAgent: options.userAgent || 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X)',
    now: () => time, isOnline: () => online, onChange: value => notices.push(value),
    app: {
      getInfo: options.getInfo || (async () => ({ id: STORE_BUNDLE_ID, version: installed })),
      async addListener(name, callback) {
        if (options.listenerDelay) await options.listenerDelay
        listeners.set(name, callback)
        return { remove() { removed++; listeners.delete(name); return Promise.resolve() } }
      },
    },
    http: { async get(request) { calls++; requests.push(request); return options.request ? options.request(calls) : response() } },
  })
  return { task, values, notices, requests, events, calls: () => calls, removed: () => removed,
    advance: amount => { time += amount }, setOnline: value => { online = value },
    setInstalled: value => { installed = value },
    active: value => listeners.get('appStateChange')?.({ isActive: value }),
    last: () => notices.at(-1),
  }
}

test('store versions compare numeric components and reject non-release versions', () => {
  assert.equal(compareStoreVersions('1.0.10', '1.0.9'), 1)
  assert.equal(compareStoreVersions('1.10', '1.9.9'), 1)
  assert.equal(compareStoreVersions('2', '1.99.99'), 1)
  assert.equal(compareStoreVersions('1.2', '1.2.0'), 0)
  assert.equal(compareStoreVersions('1.0.2', '1.0.3'), -1)
  for (const invalid of ['1.0.3-beta', '', null, '1e3', '1.2.3.4', '999999999999']) {
    assert.equal(compareStoreVersions(invalid, '1.0.2'), null)
    assert.equal(compareStoreVersions('1.0.2', invalid), null)
  }
})

test('only the matching published app is accepted, not a future release or response URL', () => {
  const release = readStoreRelease(response('1.0.3', { trackViewUrl: 'https://untrusted.example' }), epoch)
  assert.equal(release.version, '1.0.3')
  for (const extra of [{ trackId: 1 }, { bundleId: 'other.app' }, { kind: 'song' },
    { version: 'preview' }, { minimumOsVersion: '' }, { currentVersionReleaseDate: '2027-01-01' }]) {
    assert.equal(readStoreRelease(response('1.0.3', extra), epoch), null)
  }
  assert.equal(readStoreRelease({ status: 200, data: { results: [] } }, epoch), null)
  assert.deepEqual(readStoreRelease({ status: 200, data: JSON.stringify(response().data) }, epoch), release)
  assert.throws(() => readStoreRelease({ status: 503, data: response().data }, epoch))
  assert.throws(() => readStoreRelease({ status: 200, data: 'not json' }, epoch))
  assert.throws(() => readStoreRelease({ status: 200, data: {} }, epoch))
})

test('startup checks native installed version and uses only the fixed public Apple lookup/link', async () => {
  const t = setup(); await tick()
  assert.deepEqual(t.last(), { currentVersion: '1.0.2', version: '1.0.3', url: STORE_URL })
  assert.deepEqual(t.requests, [{ url: STORE_LOOKUP_URL, responseType: 'json', connectTimeout: 8000, readTimeout: 8000 }])
  t.task.stop()
})

test('current and newer installed builds never show a downgrade prompt', async () => {
  for (const installed of ['1.0.3', '1.0.4', '2.0']) {
    const t = setup({ installed }); await tick(); assert.equal(t.last(), null); t.task.stop()
  }
})

test('unsupported iOS releases are not offered; known iPhone and iPad OS versions parse', async () => {
  assert.equal(iosVersionFromUserAgent('iPad; CPU OS 15_4_1 like Mac OS X'), '15.4.1')
  assert.equal(iosVersionFromUserAgent('Android 15'), null)
  const t = setup({ userAgent: 'iPhone; CPU iPhone OS 15_3 like Mac OS X' })
  await tick(); assert.equal(t.last(), null); t.task.stop()
})

test('web, Android and another bundle never query the iOS catalog', async () => {
  for (const platform of ['web', 'android']) {
    const t = setup({ platform }); await t.task.check(); assert.equal(t.calls(), 0); t.task.stop()
  }
  const t = setup({ getInfo: async () => ({ id: 'another.app', version: '1.0' }) })
  await tick(); assert.equal(t.calls(), 0); assert.equal(t.last(), null); t.task.stop()
})

test('foreground reuses a fresh persisted cache and checks again after one hour', async () => {
  const t = setup(); await tick()
  t.active(false); assert.equal(t.last(), null)
  t.active(true); await tick(); assert.equal(t.calls(), 1); assert.equal(t.last().version, '1.0.3')
  t.advance(STORE_CHECK_INTERVAL); t.active(true); await tick(); assert.equal(t.calls(), 2)
  t.task.stop()
  const next = setup({ values: t.values }); await tick(); assert.equal(next.calls(), 1) // Reject future cache times after a clock change.
  next.task.stop()
  const restart = setup({ values: next.values }); await tick(); assert.equal(restart.calls(), 0)
  restart.task.stop()
})

test('later survives restarts for one day but a newly published version is shown', async () => {
  const t = setup(); await tick(); t.task.dismiss(); assert.equal(t.last(), null); t.task.stop()
  const restart = setup({ values: t.values, request: () => response('1.0.4') })
  await tick(); assert.equal(restart.last(), null)
  restart.advance(STORE_CHECK_INTERVAL); restart.active(true); await tick()
  assert.equal(restart.last().version, '1.0.4'); restart.task.stop()
  const tomorrow = setup({ values: t.values }); tomorrow.advance(STORE_REMIND_INTERVAL)
  await tick(); assert.equal(tomorrow.last().version, '1.0.3'); tomorrow.task.stop()
})

test('installed version is re-read on resume even with cached store metadata', async () => {
  const t = setup(); await tick(); t.setInstalled('1.0.3'); t.active(true); await tick()
  assert.equal(t.last(), null); assert.equal(t.calls(), 1); t.task.stop()
})

test('offline does not request and online recovery can discover an update', async () => {
  const t = setup(); await tick(); t.advance(STORE_CHECK_INTERVAL)
  t.setOnline(false); t.active(true); await tick(); assert.equal(t.calls(), 1)
  t.setOnline(true); t.events.dispatchEvent(new Event('online')); await tick(); assert.equal(t.calls(), 2)
  t.task.stop()
})

test('lookup failure is quiet, retries are bounded, and later recovery works', async () => {
  const t = setup({ request: count => { if (count === 1) throw Error('offline'); return response() } })
  await tick(); assert.equal(t.last(), null)
  t.active(true); t.events.dispatchEvent(new Event('online')); await tick(); assert.equal(t.calls(), 1)
  t.advance(STORE_RETRY_INTERVAL); t.active(true); await tick(); assert.equal(t.last().version, '1.0.3')
  t.task.stop()
})

test('simultaneous lifecycle events share a request and late results after stop are ignored', async () => {
  let finish
  const t = setup({ request: () => new Promise(resolve => { finish = resolve }) })
  await tick(); t.active(true); t.events.dispatchEvent(new Event('online')); await tick()
  assert.equal(t.calls(), 1)
  t.task.stop(); finish(response()); await tick()
  assert.equal(t.notices.length, 0); assert.equal(t.values.size, 0); assert.equal(t.removed(), 1)
  t.events.dispatchEvent(new Event('online')); await tick(); assert.equal(t.calls(), 1)
})

test('a background lookup never displays a banner until the app resumes', async () => {
  let finish
  const t = setup({ request: () => new Promise(resolve => { finish = resolve }) })
  await tick(); t.active(false); finish(response()); await tick(); assert.equal(t.last(), null)
  t.active(true); await tick(); assert.equal(t.last().version, '1.0.3'); t.task.stop()
})

test('corrupt or inaccessible storage does not prevent app use or version checks', async () => {
  const values = new Map([[STORE_CACHE_KEY, '{broken'], [STORE_DISMISS_KEY, 'not json']])
  const broken = setup({ values }); await tick(); assert.equal(broken.last().version, '1.0.3'); broken.task.stop()
  const locked = setup({ storage: { getItem() { throw Error('denied') }, setItem() { throw Error('full') } } })
  await tick(); locked.task.dismiss(); locked.active(true); await tick(); assert.equal(locked.last(), null)
  locked.task.stop()
})

test('a listener that finishes registering after cleanup is removed', async () => {
  let finish
  const t = setup({ listenerDelay: new Promise(resolve => { finish = resolve }) })
  t.task.stop(); finish(); await tick(); assert.equal(t.removed(), 1)
})
