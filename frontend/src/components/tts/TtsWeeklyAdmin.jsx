import { useState, useRef, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, RefreshCw, X } from 'lucide-react'
import { addDays, format, getWeek } from 'date-fns'
import useAuthStore from '../../store/authStore'
import { useTtsAdminField } from '../../store/ttsAdminViewStore'
import client from '../../api/client'
import WeekNavigator from '../common/WeekNavigator'
import SearchField from '../common/SearchField'
import GradeLabel from '../common/GradeLabel'
import { FilterResults } from '../common/AdminTools'
import AdminStatsNotice, { useAdminStatsReadState } from './AdminStatsNotice'
import { ttsAdminRefreshOptions } from '../../utils/ttsAdminRefresh'
import { getWeekStartByOffset, weekLabels, formatUpdatedAt } from '../../utils/date'
import { firstTtsOffset } from '../../utils/ttsPeriod'
import { rankingWeekDetail, rankingDateLabel } from '../../utils/ttsRankingDetails'
import { weeklyTtsPeople, weeklyTtsCounts, weeklyTtsGroups, filterWeeklyTts } from '../../utils/ttsAdminCompact'

export default function TtsWeeklyAdmin({ offset, onOffsetChange }) {
  const { user, apiEnvironment } = useAuthStore()
  const scope = `${apiEnvironment}:${user?.id}:${user?.role}`
  const [search, setSearch] = useTtsAdminField('summarySearch')
  const [grade, setGrade] = useState(null)
  const [status, setStatus] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState(null)
  const sunday = getWeekStartByOffset(offset, 0)
  const week = { year: addDays(sunday, 6).getFullYear(), weekNum: getWeek(sunday, { weekStartsOn: 0 }), start: format(sunday, 'yyyy-MM-dd'), end: format(addDays(sunday, 6), 'yyyy-MM-dd') }
  const query = useQuery({ queryKey: ['tts-admin-summary', week.year, week.weekNum, scope], ...ttsAdminRefreshOptions,
    queryFn: ({ signal }) => client.get('/admin/tts/summary', { params: { year: week.year, weekNum: week.weekNum }, signal }).then(r => r.data) })
  const state = useAdminStatsReadState(query)
  const people = weeklyTtsPeople(query.data || [])
  const groups = weeklyTtsGroups(people)
  const counts = weeklyTtsCounts(grade ? people.filter(person => person.gradeGroup === grade) : people)
  const rows = filterWeeklyTts(people, { grade, status, search })
  const showPeople = showAll || grade !== null || !!search.trim() || status !== 'all'
  const person = selected?.week === week.start ? people.find(row => row.key === selected.key) : null
  const reset = () => { setGrade(null); setSearch(''); setStatus('all'); setShowAll(false) }
  return <section className="tts-admin-body" aria-label="TTS 주간 현황">
    <WeekNavigator offset={offset} onChange={value => { setSelected(null); onOffsetChange(value) }} minOffset={firstTtsOffset()}
      title={`${weekLabels(sunday).monthWeek} TTS`} sub={weekLabels(sunday).yearWeek} range={`${format(sunday, 'M/d')} ~ ${format(addDays(sunday, 6), 'M/d')}`} />
    <div className="tts-admin-heading"><p className="tts-admin-muted">{grade ? <GradeLabel value={grade} /> : '전체 학년'} · 참여율 <strong>{state === 'ready' && counts.rate != null ? `${counts.rate}%` : '—'}</strong></p><button type="button" className="tts-admin-small-action" aria-label="주간 TTS 새로고침" disabled={query.isFetching || state === 'offline'} onClick={() => query.refetch()}><RefreshCw size={16} aria-hidden="true" />새로고침</button></div>
    <div className="tts-admin-metrics" role="group" aria-label="주간 참여 필터">{[
      { value: 'all', label: '전체', count: counts.total }, { value: 'participating', label: '참여', count: counts.participating }, { value: 'missing', label: '미참여', count: counts.missing },
    ].map(item => <button type="button" key={item.value} disabled={state !== 'ready'} aria-pressed={status === item.value} onClick={() => { setStatus(item.value); setShowAll(true) }}><span>{item.label}</span><strong>{state === 'ready' ? item.count : '—'}<small>명</small></strong></button>)}</div>
    <SearchField label="주간 TTS 교사 검색" value={search} onChange={setSearch} placeholder="이름·학년 검색" />
    {state !== 'ready' ? <AdminStatsNotice query={query} state={state} label="주간 현황" /> : showPeople ? <>
      <div className="tts-admin-heading"><h3 className="ui-section-title">{grade ? `${grade} 교사` : '교사 현황'}</h3><button type="button" className="tts-admin-small-action" onClick={reset}><ArrowLeft size={16} aria-hidden="true" />학년별 보기</button></div>
      <FilterResults count={rows.length} total={people.length} filtered={!!grade || !!search.trim() || status !== 'all'} onReset={reset} />
      {!rows.length ? <p className="tts-admin-empty">조건에 맞는 교사가 없습니다.</p> : <div className="tts-admin-grid">{rows.map((row, index) => <button type="button" key={row.key || index} className="tts-admin-card" disabled={!row.key} aria-haspopup="dialog" aria-label={`${row.teacherName} 주간 체크 내역`} onClick={() => setSelected({ key: row.key, week: week.start })}>
        <strong className="tts-admin-card-title">{row.teacherName}</strong><span className="tts-admin-card-meta">{row.grade || row.gradeGroup}</span>
        <span className="tts-admin-card-footer"><span className={row.isSubmitted ? 'tts-admin-positive' : 'tts-admin-muted'}>{row.isSubmitted ? '참여' : '미참여'} · {row.score ?? 0}점</span><ChevronRight size={16} aria-hidden="true" /></span>
      </button>)}</div>}
    </> : <>
      <h3 className="ui-section-title">학년별 현황</h3>
      {!groups.length ? <p className="tts-admin-empty">확인할 교사가 없습니다.</p> : <div className="tts-admin-grid">{groups.map(group => <button type="button" className="tts-admin-card" key={group.grade} aria-label={`${group.grade} 교사 ${group.total}명 보기`} onClick={() => setGrade(group.grade)}>
        <span><GradeLabel value={group.grade} /></span><strong className="tts-admin-card-title">참여 {group.participating} / {group.total}명</strong>
        <span className="tts-admin-card-footer"><span>미참여 {group.missing}명</span><ChevronRight size={16} aria-hidden="true" /></span>
      </button>)}</div>}
    </>}
    {person && <WeeklyDetail key={`${scope}:${week.start}:${person.key}`} person={person} week={week} scope={scope} onClose={() => setSelected(null)} />}
  </section>
}

function WeeklyDetail({ person, week, scope, onClose }) {
  const dialog = useRef(null), heading = useRef(null), titleId = useId()
  const query = useQuery({ queryKey: ['tts-week-stats', scope, 'admin-week', week.start, person.key], ...ttsAdminRefreshOptions,
    queryFn: async ({ signal }) => rankingWeekDetail((await client.get('/tts/stats/week', { params: { year: week.year, weekNum: week.weekNum }, signal })).data, person.key, week.start, { start: week.start, end: week.end }) })
  const state = useAdminStatsReadState(query)
  useLayoutEffect(() => {
    const node = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow
    const position = { left: window.scrollX, top: window.scrollY, behavior: 'instant' }
    node.showModal(); document.body.style.overflow = 'hidden'; window.scrollTo(position); heading.current?.focus({ preventScroll: true })
    return () => { node.close(); document.body.style.overflow = overflow; window.scrollTo(position); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  const detail = query.data
  return createPortal(<dialog ref={dialog} className="tts-admin-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2 ref={heading} tabIndex={-1} id={titleId}>{person.teacherName}</h2><button type="button" aria-label="주간 체크 내역 닫기" onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
    <div className="tts-admin-dialog-body">
      <p className="tts-admin-muted">{rankingDateLabel(week.start)} ~ {rankingDateLabel(week.end)}</p>
      <div className="tts-admin-heading"><GradeLabel value={person.grade || person.gradeGroup} /><strong>{person.score ?? 0}점 · {person.isSubmitted ? '참여' : '미참여'}</strong></div>
      {state !== 'ready' ? <AdminStatsNotice query={query} state={state} label="체크 내역" /> : !detail ? <p className="tts-admin-empty">조회할 기록이 없습니다.</p> : detail.imported ? <p className="tts-admin-note">시트 확정 점수 · 날짜별 체크 내역 없음</p> : <>
        <dl className="tts-admin-checks">{detail.dates.map(row => <div key={row.date}><dt>{rankingDateLabel(row.date)}</dt><dd>{row.titles.join(' · ')}</dd></div>)}
          {!!detail.weeklyItems.length && <div><dt>주간 체크</dt><dd>{detail.weeklyItems.join(' · ')}</dd></div>}
        </dl>
        {!detail.dates.length && !detail.weeklyItems.length && <p className="tts-admin-empty">체크한 항목이 없습니다.</p>}
        {person.updatedAt && <p className="tts-admin-muted">최근 저장 {formatUpdatedAt(person.updatedAt)}</p>}
      </>}
    </div>
  </dialog>, document.body)
}
