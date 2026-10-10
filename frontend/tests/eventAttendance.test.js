import test from 'node:test'
import assert from 'node:assert/strict'
import { isEventAttendanceClosed, assertEventAttendanceOpen } from '../src/utils/eventAttendance.js'

test('마감일 당일까지 제출할 수 있고 다음 날부터는 제출할 수 없다', () => {
  const event = { attendanceDeadline: '2026-10-10' }
  assert.equal(isEventAttendanceClosed(event, '2026-10-09'), false)
  assert.doesNotThrow(() => assertEventAttendanceOpen(event, '2026-10-10'))
  assert.throws(() => assertEventAttendanceOpen(event, '2026-10-11'), /제출 기간이 마감/)
})

test('마감일이 없으면 행사 종료일이 지나도 임의로 제출을 막지 않는다', () => {
  for (const attendanceDeadline of [null, undefined, '']) {
    const event = { endDate: '2026-10-09', attendanceDeadline }
    assert.doesNotThrow(() => assertEventAttendanceOpen(event, '2026-10-11'))
  }
})

test('월말과 연말의 마감일도 다음 날짜부터 막는다', () => {
  assert.equal(isEventAttendanceClosed({ attendanceDeadline: '2026-10-31' }, '2026-11-01'), true)
  assert.equal(isEventAttendanceClosed({ attendanceDeadline: '2026-12-31' }, '2027-01-01'), true)
})

test('이전에 열어 둔 행사도 제출 시점의 오늘 날짜로 다시 검사한다', () => {
  const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const now = new Date()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const event = { attendanceDeadline: localDate(yesterday) }
  assert.doesNotThrow(() => assertEventAttendanceOpen(event, event.attendanceDeadline))
  assert.throws(() => assertEventAttendanceOpen(event), /기존 기록만 확인/)
})
