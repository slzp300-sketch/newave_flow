export const eventToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
export const eventEndDate = event => event?.endDate || event?.eventDate
export const isEventEnded = (event, today = eventToday()) => !!eventEndDate(event) && eventEndDate(event) < today
export const eventAttendanceDeadline = event => event?.attendanceDeadline || eventEndDate(event)
export const eventAttendanceLabels = { disabled: '출석체크 비활성', upcoming: '접수 예정', open: '접수 중', closed: '접수 종료' }
export const eventAttendanceTarget = event => ({ STUDENT_ONLY: '담당 반 학생', TEACHER_ONLY: '교사 본인', BOTH: '교사 본인 + 담당 반 학생' })[event?.attendanceTarget || 'STUDENT_ONLY']

export function eventAttendanceState(event, today = eventToday()) {
  if (!event?.attendanceRequired) return 'disabled'
  const deadline = eventAttendanceDeadline(event)
  if (deadline && today > deadline) return 'closed'
  if (event.attendanceStartDate && today < event.attendanceStartDate) return 'upcoming'
  return 'open'
}
export const isEventAttendanceClosed = (event, today = eventToday()) => eventAttendanceState(event, today) === 'closed'
export const isEventAttendanceInactive = (event, today = eventToday()) => eventAttendanceState(event, today) !== 'open'
export const eventAttendanceMessage = (event, today = eventToday()) => ({
  closed: '출석 접수가 종료되었습니다. 기존 기록만 확인할 수 있어요.',
  upcoming: `${event?.attendanceStartDate}부터 출석을 제출할 수 있어요.`,
  disabled: '출석체크가 비활성화된 일정입니다. 기존 기록만 확인할 수 있어요.',
  open: '접수 기간 안에 참석 여부를 제출해 주세요.',
})[eventAttendanceState(event, today)]

export function validateAttendanceWindow(event) {
  if (!event.attendanceRequired) return null
  if (!event.attendanceStartDate || !event.attendanceDeadline) return '출석 접수 시작일과 마감일을 모두 선택해 주세요.'
  if (event.attendanceStartDate > event.attendanceDeadline) return '출석 접수 마감일은 시작일보다 빠를 수 없습니다.'
  return null
}

// 화면을 열어 둔 채 날짜가 바뀐 경우도 저장 직전에 다시 확인한다.
export function assertEventAttendanceOpen(event, today = eventToday()) {
  if (isEventAttendanceInactive(event, today)) {
    throw new Error(eventAttendanceMessage(event, today))
  }
}
