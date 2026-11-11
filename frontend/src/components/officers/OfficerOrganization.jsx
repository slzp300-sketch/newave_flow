import { useId, useState } from 'react'
import DialogActions from '../common/DialogActions'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import AppSelect from '../common/AppSelect'
import Button from '../common/Button'
import StatSummary from '../common/StatSummary'
import DisclosureSummary from '../common/DisclosureSummary'
import OfficerDialog from './OfficerDialog'
import { officersApi } from '../../api/officers'
import { OFFICER_GROUPS, organizationCounts } from '../../utils/officers'

const errorText = e => e.response?.data?.message || '연결을 확인하고 다시 시도해주세요.'
const roles = { TEACHER: '교사', EXECUTIVE: '임원', PASTOR: '목사', ADMIN: '관리자' }
export default function OfficerOrganization({ access }) {
  const [year, setYear] = useState(access.activeYear)
  const [editor, setEditor] = useState(null), [activation, setActivation] = useState(false), [message, setMessage] = useState('')
  const qc = useQueryClient()
  const query = useQuery({ queryKey: ['officer-organization', year], queryFn: () => officersApi.organization(year) })
  const data = query.data
  const saved = next => {
    qc.setQueryData(['officer-organization', year], next)
    void qc.invalidateQueries({ queryKey: ['officer-organization'] })
    void qc.invalidateQueries({ queryKey: ['officer-access'] })
    void qc.invalidateQueries({ queryKey: ['new-family-capability'] })
    setEditor(null); setActivation(false); setMessage('저장했습니다.')
  }
  return <section className="officer-organization">
    <div className="officer-row"><label className="officer-year">활동연도<AppSelect aria-label="조직도 활동연도" value={year} onChange={e => { setYear(Number(e.target.value)); setMessage('') }} disabled={!!editor || activation}>
      {Array.from({ length: 7 }, (_, i) => access.activeYear - 3 + i).filter(y => y >= 2000 && y <= 2100).map(y => <option key={y} value={y}>{y}년{y === access.activeYear ? ' · 활동 중' : ''}</option>)}
    </AppSelect></label></div>
    {query.isError ? <div className="officer-notice" role="alert">{errorText(query.error)}<Button size="sm" variant="secondary" onClick={() => query.refetch()}>다시 확인</Button></div> : !data ? <p role="status">조직도를 불러오는 중…</p> : <>
      <OrganizationSummary offices={data.offices} />
      {message && <p className="officer-success" role="status">{message}</p>}
      {data.year !== data.activeYear && <div className="officer-notice"><span>{data.activeYear}년 조직이 활동 중입니다.</span>{data.canEdit && <Button size="sm" variant="secondary" onClick={() => setActivation(true)}>이 연도로 전환</Button>}</div>}
      {OFFICER_GROUPS.map(group => <section key={group}><h3 className="ui-section-title">{group}</h3><div className={`officer-grid ${['목사', '부장'].includes(group) ? 'officer-single' : ''}`}>
        {data.offices.filter(o => o.group === group).map(office => {
          const content = <><span className="officer-position">{office.label}</span><strong>{office.name || '공석'}</strong>{office.state === 'INACTIVE' && <span className="officer-warning">이용 정지·미승인</span>}{office.state === 'TEACHER' && <span className="officer-meta">전환 시 임원 권한 적용</span>}</>
          return data.canEdit ? <button className="officer-office brand-action motion-tap" data-vacant={!office.userId} key={office.code} aria-label={`${office.label} ${office.name || '공석'} 담당자 변경`} onClick={() => { setEditor({ office, revision: data.revision }); setMessage('') }}>{content}</button>
            : <div className="officer-office" data-vacant={!office.userId} key={office.code}>{content}</div>
        })}
      </div></section>)}
      {data.canEdit && data.history.length > 0 && <details className="officer-panel"><DisclosureSummary>담당자 변경 기록</DisclosureSummary><ul className="officer-history">{data.history.map(h => <li key={h.id}><strong>{h.action === 'ACTIVATE' ? `${data.year}년 조직 활성화` : h.position}</strong>{h.action === 'ASSIGN' && <p>{h.previousName} → {h.nextName}</p>}<span>{h.changedAt?.replace('T', ' ').slice(0, 16)} · {h.actorName}</span></li>)}</ul></details>}
      {editor && <AssignmentEditor key={editor.office.code} editor={editor} organization={data} onClose={() => setEditor(null)} onSaved={saved} onRefresh={() => { void query.refetch() }} />}
      {activation && <ActivationEditor organization={data} onClose={() => setActivation(false)} onSaved={saved} />}
    </>}
  </section>
}
function OrganizationSummary({ offices }) {
  const count = organizationCounts(offices)
  return <StatSummary label="임원 구성" items={[{ label: '배정 직책', value: `${count.assigned} / ${offices.length}`, unit: '' }, { label: '담당 인원', value: count.people }, { label: '공석', value: count.vacant, unit: '자리' }]} />
}
function AssignmentEditor({ editor, organization, onClose, onSaved, onRefresh }) {
  const formId=useId()
  const [selected, setSelected] = useState(editor.office.userId == null ? '' : String(editor.office.userId))
  const save = useMutation({ mutationFn: () => officersApi.assign(organization.year, editor.office.code, editor.revision, selected ? Number(selected) : null), onSuccess: onSaved, onError: onRefresh })
  const candidates = organization.candidates.filter(p => editor.office.code !== 'PASTOR' || p.role === 'PASTOR')
  const needsPromotion = organization.year === organization.activeYear && candidates.find(p => String(p.id) === selected)?.role === 'TEACHER'
  return <OfficerDialog title={editor.office.label} busy={save.isPending} onClose={onClose}>
    <form id={formId} onSubmit={e => { e.preventDefault(); save.mutate() }} className="officer-form"><fieldset disabled={save.isPending}>
      <label>담당자<AppSelect aria-label={`${editor.office.label} 담당자`} value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">공석</option>{editor.office.userId && !candidates.some(p => p.id === editor.office.userId) && <option value={editor.office.userId} disabled>{editor.office.name} · 현재 이용 불가</option>}
        {candidates.map(p => <option key={p.id} value={p.id}>{p.name} · {roles[p.role]}{organization.offices.filter(o => o.userId === p.id && o.code !== editor.office.code).map(o => ` · ${o.label}`).join('')}</option>)}
      </AppSelect></label>
      <p className="officer-meta">{organization.year !== organization.activeYear ? '해당 연도로 전환할 때 권한이 적용됩니다.' : needsPromotion ? '임원 권한을 함께 부여합니다. 해당 교사는 다시 로그인해야 합니다.' : '담당 업무 권한도 함께 변경됩니다.'}</p>
      {save.isError && <p className="officer-error" role="alert">{errorText(save.error)}{save.error.response?.status === 409 && ' 닫은 뒤 담당자를 다시 선택해주세요.'}</p>}
      <DialogActions><Button type="button" variant="secondary" disabled={save.isPending} onClick={onClose}>취소</Button><Button type="submit" form={formId} loading={save.isPending} disabled={selected === String(editor.office.userId ?? '') || (save.isError && save.error.response?.status === 409)}>저장</Button></DialogActions>
    </fieldset></form>
  </OfficerDialog>
}
function ActivationEditor({ organization, onClose, onSaved }) {
  const [revision] = useState(organization.revision)
  const save = useMutation({ mutationFn: () => officersApi.activate(organization.year, revision), onSuccess: onSaved })
  return <OfficerDialog title={`${organization.year}년 조직으로 전환`} busy={save.isPending} onClose={onClose}>
    <p>직책별 권한이 새 담당자에게 적용됩니다. 기존 연도 기록은 보존됩니다.</p>
    <p className="officer-meta">공석 {organizationCounts(organization.offices).vacant}자리 · 권한이 바뀐 교사는 다시 로그인해야 합니다.</p>
    {save.isError && <p className="officer-error" role="alert">{errorText(save.error)}</p>}
    <DialogActions><Button variant="secondary" disabled={save.isPending} onClick={onClose}>취소</Button><Button loading={save.isPending} onClick={() => save.mutate()}>전환 확정</Button></DialogActions>
  </OfficerDialog>
}
