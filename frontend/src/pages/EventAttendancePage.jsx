import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Calendar, Users, PenLine, CalendarCheck, UserCheck, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toApiDate } from '../utils/date'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { eventApi } from '../api/event'
import useAuthStore from '../store/authStore'

export default function EventAttendancePage() {
  const { id } = useParams()
  const eventId = Number(id)
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventApi.getEvent(eventId).then(r => r.data),
  })

  const needsStudentCheck = !event || event.attendanceTarget === 'STUDENT_ONLY' || event.attendanceTarget === 'BOTH'
  const needsTeacherCheck = event?.attendanceTarget === 'TEACHER_ONLY' || event?.attendanceTarget === 'BOTH'

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['event-attendance', eventId, user?.id],
    queryFn: () => eventApi.getMyClassAttendance(eventId).then(r => r.data),
    enabled: !!user && needsStudentCheck,
  })

  const { data: myTeacherAttendance } = useQuery({
    queryKey: ['event-teacher-attendance', eventId, user?.id],
    queryFn: () => eventApi.getMyTeacherAttendance(eventId).then(r => r.data),
    enabled: !!user && needsTeacherCheck,
  })

  const isMultiDay = event?.endDate && event.endDate !== event.eventDate

  // 학생 출석 상태 맵
  const [statusMap,          setStatusMap]          = useState({})
  const [reasonMap,          setReasonMap]          = useState({})
  const [partialFromDateMap, setPartialFromDateMap] = useState({})
  const [partialNoteMap,     setPartialNoteMap]     = useState({})
  const [submitted,          setSubmitted]          = useState(false)
  const [editing,            setEditing]            = useState(false)

  // 기존 데이터로 초기화
  useEffect(() => {
    if (students.length > 0) {
      const sMap = {}, rMap = {}, pDateMap = {}, pNoteMap = {}
      let hasAny = false
      students.forEach(s => {
        if (s.status) {
          sMap[s.studentId]     = s.status
          rMap[s.studentId]     = s.absenceReason || ''
          pDateMap[s.studentId] = s.partialFromDate || ''
          pNoteMap[s.studentId] = s.partialNote || ''
          hasAny = true
        } else {
          sMap[s.studentId]     = 'PRESENT'
          rMap[s.studentId]     = ''
          pDateMap[s.studentId] = ''
          pNoteMap[s.studentId] = ''
        }
      })
      setStatusMap(sMap)
      setReasonMap(rMap)
      setPartialFromDateMap(pDateMap)
      setPartialNoteMap(pNoteMap)
      if (hasAny) setSubmitted(true)
    }
  }, [students])

  const saveMutation = useMutation({
    mutationFn: (records) => eventApi.saveStudentAttendance(eventId, records),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-attendance', eventId, user?.id] })
      setSubmitted(true)
      setEditing(false)
    },
    onError: (err) => {
      console.error(err)
      alert('제출 중 오류가 발생했습니다: ' + (err.response?.data?.message || err.message))
    }
  })

  // 교사 출석 상태
  const [pendingTeacherStatus, setPendingTeacherStatus] = useState(null)
  const [partialFromDate,       setPartialFromDate]      = useState('')
  const [partialNote,           setPartialNote]          = useState('')
  const [teacherAbsenceReason,  setTeacherAbsenceReason] = useState('')
  const [teacherSubmitted,      setTeacherSubmitted]     = useState(false)
  const [teacherEditing,        setTeacherEditing]       = useState(false)

  useEffect(() => {
    if (myTeacherAttendance?.status) {
      setPendingTeacherStatus(myTeacherAttendance.status)
      setPartialFromDate(myTeacherAttendance.partialFromDate || '')
      setPartialNote(myTeacherAttendance.partialNote || '')
      setTeacherAbsenceReason(myTeacherAttendance.absenceReason || '')
      setTeacherSubmitted(true)
    }
  }, [myTeacherAttendance])

  const teacherAttendanceMutation = useMutation({
    mutationFn: () => eventApi.saveTeacherAttendance(
      eventId, pendingTeacherStatus,
      pendingTeacherStatus === 'PARTIAL' ? partialFromDate || null : null,
      pendingTeacherStatus === 'PARTIAL' ? partialNote || null : null,
      pendingTeacherStatus === 'ABSENT' ? teacherAbsenceReason || null : null
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-teacher-attendance', eventId, user?.id] })
      setTeacherSubmitted(true)
      setTeacherEditing(false)
    },
  })

  const teacherCanSubmit = pendingTeacherStatus &&
    (pendingTeacherStatus !== 'PARTIAL' || partialFromDate) &&
    (pendingTeacherStatus !== 'ABSENT' || teacherAbsenceReason.trim() !== '')

  // 학생 상태 설정 (3단 순환: PRESENT → PARTIAL → ABSENT, 단일 행사면 2단)
  const cycleStatus = (studentId) => {
    setStatusMap(prev => {
      const cur = prev[studentId] || 'PRESENT'
      let next
      if (isMultiDay) {
        next = cur === 'PRESENT' ? 'PARTIAL' : cur === 'PARTIAL' ? 'ABSENT' : 'PRESENT'
      } else {
        next = cur === 'PRESENT' ? 'ABSENT' : 'PRESENT'
      }
      return { ...prev, [studentId]: next }
    })
  }

  // 특정 상태로 직접 설정
  const setStudentStatus = (studentId, status) => {
    setStatusMap(prev => ({ ...prev, [studentId]: status }))
  }

  const handleSubmit = () => {
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
  const isEditable   = !submitted || editing

  const todayDateStr = toApiDate(new Date())
  const isPastDeadline = event?.attendanceDeadline && todayDateStr > event?.attendanceDeadline

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="행사 출석 체크" showBack />

      {/* 행사 정보 */}
      {event && (
        <div className="px-4 py-4 glass-effect">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">{event.title}</p>
              <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                {format(new Date(event.eventDate), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                {event.endDate && event.endDate !== event.eventDate &&
                  ` ~ ${format(new Date(event.endDate), 'M월 d일 (EEE)', { locale: ko })}`}
                {event.startTime && ` · ${event.startTime}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-5 flex flex-col gap-4">

        {/* 교사 본인 출석 체크 */}
        {needsTeacherCheck && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">내 출석 체크</p>
              {event?.attendanceDeadline && (
                <p className={`text-[10px] font-bold ${isPastDeadline ? 'text-red-500' : 'text-amber-500'}`}>
                  {isPastDeadline ? '제출 마감됨' : `마감: ${format(new Date(event.attendanceDeadline), 'M/d')}`}
                </p>
              )}
            </div>

            {teacherSubmitted && !teacherEditing && pendingTeacherStatus && (
              <div className="flex flex-col gap-1.5">
                <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${
                  pendingTeacherStatus === 'PRESENT' ? 'bg-emerald-50 border-emerald-200' :
                  pendingTeacherStatus === 'PARTIAL' ? 'bg-amber-50 border-amber-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      {pendingTeacherStatus === 'PRESENT' && <CheckCircle2 size={16} className="text-emerald-600" />}
                      {pendingTeacherStatus === 'PARTIAL' && <Clock size={16} className="text-amber-500" />}
                      {pendingTeacherStatus === 'ABSENT'  && <XCircle size={16} className="text-red-500" />}
                      <span className={`text-xs font-black ${
                        pendingTeacherStatus === 'PRESENT' ? 'text-emerald-700' :
                        pendingTeacherStatus === 'PARTIAL' ? 'text-amber-700' : 'text-red-600'
                      }`}>
                        {{ PRESENT: '참석', PARTIAL: '부분참석', ABSENT: '불참' }[pendingTeacherStatus]}으로 제출 완료
                      </span>
                    </div>
                    {pendingTeacherStatus === 'PARTIAL' && (partialFromDate || partialNote) && (
                      <p className="text-[10px] text-gray-500 font-medium pl-6">
                        {partialFromDate && `${partialFromDate}부터`}{partialNote && ` · ${partialNote}`}
                      </p>
                    )}
                    {pendingTeacherStatus === 'ABSENT' && teacherAbsenceReason && (
                      <p className="text-[10px] text-gray-500 font-medium pl-6">
                        사유: {teacherAbsenceReason}
                      </p>
                    )}
                  </div>
                  {!isPastDeadline && (
                    <button onClick={() => setTeacherEditing(true)} className="text-[11px] text-gray-500 font-black flex items-center gap-1 flex-shrink-0">
                      <PenLine size={12} /> 수정
                    </button>
                  )}
                </div>
                {isPastDeadline && (
                  <p className="text-[10px] font-bold text-red-500 text-right px-1">제출 기간이 마감되어 수정할 수 없습니다.</p>
                )}
              </div>
            )}

            {(!teacherSubmitted || teacherEditing) && (
              <div className="flex flex-col gap-3">
                {isPastDeadline ? (
                  <Card className="bg-red-50 border-red-100 py-4 flex flex-col items-center gap-1">
                    <XCircle size={20} className="text-red-400" />
                    <p className="text-xs font-black text-red-600">제출 기간이 마감되었습니다</p>
                  </Card>
                ) : (
                  <>
                    <div className={`grid gap-2 ${isMultiDay ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {(isMultiDay ? ['PRESENT','PARTIAL','ABSENT'] : ['PRESENT','ABSENT']).map(key => (
                        <button key={key} onClick={() => setPendingTeacherStatus(key)}
                          className={`py-3 rounded-2xl border-2 text-xs font-black flex flex-col items-center gap-1 active:scale-[0.98] transition-all ${
                            pendingTeacherStatus === key
                              ? key === 'PRESENT' ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
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
                          <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 block">참석 시작일 (필수)</label>
                          <input type="date" value={partialFromDate} min={event?.eventDate} max={event?.endDate}
                            onChange={e => setPartialFromDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50/30 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-300" />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">세부 시간 / 메모 (선택)</label>
                          <input type="text" value={partialNote} onChange={e => setPartialNote(e.target.value)}
                            placeholder="예: 오후 2시부터 참석 가능합니다"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-200" />
                        </div>
                      </motion.div>
                    )}

                    {pendingTeacherStatus === 'ABSENT' && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="flex flex-col gap-2">
                        <div>
                          <label className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 block">불참 사유 (필수)</label>
                          <input type="text" value={teacherAbsenceReason} onChange={e => setTeacherAbsenceReason(e.target.value)}
                            placeholder="불참 사유를 입력해 주세요"
                            className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-red-50/30 text-sm font-medium outline-none focus:ring-2 focus:ring-red-300" />
                        </div>
                      </motion.div>
                    )}

                    <Button size="lg" onClick={() => teacherAttendanceMutation.mutate()}
                      disabled={!teacherCanSubmit || teacherAttendanceMutation.isPending}>
                      <UserCheck size={17} />
                      {teacherAttendanceMutation.isPending ? '저장 중...' : '제출하기'}
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
              <p className="text-xl font-black text-gray-900">{students.length}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">전체</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-xl font-black text-emerald-500">{presentCount}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">출석</p>
            </Card>
            {isMultiDay && (
              <Card className="text-center py-3">
                <p className="text-xl font-black text-amber-500">{partialCount}</p>
                <p className="text-[10px] font-black text-gray-400 mt-0.5">부분참석</p>
              </Card>
            )}
            <Card className="text-center py-3">
              <p className="text-xl font-black text-red-400">{absentCount}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">결석</p>
            </Card>
          </div>
        )}

        {/* 제출 완료 배너 */}
        {submitted && !editing && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-xs font-black text-emerald-700">출석 체크 제출 완료</span>
              </div>
              {!isPastDeadline && (
                <button onClick={() => setEditing(true)} className="text-[11px] text-emerald-600 font-black flex items-center gap-1">
                  <PenLine size={12} /> 수정
                </button>
              )}
            </div>
            {isPastDeadline && (
              <p className="text-[10px] font-bold text-red-500 text-right px-1">제출 기간이 마감되어 수정할 수 없습니다.</p>
            )}
          </div>
        )}

        {/* 학생 목록 */}
        <div>
          <div className="flex items-center justify-between px-1 mb-3">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">학생 출석 현황</p>
            {event?.attendanceDeadline && (
              <p className={`text-[10px] font-bold ${isPastDeadline ? 'text-red-500' : 'text-amber-500'}`}>
                {isPastDeadline ? '제출 마감됨' : `마감: ${format(new Date(event.attendanceDeadline), 'M/d')}`}
              </p>
            )}
          </div>

          {isLoading ? (
            <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>
          ) : students.length === 0 ? (
            <Card className="py-10 text-center flex flex-col items-center gap-2">
              <Users size={28} className="text-gray-200" />
              <p className="text-sm font-black text-gray-400">배정된 학생이 없습니다</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((student, idx) => {
                const status = statusMap[student.studentId] ?? 'PRESENT'
                return (
                  <motion.div
                    key={student.studentId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex flex-col gap-2"
                  >
                    {/* 학생 카드 + 상태 버튼 */}
                    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${
                      status === 'PRESENT' ? 'border-emerald-200 bg-emerald-50' :
                      status === 'PARTIAL' ? 'border-amber-200 bg-amber-50' :
                                             'border-red-200 bg-red-50'
                    }`}>
                      {/* 학생 정보 */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                          status === 'PRESENT' ? 'bg-emerald-200 text-emerald-700' :
                          status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                                                 'bg-red-200 text-red-700'
                        }`}>
                          {student.studentName[0]}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-sm">{student.studentName}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{student.grade}</p>
                        </div>
                      </div>

                      {/* 상태 버튼 */}
                      {isEditable && (
                        <div className={`flex gap-1.5 ${isMultiDay ? '' : ''}`}>
                          <button
                            onClick={() => setStudentStatus(student.studentId, 'PRESENT')}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                              status === 'PRESENT'
                                ? 'border-emerald-400 bg-emerald-500 text-white'
                                : 'border-gray-100 bg-white text-gray-400'
                            }`}
                          >
                            <CheckCircle2 size={12} className="inline mr-0.5" />참석
                          </button>
                          {isMultiDay && (
                            <button
                              onClick={() => setStudentStatus(student.studentId, 'PARTIAL')}
                              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                                status === 'PARTIAL'
                                  ? 'border-amber-400 bg-amber-500 text-white'
                                  : 'border-gray-100 bg-white text-gray-400'
                              }`}
                            >
                              <Clock size={12} className="inline mr-0.5" />부분
                            </button>
                          )}
                          <button
                            onClick={() => setStudentStatus(student.studentId, 'ABSENT')}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
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
                        <div className={`flex items-center gap-1.5 text-xs font-black ${
                          status === 'PRESENT' ? 'text-emerald-600' :
                          status === 'PARTIAL' ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {status === 'PRESENT' && <><CheckCircle2 size={16} /> 출석</>}
                          {status === 'PARTIAL' && <><Clock size={16} /> 부분참석</>}
                          {status === 'ABSENT'  && <><XCircle size={16} /> 결석</>}
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
                            value={reasonMap[student.studentId] || ''}
                            onChange={e => setReasonMap(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                            placeholder="결석 사유를 입력해 주세요 (필수)"
                            disabled={!isEditable}
                            className={`w-full px-4 py-3 rounded-xl text-[11px] font-medium border transition-all ${
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
                            <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                              참석 시작일 (필수)
                            </label>
                            <input
                              type="date"
                              value={partialFromDateMap[student.studentId] || ''}
                              onChange={e => setPartialFromDateMap(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                              min={event?.eventDate}
                              max={event?.endDate}
                              disabled={!isEditable}
                              className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                                isEditable
                                  ? 'bg-white border-amber-200 focus:ring-2 focus:ring-amber-300 outline-none'
                                  : 'bg-gray-50 border-gray-100 text-gray-400'
                              }`}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              메모 (선택)
                            </label>
                            <input
                              type="text"
                              value={partialNoteMap[student.studentId] || ''}
                              onChange={e => setPartialNoteMap(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                              placeholder="예: 오후 2시부터 참석"
                              disabled={!isEditable}
                              className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-medium border transition-all ${
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
            {isPastDeadline ? (
              <Card className="bg-red-50 border-red-100 py-4 flex flex-col items-center gap-1">
                <XCircle size={20} className="text-red-400" />
                <p className="text-xs font-black text-red-600">제출 기간이 마감되었습니다</p>
              </Card>
            ) : (
              <>
                {!canSubmit && students.length > 0 && (
                  <p className="text-[10px] font-black text-red-400 text-center">
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
                  {saveMutation.isPending ? '저장 중...' : '제출하기'}
                </Button>
              </>
            )}
          </div>
        )}

        </>)}
      </div>
    </div>
  )
}
