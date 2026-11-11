import SaveErrorNotice from '../common/SaveErrorNotice'
import {useState} from 'react'
import AppSelect from '../common/AppSelect'
import SearchField from '../common/SearchField'
import {ActionButton as Button,MotionCheck,MotionDialog} from '../praise/PraiseMotion'
import {WORSHIP_GRADES,personLabel} from '../../utils/worship'
import {gradeClasses} from '../../utils/gradeColors'

export function Field({label,children}){return <label className="wo-field"><span>{label}</span>{children}</label>}
export function WorshipEditor({title,busy,error,canSave,onSave,onReload,onClose,children}){
 return <MotionDialog className="wo-dialog" title={title} busy={busy} onClose={onClose}
  footer={<div className="wo-dialog-actions"><SaveErrorNotice error={error} preserved/><Button key={onReload?'reload':'save'} disabled={busy||!canSave} onClick={onReload||onSave} successLabel={onReload?'불러오기 완료':'저장 완료'}>{onReload?'최신 내용 다시 불러오기':'저장'}</Button></div>}>
  <fieldset className="wo-dialog-fields" disabled={busy||!canSave}>{children}</fieldset>
 </MotionDialog>
}
export function PersonSelect({label,value,people,onChange,empty='미정'}){return <Field label={label}><AppSelect aria-label={label} value={value??''} onChange={e=>onChange(e.target.value?Number(e.target.value):null)}><option value="">{empty}</option>{value!=null&&!people.some(p=>p.id===value)&&<option value={value} disabled>이전 담당자 · 다시 선택</option>}{people.map(p=><option value={p.id} key={p.id}>{personLabel(p)}</option>)}</AppSelect></Field>}
export function PeoplePicker({people,selected,onChange,label}){
 const [search,setSearch]=useState(''),[grade,setGrade]=useState('')
 const filtered=people.filter(p=>(!grade||p.label===grade)&&personLabel(p).includes(search.trim()))
 const toggle=id=>onChange(selected.includes(id)?selected.filter(p=>p!==id):[...selected,id])
 return <section className="wo-picker" aria-label={label}>
  <div className="wo-section-head"><strong>{label}</strong><span className="wo-meta">{selected.length}명 선택</span></div>
  <SearchField value={search} onChange={setSearch} placeholder="이름 검색" label={label+' 이름 검색'}/>
  {people.some(p=>WORSHIP_GRADES.includes(p.label))&&<AppSelect aria-label={label+' 학년'} value={grade} onChange={e=>setGrade(e.target.value)}><option value="">전체 학년</option>{WORSHIP_GRADES.map(g=><option key={g}>{g}</option>)}</AppSelect>}
  <div className="wo-picked" aria-label="선택한 명단">{selected.map(id=>{const p=people.find(p=>p.id===id);return <button type="button" key={id} onClick={()=>toggle(id)} aria-label={(p?.name||'활동 종료')+' 선택 해제'}>{p?.name||'활동 종료'} ×</button>})}</div>
  <div className="wo-people">{filtered.map(p=><label key={p.id} className={'wo-person '+(selected.includes(p.id)?'selected':'')}><MotionCheck checked={selected.includes(p.id)} onChange={()=>toggle(p.id)}/><span>{p.name}{WORSHIP_GRADES.includes(p.label)&&<small className={gradeClasses(p.label).back}>{p.label}</small>}</span></label>)}</div>
  {!filtered.length&&<p className="wo-empty">해당하는 명단이 없습니다.</p>}
 </section>
}
export function CommitteeForm({draft,setDraft,data}){
 const field=(key,value)=>setDraft(d=>({...d,[key]:value}))
 return <div className="wo-form">
  <Field label="예배 전 중보기도"><AppSelect aria-label="중보기도 학년" value={draft.intercessionGrade} onChange={e=>field('intercessionGrade',e.target.value)}><option value="">미정</option>{WORSHIP_GRADES.map(g=><option key={g}>{g}</option>)}</AppSelect></Field>
  <PersonSelect label="헌금기도 선생님" people={data.candidates} value={draft.offeringPrayerId} onChange={v=>field('offeringPrayerId',v)}/>
  <PersonSelect label="대표기도 학생" people={data.students} value={draft.representativePrayerId} onChange={v=>field('representativePrayerId',v)}/>
  <PeoplePicker label="헌금위원 학생" people={data.students} selected={draft.offeringIds} onChange={v=>field('offeringIds',v)}/>
  <Field label="공지 하단 문구"><textarea rows={2} maxLength={160} value={draft.noticeMessage} onChange={e=>field('noticeMessage',e.target.value)} placeholder="추가 안내가 있으면 입력"/></Field>
 </div>
}
