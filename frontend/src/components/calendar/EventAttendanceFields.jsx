import { useId } from 'react'

export default function EventAttendanceFields({ value, onChange }) {
  const id = useId()
  return <fieldset className="min-w-0 space-y-4 rounded-2xl border border-primary-200 p-4">
    <legend className="px-1 text-sm font-semibold">출석 접수 설정</legend>
    <div>
      <p id={`${id}-target`} className="mb-2 text-xs font-semibold">대상자</p>
      <div role="group" aria-labelledby={`${id}-target`} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2">
        {[['TEACHER_ONLY', '교사만'], ['STUDENT_ONLY', '학생만'], ['BOTH', '교사 + 학생']].map(([target, label]) =>
          <button key={target} type="button" aria-pressed={value.attendanceTarget === target}
            onClick={() => onChange({ attendanceTarget: target })} className="min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold">{label}</button>)}
      </div>
      <p className="mt-2 text-xs text-gray-500">교사는 본인 참석 여부를, 학생은 담당 교사가 반별로 체크합니다.</p>
    </div>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
      <div className="min-w-0">
        <label htmlFor={`${id}-start`} className="mb-1.5 block text-xs font-semibold">접수 시작일</label>
        <input id={`${id}-start`} required type="date" value={value.attendanceStartDate || ''}
          max={value.attendanceDeadline || undefined} onChange={e => onChange({ attendanceStartDate: e.target.value })}
          className="min-h-11 w-full min-w-0 rounded-xl border border-primary-200 bg-white px-3 py-3 text-sm" />
      </div>
      <div className="min-w-0">
        <label htmlFor={`${id}-end`} className="mb-1.5 block text-xs font-semibold">접수 마감일</label>
        <input id={`${id}-end`} required type="date" value={value.attendanceDeadline || ''}
          min={value.attendanceStartDate || undefined} onChange={e => onChange({ attendanceDeadline: e.target.value })}
          className="min-h-11 w-full min-w-0 rounded-xl border border-primary-200 bg-white px-3 py-3 text-sm" />
      </div>
    </div>
    <p className="text-xs leading-relaxed text-gray-500">한국 시간 기준 시작일 00:00부터 마감일 23:59까지 접수합니다. 접수 전·종료 후에는 기존 기록만 볼 수 있어요.</p>
  </fieldset>
}
