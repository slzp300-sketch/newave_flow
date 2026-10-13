import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminIntro, FilterResults } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import AdminReadGuard from '../components/common/AdminReadGuard'
import { useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, Loader2, CheckCircle2, XCircle, RefreshCw, Clock } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import client from '../api/client'
import { format, addDays } from 'date-fns'
import { formatUpdatedAt } from '../utils/date'

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
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-meeting-attendance', 'large')
  const weeks = getPastSaturdays()
  const [selectedDate, setSelectedDate] = useState(weeks[0])
  const [statusFilter, setStatusFilter] = usePersistedState('statusFilter', '전체')
  const [activeGrade, setActiveGrade] = usePersistedState('activeGrade', '전체')

  // ── 토요 교사회의 참석 데이터
  const attendanceQuery = useQuery({
    queryKey: ['admin-meeting-attendance', selectedDate],
    queryFn: () => client.get(`/meetings/attendance/admin?date=${selectedDate}`).then(r => r.data),
    refetchInterval: 60000,
    refetchOnWindowFocus: 'always',
  })
  const { data: attendanceList = [], isLoading: isAttLoading, isRefetching: isAttRefetching } = attendanceQuery

  // ── 전체 교사 명단
  const teachersQuery = useQuery({
    queryKey: ['admin-teachers-active'],
    queryFn: () => client.get('/users/teachers').then(r => r.data),
  })
  const { data: teachers = [] } = teachersQuery

  // ── 회의록 확인 상태
  const minutesQuery = useQuery({
    queryKey: ['admin-minutes-all'],
    queryFn: () => client.get('/minutes').then(r => r.data),
    refetchInterval: 60000,
  })
  const { data: allMinutes = [] } = minutesQuery

  // selectedDate는 토요일 → 해당 주(일~토) 범위 안의 활성 회의록을 찾음
  const weekStart = format(addDays(new Date(selectedDate + 'T00:00:00'), -6), 'yyyy-MM-dd')
  const targetMinute = allMinutes.find(m => m.isActive && m.meetingDate >= weekStart && m.meetingDate <= selectedDate)

  const minuteStatusQuery = useQuery({
    queryKey: ['admin-minute-status', targetMinute?.id],
    queryFn: () => client.get(`/minutes/${targetMinute.id}/status`).then(r => r.data),
    enabled: !!targetMinute,
    refetchInterval: 60000,
  })
  const { data: minuteStatusList = [], isRefetching: isMinuteRefetching } = minuteStatusQuery

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
      satUpdatedAt: att?.updatedAt || null,
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
      (statusFilter === '불참' && item.satStatus === 'ABSENT') ||
      (statusFilter === '미제출' && item.satStatus === 'UNSUBMITTED')
    return gradeMatch && statusMatch && matchesAdminSearch(search, item.teacherName, item.displayGrade)
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
            aria-label="교사회의 현황 새로 확인"
            disabled={isRefetching}
            onClick={handleRefetch}
            className={`p-2 rounded-full transition-all ${isRefetching ? 'text-primary-500' : 'text-gray-400 hover:bg-gray-100'}`}
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

        <AdminIntro title="교사회의 참석 현황" description="날짜를 고른 뒤 학년·참석 상태로 필요한 명단을 확인하세요." />
        {/* 날짜 선택 */}
        <section>
          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">회의 일자 (토요일 기준)</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary-500 animate-pulse" />
              <p className="text-xs font-bold text-gray-400">1분마다 확인</p>
            </div>
          </div>
          <select aria-label="교사회의 일자"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setActiveGrade('전체') }}
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm font-bold text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-primary-200"
          >
            {weeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </section>

        <AdminReadGuard queries={[attendanceQuery, teachersQuery, minutesQuery, ...(targetMinute ? [minuteStatusQuery] : [])]} label="교사회의 참석 현황">
        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-4 border-secondary-50 bg-secondary-50/30">
            <p className="text-xl font-bold text-secondary-700">{countAttend}</p>
            <p className="text-xs font-bold text-gray-400 uppercase mt-1">참석</p>
          </Card>
          <Card className="text-center py-4 border-red-50 bg-red-50/30">
            <p className="text-xl font-bold text-red-500">{countAbsent}</p>
            <p className="text-xs font-bold text-gray-400 uppercase mt-1">불참</p>
          </Card>
          <Card className="text-center py-4 border-primary-50 bg-primary-50/30">
            <p className="text-xl font-bold text-primary-500">{countAbsentConfirmed}</p>
            <p className="text-xs font-bold text-gray-400 uppercase mt-1">영상확인</p>
          </Card>
        </div>

        {/* 필터 섹션 */}
        <section className="flex flex-col gap-3">
          {/* 학년 필터 (가로 스크롤) */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1">
            {availableGrades.map(g => (
              <button
                key={g}
                aria-pressed={activeGrade === g}
                onClick={() => setActiveGrade(g)}
                className={`flex-shrink-0 min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeGrade === g
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-white border border-gray-100 text-gray-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <SegmentedControl label="교사회의 참석 상태" value={statusFilter} onChange={setStatusFilter} selectedClassName="text-primary-600"
            options={['전체', '참석', '불참', '미제출'].map(value => ({ value, label: value }))} />
          <SearchField label="회의 참석 교사 검색" value={search} onChange={setSearch} placeholder="교사 이름 또는 학년 검색" />
          <FilterResults count={filteredList.length} total={fullList.length} filtered={!!search.trim() || activeGrade !== '전체' || statusFilter !== '전체'} onReset={() => { setSearch(''); setActiveGrade('전체'); setStatusFilter('전체') }} />
        </section>

        {/* 교사 명단 */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">교사 명단</p>
            <p className="text-xs font-bold text-primary-500">{filteredList.length}명</p>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {(isAttLoading && attendanceList.length === 0) ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-primary-300" />
            </div>
          ) : filteredList.length === 0 ? (
            <Card className="py-16 text-center flex flex-col items-center gap-3">
              <Users size={32} className="text-gray-100" />
              <p className="text-sm font-bold text-gray-300">조건에 맞는 결과가 없습니다</p>
            </Card>
          ) : (
            <RecordViews mode={viewMode} rows={filteredList} rowKey={row => row.teacherId} columns={[
              { label: '교사', render: row => row.teacherName },
              { label: '학년', render: row => row.displayGrade },
              { label: '참석', render: row => row.satStatus === 'ATTEND' ? '참석' : row.satStatus === 'ABSENT' ? '불참' : '미제출' },
              { label: '불참 사유', render: row => row.satReason || '—' },
              { label: '회의록 확인', render: row => row.satStatus === 'ATTEND' ? '참석자(면제)' : row.minuteConfirmed ? '확인 완료' : '미확인' },
              { label: '마지막 수정', render: row => formatUpdatedAt(row.satUpdatedAt) },
            ]}>
            <div className="flex flex-col gap-6">
              {sortedGrades.map(grade => (
                <div key={grade} className="flex flex-col gap-2.5">
                  {/* 학년 헤더 */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1 h-3 bg-primary-400 rounded-full" />
                    <p className="text-xs font-bold text-gray-900">{grade}</p>
                    <span className="text-xs text-gray-400 font-bold">{grouped[grade].length}명</span>
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
                          item.satStatus === 'ATTEND' ? 'border-secondary-100 bg-secondary-50/20' :
                          item.satStatus === 'ABSENT' ? 'border-red-100 bg-red-50/20' :
                                                        'border-gray-100'
                        }`}>
                          <div className="flex items-center justify-between gap-3">
                            {/* 아바타 + 이름/학년 */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                                item.satStatus === 'ATTEND' ? 'bg-secondary-100 text-secondary-600' :
                                item.satStatus === 'ABSENT' ? 'bg-red-100 text-red-600' :
                                                              'bg-gray-100 text-gray-400'
                              }`}>
                                {item.teacherName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                    {item.displayGrade}
                                  </span>
                                  <span className="font-bold text-gray-900 text-sm truncate">{item.teacherName}</span>
                                </div>

                                {/* 참석 상태 텍스트 */}
                                <p className={`text-xs font-bold ${
                                  item.satStatus === 'ATTEND'     ? 'text-secondary-700' :
                                  item.satStatus === 'ABSENT'     ? 'text-red-400' :
                                                                    'text-gray-300'
                                }`}>
                                  {item.satStatus === 'ATTEND' ? '✅ 참석' :
                                   item.satStatus === 'ABSENT' ? '❌ 불참' : '미제출'}
                                  {item.satUpdatedAt && <span className="text-gray-300 font-bold"> · 마지막 수정 {formatUpdatedAt(item.satUpdatedAt)}</span>}
                                </p>

                                {/* 불참 사유 */}
                                {item.satReason && (
                                  <p className="text-xs text-gray-400 font-medium line-clamp-1 mt-0.5">
                                    사유: {item.satReason}
                                  </p>
                                )}

                                {/* 불참 시 영상 확인 상태 */}
                                {item.satStatus === 'ABSENT' && (
                                  <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${
                                    item.minuteConfirmed ? 'text-secondary-700' : 'text-amber-500'
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
                              {item.satStatus === 'ATTEND' && <CheckCircle2 size={20} className="text-secondary-400" />}
                              {item.satStatus === 'ABSENT' && (
                                item.minuteConfirmed
                                  ? <CheckCircle2 size={20} className="text-secondary-400" />
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
            </RecordViews>
          )}
        </div>
        </AdminReadGuard>
      </div>
    </div>
  )
}
