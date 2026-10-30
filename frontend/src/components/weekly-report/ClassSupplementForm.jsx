import AppSelect from '../common/AppSelect'
import { reportCategories } from '../../utils/weeklyReport'
import './WeeklyReport.css'
import DisclosureSummary from '../common/DisclosureSummary'
import Button from '../common/Button'

const visitorFields = { name: '이름', grade: '학년', school: '학교', address: '주소', phone: '연락처', introducer: '인도자' }
const fieldLengths = { name: 50, grade: 20, school: 100, address: 255, phone: 30, introducer: 100 }
export function GenderSelect({ value, onChange, name }) {
  return <label>성별<AppSelect aria-label={`${name} 성별`} value={value || ''} onChange={e => onChange(e.target.value)}><option value="">선택</option><option value="남">남</option><option value="여">여</option></AppSelect></label>
}
export function StatusSelect({ value, onChange, name, teacher = false }) {
  return <label>출석<AppSelect aria-label={`${name} 출석`} value={value} onChange={e => onChange(e.target.value)}><option value="UNKNOWN">미확인</option><option value="PRESENT">출석</option><option value="ABSENT">결석</option>{!teacher && <option value="LATE">지각</option>}</AppSelect></label>
}
export default function ClassSupplementForm({ editor, value, onChange, disabled, attendance, onAttendance }) {
  const member = (index, update) => onChange({ ...value, members: value.members.map((v, i) => i === index ? { ...v, ...update } : v) })
  const visitor = (index, update) => onChange({ ...value, visitors: value.visitors.map((v, i) => i === index ? { ...v, ...update } : v) })
  return <fieldset className="wr-form" disabled={disabled}>
    <legend>주간보고서 추가 정보</legend>

    {value.members.map((m, index) => {
      const student = editor.students.find(s => s.studentId === m.studentId)
      return <details className="wr-person" key={m.studentId}>
        <DisclosureSummary>{student?.name} <span>{reportCategories[m.category]}{m.graduated ? ' · 등반' : ''}{!m.gender ? ' · 성별 확인 필요' : ''}</span></DisclosureSummary>
        <div className="wr-grid">
          <label>보고 구분<AppSelect aria-label="보고 구분" value={m.category} onChange={e => member(index, { category: e.target.value, graduated: e.target.value === 'REGULAR' && m.graduated })}>{Object.entries(reportCategories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AppSelect></label>
          <GenderSelect name={student?.name} value={m.gender} onChange={gender => member(index, { gender })} />
          {onAttendance && <StatusSelect name={student?.name} value={attendance[student.id]} onChange={status => onAttendance({ ...attendance, [student.id]: status })} />}
          {m.category === 'REGULAR' && <label className="wr-check"><input type="checkbox" checked={m.graduated} onChange={e => member(index, { graduated: e.target.checked })} />등반자</label>}
          {m.category === 'FIRST' && Object.entries(visitorFields).filter(([k]) => !['name', 'grade'].includes(k)).map(([key, label]) => <label key={key}>{label}<input maxLength={fieldLengths[key]} value={m[key] || ''} onChange={e => member(index, { [key]: e.target.value })} /></label>)}
        </div>
      </details>
    })}
    <div className="wr-row"><h3>금주 새 인원 · 새가족팀 확인</h3><Button variant="secondary" size="sm" type="button" onClick={() => onChange({ ...value, visitors: [...value.visitors, { id: crypto.randomUUID(), name: '', gender: '', grade: editor.grade || '', school: '', address: '', phone: '', introducer: '', status: 'PRESENT', teamConfirmed: false }] })}>+ 추가</Button></div>

    {value.visitors.map((v, index) => <div className="wr-person" key={v.id}>
      <div className="wr-row"><strong>새 방문자 {index + 1}</strong><Button variant="secondary" size="sm" type="button" onClick={() => onChange({ ...value, visitors: value.visitors.filter((_, i) => i !== index) })}>삭제</Button></div>
      <div className="wr-grid">{Object.entries(visitorFields).map(([key, label]) => <label key={key}>{label}<input maxLength={fieldLengths[key]} value={v[key]} onChange={e => visitor(index, { [key]: e.target.value })} /></label>)}
        <GenderSelect name={`새 방문자 ${index + 1}`} value={v.gender} onChange={gender => visitor(index, { gender })} />
        <StatusSelect name={`새 방문자 ${index + 1}`} value={v.status} onChange={status => visitor(index, { status })} />
      </div>
      <label className="wr-check"><input type="checkbox" checked={v.teamConfirmed === true} onChange={e => visitor(index, { teamConfirmed: e.target.checked })} />새가족팀 출결·중복 확인 완료</label>
      {v.teamConfirmed == null && <p className="wr-help">이전 집계 유지 · 팀 확인 이력 없음</p>}{v.teamConfirmed === false && <p className="wr-help">팀 확인 전에는 출석 합계 제외</p>}
    </div>)}
    <label>반 공통 특이사항<textarea rows={3} maxLength={3000} value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} placeholder="보고서에 포함할 내용" /></label>
  </fieldset>
}
