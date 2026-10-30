import AppSelect from '../components/common/AppSelect'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ArrowUpDown, RefreshCw } from 'lucide-react'
import { ttsAdminRefreshOptions } from '../utils/ttsAdminRefresh'
import { useTtsAdminField } from '../store/ttsAdminViewStore'
import { rankedPeople, matchesTtsName } from '../utils/ttsStats'
import { assessQuarter, adminQuarterScore, filterQuarterStatus, quarterStatusLabel, quarterAverageText } from '../utils/ttsQuarterAssessment'
import TtsRankingList from '../components/tts/TtsRankingList'
import TtsRankingHistory from '../components/tts/TtsRankingHistory'
import TtsWeeklyAdmin from '../components/tts/TtsWeeklyAdmin'
import TtsQuestionsAdmin from '../components/tts/TtsQuestionsAdmin'
import { adminRankingPerson } from '../utils/ttsRankingDetails'
import useAuthStore from '../store/authStore'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import Header from '../components/layout/Header'
import { paginateAdminRows } from '../utils/adminSearch'
import { ttsApi } from '../api/tts'
import AdminStatsNotice, { useAdminStatsReadState } from '../components/tts/AdminStatsNotice'
import { ttsYears, quartersForYear, quarterDateLabel, ttsToday } from '../utils/ttsPeriod'
import './TtsAdminPage.css'

export default function TtsAdminPage() {
  const [activeTab, setActiveTab] = useTtsAdminField('activeTab')
  const [weekOffset, setWeekOffset] = useTtsAdminField('weekOffset')
  const [questionsVisited, setQuestionsVisited] = useState(activeTab === 'questions')
  const { user, apiEnvironment } = useAuthStore()
  const scope = `${apiEnvironment}:${user?.id}`
  return <div className="admin-tts-page">
    <Header title="TTS 관리" showBack />
    <div className="tts-admin-tabs"><SegmentedControl label="TTS 관리 화면" value={activeTab} onChange={value => { if (value === 'questions') setQuestionsVisited(true); setActiveTab(value) }} options={[{ value: 'summary', label: '주간 현황' }, { value: 'scores', label: '점수 현황' }, { value: 'questions', label: '항목 관리' }]} /></div>
    {activeTab === 'summary' && <TtsWeeklyAdmin key={scope} offset={weekOffset} onOffsetChange={setWeekOffset} />}
    {activeTab === 'scores' && <ScoresTab />}
    {(questionsVisited || activeTab === 'questions') && <div hidden={activeTab !== 'questions'}><TtsQuestionsAdmin key={scope} active={activeTab === 'questions'} /></div>}
  </div>
}

const PAGE_SIZE = 10

function ScoresTab() {
  const { user, apiEnvironment } = useAuthStore()
  const canRead = ['ADMIN', 'PASTOR', 'EXECUTIVE'].includes(user?.role)
  const scope = `${apiEnvironment}:${user?.id ?? 'signed-out'}:${user?.role ?? ''}`
  const [search, setSearch] = useTtsAdminField('search')
  const [year, setYear] = useTtsAdminField('year')
  const [quarter, setQuarter] = useTtsAdminField('quarter')
  const [statusFilter, setStatusFilter] = useTtsAdminField('statusFilter')
  const [sortAsc, setSortAsc] = useTtsAdminField('sortAsc')
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(0)
  const scoresQuery = useQuery({ queryKey: ['tts-quarterly-scores', year, quarter, scope],
    ...ttsAdminRefreshOptions, enabled: canRead,
    queryFn: ({ signal }) => ttsApi.getQuarterlyScores(year, quarter, { signal }).then(response => response.data),
  })
  const readState = useAdminStatsReadState(scoresQuery)
  const scores = scoresQuery.data || []
  const assessment = assessQuarter(scores, adminQuarterScore)
  const ranked = useMemo(() => rankedPeople((scoresQuery.data || []).map(adminRankingPerson), adminQuarterScore), [scoresQuery.data])
  const sorted = sortAsc ? [...ranked].sort((a, b) => {
    const left = adminQuarterScore(a), right = adminQuarterScore(b)
    return left == null ? (right == null ? 0 : 1) : right == null ? -1 : left - right
  }) : ranked
  const filtered = filterQuarterStatus(sorted.filter(person => matchesTtsName(search, person.name)), assessment, statusFilter, adminQuarterScore)
  const { currentPage, totalPages, items } = paginateAdminRows(filtered, page, PAGE_SIZE)
  const range = quartersForYear(year).find(period => period.q === quarter)
  const futureQuarter = range?.start > ttsToday()
  const ready = readState === 'ready' && !futureQuarter && canRead
  const options = [
    { value:'all', label:'전체', count:scores.length },
    { value:'passed', label:'통과', count:assessment.passed },
    { value:'below', label:'미달', count:assessment.below },
    { value:'unrecorded', label:'기록 없음', count:assessment.unrecorded },
  ]
  const activePerson = canRead && selected?.scope === scope && selected.year === year && selected.quarter === quarter
    ? ranked.find(person => person.key === selected.key) : null
  return <div className="tts-ranking-page tts-admin-compact-scores">
    <div className="tts-ranking-content">
      <div className="tts-ranking-period">
        <AppSelect aria-label="관리자 통계 분기 선택" value={`${year}-${quarter}`} onChange={event => {
          const [nextYear, nextQuarter] = event.target.value.split('-').map(Number)
          setYear(nextYear); setQuarter(nextQuarter); setPage(0); setSelected(null)
        }}>{ttsYears().flatMap(value => quartersForYear(value).map(period => <option key={`${value}-${period.q}`} value={`${value}-${period.q}`}>{value}년 {period.q}분기</option>))}</AppSelect>
        <button type="button" className="tts-ranking-refresh" aria-label="관리자 분기 통계 새로고침" onClick={() => scoresQuery.refetch()} disabled={!canRead || scoresQuery.isFetching || readState === 'offline'}><RefreshCw size={18} className={scoresQuery.isFetching ? 'refresh-spinner' : ''} /></button>
      </div>
      <p className="tts-ranking-range">{quarterDateLabel(year, quarter)}</p>
      <section className="tts-ranking-summary" aria-label="분기 통과 기준">
        <div><strong>전체 평균</strong><b>{ready ? quarterAverageText(assessment.average) : '—'}점</b><span>{ready ? `기록 ${assessment.count}명` : '조회 완료 후 표시'}</span></div>

      </section>
      <SearchField label="TTS 점수 교사 검색" placeholder="교사 이름 검색" value={search} onChange={value => { setSearch(value); setPage(0); setSelected(null) }} />
      <div role="group" aria-label="관리자 분기 판정 필터" className="tts-ranking-filters">
        {options.map(option => <button key={option.value} type="button" aria-pressed={statusFilter === option.value} onClick={() => { setStatusFilter(option.value); setPage(0); setSelected(null) }}><span>{option.label}</span><span>{ready ? option.count : '—'}</span></button>)}
      </div>
      {(readState !== 'ready' || search.trim() || statusFilter !== 'all') && <p className="tts-ranking-conditions" aria-label="현재 조회 조건">선택: {quarterStatusLabel(statusFilter) || '전체'} · 검색: {search.trim() || '전체 이름'}</p>}
      {!canRead ? <p role="alert" className="tts-ranking-empty">관리자 통계 조회 권한을 확인해 주세요.</p>
        : readState !== 'ready' ? <AdminStatsNotice query={scoresQuery} state={readState} label="분기 통계" />
        : futureQuarter ? <p className="tts-ranking-empty">아직 시작하지 않은 분기입니다.</p> : <>
          <div className="tts-ranking-list-caption"><p role="status">{filtered.length}명 표시 / 전체 {scores.length}명</p><button type="button" className="tts-ranking-sort" onClick={() => { setSortAsc(value => !value); setPage(0); setSelected(null) }}><ArrowUpDown size={15} />{sortAsc ? '점수 낮은순' : '점수 높은순'}</button></div>

          <div className="tts-admin-score-columns" aria-hidden="true"><span>순위</span><span>교사</span><span>점수 · 판정</span></div>
          <TtsRankingList people={items} assessment={assessment} scoreOf={adminQuarterScore} onSelect={person => setSelected({ key:person.key, scope, year, quarter })}>
            {!items.length && <div className="tts-ranking-empty"><p>{scores.length ? '선택한 조건에 맞는 교사가 없습니다.' : '이번 분기 기록이 없습니다.'}</p>{scores.length > 0 && <button type="button" className="mt-3 min-h-11 border rounded-xl px-4 py-2" onClick={() => { setSearch(''); setStatusFilter('all'); setPage(0) }}>전체 보기</button>}</div>}
          </TtsRankingList>
          {totalPages > 1 && <nav className="tts-ranking-pagination" aria-label="관리자 점수 목록 페이지">
            <button type="button" aria-label="이전 점수 목록" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setSelected(null) }}><ChevronLeft size={18} /></button>
            <div><p>{currentPage + 1} / {totalPages} 페이지</p><p>{currentPage * PAGE_SIZE + 1}~{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)}번 · 표시 {filtered.length}명</p></div>
            <button type="button" aria-label="다음 점수 목록" disabled={currentPage >= totalPages - 1} onClick={() => { setPage(currentPage + 1); setSelected(null) }}><ChevronRight size={18} /></button>
          </nav>}

        </>}
    </div>
    {activePerson && <TtsRankingHistory key={`${scope}:${year}:${quarter}:${activePerson.key}`} person={activePerson} year={year} quarter={quarter} scope={scope} onClose={() => setSelected(null)} />}
  </div>
}
