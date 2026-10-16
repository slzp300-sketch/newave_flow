import test from 'node:test'
import assert from 'node:assert/strict'
import { deletionCredentials } from '../src/auth/accountDeletionProof.js'

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
