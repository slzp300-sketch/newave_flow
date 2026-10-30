import { useState, useLayoutEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, ChevronRight, RefreshCw, X } from 'lucide-react'
import Header from '../components/layout/Header'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import GradeLabel from '../components/common/GradeLabel'
import { FilterResults } from '../components/common/AdminTools'
import Button from '../components/common/Button'
import useToday from '../hooks/useToday'
import useAuthStore from '../store/authStore'
import client from '../api/client'
import { eventToday, eventAttendanceState, eventAttendanceLabels, eventAttendanceDeadline } from '../utils/eventAttendance'
import { eventAttendanceCounts } from '../utils/eventAttendanceSummary'
import { EVENT_ATTENDANCE_STATUSES, attendanceStatusOf, studentAttendancePeople, teacherAttendancePeople, groupEventAttendance, filterEventAttendance, eventAttendanceTabs } from '../utils/eventAttendanceAdmin'
import { matchesAdminSearch } from '../utils/adminSearch'
import { formatDate } from '../utils/date'
import './EventAttendanceAdminPage.css'

const rangeLabel = event => `${event.eventDate}${event.endDate && event.endDate !== event.eventDate ? ` ~ ${event.endDate}` : ''}`
const targetLabel = event => ({ TEACHER_ONLY: '교사', BOTH: '학생·교사' })[event.attendanceTarget] || '학생'

export default function EventAttendanceAdminPage() {
  const { user, apiEnvironment } = useAuthStore()
  const scope = [apiEnvironment, user?.id]
  const today = useToday(eventToday)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const returnPosition = useRef(null)
  const heading = useRef(null)
  const query = useQuery({ queryKey: ['attendance-required-events', ...scope], queryFn: ({ signal }) => client.get('/events/attendance-required', { signal }).then(r => r.data) })
  const events = query.data || []
  const selected = events.find(event => event.id === selectedId)
  const filtered = events.filter(event => matchesAdminSearch(search, event.title, event.eventDate, event.endDate)
    && (period === 'all' || eventAttendanceState(event, today) === period))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.id - a.id)
  const open = event => { returnPosition.current = { id: event.id, top: window.scrollY }; setSelectedId(event.id) }
  useLayoutEffect(() => {
    if (selectedId || !returnPosition.current) return
    const { id, top } = returnPosition.current
    window.scrollTo({ top, behavior: 'instant' })
    ;(document.getElementById(`attendance-event-${id}`) || heading.current)?.focus({ preventScroll: true })
  }, [selectedId])
  return <div className="admin-event-attendance-page">
    <Header title="행사 출석 관리" showBack />
    <div className="event-attendance-body">
      {selectedId ? <>
        <button type="button" className="event-attendance-back" onClick={() => setSelectedId(null)}><ArrowLeft size={16} aria-hidden="true" />행사 목록</button>
        <ReadState query={query} label="행사 정보">{selected ? <EventDetail key={selected.id} event={selected} today={today} scope={scope} refreshEvent={() => query.refetch()} /> : <p className="event-attendance-empty">선택한 행사가 없습니다.</p>}</ReadState>
      </> : <>
        <div className="event-attendance-heading"><h2 ref={heading} tabIndex={-1} className="ui-section-title">행사별 출석</h2><RefreshButton busy={query.isFetching} onClick={() => query.refetch()} /></div>
        <SearchField label="출석 행사 검색" value={search} onChange={setSearch} placeholder="행사 이름 또는 날짜 검색" />
        <SegmentedControl label="행사 접수 상태" value={period} onChange={setPeriod} options={[{ value: 'all', label: '전체' }, { value: 'open', label: '접수 중' }, { value: 'closed', label: '접수 종료' }]} />
        <ReadState query={query} label="행사 목록">
          <FilterResults count={filtered.length} total={events.length} unit="건" filtered={!!search.trim() || period !== 'all'} onReset={() => { setSearch(''); setPeriod('all') }} />
          {!filtered.length ? <div className="event-attendance-empty"><CalendarDays size={24} aria-hidden="true" />{events.length ? '조건에 맞는 행사가 없습니다.' : '출석을 확인할 행사가 없습니다.'}</div>
            : <div className="event-attendance-grid">{filtered.map(event => <button type="button" className="event-attendance-card event-attendance-event" id={`attendance-event-${event.id}`} key={event.id} onClick={() => open(event)} aria-label={`${event.title} 출석 현황`}>
              <span className="event-attendance-card-meta"><time dateTime={event.eventDate}>{event.eventDate}</time><span>{targetLabel(event)}</span></span>
              <strong className="event-attendance-card-title">{event.title}</strong>
              <span className="event-attendance-card-footer"><span className={`event-attendance-reception reception-${eventAttendanceState(event, today)}`}>{eventAttendanceLabels[eventAttendanceState(event, today)]}</span><ChevronRight size={16} aria-hidden="true" /></span>
            </button>)}</div>}
        </ReadState>
      </>}
    </div>
  </div>
}

function EventDetail({ event, today, scope, refreshEvent }) {
  const heading = useRef(null), resultsHeading = useRef(null)
  const [activeTab, setActiveTab] = useState(event.attendanceTarget === 'TEACHER_ONLY' ? 'teacher' : 'student')
  const [grade, setGrade] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [personId, setPersonId] = useState(null)
  const studentsQuery = useQuery({ queryKey: ['attendance-summary', event.id, ...scope], queryFn: ({ signal }) => client.get(`/events/${event.id}/student-attendance/summary`, { signal }).then(r => r.data) })
  const teachersQuery = useQuery({ queryKey: ['teacher-attendance-summary', event.id, ...scope], queryFn: ({ signal }) => client.get(`/events/${event.id}/teacher-attendance/summary`, { signal }).then(r => r.data) })
  const students = studentAttendancePeople(studentsQuery.data || [])
  const teachers = teacherAttendancePeople(teachersQuery.data || [])
  const tabs = eventAttendanceTabs(event, students, teachers)
  // A failed history lookup remains reachable for retry instead of looking empty.
  if (studentsQuery.isError && !tabs.some(t => t.value === 'student')) tabs.unshift({ value: 'student', label: '학생 출석' })
  if (teachersQuery.isError && !tabs.some(t => t.value === 'teacher')) tabs.push({ value: 'teacher', label: '교사 출석' })
  const tab = tabs.some(t => t.value === activeTab) ? activeTab : tabs[0].value
  const query = tab === 'student' ? studentsQuery : teachersQuery
  const people = tab === 'student' ? students : teachers
  const scoped = grade ? people.filter(person => person.gradeGroup === grade) : people
  const counts = eventAttendanceCounts(scoped)
  const groups = groupEventAttendance(people)
  const rows = filterEventAttendance(people, { grade, search, status })
  const showPeople = showAll || grade !== null || !!search.trim() || status !== 'all'
  const selectedPerson = people.find(person => person.id === personId)
  const refresh = () => { void Promise.allSettled([refreshEvent(), studentsQuery.refetch(), teachersQuery.refetch()]) }
  useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); heading.current?.focus({ preventScroll: true }) }, [])
  useLayoutEffect(() => { if (grade) resultsHeading.current?.focus({ preventScroll: true }) }, [grade])
  const changeTab = value => { setActiveTab(value); setGrade(null); setSearch(''); setStatus('all'); setShowAll(false); setPersonId(null) }
  const resetFilters = () => { setGrade(null); setSearch(''); setStatus('all'); setShowAll(false) }
  return <>
    <section className="event-attendance-detail-heading">
      <div className="event-attendance-heading"><h2 ref={heading} tabIndex={-1}>{event.title}</h2><RefreshButton busy={studentsQuery.isFetching || teachersQuery.isFetching} onClick={refresh} /></div>
      <p>{rangeLabel(event)}</p>
      <div className="event-attendance-reception-line"><span className={`event-attendance-reception reception-${eventAttendanceState(event, today)}`}>{eventAttendanceLabels[eventAttendanceState(event, today)]}</span><span>마감 {eventAttendanceDeadline(event)}</span></div>
    </section>
    {tabs.length > 1 ? <SegmentedControl label="행사 출석 대상" value={tab} onChange={changeTab} options={tabs} /> : <h3 className="ui-section-title">{tabs[0].label}</h3>}
    <ReadState query={query} label={tab === 'student' ? '학생 출석' : '교사 출석'}>
      <div className="event-attendance-scope">
        <span>{grade ? <GradeLabel value={grade} /> : '전체 학년'}</span>
        <button type="button" aria-label={`전체 ${counts.total}명 보기`} aria-pressed={status === 'all'} onClick={() => { setStatus('all'); setShowAll(true) }}>전체 <strong>{counts.total}</strong>명</button>
      </div>
      <div className="event-attendance-metrics" role="group" aria-label="출석 상태 필터">{EVENT_ATTENDANCE_STATUSES.map(item => <button type="button" key={item.value} aria-pressed={status === item.value} aria-label={`${item.label} ${counts[item.count]}명 보기`} onClick={() => setStatus(status === item.value ? 'all' : item.value)}>
        <span>{item.label}</span><strong className={`attendance-tone-${item.tone}`}>{counts[item.count]}<small>명</small></strong>
      </button>)}</div>
      <SearchField label="출석 인원 검색" value={search} onChange={setSearch} placeholder={tab === 'student' ? '이름·학년·반 검색' : '이름·학년 검색'} />
      {showPeople ? <>
        <div className="event-attendance-heading"><h3 ref={resultsHeading} tabIndex={-1} className="ui-section-title">{grade ? `${grade} ` : ''}{tab === 'student' ? '학생 명단' : '교사 명단'}</h3><button type="button" className="event-attendance-back" onClick={resetFilters}><ArrowLeft size={16} aria-hidden="true" />학년별 보기</button></div>
        <FilterResults count={rows.length} total={people.length} filtered={!!grade || !!search.trim() || status !== 'all'} onReset={resetFilters} />
        {!rows.length ? <p className="event-attendance-empty">조건에 맞는 인원이 없습니다.</p> : <div className="event-attendance-grid">{rows.map(person => <button type="button" className="event-attendance-card event-attendance-person" key={person.id} onClick={() => setPersonId(person.id)} aria-haspopup="dialog" aria-label={`${person.name} · ${attendanceStatusOf(person.status).label} · 상세 보기`}>
          <strong className="event-attendance-card-title">{person.name}</strong>
          <span className="event-attendance-person-context">{tab === 'student' ? person.className.includes(person.gradeGroup) ? person.className : `${person.gradeGroup} · ${person.className}` : person.grade || person.gradeGroup}</span>
          <span className="event-attendance-card-footer"><AttendanceBadge status={person.status} /><ChevronRight size={16} aria-hidden="true" /></span>
        </button>)}</div>}
      </> : <>
        <h3 className="ui-section-title">학년별 현황</h3>
        {!groups.length ? <p className="event-attendance-empty">출석 대상자가 없습니다.</p> : <div className="event-attendance-grid">{groups.map(group => <button type="button" className="event-attendance-card" key={group.grade} onClick={() => setGrade(group.grade)} aria-label={`${group.grade} ${tab === 'student' ? '학생' : '교사'} ${group.counts.total}명 보기`}>
          <span><GradeLabel value={group.grade} /></span>
          <strong className="event-attendance-card-title">제출 {group.counts.total - group.counts.unsubmitted} / {group.counts.total}명</strong>
          <span className="event-attendance-card-footer"><span>미제출 {group.counts.unsubmitted}명</span><ChevronRight size={16} aria-hidden="true" /></span>
        </button>)}</div>}
      </>}
    </ReadState>
    {selectedPerson && <PersonDialog person={selectedPerson} kind={tab} onClose={() => setPersonId(null)} />}
  </>
}

function ReadState({ query, label, children }) {
  if (query.isError) return <div role="alert" className="event-attendance-error"><p>{label}을 불러오지 못했습니다.</p><Button size="sm" variant="secondary" disabled={query.isFetching} onClick={() => query.refetch()}>다시 불러오기</Button></div>
  if (query.isPending || query.fetchStatus === 'paused') return <p role="status" className="event-attendance-empty">{label} 확인 중…</p>
  return children
}
function RefreshButton({ busy, onClick }) { return <button type="button" className="event-attendance-refresh" aria-label="최신 자료 확인" disabled={busy} onClick={onClick}><RefreshCw size={16} aria-hidden="true" className={busy ? 'animate-spin motion-reduce:animate-none' : ''} /><span>{busy ? '확인 중' : '새로고침'}</span></button> }
function AttendanceBadge({ status }) { const item = attendanceStatusOf(status); return <span className={`event-attendance-badge attendance-tone-${item.tone}`}>{item.label}</span> }

function PersonDialog({ person, kind, onClose }) {
  const dialog = useRef(null), heading = useRef(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const node = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow
    const position = { left: window.scrollX, top: window.scrollY, behavior: 'instant' }
    node.showModal(); document.body.style.overflow = 'hidden'; window.scrollTo(position); heading.current?.focus({ preventScroll: true })
    return () => { node.close(); document.body.style.overflow = overflow; window.scrollTo(position); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={dialog} className="event-attendance-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose() }}>
    <header><h2 ref={heading} tabIndex={-1} id={titleId}>{person.name}</h2><button type="button" aria-label="출석 상세 닫기" onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
    <dl>
      <div><dt>학년</dt><dd><GradeLabel value={person.grade || person.gradeGroup} /></dd></div>
      {kind === 'student' && <div><dt>반</dt><dd>{person.className}</dd></div>}
      <div><dt>출석</dt><dd><AttendanceBadge status={person.status} /></dd></div>
      {person.status === 'ABSENT' && <div><dt>불참 사유</dt><dd>{person.absenceReason || '미입력'}</dd></div>}
      {person.status === 'PARTIAL' && <><div><dt>참석 시작</dt><dd>{person.partialFromDate ? formatDate(person.partialFromDate) : '미입력'}</dd></div><div><dt>메모</dt><dd>{person.partialNote || '미입력'}</dd></div></>}
    </dl>
  </dialog>, document.body)
}
