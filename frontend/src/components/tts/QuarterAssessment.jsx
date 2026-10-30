import './QuarterAssessment.css'
import { quarterAverageText, quarterStatusLabel } from '../../utils/ttsQuarterAssessment'
import { quartersForYear, ttsToday } from '../../utils/ttsPeriod'

export function QuarterCriteria({ assessment, year, quarter }) {
  const { average, count, passed, below, unrecorded } = assessment
  const period = quartersForYear(year).find(p => p.q === quarter)
  const ongoing = period && period.start <= ttsToday() && ttsToday() <= period.end
  return <section className="ui-stat-panel" aria-label="분기 통과 기준">
    <div className="ui-stat-heading"><h3>분기 평균</h3><strong className="ui-stat-value">{quarterAverageText(average)}점</strong>{ongoing && <span className="ui-stat-note">진행 중</span>}</div>
    {count ? <>
      <p className="ui-stat-note">통과 {Math.ceil(average)}점부터</p>
      <dl className="ui-metrics grid-cols-3 mt-1">
        <div><dt>통과</dt><dd className="text-secondary-700">{passed}<small>명</small></dd></div>
        <div><dt>미달</dt><dd className="text-red-700">{below}<small>명</small></dd></div>
        <div><dt>기록 없음</dt><dd>{unrecorded}<small>명</small></dd></div>
      </dl>
    </> : <p className="ui-stat-note">기록 없음</p>}
  </section>
}

export function QuarterStatus({ score, assessment }) {
  const status = assessment.status(score)
  return <span className={`inline-flex max-w-full rounded-lg px-2 py-1 text-sm font-semibold leading-relaxed [word-break:keep-all] ${status === 'below' ? 'bg-red-50 text-red-700' : status === 'passed' ? 'bg-secondary-50 text-secondary-800' : 'bg-gray-100 text-gray-600'}`}>{quarterStatusLabel(status)}</span>
}
