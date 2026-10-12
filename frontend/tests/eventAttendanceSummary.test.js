import test from 'node:test'
import assert from 'node:assert/strict'
import { eventAttendanceCounts } from '../src/utils/eventAttendanceSummary.js'

test('partial attendance is distinct from present and unsubmitted, and all four counts add up', () => {
  const records = ['PRESENT', 'PARTIAL', 'ABSENT', null].map(status => ({ status }))
  const counts = eventAttendanceCounts(records)
  assert.deepEqual(counts, { total: 4, present: 1, partial: 1, absent: 1, unsubmitted: 1 })
  assert.equal(counts.present + counts.partial + counts.absent + counts.unsubmitted, counts.total)
})

test('snapshot members without records remain unsubmitted and a genuinely empty event stays zero', () => {
  assert.equal(eventAttendanceCounts([{ status: 'PARTIAL' }], 3).unsubmitted, 2)
  assert.deepEqual(eventAttendanceCounts([]), { total: 0, present: 0, partial: 0, absent: 0, unsubmitted: 0 })
})
