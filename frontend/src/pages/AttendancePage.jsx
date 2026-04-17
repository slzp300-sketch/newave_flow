import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, X, Save, ChevronDown } from 'lucide-react'
import { attendanceApi } from '../api/attendance'
import { classesApi } from '../api/classes'
import { toApiDate } from '../utils/date'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import Card from '../components/common/Card'

const STATUS_CONFIG = {
  PRESENT: { label: '출석', bg: 'bg-emerald-500', text: 'text-white', icon: Check },
  LATE:    { label: '지각', bg: 'bg-amber-400',   text: 'text-white', icon: Clock },
  ABSENT:  { label: '결석', bg: 'bg-red-400',     text: 'text-white', icon: X },
}
const STATUS_CYCLE = { PRESENT: 'LATE', LATE: 'ABSENT', ABSENT: 'PRESENT' }

export default function AttendancePage() {
  const qc    = useQueryClient()
  const today = toApiDate()

  // 1. 담당 반 목록
  const { data: classes = [], isLoading: classLoading } = useQuery({
    queryKey: ['my-classes'],
    queryFn:  () => classesApi.getMyClasses().then(r => r.data),
  })

  const [selectedClassId, setSelectedClassId] = useState(null)
  const classId = selectedClassId ?? classes[0]?.id

  // 2. 해당 반 학생 목록
  const { data: students = [] } = useQuery({
    queryKey: ['students', classId],
    queryFn:  () => classesApi.getStudents(classId).then(r => r.data),
    enabled:  !!classId,
  })

  // 3. 오늘 출석 기록
  const { data: records = [] } = useQuery({
    queryKey: ['attendance', classId, today],
    queryFn:  () => attendanceApi.getByClass(classId, today).then(r => r.data),
    enabled:  !!classId,
  })

  // 기존 기록 기반 초기 상태 맵 (studentId → status)
  const existingMap = Object.fromEntries(records.map(r => [r.studentId, r.status]))
  const [overrides, setOverrides] = useState({})

  const getStatus = (id) => overrides[id] ?? existingMap[id] ?? 'ABSENT'
  const toggle    = (id) => setOverrides(m => ({ ...m, [id]: STATUS_CYCLE[getStatus(id)] }))

  const { mutate: saveBatch, isPending } = useMutation({
    mutationFn: () => attendanceApi.saveBatch(
      classId, today,
      students.map(s => ({ studentId: s.id, status: getStatus(s.id), note: '' }))
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
      alert('출석이 저장되었습니다!')
    },
  })

  const counts = students.reduce((acc, s) => {
    const st = getStatus(s.id)
    acc[st] = (acc[st] ?? 0) + 1
    return acc
  }, {})

  const selectedClass = classes.find(c => c.id === classId)

  // 배정된 반이 없는 경우 처리
  if (!classLoading && classes.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="출석 체크" showBack />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center text-4xl">📋</div>
          <div>
            <p className="font-black text-gray-900 text-lg">배정된 반이 없습니다</p>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              관리자에게 반 배정을 요청해 주세요.<br/>배정 완료 후 이 화면이 활성화됩니다.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="출석 체크" showBack />

      {/* 반 선택 */}
      {classes.length > 1 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="relative">
            <select
              value={classId ?? ''}
              onChange={e => { setSelectedClassId(Number(e.target.value)); setOverrides({}) }}
              className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* 요약 */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-sm">
            <span className={`w-2 h-2 rounded-full ${cfg.bg}`} />
            <span className="text-gray-600">{cfg.label} {counts[key] ?? 0}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-gray-400">
          {selectedClass?.name} · 총 {students.length}명
        </span>
      </div>

      {/* 학생 목록 */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {classLoading || !classId ? (
          <div className="py-16 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">👤</p>
            <p className="font-semibold text-gray-700">등록된 학생이 없습니다</p>
            <p className="text-sm text-gray-400 mt-1">관리자에게 학생 등록을 요청해주세요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((s, idx) => {
              const status = getStatus(s.id)
              const cfg    = STATUS_CONFIG[status]
              const Icon   = cfg.icon
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="flex items-center gap-3">
                    <div 
                      onClick={() => navigate(`/students/${s.id}`)}
                      className="flex flex-1 items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-2xl premium-gradient flex items-center justify-center flex-shrink-0 shadow-lg group-active:scale-90 transition-transform">
                        <span className="text-white font-black text-sm">{s.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm group-hover:text-primary-600 transition-colors">{s.name}</p>
                        <p className="text-gray-400 text-[11px] font-medium">{s.grade}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggle(s.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black transition-all active:scale-95 shadow-sm ${cfg.bg} ${cfg.text}`}
                    >
                      <Icon size={13} strokeWidth={3} />
                      {cfg.label}
                    </button>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {students.length > 0 && (
        <div className="px-4 pb-6">
          <Button size="lg" onClick={() => saveBatch()} loading={isPending}>
            <Save size={18} />
            출석 저장하기
          </Button>
        </div>
      )}
    </div>
  )
}