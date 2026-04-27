import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, CheckCircle2, XCircle, Users, PenLine,
  CalendarCheck, UserCheck, ChevronDown
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { eventApi } from '../api/event'
import useAuthStore from '../store/authStore'

// ── 교사 본인 출석 체크 섹션 ──────────────────────────────
function TeacherSelfCheck({ eventId, userId }) {
  const qc = useQueryClient()
  const [pending, setPending] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: myAtt } = useQuery({
    queryKey: ['event-teacher-attendance', eventId, userId],
    queryFn: () => eventApi.getMyTeacherAttendance(eventId).then(r => r.data),
    enabled: !!userId,
  })

  useEffect(() => {
    if (myAtt?.status) {
      setPending(myAtt.status)
      setSubmitted(true)
    }
  }, [myAtt])

  const saveMutation = useMutation({
    mutationFn: (status) => eventApi.saveTeacherAttendance(eventId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-teacher-attendance', eventId, userId] })
      setSubmitted(true)
      setEditing(false)
    },
  })

  const isEditable = !submitted || editing

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">내 출석 체크</p>

      {/* 제출 완료 배너 */}
      {submitted && !editing && (
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-200">
          <div className="flex items-center gap-2">
            {pending === 'PRESENT'
              ? <CheckCircle2 size={16} className="text-emerald-600" />
              : <XCircle size={16} className="text-red-500" />}
            <span className={`text-xs font-black ${pending === 'PRESENT' ? 'text-emerald-700' : 'text-red-600'}`}>
              {pending === 'PRESENT' ? '참석으로 제출 완료' : '불참으로 제출 완료'}
            </span>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-emerald-600 font-black flex items-center gap-1"
          >
            <PenLine size={12} /> 수정
          </button>
        </div>
      )}

      {/* 참석/불참 선택 */}
      {isEditable && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              onClick={() => setPending('PRESENT')}
              className={`flex-1 py-3 rounded-2xl border-2 text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                pending === 'PRESENT'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-gray-100 bg-gray-50 text-gray-400'
              }`}
            >
              <CheckCircle2 size={16} /> 참석
            </button>
            <button
              onClick={() => setPending('ABSENT')}
              className={`flex-1 py-3 rounded-2xl border-2 text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                pending === 'ABSENT'
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-gray-100 bg-gray-50 text-gray-400'
              }`}
            >
              <XCircle size={16} /> 불참
            </button>
          </div>
          <Button
            size="lg"
            onClick={() => saveMutation.mutate(pending)}
            disabled={!pending || saveMutation.isPending}
          >
            <UserCheck size={17} />
            {saveMutation.isPending ? '저장 중...' : '출석 제출'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 학생 출석 체크 섹션 ────────────────────���───────────────
function StudentAttendanceCheck({ eventId, userId }) {
  const qc = useQueryClient()
  const [statusMap, setStatusMap] = useState({})
  const [reasonMap, setReasonMap] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [editing, setEditing] = useState(false)

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['event-attendance', eventId, userId],
    queryFn: () => eventApi.getMyClassAttendance(eventId).then(r => r.data),
    enabled: !!userId,
  })

  useEffect(() => {
    if (students.length > 0) {
      const map = {}, rMap = {}
      let hasAny = false
      students.forEach(s => {
        if (s.status) { map[s.studentId] = s.status; rMap[s.studentId] = s.absenceReason || ''; hasAny = true }
        else { map[s.studentId] = 'PRESENT'; rMap[s.studentId] = '' }
      })
      setStatusMap(map)
      setReasonMap(rMap)
      if (hasAny) setSubmitted(true)
    }
  }, [students])

  const saveMutation = useMutation({
    mutationFn: (records) => eventApi.saveStudentAttendance(eventId, records),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-attendance', eventId, userId] })
      setSubmitted(true)
      setEditing(false)
    },
    onError: (err) => alert('제출 중 오류: ' + (err.response?.data?.message || err.message)),
  })

  const toggle = (sid) => setStatusMap(p => ({ ...p, [sid]: p[sid] === 'PRESENT' ? 'ABSENT' : 'PRESENT' }))
  const handleSubmit = () => {
    const records = Object.entries(statusMap).map(([sid, status]) => ({
      studentId: Number(sid), status,
      absenceReason: status === 'ABSENT' ? (reasonMap[sid] || '') : '',
    }))
    saveMutation.mutate(records)
  }

  const presentCount = Object.values(statusMap).filter(s => s === 'PRESENT').length
  const absentCount  = Object.values(statusMap).filter(s => s === 'ABSENT').length
  const isEditable   = !submitted || editing
  const missingReasons = students.filter(s => statusMap[s.studentId] === 'ABSENT' && !reasonMap[s.studentId]?.trim())
  const canSubmit = isEditable && students.length > 0 && missingReasons.length === 0

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">학생 출석 현황</p>

      {/* 통계 */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center py-3">
            <p className="text-lg font-black text-gray-900">{students.length}</p>
            <p className="text-[10px] font-black text-gray-400 mt-0.5">전체</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-lg font-black text-emerald-500">{presentCount}</p>
            <p className="text-[10px] font-black text-gray-400 mt-0.5">출석</p>
          </Card>
          <Card className="text-center py-3">
            <p className="text-lg font-black text-red-400">{absentCount}</p>
            <p className="text-[10px] font-black text-gray-400 mt-0.5">결석</p>
          </Card>
        </div>
      )}

      {/* 제출 완료 배너 */}
      {submitted && !editing && (
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span className="text-xs font-black text-emerald-700">출석 체크 제출 완료</span>
          </div>
          <button onClick={() => setEditing(true)} className="text-[11px] text-emerald-600 font-black flex items-center gap-1">
            <PenLine size={12} /> 수정
          </button>
        </div>
      )}

      {/* 학생 목록 */}
      {isLoading ? (
        <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
      ) : students.length === 0 ? (
        <Card className="py-8 text-center flex flex-col items-center gap-2">
          <Users size={24} className="text-gray-200" />
          <p className="text-sm font-black text-gray-400">배정된 학생이 없습니다</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((student, idx) => {
            const status = statusMap[student.studentId] ?? 'PRESENT'
            const isPresent = status === 'PRESENT'
            return (
              <div key={student.studentId} className="flex flex-col gap-2">
                <motion.button
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => isEditable && toggle(student.studentId)}
                  disabled={!isEditable}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                    isPresent ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                  } ${!isEditable ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                      isPresent ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'
                    }`}>{student.studentName[0]}</div>
                    <div>
                      <p className="font-black text-gray-900 text-sm">{student.studentName}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{student.grade}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-black flex items-center gap-1 ${isPresent ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isPresent ? <><CheckCircle2 size={14} /> 출석</> : <><XCircle size={14} /> 결석</>}
                  </span>
                </motion.button>
                {!isPresent && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-1">
                    <input
                      type="text"
                      value={reasonMap[student.studentId] || ''}
                      onChange={e => setReasonMap(p => ({ ...p, [student.studentId]: e.target.value }))}
                      placeholder="결석 사유를 입력해 주세요 (필수)"
                      disabled={!isEditable}
                      className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-medium border transition-all ${
                        isEditable ? 'bg-white border-red-100 focus:border-red-300 outline-none' : 'bg-gray-50 border-gray-100 text-gray-400'
                      }`}
                    />
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 제출 버튼 */}
      {isEditable && students.length > 0 && (
        <div className="flex flex-col gap-2">
          {!canSubmit && <p className="text-[10px] font-black text-red-400 text-center">결석 사유를 모두 입력해 주세요 ({missingReasons.length}명 누락)</p>}
          <Button size="lg" onClick={handleSubmit} disabled={saveMutation.isPending || !canSubmit}>
            <CalendarCheck size={17} />
            {saveMutation.isPending ? '저장 중...' : '출석 체크 제출'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 행사별 출석 패널 ─────────────────────────────────────
function EventPanel({ event, user }) {
  const needsTeacher = event.attendanceTarget === 'TEACHER_ONLY' || event.attendanceTarget === 'BOTH'
  const needsStudent = !event.attendanceTarget || event.attendanceTarget === 'STUDENT_ONLY' || event.attendanceTarget === 'BOTH'

  return (
    <div className="flex flex-col gap-5 px-4 pb-4 pt-2">
      {needsTeacher && <TeacherSelfCheck eventId={event.id} userId={user?.id} />}
      {needsTeacher && needsStudent && <div className="border-t border-gray-100" />}
      {needsStudent && <StudentAttendanceCheck eventId={event.id} userId={user?.id} />}
    </div>
  )
}

// ── 메인 페이지 ─────────────────────────��────────────────
export default function EventAttendanceListPage() {
  const { user } = useAuthStore()
  const [selectedId, setSelectedId] = useState(null)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
  })

  // 행사가 1개면 자동 선택
  useEffect(() => {
    if (events.length === 1) setSelectedId(events[0].id)
  }, [events])

  const handleSelect = (id) => setSelectedId(prev => prev === id ? null : id)

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="행사 출석 체크" showBack />

      <div className="px-4 py-5 flex flex-col gap-3">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">출석 체크가 필요한 행사</p>

        {isLoading ? (
          <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>
        ) : events.length === 0 ? (
          <Card className="py-14 flex flex-col items-center gap-3">
            <Calendar size={32} className="text-gray-200" />
            <p className="text-sm font-black text-gray-400">출석 체크가 필요한 행사가 없습니다</p>
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
                className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* 행사 헤더 (클릭으로 펼치기) */}
                <button
                  onClick={() => handleSelect(event.id)}
                  className="w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      isOpen ? 'bg-emerald-100' : 'bg-gray-50'
                    }`}>
                      <Calendar size={18} className={isOpen ? 'text-emerald-600' : 'text-gray-400'} />
                    </div>
                    <div>
                      <p className={`font-black text-sm ${isOpen ? 'text-emerald-800' : 'text-gray-900'}`}>{event.title}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                        {event.startTime && ` · ${event.startTime}`}
                        {' · '}
                        {event.attendanceTarget === 'TEACHER_ONLY' ? '교사 출석' :
                         event.attendanceTarget === 'BOTH'         ? '학생 + 교사' : '학생 출석'}
                      </p>
                    </div>
                  </div>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={18} className="text-gray-300" />
                  </motion.div>
                </button>

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
                      <EventPanel event={event} user={user} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
