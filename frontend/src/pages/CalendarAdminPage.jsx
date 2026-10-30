import AppSelect from '../components/common/AppSelect'
import { useState, useLayoutEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, CalendarDays, ChevronRight, PenLine, Trash2, X, ToggleLeft, ToggleRight } from 'lucide-react'
import Header from '../components/layout/Header'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { FilterResults } from '../components/common/AdminTools'
import Button from '../components/common/Button'
import BulkEventForm, { AddEventChoice } from '../components/calendar/BulkEventForm'
import EventAttendanceFields from '../components/calendar/EventAttendanceFields'
import { DateRangeField } from '../components/calendar/DateRangePicker'
import useToday from '../hooks/useToday'
import useAuthStore from '../store/authStore'
import { matchesAdminSearch } from '../utils/adminSearch'
import { eventToday, isEventEnded, eventAttendanceTarget, eventAttendanceState, eventAttendanceLabels, validateAttendanceWindow } from '../utils/eventAttendance'
import { formatDate } from '../utils/date'
import client from '../api/client'
import './CalendarAdminPage.css'

const TYPES = [{ label: '정기 일정', value: 'REGULAR' }, { label: '특별 행사', value: 'SPECIAL' }, { label: '회의', value: 'MEETING' }, { label: '전체 일정', value: 'CHURCH_WIDE' }]
const COLORS = [{ name: '기본', value: '', hex: '#3157ad' }, { name: '파랑', value: 'blue', hex: '#3b82f6' }, { name: '빨강', value: 'red', hex: '#ef4444' }, { name: '초록', value: 'emerald', hex: '#10b981' }, { name: '보라', value: 'violet', hex: '#8b5cf6' }, { name: '주황', value: 'amber', hex: '#f59e0b' }, { name: '분홍', value: 'rose', hex: '#f43f5e' }]
const blankEvent = () => ({ title: '', description: '', eventDate: eventToday(), endDate: eventToday(), allDay: false, startTime: '12:00', endTime: '13:00', color: '', eventType: 'REGULAR', attendanceRequired: false, attendanceStartDate: '', attendanceDeadline: '', attendanceTarget: 'STUDENT_ONLY' })
const fieldsOf = event => {
  const end = event.endDate || event.eventDate, deadline = event.attendanceDeadline || end
  return { title: event.title, description: event.description || '', eventDate: event.eventDate, endDate: end, allDay: !event.startTime, startTime: event.startTime || '12:00', endTime: event.endTime || '', color: event.color || '', eventType: event.eventType, attendanceRequired: !!event.attendanceRequired, attendanceDeadline: deadline, attendanceStartDate: event.attendanceStartDate || (eventToday() > deadline ? deadline : eventToday()), attendanceTarget: event.attendanceTarget || 'STUDENT_ONLY' }
}
const errorText = (error, fallback) => error.response?.data?.message || fallback
const shortDate = date => date.slice(5).replace('-', '.')
const dateRange = (event, full = false) => {
  const date = full ? formatDate : shortDate
  return event.endDate && event.endDate !== event.eventDate ? `${date(event.eventDate)} ~ ${date(event.endDate)}` : date(event.eventDate)
}
const eventTime = event => !event.startTime ? '하루종일' : `${event.startTime.slice(0, 5)}${event.endTime ? ` ~ ${event.endTime.slice(0, 5)}` : ''}`

export default function CalendarAdminPage() {
  const qc = useQueryClient()
  const { user, apiEnvironment } = useAuthStore()
  const key = ['events-all', apiEnvironment, user?.id]
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => client.get('/events/all', { signal }).then(r => r.data) })
  const today = useToday(eventToday)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('all')
  const [selected, setSelected] = useState(null)
  const [showChoice, setShowChoice] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [message, setMessage] = useState('')
  const events = query.data || []
  const filtered = events.filter(e => matchesAdminSearch(search, e.title, e.description, e.eventDate) && (period === 'all' || (period === 'past' ? isEventEnded(e, today) : !isEventEnded(e, today))))
  const groups = [
    { label: '진행 중', list: filtered.filter(e => !isEventEnded(e, today) && e.eventDate <= today), order: 1 },
    { label: '다가올 일정', list: filtered.filter(e => e.eventDate > today), order: 1 },
    { label: '종료된 일정', list: filtered.filter(e => isEventEnded(e, today)), order: -1 },
  ]
  const invalidate = () => {
    for (const queryKey of [['events-all'], ['events'], ['attendance-required-events'], ['event']]) void qc.invalidateQueries({ queryKey })
  }
  const saved = event => {
    qc.setQueryData(key, old => [event, ...(old || []).filter(e => e.id !== event.id)])
    setSelected(event); invalidate()
  }
  const deleted = id => {
    qc.setQueryData(key, old => (old || []).filter(e => e.id !== id))
    setSelected(null); setMessage('일정 삭제 완료'); invalidate()
  }
  const open = event => { setSelected(event); setMessage('') }
  return <div className="admin-calendar-page">
    <Header title="일정 관리" showBack />
    <div className="calendar-admin-body">
      <div className="calendar-admin-heading"><h2 className="ui-section-title">부서 일정</h2><Button size="sm" onClick={() => setShowChoice(true)}><Plus size={16} aria-hidden="true" />일정 추가</Button></div>
      <SearchField label="관리할 일정 검색" value={search} onChange={setSearch} placeholder="일정 이름 또는 날짜 검색" />
      <SegmentedControl label="일정 기간" value={period} onChange={setPeriod} options={[{ value: 'all', label: '전체' }, { value: 'upcoming', label: '진행·예정' }, { value: 'past', label: '종료' }]} />
      {message && <p role="status" className="calendar-admin-success">{message}</p>}
      {query.isError ? <div role="alert" className="calendar-admin-error">일정을 불러오지 못했습니다.<Button variant="secondary" size="sm" onClick={() => query.refetch()}>다시 불러오기</Button></div>
        : query.isPending ? <p role="status" className="calendar-admin-empty">일정을 불러오는 중…</p> : <>
          <FilterResults count={filtered.length} total={events.length} unit="건" filtered={!!search.trim() || period !== 'all'} onReset={() => { setSearch(''); setPeriod('all') }} />
          {!filtered.length ? <div className="calendar-admin-empty"><CalendarDays size={28} aria-hidden="true" /><p>{search.trim() || period !== 'all' ? '조건에 맞는 일정이 없습니다.' : '등록된 일정이 없습니다.'}</p></div>
            : groups.filter(group => group.list.length).map(group => <section className="calendar-admin-group" key={group.label} aria-label={group.label}>
              <div className="calendar-admin-group-heading"><h3>{group.label}</h3><span>{group.list.length}건</span></div>
              <div className="calendar-admin-grid">{[...group.list].sort((a, b) => group.order * a.eventDate.localeCompare(b.eventDate) || a.id - b.id).map(event => <button type="button" key={event.id} className="calendar-admin-card" onClick={() => open(event)} aria-label={`${event.title} 상세 보기`} aria-haspopup="dialog" style={{ borderTopColor: isEventEnded(event, today) ? '#94a3b8' : COLORS.find(c => c.value === event.color)?.hex || '#3157ad' }}>
                <span className="calendar-admin-card-meta"><span>{dateRange(event)}</span><span>{TYPES.find(t => t.value === event.eventType)?.label}</span></span>
                <strong className="calendar-admin-card-title">{event.title}</strong>
                <span className="calendar-admin-card-footer"><span>{eventTime(event)}</span><ChevronRight size={16} aria-hidden="true" /></span>
              </button>)}</div>
            </section>)}
        </>}
    </div>
    {selected && <EventDialog key={selected.id || 'new'} event={selected} today={today} onClose={() => setSelected(null)} onSaved={saved} onDeleted={deleted} />}
    <AddEventChoice open={showChoice} onClose={() => setShowChoice(false)} onSingle={() => open({ isNew: true })} onBulk={() => setShowBulk(true)} />
    <BulkEventForm open={showBulk} onClose={() => setShowBulk(false)} />
  </div>
}

function EventDialog({ event, today, onClose, onSaved, onDeleted }) {
  const dialog = useRef(null), heading = useRef(null), titleInput = useRef(null), confirmPanel = useRef(null), errorPanel = useRef(null), busy = useRef(false)
  const titleId = useId()
  const [editing, setEditing] = useState(!!event.isNew)
  const [baseline, setBaseline] = useState(() => event.isNew ? blankEvent() : fieldsOf(event))
  const [draft, setDraft] = useState(baseline)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const dirty = editing && Object.keys(baseline).some(key => baseline[key] !== draft[key])
  const change = patch => setDraft(previous => ({ ...previous, ...patch }))
  useLayoutEffect(() => {
    const node = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow
    const position = { left: window.scrollX, top: window.scrollY, behavior: 'instant' }
    node.showModal(); document.body.style.overflow = 'hidden'; window.scrollTo(position)
    return () => { node.close(); document.body.style.overflow = overflow; window.scrollTo(position); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  useLayoutEffect(() => { (confirmation ? confirmPanel : editing ? titleInput : heading).current?.focus({ preventScroll: true }) }, [editing, confirmation])
  useLayoutEffect(() => { if (error) errorPanel.current?.focus() }, [error])
  const close = () => { if (!busy.current) dirty ? setConfirmation('close') : onClose() }
  const cancelEdit = () => { if (dirty) setConfirmation('edit'); else if (event.isNew) onClose(); else { setEditing(false); setError('') } }
  const discard = () => { if (confirmation === 'close' || event.isNew) onClose(); else { setEditing(false); setDraft(baseline); setError(''); setConfirmation(null) } }
  const edit = () => { const next = fieldsOf(event); setBaseline(next); setDraft(next); setEditing(true); setError(''); setMessage('') }
  const submit = async e => {
    e.preventDefault()
    if (busy.current) return
    if (!draft.title.trim()) { setError('일정 제목을 입력해 주세요.'); return }
    if (!draft.eventDate || !draft.endDate || draft.endDate < draft.eventDate) { setError('종료일은 시작일 이후로 선택해 주세요.'); return }
    const windowError = validateAttendanceWindow(draft)
    if (windowError) { setError(windowError); return }
    const { allDay, ...rest } = draft
    const payload = { ...rest, title: rest.title.trim(), description: rest.description.trim(), startTime: allDay ? null : rest.startTime || null, endTime: allDay ? null : rest.endTime || null, attendanceStartDate: rest.attendanceRequired ? rest.attendanceStartDate : null, attendanceDeadline: rest.attendanceRequired ? rest.attendanceDeadline : null }
    busy.current = true; setSaving(true); setError(''); setMessage('')
    try {
      const response = event.isNew ? await client.post('/events', payload) : await client.put(`/events/${event.id}`, payload)
      onSaved({ ...event, ...payload, ...response.data, isNew: false })
      setEditing(false); setMessage(event.isNew ? '일정 등록 완료' : '수정 완료')
    } catch (e) { setError(errorText(e, '저장하지 못했습니다. 다시 시도해 주세요.')) }
    finally { busy.current = false; setSaving(false) }
  }
  const remove = async () => {
    if (busy.current) return
    busy.current = true; setSaving(true); setError('')
    try { await client.delete(`/events/${event.id}`); onDeleted(event.id) }
    catch (e) { setError(errorText(e, '삭제하지 못했습니다. 다시 시도해 주세요.')) }
    finally { busy.current = false; setSaving(false) }
  }
  return createPortal(<dialog ref={dialog} className="calendar-admin-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close() }}>
    <header className="calendar-admin-dialog-heading"><h2 ref={heading} tabIndex={-1} id={titleId}>{editing ? event.isNew ? '일정 등록' : '일정 수정' : event.title}</h2><button type="button" className="calendar-admin-close" aria-label="일정 상세 닫기" disabled={saving} onClick={close}><X size={22} aria-hidden="true" /></button></header>
    <div className="calendar-admin-dialog-body">
      {error && <p ref={errorPanel} tabIndex={-1} role="alert" className="calendar-admin-error">{error}</p>}
      {message && <p role="status" className="calendar-admin-success">{message}</p>}
      {confirmation ? <section ref={confirmPanel} tabIndex={-1} role="alertdialog" aria-label={confirmation === 'delete' ? '일정 삭제 확인' : '수정 내용 취소 확인'} className="calendar-admin-confirm">
        <p>{confirmation === 'delete' ? '이 일정과 출석 기록을 삭제할까요?' : '저장하지 않은 내용을 버릴까요?'}</p>
        <div className="calendar-admin-actions"><Button size="sm" disabled={saving} onClick={confirmation === 'delete' ? remove : discard}>{confirmation === 'delete' ? '삭제 확정' : '버리기'}</Button><Button size="sm" variant="secondary" disabled={saving} onClick={() => setConfirmation(null)}>{confirmation === 'delete' ? '취소' : '계속 작성'}</Button></div>
      </section> : editing ? <form onSubmit={submit} aria-label={event.isNew ? '일정 등록' : '일정 수정'}>
        <fieldset disabled={saving} className="calendar-admin-form">
          <label>일정 제목<input ref={titleInput} value={draft.title} required maxLength={200} onChange={e => change({ title: e.target.value })} /></label>
          <div className="calendar-admin-date"><span>날짜</span><DateRangeField label="일정 날짜 선택" portalTarget={() => dialog.current} start={draft.eventDate} end={draft.endDate} onChange={(eventDate, endDate) => change({ eventDate, endDate })} className="w-full min-h-11 rounded-xl border px-3 py-2 text-base" /></div>
          <EventSwitch label="하루종일" checked={draft.allDay} onChange={() => change({ allDay: !draft.allDay })} />
          {!draft.allDay && <div className="calendar-admin-field-pair">
            <label>시작 시간<input type="time" required value={draft.startTime} onChange={e => change({ startTime: e.target.value })} /></label>
            <label>종료 시간<input type="time" value={draft.endTime} onChange={e => change({ endTime: e.target.value })} /></label>
          </div>}
          <label>구분<AppSelect aria-label="구분" value={draft.eventType} onChange={e => change({ eventType: e.target.value })}>{TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</AppSelect></label>
          <fieldset className="calendar-admin-colors"><legend>색상</legend><div>{COLORS.map(color => <button key={color.value} type="button" aria-label={color.name} aria-pressed={draft.color === color.value} onClick={() => change({ color: color.value })}><span style={{ backgroundColor: color.hex }} /></button>)}</div></fieldset>
          <label>설명 · 선택<textarea rows={3} value={draft.description} onChange={e => change({ description: e.target.value })} /></label>
          <EventSwitch label="출석 체크" checked={draft.attendanceRequired} onChange={() => change({ attendanceRequired: !draft.attendanceRequired, attendanceStartDate: draft.attendanceStartDate || (eventToday() > draft.endDate ? draft.endDate : eventToday()), attendanceDeadline: draft.attendanceDeadline || draft.endDate })} />
          {draft.attendanceRequired && <EventAttendanceFields value={draft} onChange={change} />}
          <div className="calendar-admin-actions"><Button type="submit" size="sm" loading={saving}>{saving ? '저장 중…' : event.isNew ? '등록 완료' : '수정 저장'}</Button><Button type="button" size="sm" variant="secondary" onClick={cancelEdit}>취소</Button></div>
        </fieldset>
      </form> : <>
        <dl className="calendar-admin-detail">
          <div><dt>날짜</dt><dd>{dateRange(event, true)}</dd></div>
          <div><dt>시간</dt><dd>{eventTime(event)}</dd></div>
          <div><dt>구분</dt><dd>{TYPES.find(type => type.value === event.eventType)?.label || event.eventType}</dd></div>
          <div><dt>출석 체크</dt><dd>{event.attendanceRequired ? eventAttendanceLabels[eventAttendanceState(event, today)] : '사용 안 함'}</dd></div>
          {event.attendanceRequired && <><div><dt>대상</dt><dd>{eventAttendanceTarget(event)}</dd></div><div><dt>접수 기간</dt><dd>{event.attendanceStartDate ? formatDate(event.attendanceStartDate) : '시작일 미지정'} ~ {formatDate(event.attendanceDeadline || event.endDate || event.eventDate)}</dd></div></>}
        </dl>
        {event.description && <section aria-label="일정 설명" className="calendar-admin-description">{event.description}</section>}
        <div className="calendar-admin-actions"><Button size="sm" variant="secondary" onClick={edit}><PenLine size={16} aria-hidden="true" />수정</Button><button type="button" className="calendar-admin-delete" onClick={() => { setError(''); setConfirmation('delete') }}><Trash2 size={16} aria-hidden="true" />삭제</button></div>
      </>}
    </div>
  </dialog>, document.body)
}

function EventSwitch({ label, checked, onChange }) {
  return <button type="button" className="calendar-admin-switch" role="switch" aria-label={label} aria-checked={checked} onClick={onChange}><span>{label}</span>{checked ? <ToggleRight size={28} aria-hidden="true" /> : <ToggleLeft size={28} aria-hidden="true" />}</button>
}
