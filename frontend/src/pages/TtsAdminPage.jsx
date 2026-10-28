import { ttsAdminRefreshOptions } from '../utils/ttsAdminRefresh'
import { useTtsAdminField } from '../store/ttsAdminViewStore'
import { rankedPeople, matchesTtsName } from '../utils/ttsStats'
import { assessQuarter, adminQuarterScore, filterQuarterStatus, quarterStatusLabel } from '../utils/ttsQuarterAssessment'
import { QuarterCriteria, QuarterStatus } from '../components/tts/QuarterAssessment'
import FitLabel from '../components/common/FitLabel'
import AdminReadGuard from '../components/common/AdminReadGuard'
import './TtsAdminPage.css'
import { CollapsePanel } from '../components/common/Motion'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminEmpty } from '../components/common/AdminTools'
import { paginateAdminRows } from '../utils/adminSearch'
import LegacyImportCard from '../components/tts/LegacyImportCard'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Save, ChevronLeft, ChevronRight, CheckCircle2, MoveDown, Trophy, ChevronDown, ArrowUpDown } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import Button from '../components/common/Button'
import { ttsApi } from '../api/tts'
import WeekNavigator from '../components/common/WeekNavigator'
import { getWeekStartByOffset, formatUpdatedAt, weekLabels, weekLabelsByNum } from '../utils/date'
import { addDays, format, getWeek } from 'date-fns'
import AdminStatsNotice, { useAdminStatsReadState } from '../components/tts/AdminStatsNotice'
import { ttsYears, defaultQuarter, quartersForYear, quarterDateLabel, firstTtsOffset, weekReference } from '../utils/ttsPeriod'

export default function TtsAdminPage() {
  const [activeTab, setActiveTab] = useTtsAdminField('activeTab')
  const [weekOffset, setWeekOffset] = useTtsAdminField('weekOffset')

  return (
    <div className="admin-tts-page flex flex-col min-h-screen pb-24 bg-gray-50/30">
      <Header title="TTS 관리" showBack />

      <div className="flex flex-col gap-4 px-4 py-5">
        <h2 className="text-lg font-bold text-gray-900">참여 현황 · 점수 · 체크 항목</h2>
        <SegmentedControl label="TTS 관리 화면" value={activeTab} onChange={setActiveTab}
          options={[{ value: 'summary', label: '주간 현황' }, { value: 'scores', label: '점수 현황' }, { value: 'questions', label: '항목 관리' }]} />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'summary' ? (
          <SummaryTab key="summary" offset={weekOffset} onOffsetChange={setWeekOffset} />
        ) : activeTab === 'scores' ? (
          <ScoresTab key="scores" />
        ) : (
          <QuestionsTab key="questions" />
        )}
      </AnimatePresence>
    </div>
  )
}

const PAGE_SIZE = 10

function ScoresTab() {
  const [viewMode, setViewMode] = useViewMode('admin-tts-scores', 'large')
  const [search, setSearch] = useTtsAdminField('search')
  const [year, setYear] = useTtsAdminField('year')
  const [quarter, setQuarter] = useTtsAdminField('quarter')
  const [expanded, setExpanded] = useState(null)
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useTtsAdminField('statusFilter')
  const [sortAsc, setSortAsc] = useTtsAdminField('sortAsc') // false = 높은순(기본)

  const scoresQuery = useQuery({
    queryKey: ['tts-quarterly-scores', year, quarter],
    ...ttsAdminRefreshOptions,
    queryFn: () => ttsApi.getQuarterlyScores(year, quarter).then(r => r.data)
  })
  const scoresReadState = useAdminStatsReadState(scoresQuery)
  const scores = scoresQuery.data || []

  // Compute the quarter's mean and ranks before filtering or pagination.
  const assessment = assessQuarter(scores, adminQuarterScore)
  const ranked = rankedPeople(scores.map(t => ({ ...t, name: t.teacherName })), adminQuarterScore)
  const sortedAll = sortAsc ? [...ranked].sort((a, b) => {
    const left = adminQuarterScore(a), right = adminQuarterScore(b)
    return left == null ? (right == null ? 0 : 1) : right == null ? -1 : left - right
  }) : ranked
  const filteredScores = filterQuarterStatus(sortedAll.filter(t => matchesTtsName(search, t.teacherName)), assessment, statusFilter, adminQuarterScore)
  const statusOptions = [
    {value:'all',label:'전체',count:scores.length},
    {value:'passed',label:'통과',count:assessment.passed},
    {value:'below',label:'미달',count:assessment.below},
    {value:'unrecorded',label:'기록 없음',count:assessment.unrecorded},
  ]
  const { currentPage, totalPages, items: pageItems } = paginateAdminRows(filteredScores, page, PAGE_SIZE)

  const handleQuarterChange = (q) => { setQuarter(q); setExpanded(null); setPage(0); setStatusFilter('all'); setSearch('') }
  const handleSortToggle = () => { setSortAsc(v => !v); setExpanded(null); setPage(0) }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex flex-col gap-4">
      {/* 분기 선택 */}
      <select aria-label="점수 현황 연도" value={year}
        onChange={e => { const next = Number(e.target.value); setYear(next); handleQuarterChange(defaultQuarter(next)) }}
        className="self-start px-3 py-2 rounded-xl bg-white border border-gray-100 text-sm font-bold text-gray-700">
        {ttsYears().map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2">
        {quartersForYear(year).map(({ q }) => (
          <button aria-pressed={quarter === q}
            key={q}
            onClick={() => handleQuarterChange(q)}
            className={`tts-admin-action py-2.5 rounded-2xl text-base font-bold transition-all border ${
              quarter === q
                ? 'bg-primary-500 text-white border-primary-500 shadow-md'
                : 'bg-white text-gray-600 border-gray-100'
            }`}
          >
            <FitLabel>{q}분기</FitLabel>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 text-center">{quarterDateLabel(year, quarter)}</p>

      <SearchField label="TTS 점수 교사 검색" value={search} onChange={value => { setSearch(value); setPage(0); setExpanded(null) }} placeholder="교사 이름 검색" />
      <ViewModeToggle mode={viewMode} onChange={setViewMode} label="TTS 점수 보기 방식" />
      {scoresReadState === 'ready' && scores.length > 0 && <QuarterCriteria assessment={assessment} year={year} quarter={quarter} />}
      <div role="group" aria-label="관리자 분기 판정 필터" className="grid grid-cols-2 gap-2">
            {statusOptions.map(option => <button type="button" key={option.value} aria-pressed={statusFilter === option.value}
              onClick={() => { setStatusFilter(option.value); setPage(0); setExpanded(null) }}
              className="min-h-12 min-w-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-base font-semibold leading-relaxed [word-break:keep-all]">
              <span>{option.label}</span><span className="tabular-nums">{scoresReadState === 'ready' ? option.count + '명' : '—'}</span>
            </button>)}
          </div>
      <p aria-label="현재 조회 조건" className="text-sm leading-relaxed text-gray-700 break-words">선택: {statusFilter === 'all' ? '전체' : quarterStatusLabel(statusFilter)} · 검색: {search.trim() || '전체 이름'}{scoresReadState !== 'ready' && ' · 인원은 조회 완료 후 표시'}</p>
      {scoresReadState !== 'ready' ? (
        <AdminStatsNotice query={scoresQuery} state={scoresReadState} label="분기 통계" />
      ) : scores.length === 0 ? (
        <div className="py-16 text-center text-gray-600">
          <Trophy size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-xs font-bold text-gray-600">이번 분기 제출 기록이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          <p role="status" className="text-sm text-gray-600 leading-relaxed">{statusFilter === 'all' ? '전체' : quarterStatusLabel(statusFilter)} · {filteredScores.length}명 표시 / 전체 {scores.length}명 — 평균과 순위는 전체 기준</p>

          {/* 목록 헤더 */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <button
              onClick={handleSortToggle}
              className="tts-admin-action font-bold text-primary-800 bg-primary-50 rounded-xl"
            >
              <ArrowUpDown size={12} />
              <FitLabel>{sortAsc ? '점수 낮은순' : '점수 높은순'}</FitLabel>
            </button>
          </div>

          {!filteredScores.length && <div className="py-6 text-center">
            <p className="text-base text-gray-600">선택한 조건에 맞는 교사가 없습니다.</p>
            <button type="button" onClick={() => { setStatusFilter('all'); setSearch(''); setPage(0); setExpanded(null) }} className="mt-3 min-h-11 rounded-xl border px-4 py-2 font-semibold">전체 보기</button>
          </div>}
          {/* 목록 */}
          <div className="admin-tts-records tts-admin-quarter-records"><RecordViews rowClassName={t => `tts-quarter-${assessment.status(adminQuarterScore(t))}`} mode={viewMode} rows={pageItems} rowKey={t => t.key ?? `u${t.teacherId}`}
            onRowClick={t => { const key = t.key ?? `u${t.teacherId}`; setExpanded(expanded === key ? null : key) }} columns={[
              { label: '교사', render: t => <span>{t.rank == null ? '—' : `${t.rank}위`} · {t.teacherName}</span> },
              { label: '학년', render: t => t.grade },
              { label: '분기 합계', render: t => adminQuarterScore(t) == null ? '—' : `${t.totalScore}점` },
              { label: '판정', render: t => <QuarterStatus score={adminQuarterScore(t)} assessment={assessment} /> },
            ]}>
          <div className="flex flex-col gap-2">
            {pageItems.map(t => {
              const score = adminQuarterScore(t)
              const status = assessment.status(score)
              const isBelow = status === 'below'
              const rowKey = t.key ?? `u${t.teacherId}`
              const isExpanded = expanded === rowKey
              return (
                <div key={rowKey} className="flex flex-col gap-1.5">
                  <Card
                    onClick={() => setExpanded(isExpanded ? null : rowKey)}
                    className={`p-4 cursor-pointer active:scale-[0.99] transition-all border tts-quarter-${status}`}
                  >
                    <div className="flex min-w-0 items-start gap-3 mb-3">
                      <span className={`shrink-0 min-w-8 rounded-xl p-2 text-center text-sm font-bold ${isBelow ? 'bg-red-100 text-red-700' : status === 'passed' ? 'bg-secondary-50 text-secondary-800' : 'bg-gray-100 text-gray-600'}`}>{t.rank == null ? '—' : `${t.rank}위`}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-gray-900">{t.teacherName}</p>
                        <p className="mt-1 text-xs text-gray-600">{t.grade} · {t.weekCount}주 제출</p>
                      </div>
                      <motion.div animate={{rotate:isExpanded?180:0}} className="shrink-0 text-gray-600"><ChevronDown size={18}/></motion.div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <p className={`text-lg font-bold ${isBelow?'text-red-700':status === 'passed'?'text-secondary-800':'text-gray-600'}`}>{score == null ? '—' : `${score}점`}</p>
                      <QuarterStatus score={score} assessment={assessment} />
                    </div>

                  </Card>
                  <AnimatePresence>
                    {isExpanded && (
                      <CollapsePanel initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-1">
                        <WeeklyScoreDetail year={year} scores={t.weeklyScores} total={t.totalScore} />
                      </CollapsePanel>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
          </RecordViews></div>
          {viewMode !== 'large' && pageItems.filter(t => (t.key ?? `u${t.teacherId}`) === expanded).map(t => <section key={expanded} aria-label={`${t.teacherName} 주차별 점수`}>
            <h3 className="mb-2 text-sm font-semibold">{t.teacherName} · 주차별 점수</h3>
            <WeeklyScoreDetail year={year} scores={t.weeklyScores} total={t.totalScore} />
          </section>)}

          {/* 페이지 네비게이션 */}
          {totalPages > 1 && (
            <div className="brand-card flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
              <button
                aria-label="이전 점수 목록"
                onClick={() => { setPage(currentPage - 1); setExpanded(null) }}
                disabled={currentPage === 0}
                className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-gray-50 disabled:opacity-30 text-gray-600"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-700">{currentPage + 1} / {totalPages} 페이지</p>
                <p className="text-xs text-gray-600 font-bold">
                  {currentPage * PAGE_SIZE + 1}~{Math.min((currentPage + 1) * PAGE_SIZE, filteredScores.length)}번 · 표시 {filteredScores.length}명
                </p>
              </div>
              <button
                aria-label="다음 점수 목록"
                onClick={() => { setPage(currentPage + 1); setExpanded(null) }}
                disabled={currentPage >= totalPages - 1}
                className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-gray-50 disabled:opacity-30 text-gray-600"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function WeeklyScoreDetail({ year, scores = [], total }) {
  return (
    <Card className="p-4 flex flex-col gap-2 bg-gray-50/50">
      <p className="text-xs font-bold text-gray-600  mb-1">주차별 점수</p>
      {scores.length === 0 ? (
        <p className="text-xs text-gray-600 font-bold">기록 없음</p>
      ) : (
        scores.map(ws => (
          <div key={ws.weekNum} className="flex flex-wrap gap-2 justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
            <span className="text-sm font-bold text-gray-600">{weekLabelsByNum(weekReference(year, ws.weekNum).year, weekReference(year, ws.weekNum).weekNum).monthWeek}</span>
            <span className="font-bold text-gray-700 text-sm">{ws.score}점</span>
          </div>
        ))
      )}
      <div className="flex flex-wrap gap-2 justify-between items-center pt-2 mt-1 border-t border-gray-200">
        <span className="text-xs font-bold text-gray-500">누계 합계</span>
        <span className="font-bold text-gray-800">{total}점</span>
      </div>
    </Card>
  )
}

function SummaryTab({ offset, onOffsetChange }) {
  const [viewMode, setViewMode] = useViewMode('admin-tts-summary', 'large')
  const [search, setSearch] = useTtsAdminField('summarySearch')
  // 서버와 같은 주차 규칙: 일~토, 1월 1일이 든 주가 1주차 (연도는 그 주 토요일 기준)
  const sunday = getWeekStartByOffset(offset, 0)
  const year = addDays(sunday, 6).getFullYear()
  const week = { weekNum: getWeek(sunday, { weekStartsOn: 0 }), start: format(sunday, 'M/d'), end: format(addDays(sunday, 6), 'M/d') }
  const [expandedGrades, setExpandedGrades] = useState([])

  const summaryQuery = useQuery({
    queryKey: ['tts-admin-summary', year, week.weekNum],
    // 교사가 수정한 내용이 바로 보이도록 화면에 돌아올 때마다 다시 불러옴
    ...ttsAdminRefreshOptions,
    queryFn: () => ttsApi.getSummary(year, week.weekNum).then(r => r.data)
  })
  const summaryReadState = useAdminStatsReadState(summaryQuery)
  const summary = summaryQuery.data || []

  // 학년별로 그룹화
  const groupedData = summary.filter(t => matchesTtsName(search, t.teacherName)).reduce((acc, curr) => {
    const g = curr.grade || '기타'
    if (!acc[g]) acc[g] = []
    acc[g].push(curr)
    return acc
  }, {})

  const GRADE_ORDER = ['유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '교사', '미분류']
  const gradeNames = Object.keys(groupedData).sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a); const bi = GRADE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1; if (bi === -1) return -1
    return ai - bi
  })

  const toggleGrade = (g) => {
    setExpandedGrades(prev => 
      prev.includes(g) ? prev.filter(item => item !== g) : [...prev, g]
    )
  }

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-4 flex flex-col gap-5">
      {/* 주차 선택 */}
      <div className="min-w-0">
        <WeekNavigator
          offset={offset}
          onChange={onOffsetChange}
          minOffset={firstTtsOffset()}
          title={`${weekLabels(sunday).monthWeek} TTS`}
          sub={weekLabels(sunday).yearWeek}
          range={`${week.start} ~ ${week.end}`}
        /><p className="mt-2 text-xs text-gray-600">참여 기준: 주간 1점 이상</p>
      </div>

      <SearchField label="주간 TTS 교사 검색" value={search} onChange={setSearch} placeholder="교사 이름 검색" />
      <ViewModeToggle mode={viewMode} onChange={setViewMode} label="TTS 주간 현황 보기 방식" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-xs font-bold text-gray-600 ">{search.trim() ? '검색된 교사 참여 현황' : '학년별 참여 현황'}</p>
        <span className="text-xs font-bold text-gray-600">{summaryReadState === 'ready' ? '총 ' + gradeNames.length + '개 학년' : '조회 완료 후 인원 표시'}</span>
      </div>

      {summaryReadState !== 'ready' ? (
        <AdminStatsNotice query={summaryQuery} state={summaryReadState} label="TTS 참여 현황" />
      ) : (
        <div className="flex flex-col gap-3">
          {gradeNames.length === 0 ? (
            <div className="py-20 text-center text-gray-600">
               <p className="text-xs font-bold">{search.trim() ? '조건에 맞는 교사가 없습니다' : '등록된 교사 정보가 없습니다'}</p>
            </div>
          ) : (
            <div className="admin-tts-records"><RecordViews mode={viewMode} rows={gradeNames.flatMap(grade => groupedData[grade])} rowKey={t => t.key ?? `u${t.teacherId}`} columns={[
              { label: '교사', render: t => t.teacherName },
              { label: '학년', render: t => t.grade },
              { label: '참여', render: t => t.isSubmitted ? '참여' : '미참여' },
              { label: '주간 점수', render: t => `${t.score ?? 0}점` },
              { label: '기록 출처', render: t => t.scoreSource === 'SHEET' ? '시트 확정 점수' : '앱 기록' },
              { label: '마지막 수정', render: t => formatUpdatedAt(t.updatedAt) },
            ]}>
            {gradeNames.map(grade => {
              const teachers = groupedData[grade]
              const submittedCount = teachers.filter(t => t.isSubmitted).length
              const ratio = submittedCount / teachers.length
              const isAllSubmitted = ratio === 1
              const isExpanded = !!search.trim() || expandedGrades.includes(grade)

              return (
                <div key={grade} className="flex flex-col gap-2">
                  <Card 
                    onClick={() => toggleGrade(grade)}
                    className={`flex flex-col gap-3 p-5 transition-all active:scale-[0.99] cursor-pointer ${
                      isAllSubmitted ? 'bg-primary-50/50 border-primary-100' : 'bg-white'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold text-gray-900"><FitLabel>{grade} 관리</FitLabel></div>
                        <p className="mt-1 text-xs text-gray-600">{submittedCount} / {teachers.length}명 참여</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pt-1">
                        {isAllSubmitted && <CheckCircle2 size={18} className="text-primary-700"/>}
                        <motion.div animate={{rotate:isExpanded?180:0}} className="text-gray-600"><MoveDown size={18}/></motion.div>
                      </div>
                    </div>

                    {/* 진행도 바 */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${ratio * 100}%` }}
                        className={`h-full ${isAllSubmitted ? 'bg-primary-500' : 'bg-primary-400'}`}
                      />
                    </div>
                  </Card>

                  <AnimatePresence>
                    {isExpanded && (
                      <CollapsePanel
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col gap-2 px-1"
                      >
                        {teachers.map(t => (
                          <div key={t.key ?? `u${t.teacherId}`} className="brand-card min-w-0 flex flex-col gap-3 p-4 bg-white rounded-2xl border border-gray-200">
                            <p className="text-base font-bold text-gray-900">{t.teacherName}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`tts-state ${t.isSubmitted?'bg-secondary-50 text-secondary-800':'bg-red-50 text-red-700'}`}>{t.isSubmitted?'참여':'미참여'}</span>
                              <span className="text-base font-bold text-gray-800">{t.score ?? 0}점</span>
                            </div>
                            {t.scoreSource === 'SHEET' && <p className="text-xs text-gray-600">시트 확정 점수</p>}
                            {t.updatedAt && <p className="text-xs text-gray-600">마지막 수정 {formatUpdatedAt(t.updatedAt)}</p>}
                          </div>
                        ))}
                      </CollapsePanel>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
            </RecordViews></div>
          )}
        </div>
      )}
    </motion.div>
  )
}

function QuestionsTab() {
  const qc = useQueryClient()
  // 기본값([])을 두지 않음: 매 렌더마다 새 배열이 생겨 아래 useEffect가 무한 반복되는 것을 방지
  const questionsQuery = useQuery({
    queryKey: ['tts-questions', 'all'],
    queryFn: () => ttsApi.getAllQuestions().then(r => r.data)
  })

  const { data: questions } = questionsQuery
  const [editList, setEditList] = useState([])
  const [hasChanges, setHasChanges] = useState(false)

  // 데이터 로드 시 내부 편집용 상태로 복사
  useEffect(() => {
    if (questions && !hasChanges) setEditList([...questions])
  }, [questions, hasChanges])

  const { mutate: save, isPending, isError } = useMutation({
    mutationFn: (data) => ttsApi.updateQuestions(data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tts-questions'] })
      alert('저장되었습니다. 항목·배점 변경은 다음 주일부터 적용되며, 이전 주차 기록은 당시 기준을 유지합니다.')
      setHasChanges(false)
    }
  })

  const addQuestion = () => {
    const nextOrder = editList.length > 0 ? Math.max(...editList.map(q => q.displayOrder)) + 1 : 1
    const newQ = {
      title: '새로운 항목',
      type: 'DAYS',
      emoji: '✨',
      points: 5,
      linkType: 'NONE',
      displayOrder: nextOrder,
      active: true
    }
    setEditList([...editList, newQ])
    setHasChanges(true)
  }

  const deleteQuestion = (idx) => {
    if (!window.confirm('다음 주부터 항목을 사용하지 않을까요? 이전 주차 기록과 배점은 보존됩니다.')) return
    const next = [...editList]
    next.splice(idx, 1)
    setEditList(next)
    setHasChanges(true)
  }

  const updateQuestion = (idx, field, val) => {
    const next = [...editList]
    next[idx] = { ...next[idx], [field]: val }
    setEditList(next)
    setHasChanges(true)
  }

  return (
    <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="px-4 flex flex-col gap-4">
      <AdminReadGuard queries={[questionsQuery]} label="TTS 체크 항목">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">TTS 체크 항목</h2>
          <Button disabled={isPending} onClick={addQuestion}><Plus size={18} aria-hidden="true"/>항목 추가</Button>
        </div>
        <p className="text-sm leading-relaxed text-gray-600">항목·배점 변경은 다음 주일부터 적용됩니다. 이전 기록은 당시 기준을 유지합니다.</p>
        {!editList.length && <p className="py-8 text-base text-center text-gray-600">등록된 항목이 없습니다.</p>}
        {editList.map((q, idx) => (
          <Card key={idx} className="min-w-0 p-4">
            <fieldset disabled={isPending} className="min-w-0 flex flex-col gap-4">
              <legend className="mb-3 text-lg font-bold text-gray-900">항목 {idx+1}</legend>
              <label className="tts-field">항목 이름
                <input aria-label={`항목 ${idx+1} 이름`} type="text" value={q.title} onChange={e=>updateQuestion(idx,'title',e.target.value)} placeholder="항목 제목"/>
              </label>
              <label className="tts-field">아이콘
                <input aria-label={`항목 ${idx+1} 아이콘`} className="tts-emoji" type="text" value={q.emoji ?? ''} onChange={e=>updateQuestion(idx,'emoji',e.target.value)}/>
              </label>
              <p className="tts-field-label">체크 방식</p>
              <SegmentedControl label={`항목 ${idx+1} 체크 방식`} disabled={isPending} value={q.type} onChange={v=>updateQuestion(idx,'type',v)} options={[{value:'DAYS',label:'요일별 체크'},{value:'ATTEND',label:'참석 여부'}]}/>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
                <label className="tts-field">{q.type==='DAYS'?'하루 배점':'참석 배점'}
                  <div className="flex min-w-0 items-center gap-2"><input aria-label={`항목 ${idx+1} 배점`} type="number" min={0} value={q.points ?? (q.type==='DAYS'?5:10)} onChange={e=>updateQuestion(idx,'points',Number(e.target.value))}/><span className="shrink-0 text-base">점</span></div>
                </label>
                <label className="tts-active"><input aria-label={`항목 ${idx+1} 사용`} type="checkbox" checked={q.active} onChange={e=>updateQuestion(idx,'active',e.target.checked)}/><span>{q.active?'사용 중':'사용 안 함'}</span></label>
              </div>
              {q.type==='ATTEND' && <>
                <p className="tts-field-label">기록 연결</p>
                <div role="group" aria-label={`항목 ${idx+1} 기록 연결`} className="flex flex-col gap-2">
                  {[{value:'NONE',label:'직접 체크'},{value:'SAT_MEETING',label:'교사회의 참석 자동 반영'},{value:'PRAYER_MEETING',label:'기도모임 화·목 참석 자동 반영'}].map(option=><button type="button" disabled={isPending} key={option.value} aria-pressed={(q.linkType||'NONE')===option.value} onClick={()=>updateQuestion(idx,'linkType',option.value)} className={`tts-admin-action rounded-xl border text-left ${(q.linkType||'NONE')===option.value?'bg-primary-50 border-primary-400 text-primary-800':'bg-white border-gray-200 text-gray-700'}`}><FitLabel>{option.label}</FitLabel></button>)}
                </div>
              </>}
              <button type="button" onClick={()=>deleteQuestion(idx)} aria-label={`항목 ${idx+1} 삭제`} className="tts-admin-action rounded-xl bg-red-50 text-red-700"><Trash2 size={18} aria-hidden="true"/><FitLabel>항목 삭제</FitLabel></button>
            </fieldset>
          </Card>
        ))}
        {hasChanges && <div className="tts-save-panel sticky bottom-24 z-20 rounded-2xl border border-primary-200 bg-white p-3 shadow-lg">
          <p role="status" className="mb-2 text-sm text-gray-700">{isPending?'변경사항 저장 중…':'아직 저장하지 않은 변경사항이 있습니다.'}</p>
          {isError && <p role="alert" className="mb-2 text-sm text-red-700">저장하지 못했습니다. 입력한 내용을 확인하고 다시 시도해 주세요.</p>}
          <Button size="lg" onClick={()=>save(editList)} loading={isPending}><Save size={18} aria-hidden="true"/>변경사항 저장하기</Button>
        </div>}
      </AdminReadGuard>
      <div className="tts-legacy"><LegacyImportCard/></div>
    </motion.div>
  )
}
