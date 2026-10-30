import AppSelect from '../common/AppSelect'
import Button from '../common/Button'
import DisclosureSummary from '../common/DisclosureSummary'

const detailFields = { school: '학교', address: '주소', phone: '연락처' }
const limits = { school: 100, address: 255, phone: 30 }

export default function TeacherReportExtras({ editor, value, onChange, disabled }) {
  const visitor = (index, patch) => onChange({ ...value, visitors: value.visitors.map((v, i) => i === index ? { ...v, ...patch } : v) })
  const classmates = editor.students.filter(s => s.studentId != null)
  return <details className="teacher-extras">
    <DisclosureSummary><span>추가로 전달할 내용</span><small>선택{value.visitors.length ? ` · 첫 방문 ${value.visitors.length}명` : ''}</small></DisclosureSummary>
    <fieldset disabled={disabled}>

      <label>반 특이사항<textarea rows={2} maxLength={3000} value={value.notes} onChange={e => onChange({ ...value, notes: e.target.value })} placeholder="전달할 내용 (선택)" /></label>
      <details className="teacher-first-visit">
        <DisclosureSummary>우리 반 첫 방문 학생{value.visitors.length ? ` · ${value.visitors.length}명` : ''}</DisclosureSummary>
        <p className="teacher-help">친구 동반 방문만 · 중복 입력 금지</p>
        <div className="teacher-extra-heading"><strong>이번 주 처음 온 학생</strong><Button variant="secondary" size="sm" type="button" onClick={() => onChange({ ...value, visitors: [...value.visitors, { id: crypto.randomUUID(), name: '', gender: '', grade: editor.grade || '', school: '', address: '', phone: '', introducer: '', status: 'PRESENT', teamConfirmed: false }] })}>+ 기록</Button></div>
        {value.visitors.map((v, index) => <div className="teacher-visitor" key={v.id}>
          <div className="teacher-extra-heading"><strong>첫 방문 {index + 1}</strong><Button variant="secondary" size="sm" type="button" disabled={v.teamConfirmed !== false} aria-label={`첫 방문 ${index + 1} 삭제`} onClick={() => onChange({ ...value, visitors: value.visitors.filter((_, i) => i !== index) })}>삭제</Button></div>
          <p className="teacher-help">{v.teamConfirmed === false ? '새가족팀 확인 전 · 집계 대기' : v.teamConfirmed === true ? '팀 확인 완료 · 수정은 메모로 전달' : '이전 기록 · 수정은 관리자에게 요청'}</p>
          <fieldset disabled={disabled || v.teamConfirmed !== false}>
          <div className="teacher-extra-grid">
            <label>이름<input aria-label={`첫 방문 ${index + 1} 이름`} maxLength={50} value={v.name} onChange={e => visitor(index, { name: e.target.value })} /></label>
            <label>함께 온 친구 (선택)<AppSelect aria-label={`첫 방문 ${index + 1} 함께 온 친구`} value={v.introducer} onChange={e => visitor(index, { introducer: e.target.value })}><option value="">미선택</option>{classmates.map(s => <option key={s.studentId} value={s.name}>{s.name}</option>)}{v.introducer && !classmates.some(s => s.name === v.introducer) && <option value={v.introducer}>{v.introducer}</option>}</AppSelect></label>
          </div>
          <details><DisclosureSummary>추가 정보 (선택)</DisclosureSummary>
            <div className="teacher-extra-grid"><label>성별<AppSelect aria-label={`첫 방문 ${index + 1} 성별`} value={v.gender} onChange={e => visitor(index, { gender: e.target.value })}><option value="">미확인</option><option value="남">남</option><option value="여">여</option></AppSelect></label>
              <label>학년<input maxLength={20} aria-label={`첫 방문 ${index + 1} 학년`} value={v.grade} onChange={e => visitor(index, { grade: e.target.value })} /></label>
              {Object.entries(detailFields).map(([key, label]) => <label key={key}>{label}<input aria-label={`첫 방문 ${index + 1} ${label}`} maxLength={limits[key]} value={v[key]} onChange={e => visitor(index, { [key]: e.target.value })} /></label>)}
              <label>예배 출석<AppSelect aria-label={`첫 방문 ${index + 1} 출석`} value={v.status} onChange={e => visitor(index, { status: e.target.value })}><option value="PRESENT">출석</option><option value="ABSENT">불참</option><option value="LATE">지각</option><option value="UNKNOWN">미확인</option></AppSelect></label>
            </div>
          </details>
          </fieldset>
        </div>)}

      </details>
    </fieldset>
  </details>
}
