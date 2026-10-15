import test from 'node:test'
import assert from 'node:assert/strict'
import { createDeletionReceiptStore, parseDeletionReceipt, DELETION_RECEIPT_KEY, deletionStatusLabel } from '../src/auth/deletionReceipt.js'
const value = { receiptToken: 'a'.repeat(43), requestId: 'synthetic-request', apiEnvironment: 'review', savedAt: 123 }
test('receipt survives session logout and retains the review environment', async () => {
  const data = new Map([['newave-auth', 'synthetic session']])
  const store = createDeletionReceiptStore({ getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) })
  await store.save(value)
  data.delete('newave-auth')
  assert.deepEqual(await store.read(), value)
  await store.clear()
  assert.equal(data.get(DELETION_RECEIPT_KEY), undefined)
})
test('receipt rejects arbitrary API destinations, malformed codes, and corrupted storage', () => {
  for (const bad of [null, '{bad json', { ...value, apiEnvironment: 'https://attacker.invalid' }, { ...value, receiptToken: 'short' }, { ...value, receiptToken: '!'.repeat(43) }]) assert.equal(parseDeletionReceipt(bad), null)
  const parsed = parseDeletionReceipt({ ...value, password: 'must-not-store', email: 'synthetic@example.invalid' })
  assert.equal(parsed.password, undefined)
  assert.equal(parsed.email, undefined)
})
test('receipt persistence waits for native flush and propagates storage failure', async () => {
  let flushed = false
  const store = createDeletionReceiptStore({ setItem() {}, flush() { flushed = true; throw new Error('locked'); } })
  await assert.rejects(store.save(value), /locked/)
  assert.equal(flushed, true)
})
test('pending and unknown states are never presented as deleted', () => {
  assert.equal(deletionStatusLabel('REQUESTED'), '삭제 요청 접수됨')
  assert.equal(deletionStatusLabel('COMPLETED'), '계정 삭제 완료')
  assert.equal(deletionStatusLabel('unexpected'), '처리 상태 확인 중')
})
