import AppSelect from '../common/AppSelect'
import { useMemo, useState } from 'react'
import './TtsStats.css'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { ttsApi } from '../../api/tts'
import useAuthStore from '../../store/authStore'
import SearchField from '../common/SearchField'
import Card from '../common/Card'
import StatsNotice, { useAdminStatsReadState as useStatsReadState } from './AdminStatsNotice'
import { ttsAdminRefreshOptions as statsRefreshOptions } from '../../utils/ttsAdminRefresh'
import { useTtsRankingField } from '../../store/ttsRankingViewStore'
import { ttsYears, ttsToday, quartersForYear, quarterDateLabel, quarterPeople } from '../../utils/ttsPeriod'
import { rankedPeople, filterPeople } from '../../utils/ttsStats'
import { assessQuarter, filterQuarterStatus, quarterScore as totalScore, quarterAverageText } from '../../utils/ttsQuarterAssessment'
import './QuarterAssessment.css'
import TtsRankingHistory from './TtsRankingHistory'
import TtsRankingList, { RankingStatus } from './TtsRankingList'

export default function TtsStats() {
  const { user, apiEnvironment } = useAuthStore()
  const scope = `${apiEnvironment}:${user?.id ?? 'signed-out'}:${user?.role ?? ''}`
  const [year, setYear] = useTtsRankingField('year')
  const [quarter, setQuarter] = useTtsRankingField('quarter')
  const [search, setSearch] = useTtsRankingField('search')
  const [statusFilter, setStatusFilter] = useTtsRankingField('statusFilter')
  const [selected, setSelected] = useState(null)
  const stats = useQuery({ queryKey: ['tts-stats', year, scope], ...statsRefreshOptions,
    enabled: !!user, queryFn: ({ signal }) => ttsApi.getStats(year, { signal }).then(r => r.data) })
  const readState = useStatsReadState(stats)
  const people = useMemo(() => quarterPeople(stats.data?.people || [], year, quarter), [stats.data, year, quarter])
  const assessment = useMemo(() => assessQuarter(people), [people])
  // Rank/assess the full quarter before filtering; the pinned row uses this same full result.
  const ranked = useMemo(() => rankedPeople(people, totalScore), [people])
  const filtered = filterQuarterStatus(filterPeople(ranked, { search }), assessment, statusFilter)
  const mine = ranked.find(person => person.teacherId != null && person.teacherId === user?.id)
  const range = quartersForYear(year).find(period => period.q === quarter)
  const futureQuarter = range?.start > ttsToday()
  const calendarDataMissing = people.some(person => !person.calendarDataReady)
  const ready = readState === 'ready' && !futureQuarter && !calendarDataMissing
  const statusOptions = [
    { value: 'all', label: '전체', count: people.length },
    { value: 'passed', label: '통과', count: assessment.passed },
    { value: 'below', label: '미달', count: assessment.below },
    { value: 'unrecorded', label: '기록 없음', count: assessment.unrecorded },
  ]
  const open = person => setSelected({ key: person.key, scope, year, quarter })
  // No previous account/quarter details may survive even the render before effects run.
  const activePerson = selected?.scope === scope && selected.year === year && selected.quarter === quarter
    ? ranked.find(person => person.key === selected.key) : null
  return <div className="tts-ranking-page">
    <section className="tts-ranking-my-sticky" aria-label="내 순위 고정 영역">
      {ready && mine ? <button type="button" className="tts-ranking-my-card" onClick={() => open(mine)} aria-label="내 체크 기록 보기">
        <span className="tts-ranking-my-rank">{mine.rank == null ? '—' : `${mine.rank}위`}</span>
        <span className="tts-ranking-my-person"><span className="tts-ranking-name">{mine.name}<span className="tts-ranking-me">나</span></span><span className="tts-ranking-my-hint">내 순위 · 항상 상단 고정</span></span>
        <span className="tts-ranking-my-end"><span className="tts-ranking-score">{totalScore(mine) == null ? '—' : `${totalScore(mine)}점`}</span><RankingStatus person={mine} assessment={assessment} /></span>
        <ChevronRight size={15} aria-hidden="true" />
      </button> : <div className="tts-ranking-my-placeholder" role="status">{!ready ? '내 순위는 조회 완료 후 표시됩니다.' : '이 분기에 연결된 내 순위가 없습니다.'}</div>}
    </section>
    <div className="tts-ranking-content">
      <div className="tts-ranking-period">
        <AppSelect aria-label="통계 분기 선택" value={`${year}-${quarter}`} onChange={event => {
          const [nextYear, nextQuarter] = event.target.value.split('-').map(Number)
          setYear(nextYear); setQuarter(nextQuarter); setSelected(null)
        }}>{ttsYears().flatMap(value => quartersForYear(value).map(period => <option key={`${value}-${period.q}`} value={`${value}-${period.q}`}>{value}년 {period.q}분기</option>))}</AppSelect>
        <button type="button" onClick={() => stats.refetch()} disabled={stats.isFetching || readState === 'offline'} aria-label="분기 순위 새로고침" className="tts-ranking-refresh">
          <RefreshCw size={18} className={stats.isFetching ? 'refresh-spinner' : ''} />
        </button>
      </div>
      <p className="tts-ranking-range">{quarterDateLabel(year, quarter)}</p>
      <section className="tts-ranking-summary" aria-label="분기 통과 기준">
        <div><strong>전체 평균</strong><b>{ready ? quarterAverageText(assessment.average) : '—'}점</b><span>{ready ? `기록 ${assessment.count}명` : '조회 완료 후 표시'}</span></div>

      </section>
      <SearchField label="교사 이름 검색" placeholder="이름으로 검색" value={search} onChange={setSearch} />
      <div role="group" aria-label="분기 판정 필터" className="tts-ranking-filters">
        {statusOptions.map(option => <button key={option.value} type="button" aria-pressed={statusFilter === option.value} onClick={() => setStatusFilter(option.value)}>
          <span>{option.label}</span><span>{ready ? option.count : '—'}</span>
        </button>)}
      </div>
      {(readState !== 'ready' || search.trim() || statusFilter !== 'all') && <p aria-label="현재 조회 조건" className="tts-ranking-conditions">선택: {statusOptions.find(option => option.value === statusFilter)?.label} · 검색: {search.trim() || '전체 이름'}</p>}
      {readState !== 'ready' ? <StatsNotice query={stats} state={readState} label="TTS 분기 순위" />
        : futureQuarter ? <Empty>아직 시작하지 않은 분기입니다.</Empty>
        : calendarDataMissing ? <Card className="p-4 text-center text-gray-600"><p role="status">통계 정보를 새로 불러와 주세요.</p><button type="button" onClick={() => stats.refetch()} className="min-h-11 px-4 mt-2">다시 불러오기</button></Card>
        : <>
          <div className="tts-ranking-list-caption"><p role="status">{filtered.length}명 표시 / 전체 {people.length}명</p></div>
          <TtsRankingList people={filtered} assessment={assessment} onSelect={open} mineKey={mine?.key}>
            {!filtered.length && <Empty>{!people.length ? '아직 분기 기록이 없습니다.' : search.trim() ? '선택한 조건에 맞는 이름이 없습니다.' : '선택한 상태의 교사가 없습니다.'}
              {people.length > 0 && <button type="button" onClick={() => { setSearch(''); setStatusFilter('all') }} className="mt-3 block mx-auto min-h-11 rounded-xl border px-4 py-2 font-semibold">전체 보기</button>}</Empty>}
          </TtsRankingList>

        </>}
    </div>
    {activePerson && <TtsRankingHistory key={`${scope}:${year}:${quarter}:${activePerson.key}`} person={activePerson} year={year} quarter={quarter} scope={scope} onClose={() => setSelected(null)} />}
  </div>
}

function Empty({ children }) { return <div className="tts-ranking-empty">{children}</div> }
