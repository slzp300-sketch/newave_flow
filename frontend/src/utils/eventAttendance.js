import { toApiDate } from './date.js'

// 서버와 동일하게 마감일 당일까지 제출 가능하다. 마감일이 없으면 제한하지 않는다.
export function isEventAttendanceClosed(event, today = toApiDate()) {
  return !!(event?.attendanceDeadline && today > event.attendanceDeadline)
}

// 화면을 열어 둔 채 날짜가 바뀐 경우도 저장 직전에 다시 확인한다.
export function assertEventAttendanceOpen(event, today = toApiDate()) {
  if (isEventAttendanceClosed(event, today)) {
    throw new Error('출석 제출 기간이 마감되었습니다. 기존 기록만 확인할 수 있어요.')
  }
}
