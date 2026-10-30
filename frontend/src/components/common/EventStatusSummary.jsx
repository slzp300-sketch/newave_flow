import StatSummary from './StatSummary'
import { eventAttendanceCounts } from '../../utils/eventAttendanceSummary'

export default function EventStatusSummary({ records, total }) {
  const counts = eventAttendanceCounts(records, total)
  return <section aria-label="행사 출석 요약" className="flex flex-col gap-2">
    <p className="px-1 text-xs font-semibold text-gray-500">전체 {counts.total}명</p>
    <StatSummary label="행사 출석 인원" items={[
        ['참석', counts.present, 'text-secondary-700'],
        ['부분참석', counts.partial, 'text-amber-500'],
        ['불참', counts.absent, 'text-red-400'],
        ['미제출', counts.unsubmitted, 'text-gray-500'],
      ].map(([label, value, color]) => ({ label, value, color }))} />
  </section>
}
