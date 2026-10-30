import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import DisclosureSummary from '../components/common/DisclosureSummary'
import WeekNavigator from '../components/common/WeekNavigator'
import { getWeekStartByOffset, toApiDate, weekLabels, formatShort } from '../utils/date'
import { weeklyReportsApi, downloadReport, reportError } from '../api/weeklyReports'
import { supplementFromEditor, statusFromEditor, reportWeekLabel } from '../utils/weeklyReport'
import ClassSupplementForm, { GenderSelect, StatusSelect } from '../components/weekly-report/ClassSupplementForm'
import '../components/weekly-report/WeeklyReport.css'

const commonFields = { department: '부서명', author: '담당자', director: '교육부총괄', pastor: '담임목사', singer: '찬양 인도', prayer: '기도', scripture: '성경 본문', sermon: '설교 제목', preacher: '설교자', offering: '헌금 (원)' }
const longFields = { notes: '부서 공통 특이사항', monthPlan: '이번 달 계획', nextPlan: '다음 달 계획' }

export default function AdminWeeklyReportPage() {
  const [offset, setOffset] = useState(0)
  const date = toApiDate(getWeekStartByOffset(offset, 0))
  return <WeeklyReportWeek key={date} date={date} offset={offset} onOffset={setOffset} />
}

function WeeklyReportWeek({ date, offset, onOffset }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [activeClass, setActiveClass] = useState(null)
  const labels = weekLabels(getWeekStartByOffset(offset, 0))
  const report = useQuery({ queryKey: ['weekly-report', date], queryFn: () => weeklyReportsApi.get(date).then(r => r.data), refetchInterval: 30000 })
  const preview = useQuery({ queryKey: ['weekly-report-preview', date, report.data?.sourceHash], queryFn: () => weeklyReportsApi.preview(date).then(r => r.data), enabled: !!report.data })
  const data = report.data
  const fields = draft?.fields || data?.fields || {}
  const edit = (key, value) => { setDraft(previous => ({ revision: previous?.revision ?? data.draftRevision, fields: { ...(previous?.fields || data.fields), [key]: value } })); setMessage('') }
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['weekly-report', date] }); void qc.invalidateQueries({ queryKey: ['weekly-report-preview', date] }) }
  const save = useMutation({ mutationFn: () => weeklyReportsApi.save(date, draft.revision, draft.fields),
    onSuccess: ({ data: next }) => { qc.setQueryData(['weekly-report', date], next); setDraft(null); setError(''); setMessage('공통 항목 저장 완료') },
    onError: async e => { setError(await reportError(e)); refresh() },
  })
  const busy = save.isPending || downloadBusy
  const download = async (format, id) => {
    setDownloadBusy(true); setError(''); setMessage('')
    try {
      const archive = id || (await weeklyReportsApi.prepare(date, data)).data.id
      const result = await downloadReport(archive, date, format)
      refresh(); setMessage(result.status === 'cancelled' ? '저장을 취소했습니다.' : `${format.toUpperCase()} ${result.status === 'saved' ? '저장 완료' : '다운로드 시작'}`)
    } catch (e) { setError(await reportError(e)); refresh() } finally { setDownloadBusy(false) }
  }
  return <div className="wr-page"><Header title="출석 관리 · 주간보고서" showBack /><main className="wr-body">
    <WeekNavigator offset={offset} onChange={onOffset} disabled={busy || !!draft || activeClass != null} title={`${labels.monthWeek} 주간보고서`} sub={reportWeekLabel(date)} range={`${formatShort(date)} 주일 · 전체 예배 합산`} />
    <div className="wr-row"><Link to="/admin/student-attendance">학생별 출석 기록 보기</Link><Button variant="secondary" size="sm" disabled={busy} onClick={refresh}>최신 자료 확인</Button></div>
    {report.isError && <div className="wr-error" role="alert">집계를 불러오지 못했습니다. {report.error.response?.data?.message}<Button variant="secondary" size="sm" onClick={() => report.refetch()}>다시 시도</Button></div>}
    {!data ? <p role="status">집계 중…</p> : <>
      <section className="wr-panel wr-overview"><div className="wr-row"><h2>청소년부 주간보고서</h2><Link className="wr-team-link" to="/new-family">새가족팀 관리</Link></div>
        <dl className="wr-progress ui-metrics" aria-label="주간보고서 취합 현황"><div><dt>반·팀 제출</dt><dd>{data.classes.filter(c => c.submitted && !c.changed).length}<small> / {data.classes.length}</small></dd></div><div><dt>교사 출석 확인</dt><dd>{data.teachers.filter(t => t.status !== 'UNKNOWN' && t.gender).length}<small> / {data.teachers.length}</small></dd></div><div><dt>보완할 항목</dt><dd>{data.issues.length}<small>개</small></dd></div></dl>
      </section>
      {data.issues.length > 0 && <details className="wr-issues"><DisclosureSummary>누락·수정 {data.issues.length}건</DisclosureSummary><ul>{data.issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul><p>미제출 반은 합계 제외 · 보완 후 다운로드 가능</p></details>}
      <details className="wr-panel"><DisclosureSummary>공통 항목 · 예배·헌금·계획</DisclosureSummary><fieldset disabled={busy} className="wr-form"><div className="wr-grid">{Object.entries(commonFields).map(([key, label]) => <label key={key}>{label}<input value={fields[key] || ''} inputMode={key === 'offering' ? 'numeric' : undefined} maxLength={key === 'offering' ? 12 : 500} onChange={e => edit(key, e.target.value)} /></label>)}</div>
        <label className="wr-check"><input type="checkbox" checked={fields.includeLate !== 'false'} onChange={e => edit('includeLate', String(e.target.checked))} />지각을 출석 인원에 포함</label>
        {Object.entries(longFields).map(([key, label]) => <label key={key}>{label}<textarea rows={3} maxLength={6000} value={fields[key] || ''} onChange={e => edit(key, e.target.value)} /></label>)}

        <div className="wr-row"><Button size="sm" disabled={!draft} onClick={() => save.mutate()}>{save.isPending ? '저장 중…' : '공통 항목 저장'}</Button>{draft && <Button variant="secondary" size="sm" onClick={() => { setDraft(null); setError('') }}>작성 취소</Button>}</div>
      </fieldset></details>
      <details className="wr-panel"><DisclosureSummary>반·새가족팀 제출 자료</DisclosureSummary>{data.classes.map(c => <div className="wr-table-row" key={c.classId}>
        <div className="wr-row"><div><strong>{c.grade} {c.className}</strong><p className="wr-muted">{c.teacherName || '담당 교사 미배정'} · {c.changed ? '수정 후 재제출 필요' : c.submitted ? '제출 완료' : '미제출'}{c.legacy ? ' · 이전 제출 자료' : ''}</p>{c.correctionReason && <p className="wr-help">보완: {c.correctionReason}</p>}</div><Button variant="secondary" size="sm" disabled={busy || (activeClass != null && activeClass !== c.classId)} onClick={() => setActiveClass(activeClass === c.classId ? null : c.classId)}>{activeClass === c.classId ? '닫기' : '내용 확인·보완'}</Button></div>
        {activeClass === c.classId && (c.classId < 0 ? <div className="wr-form"><p className="wr-help">새가족팀에서 수정 후 재제출</p>{c.students.map(s=><p key={s.id}>{s.name} · {({FIRST:'금주 새 인원',FAMILY:'새가족',FOLLOWUP:'등록 미정 재방문'})[s.category]||s.category} · {({PRESENT:'출석',ABSENT:'불참',LATE:'지각',UNKNOWN:'미확인'})[s.status]}</p>)}<Link to="/new-family">새가족팀 관리로 이동</Link></div> : <ClassCorrection key={c.classId} source={c} date={date} onSaved={() => { setActiveClass(null); refresh() }} />)}
      </div>)}</details>
      <details className="wr-panel"><DisclosureSummary>청소년부 교사 출석</DisclosureSummary>{data.teachers.map(t => <TeacherCorrection key={`${t.id}:${t.revision}`} teacher={t} date={date} onSaved={refresh} />)}</details>
      {(draft || activeClass != null) && <p className="wr-issues">저장하거나 편집을 닫으면 다운로드할 수 있습니다.</p>}
      {error && <p className="wr-error" role="alert">{error}</p>}{message && <p className="wr-success" role="status">{message}</p>}
      <section aria-label="보고서 양식 미리보기"><div className="wr-row"><h2 className="ui-section-title">제출 양식</h2><Button variant="secondary" size="sm" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? '화면에 맞추기' : '원본 크기로 확대'}</Button></div>

        <div className={`wr-paper-wrap ${zoom ? 'wr-zoom' : ''}`}>{preview.isError ? <div className="wr-blank">양식을 불러오지 못했습니다. <Button variant="secondary" size="sm" onClick={() => preview.refetch()}>다시 시도</Button></div> : preview.data ? <iframe title="청소년부 주간보고서 양식" sandbox="" srcDoc={preview.data} /> : <p className="wr-blank">양식을 만드는 중…</p>}</div>
      </section>
      <div className="wr-panel"><div className="wr-downloads"><Button size="sm" disabled={busy || !!draft || activeClass != null || data.issues.length > 0 || report.isError} onClick={() => download('hwpx')}>한글 HWPX 다운로드</Button><Button variant="secondary" size="sm" disabled={busy || !!draft || activeClass != null || data.issues.length > 0 || report.isError} onClick={() => download('pdf')}>PDF 다운로드</Button></div></div>
      {data.exports.length > 0 && <details className="wr-panel"><DisclosureSummary>출력 기록 {data.exports.length}건</DisclosureSummary>{data.exports.map(item => <div className="wr-row wr-table-row" key={item.id}><p className="wr-muted">{item.createdAt?.replace('T', ' ').slice(0, 16)} · {item.createdBy}</p><div><Button variant="secondary" size="sm" disabled={busy} onClick={() => download('hwpx', item.id)}>HWPX</Button> <Button variant="secondary" size="sm" disabled={busy} onClick={() => download('pdf', item.id)}>PDF</Button></div></div>)}</details>}
    </>}
  </main></div>
}

function ClassCorrection({ source, date, onSaved }) {
  const query = useQuery({ queryKey: ['weekly-class-editor', source.classId, date], queryFn: () => weeklyReportsApi.editor(source.classId, date).then(r => r.data) })
  const [draft, setDraft] = useState(null)
  const [attendance, setAttendance] = useState(null)
  const [reason, setReason] = useState('')
  const [baseHash, setBaseHash] = useState(null)
  const [error, setError] = useState('')
  const value = draft || (query.data && supplementFromEditor(query.data))
  const statuses = attendance || (query.data && statusFromEditor(query.data))
  const save = useMutation({ mutationFn: () => weeklyReportsApi.correct(source.classId, date, { supplement: value, attendance: statuses, reason, sourceHash: baseHash || query.data.sourceHash }), onSuccess: onSaved, onError: async e => setError(await reportError(e)) })
  if (query.isError) return <Button variant="secondary" size="sm" onClick={() => query.refetch()}>반 자료를 다시 불러오기</Button>
  if (!value) return <p role="status">불러오는 중…</p>
  const freeze = () => { if (!baseHash) { setBaseHash(query.data.sourceHash); setDraft(value); setAttendance(statuses) } }
  return <div><ClassSupplementForm editor={query.data} value={value} onChange={next => { freeze(); setDraft(next) }} attendance={statuses} onAttendance={next => { freeze(); setAttendance(next) }} disabled={save.isPending} /><fieldset className="wr-form" disabled={save.isPending}><label>관리자 보완 사유<input value={reason} maxLength={500} onChange={e => { freeze(); setReason(e.target.value) }} placeholder="예: 담당 교사 확인 후 누락 입력" /></label><Button size="sm" disabled={!reason.trim() || Object.values(statuses).some(s => s === 'UNKNOWN')} onClick={() => save.mutate()}>보완 저장·반 제출 완료</Button></fieldset>{error && <p className="wr-error" role="alert">{error}</p>}</div>
}
function TeacherCorrection({ teacher, date, onSaved }) {
  const [data, setData] = useState({ gender: teacher.gender, status: teacher.status, reason: '' })
  const [error, setError] = useState('')
  const save = useMutation({ mutationFn: () => weeklyReportsApi.teacher(date, teacher.id, data), onSuccess: onSaved, onError: async e => setError(await reportError(e)) })
  return <details className="wr-person"><DisclosureSummary>{teacher.name}<span>{teacher.status === 'PRESENT' ? '출석' : teacher.status === 'ABSENT' ? '결석' : '미확인'}{!teacher.gender ? ' · 성별 확인 필요' : ''}</span></DisclosureSummary><fieldset className="wr-form" disabled={save.isPending}><div className="wr-grid"><GenderSelect name={teacher.name} value={data.gender} onChange={gender => setData({ ...data, gender })} /><StatusSelect teacher name={teacher.name} value={data.status} onChange={status => setData({ ...data, status })} /></div><label>보완 사유<input maxLength={500} value={data.reason} onChange={e => setData({ ...data, reason: e.target.value })} /></label><Button variant="secondary" size="sm" disabled={!data.reason.trim() || !data.gender || data.status === 'UNKNOWN'} onClick={() => save.mutate()}>교사 출석 보완 저장</Button>{teacher.correctionReason && <p className="wr-help">이전 보완: {teacher.correctionReason}</p>}</fieldset>{error && <p className="wr-error" role="alert">{error}</p>}</details>
}
