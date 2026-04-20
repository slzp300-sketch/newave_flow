import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  isSameDay, isSameMonth, getWeekOfMonth, getMonth, setDate
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarDays, Check, X, CheckSquare, Clock } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import Button from '../components/common/Button'

const TYPE_LABEL = { 
  SPECIAL: { label: '특별 행사', variant: 'info' }, 
  MEETING: { label: '회의', variant: 'warning' }, 
  CHURCH_WIDE: { label: '교학 전원', variant: 'danger' },
  REGULAR: { label: '정기', variant: 'gray' } 
}

const getEventColors = (color) => {
  const map = {
    blue: 'border-blue-500 bg-blue-50/30 text-blue-600',
    red: 'border-red-500 bg-red-50/30 text-red-600',
    emerald: 'border-emerald-500 bg-emerald-50/30 text-emerald-600',
    violet: 'border-violet-500 bg-violet-50/30 text-violet-600',
    amber: 'border-amber-400 bg-amber-50/30 text-amber-600',
    rose: 'border-rose-500 bg-rose-50/30 text-rose-600',
    indigo: 'border-indigo-500 bg-indigo-50/30 text-indigo-600',
  }
  return map[color] || 'border-primary-500 bg-primary-50/30 text-primary-600'
}

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

  // 주차별 그룹화 로직
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.eventDate);
    const weekNum = getWeekOfMonth(date, { weekStartsOn: 0 });
    const month = getMonth(date) + 1;
    const key = `${month}월 ${weekNum}주차`;
    
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(event);
    return acc;
  }, new Map());

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

      <div className="px-4 py-6 flex flex-col gap-8">
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">일정을 불러오는 중...</p>
          </div>
        ) : groupedEvents.size === 0 ? (
          <Card className="py-16 text-center border-dashed border-2 border-gray-100">
            <CalendarDays size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="font-extrabold text-gray-400">이번 달 등록된 행사가 없습니다</p>
          </Card>
        ) : (
          Array.from(groupedEvents.keys()).map(weekKey => (
            <div key={weekKey} className="flex flex-col gap-4">
              <div className="flex items-center gap-3 px-1">
                <h3 className="text-sm font-black text-gray-900 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-50 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                  {weekKey}
                </h3>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-100 to-transparent" />
              </div>

              <div className="flex flex-col gap-4">
                {groupedEvents.get(weekKey).map(event => {
                  const typeCfg  = TYPE_LABEL[event.eventType] || TYPE_LABEL.REGULAR
                  const isSaved  = saved[event.id]
                  const myStatus = statusMap[event.id]
                  const isPast   = event.eventDate < toApiDate()
                  const colors   = getEventColors(event.color)

                  return (
                    <Card key={event.id} className={`p-0 overflow-hidden border-0 border-l-4 transition-all hover:shadow-lg ${colors.split(' ')[0]}`}>
                      <div className={`p-4 ${colors.split(' ')[1]}`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white shadow-sm`}>
                            <CalendarDays size={22} className={colors.split(' ')[2]} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                {format(new Date(event.eventDate), 'EEE요일', { locale: ko })}
                              </span>
                            </div>
                            <h4 className="font-black text-gray-900 text-base mb-1">{event.title}</h4>
                            {event.description && (
                              <p className="text-gray-500 text-xs leading-relaxed mb-3">{event.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-auto">
                              <div className="flex items-center gap-1 text-[11px] font-black text-primary-600">
                                <Clock size={12} />
                                {format(new Date(event.eventDate), 'M월 d일')}
                                {event.endDate && event.endDate !== event.eventDate && ` ~ ${format(new Date(event.endDate), 'M월 d일')}`}
                              </div>
                              {event.startTime && (
                                <div className="px-2 py-0.5 rounded-md bg-white/50 text-[10px] font-black text-gray-500">
                                  {event.startTime} {event.endTime && `~ ${event.endTime}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 참석 체크 영역 */}
                        <div className="mt-4 pt-4 border-t border-white/50">
                          {!isPast && (
                            isSaved ? (
                              <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black shadow-inner
                                ${myStatus === 'PRESENT' ? 'bg-emerald-500 text-white' : 'bg-red-400 text-white'}`}>
                                {myStatus === 'PRESENT' ? <Check size={14}/> : <X size={14}/>}
                                {myStatus === 'PRESENT' ? '참석 완료' : '불참 처리됨'}
                              </div>
                            ) : selected === event.id ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setStatusMap(m => ({ ...m, [event.id]: 'PRESENT' })); saveAttendance({ eventId: event.id, status: 'PRESENT' }) }}
                                  disabled={isPending}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-500 text-white text-xs font-black active:bg-emerald-600 shadow-sm transition-all active:scale-95"
                                >
                                  <Check size={14}/> 참석
                                </button>
                                <button
                                  onClick={() => { setStatusMap(m => ({ ...m, [event.id]: 'ABSENT' })); saveAttendance({ eventId: event.id, status: 'ABSENT' }) }}
                                  disabled={isPending}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-red-400 text-white text-xs font-black active:bg-red-500 shadow-sm transition-all active:scale-95"
                                >
                                  <X size={14}/> 불참
                                </button>
                                <button onClick={() => setSelected(null)} className="px-4 py-3 rounded-xl bg-white text-gray-500 text-xs font-black shadow-sm">취소</button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setSelected(event.id)}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/80 hover:bg-white text-gray-700 text-xs font-black transition-all shadow-sm border border-white/50 active:scale-[0.98]"
                              >
                                <CheckSquare size={14} className="text-primary-500" />
                                참석 여부 체크하기
                              </button>
                            )
                          )}

                          {isPast && (
                            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-400 bg-gray-100/30 py-2 rounded-lg">
                              <X size={12} />
                              지난 행사입니다
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}