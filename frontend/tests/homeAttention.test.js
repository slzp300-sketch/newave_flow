import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyTtsChecks, minutesTaskState, hasRotationThisWeek } from '../src/utils/attention.js'

const questions = [{ id: 1, type: 'DAYS' }, { id: 2, type: 'ATTEND' },
  { id: 3, type: 'ATTEND', linkType: 'SAT_MEETING' }, { id: 4, type: 'DAYS', active: false }]
const week = { weekStart: '2026-10-11', editableDays: ['월', '화', '수', '목', '금', '토'],
  attendanceEditable: true, attendanceDate: '2026-10-17', answers: [{ questionId: 1, answerData: '{"화":true}' }] }
const success = data => ({ isSuccess: true, data, fetchStatus: 'idle' })

test('Home includes past gaps even when today is complete, without tomorrow or linked fields', () => {
  assert.deepEqual(weeklyTtsChecks(questions, week, '2026-10-13').map(c => [c.q.id, c.day, c.checked]),
    [[1, '월', false], [1, '화', true]])
  assert.deepEqual(weeklyTtsChecks(questions, week, '2026-10-11'), [])
  const saturday = weeklyTtsChecks(questions, week, '2026-10-17')
  assert.equal(saturday.length, 7)
  assert.equal(saturday.at(-1).q.id, 2)
  assert.equal(saturday.at(-1).checked, false)
})

test('Home excludes closed, imported, stale and quarter-boundary locked checks', () => {
  for (const change of [{ closedQuarter: true }, { importedPeriod: true }, { weekStart: '2026-10-04' }]) {
    assert.deepEqual(weeklyTtsChecks(questions, { ...week, ...change }, '2026-10-13'), [])
  }
  const boundary = { ...week, weekStart: '2026-09-27', attendanceDate: '2026-10-03', editableDays: ['목'] }
  assert.deepEqual(weeklyTtsChecks(questions, boundary, '2026-10-01').map(c => c.day), ['목'])
  assert.deepEqual(weeklyTtsChecks(questions, { ...boundary, editableDays: ['월', '목'] }, '2026-10-01').map(c => c.day), ['목'])
  assert.equal(weeklyTtsChecks(questions, { ...week, attendanceEditable: false }, '2026-10-17').length, 6)
  assert.deepEqual(weeklyTtsChecks(questions, undefined, '2026-10-13'), [])
})

test('Saved completion removes TTS gaps, malformed answers do not imply completion', () => {
  assert.ok(weeklyTtsChecks(questions, { ...week, answers: [{ questionId: 1, answerData: '{"월":true,"화":true}' }] }, '2026-10-13').every(c => c.checked))
  assert.ok(weeklyTtsChecks(questions, { ...week, answers: [{ questionId: 1, answerData: 'broken' }] }, '2026-10-13').every(c => !c.checked))
})

test('Minutes reminders require confirmed absence and published unconfirmed minutes', () => {
  const published = success({ currentWeekMinutesExists: true, currentWeekMinutesConfirmed: false })
  assert.equal(minutesTaskState(success({ status: 'ABSENT' }), published), 'pending')
  for (const meeting of [null, { status: 'PRESENT' }]) assert.equal(minutesTaskState(success(meeting), published), 'none')
  assert.equal(minutesTaskState(success({ status: 'ABSENT' }), success({ currentWeekMinutesExists: false })), 'none')
  assert.equal(minutesTaskState(success({ status: 'ABSENT' }), success({ currentWeekMinutesExists: true, currentWeekMinutesConfirmed: true })), 'done')
  for (const extra of [{ isError: true }, { fetchStatus: 'paused' }, { isSuccess: false }]) {
    assert.equal(minutesTaskState({ ...success({ status: 'ABSENT' }), ...extra }, published), 'unknown')
    assert.equal(minutesTaskState(success({ status: 'ABSENT' }), { ...published, ...extra }), 'unknown')
  }
})

test('Rotation identifies current Monday-Sunday assignment, never cancelled or other weeks', () => {
  const schedule = { scheduledDate: '2026-10-17', status: 'ACTIVE' }
  assert.equal(hasRotationThisWeek([schedule], '2026-10-12'), true)
  assert.equal(hasRotationThisWeek([schedule], '2026-10-18'), true)
  assert.equal(hasRotationThisWeek([schedule], '2026-10-19'), false)
  for (const status of ['CANCELED', 'COMPLETED']) assert.equal(hasRotationThisWeek([{ ...schedule, status }], '2026-10-12'), false)
  assert.equal(hasRotationThisWeek([], '2026-10-12'), false)
})
