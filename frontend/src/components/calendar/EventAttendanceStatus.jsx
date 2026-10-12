import { eventAttendanceState, eventAttendanceLabels, eventAttendanceDeadline, eventAttendanceTarget } from '../../utils/eventAttendance'

export default function EventAttendanceStatus({ event, today }) {
  if (!event?.attendanceRequired) return null
  const state = eventAttendanceState(event, today)
  return <div className={`mt-2 space-y-1 text-xs ${state === 'open' ? 'text-primary-700' : 'text-gray-600'}`}>
    <p className="font-semibold">{eventAttendanceLabels[state]} · {eventAttendanceTarget(event)}</p>
    <p>접수 {event.attendanceStartDate || '시작일 제한 없음'} ~ {eventAttendanceDeadline(event)}까지</p>
  </div>
}
