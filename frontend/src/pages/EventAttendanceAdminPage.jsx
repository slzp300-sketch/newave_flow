import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, CheckCircle2, XCircle, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { eventApi } from '../api/event'

export default function EventAttendanceAdminPage() {
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [selectedGrade, setSelectedGrade] = useState(null)
  const [expandedClassId, setExpandedClassId] = useState(null)

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
  })

  const { data: summary = [], isLoading: summaryLoading } = useQuery({
    queryKey: ['attendance-summary', selectedEventId],
    queryFn: () => eventApi.getAttendanceSummary(selectedEventId).then(r => r.data),
    enabled: !!selectedEventId,
  })

  const selectedEvent = events.find(e => e.id === selectedEventId)
  const totalStudents = summary.reduce((acc, c) => acc + Number(c.totalCount), 0)
  const totalPresent  = summary.reduce((acc, c) => acc + Number(c.presentCount), 0)
  const totalAbsent   = summary.reduce((acc, c) => acc + Number(c.absentCount), 0)

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

  // 행사 선택 시 상태 초기화
  const handleEventSelect = (id) => {
    if (selectedEventId === id) {
      setSelectedEventId(null)
    } else {
      setSelectedEventId(id)
    }
    setSelectedGrade(null)
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
            {/* 전체 통계 */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center py-4">
                <p className="text-2xl font-black text-gray-900">{totalStudents}</p>
                <p className="text-[10px] font-black text-gray-400 mt-1">전체</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-2xl font-black text-emerald-500">{totalPresent}</p>
                <p className="text-[10px] font-black text-gray-400 mt-1">출석</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-2xl font-black text-red-400">{totalAbsent}</p>
                <p className="text-[10px] font-black text-gray-400 mt-1">결석</p>
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
                      className="glass-card p-5 rounded-3xl flex flex-col items-center gap-2 border-2 border-transparent hover:border-emerald-200 transition-all active:scale-95 text-center"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1">
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
                          className="h-full bg-emerald-400"
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
                    className="flex items-center gap-1.5 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl active:scale-95 transition-all"
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
                              {cls.presentCount}명 출석 · {cls.absentCount}명 결석
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
                              className={`flex items-center justify-between px-3 py-2.5 rounded-2xl ${
                                student.status === 'PRESENT' ? 'bg-emerald-50/50' : 'bg-red-50/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-black w-6 h-6 rounded-xl flex items-center justify-center ${
                                  student.status === 'PRESENT'
                                    ? 'bg-emerald-200 text-emerald-700'
                                    : 'bg-red-200 text-red-700'
                                }`}>{student.studentName[0]}</span>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-gray-700">{student.studentName}</span>
                                  {student.status === 'ABSENT' && student.absenceReason && (
                                    <p className="text-[10px] text-red-400 font-medium mt-0.5 leading-tight">
                                      사유: {student.absenceReason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {student.status === 'PRESENT'
                                ? <CheckCircle2 size={16} className="text-emerald-500" />
                                : <XCircle size={16} className="text-red-400" />
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
          </>
        )}
      </div>
    </div>
  )
}
