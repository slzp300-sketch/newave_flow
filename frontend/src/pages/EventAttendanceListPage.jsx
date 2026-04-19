import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { eventApi } from '../api/event'

export default function EventAttendanceListPage() {
  const navigate = useNavigate()

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
  })

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="행사 출석 체크" showBack />

      <div className="px-4 py-5 flex flex-col gap-4">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">
          출석 체크가 필요한 행사
        </p>

        {isLoading ? (
          <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>
        ) : events.length === 0 ? (
          <Card className="py-14 flex flex-col items-center gap-3">
            <Calendar size={32} className="text-gray-200" />
            <p className="text-sm font-black text-gray-400">출석 체크가 필요한 행사가 없습니다</p>
          </Card>
        ) : (
          events.map((event, idx) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
            >
              <Card
                onClick={() => navigate(`/event-attendance/${event.id}`)}
                className="flex items-center justify-between p-5 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Calendar size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm">{event.title}</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                      {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                      {event.startTime && ` · ${event.startTime}`}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
