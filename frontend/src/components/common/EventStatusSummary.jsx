import Card from './Card'
import { eventAttendanceCounts } from '../../utils/eventAttendanceSummary'

export default function EventStatusSummary({ records, total }) {
  const counts = eventAttendanceCounts(records, total)
  return <section aria-label="행사 출석 요약" className="flex flex-col gap-2">
    <p className="px-1 text-xs font-semibold text-gray-500">전체 {counts.total}명 · 상태별 인원</p>
    <div className="grid grid-cols-4 gap-2">
      {[
        ['참석', counts.present, 'text-emerald-500'],
        ['부분참석', counts.partial, 'text-amber-500'],
        ['불참', counts.absent, 'text-red-400'],
        ['미제출', counts.unsubmitted, 'text-gray-500'],
      ].map(([label, count, color]) => <Card key={label} className="px-1 py-3 text-center">
        <p className={`text-xl font-bold ${color}`}>{count}</p>
        <p className="mt-1 text-xs font-semibold text-gray-500">{label}</p>
      </Card>)}
    </div>
  </section>
}
