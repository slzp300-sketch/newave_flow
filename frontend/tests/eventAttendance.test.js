import test from 'node:test'
import assert from 'node:assert/strict'
import { isEventAttendanceClosed, assertEventAttendanceOpen, eventAttendanceState, isEventEnded,
  eventToday, validateAttendanceWindow } from '../src/utils/eventAttendance.js'

test('마감일 당일까지 제출할 수 있고 다음 날부터는 제출할 수 없다', () => {
  const event = { attendanceRequired: true, attendanceDeadline: '2026-10-10' }
  assert.equal(isEventAttendanceClosed(event, '2026-10-09'), false)
  assert.doesNotThrow(() => assertEventAttendanceOpen(event, '2026-10-10'))
  assert.throws(() => assertEventAttendanceOpen(event, '2026-10-11'), /접수가 종료/)
})

test('기존 마감일 없는 행사는 종료일을 기준으로 접수를 종료한다', () => {
  for (const attendanceDeadline of [null, undefined, '']) {
    const event = { attendanceRequired: true, endDate: '2026-10-09', attendanceDeadline }
    assert.doesNotThrow(() => assertEventAttendanceOpen(event, '2026-10-09'))
    assert.throws(() => assertEventAttendanceOpen(event, '2026-10-11'), /기존 기록만 확인/)
  }
})

test('월말과 연말의 마감일도 다음 날짜부터 막는다', () => {
  assert.equal(isEventAttendanceClosed({ attendanceRequired: true, attendanceDeadline: '2026-10-31' }, '2026-11-01'), true)
  assert.equal(isEventAttendanceClosed({ attendanceRequired: true, attendanceDeadline: '2026-12-31' }, '2027-01-01'), true)
})

test('이전에 열어 둔 행사도 제출 시점의 오늘 날짜로 다시 검사한다', () => {
  const yesterday = new Date(eventToday() + 'T00:00:00Z')
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const event = { attendanceRequired: true, attendanceDeadline: yesterday.toISOString().slice(0, 10) }
  assert.doesNotThrow(() => assertEventAttendanceOpen(event, event.attendanceDeadline))
  assert.throws(() => assertEventAttendanceOpen(event), /기존 기록만 확인/)
})

test('접수 예정·진행·종료·비활성을 구분하고 시작일·마감일 당일은 허용한다', () => {
  const event = { attendanceRequired: true, attendanceStartDate: '2026-10-12', attendanceDeadline: '2026-10-15', eventDate: '2026-10-20' }
  assert.equal(eventAttendanceState(event, '2026-10-11'), 'upcoming')
  assert.throws(() => assertEventAttendanceOpen(event, '2026-10-11'), /2026-10-12부터/)
  assert.equal(eventAttendanceState(event, '2026-10-12'), 'open')
  assert.equal(eventAttendanceState(event, '2026-10-15'), 'open')
  assert.equal(eventAttendanceState(event, '2026-10-16'), 'closed')
  assert.equal(eventAttendanceState({ ...event, attendanceRequired: false }, '2026-10-12'), 'disabled')
  assert.throws(() => assertEventAttendanceOpen({ ...event, attendanceRequired: false }, '2026-10-12'), /비활성/)
  assert.equal(isEventEnded(event, '2026-10-16'), false)
  assert.equal(isEventEnded(event, '2026-10-21'), true)
  assert.equal(isEventEnded({ ...event, endDate: '2026-10-22' }, '2026-10-21'), false)
})

test('접수 기간 양쪽 날짜를 요구하며 같은 날과 행사 후 별도 접수도 허용한다', () => {
  const event = { attendanceRequired: true, eventDate: '2026-10-10', attendanceStartDate: '2026-10-12', attendanceDeadline: '2026-10-12' }
  assert.equal(validateAttendanceWindow(event), null)
  assert.match(validateAttendanceWindow({ ...event, attendanceDeadline: '' }), /모두 선택/)
  assert.match(validateAttendanceWindow({ ...event, attendanceDeadline: '2026-10-11' }), /빠를 수/)
  assert.equal(validateAttendanceWindow({ attendanceRequired: false }), null)
  assert.equal(eventAttendanceState(event, '2026-10-12'), 'open')
})
