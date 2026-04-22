import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, Clock, Users, Loader2 } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { prayerVoteApi } from '../api/prayerVote'
import { format, startOfWeek, addWeeks } from 'date-fns'

function getThisWeekMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return format(monday, 'yyyy-MM-dd')
}

function getPastMondays(count = 8) {
  const mondays = []
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + diff)
  for (let i = 0; i < count; i++) {
    const d = new Date(thisMonday)
    d.setDate(thisMonday.getDate() - i * 7)
    mondays.push(format(d, 'yyyy-MM-dd'))
  }
  return mondays
}

export default function PrayerAbsentAdminPage() {
  const [selectedWeek, setSelectedWeek] = useState(getThisWeekMonday())
  const [activeGrade, setActiveGrade] = useState('전체')
  const [statusFilter, setStatusFilter] = useState('전체') // '전체' | '미제출' | '제출완료'
  const queryClient = useQueryClient()
  const weeks = getPastMondays()

  const { data: absentList = [], isLoading } = useQuery({
    queryKey: ['prayer-absent', selectedWeek],
    queryFn: () => prayerVoteApi.getAbsentList(selectedWeek).then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, submitted }) => prayerVoteApi.toggleScripture(id, submitted).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayer-absent', selectedWeek] }),
  })

  const GRADE_ORDER = ['전체', '유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미분류']

  const filteredList = absentList.filter(v => {
    const gradeMatch = activeGrade === '전체' || (v.teacherGrade || '미분류') === activeGrade
    const statusMatch = statusFilter === '전체' || 
      (statusFilter === '미제출' && !v.scriptureCopySubmitted) ||
      (statusFilter === '제출완료' && v.scriptureCopySubmitted)
    return gradeMatch && statusMatch
  })

  const grouped = {}
  filteredList.forEach(v => {
    const g = v.teacherGrade || '미분류'
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(v)
  })

  const sortedGrades = Object.keys(grouped).sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a); const bi = GRADE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="기도모임 불참 관리" showBack />

      <div className="px-4 py-5 flex flex-col gap-6">

        {/* 주차 선택 */}
        <section>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">조회 주차</p>
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm font-black text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-violet-200"
          >
            {weeks.map(w => (
              <option key={w} value={w}>{w} 주차</option>
            ))}
          </select>
        </section>

        {/* 필터 섹션 */}
        <section className="flex flex-col gap-3">
          {/* 학년 필터 */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1">
            {GRADE_ORDER.filter(g => g === '전체' || absentList.some(v => (v.teacherGrade || '미분류') === g)).map(g => (
              <button
                key={g}
                onClick={() => setActiveGrade(g)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[11px] font-black transition-all ${
                  activeGrade === g
                    ? 'bg-violet-500 text-white shadow-md'
                    : 'bg-white border border-gray-100 text-gray-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* 상태 필터 */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {['전체', '미제출', '제출완료'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${
                  statusFilter === s ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* 통계 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center py-4 border-red-50 bg-red-50/30">
            <p className="text-2xl font-black text-red-500">{absentList.length}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase mt-1">총 불참 인원</p>
          </Card>
          <Card className="text-center py-4 border-amber-50 bg-amber-50/30">
            <p className="text-2xl font-black text-amber-500">
              {absentList.filter(v => !v.scriptureCopySubmitted).length}
            </p>
            <p className="text-[10px] font-black text-gray-400 uppercase mt-1">필사 미제출</p>
          </Card>
        </div>

        {/* 불참 목록 */}
        <div>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">불참 교사 명단</p>
            <p className="text-[11px] font-black text-violet-500">{filteredList.length}명 검색됨</p>
          </div>

          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-violet-300" /></div>
          ) : filteredList.length === 0 ? (
            <Card className="py-16 text-center flex flex-col items-center gap-3">
              <Users size={32} className="text-gray-100" />
              <p className="text-sm font-black text-gray-300">조건에 맞는 결과가 없습니다</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {sortedGrades.map(grade => (
                <div key={grade} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1 h-3 bg-violet-400 rounded-full" />
                    <p className="text-xs font-black text-gray-900">{grade}</p>
                    <span className="text-[10px] text-gray-400 font-bold">{grouped[grade].length}명</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {grouped[grade].map((vote, idx) => (
                      <motion.div
                        key={vote.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <Card className={`flex flex-col gap-3 transition-all ${
                          !vote.scriptureCopySubmitted ? 'border-amber-200 ring-2 ring-amber-50' : 'border-gray-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                                !vote.scriptureCopySubmitted ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-400'
                              }`}>
                                <span className="font-black text-sm">{vote.teacherName?.[0]}</span>
                              </div>
                              <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-black text-gray-900 text-sm">{vote.teacherName}</p>
                                    <span className="text-[10px] text-gray-400 font-bold">({vote.teacherGrade})</span>
                                    {!vote.scriptureCopySubmitted && (
                                      <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-md animate-pulse">필사 대상</span>
                                    )}
                                  </div>
                                {vote.reason && (
                                  <p className="text-[11px] text-gray-400 font-medium mt-0.5 line-clamp-1">사유: {vote.reason}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => toggleMutation.mutate({ id: vote.id, submitted: !vote.scriptureCopySubmitted })}
                            disabled={toggleMutation.isPending}
                            className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-95 ${
                              vote.scriptureCopySubmitted
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-300 bg-amber-50 text-amber-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <BookOpen size={16} className={vote.scriptureCopySubmitted ? 'text-emerald-500' : 'text-amber-500'} />
                              <span className="text-xs font-black">필사 제출 확인</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {vote.scriptureCopySubmitted ? (
                                <><CheckCircle2 size={16} /><span className="text-xs font-black">제출 완료</span></>
                              ) : (
                                <><Clock size={16} /><span className="text-xs font-black">미제출</span></>
                              )}
                            </div>
                          </button>

                          {vote.scriptureCopySubmittedAt && (
                            <p className="text-[9px] text-gray-300 font-bold text-right px-1">
                              체크 일시: {new Date(vote.scriptureCopySubmittedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
