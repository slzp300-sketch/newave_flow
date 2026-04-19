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
                  onClick={() => setSelectedEventId(event.id)}
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

            {/* 반별 결과 */}
            {summaryLoading ? (
              <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
            ) : summary.length === 0 ? (
              <Card className="py-10 text-center flex flex-col items-center gap-2">
                <Users size={28} className="text-gray-200" />
                <p className="text-sm font-black text-gray-400">아직 제출된 출석 데이터가 없습니다</p>
              </Card>
            ) : (
              summary.map((cls, idx) => (
                <motion.div
                  key={cls.classGroupId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07 }}
                >
                  <Card className="flex flex-col gap-4">
                    {/* 반 헤더 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center">
                          <Users size={14} className="text-primary-600" />
                        </div>
                        <p className="font-black text-gray-900 text-sm">{cls.classGroupName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-black">
                        <span className="text-emerald-600">{cls.presentCount}명 출석</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-red-400">{cls.absentCount}명 결석</span>
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

                    {/* 학생 목록 */}
                    <div className="flex flex-col gap-1.5">
                      {cls.records.map(student => (
                        <div
                          key={student.studentId}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                            student.status === 'PRESENT' ? 'bg-emerald-50' : 'bg-red-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center ${
                              student.status === 'PRESENT'
                                ? 'bg-emerald-200 text-emerald-700'
                                : 'bg-red-200 text-red-700'
                            }`}>{student.studentName[0]}</span>
                            <span className="text-xs font-bold text-gray-700">{student.studentName}</span>
                            <span className="text-[10px] text-gray-400">{student.grade}</span>
                          </div>
                          {student.status === 'PRESENT'
                            ? <CheckCircle2 size={14} className="text-emerald-500" />
                            : <XCircle size={14} className="text-red-400" />
                          }
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}
