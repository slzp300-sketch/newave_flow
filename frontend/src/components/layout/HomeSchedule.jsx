import { useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import useWeeklyEvents from '../../hooks/useWeeklyEvents'
import AttentionDot from '../common/AttentionDot'
import FeatureIcon from '../common/FeatureIcon'
import QueryNotice from '../common/QueryNotice'
import EventReadNotice from '../common/EventReadNotice'
import { knownRead } from '../../utils/attention'
import { isEventEnded, eventAttendanceState } from '../../utils/eventAttendance'
import EventAttendanceStatus from '../calendar/EventAttendanceStatus'

const dateOf = value => new Date(value + 'T12:00:00')

export default function HomeSchedule() {
  const { query, events, today, from, to, isNew, markSeen, hasNew, isSaving, readError, retryReads } = useWeeklyEvents()
  const [openId, setOpenId] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const upcoming = events.filter(e => (e.endDate || e.eventDate) >= today)
  const visible = showAll ? events : upcoming.slice(0, 3)
  return <section aria-label="이번 주 일정" className="brand-card relative rounded-2xl border border-primary-200 p-4">
    <AttentionDot show={hasNew} label="이번 주 새로 확인할 일정이 있어요" />
    <div className="mb-3 flex items-center justify-between gap-2 pr-2">
      <h2 className="flex items-center gap-2 text-base font-semibold"><span className="brand-heading-icon"><FeatureIcon path="/calendar" size={20} /></span>이번 주 일정</h2>
      <Link to="/calendar" className="brand-action flex min-h-11 items-center rounded-lg px-2 text-xs">달력 보기</Link>
    </div>
    <p className="mb-3 text-xs text-gray-500">{format(dateOf(from), 'M.d')} – {format(dateOf(to), 'M.d')} · 새 일정은 눌러서 확인해 주세요</p>
    {!knownRead(query) && <QueryNotice queries={[query]} label="이번 주 일정" />}
    <EventReadNotice error={readError} retry={retryReads} />
    {isSaving && <p role="status" className="mb-2 text-xs text-gray-500">확인 상태 저장 중…</p>}
    {query.data && <div className="space-y-2">
      {visible.map(event => <div key={event.id} className={`rounded-xl border border-primary-100 ${isEventEnded(event, today) ? 'event-inactive' : ''}`}>
        <button type="button" aria-expanded={openId === event.id} aria-controls={`home-event-${event.id}`}
          onClick={() => { setOpenId(openId === event.id ? null : event.id); if (knownRead(query) && isNew(event)) markSeen([event]) }}
          className="relative flex min-h-20 w-full items-center gap-3 rounded-xl p-3 pr-5 text-left">
          <AttentionDot show={knownRead(query) && isNew(event)} label="새 일정 또는 변경된 일정" />
          <span className="shrink-0 text-center"><strong className="block text-lg">{format(dateOf(event.eventDate), 'd')}</strong><span className="text-xs">{format(dateOf(event.eventDate), 'E', { locale: ko })}</span></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold break-keep">{event.title}</span>
            {isEventEnded(event, today) && <span className="mt-1 block text-xs text-gray-600">종료된 일정 · 내용 조회</span>}
            <span className="mt-1 block text-xs text-gray-500">{event.eventDate <= today && (event.endDate || event.eventDate) >= today ? '오늘 · ' : ''}{event.startTime || '종일'}{event.endDate && event.endDate !== event.eventDate ? ` · ${format(dateOf(event.endDate), 'M.d')}까지` : ''}</span></span>
          <ChevronDown size={16} aria-hidden="true" className={openId === event.id ? 'rotate-180 shrink-0' : 'shrink-0'} />
        </button>
        {openId === event.id && <div id={`home-event-${event.id}`} className="border-t border-primary-100 p-3 text-sm">
          <p className="text-xs text-gray-500">{event.eventDate}{event.endDate && event.endDate !== event.eventDate ? ` ~ ${event.endDate}` : ''} · {event.startTime || '종일'}{event.endTime ? ` ~ ${event.endTime}` : ''}</p>
          <p className="mt-2 whitespace-pre-wrap break-words">{event.description || '추가 안내가 없는 일정입니다.'}</p>
          <EventAttendanceStatus event={event} today={today} />
          {event.attendanceRequired && <Link className={`brand-action mt-3 flex min-h-11 items-center justify-center rounded-xl px-3 text-sm ${eventAttendanceState(event, today) !== 'open' ? 'event-inactive' : ''}`} to={`/event-attendance/${event.id}`}>{eventAttendanceState(event, today) === 'open' ? '행사 출석 체크' : '기존 출석 기록 보기'}</Link>}
        </div>}
      </div>)}
      {!visible.length && knownRead(query) && <p className="py-3 text-sm text-gray-500">이번 주 남은 일정이 없습니다.</p>}
      {(events.length > visible.length || showAll) && <button type="button" className="min-h-11 w-full rounded-xl text-xs" onClick={() => setShowAll(!showAll)}>{showAll ? '다가올 일정만 보기' : `이번 주 ${events.length}개 일정 모두 보기`}</button>}
    </div>}
  </section>
}
