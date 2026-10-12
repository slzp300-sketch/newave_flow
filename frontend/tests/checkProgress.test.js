import test from 'node:test'
import assert from 'node:assert/strict'
import { eventCheckState, knownQuery, summarizeChecks } from '../src/utils/checkProgress.js'
const success = data => ({ isSuccess: true, data })
const event = { id: 1, attendanceTarget: 'BOTH' }
const state = (students, teacher = success({ status: 'PRESENT' })) => eventCheckState(success([event]), [event], new Map([[1, teacher]]), new Map([[1, students]]))

test('partial student submission and unknown reads cannot mark an event complete', () => {
  assert.equal(state(success([{ status: 'PRESENT' }, { status: null }])), 'pending')
  assert.equal(state(success([{ status: 'PRESENT' }, { status: 'ABSENT' }])), 'done')
  assert.equal(state({ isSuccess: false, data: [] }), 'unknown')
  assert.equal(state(success([]), { isSuccess: false }), 'unknown')
  assert.equal(state(success([]), success(null)), 'pending')
  assert.equal(state(success([])), 'done') // Confirmed empty class has no student work.
})

test('no events, loading and failed cached responses remain distinct', () => {
  assert.equal(eventCheckState(success([]), [], new Map(), new Map()), 'none')
  assert.equal(eventCheckState({ isSuccess: false, data: [] }, [], new Map(), new Map()), 'unknown')
  assert.equal(knownQuery(success(null)), true)
  assert.equal(knownQuery({ ...success([]), isPlaceholderData: true }), false)
  assert.equal(knownQuery({ isSuccess: false, data: { status: 'PRESENT' } }), false)
})

test('summary does not count unavailable events as completed or unknown checks as pending', () => {
  assert.deepEqual(summarizeChecks([{ state: 'done' }, { state: 'unknown' }, { state: 'pending' }, { state: 'none' }]),
    { total: 3, done: 1, unknown: 1, pending: 1, allDone: false })
  assert.equal(summarizeChecks([{ state: 'none' }]).allDone, false)
  assert.equal(summarizeChecks([{ state: 'done' }, { state: 'none' }]).allDone, true)
})
