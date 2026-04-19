import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, Clock, Users } from 'lucide-react'
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

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="기도모임 불참 관리" showBack />

      <div className="px-4 py-5 flex flex-col gap-5">

        {/* 주차 선택 */}
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">조회 주차 선택</p>
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-white text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 shadow-sm"
          >
            {weeks.map(w => (
              <option key={w} value={w}>{w} 주</option>
            ))}
          </select>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center py-4">
            <p className="text-2xl font-black text-red-500">{absentList.length}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase mt-1">불참 인원</p>
          </Card>
          <Card className="text-center py-4">
            <p className="text-2xl font-black text-emerald-500">
              {absentList.filter(v => v.scriptureCopySubmitted).length}
            </p>
            <p className="text-[10px] font-black text-gray-400 uppercase mt-1">필사 제출</p>
          </Card>
        </div>

        {/* 불참 목록 */}
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">불참 교사 명단</p>

          {isLoading ? (
            <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>
          ) : absentList.length === 0 ? (
            <Card className="py-10 text-center flex flex-col items-center gap-2">
              <Users size={28} className="text-gray-200" />
              <p className="text-sm font-black text-gray-400">해당 주차 불참자가 없습니다</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {absentList.map((vote, idx) => (
                <motion.div
                  key={vote.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-violet-700 font-black text-sm">{vote.teacher?.name?.[0]}</span>
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-sm">{vote.teacher?.name}</p>
                          {vote.reason && (
                            <p className="text-[11px] text-gray-400 font-medium mt-0.5">사유: {vote.reason}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 필사 제출 토글 */}
                    <button
                      onClick={() => toggleMutation.mutate({ id: vote.id, submitted: !vote.scriptureCopySubmitted })}
                      disabled={toggleMutation.isPending}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                        vote.scriptureCopySubmitted
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-amber-200 bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen size={15} className={vote.scriptureCopySubmitted ? 'text-emerald-600' : 'text-amber-500'} />
                        <span className={`text-xs font-black ${vote.scriptureCopySubmitted ? 'text-emerald-700' : 'text-amber-700'}`}>
                          필사 제출
                        </span>
                      </div>
                      {vote.scriptureCopySubmitted ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span className="text-xs font-black text-emerald-600">제출 완료</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Clock size={16} className="text-amber-500" />
                          <span className="text-xs font-black text-amber-600">미제출</span>
                        </div>
                      )}
                    </button>

                    {vote.scriptureCopySubmittedAt && (
                      <p className="text-[10px] text-gray-300 font-medium text-right">
                        제출 확인: {new Date(vote.scriptureCopySubmittedAt).toLocaleDateString('ko-KR')}
                      </p>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
