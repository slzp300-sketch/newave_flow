import './QuarterAssessment.css'
import Card from '../common/Card'
import { quarterAverageText, quarterStatusLabel } from '../../utils/ttsQuarterAssessment'
import { quartersForYear, ttsToday } from '../../utils/ttsPeriod'

export function QuarterCriteria({ assessment, year, quarter }) {
  const { average, count, passed, below, unrecorded } = assessment
  const period = quartersForYear(year).find(p => p.q === quarter)
  const ongoing = period && period.start <= ttsToday() && ttsToday() <= period.end
  return <Card className="p-4 flex flex-col gap-2" aria-label="분기 통과 기준">
    <p className="text-base font-bold text-gray-900">분기 평균 {quarterAverageText(average)}점</p>
    {count ? <>
      <p className="text-sm text-gray-700 leading-relaxed">평균 이상 통과 · 평균 미만 미달<br />정수 점수 기준 {Math.ceil(average)}점부터 통과</p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold">
        <span className="text-secondary-800">통과 {passed}명</span><span className="text-red-700">미달 {below}명</span>
        {unrecorded > 0 && <span className="text-gray-600">기록 없음 {unrecorded}명</span>}
      </p>
    </> : <p className="text-sm text-gray-600">분기 기록이 없어 아직 판정하지 않습니다.</p>}
    <p className="text-sm text-gray-600 leading-relaxed">기록이 있는 {count}명의 분기 총점 기준입니다. 기록 없음은 평균에서 제외합니다.{ongoing && ' 진행 중인 분기로, 기록이 바뀌면 평균과 판정도 달라집니다.'}</p>
  </Card>
}

export function QuarterStatus({ score, assessment }) {
  const status = assessment.status(score)
  return <span className={`inline-flex max-w-full rounded-lg px-2 py-1 text-sm font-semibold leading-relaxed [word-break:keep-all] ${status === 'below' ? 'bg-red-50 text-red-700' : status === 'passed' ? 'bg-secondary-50 text-secondary-800' : 'bg-gray-100 text-gray-600'}`}>{quarterStatusLabel(status)}</span>
}
