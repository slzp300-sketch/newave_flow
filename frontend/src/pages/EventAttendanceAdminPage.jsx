import { useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { eventApi } from '../api/event'
import { Users, CheckCircle2, XCircle, Calendar, UserCheck, ChevronRight, Clock } from 'lucide-react'

const GRADE_STYLES = {
  '중1': { bg: 'bg-rose-50', text: 'text-rose-600', accent: 'bg-rose-100', progress: 'bg-rose-400', border: 'hover:border-rose-200', btn: 'text-rose-600 bg-rose-50' },
  '중2': { bg: 'bg-orange-50', text: 'text-orange-600', accent: 'bg-orange-100', progress: 'bg-orange-400', border: 'hover:border-orange-200', btn: 'text-orange-600 bg-orange-50' },
  '중3': { bg: 'bg-amber-50', text: 'text-amber-600', accent: 'bg-amber-100', progress: 'bg-amber-400', border: 'hover:border-amber-200', btn: 'text-amber-600 bg-amber-50' },
  '고1': { bg: 'bg-emerald-50', text: 'text-emerald-600', accent: 'bg-emerald-100', progress: 'bg-emerald-400', border: 'hover:border-emerald-200', btn: 'text-emerald-600 bg-emerald-50' },
  '고2': { bg: 'bg-blue-50', text: 'text-blue-600', accent: 'bg-blue-100', progress: 'bg-blue-400', border: 'hover:border-blue-200', btn: 'text-blue-600 bg-blue-50' },
  '고3': { bg: 'bg-violet-50', text: 'text-violet-600', accent: 'bg-violet-100', progress: 'bg-violet-400', border: 'hover:border-violet-200', btn: 'text-violet-600 bg-violet-50' },
  '미배정': { bg: 'bg-gray-50', text: 'text-gray-600', accent: 'bg-gray-100', progress: 'bg-gray-400', border: 'hover:border-gray-200', btn: 'text-gray-600 bg-gray-50' },
  '기타': { bg: 'bg-gray-50', text: 'text-gray-600', accent: 'bg-gray-100', progress: 'bg-gray-400', border: 'hover:border-gray-200', btn: 'text-gray-600 bg-gray-50' },
}

const getGradeStyle = (grade) => {
  if (!grade) return GRADE_STYLES['미배정']
  const key = Object.keys(GRADE_STYLES).find(k => grade.startsWith(k))
  return GRADE_STYLES[key] || GRADE_STYLES['기타']
}

export default function EventAttendanceAdminPage() {
  const [selectedEventId, setSelectedEventId] = usePersistedState('selectedEventId', null)
  const [selectedGrade, setSelectedGrade] = usePersistedState('selectedGrade', null)
  const [selectedTeacherGrade, setSelectedTeacherGrade] = usePersistedState('selectedTeacherGrade', null)
  const [expandedClassId, setExpandedClassId] = usePersistedState('expandedClassId', null)
  const [activeTab, setActiveTab] = usePersistedState('activeTab', 'student')

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
  })

  const { data: summary = [], isLoading: summaryLoading } = useQuery({
    queryKey: ['attendance-summary', selectedEventId],
    queryFn: () => eventApi.getAttendanceSummary(selectedEventId).then(r => r.data),
    enabled: !!selectedEventId,
  })

  const { data: teacherSummary = [], isLoading: teacherSummaryLoading } = useQuery({
    queryKey: ['teacher-attendance-summary', selectedEventId],
    queryFn: () => eventApi.getTeacherAttendanceSummary(selectedEventId).then(r => r.data),
    enabled: !!selectedEventId,
  })

  const selectedEvent = events.find(e => e.id === selectedEventId)
  const showTeacherTab = selectedEvent?.attendanceTarget === 'TEACHER_ONLY'
    || selectedEvent?.attendanceTarget === 'BOTH'
    || teacherSummary.some(t => t.status !== null)   // 실제 제출 데이터가 있으면 탭 표시
  const showStudentTab = !selectedEvent || selectedEvent?.attendanceTarget === 'STUDENT_ONLY' || selectedEvent?.attendanceTarget === 'BOTH'

  const totalStudents     = summary.reduce((acc, c) => acc + Number(c.totalCount), 0)
  const totalPresent      = summary.reduce((acc, c) => acc + Number(c.presentCount), 0)
  const totalAbsent       = summary.reduce((acc, c) => acc + Number(c.absentCount), 0)
  const totalUnsubmitted  = totalStudents - totalPresent - totalAbsent

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

      <div className="px-4 py-5 flex flex-col gap-5">

        {/* 행사 선택 */}
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">행사 선택</p>
          {eventsLoading ? (
            <div className="text-sm text-gray-400 px-1">불러오는 중...</div>
          ) : events.length === 0 ? (
            <Card className="py-8 text-center text-sm text-gray-400">출석 체크 활성화된 행사가 없습니다</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map(event => (
                <button
                  key={event.id}
                  onClick={() => handleEventSelect(event.id)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                    selectedEventId === event.id
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={16} className={selectedEventId === event.id ? 'text-emerald-600' : 'text-gray-400'} />
                    <div>
                      <p className={`font-black text-sm ${selectedEventId === event.id ? 'text-emerald-800' : 'text-gray-900'}`}>
                        {event.title}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                      </p>
                    </div>
                  </div>
                  {selectedEventId === event.id && <CheckCircle2 size={16} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 선택된 행사 결과 */}
        {selectedEventId && (
          <>
            {/* 탭 (학생/교사) */}
            {showStudentTab && showTeacherTab && (
              <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                <button
                  onClick={() => { setActiveTab('student'); setSelectedGrade(null) }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'student' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <Users size={13} /> 학생 출석
                </button>
                <button
                  onClick={() => { setActiveTab('teacher'); setSelectedTeacherGrade(null) }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'teacher' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <UserCheck size={13} /> 교사 출석
                </button>
              </div>
            )}

            {/* 교사 출석 탭 */}
            {activeTab === 'teacher' && showTeacherTab && (
              <>
                {/* 전체 통계 */}
                <div className="grid grid-cols-4 gap-2">
                  <Card className="text-center py-3">
                    <p className="text-xl font-black text-gray-900">{teacherSummary.length}</p>
                    <p className="text-[9px] font-black text-gray-400 mt-0.5">전체</p>
                  </Card>
                  <Card className="text-center py-3">
                    <p className="text-xl font-black text-emerald-500">{teacherSummary.filter(t => t.status === 'PRESENT').length}</p>
                    <p className="text-[9px] font-black text-gray-400 mt-0.5">참석</p>
                  </Card>
                  <Card className="text-center py-3">
                    <p className="text-xl font-black text-amber-500">{teacherSummary.filter(t => t.status === 'PARTIAL').length}</p>
                    <p className="text-[9px] font-black text-gray-400 mt-0.5">부분참석</p>
                  </Card>
                  <Card className="text-center py-3">
                    <p className="text-xl font-black text-red-400">{teacherSummary.filter(t => t.status === 'ABSENT').length}</p>
                    <p className="text-[9px] font-black text-gray-400 mt-0.5">불참</p>
                  </Card>
                </div>

                {teacherSummaryLoading ? (
                  <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
                ) : teacherSummary.length === 0 ? (
                  <Card className="py-10 text-center flex flex-col items-center gap-2">
                    <UserCheck size={28} className="text-gray-200" />
                    <p className="text-sm font-black text-gray-400">아직 제출된 출석 데이터가 없습니다</p>
                  </Card>
                ) : !selectedTeacherGrade ? (
                  /* 학년 카드 뷰 */
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">학년별 현황</p>
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
                            <p className="font-black text-gray-900 text-lg leading-tight">{g.grade}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1">
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
                        className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl active:scale-95 transition-all ${getGradeStyle(selectedTeacherGrade).btn}`}
                      >
                        ← {selectedTeacherGrade} 전체
                      </button>
                      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">교사 현황</p>
                    </div>

                    <Card className="flex flex-col gap-1.5 p-3">
                      {currentTeacherGradeData?.teachers.map((teacher, idx) => (
                        <motion.div
                          key={teacher.teacherId}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={`flex items-start justify-between px-3 py-2.5 rounded-2xl ${
                            teacher.status === 'PRESENT' ? 'bg-emerald-50/60' :
                            teacher.status === 'PARTIAL' ? 'bg-amber-50/60' :
                            teacher.status === 'ABSENT'  ? 'bg-red-50/60' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              teacher.status === 'PRESENT' ? 'bg-emerald-200 text-emerald-700' :
                              teacher.status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                              teacher.status === 'ABSENT'  ? 'bg-red-200 text-red-700' :
                              'bg-gray-200 text-gray-500'
                            }`}>{(teacher.teacherName || '?')[0]}</span>
                            <div>
                              <p className="text-sm font-black text-gray-800">{teacher.teacherName}</p>
                              {teacher.grade && <p className="text-[10px] text-gray-400 font-medium">{teacher.grade}</p>}
                              {teacher.status === 'PARTIAL' && (teacher.partialFromDate || teacher.partialNote) && (
                                <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                                  {teacher.partialFromDate && `${teacher.partialFromDate}부터`}
                                  {teacher.partialNote && ` · ${teacher.partialNote}`}
                                </p>
                              )}
                              {teacher.status === 'ABSENT' && teacher.absenceReason && (
                                <p className="text-[10px] text-red-400 font-medium mt-0.5">
                                  사유: {teacher.absenceReason}
                                </p>
                              )}
                            </div>
                          </div>
                          {teacher.status === 'PRESENT' ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" /> :
                           teacher.status === 'PARTIAL' ? <span className="text-[10px] text-amber-600 font-black flex-shrink-0">부분참석</span> :
                           teacher.status === 'ABSENT'  ? <XCircle size={16} className="text-red-400 flex-shrink-0" /> :
                           <span className="text-[10px] text-gray-400 font-bold flex-shrink-0">미제출</span>}
                        </motion.div>
                      ))}
                    </Card>
                  </div>
                )}
              </>
            )}

            {/* 학생 출석 탭 */}
            {activeTab === 'student' && showStudentTab && (<>
            {/* 전체 통계 */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="text-center py-4">
                <p className="text-xl font-black text-gray-900">{totalStudents}</p>
                <p className="text-[9px] font-black text-gray-400 mt-1 uppercase tracking-wider">전체</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-xl font-black text-emerald-500">{summary.reduce((acc, c) => acc + c.records.filter(r => r.status === 'PRESENT').length, 0)}</p>
                <p className="text-[9px] font-black text-gray-400 mt-1 uppercase tracking-wider">출석</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-xl font-black text-red-400">{totalAbsent}</p>
                <p className="text-[9px] font-black text-gray-400 mt-1 uppercase tracking-wider">결석</p>
              </Card>
              <Card className="text-center py-4">
                <p className={`text-xl font-black ${totalUnsubmitted > 0 ? 'text-orange-400' : 'text-gray-300'}`}>{totalUnsubmitted}</p>
                <p className="text-[9px] font-black text-gray-400 mt-1 uppercase tracking-wider">미제출</p>
              </Card>
            </div>

            {/* 학년/반별 계층 결과 */}
            {summaryLoading ? (
              <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
            ) : summary.length === 0 ? (
              <Card className="py-10 text-center flex flex-col items-center gap-2">
                <Users size={28} className="text-gray-200" />
                <p className="text-sm font-black text-gray-400">아직 제출된 출석 데이터가 없습니다</p>
              </Card>
            ) : !selectedGrade ? (
              /* 학년 목록 뷰 */
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">학년별 현황</p>
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
                        <p className="font-black text-gray-900 text-lg leading-tight">{g.grade}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1">
                          {g.presentCount} / {g.totalCount} 출석
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
                    className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl active:scale-95 transition-all ${getGradeStyle(selectedGrade).btn}`}
                  >
                    ← {selectedGrade} 전체
                  </button>
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">반별 현황</p>
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
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedClassId(expandedClassId === cls.classGroupId ? null : cls.classGroupId)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-primary-50 flex items-center justify-center">
                            <Users size={18} className="text-primary-600" />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-base">{cls.classGroupName}</p>
                            <p className="text-[10px] text-gray-400 font-bold">
                              {cls.presentCount}명 출석
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
                      </div>

                      {/* 진행률 바 */}
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${cls.totalCount > 0 ? (cls.presentCount / cls.totalCount) * 100 : 0}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full bg-emerald-400 rounded-full"
                        />
                      </div>

                      {/* 학생 목록 (확대 시에만 표시) */}
                      {expandedClassId === cls.classGroupId && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          {cls.records.map(student => (
                            <div
                              key={student.studentId}
                              className={`flex items-start justify-between px-3 py-2.5 rounded-2xl ${
                                student.status === 'PRESENT' ? 'bg-emerald-50/50' :
                                student.status === 'PARTIAL' ? 'bg-amber-50/50' :
                                student.status === 'ABSENT'  ? 'bg-red-50/50' :
                                'bg-gray-50/80'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black w-6 h-6 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                  student.status === 'PRESENT' ? 'bg-emerald-200 text-emerald-700' :
                                  student.status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                                  student.status === 'ABSENT'  ? 'bg-red-200 text-red-700' :
                                  'bg-gray-200 text-gray-500'
                                }`}>{student.studentName[0]}</span>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-gray-700">{student.studentName}</span>
                                  {student.status === 'ABSENT' && student.absenceReason && (
                                    <p className="text-[10px] text-red-400 font-medium mt-0.5 leading-tight">
                                      사유: {student.absenceReason}
                                    </p>
                                  )}
                                  {student.status === 'PARTIAL' && (student.partialFromDate || student.partialNote) && (
                                    <p className="text-[10px] text-amber-600 font-medium mt-0.5 leading-tight">
                                      {student.partialFromDate && `${student.partialFromDate}부터`}
                                      {student.partialNote && ` · ${student.partialNote}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {student.status === 'PRESENT' ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" /> :
                               student.status === 'PARTIAL' ? <Clock size={16} className="text-amber-500 flex-shrink-0" /> :
                               student.status === 'ABSENT'  ? <XCircle size={16} className="text-red-400 flex-shrink-0" /> :
                               <span className="text-[10px] text-orange-400 font-black flex-shrink-0">미제출</span>
                              }
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
            </>)}

          </>
        )}
      </div>
    </div>
  )
}
