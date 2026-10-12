import useToday from '../hooks/useToday'
import EventAttendanceStatus from '../components/calendar/EventAttendanceStatus'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, CheckCircle2, XCircle, Users, PenLine,
  CalendarCheck, UserCheck, ChevronDown, Clock
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import FeatureIcon from '../components/common/FeatureIcon'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { eventApi } from '../api/event'
import useAuthStore from '../store/authStore'
import { isEventAttendanceInactive, assertEventAttendanceOpen, eventAttendanceState, eventAttendanceMessage, eventToday } from '../utils/eventAttendance'
import QueryNotice from '../components/common/QueryNotice'
import { queryReadState, hasQueryData } from '../utils/queryReadState'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import { useStudentAttendanceDraft, useTeacherAttendanceDraft } from '../hooks/useAttendanceDraft'
import { confirmAttendance, studentEventForm, teacherEventForm } from '../utils/attendanceDraft'

const STATUS_LABEL = { PRESENT: '참석', PARTIAL: '부분참석', ABSENT: '불참' }
const STATUS_COLOR = {
  PRESENT: { btn: 'border-secondary-400 bg-secondary-50 text-secondary-700', banner: 'bg-secondary-50 border-secondary-200 text-secondary-700', icon: <CheckCircle2 size={16} className="text-secondary-600" /> },
  PARTIAL: { btn: 'border-amber-400 bg-amber-50 text-amber-700',   banner: 'bg-amber-50 border-amber-200 text-amber-700',   icon: <Clock size={16} className="text-amber-500" /> },
  ABSENT:  { btn: 'border-red-300 bg-red-50 text-red-600',         banner: 'bg-red-50 border-red-200 text-red-600',         icon: <XCircle size={16} className="text-red-500" /> },
}

// ── 교사 본인 출석 체크 섹션 ──────────────────────────────
function TeacherSelfCheck({ event, userId }) {
  const eventId = event.id
  const isUnavailable = isEventAttendanceInactive(event)
  const isMultiDay = event.endDate && event.endDate !== event.eventDate
  const qc = useQueryClient()

  const attendanceQuery = useQuery({
    queryKey: ['event-teacher-attendance', eventId, userId],
    queryFn: () => eventApi.getMyTeacherAttendance(eventId).then(r => r.data),
    enabled: !!userId,
  })
  const myAtt = attendanceQuery.data
  const ready = queryReadState([attendanceQuery]) === 'ready'

  const draft = useTeacherAttendanceDraft(`${eventId}:${userId}:teacher`, myAtt)
  const { pending, setPending, partialFromDate, setPartialFromDate, partialNote, setPartialNote,
    absenceReason, setAbsenceReason, submitted, editing, setEditing } = isUnavailable ? { ...draft, ...teacherEventForm(myAtt) } : draft

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!ready) throw new Error('교사 출석 기록을 불러온 뒤 다시 시도해 주세요.')
      assertEventAttendanceOpen(event)
      const record = { status: pending,
        partialFromDate: pending === 'PARTIAL' ? partialFromDate || null : null,
        partialNote: pending === 'PARTIAL' ? partialNote || null : null,
        absenceReason: pending === 'ABSENT' ? absenceReason || null : null }
      await eventApi.saveTeacherAttendance(eventId, record.status, record.partialFromDate, record.partialNote, record.absenceReason)
      return { record, queryKey: ['event-teacher-attendance', eventId, userId], key: draft.key }
    },
    onSuccess: async ({ record, queryKey, key }) => {
      await confirmAttendance(qc, queryKey, record)
      draft.reset(key)
    },
    onError: (err) => alert(err.response?.data?.message || err.message || '출석을 저장하지 못했어요. 다시 시도해 주세요.'),
  })

  const canSubmit = !isUnavailable && pending &&
    (pending !== 'PARTIAL' || partialFromDate) &&
    (pending !== 'ABSENT'  || absenceReason.trim() !== '')
  const isEditable = (!submitted || editing) && !isUnavailable
  const statusKeys = isMultiDay ? ['PRESENT', 'PARTIAL', 'ABSENT'] : ['PRESENT', 'ABSENT']

  if (!hasQueryData([attendanceQuery])) return <QueryNotice queries={[attendanceQuery]} label="교사 출석 기록" />

  return (
    <div className="flex flex-col gap-3">
      <QueryRefreshNotice queries={[attendanceQuery]} label="교사 출석 기록" />
      <fieldset disabled={!ready || saveMutation.isPending} className="min-w-0 flex flex-col gap-3">
      <p className="ui-section-title px-1">내 출석 체크</p>

      {/* 제출 완료 배너 */}
      {submitted && !editing && pending && (
        <div className={`brand-card flex items-center justify-between px-4 py-3 rounded-2xl border ${STATUS_COLOR[pending]?.banner || 'bg-gray-50 border-gray-200'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {STATUS_COLOR[pending]?.icon}
              <span className="text-xs font-bold">{STATUS_LABEL[pending]}으로 제출 완료</span>
            </div>
            {pending === 'PARTIAL' && (partialFromDate || partialNote) && (
              <p className="text-xs text-gray-500 font-medium pl-6">
                {partialFromDate && `${partialFromDate}부터`}{partialNote && ` · ${partialNote}`}
              </p>
            )}
            {pending === 'ABSENT' && absenceReason && (
              <p className="text-xs text-gray-500 font-medium pl-6">사유: {absenceReason}</p>
            )}
          </div>
          {!isUnavailable && <button onClick={() => setEditing(true)} className="text-xs text-gray-500 font-bold flex items-center gap-1 flex-shrink-0">
            <PenLine size={12} /> 수정
          </button>}
        </div>
      )}

      {/* 상태 선택 버튼 */}
      {isEditable && (
        <div className="flex flex-col gap-3">
          <div className={`grid gap-2 ${statusKeys.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {statusKeys.map(key => (
              <button aria-pressed={pending === key}
                key={key}
                onClick={() => setPending(key)}
                className={`py-3 rounded-2xl border-2 text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] ${
                  pending === key ? STATUS_COLOR[key].btn : 'border-gray-100 bg-gray-50 text-gray-400'
                }`}
              >
                {key === 'PRESENT' && <CheckCircle2 size={15} />}
                {key === 'PARTIAL' && <Clock size={15} />}
                {key === 'ABSENT'  && <XCircle size={15} />}
                {STATUS_LABEL[key]}
              </button>
            ))}
          </div>

          {/* 불참 사유 입력 */}
          {pending === 'ABSENT' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-col gap-2 overflow-hidden"
            >
              <div>
                <label className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1 block">불참 사유 (필수)</label>
                <input
                  type="text"
                  value={absenceReason}
                  onChange={e => setAbsenceReason(e.target.value)}
                  placeholder="불참 사유를 입력해 주세요"
                  className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/30 text-sm font-medium outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
            </motion.div>
          )}

          {/* 부분참석 상세 입력 */}
          {pending === 'PARTIAL' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-col gap-2"
            >
              <div>
                <label className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1 block">참석 시작일 (필수)</label>
                <input
                  type="date"
                  value={partialFromDate}
                  min={event.eventDate}
                  max={event.endDate}
                  onChange={e => setPartialFromDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">세부 시간 / 메모 (선택)</label>
                <input
                  type="text"
                  value={partialNote}
                  onChange={e => setPartialNote(e.target.value)}
                  placeholder="예: 오후 2시부터 참석 가능합니다"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>
            </motion.div>
          )}

          <Button size="lg" onClick={() => saveMutation.mutate()} disabled={!canSubmit || saveMutation.isPending}>
            <UserCheck size={17} />
            {saveMutation.isPending ? '저장 중...' : '내 출석 제출'}
          </Button>
        </div>
      )}
      </fieldset>
    </div>
  )
}

// ── 학생 출석 체크 섹션 ─────────────────────────────────────
function StudentAttendanceCheck({ event, userId }) {
  const eventId  = event.id
  const isUnavailable = isEventAttendanceInactive(event)
  const isMultiDay = event.endDate && event.endDate !== event.eventDate
  const qc = useQueryClient()

  const studentsQuery = useQuery({
    queryKey: ['event-attendance', eventId, userId],
    queryFn: () => eventApi.getMyClassAttendance(eventId).then(r => r.data),
    enabled: !!userId,
  })
  const students = studentsQuery.data || []
  const ready = queryReadState([studentsQuery]) === 'ready'

  const draft = useStudentAttendanceDraft(`${eventId}:${userId}:students`, students)
  const { statusMap, setStatusMap, reasonMap, setReasonMap, partialFromDateMap, setPartialFromDateMap,
    partialNoteMap, setPartialNoteMap, submitted, editing, setEditing } = isUnavailable ? { ...draft, ...studentEventForm(students, undefined, null) } : draft

  const saveMutation = useMutation({
    mutationFn: async (records) => {
      if (!ready) throw new Error('학생 출석 기록을 불러온 뒤 다시 시도해 주세요.')
      assertEventAttendanceOpen(event)
      await eventApi.saveStudentAttendance(eventId, records)
      return { records, queryKey: ['event-attendance', eventId, userId], key: draft.key }
    },
    onSuccess: async ({ records, queryKey, key }) => {
      await confirmAttendance(qc, queryKey, records)
      draft.reset(key)
    },
    onError: (err) => alert('제출 중 오류: ' + (err.response?.data?.message || err.message)),
  })

  const setStatus = (sid, status) => setStatusMap(p => ({ ...p, [sid]: status }))
  const toggleSimple = (sid) => setStatusMap(p => ({ ...p, [sid]: p[sid] === 'PRESENT' ? 'ABSENT' : 'PRESENT' }))

  const handleSubmit = () => {
    if (!ready) return
    const records = Object.entries(statusMap).map(([sid, status]) => ({
      studentId: Number(sid), status,
      absenceReason: status === 'ABSENT' ? (reasonMap[sid] || '') : '',
      partialFromDate: status === 'PARTIAL' ? (partialFromDateMap[sid] || null) : null,
      partialNote:     status === 'PARTIAL' ? (partialNoteMap[sid] || null) : null,
    }))
    saveMutation.mutate(records)
  }

  const presentCount = Object.values(statusMap).filter(s => s === 'PRESENT' || s === 'PARTIAL').length
  const absentCount  = Object.values(statusMap).filter(s => s === 'ABSENT').length
  const isEditable   = (!submitted || editing) && !isUnavailable

  const missingReasons  = students.filter(s => statusMap[s.studentId] === 'ABSENT' && !reasonMap[s.studentId]?.trim())
  const missingPartials = isMultiDay
    ? students.filter(s => statusMap[s.studentId] === 'PARTIAL' && !partialFromDateMap[s.studentId])
    : []
  const canSubmit = isEditable && students.length > 0 && missingReasons.length === 0 && missingPartials.length === 0

  if (!hasQueryData([studentsQuery])) return <QueryNotice queries={[studentsQuery]} label="학생 출석 기록" />

  return (
    <div className="flex flex-col gap-3">
      <QueryRefreshNotice queries={[studentsQuery]} label="학생 출석 기록" />
      <fieldset disabled={!ready || saveMutation.isPending} className="min-w-0 flex flex-col gap-3">
      <p className="ui-section-title px-1">우리 반 학생 출석</p>

      {/* 통계 */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center py-3">
            <p className="text-lg font-bold text-gray-900">{students.length}</p>
            <p className="text-xs font-bold text-gray-400 mt-0.5">전체</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-lg font-bold text-secondary-700">{presentCount}</p>
            <p className="text-xs font-bold text-gray-400 mt-0.5">출석</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-lg font-bold text-red-400">{absentCount}</p>
            <p className="text-xs font-bold text-gray-400 mt-0.5">결석</p>
          </Card>
        </div>
      )}

      {/* 제출 완료 배너 */}
      {submitted && !editing && (
        <div className="brand-card flex items-center justify-between px-4 py-3 bg-secondary-50 rounded-2xl border border-secondary-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-secondary-600" />
            <span className="text-xs font-bold text-secondary-700">출석 체크 제출 완료</span>
          </div>
          {!isUnavailable && <button onClick={() => setEditing(true)} className="text-xs text-secondary-600 font-bold flex items-center gap-1">
            <PenLine size={12} /> 수정
          </button>}
        </div>
      )}

      {/* 학생 목록 */}
      {students.length === 0 ? (
        <Card className="py-8 text-center flex flex-col items-center gap-2">
          <Users size={24} className="text-gray-200" />
          <p className="text-sm font-bold text-gray-400">배정된 학생이 없습니다</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((student, idx) => {
            const sid    = student.studentId
            const status = statusMap[sid]
            return (
              <motion.div key={sid} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: idx * 0.03 }}
                className="flex flex-col gap-1.5"
              >
                {/* 학생 카드 */}
                <div className={`brand-card flex items-center justify-between px-4 py-3 rounded-2xl border-2 ${
                  status === 'PRESENT' ? 'border-secondary-200 bg-secondary-50' :
                  status === 'PARTIAL' ? 'border-amber-200 bg-amber-50' :
                  'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                      status === 'PRESENT' ? 'bg-secondary-200 text-secondary-700' :
                      status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                      'bg-red-200 text-red-700'
                    }`}>{student.studentName[0]}</div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{student.studentName}</p>
                      <p className="text-xs text-gray-400 font-medium">{student.grade}</p>
                    </div>
                  </div>

                  {/* 단일 일정: 클릭 토글 / 다중 일정: 버튼 그룹 */}
                  {isMultiDay && isEditable ? (
                    <div className="flex gap-1">
                      {['PRESENT','PARTIAL','ABSENT'].map(k => (
                        <button aria-pressed={status === k} key={k} onClick={() => setStatus(sid, k)}
                          className={`text-[0.6875rem] font-bold px-2 py-1.5 rounded-lg transition-all ${
                            status === k
                              ? k === 'PRESENT' ? 'bg-secondary-200 text-secondary-800'
                              : k === 'PARTIAL' ? 'bg-amber-200 text-amber-800'
                              : 'bg-red-200 text-red-800'
                              : 'bg-white/70 text-gray-400'
                          }`}>
                          {{ PRESENT:'출석', PARTIAL:'부분', ABSENT:'결석' }[k]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => isEditable && toggleSimple(sid)} disabled={!isEditable}
                      className={`text-xs font-bold flex items-center gap-1 ${
                        status === 'PRESENT' ? 'text-secondary-600' : status === 'PARTIAL' ? 'text-amber-600' : 'text-red-500'
                      } ${!isEditable ? 'cursor-default' : ''}`}>
                      {status === 'PRESENT' ? <><CheckCircle2 size={14} /> 출석</> :
                       status === 'PARTIAL' ? <><Clock size={14} /> 부분참석</> : status === 'ABSENT' ? <><XCircle size={14} /> 결석</> : '미제출'}
                    </button>
                  )}
                </div>

                {/* 결석 사유 */}
                {status === 'ABSENT' && (
                  <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="px-1">
                    <input type="text" value={reasonMap[sid] || ''}
                      onChange={e => setReasonMap(p => ({ ...p, [sid]: e.target.value }))}
                      placeholder="결석 사유를 입력해 주세요 (필수)" disabled={!isEditable}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        isEditable ? 'bg-white border-red-100 focus:border-red-300 outline-none' : 'bg-gray-50 border-gray-100 text-gray-400'
                      }`} />
                  </motion.div>
                )}

                {/* 부분참석 입력 (다중 일정만) */}
                {isMultiDay && status === 'PARTIAL' && (
                  <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="px-1 flex flex-col gap-1.5">
                    <input type="date" value={partialFromDateMap[sid] || ''}
                      min={event.eventDate} max={event.endDate} disabled={!isEditable}
                      onChange={e => setPartialFromDateMap(p => ({ ...p, [sid]: e.target.value }))}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        isEditable ? 'bg-amber-50/40 border-amber-200 focus:ring-2 focus:ring-amber-200 outline-none' : 'bg-gray-50 border-gray-100 text-gray-400'
                      }`} />
                    <input type="text" value={partialNoteMap[sid] || ''}
                      onChange={e => setPartialNoteMap(p => ({ ...p, [sid]: e.target.value }))}
                      placeholder="세부 시간 / 메모 (선택)" disabled={!isEditable}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        isEditable ? 'bg-white border-amber-100 focus:border-amber-300 outline-none' : 'bg-gray-50 border-gray-100 text-gray-400'
                      }`} />
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {/* 제출 버튼 */}
      {isEditable && students.length > 0 && (
        <div className="flex flex-col gap-2">
          {missingReasons.length > 0 && <p className="text-xs font-bold text-red-400 text-center">결석 사유를 모두 입력해 주세요 ({missingReasons.length}명 누락)</p>}
          {missingPartials.length > 0 && <p className="text-xs font-bold text-amber-500 text-center">부분참석 날짜를 모두 입력해 주세요 ({missingPartials.length}명 누락)</p>}
          <Button size="lg" onClick={handleSubmit} disabled={saveMutation.isPending || !canSubmit}>
            <CalendarCheck size={17} />
            {saveMutation.isPending ? '저장 중...' : '학생 출석 제출'}
          </Button>
        </div>
      )}
      </fieldset>
    </div>
  )
}

// ── 행사별 출석 패널 ─────────────────────────────────────
function EventPanel({ event, user }) {
  const isUnavailable = isEventAttendanceInactive(event)
  const needsTeacher = event.attendanceTarget === 'TEACHER_ONLY' || event.attendanceTarget === 'BOTH'
  const needsStudent = !event.attendanceTarget || event.attendanceTarget === 'STUDENT_ONLY' || event.attendanceTarget === 'BOTH'

  return (
    <div className="flex flex-col gap-5 px-4 pb-4 pt-2">
      {isUnavailable && (
        <p role="status" className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
          {eventAttendanceMessage(event)}
        </p>
      )}
      {needsTeacher && <TeacherSelfCheck event={event} userId={user?.id} />}
      {needsTeacher && needsStudent && <div className="border-t border-gray-100" />}
      {needsStudent && <StudentAttendanceCheck event={event} userId={user?.id} />}
    </div>
  )
}

// ── 행사 카드 헤더 (제출 상태 포함) ──────────────────────
function EventCardHeader({ event, userId, isOpen, onToggle }) {
  const isUnavailable = isEventAttendanceInactive(event)
  const needsTeacher = event.attendanceTarget === 'TEACHER_ONLY' || event.attendanceTarget === 'BOTH'
  const needsStudent = !event.attendanceTarget || event.attendanceTarget === 'STUDENT_ONLY' || event.attendanceTarget === 'BOTH'

  const teacherQuery = useQuery({
    queryKey: ['event-teacher-attendance', event.id, userId],
    queryFn: () => eventApi.getMyTeacherAttendance(event.id).then(r => r.data),
    enabled: !!userId && needsTeacher,
    staleTime: 5 * 60 * 1000,
  })

  const studentsQuery = useQuery({
    queryKey: ['event-attendance', event.id, userId],
    queryFn: () => eventApi.getMyClassAttendance(event.id).then(r => r.data),
    enabled: !!userId && needsStudent,
    staleTime: 5 * 60 * 1000,
  })

  const teacherAtt = teacherQuery.data
  const students = studentsQuery.data || []
  const reads = [...(needsTeacher ? [teacherQuery] : []), ...(needsStudent ? [studentsQuery] : [])]
  const readState = queryReadState(reads)
  const teacherDone = !needsTeacher || !!teacherAtt?.status
  const studentDone = !needsStudent || students.length === 0 || students.every(s => s.status)
  const isSubmitted = hasQueryData(reads) && teacherDone && studentDone

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors text-left"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="brand-action-icon w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0">
          <FeatureIcon path="/event-attendance" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-bold text-sm ${isSubmitted ? 'text-secondary-800' : isOpen ? 'text-secondary-800' : 'text-gray-900'}`}>
              {event.title}
            </p>
            {isSubmitted && (
              <span className="text-[0.6875rem] font-bold text-secondary-600 bg-secondary-100 px-1.5 py-0.5 rounded-full">
                제출 완료
              </span>
            )}
            {(readState === 'error' || !hasQueryData(reads)) && <span className="text-xs text-gray-500">
              {readState === 'error' ? '출석 현황 조회 실패 · 펼쳐서 다시 시도' : '출석 현황 확인 중...'}
            </span>}
          </div>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
            {event.startTime && ` · ${event.startTime}`}
            {' · '}
            {event.attendanceTarget === 'TEACHER_ONLY' ? '교사 출석' :
             event.attendanceTarget === 'BOTH'         ? '학생 + 교사' : '학생 출석'}
          </p>
          <EventAttendanceStatus event={event} />
        </div>
      </div>
      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <ChevronDown size={18} className="text-gray-300" />
      </motion.div>
    </button>
  )
}

// ── 메인 페이지 ─────────────────────────��────────────────
export default function EventAttendanceListPage() {
  const today = useToday(eventToday)
  const { user } = useAuthStore()
  const [selectedId, setSelectedId] = useState(null)

  const eventsQuery = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
  })
  const rawEvents = eventsQuery.data || []

  const groups = [
    { state: 'open', label: '접수 중인 행사' },
    { state: 'upcoming', label: '접수 예정인 행사' },
    { state: 'closed', label: '종료된 행사 · 기존 기록 조회' },
  ]
  const events = groups.flatMap(group => rawEvents.filter(e => eventAttendanceState(e, today) === group.state))

  const handleSelect = (id) => setSelectedId(prev => prev === id ? null : id)

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="행사 출석 체크" showBack />

      <div className="px-4 py-5 flex flex-col gap-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">출석 체크가 필요한 행사</p>

        {!hasQueryData([eventsQuery]) && (
          <QueryNotice queries={[eventsQuery]} label="행사 목록" />
        )}
        <div className="space-y-3" hidden={!hasQueryData([eventsQuery])}>
        <QueryRefreshNotice queries={[eventsQuery]} label="행사 목록" />
        {events.length === 0 ? (
          <Card className="py-14 flex flex-col items-center gap-3">
            <Calendar size={32} className="text-gray-200" />
            <p className="text-sm font-bold text-gray-400">출석 체크가 필요한 행사가 없습니다</p>
          </Card>
        ) : (
          events.map((event, idx) => {
            const isOpen = selectedId === event.id
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className={`brand-card rounded-3xl border shadow-sm overflow-hidden ${isEventAttendanceInactive(event, today) ? 'event-inactive' : 'bg-white border-gray-100'}`}
              >
                {(idx === 0 || eventAttendanceState(events[idx - 1], today) !== eventAttendanceState(event, today)) && <p className="border-b border-gray-200 px-4 py-3 text-xs font-semibold">{groups.find(g => g.state === eventAttendanceState(event, today))?.label}</p>}
                {/* 행사 헤더 (클릭으로 펼치기) */}
                <EventCardHeader
                  event={event}
                  userId={user?.id}
                  isOpen={isOpen}
                  onToggle={() => handleSelect(event.id)}
                />

                {/* 출석 체크 패널 */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="border-t border-gray-50" />
                      <fieldset disabled={queryReadState([eventsQuery]) !== 'ready' || isEventAttendanceInactive(event, today)} className="min-w-0">
                        <EventPanel event={event} user={user} />
                      </fieldset>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
        </div>
      </div>
    </div>
  )
}
