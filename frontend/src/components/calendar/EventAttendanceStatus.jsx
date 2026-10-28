import { eventAttendanceState, eventAttendanceLabels, eventAttendanceDeadline, eventAttendanceTarget } from '../../utils/eventAttendance'

export default function EventAttendanceStatus({ event, today }) {
  if (!event?.attendanceRequired) return null
  const state = eventAttendanceState(event, today)
  const targets = eventAttendanceTarget(event).split(' + ')
  return <div className={`mt-2 space-y-1 text-sm leading-relaxed ${state === 'open' ? 'text-primary-800' : 'text-gray-700'}`}>
    <p className="flex flex-wrap gap-x-1 gap-y-0.5 font-semibold">
      <span className="whitespace-nowrap">{eventAttendanceLabels[state]} ·</span>
      {targets.map((target, index) => <span key={target} className="inline-block whitespace-nowrap">{index > 0 ? '+ ' : ''}{target}</span>)}
    </p>
    <p className="flex flex-wrap gap-x-1 gap-y-0.5" style={{ fontSize: 'clamp(12px,.875rem,14px)' }}>
      <span>접수</span><span className="inline-block whitespace-nowrap">{event.attendanceStartDate || '시작일 제한 없음'}</span>
      <span className="inline-block whitespace-nowrap">~ {eventAttendanceDeadline(event)}까지</span>
    </p>
  </div>
}
