import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Calendar, Users, PenLine, CalendarCheck } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
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

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['event-attendance', eventId, user?.id],
    queryFn: () => eventApi.getMyClassAttendance(eventId).then(r => r.data),
    enabled: !!user,
  })

  // 출석 상태 맵: { [studentId]: 'PRESENT' | 'ABSENT' }
  const [statusMap, setStatusMap] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [editing, setEditing] = useState(false)

  // 기존 데이터로 초기화
  useEffect(() => {
    if (students.length > 0) {
      const map = {}
      let hasAny = false
      students.forEach(s => {
        if (s.status) {
          map[s.studentId] = s.status
          hasAny = true
        } else {
          map[s.studentId] = 'PRESENT' // 기본값
        }
      })
      setStatusMap(map)
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
  })

  const toggle = (studentId) => {
    setStatusMap(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'PRESENT' ? 'ABSENT' : 'PRESENT',
    }))
  }

  const handleSubmit = () => {
    const records = Object.entries(statusMap).map(([studentId, status]) => ({
      studentId: Number(studentId),
      status,
    }))
    saveMutation.mutate(records)
  }

  const presentCount = Object.values(statusMap).filter(s => s === 'PRESENT').length
  const absentCount  = Object.values(statusMap).filter(s => s === 'ABSENT').length
  const isEditable   = !submitted || editing

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
                {event.startTime && ` · ${event.startTime}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-5 flex flex-col gap-4">

        {/* 통계 */}
        {students.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center py-3">
              <p className="text-xl font-black text-gray-900">{students.length}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">전체</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-xl font-black text-emerald-500">{presentCount}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">출석</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-xl font-black text-red-400">{absentCount}</p>
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
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] text-emerald-600 font-black flex items-center gap-1"
            >
              <PenLine size={12} /> 수정
            </button>
          </div>
        )}

        {/* 학생 목록 */}
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-3">학생 출석 현황</p>

          {isLoading ? (
            <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>
          ) : students.length === 0 ? (
            <Card className="py-10 text-center flex flex-col items-center gap-2">
              <Users size={28} className="text-gray-200" />
              <p className="text-sm font-black text-gray-400">배정된 학생이 없습니다</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {students.map((student, idx) => {
                const status = statusMap[student.studentId] ?? 'PRESENT'
                const isPresent = status === 'PRESENT'
                return (
                  <motion.button
                    key={student.studentId}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => isEditable && toggle(student.studentId)}
                    disabled={!isEditable}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] text-left ${
                      isPresent
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-red-200 bg-red-50'
                    } ${!isEditable ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                        isPresent ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'
                      }`}>
                        {student.studentName[0]}
                      </div>
                      <div>
                        <p className="font-black text-gray-900 text-sm">{student.studentName}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{student.grade}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-black ${isPresent ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isPresent
                        ? <><CheckCircle2 size={16} /> 출석</>
                        : <><XCircle size={16} /> 결석</>
                      }
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>

        {/* 제출 버튼 */}
        {isEditable && students.length > 0 && (
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
          >
            <CalendarCheck size={17} />
            {saveMutation.isPending ? '저장 중...' : '출석 체크 제출'}
          </Button>
        )}
      </div>
    </div>
  )
}
