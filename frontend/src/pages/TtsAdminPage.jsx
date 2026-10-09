import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Save, Settings,
  ChevronLeft, ChevronRight, CheckCircle2,
  MoveDown, LayoutList, ClipboardCheck, Trophy, ChevronDown, ChevronUp, ArrowUpDown, Upload
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { ttsApi } from '../api/tts'
import WeekNavigator from '../components/common/WeekNavigator'
import { getWeekStartByOffset, formatUpdatedAt } from '../utils/date'
import { addDays, format, getWeek } from 'date-fns'

const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3)
const QUARTER_LABELS = { 1: '1~3월', 2: '4~6월', 3: '7~9월', 4: '10~12월' }

export default function TtsAdminPage() {
  const [activeTab, setActiveTab] = useState('summary') // 'summary' | 'scores' | 'questions'
  const [weekOffset, setWeekOffset] = useState(0)

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/30">
      <Header title="TTS 관리" showBack />

      {/* 탭 네비게이션 */}
      <div className="px-4 mt-2 mb-4">
        <div className="flex p-1 bg-white rounded-2xl shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'summary' ? 'bg-primary-500 text-white shadow-md' : 'text-gray-400'
            }`}
          >
            <ClipboardCheck size={16} /> 주간 현황
          </button>
          <button
            onClick={() => setActiveTab('scores')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'scores' ? 'bg-primary-500 text-white shadow-md' : 'text-gray-400'
            }`}
          >
            <Trophy size={16} /> 점수 현황
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'questions' ? 'bg-primary-500 text-white shadow-md' : 'text-gray-400'
            }`}
          >
            <Settings size={16} /> 항목 관리
          </button>
        </div>
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
  const year = new Date().getFullYear()
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [threshold, setThreshold] = useState(80)
  const [expanded, setExpanded] = useState(null)
  const [page, setPage] = useState(0)
  const [sortAsc, setSortAsc] = useState(false) // false = 높은순(기본)

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ['tts-quarterly-scores', year, quarter],
    queryFn: () => ttsApi.getQuarterlyScores(year, quarter).then(r => r.data)
  })

  const sortedAll = [...scores].sort((a, b) => sortAsc ? a.totalScore - b.totalScore : b.totalScore - a.totalScore)
  const belowCount = scores.filter(t => t.totalScore < threshold).length
  const totalPages = Math.ceil(sortedAll.length / PAGE_SIZE)
  const pageItems = sortedAll.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleQuarterChange = (q) => { setQuarter(q); setExpanded(null); setPage(0) }
  const handleThresholdChange = (v) => { setThreshold(v); setExpanded(null); setPage(0) }
  const handleSortToggle = () => { setSortAsc(v => !v); setExpanded(null); setPage(0) }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-4 flex flex-col gap-4">
      {/* 분기 선택 */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(q => (
          <button
            key={q}
            onClick={() => handleQuarterChange(q)}
            className={`flex-1 py-2.5 rounded-2xl text-[11px] font-black transition-all border ${
              quarter === q
                ? 'bg-primary-500 text-white border-primary-500 shadow-md'
                : 'bg-white text-gray-400 border-gray-100'
            }`}
          >
            <span className="block text-[10px] opacity-70">Q{q}</span>
            {QUARTER_LABELS[q]}
          </button>
        ))}
      </div>

      {/* 기준 점수 설정 */}
      <Card className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black text-gray-500">기준 점수 설정</p>
          <span className="text-lg font-black text-primary-600">{threshold}점</span>
        </div>
        <input
          type="range" min={0} max={500} step={10} value={threshold}
          onChange={e => handleThresholdChange(Number(e.target.value))}
          className="w-full accent-primary-500"
        />
        <div className="flex gap-2">
          {[50, 100, 150, 200, 300].map(v => (
            <button key={v} onClick={() => handleThresholdChange(v)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                threshold === v ? 'bg-primary-500 text-white border-primary-500' : 'bg-gray-50 text-gray-400 border-gray-100'
              }`}
            >{v}</button>
          ))}
        </div>
      </Card>

      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-bold">불러오는 중...</p>
        </div>
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
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 text-gray-500">기준 미달 현황</p>
              {belowCount > 0
                ? <p className="font-black text-red-500 text-base">{belowCount}명 미달 <span className="text-sm text-gray-400 font-bold">/ 전체 {scores.length}명</span></p>
                : <p className="font-black text-emerald-500 text-base">전원 기준 달성 🎉</p>
              }
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-gray-400">기준 {threshold}점 이상</p>
              <p className="text-sm font-black text-gray-600">{scores.length - belowCount}명 달성</p>
            </div>
          </div>

          {/* 목록 헤더 */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              전체 {sortedAll.length}명
            </p>
            <button
              onClick={handleSortToggle}
              className="flex items-center gap-1.5 text-[11px] font-black text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full"
            >
              <ArrowUpDown size={12} />
              {sortAsc ? '점수 낮은순' : '점수 높은순'}
            </button>
          </div>

          {/* 목록 */}
          <div className="flex flex-col gap-2">
            {pageItems.map((t, idx) => {
              const isBelow = t.totalScore < threshold
              const isExpanded = expanded === t.teacherId
              const globalIdx = page * PAGE_SIZE + idx + 1
              const deficit = threshold - t.totalScore
              const pct = threshold > 0 ? Math.min((t.totalScore / threshold) * 100, 100) : 100
              return (
                <div key={t.teacherId} className="flex flex-col gap-1.5">
                  <Card
                    onClick={() => setExpanded(isExpanded ? null : t.teacherId)}
                    className={`p-4 cursor-pointer active:scale-[0.99] transition-all border ${
                      isBelow ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          isBelow ? 'bg-red-100 text-red-400' : 'bg-emerald-50 text-emerald-500'
                        }`}>
                          {globalIdx}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-sm">{t.teacherName}</p>
                          <p className="text-[10px] text-gray-400 font-bold">{t.grade} · {t.weekCount}주 제출</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`font-black text-base ${isBelow ? 'text-red-500' : 'text-emerald-600'}`}>{t.totalScore}점</p>
                          {isBelow && <p className="text-[10px] font-black text-red-300">-{deficit}점 부족</p>}
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
                        <WeeklyScoreDetail scores={t.weeklyScores} total={t.totalScore} />
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
                onClick={() => { setPage(p => p - 1); setExpanded(null) }}
                disabled={page === 0}
                className="p-2 rounded-xl hover:bg-gray-50 disabled:opacity-30 text-gray-400"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-xs font-black text-gray-700">{page + 1} / {totalPages} 페이지</p>
                <p className="text-[10px] text-gray-400 font-bold">
                  {page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, sortedAll.length)}번 · 전체 {sortedAll.length}명
                </p>
              </div>
              <button
                onClick={() => { setPage(p => p + 1); setExpanded(null) }}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-xl hover:bg-gray-50 disabled:opacity-30 text-gray-400"
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

function WeeklyScoreDetail({ scores, total }) {
  return (
    <Card className="p-4 flex flex-col gap-2 bg-gray-50/50">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">주차별 점수</p>
      {scores.length === 0 ? (
        <p className="text-xs text-gray-300 font-bold">기록 없음</p>
      ) : (
        scores.map(ws => (
          <div key={ws.weekNum} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
            <span className="text-sm font-bold text-gray-600">{ws.weekNum}주차</span>
            <span className="font-black text-gray-700 text-sm">{ws.score}점</span>
          </div>
        ))
      )}
      <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
        <span className="text-[11px] font-black text-gray-500">누계 합계</span>
        <span className="font-black text-gray-800">{total}점</span>
      </div>
    </Card>
  )
}

function SummaryTab({ offset, onOffsetChange }) {
  // 서버와 같은 주차 규칙: 일~토, 1월 1일이 든 주가 1주차 (연도는 그 주 토요일 기준)
  const sunday = getWeekStartByOffset(offset, 0)
  const year = addDays(sunday, 6).getFullYear()
  const week = { weekNum: getWeek(sunday, { weekStartsOn: 0 }), start: format(sunday, 'M/d'), end: format(addDays(sunday, 6), 'M/d') }
  const [expandedGrades, setExpandedGrades] = useState([])

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['tts-admin-summary', year, week.weekNum],
    // 교사가 수정한 내용이 바로 보이도록 화면에 돌아올 때마다 다시 불러옴
    refetchOnWindowFocus: 'always',
    queryFn: () => ttsApi.getSummary(year, week.weekNum).then(r => r.data)
  })

  // 학년별로 그룹화
  const groupedData = summary.reduce((acc, curr) => {
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
          title={`${year}년 ${week.weekNum}주차 TTS`}
          range={`${week.start} ~ ${week.end} · 1점 이상이면 참여로 집계`}
        />
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission by Grade</p>
        <span className="text-[10px] font-black text-gray-400">총 {gradeNames.length}개 학년</span>
      </div>

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-bold">현황을 불러오는 중...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {gradeNames.length === 0 ? (
            <div className="py-20 text-center text-gray-300">
               <p className="text-xs font-bold">등록된 교사 정보가 없습니다</p>
            </div>
          ) : (
            gradeNames.map(grade => {
              const teachers = groupedData[grade]
              const submittedCount = teachers.filter(t => t.isSubmitted).length
              const ratio = submittedCount / teachers.length
              const isAllSubmitted = ratio === 1
              const isExpanded = expandedGrades.includes(grade)

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
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm ${
                          isAllSubmitted ? 'bg-primary-500 text-white' : 'bg-gray-50 text-gray-400'
                        }`}>
                          {grade}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-base">{grade} 관리</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
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
                          <div key={t.teacherId} className="flex items-center justify-between p-4 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100/50">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                t.isSubmitted ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {t.teacherName[0]}
                              </div>
                              <div>
                                <p className="font-bold text-gray-700 text-sm">{t.teacherName}</p>
                                {t.updatedAt && <p className="text-[10px] text-gray-400 font-bold">마지막 수정 {formatUpdatedAt(t.updatedAt)}</p>}
                              </div>
                            </div>
                            <Badge variant={t.isSubmitted ? 'success' : 'gray'} className="text-[10px]">
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
      alert('저장되었습니다.')
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
    if (!window.confirm('항목을 삭제하시겠습니까? (저장 시 반영되며, 이미 답변 기록이 있는 항목은 비활성으로 남습니다)')) return
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
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TTS Items Management</p>
        <button onClick={addQuestion} className="flex items-center gap-1 text-[11px] font-black text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
          <Plus size={14} /> 추가
        </button>
      </div>

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
                value={q.emoji}
                onChange={(e) => updateQuestion(idx, 'emoji', e.target.value)}
                className="w-10 h-10 bg-gray-50 rounded-xl text-xl flex items-center justify-center text-center border-none outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={q.title}
                  onChange={(e) => updateQuestion(idx, 'title', e.target.value)}
                  placeholder="항목 제목"
                  className="w-full text-sm font-black text-gray-900 border-none outline-none focus:bg-gray-50 rounded px-1"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={q.type}
                    onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                    className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded-lg border-none outline-none"
                  >
                    <option value="DAYS">주간 체크 (DAYS)</option>
                    <option value="ATTEND">참석 여부 (ATTEND)</option>
                  </select>
                  <label className="flex items-center gap-1 text-[10px] font-black text-gray-400">
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
                    <span className="text-[10px] font-black text-gray-400">활성</span>
                  </label>
                </div>
                {q.type === 'ATTEND' && (
                  <select
                    value={q.linkType || 'NONE'}
                    onChange={(e) => updateQuestion(idx, 'linkType', e.target.value)}
                    className="text-[10px] font-black bg-violet-50 text-violet-700 px-2 py-1 rounded-lg border-none outline-none self-start"
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

      {/* 기존 시트 점수 가져오기: 당분간 숨김 (다시 쓰려면 아래 줄의 주석만 풀면 됨) */}
      {/* <LegacyImportCard /> */}

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

// 기존 구글 시트(TTS 점수표)를 붙여넣어 통계에 합치는 카드
function LegacyImportCard() {
  const queryClient = useQueryClient()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => ttsApi.importLegacy(year, text).then(r => r.data),
    onSuccess: (data) => {
      setResult(data)
      setText('')
      queryClient.invalidateQueries({ queryKey: ['tts-stats'] })
    },
    onError: (err) => alert(err.response?.data?.message || '가져오기 중 오류가 발생했습니다.'),
  })

  const submit = () => {
    if (!text.trim()) return alert('시트 내용을 붙여넣어 주세요.')
    if (!confirm(`${year}년 시트 점수를 가져올까요?\n같은 연도의 이전 시트 데이터는 새 내용으로 바뀝니다.\n(앱에서 체크한 점수가 있는 주는 앱 점수가 우선)`)) return
    mutate()
  }

  return (
    <Card className="flex flex-col gap-3 mt-6">
      <div className="flex items-center gap-2">
        <Upload size={16} className="text-primary-500" />
        <p className="font-black text-gray-900 text-sm">기존 시트 점수 가져오기</p>
      </div>
      <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
        구글 시트에서 이름·주차별 점수 표를 통째로 복사(Ctrl+C)해서 아래에 붙여넣으세요.
        첫 줄은 제목 줄(이름, 1주차, 2주차 …)이어야 해요.
      </p>
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="text-xs font-black bg-gray-100 px-3 py-2 rounded-xl border-none outline-none self-start"
      >
        {[thisYear, thisYear - 1].map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="여기에 붙여넣기"
        className="w-full px-3 py-2 rounded-xl border border-gray-100 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary-200 bg-gray-50"
      />
      <Button onClick={submit} loading={isPending} disabled={isPending}>
        <Upload size={16} /> 가져오기
      </Button>
      {result && (
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-[11px] font-bold text-gray-600 flex flex-col gap-1">
          <p>{result.year}년 · {result.names}명 · {result.weeks?.length ?? 0}개 주차 · {result.rows}건 저장</p>
          {result.unmatchedNames?.length > 0 && (
            <p className="text-amber-600">앱 계정과 이름이 안 맞는 사람(시트 이름으로 표시): {result.unmatchedNames.join(', ')}</p>
          )}
        </div>
      )}
    </Card>
  )
}
