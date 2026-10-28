import { useMemo } from 'react'
import './TtsStats.css'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { ttsApi } from '../../api/tts'
import useAuthStore from '../../store/authStore'
import SearchField from '../common/SearchField'
import Card from '../common/Card'
import StatsNotice, { useAdminStatsReadState as useStatsReadState } from './AdminStatsNotice'
import { ttsAdminRefreshOptions as statsRefreshOptions } from '../../utils/ttsAdminRefresh'
import { useTtsRankingField } from '../../store/ttsRankingViewStore'
import ViewModeToggle, { useViewMode } from '../common/ViewModeToggle'
import RecordViews from '../common/RecordViews'
import { ttsYears, ttsToday, defaultQuarter, quartersForYear, quarterDateLabel, quarterPeople } from '../../utils/ttsPeriod'
import { rankedPeople, filterPeople } from '../../utils/ttsStats'

import { assessQuarter, filterQuarterStatus, quarterScore as totalScore } from '../../utils/ttsQuarterAssessment'
import { QuarterCriteria, QuarterStatus } from './QuarterAssessment'
const scoreText = value => value == null ? '기록 없음' : `${value}점`

export default function TtsStats() {
  const { user } = useAuthStore()
  const [year, setYear] = useTtsRankingField('year')
  const [quarter, setQuarter] = useTtsRankingField('quarter')
  const [search, setSearch] = useTtsRankingField('search')
  const [statusFilter, setStatusFilter] = useTtsRankingField('statusFilter')
  const [viewMode, setViewMode] = useViewMode('tts-quarter-ranking', 'list')
  const stats = useQuery({ queryKey: ['tts-stats', year], ...statsRefreshOptions, queryFn: () => ttsApi.getStats(year).then(r => r.data) })
  const readState = useStatsReadState(stats)
  const people = useMemo(() => quarterPeople(stats.data?.people || [], year, quarter), [stats.data, year, quarter])
  const assessment = useMemo(() => assessQuarter(people), [people])
  // Assess and rank the whole quarter before applying either display filter.
  const filtered = filterQuarterStatus(filterPeople(rankedPeople(people, totalScore), { search }), assessment, statusFilter)
  const statusOptions = [
    {value: 'all', label: '전체', count: people.length},
    {value: 'passed', label: '통과', count: assessment.passed},
    {value: 'below', label: '미달', count: assessment.below},
    {value: 'unrecorded', label: '기록 없음', count: assessment.unrecorded},
  ]
  const calendarDataMissing = people.some(person => !person.calendarDataReady)
  const range = quartersForYear(year).find(period => period.q === quarter)
  const futureQuarter = range?.start > ttsToday()

  return <div className="px-4 py-4 flex flex-col gap-4">
    <div className="flex flex-col gap-3">
      <select aria-label="통계 연도" value={year} onChange={event => {
        const next = Number(event.target.value)
        setYear(next); setQuarter(defaultQuarter(next)); setSearch(''); setStatusFilter('all')
      }} className="rounded-xl bg-white border border-gray-200 min-h-12 w-fit max-w-full px-4 py-3 text-base font-semibold text-gray-900">
        {ttsYears().map(value => <option key={value} value={value}>{value}년</option>)}
      </select>
      <div role="group" aria-label="통계 분기" className="flex gap-2">{quartersForYear(year).map(period => <button key={period.q}
        aria-pressed={quarter === period.q} onClick={() => { setQuarter(period.q); setSearch(''); setStatusFilter('all') }}
        className={`flex-1 min-w-0 min-h-12 rounded-xl text-base font-semibold ${quarter === period.q ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{period.q}분기</button>)}</div>
    </div>
    <p className="text-sm text-gray-600 leading-relaxed">{quarterDateLabel(year, quarter)}</p>
    <SearchField label="교사 이름 검색" placeholder="이름으로 찾기" value={search} onChange={setSearch} />
    <div className="flex items-center justify-between gap-2">
      <ViewModeToggle mode={viewMode} onChange={setViewMode} label="분기 순위 보기 형식" />
      <button onClick={() => stats.refetch()} disabled={stats.isFetching || readState === 'offline'} aria-label="분기 순위 새로고침" className="min-h-11 min-w-11 flex items-center justify-center text-primary-700 disabled:opacity-40">
        <RefreshCw size={18} className={stats.isFetching ? 'refresh-spinner' : ''} />
      </button>
    </div>
    {readState === 'ready' && !futureQuarter && !calendarDataMissing && <QuarterCriteria assessment={assessment} year={year} quarter={quarter} />}
    <div role="group" aria-label="분기 판정 필터" className="grid grid-cols-2 gap-2">
      {statusOptions.map(option => <button key={option.value} type="button" aria-pressed={statusFilter === option.value}
        onClick={() => setStatusFilter(option.value)}
        className="min-h-12 min-w-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-base font-semibold leading-relaxed [word-break:keep-all]">
        <span>{option.label}</span><span className="tabular-nums">{readState === 'ready' && !futureQuarter && !calendarDataMissing ? option.count + '명' : '—'}</span>
      </button>)}
    </div>
    <p aria-label="현재 조회 조건" className="text-sm leading-relaxed text-gray-700 break-words">선택: {statusOptions.find(option => option.value === statusFilter).label} · 검색: {search.trim() || '전체 이름'}{readState !== 'ready' && ' · 인원은 조회 완료 후 표시'}</p>
    {readState !== 'ready' ? <StatsNotice query={stats} state={readState} label="TTS 분기 순위" />
      : futureQuarter ? <Empty>아직 시작하지 않은 분기입니다.</Empty> : calendarDataMissing ? <Card className="p-5 text-center text-base text-gray-600">
        <p role="status">통계 정보를 새로 불러와 주세요.</p>
        <button onClick={() => stats.refetch()} disabled={stats.isFetching} className="mt-3 min-h-12 px-3 text-base font-semibold text-primary-700 disabled:opacity-50">{stats.isFetching ? '불러오는 중…' : '다시 불러오기'}</button>
      </Card> : <>
        <p className="text-sm text-gray-600 leading-relaxed" role="status">{statusOptions.find(option => option.value === statusFilter).label} · {filtered.length}명 표시 / 전체 {people.length}명 — 평균과 순위는 전체 기준</p>
        <div className="tts-ranking-records"><RecordViews mode={viewMode} rows={filtered} rowKey={person => person.key}
          rowClassName={person => `tts-quarter-${assessment.status(totalScore(person))}`}
          columns={[
            { label: '이름', render: person => <PersonName person={person} isMe={person.teacherId === user?.id} /> },
            { label: '순위', render: person => <span className="text-base font-semibold tabular-nums">{person.rank == null ? '—' : `${person.rank}위`}</span> },
            { label: '점수', render: person => <Score person={person} assessment={assessment} /> },
          ]}>
          <div className="flex flex-col gap-2">{filtered.map(person => <article key={person.key}
            className={`brand-card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border p-4 tts-quarter-${assessment.status(totalScore(person))}`}>
            <span className="text-base font-semibold text-gray-600 tabular-nums">{person.rank == null ? '—' : `${person.rank}위`}</span>
            <PersonName person={person} isMe={person.teacherId === user?.id} />
            <div className="col-start-2"><Score person={person} assessment={assessment} /></div>
          </article>)}</div>
        </RecordViews></div>
        {!filtered.length && <Empty>{!people.length ? '아직 분기 기록이 없습니다.' : search.trim() ? '선택한 조건에 맞는 이름이 없습니다.' : '선택한 상태의 교사가 없습니다.'}{people.length > 0 && <button type="button" onClick={() => { setSearch(''); setStatusFilter('all') }} className="mt-3 block mx-auto min-h-11 rounded-xl border px-4 py-2 font-semibold">전체 보기</button>}</Empty>}
    </>}
  </div>
}

function Empty({ children }) {
  return <Card className="py-10 text-center text-base text-gray-600">{children}</Card>
}

function PersonName({ person, isMe }) {
  return <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0 text-base font-bold text-gray-900 leading-relaxed [overflow-wrap:anywhere]">
    <span className="min-w-0">{person.name}</span>
    {isMe && <span className="rounded-md bg-primary-50 px-2 py-0.5 text-sm font-semibold text-primary-700">나</span>}
  </span>
}

function Score({ person, assessment }) {
  const score = totalScore(person)
  return <span className="inline-flex flex-wrap items-center gap-2 min-w-0">
    {score != null && <span className="text-lg font-bold text-primary-800 tabular-nums leading-relaxed">{scoreText(score)}</span>}
    <QuarterStatus score={score} assessment={assessment} />
  </span>
}
