import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import WeekNavigator from '../components/common/WeekNavigator'
import AppSelect from '../components/common/AppSelect'
import StatSummary from '../components/common/StatSummary'
import DisclosureSummary from '../components/common/DisclosureSummary'
import useOfficerAccess from '../hooks/useOfficerAccess'
import { weeklyReportsApi } from '../api/weeklyReports'
import { getWeekStartByOffset, toApiDate, weekLabels } from '../utils/date'
import { OFFICER_GRADES } from '../utils/officers'
import { ClassCorrection, TeacherCorrection } from './AdminWeeklyReportPage'
import '../components/weekly-report/WeeklyReport.css'

export default function AdminAttendanceOverviewPage() {
  const [offset, setOffset] = useState(0), [params] = useSearchParams()
  const access = useOfficerAccess()
  const date = toApiDate(getWeekStartByOffset(offset, 0))
  const [grade, setGrade] = useState(OFFICER_GRADES.includes(params.get('grade')) ? params.get('grade') : null)
  const selectedGrade = grade ?? (access.data?.grades?.length === 1 ? access.data.grades[0] : '')
  return <AttendanceWeek key={date} date={date} offset={offset} onOffset={setOffset} grade={selectedGrade} onGrade={setGrade} access={access.data} />
}
function AttendanceWeek({ date, offset, onOffset, grade, onGrade, access }) {
  const qc = useQueryClient(), [editing, setEditing] = useState(null)
  const query = useQuery({ queryKey: ['officer-attendance', date], queryFn: () => weeklyReportsApi.attendance(date).then(r => r.data) })
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['officer-attendance'] }); void qc.invalidateQueries({ queryKey: ['weekly-report'] }) }
  const rows = query.data?.classes.filter(c => !grade || c.grade === grade) || []
  const labels = weekLabels(getWeekStartByOffset(offset, 0))
  return <div className="wr-page"><Header title="교사·학생 출석 관리" showBack /><main className="wr-body">
    <WeekNavigator offset={offset} onChange={onOffset} disabled={editing != null} title={`${labels.monthWeek} 출석`} sub={`${date} 주일`} />
    <div className="wr-row"><Link to="/admin/student-attendance">학생별 출석 기록</Link>{access?.canReport && <Link to="/admin/weekly-report">주간보고서 ›</Link>}</div>
    {query.isError ? <div className="wr-error" role="alert">출석 현황을 불러오지 못했습니다.<Button size="sm" onClick={() => query.refetch()}>다시 확인</Button></div> : !query.data ? <p role="status">불러오는 중…</p> : <>
      <label className="wr-row">학년<AppSelect aria-label="출석 학년" value={grade} disabled={editing != null} onChange={e => onGrade(e.target.value)}><option value="">전체 학년</option>{OFFICER_GRADES.map(g => <option key={g}>{g}</option>)}</AppSelect></label>
      <StatSummary label="반·팀 제출 현황" items={[{ label: '제출 완료', value: rows.filter(c => c.submitted && !c.changed).length, unit: '건' }, { label: '미제출·재제출', value: rows.filter(c => !c.submitted || c.changed).length, unit: '건' }]} />
      <section className="wr-panel"><h2>반·팀 출석</h2>{rows.length === 0 && <p className="wr-help">등록된 반이 없습니다.</p>}{rows.map(c => <div className="wr-class" key={c.classId}>
        <button className="wr-class-head" disabled={editing != null && editing !== c.classId} aria-expanded={editing === c.classId} onClick={() => setEditing(editing === c.classId ? null : c.classId)}><strong>{c.className}</strong><span>{!c.submitted ? '미제출' : c.changed ? '재제출 필요' : '제출 완료'}</span></button>
        {editing === c.classId && <>{c.classId > 0 ? <ClassCorrection source={c} date={date} onSaved={() => { setEditing(null); refresh() }} /> : <div className="wr-form">{c.students.map(s => <p key={s.id}>{s.name} · {({ PRESENT: '출석', LATE: '지각', ABSENT: '결석', UNKNOWN: '미확인' })[s.status]}</p>)}{access?.canNewFamily ? <Link to="/new-family">새가족팀 관리 ›</Link> : <p className="wr-help">새가족팀에서 수정·제출합니다.</p>}</div>}</>}
      </div>)}</section>
      <details className="wr-panel"><DisclosureSummary>청소년부 교사 출석</DisclosureSummary><p className="wr-help">전체 교사</p>{query.data.teachers.map(t => <TeacherCorrection key={`${t.id}:${t.revision}`} teacher={t} date={date} onSaved={refresh} />)}</details>
    </>}
  </main></div>
}
