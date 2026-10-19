import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { ttsApi } from '../../api/tts'
import useAuthStore from '../../store/authStore'
import SearchField from '../common/SearchField'
import Card from '../common/Card'
import QueryNotice from '../common/QueryNotice'
import ViewModeToggle, { useViewMode } from '../common/ViewModeToggle'
import RecordViews from '../common/RecordViews'
import { ttsReadState } from '../../utils/ttsQuery'
import { ttsYear, ttsYears, ttsToday, defaultQuarter, quartersForYear, quarterDateLabel, quarterPeople } from '../../utils/ttsPeriod'
import { rankedPeople, filterPeople } from '../../utils/ttsStats'

const totalScore = person => Object.keys(person.weekly).length ? person.total : null
const scoreText = value => value == null ? '기록 없음' : `${value}점`

export default function TtsStats() {
  const { user } = useAuthStore()
  const [year, setYear] = useState(ttsYear)
  const [quarter, setQuarter] = useState(() => defaultQuarter(ttsYear()))
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('tts-quarter-ranking', 'list')
  const stats = useQuery({ queryKey: ['tts-stats', year], queryFn: () => ttsApi.getStats(year).then(r => r.data) })
  const people = useMemo(() => quarterPeople(stats.data?.people || [], year, quarter), [stats.data, year, quarter])
  // Rank the entire quarter before searching, so finding a name preserves its rank.
  const filtered = filterPeople(rankedPeople(people, totalScore), { search })
  const calendarDataMissing = people.some(person => !person.calendarDataReady)
  const range = quartersForYear(year).find(period => period.q === quarter)
  const futureQuarter = range?.start > ttsToday()

  return <div className="px-4 py-4 flex flex-col gap-4">
    <div className="flex items-center gap-2">
      <select aria-label="통계 연도" value={year} onChange={event => {
        const next = Number(event.target.value)
        setYear(next); setQuarter(defaultQuarter(next)); setSearch('')
      }} className="rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm font-semibold">
        {ttsYears().map(value => <option key={value} value={value}>{value}년</option>)}
      </select>
      <div className="flex flex-1 gap-1">{quartersForYear(year).map(period => <button key={period.q}
        aria-pressed={quarter === period.q} onClick={() => { setQuarter(period.q); setSearch('') }}
        className={`flex-1 min-h-11 rounded-xl text-sm font-medium ${quarter === period.q ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{period.q}분기</button>)}</div>
    </div>
    <p className="text-xs text-gray-500">{quarterDateLabel(year, quarter)}</p>
    {!ttsReadState([stats]).hasData ? <QueryNotice queries={[stats]} label="TTS 분기 기록" /> : <>
      {stats.isError && <QueryNotice queries={[stats]} label="최신 TTS 분기 기록" />}
      {futureQuarter ? <Empty>아직 시작하지 않은 분기입니다.</Empty> : calendarDataMissing ? <Card className="p-5 text-center text-sm text-gray-600">
        <p role="status">통계 정보를 새로 불러와 주세요.</p>
        <button onClick={() => stats.refetch()} disabled={stats.isFetching} className="mt-3 font-semibold text-primary-700 disabled:opacity-50">{stats.isFetching ? '불러오는 중…' : '다시 불러오기'}</button>
      </Card> : <>
        <SearchField label="교사 이름 검색" placeholder="이름으로 찾기" value={search} onChange={setSearch} />
        <div className="flex items-center justify-between gap-2">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} label="분기 순위 보기 형식" />
          <button onClick={() => stats.refetch()} disabled={stats.isFetching} aria-label="분기 순위 새로고침" className="min-h-11 min-w-11 flex items-center justify-center text-primary-700 disabled:opacity-40">
            <RefreshCw size={18} className={stats.isFetching ? 'refresh-spinner' : ''} />
          </button>
        </div>
        <RecordViews mode={viewMode} rows={filtered} rowKey={person => person.key}
          rowClassName={person => person.teacherId === user?.id ? 'border-primary-200 bg-primary-50/40' : ''}
          columns={[
            { label: '이름', render: person => `${person.name}${person.teacherId === user?.id ? ' · 나' : ''}` },
            { label: '순위', render: person => person.rank == null ? '—' : `${person.rank}위` },
            { label: '점수', render: person => scoreText(totalScore(person)) },
          ]}>
          <div className="flex flex-col gap-2">{filtered.map(person => <article key={person.key}
            className={`brand-card flex items-center gap-3 rounded-2xl border p-4 ${person.teacherId === user?.id ? 'border-primary-200 bg-primary-50/40' : 'border-gray-200 bg-white'}`}>
            <span className="text-sm font-semibold text-gray-500 tabular-nums">{person.rank == null ? '—' : `${person.rank}위`}</span>
            <p className="min-w-0 flex-1 break-words text-sm font-semibold">{person.name}{person.teacherId === user?.id && <span className="ml-1.5 text-xs text-primary-600">나</span>}</p>
            <span className="shrink-0 text-sm font-semibold text-primary-700 tabular-nums">{scoreText(totalScore(person))}</span>
          </article>)}</div>
        </RecordViews>
        {!filtered.length && <Empty>{search.trim() ? '검색한 이름이 없습니다.' : '아직 분기 기록이 없습니다.'}</Empty>}
      </>}
    </>}
  </div>
}

function Empty({ children }) {
  return <Card className="py-10 text-center text-sm text-gray-500">{children}</Card>
}
