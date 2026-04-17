import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, X } from 'lucide-react'
import client from '../api/client'
import { formatShort, toApiDate } from '../utils/date'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'

const TYPE_LABEL = { SPECIAL: { label: '특별 행사', variant: 'info' }, MEETING: { label: '회의', variant: 'warning' }, REGULAR: { label: '정기', variant: 'gray' } }

export default function EventPage() {
  const qc  = useQueryClient()
  const now = new Date()
  const [selected, setSelected] = useState(null)
  const [statusMap, setStatusMap] = useState({})
  const [saved, setSaved] = useState({})

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', format(now, 'yyyy-MM')],
    queryFn:  () => client.get('/events', {
      params: {
        from: format(startOfMonth(now), 'yyyy-MM-dd'),
        to:   format(endOfMonth(now),   'yyyy-MM-dd'),
      }
    }).then(r => r.data),
  })

  const { mutate: saveAttendance, isPending } = useMutation({
    mutationFn: ({ eventId, status }) =>
      client.post(`/events/${eventId}/attendance`, { status }),
    onSuccess: (_, { eventId }) => {
      qc.invalidateQueries({ queryKey: ['events'] })
      setSaved(m => ({ ...m, [eventId]: true }))
      setSelected(null)
    },
  })

  return (
    <div>
      <Header title="행사 / 일정" showBack />

      <div className="px-4 py-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : events.length === 0 ? (
          <Card className="py-12 text-center">
            <CalendarDays size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">이번 달 행사가 없습니다</p>
          </Card>
        ) : (
          events.map(event => {
            const typeCfg  = TYPE_LABEL[event.eventType] ?? TYPE_LABEL.REGULAR
            const isSaved  = saved[event.id]
            const myStatus = statusMap[event.id]
            const isPast   = event.eventDate < toApiDate()

            return (
              <Card key={event.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <CalendarDays size={18} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-gray-900 text-sm">{event.title}</p>
                      <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
                    </div>
                    {event.description && (
                      <p className="text-gray-400 text-xs">{event.description}</p>
                    )}
                    <p className="text-primary-600 text-xs font-semibold mt-1">
                      📅 {formatShort(event.eventDate)}
                    </p>
                  </div>
                </div>

                {/* 참석 체크 */}
                {!isPast && (
                  isSaved ? (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                      ${myStatus === 'PRESENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {myStatus === 'PRESENT' ? <Check size={15}/> : <X size={15}/>}
                      {myStatus === 'PRESENT' ? '참석 완료' : '불참 처리됨'}
                    </div>
                  ) : selected === event.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setStatusMap(m => ({ ...m, [event.id]: 'PRESENT' })); saveAttendance({ eventId: event.id, status: 'PRESENT' }) }}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold active:bg-emerald-600"
                      >
                        <Check size={15}/> 참석
                      </button>
                      <button
                        onClick={() => { setStatusMap(m => ({ ...m, [event.id]: 'ABSENT' })); saveAttendance({ eventId: event.id, status: 'ABSENT' }) }}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-400 text-white text-sm font-bold active:bg-red-500"
                      >
                        <X size={15}/> 불참
                      </button>
                      <button onClick={() => setSelected(null)} className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">취소</button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setSelected(event.id)} className="w-full justify-center">
                      참석 여부 체크하기
                    </Button>
                  )
                )}

                {isPast && (
                  <div className="text-xs text-gray-400 text-center py-1">지난 행사입니다</div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}