import test from 'node:test'
import assert from 'node:assert/strict'
import { reportTarget, reportSubmission } from '../src/utils/communitySafety.js'

test('report links reject malformed, unsafe or unsupported targets', () => {
  for (const query of ['?targetType=USER&targetId=-1', '?targetType=USER&targetId=1e3', '?targetType=USER&targetId=9007199254740993', '?targetType=CONTENT&contentType=PRIVATE_DB&targetId=1'])
    assert.deepEqual(reportTarget(query), { targetType: 'CONTENT', contentType: 'OTHER', targetId: null })
  assert.deepEqual(reportTarget('?targetType=USER&targetId=12'), { targetType: 'USER', contentType: null, targetId: 12 })
  assert.deepEqual(reportTarget('?targetType=CONTENT&contentType=MEETING_MINUTE&targetId=42'), { targetType: 'CONTENT', contentType: 'MEETING_MINUTE', targetId: 42 })
})
test('uncertain report submission keeps the id while any edited payload receives a new id', () => {
  let generated = 0
  const generate = () => `request-${++generated}`
  const original = { targetType: 'CONTENT', subject: 'Synthetic', details: 'First' }
  const first = reportSubmission(null, original, generate)
  assert.equal(reportSubmission(first, { ...original }, generate).id, first.id)
  assert.notEqual(reportSubmission(first, { ...original, details: 'Edited' }, generate).id, first.id)
  assert.notEqual(reportSubmission(first, { ...original, subject: 'Different target' }, generate).id, first.id)
  assert.equal(generated, 3)
})
