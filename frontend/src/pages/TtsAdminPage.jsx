import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminIntro, AdminEmpty } from '../components/common/AdminTools'
import { matchesAdminSearch, paginateAdminRows } from '../utils/adminSearch'
import LegacyImportCard from '../components/tts/LegacyImportCard'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Save, ChevronLeft, ChevronRight, CheckCircle2, MoveDown, LayoutList, Trophy, ChevronDown, ArrowUpDown } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { ttsApi } from '../api/tts'
import WeekNavigator from '../components/common/WeekNavigator'
import { getWeekStartByOffset, formatUpdatedAt, weekLabels, weekLabelsByNum } from '../utils/date'
import { addDays, format, getWeek } from 'date-fns'
import QueryNotice from '../components/common/QueryNotice'
import { queryReadState } from '../utils/queryReadState'
import { ttsYear, ttsYears, defaultQuarter, quartersForYear, quarterDateLabel, firstTtsOffset } from '../utils/ttsPeriod'

export default function TtsAdminPage() {
  const [activeTab, setActiveTab] = useState('summary') // 'summary' | 'scores' | 'questions'
  const [weekOffset, setWeekOffset] = useState(0)

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/30">
      <Header title="TTS 관리" showBack />

      <div className="flex flex-col gap-4 px-4 py-5">
        <AdminIntro title="TTS 기록을 살펴보세요" description="주간 참여와 분기 점수를 확인하고 체크 항목을 관리하세요." />
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
  const [search, setSearch] = useState('')
  const [year, setYear] = useState(ttsYear)
  const [quarter, setQuarter] = useState(() => defaultQuarter(ttsYear()))
  const [threshold, setThreshold] = useState(80)
  const [expanded, setExpanded] = useState(null)
  const [page, setPage] = useState(0)
  const [sortAsc, setSortAsc] = useState(false) // false = 높은순(기본)

  const scoresQuery = useQuery({
    queryKey: ['tts-quarterly-scores', year, quarter],
    queryFn: () => ttsApi.getQuarterlyScores(year, quarter).then(r => r.data)
  })
  const scores = scoresQuery.data || []

  const sortedAll = [...scores].sort((a, b) => sortAsc ? a.totalScore - b.totalScore : b.totalScore - a.totalScore)
  const belowCount = scores.filter(t => t.totalScore < threshold).length
  const filteredScores = sortedAll.filter(t => matchesAdminSearch(search, t.teacherName, t.grade))
  const { currentPage, totalPages, items: pageItems } = paginateAdminRows(filteredScores, page, PAGE_SIZE)

  const handleQuarterChange = (q) => { setQuarter(q); setExpanded(null); setPage(0) }
  const handleThresholdChange = (v) => { setThreshold(v); setExpanded(null); setPage(0) }
  const handleSortToggle = () => { setSortAsc(v => !v); setExpanded(null); setPage(0) }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex flex-col gap-4">
      {/* 분기 선택 */}
      <select aria-label="점수 현황 연도" value={year}
        onChange={e => { const next = Number(e.target.value); setYear(next); handleQuarterChange(defaultQuarter(next)) }}
        className="self-start px-3 py-2 rounded-xl bg-white border border-gray-100 text-sm font-bold text-gray-700">
        {ttsYears().map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      <div className="flex gap-2">
        {quartersForYear(year).map(({ q }) => (
          <button
            key={q}
            onClick={() => handleQuarterChange(q)}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
              quarter === q
                ? 'bg-primary-500 text-white border-primary-500 shadow-md'
                : 'bg-white text-gray-400 border-gray-100'
            }`}
          >
            {q}분기
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 text-center">{quarterDateLabel(year, quarter)}</p>

      <SearchField label="TTS 점수 교사 검색" value={search} onChange={value => { setSearch(value); setPage(0); setExpanded(null) }} placeholder="교사 이름 또는 학년 검색" />
      {/* 기준 점수 설정 */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500">기준 점수 설정</p>
          <span className="text-lg font-bold text-primary-600">{threshold}점</span>
        </div>
        <input
          aria-label="분기 기준 점수" type="range" min={0} max={500} step={10} value={threshold}
          onChange={e => handleThresholdChange(Number(e.target.value))}
          className="w-full accent-primary-500"
        />
        <div className="flex gap-2">
          {[50, 100, 150, 200, 300].map(v => (
            <button key={v} onClick={() => handleThresholdChange(v)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                threshold === v ? 'bg-primary-500 text-white border-primary-500' : 'bg-gray-50 text-gray-400 border-gray-100'
              }`}
            >{v}</button>
          ))}
        </div>
      </Card>

      {queryReadState([scoresQuery]) !== 'ready' ? (
        <QueryNotice queries={[scoresQuery]} label="분기 점수" />
      ) : scores.length === 0 ? (
        <div className="py-16 text-center text-gray-300">
          <Trophy size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-xs font-bold text-gray-400">이번 분기 제출 기록이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 요약 배너 */}
          <div className={`rounded-3xl p-4 flex items-center justify-between ${
            belowCount > 0 ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'
          }`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-0.5 text-gray-500">기준 미달 현황 · 전체 기준</p>
              {belowCount > 0
                ? <p className="font-bold text-red-500 text-base">{belowCount}명 미달 <span className="text-sm text-gray-400 font-bold">/ 전체 {scores.length}명</span></p>
                : <p className="font-bold text-emerald-500 text-base">전원 기준 달성 🎉</p>
              }
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400">기준 {threshold}점 이상</p>
              <p className="text-sm font-bold text-gray-600">{scores.length - belowCount}명 달성</p>
            </div>
          </div>

          {/* 목록 헤더 */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              표시 {filteredScores.length}명 / 전체 {scores.length}명
            </p>
            <button
              onClick={handleSortToggle}
              className="flex items-center gap-1.5 text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full"
            >
              <ArrowUpDown size={12} />
              {sortAsc ? '점수 낮은순' : '점수 높은순'}
            </button>
          </div>

          {!filteredScores.length && <AdminEmpty />}
          {/* 목록 */}
          <div className="flex flex-col gap-2">
            {pageItems.map((t, idx) => {
              const isBelow = t.totalScore < threshold
              const rowKey = t.key ?? `u${t.teacherId}`
              const isExpanded = expanded === rowKey
              const globalIdx = currentPage * PAGE_SIZE + idx + 1
              const deficit = threshold - t.totalScore
              const pct = threshold > 0 ? Math.min((t.totalScore / threshold) * 100, 100) : 100
              return (
                <div key={rowKey} className="flex flex-col gap-1.5">
                  <Card
                    onClick={() => setExpanded(isExpanded ? null : rowKey)}
                    className={`p-4 cursor-pointer active:scale-[0.99] transition-all border ${
                      isBelow ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isBelow ? 'bg-red-100 text-red-400' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                          {globalIdx}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{t.teacherName}</p>
                          <p className="text-xs text-gray-400 font-bold">{t.grade} · {t.weekCount}주 제출</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`font-bold text-base ${isBelow ? 'text-red-500' : 'text-emerald-600'}`}>{t.totalScore}점</p>
                          {isBelow && <p className="text-xs font-bold text-red-300">-{deficit}점 부족</p>}
                        </div>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-300">
                          <ChevronDown size={16} />
                        </motion.div>
                      </div>
                    </div>
                    {isBelow && (
                      <div className="w-full h-1.5 bg-red-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </Card>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-1">
                        <WeeklyScoreDetail year={year} scores={t.weeklyScores} total={t.totalScore} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>

          {/* 페이지 네비게이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
              <button
                aria-label="이전 점수 목록"
                onClick={() => { setPage(currentPage - 1); setExpanded(null) }}
                disabled={currentPage === 0}
                className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-gray-50 disabled:opacity-30 text-gray-400"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-700">{currentPage + 1} / {totalPages} 페이지</p>
                <p className="text-xs text-gray-400 font-bold">
                  {currentPage * PAGE_SIZE + 1}~{Math.min((currentPage + 1) * PAGE_SIZE, filteredScores.length)}번 · 표시 {filteredScores.length}명
                </p>
              </div>
              <button
                aria-label="다음 점수 목록"
                onClick={() => { setPage(currentPage + 1); setExpanded(null) }}
                disabled={currentPage >= totalPages - 1}
                className="min-h-11 min-w-11 p-2 rounded-xl hover:bg-gray-50 disabled:opacity-30 text-gray-400"
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

function WeeklyScoreDetail({ year, scores, total }) {
  return (
    <Card className="p-4 flex flex-col gap-2 bg-gray-50/50">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">주차별 점수</p>
      {scores.length === 0 ? (
        <p className="text-xs text-gray-300 font-bold">기록 없음</p>
      ) : (
        scores.map(ws => (
          <div key={ws.weekNum} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
            <span className="text-sm font-bold text-gray-600">{weekLabelsByNum(year, ws.weekNum).monthWeek}</span>
            <span className="font-bold text-gray-700 text-sm">{ws.score}점</span>
          </div>
        ))
      )}
      <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
        <span className="text-xs font-bold text-gray-500">누계 합계</span>
        <span className="font-bold text-gray-800">{total}점</span>
      </div>
    </Card>
  )
}

function SummaryTab({ offset, onOffsetChange }) {
  const [search, setSearch] = useState('')
  // 서버와 같은 주차 규칙: 일~토, 1월 1일이 든 주가 1주차 (연도는 그 주 토요일 기준)
  const sunday = getWeekStartByOffset(offset, 0)
  const year = addDays(sunday, 6).getFullYear()
  const week = { weekNum: getWeek(sunday, { weekStartsOn: 0 }), start: format(sunday, 'M/d'), end: format(addDays(sunday, 6), 'M/d') }
  const [expandedGrades, setExpandedGrades] = useState([])

  const summaryQuery = useQuery({
    queryKey: ['tts-admin-summary', year, week.weekNum],
    // 교사가 수정한 내용이 바로 보이도록 화면에 돌아올 때마다 다시 불러옴
    refetchOnWindowFocus: 'always',
    queryFn: () => ttsApi.getSummary(year, week.weekNum).then(r => r.data)
  })
  const summary = summaryQuery.data || []

  // 학년별로 그룹화
  const groupedData = summary.filter(t => matchesAdminSearch(search, t.teacherName, t.grade)).reduce((acc, curr) => {
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
      <div className="bg-white p-4 rounded-3xl shadow-sm">
        <WeekNavigator
          offset={offset}
          onChange={onOffsetChange}
          minOffset={firstTtsOffset()}
          title={`${weekLabels(sunday).monthWeek} TTS`}
          sub={weekLabels(sunday).yearWeek}
          range={`${week.start} ~ ${week.end} · 1점 이상이면 참여로 집계`}
        />
      </div>

      <SearchField label="주간 TTS 교사 검색" value={search} onChange={setSearch} placeholder="교사 이름 또는 학년 검색" />
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{search.trim() ? '검색된 교사 참여 현황' : '학년별 참여 현황'}</p>
        <span className="text-xs font-bold text-gray-400">총 {gradeNames.length}개 학년</span>
      </div>

      {queryReadState([summaryQuery]) !== 'ready' ? (
        <QueryNotice queries={[summaryQuery]} label="TTS 참여 현황" />
      ) : (
        <div className="flex flex-col gap-3">
          {gradeNames.length === 0 ? (
            <div className="py-20 text-center text-gray-300">
               <p className="text-xs font-bold">{search.trim() ? '조건에 맞는 교사가 없습니다' : '등록된 교사 정보가 없습니다'}</p>
            </div>
          ) : (
            gradeNames.map(grade => {
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm ${
                          isAllSubmitted ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-400'
                        }`}>
                          {grade}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-base">{grade} 관리</p>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                            {submittedCount} / {teachers.length} 참여
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAllSubmitted && <CheckCircle2 size={18} className="text-primary-500" />}
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="text-gray-300">
                           <MoveDown size={16} />
                        </motion.div>
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
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col gap-2 px-1"
                      >
                        {teachers.map(t => (
                          <div key={t.key ?? `u${t.teacherId}`} className="flex items-center justify-between p-4 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100/50">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                t.isSubmitted ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {t.teacherName[0]}
                              </div>
                              <div>
                                <p className="font-bold text-gray-700 text-sm">{t.teacherName}</p>
                                {t.scoreSource === 'SHEET' && <p className="text-xs text-gray-400">시트 확정 점수</p>}
                                {t.updatedAt && <p className="text-xs text-gray-400 font-bold">마지막 수정 {formatUpdatedAt(t.updatedAt)}</p>}
                              </div>
                            </div>
                            <Badge variant={t.isSubmitted ? 'success' : 'gray'} className="text-xs">
                              {t.isSubmitted ? `${t.score}점` : '미참여'}
                            </Badge>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })
          )}
        </div>
      )}
    </motion.div>
  )
}

function QuestionsTab() {
  const qc = useQueryClient()
  // 기본값([])을 두지 않음: 매 렌더마다 새 배열이 생겨 아래 useEffect가 무한 반복되는 것을 방지
  const { data: questions, isLoading } = useQuery({
    queryKey: ['tts-questions', 'all'],
    queryFn: () => ttsApi.getAllQuestions().then(r => r.data)
  })

  const [editList, setEditList] = useState([])
  const [hasChanges, setHasChanges] = useState(false)

  // 데이터 로드 시 내부 편집용 상태로 복사
  useEffect(() => {
    if (questions) setEditList([...questions])
  }, [questions])

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => ttsApi.updateQuestions(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tts-questions'] })
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
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">TTS 체크 항목</p>
        <button onClick={addQuestion} className="flex items-center gap-1 text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
          <Plus size={14} /> 추가
        </button>
      </div>

      <p className="text-xs leading-relaxed text-gray-500">항목·배점 변경은 다음 주일부터 적용됩니다. 이전 주차 기록은 당시 기준을 유지합니다.</p>
      <div className="flex flex-col gap-3">
        {editList.length === 0 && !isLoading && (
          <div className="py-20 text-center text-gray-300">
             <LayoutList size={40} className="mx-auto mb-3 opacity-20" />
             <p className="text-xs font-bold text-gray-400">등록된 항목이 없습니다</p>
          </div>
        )}
        
        {editList.map((q, idx) => (
          <Card key={idx} className="p-4 flex flex-col gap-4 border-2 border-transparent hover:border-primary-100 transition-colors">
            <div className="flex items-start gap-3">
              <input
                type="text"
                value={q.emoji ?? ''}
                onChange={(e) => updateQuestion(idx, 'emoji', e.target.value)}
                className="w-10 h-10 bg-gray-50 rounded-xl text-xl flex items-center justify-center text-center border-none outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={q.title}
                  onChange={(e) => updateQuestion(idx, 'title', e.target.value)}
                  placeholder="항목 제목"
                  className="w-full text-sm font-bold text-gray-900 border-none outline-none focus:bg-gray-50 rounded px-1"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                    className="text-xs font-bold bg-gray-100 px-2 py-1 rounded-lg border-none outline-none"
                  >
                    <option value="DAYS">주간 체크 (DAYS)</option>
                    <option value="ATTEND">참석 여부 (ATTEND)</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs font-bold text-gray-400">
                    <input
                      type="number"
                      min={0}
                      value={q.points ?? (q.type === 'DAYS' ? 5 : 10)}
                      onChange={(e) => updateQuestion(idx, 'points', Number(e.target.value))}
                      className="w-12 bg-gray-100 px-1.5 py-1 rounded-lg text-gray-700 border-none outline-none"
                    />
                    {q.type === 'DAYS' ? '점/일' : '점'}
                  </label>
                  <label className="flex items-center gap-1 ml-auto">
                    <input
                      type="checkbox"
                      checked={q.active}
                      onChange={(e) => updateQuestion(idx, 'active', e.target.checked)}
                      className="w-3 h-3 rounded"
                    />
                    <span className="text-xs font-bold text-gray-400">활성</span>
                  </label>
                </div>
                {q.type === 'ATTEND' && (
                  <select
                    value={q.linkType || 'NONE'}
                    onChange={(e) => updateQuestion(idx, 'linkType', e.target.value)}
                    className="text-xs font-bold bg-violet-50 text-violet-700 px-2 py-1 rounded-lg border-none outline-none self-start"
                  >
                    <option value="NONE">직접 체크</option>
                    <option value="SAT_MEETING">교사회의 체크에서 자동 반영</option>
                    <option value="PRAYER_MEETING">기도모임 투표(화·목 참석)에서 자동 반영</option>
                  </select>
                )}
              </div>
              <button onClick={() => deleteQuestion(idx)} className="text-gray-200 hover:text-red-400 transition-colors p-1">
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <LegacyImportCard />

      {hasChanges && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 z-20">
          <Button size="lg" onClick={() => save(editList)} loading={isPending} className="shadow-glow">
            <Save size={18} /> 변경사항 저장하기
          </Button>
        </div>
      )}
    </motion.div>
  )
}
