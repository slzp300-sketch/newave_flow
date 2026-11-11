import { queryFeedback } from '../../utils/requestFeedback'
import Button from './Button'

export default function QueryNotice({ queries, label = '기록' }) {
  const feedback = queryFeedback(queries, label)
  if (!feedback) return null
  return (
    <div role={feedback.failed ? 'alert' : 'status'} className="brand-card rounded-2xl border border-gray-200 bg-white p-3 text-center">
      <p className="text-sm font-semibold text-gray-700">
        {feedback.title}
      </p>
      {feedback.detail && <p className="mt-1 text-xs leading-relaxed text-gray-600">{feedback.detail}</p>}
      {feedback.failed && <Button type="button" size="sm" variant="secondary" className="mt-2" disabled={feedback.retrying}
        onClick={() => { void Promise.allSettled(queries.map(q => q.refetch())) }}>
        {feedback.retrying ? '다시 불러오는 중…' : '다시 불러오기'}
      </Button>}
    </div>
  )
}
