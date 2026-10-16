import test from 'node:test'
import assert from 'node:assert/strict'
import { deletionCredentials, publicDeletionEnvironment } from '../src/auth/accountDeletionProof.js'

test('Apple-only deletion requires a fresh proof and forwards no password or provider token', async () => {
  const methods = []
  const result = await deletionCredentials('APPLE', { password: 'must-not-send', beginApple: async method => {
    methods.push(method)
    return { appleFlowId: 'flow', appleTicket: 'ticket', appleVerifier: 'verifier', identityToken: 'must-not-send' }
  } })
  assert.deepEqual(methods, ['DELETE'])
  assert.deepEqual(result, { appleFlowId: 'flow', appleTicket: 'ticket', appleVerifier: 'verifier' })
})

test('Apple cancellation or invalid proof cannot fall back to password deletion', async () => {
  const cancelled = Object.assign(new Error('cancelled'), { code: 'APPLE_CANCELLED' })
  await assert.rejects(deletionCredentials('APPLE', { password: 'unused', beginApple: async () => { throw cancelled } }), { code: 'APPLE_CANCELLED' })
  await assert.rejects(deletionCredentials('APPLE', { beginApple: async () => ({ appleFlowId: 'flow', appleTicket: 'ticket' }) }), /본인 확인/)
  await assert.rejects(deletionCredentials('UNKNOWN', {}), /본인 확인 방법/)
})

test('Existing password accounts retain password reauthentication without invoking Apple', async () => {
  const result = await deletionCredentials('PASSWORD', { password: 'synthetic-only', beginApple: async () => { throw new Error('must not run') } })
  assert.deepEqual(result, { password: 'synthetic-only' })
  await assert.rejects(deletionCredentials('PASSWORD', { password: '' }), /비밀번호/)
})

test('Logged-out Apple deletion requests public proof and cannot be routed to the review service by email', async () => {
  const methods = []
  const credentials = await deletionCredentials('APPLE', { publicRequest: true, email: 'synthetic@review.newaveflow.invalid', password: 'must-not-send', beginApple: async mode => {
    methods.push(mode)
    return { appleFlowId: 'flow', appleTicket: 'ticket', appleVerifier: 'verifier' }
  } })
  assert.deepEqual(methods, ['DELETE_PUBLIC'])
  assert.deepEqual(credentials, { appleFlowId: 'flow', appleTicket: 'ticket', appleVerifier: 'verifier' })
  assert.equal(publicDeletionEnvironment(credentials), 'production')
  assert.equal(publicDeletionEnvironment({ ...credentials, email: 'synthetic@review.newaveflow.invalid' }), 'production')
})

test('Logged-out password deletion requires email and keeps synthetic review routing separate', async () => {
  const credentials = await deletionCredentials('PASSWORD', { publicRequest: true, email: '  Synthetic@review.newaveflow.invalid ', password: 'synthetic-only' })
  assert.deepEqual(credentials, { email: 'Synthetic@review.newaveflow.invalid', password: 'synthetic-only' })
  assert.equal(publicDeletionEnvironment(credentials), 'review')
  assert.equal(publicDeletionEnvironment({ email: 'synthetic@example.invalid' }), 'production')
  await assert.rejects(deletionCredentials('PASSWORD', { publicRequest: true, email: ' ', password: 'synthetic-only' }), /이메일/)
  await assert.rejects(deletionCredentials('PASSWORD', { publicRequest: true, email: 'synthetic@example.invalid', password: '' }), /비밀번호/)
})

test('Public Apple cancellation does not return deletion credentials or fall back to an email password', async () => {
  await assert.rejects(deletionCredentials('APPLE', { publicRequest: true, password: 'unused', beginApple: async mode => {
    assert.equal(mode, 'DELETE_PUBLIC')
    throw Object.assign(new Error('cancelled'), { code: 'APPLE_CANCELLED' })
  } }), { code: 'APPLE_CANCELLED' })
})
