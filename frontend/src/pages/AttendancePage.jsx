import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, X, ChevronDown, ChevronUp, Send,
  CheckCircle2, AlertCircle, MessageSquare, UserCheck, UserX,
  History, Calendar, Lock
} from 'lucide-react'
import { attendanceApi } from '../api/attendance'
import { classesApi } from '../api/classes'
import { reportsApi } from '../api/reports'
import { toApiDate, getMostRecentSunday, isSundayToTuesday, formatDate } from '../utils/date'
import useAuthStore from '../store/authStore'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import Card from '../components/common/Card'

const STATUS_CONFIG = {
  PRESENT: { label: '출석', color: 'emerald', icon: UserCheck },
  ABSENT:  { label: '불참', color: 'red', icon: UserX },
}

export default function AttendancePage() {
  const qc    = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const today = toApiDate(getMostRecentSunday())
  const isWindowOpen = isSundayToTuesday()
  const [localEdit, setLocalEdit] = useState(false)

  // 1. 담당 반 목록
  const { data: classes = [], isLoading: classLoading } = useQuery({
    queryKey: ['my-classes', user?.id],
    queryFn:  () => classesApi.getMyClasses().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const classId = classes[0]?.id

  // 2. 해당 반 학생 목록
  const { data: students = [] } = useQuery({
    queryKey: ['students', classId],
    queryFn:  () => classesApi.getStudents(classId).then(r => r.data),
    enabled:  !!classId,
    staleTime: 5 * 60 * 1000,
  })

  // 3. 오늘 출석 기록
  const { data: records = [] } = useQuery({
    queryKey: ['attendance', classId, today],
    queryFn:  () => attendanceApi.getByClass(classId, today).then(r => r.data),
    enabled:  !!classId,
    staleTime: 5 * 60 * 1000,
  })

  // 4. 제출 상태 확인
  const { data: reportStatus } = useQuery({
    queryKey: ['report-status', classId, today],
    queryFn:  () => reportsApi.getByClassAndDate(classId, today).then(r => r.data),
    enabled:  !!classId,
    staleTime: 5 * 60 * 1000,
  })

  const isSubmitted = reportStatus?.status === 'SUBMITTED' && !localEdit

  // 상태 관리: { [studentId]: { status, absentReason, note } }
  const [formData, setFormData] = useState({})

  // 초기 데이터 로드
  useEffect(() => {
    if (records.length > 0) {
      const initial = {}
      records.forEach(r => {
        initial[r.studentId] = {
          status: r.status,
          absentReason: r.absentReason || '',
          note: r.note || ''
        }
      })
      setFormData(prev => ({ ...initial, ...prev }))
    }
  }, [records])

  const updateStudent = (id, fields) => {
    if (isSubmitted) return
    setFormData(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { status: 'PRESENT', absentReason: '', note: '' }), ...fields }
    }))
  }

  const getStudentData = (id) => formData[id] || { status: 'PRESENT', absentReason: '', note: '' }

  // 5. 제출 Mutation (저장 후 제출 순서로 처리)
  const { mutate: submitReport, isPending: isSubmitting } = useMutation({
    mutationFn: async () => {
      const batchRecords = students.map(s => {
        const data = getStudentData(s.id)
        return {
          studentId: s.id,
          status: data.status,
          absentReason: data.status === 'ABSENT' ? data.absentReason : '',
          note: data.note
        }
      })
      await attendanceApi.saveBatch(classId, today, batchRecords)
      return attendanceApi.submit(classId, today)
    },
    onSuccess: () => {
      setLocalEdit(false)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      qc.invalidateQueries({ queryKey: ['report-status'] })
      qc.invalidateQueries({ queryKey: ['weekly-status'] })
    },
  })

  if (classLoading) return <div className="py-20 text-center text-gray-400">불러오는 중...</div>

  if (classes.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="출석 체크" showBack />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center text-4xl">📋</div>
          <div>
            <p className="font-black text-gray-900 text-lg">배정된 반이 없습니다</p>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">관리자에게 반 배정을 요청해 주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isWindowOpen) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50/50">
        <Header title="출석 체크" showBack />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 mt-[-10vh]">
          <div className="w-16 h-16 bg-white border-4 border-gray-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Lock size={28} className="text-gray-400" />
          </div>
          <h2 className="text-[17px] font-black text-gray-800 mb-3 text-center tracking-tight">출결 입력 기간이 아닙니다</h2>
          <p className="text-[13px] text-gray-500 text-center mb-8 font-medium leading-relaxed">
            매주 <span className="text-gray-700 font-bold">주일(일요일)부터 화요일</span>까지만<br />
            출결 현황을 기록하거나 수정할 수 있습니다.
          </p>
          <Button onClick={() => navigate(-1)} variant="secondary" className="w-full max-w-[160px] rounded-2xl border-gray-200">
            돌아가기
          </Button>
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <SubmittedAttendanceView 
        classGroup={classes.find(c => c.id === classId)}
        date={today}
        students={students}
        formData={formData}
        onEdit={() => setLocalEdit(true)}
        isWindowOpen={isWindowOpen}
      />
    )
  }

  return (
    <div className="pb-24">
      <Header title="출석 체크" showBack />

      {/* 상단 정보 */}
      <div className="px-4 py-4 glass-effect border-b border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest flex items-center gap-1">
              <Calendar size={10} /> {formatDate(today)}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-lg font-black text-gray-900">{classes.find(c => c.id === classId)?.name}</h2>
              <span className="text-xs font-bold text-gray-400">총 {students.length}명</span>
            </div>
          </div>
        </div>

        {!isWindowOpen && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2.5 rounded-xl text-[11px] font-bold">
            <AlertCircle size={14} className="flex-shrink-0" />
            <p>출석 제출 기간이 아닙니다 (매주 주일~월요일 가능). 현재는 미리 입력만 가능합니다.</p>
          </div>
        )}
      </div>

      {/* 학생 목록 */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {students.map((student, idx) => (
          <StudentAttendanceCard
            key={student.id}
            student={student}
            data={getStudentData(student.id)}
            onChange={(fields) => updateStudent(student.id, fields)}
            idx={idx}
          />
        ))}
      </div>

      {/* 하단 플로팅 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 z-50">
        <Button
          className="w-full premium-gradient shadow-glow"
          onClick={() => submitReport()}
          disabled={!isWindowOpen}
          loading={isSubmitting}
        >
          <Send size={18} />
          제출하기
        </Button>
        <p className="text-center text-[10px] text-gray-400 mt-2 font-medium">
          제출 후에도 기간 내에는 수정이 가능합니다
        </p>
      </div>
    </div>
  )
}

function StudentAttendanceCard({ student, data, onChange, idx }) {
  const [isNoteOpen, setNoteOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Card className="overflow-visible">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              data.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-400'
            }`}>
              <span className="font-black text-sm">{student.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-900 text-sm">{student.name}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{student.grade} · {student.school || '학교미입력'}</p>
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => onChange({ status: 'PRESENT' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                data.status === 'PRESENT' 
                  ? 'bg-white text-emerald-600 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              출석
            </button>
            <button
              onClick={() => onChange({ status: 'ABSENT' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                data.status === 'ABSENT' 
                  ? 'bg-white text-red-500 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              불참
            </button>
          </div>
        </div>

        <AnimatePresence>
          {data.status === 'ABSENT' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-50"
            >
              <label className="text-[10px] font-black text-gray-400 mb-1.5 block">불참 사유</label>
              <input
                type="text"
                placeholder="예: 가족여행, 학업, 몸살 등"
                value={data.absentReason}
                onChange={(e) => onChange({ absentReason: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold border-none focus:ring-1 focus:ring-red-200 placeholder:text-gray-300"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-3">
          <button
            onClick={() => setNoteOpen(!isNoteOpen)}
            className="flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-primary-500 transition-colors"
          >
            <MessageSquare size={10} />
            특이사항 {data.note ? '(입력됨)' : '작성하기'}
            {isNoteOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          
          <AnimatePresence>
            {isNoteOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                <textarea
                  placeholder="아이의 오늘 기분이나 나눌 내용이 있다면 적어주세요."
                  value={data.note}
                  onChange={(e) => onChange({ note: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 rounded-xl text-xs font-medium border-none focus:ring-1 focus:ring-primary-100 placeholder:text-gray-300 min-h-[60px]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  )
}

function SubmittedAttendanceView({ classGroup, date, students, formData, onEdit, isWindowOpen }) {
  const counts = students.reduce((acc, s) => {
    const status = formData[s.id]?.status || 'ABSENT'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, { PRESENT: 0, ABSENT: 0 })

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="출석 완료" showBack />
      
      <div className="px-6 pt-10 pb-6 flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-24 h-24 rounded-3xl premium-gradient flex items-center justify-center shadow-glow"
        >
          <CheckCircle2 size={48} className="text-white" />
        </motion.div>

        <div className="text-center">
          <h2 className="text-2xl font-black text-gray-900">{classGroup?.name}</h2>
          <p className="text-emerald-500 font-bold mt-1">출석 제출이 완료되었습니다!</p>
          <p className="text-gray-400 text-xs mt-3">{formatDate(date)}</p>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 mt-4">
          <div className="bg-emerald-50 p-4 rounded-3xl text-center">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">출석</p>
            <p className="text-2xl font-black text-emerald-600">{counts.PRESENT}명</p>
          </div>
          <div className="bg-red-50 p-4 rounded-3xl text-center">
            <p className="text-[10px] font-black text-red-300 uppercase tracking-widest mb-1">불참</p>
            <p className="text-2xl font-black text-red-400">{counts.ABSENT}명</p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 mt-2">
          <p className="text-xs font-black text-gray-400 ml-1">상세 현황</p>
          {students.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-white border border-gray-100 rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700">{s.name}</span>
                {formData[s.id]?.status === 'ABSENT' && formData[s.id]?.absentReason && (
                  <span className="text-[10px] text-gray-400">({formData[s.id].absentReason})</span>
                )}
              </div>
              <span className={`text-xs font-black ${formData[s.id]?.status === 'PRESENT' ? 'text-emerald-500' : 'text-red-400'}`}>
                {formData[s.id]?.status === 'PRESENT' ? '출석' : '불참'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          {isWindowOpen ? (
            <button
              onClick={onEdit}
              className="text-primary-600 font-bold text-sm underline underline-offset-4 active:opacity-60"
            >
              수정하기
            </button>
          ) : (
            <p className="text-[11px] text-gray-400 font-medium">제출 기간이 종료되었습니다.</p>
          )}
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  )
}