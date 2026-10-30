import AppSelect from '../components/common/AppSelect'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import WeekNavigator from '../components/common/WeekNavigator'
import GradeAttendanceList, { compareAttendanceGrades } from '../components/common/GradeAttendanceList'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import DisclosureSummary from '../components/common/DisclosureSummary'
import { FilterResults } from '../components/common/AdminTools'
import AdminReadGuard from '../components/common/AdminReadGuard'
import { matchesAdminSearch } from '../utils/adminSearch'
import { getWeekStartByOffset, formatUpdatedAt, toApiDate, weekLabels } from '../utils/date'
import { PRAYER_STATUSES, prayerTotals, prayerTrendTotals, matchesPrayerStatus, prayerWeekOffset } from '../utils/prayerParticipation'
import { prayerVoteApi } from '../api/prayerVote'
import useAuthStore from '../store/authStore'
import './PrayerAbsentAdminPage.css'

const filters = [
  { value: 'ALL', label: '전체' }, { value: 'ATTEND', label: '참석' },
  { value: 'ABSENT', label: '불참' }, { value: 'UNKNOWN', label: '미응답' },
]
const rateLabel = rate => rate == null ? '—' : `${rate}%`
const shortDate = value => format(new Date(value + 'T00:00:00'), 'M/d')

export default function PrayerAbsentAdminPage() {
  const userId = useAuthStore(state => state.user?.id)
  const environment = useAuthStore(state => state.apiEnvironment)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [grade, setGrade] = useState('전체')
  const [status, setStatus] = useState('ALL')
  const monday = getWeekStartByOffset(offset, 1)
  const week = toApiDate(monday)
  const currentWeek = toApiDate(getWeekStartByOffset(0, 1))
  const labels = weekLabels(monday)
  const query = useQuery({
    queryKey: ['prayer-participation', environment, userId, week],
    queryFn: async () => {
      const { data } = await prayerVoteApi.getParticipation(week)
      if (!data?.summary || !Array.isArray(data.people) || !Array.isArray(data.trend)) throw new Error('기도모임 집계 응답을 확인할 수 없습니다.')
      return data
    },
    enabled: !!userId, refetchOnWindowFocus: 'always', refetchInterval: 30000,
  })
  const data = query.data
  const totals = data && prayerTotals(data.summary)
  const grades = data ? [...new Set(data.people.map(person => person.teacherGrade || '미분류'))]
    .sort(compareAttendanceGrades) : []
  const people = data?.people.filter(person =>
    (grade === '전체' || (person.teacherGrade || '미분류') === grade)
    && matchesPrayerStatus(person.status, status)
    && matchesAdminSearch(search, person.teacherName, person.teacherGrade)) || []

  return <div className="admin-prayer-page">
    <Header title="기도모임 관리" showBack />
    <main className="prayer-admin-body">
      <WeekNavigator offset={offset} onChange={setOffset} title={`${labels.monthWeek} 기도모임`}
        range={`${format(addDays(monday, 1), 'M/d')}(화) · ${format(addDays(monday, 3), 'M/d')}(목)`} />
      <AdminReadGuard queries={[query]} label="기도모임 현황" reserveStatusSpace={false}>
        {data && <>
          <section className="prayer-panel prayer-summary" aria-label="전체 교사 투표 집계">
            <div className="prayer-admin-row">
              <div className="prayer-summary-heading"><h2 className="ui-section-title">주간 참석률</h2><strong>{rateLabel(totals.rate)}</strong></div>
              <Button variant="secondary" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}>새로고침</Button>
            </div>
            <dl className="prayer-counts">
              {[["화 참석", totals.tuesday], ["목 참석", totals.thursday], ["불참", totals.absent], ["미응답", totals.unanswered]].map(([label, count]) =>
                <div key={label}><dt>{label}</dt><dd>{count}<small>명</small></dd></div>)}
            </dl>
          </section>
          <details className="prayer-panel prayer-trend">
            <DisclosureSummary>주간 참석률 추이 · 8주</DisclosureSummary>
            <p className="prayer-help">8주 합산 {rateLabel(prayerTrendTotals(data.trend).rate)}</p>
            <div className="prayer-trend-list" aria-label="주간 참석률 추이">
              {data.trend.map(item => {
                const row = prayerTotals(item)
                return <button key={item.weekStart} type="button" className="prayer-trend-row" aria-pressed={item.weekStart === week}
                  aria-label={`${shortDate(item.weekStart)} 주간 참석률 ${row.rate == null ? '응답 없음' : rateLabel(row.rate)}, 참석 ${row.attending}명, 응답 ${row.responded}명`}
                  onClick={() => setOffset(prayerWeekOffset(item.weekStart, currentWeek))}>
                  <span>{shortDate(item.weekStart)} 주</span><span className="prayer-trend-track" aria-hidden="true"><span style={{ width: `${row.rate || 0}%` }} /></span>
                  <strong>{rateLabel(row.rate)}</strong><small>{row.attending}/{row.responded}명</small>
                </button>
              })}
            </div>
          </details>
          <section className="prayer-admin-roster" aria-label="기도모임 명단">
            <h2 className="ui-section-title">교사 명단</h2>
            <SegmentedControl label="기도모임 응답 상태" value={status} onChange={setStatus} options={filters} />
            <div className="prayer-list-filters">
              <SearchField label="기도모임 교사 검색" value={search} onChange={setSearch} placeholder="이름·학년 검색" />
              <label className="prayer-grade-filter"><span className="sr-only">명단 학년</span><AppSelect aria-label="명단 학년" value={grade} onChange={e => setGrade(e.target.value)}>
                <option value="전체">전체 학년</option>{[...new Set([...grades, ...(grade !== '전체' ? [grade] : [])])].map(value => <option key={value} value={value}>{value}</option>)}
              </AppSelect></label>
            </div>
            <FilterResults count={people.length} total={data.people.length} filtered={!!search.trim() || grade !== '전체' || status !== 'ALL'}
              onReset={() => { setSearch(''); setGrade('전체'); setStatus('ALL') }} />
            {people.length ? <GradeAttendanceList key={week} rows={people} renderDetails={person => <>
              <div><dt>응답</dt><dd>{PRAYER_STATUSES[person.status] || '미응답'}</dd></div>
              {person.status === 'ABSENT' ? <div><dt>불참 사유</dt><dd>{person.reason || '미입력'}</dd></div>
                : person.reason && <div><dt>마이크 사유</dt><dd>{person.reason}</dd></div>}
              {person.updatedAt && <div><dt>수정 일시</dt><dd>{formatUpdatedAt(person.updatedAt)}</dd></div>}
            </>} /> : <p className="prayer-panel prayer-empty" role="status">{search.trim() || grade !== '전체' ? '검색 결과가 없습니다.' : status === 'ABSENT' ? '불참 응답이 없습니다.' : status === 'UNKNOWN' ? '미응답 교사가 없습니다.' : status === 'ATTEND' ? '참석 응답이 없습니다.' : '조회할 교사가 없습니다.'}</p>}
          </section>
        </>}
      </AdminReadGuard>
    </main>
  </div>
}
