import {useFormChanges} from '../common/UnsavedChanges'
import {useState} from 'react'
import {Link} from 'react-router-dom'
import {ChevronRight} from 'lucide-react'
import AppSelect from '../common/AppSelect'
import {ActionButton as Button, MotionDialog, MotionCheck} from './PraiseMotion'
import RosterDirectory from './RosterDirectory'
import {praiseApi} from '../../api/praise'
import {parts,today,shortDate,addDays,monthOfWeek,unavailable,needsReview} from '../../utils/praise'

function Field({title,children}) {
 return <div className="pt-editor-field"><span>{title}</span>{children}</div>
}

export default function PraiseEditor({editor:e,setEditor,data,busy,save,run,name,link,error}) {
 const [draft,setDraft]=useState(e),[part,setPart]=useState('인도자'),[accepted,setAccepted]=useState(false)
 const {confirm:confirmMove}=useFormChanges(draft,{busy})
 const close=()=>confirmMove(()=>!busy&&setEditor(null)),change=(key,value)=>setDraft(d=>({...d,[key]:value})),revision=e.revision
 const dialog={error,busy,onClose:close,className:'pt-editor-dialog'}

 if(e.type==='person') {
  const weeks=data.weeks.filter(w=>Object.values(w.slots).flat().includes(e.member.id))
  return <MotionDialog {...dialog} title={e.member.name} footer={data.canManage&&<Button onClick={()=>setEditor({type:'member',...e.member,revision:data.term.revision})}>팀원 수정</Button>}>
   <section className="pt-person-summary">
    <span className="pt-person-kind">{[e.member.kind,e.member.grade].filter((value,index,all)=>value&&all.indexOf(value)===index).join(' · ')}</span>
    <div className="pt-part-tags">{e.member.parts.map(p=><span key={p}>{p}</span>)}</div>
   </section>
   <section className="pt-editor-section"><h3>배정 일정</h3>
    {weeks.map(w=><Link className="pt-related-link" to={link('rotation',w.id,monthOfWeek(w))} key={w.id}><strong>{shortDate(w.worshipDate)}</strong><span>{parts.filter(p=>w.slots[p]?.includes(e.member.id)).join(' · ')}</span><ChevronRight size={16}/></Link>)}
    {!weeks.length&&<p className="pt-meta">배정된 일정이 없습니다.</p>}
   </section>
  </MotionDialog>
 }
 if(e.type==='term')return <MotionDialog {...dialog} title="학기 만들기" footer={<Button disabled={busy} successLabel="학기 준비 완료" onClick={()=>run(()=>praiseApi.create({year:Number(draft.year||today().slice(0,4)),half:draft.half||2}),'학기를 준비했습니다.')}>학기 만들기</Button>}>
  <label className="pt-input-label">연도<input type="number" min="2000" max="2100" value={draft.year??Number(today().slice(0,4))} onChange={ev=>change('year',ev.target.value)}/></label>
  <Field title="활동 학기"><AppSelect aria-label="새 학기" value={draft.half||2} onChange={ev=>change('half',Number(ev.target.value))}><option value="1">상반기 · 2–7월</option><option value="2">하반기 · 9–12월</option></AppSelect></Field>
 </MotionDialog>

 if(e.type==='member') {
  const candidates=data.candidates.filter(c=>!data.members.some(m=>c.userId?m.userId===c.userId:m.studentId===c.studentId)).map(c=>({...c,id:c.userId?`u${c.userId}`:`s${c.studentId}`,parts:[]}))
  return <MotionDialog {...dialog} title={e.id?'팀원 수정':'팀원 지정'} footer={<Button disabled={busy||!draft.parts.length||(!e.id&&!draft.candidates?.length)} successLabel="저장 완료" onClick={()=>{
   if(e.id)return save('members',{revision,id:e.id,parts:draft.parts,active:draft.active},'명단에 반영했습니다.')
   return save('members/batch',{revision,members:candidates.filter(c=>draft.candidates.includes(c.id)).map(c=>({userId:c.userId,studentId:c.studentId,parts:draft.parts,active:true}))},'명단에 반영했습니다.')
  }}>명단 저장</Button>}>
   {e.id?<div className="pt-person-summary"><strong>{e.name}</strong><span className="pt-person-kind">{e.kind}</span></div>:<RosterDirectory members={candidates} selectedIds={draft.candidates||[]} onSelection={(id,on)=>change('candidates',on?[...(draft.candidates||[]),id]:(draft.candidates||[]).filter(v=>v!==id))}/>}
   <fieldset className="pt-part-picker" disabled={busy}><legend>담당 파트</legend><div className="pt-parts">{parts.map(p=><label key={p} data-selected={draft.parts.includes(p)}><MotionCheck checked={draft.parts.includes(p)} onChange={ev=>change('parts',ev.target.checked?[...draft.parts,p]:draft.parts.filter(v=>v!==p))}/>{p}</label>)}</div></fieldset>
   {e.id&&<label className="pt-av-none pt-member-active"><MotionCheck checked={draft.active} disabled={busy} onChange={ev=>change('active',ev.target.checked)}/>활동 중</label>}
  </MotionDialog>
 }
 if(e.type==='prayer')return <MotionDialog {...dialog} title="목요 기도회" footer={<Button disabled={busy||!draft.date} successLabel="저장 완료" onClick={()=>save('prayer',{revision,date:draft.date,hostId:draft.hostId||null,zoomUrl:draft.zoomUrl},'기도회 일정을 저장했습니다.')}>저장</Button>}>
  <label className="pt-input-label">날짜<input aria-label="기도회 날짜" type="date" disabled={!!e.id} value={draft.date} onChange={ev=>change('date',ev.target.value)}/></label>
  <Field title="진행 교사"><AppSelect aria-label="기도회 진행 교사" disabled={!data.canManage} value={draft.hostId||''} onChange={ev=>change('hostId',Number(ev.target.value)||null)}><option value="">미배정</option>{data.members.filter(m=>m.active&&m.userId).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</AppSelect></Field>
  <label className="pt-input-label">Zoom 링크<input aria-label="Zoom 링크" type="url" maxLength={1000} value={draft.zoomUrl||''} onChange={ev=>change('zoomUrl',ev.target.value)} placeholder="https://…zoom.us/…"/></label>
 </MotionDialog>

 if(e.type==='week') {
  const roster=data.members.filter(m=>m.active||Object.values(draft.slots).flat().includes(m.id)),conflicts=[...new Set(Object.values(draft.slots).flat())].filter(id=>unavailable(data,roster.find(m=>m.id===id),draft.practiceDate))
  const notes=Object.fromEntries(roster.map(m=>{const r=data.responses.find(r=>r.userId===m.userId&&r.month===monthOfWeek(e));return [m.id,{text:!m.active?'활동 종료 · 배정 해제 필요':unavailable(data,m,draft.practiceDate)?'참여 불가':m.userId?!r?'미제출':needsReview(r,[e])?'시간 변경':'제출됨':'학생',tone:!m.active||unavailable(data,m,draft.practiceDate)?'warning':'muted'}]}))
  return <MotionDialog {...dialog} className="pt-editor-dialog pt-rotation-dialog" title={`${shortDate(e.worshipDate)} 연습·배정`} footer={<>
   <span className="pt-save-context">{part}<strong>{draft.slots[part]?.length||0}명 선택</strong></span>
   <Button disabled={busy||!draft.startTime||draft.endTime<=draft.startTime||(conflicts.length>0&&!accepted)} successLabel="저장 완료" onClick={()=>save(`weeks/${e.id}`,{revision,practiceDate:draft.practiceDate,startTime:draft.startTime,endTime:draft.endTime,slots:draft.slots,acceptUnavailable:accepted},'연습·배정을 저장했습니다.')}>배정 저장</Button>
  </>}>
   <section className="pt-editor-section pt-schedule-fields"><h3>연습 일정</h3>
    <Field title="날짜"><AppSelect aria-label="연습 날짜" value={draft.practiceDate} onChange={ev=>{change('practiceDate',ev.target.value);setAccepted(false)}}><option value={addDays(e.worshipDate,-1)}>{shortDate(addDays(e.worshipDate,-1))} 토</option><option value={e.worshipDate}>{shortDate(e.worshipDate)} 주일</option></AppSelect></Field>
    <div className="pt-av-times"><label>시작<input aria-label="연습 시작 시간" type="time" value={draft.startTime.slice(0,5)} onInput={ev=>change('startTime',ev.target.value)} onChange={ev=>change('startTime',ev.target.value)}/></label><label>종료<input aria-label="연습 종료 시간" type="time" value={draft.endTime.slice(0,5)} onInput={ev=>change('endTime',ev.target.value)} onChange={ev=>change('endTime',ev.target.value)}/></label></div>
   </section>
   <section className="pt-editor-section"><div className="pt-editor-part"><h3>파트 배정</h3><AppSelect aria-label="수정할 파트" value={part} onChange={ev=>setPart(ev.target.value)}>{parts.map(p=><option key={p}>{p}</option>)}</AppSelect></div>
    <div className="pt-selected-members"><span>현재 배정</span><strong>{name(draft.slots[part])}</strong></div>
    <RosterDirectory members={roster} memberNotes={notes} selectedIds={draft.slots[part]||[]} onSelection={(id,on)=>{setAccepted(false);change('slots',{...draft.slots,[part]:on?part==='인도자'?[id]:[...new Set([...(draft.slots[part]||[]),id])]:(draft.slots[part]||[]).filter(v=>v!==id)})}}/>
   </section>
   {conflicts.length>0&&<div className="pt-av-conflicts"><p className="pt-av-warning">참여 불가 · {name(conflicts)}</p><label className="pt-av-override"><MotionCheck checked={accepted} onChange={ev=>setAccepted(ev.target.checked)}/>불가 일정을 확인했으며 배정합니다.</label></div>}
  </MotionDialog>
 }
 return null
}
