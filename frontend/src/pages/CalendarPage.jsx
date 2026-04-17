import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         getDay, isSameMonth, isToday, isSameDay, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function CalendarPage() {
  const [current, setCurrent]   = useState(new Date())
  const [selected, setSelected] = useState(new Date())

  const { data: events = [] } = useQuery({
    queryKey: ['events', format(current, 'yyyy-MM')],
    queryFn:  () => client.get('/events', {
      params: {
        from: format(startOfMonth(current), 'yyyy-MM-dd'),
        to:   format(endOfMonth(current),   'yyyy-MM-dd'),
      }
    }).then(r => r.data),
  })

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const startPad = getDay(startOfMonth(current))

  const eventsOnDay = (day) =>
    events.filter(e => isSameDay(new Date(e.eventDate), day))

  const selectedEvents = eventsOnDay(selected)

  return (
    <div>
      <Header title="캘린더" showBack />

      <div className="bg-white px-4 pb-4">
        {/* 월 이동 */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => setCurrent(m => subMonths(m, 1))}
            className="p-2 rounded-xl active:bg-gray-100"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-base font-bold text-gray-900">
            {format(current, 'yyyy년 M월', { locale: ko })}
          </h2>
          <button
            onClick={() => setCurrent(m => addMonths(m, 1))}
            className="p-2 rounded-xl active:bg-gray-100"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-1
              ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map((day) => {
            const hasEvent  = eventsOnDay(day).length > 0
            const isSelected = isSameDay(day, selected)
            const dayOfWeek = getDay(day)

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelected(day)}
                className={`flex flex-col items-center py-1.5 rounded-xl transition-all
                  ${isSelected ? 'bg-primary-600' : isToday(day) ? 'bg-primary-50' : 'active:bg-gray-50'}`}
              >
                <span className={`text-sm font-semibold
                  ${isSelected ? 'text-white'
                    : isToday(day) ? 'text-primary-600'
                    : dayOfWeek === 0 ? 'text-red-400'
                    : dayOfWeek === 6 ? 'text-blue-400'
                    : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </span>
                {hasEvent && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5
                    ${isSelected ? 'bg-white' : 'bg-primary-400'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택 날짜 일정 */}
      <div className="px-4 pt-4 flex flex-col gap-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {format(selected, 'M월 d일 (EEE)', { locale: ko })} 일정
        </p>

        {selectedEvents.length === 0 ? (
          <Card className="py-8 text-center text-gray-400">
            <p className="text-sm">등록된 일정이 없습니다</p>
          </Card>
        ) : (
          selectedEvents.map(event => (
            <Card key={event.id} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">{event.title}</p>
                {event.description && (
                  <p className="text-gray-400 text-xs mt-0.5">{event.description}</p>
                )}
              </div>
              <Badge variant={event.eventType === 'SPECIAL' ? 'info' : 'gray'}>
                {event.eventType === 'SPECIAL' ? '특별' : event.eventType === 'MEETING' ? '회의' : '정기'}
              </Badge>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}