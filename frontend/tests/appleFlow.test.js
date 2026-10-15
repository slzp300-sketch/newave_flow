import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { createAppleFlow } from '../src/auth/appleFlow.js'

function setup(overrides = {}) {
  const calls = []
  const start = { flowId: 'synthetic-flow', nonce: 'n'.repeat(43), state: 's'.repeat(43) }
  const api = {
    start: async (...args) => { calls.push(['start', ...args]); return { data: start } },
    complete: async data => { calls.push(['complete', data]); return { data: { status: 'REGISTRATION_REQUIRED', ticket: 'synthetic-ticket' } } },
    register: async data => { calls.push(['register', data]) },
    ...overrides.api,
  }
  const native = { signIn: async data => { calls.push(['native', data]); return { state: start.state, identityToken: 'synthetic-identity', authorizationCode: 'synthetic-code', email: 'ignored@example.invalid' } }, ...overrides.native }
  return { flow: createAppleFlow({ api, native, platform: 'ios', cryptoProvider: webcrypto, ...overrides, api, native }), calls, start }
}

test('Apple native authorization binds state, server nonce and device proof; registration keeps explicit user email', async () => {
  const { flow, calls, start } = setup()
  await flow.begin()
  const request = calls.find(c => c[0] === 'complete')[1]
  assert.deepEqual(calls.find(c => c[0] === 'native')[1], { nonce: start.nonce, state: start.state })
  const digest = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(request.verifier))).toString('base64url')
  assert.equal(calls[0][2].challenge, digest)
  assert.equal(request.state, start.state)
  assert.equal(request.authorizationCode, 'synthetic-code')
  assert.equal(request.email, undefined)
  assert.equal(flow.readPending(), true)
  await flow.register({ name: '가상 교사', email: 'chosen@example.invalid', password: 'synthetic-only', phone: '' })
  assert.equal(calls.at(-1)[1].email, 'chosen@example.invalid')
  assert.equal(calls.at(-1)[1].verifier, request.verifier)
  assert.equal(flow.readPending(), false)
  await assert.rejects(flow.register({}), /인증 시간이/)
})

test('Apple wrong state or absent authorization code never reaches server completion', async () => {
  for (const response of [{ state: 'different', identityToken: 'token', authorizationCode: 'code' }, { state: 's'.repeat(43), identityToken: 'token' }]) {
    const { flow, calls } = setup({ native: { signIn: async () => response } })
    await assert.rejects(flow.begin(), /인증 응답/)
    assert.equal(calls.some(c => c[0] === 'complete'), false)
    assert.equal(flow.readPending(), false)
  }
})

test('Apple cancellation permits a fresh retry and keeps no registration proof', async () => {
  let attempts = 0
  const { flow, calls } = setup({ native: { signIn: async () => { attempts++; throw Object.assign(new Error('cancel'), { code: 'APPLE_CANCELLED' }) } } })
  await assert.rejects(flow.begin(), { code: 'APPLE_CANCELLED' })
  await assert.rejects(flow.begin(), { code: 'APPLE_CANCELLED' })
  assert.equal(attempts, 2)
  assert.equal(flow.readPending(), false)
  assert.equal(calls.some(c => c[0] === 'complete'), false)
})

test('Apple registration expires and a new flow clears an earlier registration ticket', async () => {
  let now = 100
  const { flow } = setup({ now: () => now })
  await flow.begin()
  now += 300001
  await assert.rejects(flow.register({}), /인증 시간이/)
  assert.equal(flow.readPending(), false)
  await flow.begin()
  flow.clearPending()
  assert.equal(flow.readPending(), false)
})

test('Apple linking sends password only to authenticated start and requires a linked response', async () => {
  const { flow, calls } = setup({ api: { complete: async () => ({ data: { status: 'LINKED' } }) } })
  assert.equal((await flow.begin('LINK', 'synthetic-password')).status, 'LINKED')
  assert.equal(calls[0][1], 'LINK')
  assert.equal(calls[0][2].currentPassword, 'synthetic-password')
  assert.equal(calls.find(c => c[0] === 'native')[1].currentPassword, undefined)
  assert.equal(flow.readPending(), false)
  const invalid = setup()
  await assert.rejects(invalid.flow.begin('LINK', 'synthetic-password'), /인증을 완료/)
  assert.equal(invalid.flow.readPending(), false)
})

test('Apple signed-in response requires the subject verified by the backend', async () => {
  const session = { user: { id: 1 }, accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' }
  const missing = setup({ api: { complete: async () => ({ data: { status: 'SIGNED_IN', session } }) } })
  await assert.rejects(missing.flow.begin(), /인증을 완료/)
  const verified = setup({ api: { complete: async () => ({ data: { status: 'SIGNED_IN', session, appleSubject: 'verified-server-subject' } }) } })
  assert.equal((await verified.flow.begin()).appleSubject, 'verified-server-subject')
})

test('Apple flow blocks non-iOS, malformed server challenges and concurrent native sheets', async () => {
  const web = setup({ platform: 'web' })
  await assert.rejects(web.flow.begin(), /iPhone/)
  assert.equal(web.calls.length, 0)
  const malformed = setup({ api: { start: async () => ({ data: { flowId: 'flow', nonce: 'short', state: 's'.repeat(43) } }) } })
  await assert.rejects(malformed.flow.begin(), /인증 요청/)
  let release
  const first = setup({ native: { signIn: () => new Promise(resolve => { release = resolve }) } })
  const active = first.flow.begin()
  while (!release) await new Promise(resolve => setTimeout(resolve, 0))
  await assert.rejects(first.flow.begin(), /진행 중/)
  release({ state: first.start.state, identityToken: 'token', authorizationCode: 'code' })
  await active
})
