import AppSelect from '../components/common/AppSelect'
import Button from '../components/common/Button'
import GradeAttendanceList from '../components/common/GradeAttendanceList'
import './AdminMeetingAttendancePage.css'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { FilterResults } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import AdminReadGuard from '../components/common/AdminReadGuard'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
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

function minuteLabel(item, hasMinute) {
  if (item.satStatus === 'ATTEND') return '참석자 · 확인 면제'
  if (!hasMinute) return '회의록 미등록'
  return item.minuteConfirmed ? '회의록 확인 완료' : '회의록 미확인'
}

export default function AdminMeetingAttendancePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const weeks = getPastSaturdays()
  const [selectedDate, setSelectedDate] = useState(weeks[0])
  const [statusFilter, setStatusFilter] = useState('전체')
  const [activeGrade, setActiveGrade] = useState('전체')

  // ── 토요 교사회의 참석 데이터
  const attendanceQuery = useQuery({
    queryKey: ['admin-meeting-attendance', selectedDate],
    queryFn: () => client.get(`/meetings/attendance/admin?date=${selectedDate}`).then(r => r.data),
    refetchInterval: 60000,
    refetchOnWindowFocus: 'always',
  })
  const { data: attendanceList = [], isRefetching: isAttRefetching } = attendanceQuery

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

  const isRefetching = isAttRefetching || isMinuteRefetching || teachersQuery.isFetching || minutesQuery.isFetching

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-meeting-attendance', selectedDate] })
    queryClient.invalidateQueries({ queryKey: ['admin-minutes-all'] })
    queryClient.invalidateQueries({ queryKey: ['admin-teachers-active'] })
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
      (statusFilter === '미응답' && item.satStatus === 'UNSUBMITTED')
    return gradeMatch && statusMatch && matchesAdminSearch(search, item.teacherName, item.displayGrade)
  })

  // ── 통계 (전체 기준)
  const countAttend = fullList.filter(i => i.satStatus === 'ATTEND').length
  const countAbsent = fullList.filter(i => i.satStatus === 'ABSENT').length
  const countAbsentConfirmed = fullList.filter(i => i.satStatus === 'ABSENT' && i.minuteConfirmed).length

  return <div className="admin-meeting-attendance-page">
    <Header title="교사회의 관리" showBack />
    <div className="meeting-admin-body">
      <section>
        <div className="meeting-admin-heading"><h2 className="ui-section-title">회의 일자</h2>
          <Button variant="secondary" size="sm" aria-label="교사회의 현황 새로 확인" disabled={isRefetching} onClick={handleRefetch}>새로고침</Button>
        </div>
        <AppSelect aria-label="교사회의 일자" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setActiveGrade('전체') }} className="meeting-date-select">
          {weeks.map(week => <option key={week} value={week}>{format(new Date(week + 'T00:00:00'), 'yyyy년 M월 d일')} 토요일</option>)}
        </AppSelect>
      </section>
      <AdminReadGuard queries={[attendanceQuery, teachersQuery, minutesQuery, ...(targetMinute ? [minuteStatusQuery] : [])]} label="교사회의 참석 현황" reserveStatusSpace={false}>
        <section aria-label="교사회의 요약" className="meeting-admin-summary">
          <dl className="ui-metrics meeting-counts">
            {[
              ['참석', countAttend], ['불참', countAbsent],
              ['미응답', fullList.filter(row => row.satStatus === 'UNSUBMITTED').length],
              ['불참자 회의록 확인', targetMinute ? countAbsentConfirmed : '—'],
            ].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count}{count !== '—' && <small>명</small>}</dd></div>)}
          </dl>
          {!targetMinute && <p className="meeting-help">회의록 미등록</p>}
        </section>
        <section className="meeting-admin-roster" aria-label="교사회의 명단">
          <h2 className="ui-section-title">교사 명단</h2>
          <SegmentedControl label="교사회의 참석 상태" value={statusFilter} onChange={setStatusFilter}
            options={['전체', '참석', '불참', '미응답'].map(value => ({ value, label: value }))} />
          <div className="meeting-list-filters">
            <SearchField label="회의 참석 교사 검색" value={search} onChange={setSearch} placeholder="이름·학년 검색" />
            <AppSelect aria-label="명단 학년" value={activeGrade} onChange={e => setActiveGrade(e.target.value)}>
              {[...new Set([...availableGrades, activeGrade])].map(grade => <option key={grade} value={grade}>{grade === '전체' ? '전체 학년' : grade}</option>)}
            </AppSelect>
          </div>
          <FilterResults count={filteredList.length} total={fullList.length} filtered={!!search.trim() || activeGrade !== '전체' || statusFilter !== '전체'}
            onReset={() => { setSearch(''); setActiveGrade('전체'); setStatusFilter('전체') }} />
          {filteredList.length ? <GradeAttendanceList key={selectedDate} rows={filteredList.map(row => ({ ...row, status: row.satStatus }))} renderDetails={person => <>
            <div><dt>응답</dt><dd>{person.satStatus === 'ATTEND' ? '참석' : person.satStatus === 'ABSENT' ? '불참' : '미응답'}</dd></div>
            {person.satStatus === 'ABSENT' && <div><dt>불참 사유</dt><dd>{person.satReason || '미입력'}</dd></div>}
            {['ATTEND', 'ABSENT'].includes(person.satStatus) && <div><dt>회의록</dt><dd>{minuteLabel(person, !!targetMinute)}</dd></div>}
            {person.satUpdatedAt && <div><dt>수정 일시</dt><dd>{formatUpdatedAt(person.satUpdatedAt)}</dd></div>}
          </>} /> : <p className="meeting-empty" role="status">조건에 맞는 교사가 없습니다.</p>}
        </section>
      </AdminReadGuard>
    </div>
  </div>
}
