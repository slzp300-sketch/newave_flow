import EventStatusSummary from '../components/common/EventStatusSummary'
import { Collapse } from '../components/common/Motion'
import SearchField from '../components/common/SearchField'
import useToday from '../hooks/useToday'
import { eventToday, isEventAttendanceInactive } from '../utils/eventAttendance'
import EventAttendanceStatus from '../components/calendar/EventAttendanceStatus'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminIntro, FilterResults } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import { useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import QueryNotice from '../components/common/QueryNotice'
import { queryReadState } from '../utils/queryReadState'
import { eventApi } from '../api/event'
import { Users, CheckCircle2, XCircle, Calendar, UserCheck, Clock } from 'lucide-react'

const GRADE_STYLES = {
  '중1': { bg: 'bg-rose-50', text: 'text-rose-600', accent: 'bg-rose-100', progress: 'bg-rose-400', border: 'hover:border-rose-200', btn: 'text-rose-600 bg-rose-50' },
  '중2': { bg: 'bg-orange-50', text: 'text-orange-600', accent: 'bg-orange-100', progress: 'bg-orange-400', border: 'hover:border-orange-200', btn: 'text-orange-600 bg-orange-50' },
  '중3': { bg: 'bg-amber-50', text: 'text-amber-600', accent: 'bg-amber-100', progress: 'bg-amber-400', border: 'hover:border-amber-200', btn: 'text-amber-600 bg-amber-50' },
  '고1': { bg: 'bg-secondary-50', text: 'text-secondary-600', accent: 'bg-secondary-100', progress: 'bg-secondary-400', border: 'hover:border-secondary-200', btn: 'text-secondary-600 bg-secondary-50' },
  '고2': { bg: 'bg-primary-50', text: 'text-primary-600', accent: 'bg-primary-100', progress: 'bg-primary-400', border: 'hover:border-primary-200', btn: 'text-primary-600 bg-primary-50' },
  '고3': { bg: 'bg-primary-50', text: 'text-primary-600', accent: 'bg-primary-100', progress: 'bg-primary-400', border: 'hover:border-primary-200', btn: 'text-primary-600 bg-primary-50' },
  '미배정': { bg: 'bg-gray-50', text: 'text-gray-600', accent: 'bg-gray-100', progress: 'bg-gray-400', border: 'hover:border-gray-200', btn: 'text-gray-600 bg-gray-50' },
  '기타': { bg: 'bg-gray-50', text: 'text-gray-600', accent: 'bg-gray-100', progress: 'bg-gray-400', border: 'hover:border-gray-200', btn: 'text-gray-600 bg-gray-50' },
}

const getGradeStyle = (grade) => {
  if (!grade) return GRADE_STYLES['미배정']
  const key = Object.keys(GRADE_STYLES).find(k => grade.startsWith(k))
  return GRADE_STYLES[key] || GRADE_STYLES['기타']
}

export default function EventAttendanceAdminPage() {
  const today = useToday(eventToday)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-event-attendance', 'large')
  const [selectedEventId, setSelectedEventId] = usePersistedState('selectedEventId', null)
  const [selectedGrade, setSelectedGrade] = usePersistedState('selectedGrade', null)
  const [selectedTeacherGrade, setSelectedTeacherGrade] = usePersistedState('selectedTeacherGrade', null)
  const [expandedClassId, setExpandedClassId] = usePersistedState('expandedClassId', null)
  const [activeTab, setActiveTab] = usePersistedState('activeTab', 'student')

  const eventsQuery = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
  })

  const summaryQuery = useQuery({
    queryKey: ['attendance-summary', selectedEventId],
    queryFn: () => eventApi.getAttendanceSummary(selectedEventId).then(r => r.data),
    enabled: !!selectedEventId,
  })

  const teacherSummaryQuery = useQuery({
    queryKey: ['teacher-attendance-summary', selectedEventId],
    queryFn: () => eventApi.getTeacherAttendanceSummary(selectedEventId).then(r => r.data),
    enabled: !!selectedEventId,
  })
  const events = eventsQuery.data || []
  const summary = summaryQuery.data || []
  const teacherSummary = teacherSummaryQuery.data || []
  const summaryLoading = !summaryQuery.isSuccess
  const teacherSummaryLoading = !teacherSummaryQuery.isSuccess
  const detailReads = activeTab === 'teacher' ? [teacherSummaryQuery] : [summaryQuery]

  const selectedEvent = events.find(e => e.id === selectedEventId)
  const showTeacherTab = selectedEvent?.attendanceTarget === 'TEACHER_ONLY'
    || selectedEvent?.attendanceTarget === 'BOTH'
    || teacherSummary.some(t => t.status !== null)   // 실제 제출 데이터가 있으면 탭 표시
  const showStudentTab = !selectedEvent || selectedEvent?.attendanceTarget === 'STUDENT_ONLY' || selectedEvent?.attendanceTarget === 'BOTH'
    || summary.some(group => group.records.some(record => record.status != null))

  const totalStudents     = summary.reduce((acc, c) => acc + Number(c.totalCount), 0)

  // 학년별 그룹화 데이터 가공
  const gradeSummary = summary.reduce((acc, cls) => {
    // 반에 속한 첫 번째 학생의 학년을 기준으로 학년 분류 (데이터가 없는 경우 '기타')
    const grade = cls.records[0]?.grade || '기타'
    if (!acc[grade]) {
      acc[grade] = {
        grade,
        totalCount: 0,
        presentCount: 0,
        absentCount: 0,
        classes: []
      }
    }
    acc[grade].totalCount += cls.totalCount
    acc[grade].presentCount += cls.presentCount
    acc[grade].absentCount += cls.absentCount
    acc[grade].classes.push(cls)
    return acc
  }, {})

  const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3']
  const gradeList = Object.values(gradeSummary).sort((a, b) => {
    const idxA = GRADE_ORDER.findIndex(g => a.grade.startsWith(g))
    const idxB = GRADE_ORDER.findIndex(g => b.grade.startsWith(g))
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.grade.localeCompare(b.grade)
  })
  const currentGradeData = selectedGrade ? gradeSummary[selectedGrade] : null

  const TEACHER_GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3', '미배정']

  // 교사 학년별 그룹화
  const teacherGradeSummary = teacherSummary.reduce((acc, t) => {
    let rawGrade = t.grade?.trim() || '미배정'
    let g = rawGrade
    
    // '중1-1' 또는 '중등1부' 등에서 '중1' 형태만 추출하여 그룹화
    if (g !== '미배정') {
      const match = g.match(/^[중고][123]/)
      if (match) {
        g = match[0]
      }
    }

    if (!acc[g]) acc[g] = { grade: g, total: 0, present: 0, absent: 0, teachers: [] }
    acc[g].total++
    if (t.status === 'PRESENT') acc[g].present++
    if (t.status === 'ABSENT')  acc[g].absent++
    acc[g].teachers.push(t)
    return acc
  }, {})

  const teacherGradeList = Object.values(teacherGradeSummary).sort((a, b) => {
    const ai = TEACHER_GRADE_ORDER.indexOf(a.grade)
    const bi = TEACHER_GRADE_ORDER.indexOf(b.grade)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.grade.localeCompare(b.grade)
  })

  const currentTeacherGradeData = selectedTeacherGrade ? teacherGradeSummary[selectedTeacherGrade] : null
  const studentRows = (selectedGrade ? currentGradeData?.classes || [] : summary)
    .flatMap(cls => cls.records.map(row => ({ ...row, className: cls.classGroupName })))
  const teacherRows = selectedTeacherGrade ? currentTeacherGradeData?.teachers || [] : teacherSummary
  const attendanceLabel = status => ({ PRESENT: '참석', PARTIAL: '부분참석', ABSENT: '불참' }[status] || '미제출')

  // 행사 선택 시 상태 초기화
  const handleEventSelect = (id) => {
    if (selectedEventId === id) {
      setSelectedEventId(null)
    } else {
      setSelectedEventId(id)
      const ev = events.find(e => e.id === id)
      setActiveTab(ev?.attendanceTarget === 'TEACHER_ONLY' ? 'teacher' : 'student')
    }
    setSelectedGrade(null)
    setSelectedTeacherGrade(null)
    setExpandedClassId(null)
  }

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="행사 출석 현황" showBack />
      <p className="px-4 pt-3 text-xs text-gray-500">명단은 출석 행사 등록 시점을 기준으로 보존됩니다. 이전 행사는 데이터 전환 시점의 명단이 기준입니다.</p>

      <div className="px-4 py-5 flex flex-col gap-5">

        <AdminIntro title="행사별 참여를 살펴보세요" description="행사를 선택한 뒤 학년과 반을 눌러 상세 명단을 확인하세요." />
        <SearchField label="출석 행사 검색" value={search} onChange={setSearch} placeholder="행사 이름 또는 날짜 검색" />
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        {viewMode !== 'large' && (activeTab === 'teacher' ? selectedTeacherGrade : selectedGrade) && <button type="button" className="min-h-11 self-start px-3 text-xs font-semibold text-primary-700"
          onClick={() => activeTab === 'teacher' ? setSelectedTeacherGrade(null) : setSelectedGrade(null)}>학년 선택 해제 · 전체 명단 보기</button>}
        {/* 행사 선택 */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">행사 선택</p>
          {queryReadState([eventsQuery]) !== 'ready' ? (
            <QueryNotice queries={[eventsQuery]} label="행사 목록" />
          ) : events.length === 0 ? (
            <Card className="py-8 text-center text-sm text-gray-400">출석 체크 활성화된 행사가 없습니다</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {events.filter(event => matchesAdminSearch(search, event.title, event.eventDate)).map(event => (
                <button
                  key={event.id}
                  aria-pressed={selectedEventId === event.id}
                  onClick={() => handleEventSelect(event.id)}
                  className={`${isEventAttendanceInactive(event, today) ? 'event-inactive' : ''} flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                    selectedEventId === event.id
                      ? 'border-secondary-300 bg-secondary-50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={16} className={selectedEventId === event.id ? 'text-secondary-600' : 'text-gray-400'} />
                    <div>
                      <p className={`font-bold text-sm ${selectedEventId === event.id ? 'text-secondary-800' : 'text-gray-900'}`}>
                        {event.title}
                      </p>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                      </p>
                      <EventAttendanceStatus event={event} today={today} />
                    </div>
                  </div>
                  {selectedEventId === event.id && <CheckCircle2 size={16} className="text-secondary-700" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {!!search.trim() && <FilterResults count={events.filter(event => matchesAdminSearch(search, event.title, event.eventDate)).length} total={events.length} unit="개" filtered onReset={() => setSearch('')} />}
        {selectedEvent && <p className="text-sm font-semibold text-gray-700">조회 중: {selectedEvent.title}</p>}
        {/* 선택된 행사 결과 */}
        {selectedEvent && queryReadState([eventsQuery]) === 'ready' && (
          <>
            {/* 탭 (학생/교사) */}
            {showStudentTab && showTeacherTab && (
              <SegmentedControl label="행사 출석 대상" value={activeTab}
                onChange={value => { setActiveTab(value); setSelectedGrade(null); setSelectedTeacherGrade(null) }} selectedClassName="text-gray-900"
                options={[{ value: 'student', label: '학생 출석' }, { value: 'teacher', label: '교사 출석' }]} />
            )}

            {/* 교사 출석 탭 */}
            {queryReadState(detailReads) !== 'ready' && <QueryNotice queries={detailReads} label="행사 출석 기록" />}
            {queryReadState(detailReads) === 'ready' && activeTab === 'teacher' && showTeacherTab && (
              <>
                {/* 전체 통계 */}
                <EventStatusSummary records={teacherSummary} total={teacherSummary.length} />

                <RecordViews mode={viewMode} rows={teacherRows} rowKey={row => row.teacherId} columns={[
                  { label: '교사', render: row => row.teacherName },
                  { label: '학년', render: row => row.grade },
                  { label: '참석', render: row => attendanceLabel(row.status) },
                  { label: '불참 사유', render: row => row.absenceReason },
                  { label: '부분참석 시작', render: row => row.partialFromDate },
                  { label: '부분참석 메모', render: row => row.partialNote },
                ]}>
                {teacherSummaryLoading ? (
                  <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
                ) : teacherSummary.length === 0 ? (
                  <Card className="py-10 text-center flex flex-col items-center gap-2">
                    <UserCheck size={28} className="text-gray-200" />
                    <p className="text-sm font-bold text-gray-400">아직 제출된 출석 데이터가 없습니다</p>
                  </Card>
                ) : !selectedTeacherGrade ? (
                  /* 학년 카드 뷰 */
                  <div className="flex flex-col gap-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">학년별 현황</p>
                    <div className="grid grid-cols-2 gap-3">
                      {teacherGradeList.map((g, idx) => (
                        <motion.button
                          key={g.grade}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => setSelectedTeacherGrade(g.grade)}
                          className={`glass-card p-5 rounded-3xl flex flex-col items-center gap-2 border-2 border-transparent transition-all active:scale-95 text-center ${getGradeStyle(g.grade).border}`}
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-1 ${getGradeStyle(g.grade).accent} ${getGradeStyle(g.grade).text}`}>
                            <UserCheck size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg leading-tight">{g.grade}</p>
                            <p className="text-xs text-gray-400 font-bold mt-1">
                              {g.present} / {g.total} 참석
                            </p>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${getGradeStyle(g.grade).progress}`}
                              style={{ width: `${g.total > 0 ? (g.present / g.total) * 100 : 0}%` }}
                            />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* 선택된 학년의 교사 목록 뷰 */
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-1">
                      <button
                        onClick={() => setSelectedTeacherGrade(null)}
                        className={`flex min-h-11 items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all ${getGradeStyle(selectedTeacherGrade).btn}`}
                      >
                        ← {selectedTeacherGrade} 전체
                      </button>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">교사 현황</p>
                    </div>

                    <Card className="flex flex-col gap-1.5 p-3">
                      {currentTeacherGradeData?.teachers.map((teacher, idx) => (
                        <motion.div
                          key={teacher.teacherId}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={`brand-card flex items-start justify-between px-3 py-2.5 rounded-2xl ${
                            teacher.status === 'PRESENT' ? 'bg-secondary-50/60' :
                            teacher.status === 'PARTIAL' ? 'bg-amber-50/60' :
                            teacher.status === 'ABSENT'  ? 'bg-red-50/60' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              teacher.status === 'PRESENT' ? 'bg-secondary-200 text-secondary-700' :
                              teacher.status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                              teacher.status === 'ABSENT'  ? 'bg-red-200 text-red-700' :
                              'bg-gray-200 text-gray-500'
                            }`}>{(teacher.teacherName || '?')[0]}</span>
                            <div>
                              <p className="text-sm font-bold text-gray-800">{teacher.teacherName}</p>
                              {teacher.grade && <p className="text-xs text-gray-400 font-medium">{teacher.grade}</p>}
                              {teacher.status === 'PARTIAL' && (teacher.partialFromDate || teacher.partialNote) && (
                                <p className="text-xs text-amber-600 font-medium mt-0.5">
                                  {teacher.partialFromDate && `${teacher.partialFromDate}부터`}
                                  {teacher.partialNote && ` · ${teacher.partialNote}`}
                                </p>
                              )}
                              {teacher.status === 'ABSENT' && teacher.absenceReason && (
                                <p className="text-xs text-red-400 font-medium mt-0.5">
                                  사유: {teacher.absenceReason}
                                </p>
                              )}
                            </div>
                          </div>
                          {teacher.status === 'PRESENT' ? <CheckCircle2 size={16} className="text-secondary-700 flex-shrink-0" /> :
                           teacher.status === 'PARTIAL' ? <span className="text-xs text-amber-600 font-bold flex-shrink-0">부분참석</span> :
                           teacher.status === 'ABSENT'  ? <XCircle size={16} className="text-red-400 flex-shrink-0" /> :
                           <span className="text-xs text-gray-400 font-bold flex-shrink-0">미제출</span>}
                        </motion.div>
                      ))}
                    </Card>
                  </div>
                )}
                </RecordViews>
              </>
            )}

            {/* 학생 출석 탭 */}
            {queryReadState(detailReads) === 'ready' && activeTab === 'student' && showStudentTab && (<>
            {/* 전체 통계 */}
            <EventStatusSummary records={summary.flatMap(cls => cls.records)} total={totalStudents} />

            {/* 학년/반별 계층 결과 */}
            <RecordViews mode={viewMode} rows={studentRows} rowKey={row => row.studentId} columns={[
              { label: '학생', render: row => row.studentName },
              { label: '학년', render: row => row.grade },
              { label: '반', render: row => row.className },
              { label: '참석', render: row => attendanceLabel(row.status) },
              { label: '불참 사유', render: row => row.absenceReason },
              { label: '부분참석 시작', render: row => row.partialFromDate },
              { label: '부분참석 메모', render: row => row.partialNote },
            ]}>
            {summaryLoading ? (
              <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
            ) : summary.length === 0 ? (
              <Card className="py-10 text-center flex flex-col items-center gap-2">
                <Users size={28} className="text-gray-200" />
                <p className="text-sm font-bold text-gray-400">아직 제출된 출석 데이터가 없습니다</p>
              </Card>
            ) : !selectedGrade ? (
              /* 학년 목록 뷰 */
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">학년별 현황</p>
                <div className="grid grid-cols-2 gap-3">
                  {gradeList.map((g, idx) => (
                    <motion.button
                      key={g.grade}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedGrade(g.grade)}
                      className={`glass-card p-5 rounded-3xl flex flex-col items-center gap-2 border-2 border-transparent transition-all active:scale-95 text-center ${getGradeStyle(g.grade).border}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-1 ${getGradeStyle(g.grade).accent} ${getGradeStyle(g.grade).text}`}>
                        <Users size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg leading-tight">{g.grade}</p>
                        <p className="text-xs text-gray-400 font-bold mt-1">
                          {g.presentCount} / {g.totalCount} 참석 (부분 포함)
                        </p>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-full ${getGradeStyle(g.grade).progress}`}
                          style={{ width: `${(g.presentCount / g.totalCount) * 100}%` }}
                        />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              /* 선택된 학년의 반 목록 뷰 */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <button 
                    onClick={() => setSelectedGrade(null)}
                    className={`flex min-h-11 items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all ${getGradeStyle(selectedGrade).btn}`}
                  >
                    ← {selectedGrade} 전체
                  </button>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">반별 현황</p>
                </div>

                {currentGradeData.classes.map((cls, idx) => (
                  <motion.div
                    key={cls.classGroupId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="flex flex-col gap-4">
                      {/* 반 헤더 */}
                      <button type="button" aria-expanded={expandedClassId === cls.classGroupId}
                        className="flex min-h-11 w-full items-center justify-between text-left"
                        onClick={() => setExpandedClassId(expandedClassId === cls.classGroupId ? null : cls.classGroupId)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-primary-50 flex items-center justify-center">
                            <Users size={18} className="text-primary-600" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-base">{cls.classGroupName}</p>
                            <p className="text-xs text-gray-400 font-bold">
                              {cls.presentCount}명 참석 (부분 포함)
                              {cls.records.filter(r => r.status === 'PARTIAL').length > 0 &&
                                ` · ${cls.records.filter(r => r.status === 'PARTIAL').length}명 부분참석`}
                              {' · '}{cls.absentCount}명 결석
                              {(cls.totalCount - cls.presentCount - cls.absentCount) > 0 &&
                                ` · ${cls.totalCount - cls.presentCount - cls.absentCount}명 미제출`}
                            </p>
                          </div>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                          {expandedClassId === cls.classGroupId ? '▲' : '▼'}
                        </div>
                      </button>

                      {/* 진행률 바 */}
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${cls.totalCount > 0 ? (cls.presentCount / cls.totalCount) * 100 : 0}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-secondary-400 rounded-full"
                        />
                      </div>

                      {/* 학생 목록 (확대 시에만 표시) */}
                      <Collapse open={expandedClassId === cls.classGroupId}>
                        <div className="flex flex-col gap-1.5 pt-1">
                          {cls.records.map(student => (
                            <div
                              key={student.studentId}
                              className={`brand-card flex items-start justify-between px-3 py-2.5 rounded-2xl ${
                                student.status === 'PRESENT' ? 'bg-secondary-50/50' :
                                student.status === 'PARTIAL' ? 'bg-amber-50/50' :
                                student.status === 'ABSENT'  ? 'bg-red-50/50' :
                                'bg-gray-50/80'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold w-6 h-6 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  student.status === 'PRESENT' ? 'bg-secondary-200 text-secondary-700' :
                                  student.status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                                  student.status === 'ABSENT'  ? 'bg-red-200 text-red-700' :
                                  'bg-gray-200 text-gray-500'
                                }`}>{student.studentName[0]}</span>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-gray-700">{student.studentName}</span>
                                  {student.status === 'ABSENT' && student.absenceReason && (
                                    <p className="text-xs text-red-400 font-medium mt-0.5 leading-tight">
                                      사유: {student.absenceReason}
                                    </p>
                                  )}
                                  {student.status === 'PARTIAL' && (student.partialFromDate || student.partialNote) && (
                                    <p className="text-xs text-amber-600 font-medium mt-0.5 leading-tight">
                                      {student.partialFromDate && `${student.partialFromDate}부터`}
                                      {student.partialNote && ` · ${student.partialNote}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {student.status === 'PRESENT' ? <CheckCircle2 size={16} className="text-secondary-700 flex-shrink-0" /> :
                               student.status === 'PARTIAL' ? <Clock size={16} className="text-amber-500 flex-shrink-0" /> :
                               student.status === 'ABSENT'  ? <XCircle size={16} className="text-red-400 flex-shrink-0" /> :
                               <span className="text-xs text-orange-400 font-bold flex-shrink-0">미제출</span>
                              }
                            </div>
                          ))}
                        </div>
                      </Collapse>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
            </RecordViews>
            </>)}

          </>
        )}
      </div>
    </div>
  )
}
