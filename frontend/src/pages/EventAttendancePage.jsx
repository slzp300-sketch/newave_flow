import useToday from '../hooks/useToday'
import EventAttendanceStatus from '../components/calendar/EventAttendanceStatus'
import { useId } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Users, PenLine, CalendarCheck, UserCheck, Clock } from 'lucide-react'
import FeatureIcon from '../components/common/FeatureIcon'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { isEventAttendanceInactive, assertEventAttendanceOpen, eventAttendanceState, eventAttendanceMessage, eventAttendanceLabels, eventToday } from '../utils/eventAttendance'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { eventApi } from '../api/event'
import useAuthStore from '../store/authStore'
import QueryNotice from '../components/common/QueryNotice'
import { queryReadState, hasQueryData } from '../utils/queryReadState'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import { useStudentAttendanceDraft, useTeacherAttendanceDraft } from '../hooks/useAttendanceDraft'
import { confirmAttendance, studentEventForm, teacherEventForm } from '../utils/attendanceDraft'

export default function EventAttendancePage() {
  const today = useToday(eventToday)
  const fieldId = useId()
  const { id } = useParams()
  const eventId = Number(id)
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventApi.getEvent(eventId).then(r => r.data),
  })
  const event = eventQuery.data
  const isUnavailable = isEventAttendanceInactive(event)

  const needsStudentCheck = !event || event.attendanceTarget === 'STUDENT_ONLY' || event.attendanceTarget === 'BOTH'
  const needsTeacherCheck = event?.attendanceTarget === 'TEACHER_ONLY' || event?.attendanceTarget === 'BOTH'

  const studentsQuery = useQuery({
    queryKey: ['event-attendance', eventId, user?.id],
    queryFn: () => eventApi.getMyClassAttendance(eventId).then(r => r.data),
    enabled: !!user && !!event && needsStudentCheck,
  })

  const teacherQuery = useQuery({
    queryKey: ['event-teacher-attendance', eventId, user?.id],
    queryFn: () => eventApi.getMyTeacherAttendance(eventId).then(r => r.data),
    enabled: !!user && needsTeacherCheck,
  })
  const students = studentsQuery.data || []
  const myTeacherAttendance = teacherQuery.data
  const reads = [eventQuery, ...(event && needsStudentCheck ? [studentsQuery] : []), ...(needsTeacherCheck ? [teacherQuery] : [])]
  const ready = queryReadState(reads) === 'ready'
  const isLoading = !hasQueryData(reads)

  const isMultiDay = event?.endDate && event.endDate !== event.eventDate

  const studentDraft = useStudentAttendanceDraft(`${eventId}:${user?.id}:students`, students)
  const { statusMap, setStatusMap, reasonMap, setReasonMap, partialFromDateMap, setPartialFromDateMap,
    partialNoteMap, setPartialNoteMap, submitted, editing, setEditing } = isUnavailable ? { ...studentDraft, ...studentEventForm(students, undefined, null) } : studentDraft

  const saveMutation = useMutation({
    mutationFn: async (records) => {
      if (!ready) throw new Error('행사 출석 기록을 불러온 뒤 다시 시도해 주세요.')
      assertEventAttendanceOpen(event)
      await eventApi.saveStudentAttendance(eventId, records)
      return { records, queryKey: ['event-attendance', eventId, user?.id], key: studentDraft.key }
    },
    onSuccess: async ({ records, queryKey, key }) => {
      await confirmAttendance(queryClient, queryKey, records)
      studentDraft.reset(key)
    },
    onError: (err) => {
      console.error(err)
      alert('제출 중 오류가 발생했습니다: ' + (err.response?.data?.message || err.message))
    }
  })

  const teacherDraft = useTeacherAttendanceDraft(`${eventId}:${user?.id}:teacher`, myTeacherAttendance)
  const { pending: pendingTeacherStatus, setPending: setPendingTeacherStatus, partialFromDate, setPartialFromDate,
    partialNote, setPartialNote, absenceReason: teacherAbsenceReason, setAbsenceReason: setTeacherAbsenceReason,
    submitted: teacherSubmitted, editing: teacherEditing, setEditing: setTeacherEditing } = isUnavailable ? { ...teacherDraft, ...teacherEventForm(myTeacherAttendance) } : teacherDraft

  const teacherAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!ready) throw new Error('행사 출석 기록을 불러온 뒤 다시 시도해 주세요.')
      assertEventAttendanceOpen(event)
      const record = { status: pendingTeacherStatus,
        partialFromDate: pendingTeacherStatus === 'PARTIAL' ? partialFromDate || null : null,
        partialNote: pendingTeacherStatus === 'PARTIAL' ? partialNote || null : null,
        absenceReason: pendingTeacherStatus === 'ABSENT' ? teacherAbsenceReason || null : null }
      await eventApi.saveTeacherAttendance(eventId, record.status, record.partialFromDate, record.partialNote, record.absenceReason)
      return { record, queryKey: ['event-teacher-attendance', eventId, user?.id], key: teacherDraft.key }
    },
    onSuccess: async ({ record, queryKey, key }) => {
      await confirmAttendance(queryClient, queryKey, record)
      teacherDraft.reset(key)
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || '제출 중 오류가 발생했습니다.')
    },
  })

  const teacherCanSubmit = pendingTeacherStatus &&
    (pendingTeacherStatus !== 'PARTIAL' || partialFromDate) &&
    (pendingTeacherStatus !== 'ABSENT' || teacherAbsenceReason.trim() !== '')

  // 특정 상태로 직접 설정
  const setStudentStatus = (studentId, status) => {
    setStatusMap(prev => ({ ...prev, [studentId]: status }))
  }

  const handleSubmit = () => {
    if (!ready) return
    const records = Object.entries(statusMap).map(([studentId, status]) => ({
      studentId: Number(studentId),
      status,
      absenceReason:    status === 'ABSENT'  ? (reasonMap[studentId] || '')          : '',
      partialFromDate:  status === 'PARTIAL' ? (partialFromDateMap[studentId] || null) : null,
      partialNote:      status === 'PARTIAL' ? (partialNoteMap[studentId] || null)    : null,
    }))
    saveMutation.mutate(records)
  }

  const presentCount = Object.values(statusMap).filter(s => s === 'PRESENT').length
  const partialCount = Object.values(statusMap).filter(s => s === 'PARTIAL').length
  const absentCount  = Object.values(statusMap).filter(s => s === 'ABSENT').length

  const isEditable   = (!submitted || editing) && !isUnavailable

  const missingReasons  = Object.entries(statusMap).filter(([id, s]) => s === 'ABSENT'  && !reasonMap[id]?.trim())
  const missingPartials = Object.entries(statusMap).filter(([id, s]) => s === 'PARTIAL' && !partialFromDateMap[id])
  const canSubmit = missingReasons.length === 0 && missingPartials.length === 0

  if (!hasQueryData(reads)) return <div className="pb-10">
    <Header title="행사 출석 체크" showBack />
    <div className="p-4"><QueryNotice queries={reads} label="행사 출석 기록" /></div>
  </div>

  return (
    <div className={`flex flex-col min-h-screen pb-10 ${isUnavailable ? 'event-inactive-page' : ''}`}>
      <Header title="행사 출석 체크" showBack />

      {/* 행사 정보 */}
      <div className="px-4 pt-3"><EventAttendanceStatus event={event} today={today} />{isUnavailable && <p role="status" className="mt-2 text-sm text-gray-600">{eventAttendanceMessage(event, today)}</p>}</div>
      {event && (
        <div className="px-4 py-4 glass-effect">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
              <FeatureIcon path="/event-attendance" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{event.title}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {format(new Date(event.eventDate), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                {event.endDate && event.endDate !== event.eventDate &&
                  ` ~ ${format(new Date(event.endDate), 'M월 d일 (EEE)', { locale: ko })}`}
                {event.startTime && ` · ${event.startTime}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-3"><QueryRefreshNotice queries={reads} label="행사 출석 기록" /></div>
      <fieldset disabled={!ready || isUnavailable || saveMutation.isPending || teacherAttendanceMutation.isPending} className="min-w-0 px-4 py-5 flex flex-col gap-4">

        {/* 교사 본인 출석 체크 */}
        {needsTeacherCheck && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <p className="ui-section-title">내 출석 체크</p>
              {event?.attendanceDeadline && (
                <p className={`text-xs font-bold ${isUnavailable ? 'text-red-500' : 'text-amber-500'}`}>
                  {isUnavailable ? eventAttendanceLabels[eventAttendanceState(event)] : `마감: ${format(new Date(event.attendanceDeadline), 'M/d')}`}
                </p>
              )}
            </div>

            {teacherSubmitted && !teacherEditing && pendingTeacherStatus && (
              <div className="flex flex-col gap-1.5">
                <div className={`brand-card flex items-center justify-between px-4 py-3 rounded-2xl border ${
                  pendingTeacherStatus === 'PRESENT' ? 'bg-secondary-50 border-secondary-200' :
                  pendingTeacherStatus === 'PARTIAL' ? 'bg-amber-50 border-amber-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      {pendingTeacherStatus === 'PRESENT' && <CheckCircle2 size={16} className="text-secondary-600" />}
                      {pendingTeacherStatus === 'PARTIAL' && <Clock size={16} className="text-amber-500" />}
                      {pendingTeacherStatus === 'ABSENT'  && <XCircle size={16} className="text-red-500" />}
                      <span className={`text-xs font-bold ${
                        pendingTeacherStatus === 'PRESENT' ? 'text-secondary-700' :
                        pendingTeacherStatus === 'PARTIAL' ? 'text-amber-700' : 'text-red-600'
                      }`}>
                        {{ PRESENT: '참석', PARTIAL: '부분참석', ABSENT: '불참' }[pendingTeacherStatus]}으로 제출 완료
                      </span>
                    </div>
                    {pendingTeacherStatus === 'PARTIAL' && (partialFromDate || partialNote) && (
                      <p className="text-xs text-gray-500 font-medium pl-6">
                        {partialFromDate && `${partialFromDate}부터`}{partialNote && ` · ${partialNote}`}
                      </p>
                    )}
                    {pendingTeacherStatus === 'ABSENT' && teacherAbsenceReason && (
                      <p className="text-xs text-gray-500 font-medium pl-6">
                        사유: {teacherAbsenceReason}
                      </p>
                    )}
                  </div>
                  {!isUnavailable && (
                    <button aria-label="내 행사 출석 수정" onClick={() => setTeacherEditing(true)} className="min-h-11 min-w-11 px-2 text-xs text-gray-500 font-bold flex items-center justify-center gap-1 flex-shrink-0">
                      <PenLine size={12} /> 수정
                    </button>
                  )}
                </div>
                {isUnavailable && (
                  <p className="text-xs font-bold text-red-500 text-right px-1">{eventAttendanceMessage(event)}</p>
                )}
              </div>
            )}

            {(!teacherSubmitted || teacherEditing) && (
              <div className="flex flex-col gap-3">
                {isUnavailable ? (
                  <Card className="bg-red-50 border-red-100 py-4 flex flex-col items-center gap-1">
                    <XCircle size={20} className="text-red-400" />
                    <p className="text-xs font-bold text-red-600">{eventAttendanceMessage(event)}</p>
                  </Card>
                ) : (
                  <>
                    <div className={`grid gap-2 ${isMultiDay ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {(isMultiDay ? ['PRESENT','PARTIAL','ABSENT'] : ['PRESENT','ABSENT']).map(key => (
                        <button aria-pressed={pendingTeacherStatus === key} key={key} onClick={() => setPendingTeacherStatus(key)}
                          className={`py-3 rounded-2xl border-2 text-xs font-bold flex flex-col items-center gap-1 active:scale-[0.98] transition-all ${
                            pendingTeacherStatus === key
                              ? key === 'PRESENT' ? 'border-secondary-400 bg-secondary-50 text-secondary-700'
                              : key === 'PARTIAL' ? 'border-amber-400 bg-amber-50 text-amber-700'
                              : 'border-red-300 bg-red-50 text-red-600'
                              : 'border-gray-100 bg-gray-50 text-gray-400'
                          }`}>
                          {key === 'PRESENT' && <CheckCircle2 size={15} />}
                          {key === 'PARTIAL' && <Clock size={15} />}
                          {key === 'ABSENT'  && <XCircle size={15} />}
                          {{ PRESENT:'참석', PARTIAL:'부분참석', ABSENT:'불참' }[key]}
                        </button>
                      ))}
                    </div>

                    {pendingTeacherStatus === 'PARTIAL' && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="flex flex-col gap-2">
                        <div>
                          <label htmlFor={`${fieldId}-teacher-date`} className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1 block"><span className="sr-only">내 </span>참석 시작일 (필수)</label>
                          <input id={`${fieldId}-teacher-date`} required type="date" value={partialFromDate} min={event?.eventDate} max={event?.endDate}
                            onChange={e => setPartialFromDate(e.target.value)}
                            className="min-h-11 min-w-0 w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300" />
                        </div>
                        <div>
                          <label htmlFor={`${fieldId}-teacher-note`} className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block"><span className="sr-only">내 </span>세부 시간 / 메모 (선택)</label>
                          <input id={`${fieldId}-teacher-note`} type="text" value={partialNote} onChange={e => setPartialNote(e.target.value)}
                            placeholder="예: 오후 2시부터 참석 가능합니다"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-200" />
                        </div>
                      </motion.div>
                    )}

                    {pendingTeacherStatus === 'ABSENT' && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="flex flex-col gap-2">
                        <div>
                          <label htmlFor={`${fieldId}-teacher-reason`} className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1 block"><span className="sr-only">내 </span>불참 사유 (필수)</label>
                          <input id={`${fieldId}-teacher-reason`} required type="text" value={teacherAbsenceReason} onChange={e => setTeacherAbsenceReason(e.target.value)}
                            placeholder="불참 사유를 입력해 주세요"
                            className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/30 text-sm font-medium outline-none focus:ring-2 focus:ring-red-300" />
                        </div>
                      </motion.div>
                    )}

                    <Button size="lg" onClick={() => teacherAttendanceMutation.mutate()}
                      disabled={!teacherCanSubmit || teacherAttendanceMutation.isPending}>
                      <UserCheck size={17} />
                      {teacherAttendanceMutation.isPending ? '저장 중...' : '내 출석 제출'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 학생 출석 섹션 */}
        {needsStudentCheck && (<>

        {/* 통계 */}
        {students.length > 0 && (
          <div className={`grid gap-3 ${isMultiDay ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <Card className="text-center py-3">
              <p className="text-xl font-bold text-gray-900">{students.length}</p>
              <p className="text-xs font-bold text-gray-400 mt-0.5">전체</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-xl font-bold text-secondary-700">{presentCount}</p>
              <p className="text-xs font-bold text-gray-400 mt-0.5">출석</p>
            </Card>
            {isMultiDay && (
              <Card className="text-center py-3">
                <p className="text-xl font-bold text-amber-500">{partialCount}</p>
                <p className="text-xs font-bold text-gray-400 mt-0.5">부분참석</p>
              </Card>
            )}
            <Card className="text-center py-3">
              <p className="text-xl font-bold text-red-400">{absentCount}</p>
              <p className="text-xs font-bold text-gray-400 mt-0.5">결석</p>
            </Card>
          </div>
        )}

        {/* 제출 완료 배너 */}
        {submitted && !editing && (
          <div className="flex flex-col gap-1.5">
            <div className="brand-card flex items-center justify-between px-4 py-3 bg-secondary-50 rounded-2xl border border-secondary-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-secondary-600" />
                <span className="text-xs font-bold text-secondary-700">출석 체크 제출 완료</span>
              </div>
              {!isUnavailable && (
                <button aria-label="학생 행사 출석 수정" onClick={() => setEditing(true)} className="min-h-11 min-w-11 shrink-0 px-2 text-xs text-secondary-600 font-bold flex items-center justify-center gap-1">
                  <PenLine size={12} /> 수정
                </button>
              )}
            </div>
            {isUnavailable && (
              <p className="text-xs font-bold text-red-500 text-right px-1">{eventAttendanceMessage(event)}</p>
            )}
          </div>
        )}

        {/* 학생 목록 */}
        <div>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="ui-section-title">우리 반 학생 출석</p>
            {event?.attendanceDeadline && (
              <p className={`text-xs font-bold ${isUnavailable ? 'text-red-500' : 'text-amber-500'}`}>
                {isUnavailable ? eventAttendanceLabels[eventAttendanceState(event)] : `마감: ${format(new Date(event.attendanceDeadline), 'M/d')}`}
              </p>
            )}
          </div>

          {isLoading ? (
            <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>
          ) : students.length === 0 ? (
            <Card className="py-10 text-center flex flex-col items-center gap-2">
              <Users size={28} className="text-gray-200" />
              <p className="text-sm font-bold text-gray-400">배정된 학생이 없습니다</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((student, idx) => {
                const status = statusMap[student.studentId]
                return (
                  <motion.div
                    key={student.studentId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex flex-col gap-2"
                  >
                    {/* 학생 카드 + 상태 버튼 */}
                    <div className={`brand-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
                      status === 'PRESENT' ? 'border-secondary-200 bg-secondary-50' :
                      status === 'PARTIAL' ? 'border-amber-200 bg-amber-50' :
                                             'border-red-200 bg-red-50'
                    }`}>
                      {/* 학생 정보 */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                          status === 'PRESENT' ? 'bg-secondary-200 text-secondary-700' :
                          status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                                                 'bg-red-200 text-red-700'
                        }`}>
                          {student.studentName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{student.studentName}</p>
                          <p className="text-xs text-gray-400 font-medium">{student.grade}</p>
                        </div>
                      </div>

                      {/* 상태 버튼 */}
                      {isEditable && (
                        <div className="ml-auto flex flex-wrap gap-1.5">
                          <button
                            aria-label={`${student.studentName} 행사 참석`} aria-pressed={status === 'PRESENT'}
                            onClick={() => setStudentStatus(student.studentId, 'PRESENT')}
                            className={`min-h-11 min-w-11 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              status === 'PRESENT'
                                ? 'border-secondary-600 bg-secondary-600 text-white'
                                : 'border-gray-100 bg-white text-gray-400'
                            }`}
                          >
                            <CheckCircle2 size={12} className="inline mr-0.5" />참석
                          </button>
                          {isMultiDay && (
                            <button
                              aria-label={`${student.studentName} 행사 부분참석`} aria-pressed={status === 'PARTIAL'}
                              onClick={() => setStudentStatus(student.studentId, 'PARTIAL')}
                              className={`min-h-11 min-w-11 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                status === 'PARTIAL'
                                  ? 'border-amber-400 bg-amber-500 text-white'
                                  : 'border-gray-100 bg-white text-gray-400'
                              }`}
                            >
                              <Clock size={12} className="inline mr-0.5" />부분
                            </button>
                          )}
                          <button
                            aria-label={`${student.studentName} 행사 결석`} aria-pressed={status === 'ABSENT'}
                            onClick={() => setStudentStatus(student.studentId, 'ABSENT')}
                            className={`min-h-11 min-w-11 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              status === 'ABSENT'
                                ? 'border-red-400 bg-red-500 text-white'
                                : 'border-gray-100 bg-white text-gray-400'
                            }`}
                          >
                            <XCircle size={12} className="inline mr-0.5" />결석
                          </button>
                        </div>
                      )}

                      {/* 보기 전용 상태 */}
                      {!isEditable && (
                        <div className={`flex items-center gap-1.5 text-xs font-bold ${
                          status === 'PRESENT' ? 'text-secondary-600' :
                          status === 'PARTIAL' ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {status === 'PRESENT' && <><CheckCircle2 size={16} /> 출석</>}
                          {status === 'PARTIAL' && <><Clock size={16} /> 부분참석</>}
                          {status === 'ABSENT'  && <><XCircle size={16} /> 결석</>}
                          {!status && <span className="text-gray-500">미제출</span>}
                        </div>
                      )}
                    </div>

                    {/* 결석 사유 */}
                    <AnimatePresence>
                      {status === 'ABSENT' && (
                        <motion.div
                          key="absent-reason"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-1 overflow-hidden"
                        >
                          <input
                            type="text"
                            aria-label={`${student.studentName} 결석 사유 (필수)`} required
                            value={reasonMap[student.studentId] || ''}
                            onChange={e => setReasonMap(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                            placeholder="결석 사유를 입력해 주세요 (필수)"
                            disabled={!isEditable}
                            className={`w-full px-4 py-3 rounded-xl text-xs font-medium border transition-all ${
                              isEditable
                                ? 'bg-white border-red-100 focus:border-red-300 focus:ring-4 focus:ring-red-50 outline-none'
                                : 'bg-gray-50 border-gray-100 text-gray-400'
                            }`}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 부분참석 정보 입력 */}
                    <AnimatePresence>
                      {status === 'PARTIAL' && (
                        <motion.div
                          key="partial-info"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-1 flex flex-col gap-2 overflow-hidden"
                        >
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor={`${fieldId}-student-${student.studentId}-date`} className="text-xs font-bold text-amber-600 uppercase tracking-widest">
                              <span className="sr-only">{student.studentName} </span>
                              참석 시작일 (필수)
                            </label>
                            <input
                              id={`${fieldId}-student-${student.studentId}-date`} required
                              type="date"
                              value={partialFromDateMap[student.studentId] || ''}
                              onChange={e => setPartialFromDateMap(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                              min={event?.eventDate}
                              max={event?.endDate}
                              disabled={!isEditable}
                              className={`min-h-11 min-w-0 w-full px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                                isEditable
                                  ? 'bg-white border-amber-200 focus:ring-2 focus:ring-amber-300 outline-none'
                                  : 'bg-gray-50 border-gray-100 text-gray-400'
                              }`}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor={`${fieldId}-student-${student.studentId}-note`} className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                              <span className="sr-only">{student.studentName} </span>
                              메모 (선택)
                            </label>
                            <input
                              id={`${fieldId}-student-${student.studentId}-note`}
                              type="text"
                              value={partialNoteMap[student.studentId] || ''}
                              onChange={e => setPartialNoteMap(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                              placeholder="예: 오후 2시부터 참석"
                              disabled={!isEditable}
                              className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                                isEditable
                                  ? 'bg-white border-amber-100 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 outline-none'
                                  : 'bg-gray-50 border-gray-100 text-gray-400'
                              }`}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* 제출 버튼 */}
        {isEditable && students.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            {isUnavailable ? (
              <Card className="bg-red-50 border-red-100 py-4 flex flex-col items-center gap-1">
                <XCircle size={20} className="text-red-400" />
                <p className="text-xs font-bold text-red-600">{eventAttendanceMessage(event)}</p>
              </Card>
            ) : (
              <>
                {!canSubmit && students.length > 0 && (
                  <p className="text-xs font-bold text-red-400 text-center">
                    {missingReasons.length > 0 && `결석 사유를 입력해 주세요 (${missingReasons.length}명)`}
                    {missingReasons.length > 0 && missingPartials.length > 0 && ' · '}
                    {missingPartials.length > 0 && `부분참석 시작일을 입력해 주세요 (${missingPartials.length}명)`}
                  </p>
                )}
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={saveMutation.isPending || (isEditable && !canSubmit)}
                >
                  <CalendarCheck size={17} />
                  {saveMutation.isPending ? '저장 중...' : '학생 출석 제출'}
                </Button>
              </>
            )}
          </div>
        )}

        </>)}
      </fieldset>
    </div>
  )
}
