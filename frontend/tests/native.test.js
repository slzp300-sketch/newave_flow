import test from 'node:test'
import assert from 'node:assert/strict'
import { createSecureStorage } from '../src/native/secureStorage.js'
import { nativeBackDestination } from '../src/native/backNavigation.js'

test('secure session writes finish in order, including logout after refresh', async () => {
  const writes = []
  let release
  const hold = new Promise(resolve => { release = resolve })
  const storage = createSecureStorage({
    async set({ value }) { if (value === 'refresh') await hold; writes.push(value) },
    async remove() { writes.push('logout') },
    async get() { return { value: writes.at(-1) } },
  })
  void storage.setItem('newave-auth', 'refresh')
  void storage.removeItem('newave-auth')
  release()
  await storage.flush()
  assert.deepEqual(writes, ['refresh', 'logout'])
  assert.equal(await storage.getItem('newave-auth'), 'logout')
})

test('secure session failures are surfaced, and a later write can recover', async () => {
  let fail = true
  const errors = []
  const storage = createSecureStorage({
    async set() { if (fail) throw new Error('locked') },
    async get() { throw new Error('unavailable') },
  }, error => errors.push(error.message))
  await storage.setItem('newave-auth', 'session')
  await assert.rejects(storage.flush(), /locked/)
  await assert.rejects(storage.getItem('newave-auth'), /unavailable/)
  assert.deepEqual(errors, ['locked'])
  fail = false
  await storage.setItem('newave-auth', 'session')
  await storage.flush()
})

test('Android back preserves saving and handles deep links without exiting', () => {
  assert.deepEqual(nativeBackDestination('/tts', 4, true), { action: 'wait' })
  assert.deepEqual(nativeBackDestination('/', 4, false), { action: 'minimize' })
  assert.deepEqual(nativeBackDestination('/login', 0, false), { action: 'minimize' })
  assert.deepEqual(nativeBackDestination('/tts', 4, false), { action: 'history' })
  assert.deepEqual(nativeBackDestination('/admin/calendar', 0, false), { action: 'navigate', path: '/admin' })
})
