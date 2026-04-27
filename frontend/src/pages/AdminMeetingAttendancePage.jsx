import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Loader2, CheckCircle2, XCircle, RefreshCw, Clock } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import client from '../api/client'
import { format, addDays } from 'date-fns'

function getPastSaturdays(count = 8) {
  const saturdays = []
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + diff)

  for (let i = 0; i < count; i++) {
    const d = new Date(thisMonday)
    d.setDate(thisMonday.getDate() - i * 7)
    saturdays.push(format(addDays(d, 5), 'yyyy-MM-dd'))
  }
  return saturdays
}

function extractGrade(g) {
  if (!g || g === '미분류') return '미분류'
  if (g.startsWith('유치')) return '유치'
  const m = g.match(/([초중고][1-6])/)
  return m ? m[1] : g
}

const GRADE_ORDER = ['전체', '유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미분류']

export default function AdminMeetingAttendancePage() {
  const queryClient = useQueryClient()
  const weeks = getPastSaturdays()
  const [selectedDate, setSelectedDate] = useState(weeks[0])
  const [statusFilter, setStatusFilter] = useState('전체')   // 전체 | 참석 | 불참
  const [activeGrade, setActiveGrade] = useState('전체')     // 학년 필터

  // ── 토요 교사회의 참석 데이터
  const { data: attendanceList = [], isLoading: isAttLoading, isRefetching: isAttRefetching } = useQuery({
    queryKey: ['admin-meeting-attendance', selectedDate],
    queryFn: () => client.get(`/meetings/attendance/admin?date=${selectedDate}`).then(r => r.data),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

  // ── 전체 교사 명단
  const { data: teachers = [] } = useQuery({
    queryKey: ['admin-teachers-active'],
    queryFn: () => client.get('/users/teachers').then(r => r.data),
    staleTime: 0,
    refetchInterval: 30000,
  })

  // ── 회의록 확인 상태
  const { data: allMinutes = [] } = useQuery({
    queryKey: ['admin-minutes-all'],
    queryFn: () => client.get('/minutes').then(r => r.data),
    refetchInterval: 30000,
    staleTime: 0,
  })

  // selectedDate는 토요일 → 해당 주(일~토) 범위 안의 활성 회의록을 찾음
  const weekStart = format(addDays(new Date(selectedDate + 'T00:00:00'), -6), 'yyyy-MM-dd')
  const targetMinute = allMinutes.find(m => m.isActive && m.meetingDate >= weekStart && m.meetingDate <= selectedDate)

  const { data: minuteStatusList = [], isRefetching: isMinuteRefetching } = useQuery({
    queryKey: ['admin-minute-status', targetMinute?.id],
    queryFn: () => client.get(`/minutes/${targetMinute.id}/status`).then(r => r.data),
    enabled: !!targetMinute,
    refetchInterval: 10000,
    staleTime: 0,
  })

  const isRefetching = isAttRefetching || isMinuteRefetching

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-meeting-attendance', selectedDate] })
    queryClient.invalidateQueries({ queryKey: ['admin-minutes-all'] })
    if (targetMinute) {
      queryClient.invalidateQueries({ queryKey: ['admin-minute-status', targetMinute.id] })
    }
  }

  // ── 데이터 맵 구성
  const attendanceMap = {}
  attendanceList.forEach(a => { if (a.teacherId) attendanceMap[Number(a.teacherId)] = a })

  const minuteConfirmMap = {}
  minuteStatusList.forEach(s => { if (s.teacherId) minuteConfirmMap[Number(s.teacherId)] = s.confirmed })

  // ── 전체 교사 리스트 구성
  const fullList = teachers.map(t => {
    const tid = Number(t.id)
    const att = attendanceMap[tid]
    return {
      teacherId: tid,
      teacherName: t.name,
      teacherGrade: extractGrade(t.grade),
      displayGrade: t.grade || '미분류',
      satStatus: att?.status || 'UNSUBMITTED',
      satReason: att?.reason || '',
      minuteConfirmed: minuteConfirmMap[tid] || false,
    }
  })

  // ── 학년 필터에 실제 데이터가 있는 학년만 버튼으로 노출
  const availableGrades = GRADE_ORDER.filter(g =>
    g === '전체' || fullList.some(v => v.teacherGrade === g)
  )

  // ── 필터 적용 (학년 + 참석상태)
  const filteredList = fullList.filter(item => {
    const gradeMatch = activeGrade === '전체' || item.teacherGrade === activeGrade
    const statusMatch =
      statusFilter === '전체' ||
      (statusFilter === '참석' && item.satStatus === 'ATTEND') ||
      (statusFilter === '불참' && item.satStatus === 'ABSENT')
    return gradeMatch && statusMatch
  })

  // ── 학년별 그룹핑 (필터 결과 기준)
  const grouped = {}
  filteredList.forEach(v => {
    const g = v.teacherGrade
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(v)
  })
  const sortedGrades = Object.keys(grouped).sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a), bi = GRADE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  // ── 통계 (전체 기준)
  const countAttend = fullList.filter(i => i.satStatus === 'ATTEND').length
  const countAbsent = fullList.filter(i => i.satStatus === 'ABSENT').length
  const countAbsentConfirmed = fullList.filter(i => i.satStatus === 'ABSENT' && i.minuteConfirmed).length

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header
        title="교사회의 참석 관리"
        showBack
        right={
          <button
            onClick={handleRefetch}
            className={`p-2 rounded-full transition-all ${isRefetching ? 'text-blue-500' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <motion.div
              animate={{ rotate: isRefetching ? 360 : 0 }}
              transition={{ duration: 1, repeat: isRefetching ? Infinity : 0, ease: 'linear' }}
            >
              <RefreshCw size={20} />
            </motion.div>
          </button>
        }
      />

      <div className="px-4 py-5 flex flex-col gap-6">

        {/* 날짜 선택 */}
        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">회의 일자 (토요일 기준)</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-bold text-gray-400">실시간 반영 중</p>
            </div>
          </div>
          <select
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setActiveGrade('전체') }}
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm font-black text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-200"
          >
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </section>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-4 border-emerald-50 bg-emerald-50/30">
            <p className="text-xl font-black text-emerald-500">{countAttend}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase mt-1">참석</p>
          </Card>
          <Card className="text-center py-4 border-red-50 bg-red-50/30">
            <p className="text-xl font-black text-red-500">{countAbsent}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase mt-1">불참</p>
          </Card>
          <Card className="text-center py-4 border-blue-50 bg-blue-50/30">
            <p className="text-xl font-black text-blue-500">{countAbsentConfirmed}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase mt-1">영상확인</p>
          </Card>
        </div>

        {/* 필터 섹션 */}
        <section className="flex flex-col gap-3">
          {/* 학년 필터 (가로 스크롤) */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1">
            {availableGrades.map(g => (
              <button
                key={g}
                onClick={() => setActiveGrade(g)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[11px] font-black transition-all ${
                  activeGrade === g
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white border border-gray-100 text-gray-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* 참석 상태 필터 */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {['전체', '참석', '불참'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all ${
                  statusFilter === s ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* 교사 명단 */}
        <div>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">교사 명단</p>
            <p className="text-[11px] font-black text-blue-500">{filteredList.length}명</p>
          </div>

          {(isAttLoading && attendanceList.length === 0) ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-blue-300" />
            </div>
          ) : filteredList.length === 0 ? (
            <Card className="py-16 text-center flex flex-col items-center gap-3">
              <Users size={32} className="text-gray-100" />
              <p className="text-sm font-black text-gray-300">조건에 맞는 결과가 없습니다</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {sortedGrades.map(grade => (
                <div key={grade} className="flex flex-col gap-2.5">
                  {/* 학년 헤더 */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1 h-3 bg-blue-400 rounded-full" />
                    <p className="text-xs font-black text-gray-900">{grade}</p>
                    <span className="text-[10px] text-gray-400 font-bold">{grouped[grade].length}명</span>
                  </div>

                  {/* 교사 카드 */}
                  <div className="flex flex-col gap-2">
                    {grouped[grade].map((item, idx) => (
                      <motion.div
                        key={item.teacherId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <Card className={`px-4 py-3.5 transition-all ${
                          item.satStatus === 'ATTEND' ? 'border-emerald-100 bg-emerald-50/20' :
                          item.satStatus === 'ABSENT' ? 'border-red-100 bg-red-50/20' :
                                                        'border-gray-100'
                        }`}>
                          <div className="flex items-center justify-between gap-3">
                            {/* 아바타 + 이름/학년 */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm ${
                                item.satStatus === 'ATTEND' ? 'bg-emerald-100 text-emerald-600' :
                                item.satStatus === 'ABSENT' ? 'bg-red-100 text-red-600' :
                                                              'bg-gray-100 text-gray-400'
                              }`}>
                                {item.teacherName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                    {item.displayGrade}
                                  </span>
                                  <span className="font-black text-gray-900 text-sm truncate">{item.teacherName}</span>
                                </div>

                                {/* 참석 상태 텍스트 */}
                                <p className={`text-[10px] font-black ${
                                  item.satStatus === 'ATTEND'     ? 'text-emerald-500' :
                                  item.satStatus === 'ABSENT'     ? 'text-red-400' :
                                                                    'text-gray-300'
                                }`}>
                                  {item.satStatus === 'ATTEND' ? '✅ 참석' :
                                   item.satStatus === 'ABSENT' ? '❌ 불참' : '미제출'}
                                </p>

                                {/* 불참 사유 */}
                                {item.satReason && (
                                  <p className="text-[10px] text-gray-400 font-medium line-clamp-1 mt-0.5">
                                    사유: {item.satReason}
                                  </p>
                                )}

                                {/* 불참 시 영상 확인 상태 */}
                                {item.satStatus === 'ABSENT' && (
                                  <div className={`flex items-center gap-1 mt-1 text-[10px] font-black ${
                                    item.minuteConfirmed ? 'text-emerald-500' : 'text-amber-500'
                                  }`}>
                                    {item.minuteConfirmed
                                      ? <><CheckCircle2 size={11} /> 회의록 영상 확인 완료</>
                                      : <><Clock size={11} /> 회의록 영상 미확인</>
                                    }
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 상태 아이콘 */}
                            <div className="flex-shrink-0">
                              {item.satStatus === 'ATTEND' && <CheckCircle2 size={20} className="text-emerald-400" />}
                              {item.satStatus === 'ABSENT' && (
                                item.minuteConfirmed
                                  ? <CheckCircle2 size={20} className="text-emerald-400" />
                                  : <XCircle size={20} className="text-red-400" />
                              )}
                              {item.satStatus === 'UNSUBMITTED' && <Clock size={20} className="text-gray-300" />}
                            </div>
                          </div>
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
