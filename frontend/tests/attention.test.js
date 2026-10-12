import test from 'node:test'
import assert from 'node:assert/strict'
import { todayTtsChecks, attendanceTaskState, knownRead, eventFingerprint, parseSeenEvents,
  eventSeenKey, isUnseenEvent, mergeSeenEvents } from '../src/utils/attention.js'

const questions = [
  { id: 1, type: 'DAYS', title: '말씀', linkType: 'NONE' },
  { id: 2, type: 'DAYS', title: '기도' },
  { id: 3, type: 'ATTEND', title: '주일 예배', linkType: 'NONE' },
  { id: 4, type: 'ATTEND', linkType: 'SAT_MEETING' },
]
const week = { answers: [{ questionId: 1, answerData: '{"월":true,"화":false}' }, { questionId: 3, answerData: 'true' }] }
const success = data => ({ isSuccess: true, data, fetchStatus: 'idle' })
const event = { id: 1, title: '가상 행사', eventDate: '2026-10-17', endDate: '2026-10-18', description: '가상 안내', startTime: '10:00' }

test('Home checks today only and resets reminders at the next day', () => {
  const monday = todayTtsChecks(questions, week, '2026-10-12')
  assert.deepEqual(monday.map(c => [c.q.id, c.day, c.checked]), [[1, '월', true], [2, '월', false]])
  assert.deepEqual(todayTtsChecks(questions, week, '2026-10-13').map(c => c.checked), [false, false])
  assert.equal(todayTtsChecks(questions, week, '2026-10-17')[0].day, '토')
})

test('Sunday offers manual attendance, never linked or imported score fields', () => {
  assert.deepEqual(todayTtsChecks(questions, week, '2026-10-11').map(c => [c.q.id, c.day, c.checked]), [[3, null, true]])
  assert.deepEqual(todayTtsChecks(questions, { ...week, importedPeriod: true }, '2026-10-12'), [])
  assert.deepEqual(todayTtsChecks(questions, undefined, '2026-10-12'), [])
  assert.equal(todayTtsChecks(questions, { answers: [{ questionId: 1, answerData: 'broken' }] }, '2026-10-12')[0].checked, false)
})

test('Collective attendance completion, no assigned class, and unavailable reads stay distinct', () => {
  assert.equal(attendanceTaskState(success({ attendanceSubmittedThisWeek: true }), success([{ id: 1 }])), 'done')
  assert.equal(attendanceTaskState(success({ attendanceSubmittedThisWeek: false }), success([{ id: 1 }])), 'pending')
  assert.equal(attendanceTaskState(success({ attendanceSubmittedThisWeek: false }), success([])), 'none')
  for (const extra of [{ isSuccess: false }, { isError: true }, { fetchStatus: 'paused' }, { isPlaceholderData: true }]) {
    const unavailable = { ...success({ attendanceSubmittedThisWeek: true }), ...extra }
    assert.equal(knownRead(unavailable), false)
    assert.equal(attendanceTaskState(unavailable, success([{ id: 1 }])), 'unknown')
  }
})

test('Opening an event acknowledges that version only; a changed date or description is new again', () => {
  const seen = mergeSeenEvents({}, [event])
  assert.equal(isUnseenEvent(event, {}, '2026-10-12'), true)
  assert.equal(isUnseenEvent(event, seen, '2026-10-12'), false)
  for (const field of ['title', 'description', 'eventDate', 'endDate', 'startTime', 'endTime', 'attendanceDeadline', 'attendanceTarget']) {
    assert.equal(isUnseenEvent({ ...event, [field]: 'changed' }, seen, '2026-10-12'), true, field)
  }
  assert.equal(eventFingerprint({ ...event, updatedAt: 'irrelevant' }), eventFingerprint(event))
  assert.equal(isUnseenEvent({ ...event, id: 2 }, seen, '2026-10-12'), true)
})

test('Ended events do not keep reminders; ongoing events do, and read state survives serialization', () => {
  assert.equal(isUnseenEvent(event, {}, '2026-10-18'), true)
  assert.equal(isUnseenEvent(event, {}, '2026-10-19'), false)
  const original = mergeSeenEvents({}, [event])
  const next = mergeSeenEvents(original, [{ ...event, id: 2 }])
  assert.equal(Object.keys(original).length, 1)
  assert.equal(Object.keys(next).length, 2)
  assert.equal(isUnseenEvent(event, parseSeenEvents(JSON.stringify(next)), '2026-10-12'), false)
  assert.ok(!JSON.stringify(next).includes(event.description))
  assert.notEqual(eventSeenKey(1), eventSeenKey(2))
  for (const raw of ['bad json', 'null', '[]', 'false', '1']) assert.deepEqual(parseSeenEvents(raw), {})
})
