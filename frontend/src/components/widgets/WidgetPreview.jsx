import { CalendarDays, Circle, CircleCheck, ChevronRight } from 'lucide-react'
import './WidgetPreview.css'

export default function WidgetPreview({ snapshot, compact = false, onCheck, onOpen = () => {}, pendingId }) {
  const tasks = (snapshot?.tasks || []).filter(t => t.state !== 'none')
  const done = tasks.filter(t => t.state === 'done').length
  const checks = snapshot?.checks || []
  const event = snapshot?.events?.[0]
  return <section className={`widget-preview ${compact ? 'widget-preview--compact' : ''}`} aria-label="나의 체크 위젯 미리보기">
    <header><strong>NEWAVE <span>FLOW</span></strong><time>{snapshot?.date?.slice(5).replace('-', '.')}</time></header>
    <div className="widget-preview__body">
      <button type="button" className="widget-preview__event" onClick={() => onOpen(event?.path || '/calendar')}>
        <span><CalendarDays size={13}/> 가까운 일정{event && ` · ${event.date.slice(5).replace('-', '.')} ${event.time}`}</span>
        <strong>{event?.title || '등록된 일정이 없어요'}</strong>
      </button>
      <div className="widget-preview__checks"><div className="widget-preview__label"><strong>오늘 영성 체크</strong><button type="button" onClick={() => onOpen('/tts')}>전체 <ChevronRight size={12}/></button></div>
        {!checks.length && <p className="widget-preview__empty">오늘 체크할 항목이 없어요</p>}
        {checks.slice(0, 3).map(check => <button key={check.id} type="button" aria-pressed={check.checked}
          disabled={!onCheck || pendingId != null} className={`widget-preview__check ${check.checked ? 'is-checked' : ''}`}
          onClick={() => onCheck(check)}>
          {check.checked ? <CircleCheck size={20}/> : <Circle size={20}/>}<span>{check.title}</span>{pendingId === check.id && <small>저장 중</small>}
        </button>)}
      </div>
      <div className="widget-preview__weekly"><div className="widget-preview__label"><strong>이번 주 체크</strong><b>{done}<span> / {tasks.length}</span></b></div>
        {[...tasks].sort((a,b) => Number(a.state === 'done') - Number(b.state === 'done')).slice(0, compact ? 1 : 2).map(task => <button type="button" key={task.id} onClick={() => onOpen(task.path)}><span>{task.title}</span><small>{task.state === 'done' ? '완료' : '확인'}<ChevronRight size={13}/></small></button>)}
        {!tasks.length && <p className="widget-preview__empty">이번 주 체크할 항목이 없어요</p>}
      </div>
    </div>
  </section>
}
