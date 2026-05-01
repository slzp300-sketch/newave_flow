import { useState, useEffect } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, CheckCircle2, XCircle, Users, PenLine,
  CalendarCheck, UserCheck, ChevronDown, Clock
} from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { eventApi } from '../api/event'
import useAuthStore from '../store/authStore'

const STATUS_LABEL = { PRESENT: '참석', PARTIAL: '부분참석', ABSENT: '불참' }
const STATUS_COLOR = {
  PRESENT: { btn: 'border-emerald-400 bg-emerald-50 text-emerald-700', banner: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: <CheckCircle2 size={16} className="text-emerald-600" /> },
  PARTIAL: { btn: 'border-amber-400 bg-amber-50 text-amber-700',   banner: 'bg-amber-50 border-amber-200 text-amber-700',   icon: <Clock size={16} className="text-amber-500" /> },
  ABSENT:  { btn: 'border-red-300 bg-red-50 text-red-600',         banner: 'bg-red-50 border-red-200 text-red-600',         icon: <XCircle size={16} className="text-red-500" /> },
}

// ── 교사 본인 출석 체크 섹션 ──────────────────────────────
function TeacherSelfCheck({ event, userId }) {
  const eventId = event.id
  const isMultiDay = event.endDate && event.endDate !== event.eventDate
  const qc = useQueryClient()

  const [pending, setPending]             = useState(null)
  const [partialFromDate, setPartialFromDate] = useState('')
  const [partialNote, setPartialNote]     = useState('')
  const [submitted, setSubmitted]         = useState(false)
  const [editing, setEditing]             = useState(false)

  const { data: myAtt } = useQuery({
    queryKey: ['event-teacher-attendance', eventId, userId],
    queryFn: () => eventApi.getMyTeacherAttendance(eventId).then(r => r.data),
    enabled: !!userId,
  })

  useEffect(() => {
    if (myAtt?.status) {
      setPending(myAtt.status)
      setPartialFromDate(myAtt.partialFromDate || '')
      setPartialNote(myAtt.partialNote || '')
      setSubmitted(true)
    }
  }, [myAtt])

  const saveMutation = useMutation({
    mutationFn: () => eventApi.saveTeacherAttendance(
      eventId, pending,
      pending === 'PARTIAL' ? partialFromDate || null : null,
      pending === 'PARTIAL' ? partialNote || null : null,
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-teacher-attendance', eventId, userId] })
      setSubmitted(true)
      setEditing(false)
    },
  })

  const canSubmit = pending && (pending !== 'PARTIAL' || partialFromDate)
  const isEditable = !submitted || editing
  const statusKeys = isMultiDay ? ['PRESENT', 'PARTIAL', 'ABSENT'] : ['PRESENT', 'ABSENT']

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">내 출석 체크</p>

      {/* 제출 완료 배너 */}
      {submitted && !editing && pending && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${STATUS_COLOR[pending]?.banner || 'bg-gray-50 border-gray-200'}`}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {STATUS_COLOR[pending]?.icon}
              <span className="text-xs font-black">{STATUS_LABEL[pending]}으로 제출 완료</span>
            </div>
            {pending === 'PARTIAL' && (partialFromDate || partialNote) && (
              <p className="text-[10px] text-gray-500 font-medium pl-6">
                {partialFromDate && `${partialFromDate}부터`}{partialNote && ` · ${partialNote}`}
              </p>
            )}
          </div>
          <button onClick={() => setEditing(true)} className="text-[11px] text-gray-500 font-black flex items-center gap-1 flex-shrink-0">
            <PenLine size={12} /> 수정
          </button>
        </div>
      )}

      {/* 상태 선택 버튼 */}
      {isEditable && (
        <div className="flex flex-col gap-3">
          <div className={`grid gap-2 ${statusKeys.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {statusKeys.map(key => (
              <button
                key={key}
                onClick={() => setPending(key)}
                className={`py-3 rounded-2xl border-2 text-xs font-black flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] ${
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

          {/* 부분참석 상세 입력 */}
          {pending === 'PARTIAL' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-col gap-2"
            >
              <div>
                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 block">참석 시작일 (필수)</label>
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
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">세부 시간 / 메모 (선택)</label>
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
            {saveMutation.isPending ? '저장 중...' : '출석 제출'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── 학생 출석 체크 섹션 ─────────────────────────────────────
function StudentAttendanceCheck({ event, userId }) {
  const eventId  = event.id
  const isMultiDay = event.endDate && event.endDate !== event.eventDate
  const qc = useQueryClient()

  const [statusMap,          setStatusMap]          = useState({})
  const [reasonMap,          setReasonMap]          = useState({})
  const [partialFromDateMap, setPartialFromDateMap] = useState({})
  const [partialNoteMap,     setPartialNoteMap]     = useState({})
  const [submitted,          setSubmitted]          = useState(false)
  const [editing,            setEditing]            = useState(false)

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['event-attendance', eventId, userId],
    queryFn: () => eventApi.getMyClassAttendance(eventId).then(r => r.data),
    enabled: !!userId,
  })

  useEffect(() => {
    if (students.length > 0) {
      const sMap = {}, rMap = {}, pDateMap = {}, pNoteMap = {}
      let hasAny = false
      students.forEach(s => {
        sMap[s.studentId]     = s.status || 'PRESENT'
        rMap[s.studentId]     = s.absenceReason || ''
        pDateMap[s.studentId] = s.partialFromDate || ''
        pNoteMap[s.studentId] = s.partialNote || ''
        if (s.status) hasAny = true
      })
      setStatusMap(sMap); setReasonMap(rMap)
      setPartialFromDateMap(pDateMap); setPartialNoteMap(pNoteMap)
      if (hasAny) setSubmitted(true)
    }
  }, [students])

  const saveMutation = useMutation({
    mutationFn: (records) => eventApi.saveStudentAttendance(eventId, records),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-attendance', eventId, userId] })
      setSubmitted(true); setEditing(false)
    },
    onError: (err) => alert('제출 중 오류: ' + (err.response?.data?.message || err.message)),
  })

  const setStatus = (sid, status) => setStatusMap(p => ({ ...p, [sid]: status }))
  const toggleSimple = (sid) => setStatusMap(p => ({ ...p, [sid]: p[sid] === 'PRESENT' ? 'ABSENT' : 'PRESENT' }))

  const handleSubmit = () => {
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
  const isEditable   = !submitted || editing

  const missingReasons  = students.filter(s => statusMap[s.studentId] === 'ABSENT' && !reasonMap[s.studentId]?.trim())
  const missingPartials = isMultiDay
    ? students.filter(s => statusMap[s.studentId] === 'PARTIAL' && !partialFromDateMap[s.studentId])
    : []
  const canSubmit = isEditable && students.length > 0 && missingReasons.length === 0 && missingPartials.length === 0

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
            const sid    = student.studentId
            const status = statusMap[sid] ?? 'PRESENT'
            return (
              <motion.div key={sid} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: idx * 0.03 }}
                className="flex flex-col gap-1.5"
              >
                {/* 학생 카드 */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 ${
                  status === 'PRESENT' ? 'border-emerald-200 bg-emerald-50' :
                  status === 'PARTIAL' ? 'border-amber-200 bg-amber-50' :
                  'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                      status === 'PRESENT' ? 'bg-emerald-200 text-emerald-700' :
                      status === 'PARTIAL' ? 'bg-amber-200 text-amber-700' :
                      'bg-red-200 text-red-700'
                    }`}>{student.studentName[0]}</div>
                    <div>
                      <p className="font-black text-gray-900 text-sm">{student.studentName}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{student.grade}</p>
                    </div>
                  </div>

                  {/* 단일 일정: 클릭 토글 / 다중 일정: 버튼 그룹 */}
                  {isMultiDay && isEditable ? (
                    <div className="flex gap-1">
                      {['PRESENT','PARTIAL','ABSENT'].map(k => (
                        <button key={k} onClick={() => setStatus(sid, k)}
                          className={`text-[9px] font-black px-2 py-1.5 rounded-lg transition-all ${
                            status === k
                              ? k === 'PRESENT' ? 'bg-emerald-200 text-emerald-800'
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
                      className={`text-xs font-black flex items-center gap-1 ${
                        status === 'PRESENT' ? 'text-emerald-600' : 'text-red-500'
                      } ${!isEditable ? 'cursor-default' : ''}`}>
                      {status === 'PRESENT' ? <><CheckCircle2 size={14} /> 출석</> : <><XCircle size={14} /> 결석</>}
                    </button>
                  )}
                </div>

                {/* 결석 사유 */}
                {status === 'ABSENT' && (
                  <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} className="px-1">
                    <input type="text" value={reasonMap[sid] || ''}
                      onChange={e => setReasonMap(p => ({ ...p, [sid]: e.target.value }))}
                      placeholder="결석 사유를 입력해 주세요 (필수)" disabled={!isEditable}
                      className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-medium border transition-all ${
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
                      className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${
                        isEditable ? 'bg-amber-50/40 border-amber-200 focus:ring-2 focus:ring-amber-200 outline-none' : 'bg-gray-50 border-gray-100 text-gray-400'
                      }`} />
                    <input type="text" value={partialNoteMap[sid] || ''}
                      onChange={e => setPartialNoteMap(p => ({ ...p, [sid]: e.target.value }))}
                      placeholder="세부 시간 / 메모 (선택)" disabled={!isEditable}
                      className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-medium border transition-all ${
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
          {missingReasons.length > 0 && <p className="text-[10px] font-black text-red-400 text-center">결석 사유를 모두 입력해 주세요 ({missingReasons.length}명 누락)</p>}
          {missingPartials.length > 0 && <p className="text-[10px] font-black text-amber-500 text-center">부분참석 날짜를 모두 입력해 주세요 ({missingPartials.length}명 누락)</p>}
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
      {needsTeacher && <TeacherSelfCheck event={event} userId={user?.id} />}
      {needsTeacher && needsStudent && <div className="border-t border-gray-100" />}
      {needsStudent && <StudentAttendanceCheck event={event} userId={user?.id} />}
    </div>
  )
}

// ── 메인 페이지 ─────────────────────────��────────────────
export default function EventAttendanceListPage() {
  const { user } = useAuthStore()
  const [selectedId, setSelectedId] = usePersistedState('selectedId', null)

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
