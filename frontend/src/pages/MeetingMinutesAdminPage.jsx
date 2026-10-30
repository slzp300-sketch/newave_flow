import { useState, useLayoutEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, FileText, Play, PenLine, Trash2, X, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react'
import Header from '../components/layout/Header'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { FilterResults } from '../components/common/AdminTools'
import Button from '../components/common/Button'
import DisclosureSummary from '../components/common/DisclosureSummary'
import GradeAttendanceList from '../components/common/GradeAttendanceList'
import { matchesAdminSearch } from '../utils/adminSearch'
import { formatDate, toApiDate } from '../utils/date'
import useAuthStore from '../store/authStore'
import client from '../api/client'
import './MeetingMinutesAdminPage.css'

const blankMinute = () => ({ title: '', content: '', videoLink: '', meetingDate: toApiDate(new Date()), isActive: true })
const fieldsOf = m => ({ title: m.title || '', content: m.content || '', videoLink: m.videoLink || '', meetingDate: m.meetingDate, isActive: !!m.isActive })
const errorText = (error, fallback) => error.response?.data?.message || fallback
const videoUrl = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null } }

export default function MeetingMinutesAdminPage() {
  const qc = useQueryClient()
  const { user, apiEnvironment } = useAuthStore()
  const key = ['admin-minutes', apiEnvironment, user?.id]
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => client.get('/minutes', { signal }).then(r => r.data) })
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('all')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const minutes = query.data || []
  const filtered = minutes.filter(m => matchesAdminSearch(search, m.title, m.meetingDate) && (visibility === 'all' || (visibility === 'public' ? m.isActive : !m.isActive)))
  const groups = new Map()
  for (const m of [...filtered].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate) || b.id - a.id)) {
    const month = m.meetingDate.slice(0, 7)
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month).push(m)
  }
  const open = minute => { setMessage(''); setSelected(minute) }
  const saved = minute => {
    qc.setQueryData(key, old => [minute, ...(old || []).filter(m => m.id !== minute.id)])
    setSelected(minute)
    void qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
    void qc.invalidateQueries({ queryKey: ['weekly-status'] })
    void qc.invalidateQueries({ queryKey: ['admin-minute-status'] })
  }
  const deleted = id => {
    qc.setQueryData(key, old => (old || []).filter(m => m.id !== id))
    setSelected(null); setMessage('회의록 삭제 완료')
    void qc.invalidateQueries({ queryKey: ['meeting-minutes'] })
    void qc.invalidateQueries({ queryKey: ['weekly-status'] })
  }
  return <div className="admin-minutes-page">
    <Header title="회의록 관리" showBack />
    <main className="minutes-body">
      <div className="minutes-list-heading"><h2 className="ui-section-title">회의록 목록</h2><Button size="sm" onClick={() => open({ isNew: true })}><Plus size={16} aria-hidden="true" />등록하기</Button></div>
      <SearchField label="관리할 회의록 검색" value={search} onChange={setSearch} placeholder="회의 제목 또는 날짜 검색" />
      <SegmentedControl label="회의록 공개 상태" value={visibility} onChange={setVisibility} options={[{ value: 'all', label: '전체' }, { value: 'public', label: '공개' }, { value: 'private', label: '비공개' }]} />
      {message && <p role="status" className="minutes-success">{message}</p>}
      {query.isError ? <div role="alert" className="minutes-error">회의록을 불러오지 못했습니다.<Button variant="secondary" size="sm" onClick={() => query.refetch()}>다시 불러오기</Button></div>
        : query.isPending ? <p role="status" className="minutes-empty">회의록을 불러오는 중…</p> : <>
          <FilterResults count={filtered.length} total={minutes.length} unit="건" filtered={!!search.trim() || visibility !== 'all'} onReset={() => { setSearch(''); setVisibility('all') }} />
          {!filtered.length ? <div className="minutes-empty"><FileText size={28} aria-hidden="true" /><p>{search.trim() || visibility !== 'all' ? '조건에 맞는 회의록이 없습니다.' : '등록된 회의록이 없습니다.'}</p></div>
            : [...groups].map(([month, items]) => <section className="minutes-month" key={month} aria-label={`${month} 회의록`}>
              <div className="minutes-month-heading"><h3>{month.slice(0, 4)}년 {Number(month.slice(5))}월</h3><span>{items.length}건</span></div>
              <div className="minutes-grid">{items.map(m => <button type="button" className="minutes-card" key={m.id} onClick={() => open(m)} aria-label={`${m.title} 상세 보기`} aria-haspopup="dialog">
                <span className="minutes-card-meta"><time dateTime={m.meetingDate}>{m.meetingDate.slice(5).replace('-', '.')}</time><VisibilityBadge active={m.isActive} /></span>
                <strong className="minutes-card-title">{m.title}</strong>
                <span className="minutes-card-footer">{m.videoLink && <span><Play size={12} aria-hidden="true" />영상</span>}<ChevronRight size={16} aria-hidden="true" /></span>
              </button>)}</div>
            </section>)}
        </>}
    </main>
    {selected && <MinuteDialog key={selected.id || 'new'} minute={selected} scope={[apiEnvironment, user?.id]} onClose={() => setSelected(null)} onSaved={saved} onDeleted={deleted} />}
  </div>
}

function MinuteDialog({ minute, scope, onClose, onSaved, onDeleted }) {
  const dialog = useRef(null)
  const heading = useRef(null)
  const titleInput = useRef(null)
  const confirmPanel = useRef(null)
  const busy = useRef(false)
  const titleId = useId()
  const [editing, setEditing] = useState(!!minute.isNew)
  const [draft, setDraft] = useState(() => minute.isNew ? blankMinute() : fieldsOf(minute))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const [showStatus, setShowStatus] = useState(false)
  const initial = minute.isNew ? blankMinute() : fieldsOf(minute)
  const dirty = editing && Object.keys(initial).some(key => draft[key] !== initial[key])
  const status = useQuery({ queryKey: ['admin-minute-status', ...scope, minute.id], enabled: !!minute.id && showStatus,
    queryFn: ({ signal }) => client.get(`/minutes/${minute.id}/status`, { signal }).then(r => r.data) })
  useLayoutEffect(() => {
    const node = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow
    const position = { left: window.scrollX, top: window.scrollY, behavior: 'instant' }
    node.showModal(); document.body.style.overflow = 'hidden'
    window.scrollTo(position)
    return () => { node.close(); document.body.style.overflow = overflow; window.scrollTo(position); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  useLayoutEffect(() => { (confirmation ? confirmPanel : editing ? titleInput : heading).current?.focus({ preventScroll: true }) }, [editing, confirmation])
  const close = () => { if (!busy.current) dirty ? setConfirmation('close') : onClose() }
  const cancelEdit = () => { if (dirty) setConfirmation('edit'); else if (minute.isNew) onClose(); else { setEditing(false); setError('') } }
  const discard = () => { if (confirmation === 'close' || minute.isNew) onClose(); else { setEditing(false); setDraft(fieldsOf(minute)); setError(''); setConfirmation(null) } }
  const persist = async (payload, success) => {
    if (busy.current) return
    busy.current = true; setSaving(true); setError(''); setMessage('')
    try {
      const response = minute.isNew ? await client.post('/minutes', payload) : await client.put(`/minutes/${minute.id}`, payload)
      onSaved({ ...minute, ...response.data, ...payload, id: minute.id || response.data.id, isNew: false })
      setEditing(false); setConfirmation(null); setMessage(success)
    } catch (e) { setError(errorText(e, '저장하지 못했습니다. 다시 시도해 주세요.')) }
    finally { busy.current = false; setSaving(false) }
  }
  const submit = e => {
    e.preventDefault()
    if (!draft.title.trim() || !draft.content.trim()) { setError('제목과 내용을 입력해 주세요.'); return }
    if (draft.videoLink.trim() && !videoUrl(draft.videoLink.trim())) { setError('http 또는 https 영상 주소를 입력해 주세요.'); return }
    void persist({ ...draft, title: draft.title.trim(), content: draft.content.trim(), videoLink: draft.videoLink.trim() }, minute.isNew ? '회의록 등록 완료' : '수정 완료')
  }
  const remove = async () => {
    if (busy.current) return
    busy.current = true; setSaving(true); setError('')
    try { await client.delete(`/minutes/${minute.id}`); onDeleted(minute.id) }
    catch (e) { setError(errorText(e, '삭제하지 못했습니다. 다시 시도해 주세요.')) }
    finally { busy.current = false; setSaving(false) }
  }
  const link = videoUrl(minute.videoLink)
  return createPortal(<dialog ref={dialog} className="minutes-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close() }}>
    <header className="minutes-dialog-heading"><h2 ref={heading} tabIndex={-1} id={titleId}>{editing ? minute.isNew ? '회의록 등록' : '회의록 수정' : minute.title}</h2><button type="button" className="minutes-close" aria-label="회의록 상세 닫기" disabled={saving} onClick={close}><X size={22} aria-hidden="true" /></button></header>
    <div className="minutes-dialog-body">
      {error && <p role="alert" className="minutes-error">{error}</p>}
      {message && <p role="status" className="minutes-success">{message}</p>}
      {confirmation ? <section ref={confirmPanel} tabIndex={-1} role="alertdialog" aria-label={confirmation === 'delete' ? '회의록 삭제 확인' : '수정 내용 취소 확인'} className="minutes-confirm">
        <p>{confirmation === 'delete' ? '이 회의록과 확인 기록을 삭제할까요?' : '저장하지 않은 내용을 버릴까요?'}</p>
        <div className="minutes-dialog-actions"><Button size="sm" disabled={saving} onClick={confirmation === 'delete' ? remove : discard}>{confirmation === 'delete' ? '삭제 확정' : '버리기'}</Button><Button size="sm" variant="secondary" disabled={saving} onClick={() => setConfirmation(null)}>{confirmation === 'delete' ? '취소' : '계속 작성'}</Button></div>
      </section> : editing ? <form onSubmit={submit} aria-label={minute.isNew ? '회의록 등록' : '회의록 수정'}>
        <fieldset disabled={saving} className="minutes-form">
          <label>회의 제목<input ref={titleInput} value={draft.title} maxLength={200} required onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label>회의 날짜<input type="date" value={draft.meetingDate} required onChange={e => setDraft({ ...draft, meetingDate: e.target.value })} /></label>
          <label>영상 링크 · 선택<input type="url" value={draft.videoLink} maxLength={500} placeholder="https://" onChange={e => setDraft({ ...draft, videoLink: e.target.value })} /></label>
          <div className="minutes-visibility-row"><span>교사에게 공개</span><button type="button" role="switch" aria-label="교사에게 공개" aria-checked={draft.isActive} className="minutes-switch" onClick={() => setDraft({ ...draft, isActive: !draft.isActive })}>{draft.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}{draft.isActive ? '공개' : '비공개'}</button></div>
          <label>회의 내용<textarea rows={8} required value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} /></label>
          <div className="minutes-dialog-actions"><Button type="submit" size="sm" loading={saving}>{saving ? '저장 중…' : minute.isNew ? '등록 완료' : '수정 저장'}</Button><Button type="button" size="sm" variant="secondary" onClick={cancelEdit}>취소</Button></div>
        </fieldset>
      </form> : <>
        <div className="minutes-detail-meta"><time dateTime={minute.meetingDate}>{formatDate(minute.meetingDate)}</time><VisibilityBadge active={minute.isActive} /></div>
        <div className="minutes-visibility-row"><span>교사에게 공개</span><button type="button" role="switch" aria-label="교사에게 공개" aria-checked={minute.isActive} disabled={saving} className="minutes-switch" onClick={() => persist({ ...fieldsOf(minute), isActive: !minute.isActive }, minute.isActive ? '비공개로 변경했습니다.' : '공개로 변경했습니다.')}>{minute.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}{minute.isActive ? '공개' : '비공개'}</button></div>
        <div className="minutes-dialog-actions"><Button size="sm" variant="secondary" disabled={saving} onClick={() => { setDraft(fieldsOf(minute)); setEditing(true); setShowStatus(false); setError(''); setMessage('') }}><PenLine size={16} aria-hidden="true" />수정</Button>{link && <a className="minutes-video" href={link} target="_blank" rel="noopener noreferrer"><Play size={16} aria-hidden="true" />영상 열기</a>}</div>
        <section aria-label="회의 내용" className="minutes-content">{minute.content}</section>
        <details className="minutes-status" onToggle={e => setShowStatus(e.currentTarget.open)}><DisclosureSummary>참석·회의록 확인 현황</DisclosureSummary>
          {showStatus && (status.isPending ? <p role="status" className="minutes-empty">확인 중…</p> : status.isError ? <div role="alert" className="minutes-error">현황을 불러오지 못했습니다.<Button size="sm" variant="secondary" onClick={() => status.refetch()}>다시 불러오기</Button></div> : <MinuteStatusList rows={status.data || []} />)}
        </details>
        <button type="button" className="minutes-delete" disabled={saving} onClick={() => { setError(''); setConfirmation('delete') }}><Trash2 size={16} aria-hidden="true" />회의록 삭제</button>
      </>}
    </div>
  </dialog>, document.body)
}

function VisibilityBadge({ active }) { return <span className={`minutes-badge ${active ? 'minutes-public' : ''}`}>{active ? '공개' : '비공개'}</span> }
function MinuteStatusList({ rows }) {
  if (!rows.length) return <p className="minutes-empty">확인할 교사가 없습니다.</p>
  return <GradeAttendanceList rows={rows.map(row => ({ ...row, status: row.attendanceStatus }))} renderDetails={row => <>
    {row.attendanceStatus === 'ABSENT' && <div><dt>불참 사유</dt><dd>{row.attendanceReason || '미입력'}</dd></div>}
    <div><dt>회의록</dt><dd>{row.attendanceStatus === 'ATTEND' ? '참석 · 확인 면제' : row.confirmed ? '확인 완료' : '미확인'}</dd></div>
    {row.confirmed && row.confirmedAt && <div><dt>확인일</dt><dd>{row.confirmedAt.replace('T', ' ').slice(0, 16)}</dd></div>}
  </>} />
}
