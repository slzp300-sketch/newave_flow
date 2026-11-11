import { CalendarDays, CheckCircle2, CircleMinus, PenLine } from 'lucide-react'
import Card from './Card'
import Button from './Button'
import { formatUpdatedAt } from '../../utils/date'

export default function VoteReceipt({ title, result, dateLabel, absent, details = [], updatedAt, onEdit, saving = false }) {
  const ResultIcon = absent ? CircleMinus : CheckCircle2
  return (
    <section aria-label={`${title} 내 투표`}>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-gray-900">내 투표</h2>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-800">
            <CheckCircle2 size={16} aria-hidden="true" /> 투표 완료
          </span>
        </div>
        <div role="status" aria-atomic="true" className={`rounded-2xl border px-4 py-4 ${absent ? 'border-red-200 bg-red-50 text-red-800' : 'border-secondary-200 bg-secondary-50 text-secondary-800'}`}>
          <div className="flex items-center gap-2.5">
            <ResultIcon size={28} className="shrink-0" aria-hidden="true" />
            <p className="min-w-0 text-2xl font-bold leading-snug [overflow-wrap:anywhere]">{result}</p>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-sm font-medium leading-relaxed">
            <CalendarDays size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{dateLabel}</span>
          </p>
        </div>
        {details.length > 0 && (
          <dl className="flex flex-col gap-3 rounded-xl bg-white px-3 py-3">
            {details.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-medium text-gray-600">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-gray-900 [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {updatedAt && <p className="text-xs text-gray-600">마지막 저장 {formatUpdatedAt(updatedAt)}</p>}
        <Button variant="secondary" onClick={onEdit} disabled={saving} className="w-full">
          <PenLine size={16} aria-hidden="true" /> 투표 수정
        </Button>
      </Card>
    </section>
  )
}
