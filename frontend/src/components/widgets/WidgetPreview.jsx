import { CalendarDays, Circle, CircleCheck, ChevronRight, Check } from 'lucide-react'
import { pendingWidgetTasks, widgetMonth, widgetType } from '../../utils/widgetFamily'
import './WidgetPreview.css'

export default function WidgetPreview({ snapshot, type = 'combined', compact = false, onCheck, onOpen = () => {}, pendingId }) {
  const variant = widgetType(type)
  const tasks = pendingWidgetTasks(snapshot), checks = snapshot?.checks || []
  const events = snapshot?.events || [], month = widgetMonth(snapshot)
  const small = compact && variant.id !== 'calendar'
  const daily = () => <div className="widget-preview__check-list" role="group" aria-label="오늘 영성 체크">
    {checks.slice(0, 3).map(check => <button key={check.id} type="button" aria-pressed={onCheck ? check.checked : undefined}
      aria-label={onCheck ? check.title : `${check.title} · 영성 체크 열기`} aria-busy={pendingId === check.id || undefined}
      disabled={pendingId != null} className={`widget-preview__check ${check.checked ? 'is-checked' : ''}`}
      onClick={() => onCheck ? onCheck(check) : onOpen('/tts')}>
      {check.checked ? <CircleCheck size={24}/> : <Circle size={24}/>}<span>{check.title}</span>{pendingId === check.id && <small>저장 중</small>}
    </button>)}
    {!checks.length && <button className="widget-preview__empty" onClick={() => onOpen('/tts')}>오늘 체크할 항목이 없어요 <ChevronRight size={14}/></button>}
  </div>
  const schedule = event => <button key={event?.path || 'empty'} type="button" className="widget-preview__event" onClick={() => onOpen(event?.path || '/calendar')}>
    <span className="widget-preview__date-tile">{event ? <><small>{Number(event.date.slice(5, 7))}월</small><b>{Number(event.date.slice(8))}</b></> : <CalendarDays size={23}/>}</span>
    <span className="widget-preview__event-text"><strong>{event?.title || '예정된 일정이 없어요'}</strong><small>{event?.time || (event ? '종일' : '교회 달력 보기')}</small></span><ChevronRight size={14}/>
  </button>
  const weekly = limit => <div className="widget-preview__weekly">
    <div className="widget-preview__label"><strong>이번 주 남은 체크</strong><b>{tasks.length}<small>개</small></b></div>
    {tasks.slice(0, limit).map(task => <button type="button" className="widget-preview__task" key={task.id} onClick={() => onOpen(task.path)}><Circle size={16}/><span>{task.title}</span><ChevronRight size={14}/></button>)}
    {!tasks.length && <div className="widget-preview__complete"><Check size={22}/>남은 체크가 없어요</div>}
    {tasks.length > limit && <button type="button" className="widget-preview__overflow" onClick={() => onOpen('/')}>남은 {tasks.length - limit}개 더 보기 <ChevronRight size={14}/></button>}
  </div>
  return <section className={`widget-preview widget-preview--${variant.id} ${small ? 'widget-preview--compact' : 'widget-preview--large'}`} aria-label={`${variant.title} 위젯 미리보기`}>
    <header><strong>NEWAVE <span>FLOW</span></strong><time>{snapshot?.date?.slice(5).replace('-', '.')}</time></header>
    <div className="widget-preview__body">
      {variant.id === 'daily' && <><div className="widget-preview__label"><strong>오늘의 말씀과 기도</strong><b>{checks.filter(c => c.checked).length}<small> / {checks.length}</small></b></div>{daily()}{checks.length > 3 && <button className="widget-preview__overflow" onClick={() => onOpen('/tts')}>전체 영성 체크 <ChevronRight size={14}/></button>}</>}
      {variant.id === 'weekly' && weekly(small ? (tasks.length > 2 ? 1 : 2) : 4)}
      {variant.id === 'combined' && <>{schedule(events[0])}<div className="widget-preview__combined-checks">{daily()}<button className="widget-preview__remaining" onClick={() => onOpen(tasks[0]?.path || '/')} aria-label={`이번 주 남은 체크 ${tasks.length}개`}><small>이번 주</small><b>{tasks.length}<small>개</small></b></button></div>{!small && weekly(2)}</>}
      {variant.id === 'calendar' && <><div className="widget-preview__label"><strong>{month?.year}년 {month?.month}월</strong><CalendarDays size={17}/></div>
        <button type="button" className="widget-preview__month" onClick={() => onOpen(`/calendar?date=${snapshot.date}`)} aria-label={`${month?.month}월 교회 달력 열기`}>
          {['일','월','화','수','목','금','토'].map(day => <span className="widget-preview__weekday" key={day}>{day}</span>)}
          {month?.cells.map((cell, index) => <span key={index} className={`widget-preview__day ${cell?.today ? 'is-today' : ''}`}><span>{cell?.day}</span><i className={cell?.event ? 'has-event' : ''}/></span>)}
        </button>{month && !month.available && <p className="widget-preview__empty">일정 표시를 불러오려면 앱을 새로고침해주세요.</p>}
        <div className="widget-preview__events">{events.length ? events.slice(0, 2).map(schedule) : schedule(null)}</div></>}
    </div>
  </section>
}
