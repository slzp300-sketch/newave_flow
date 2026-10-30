import {useState,useEffect,useRef} from 'react'
import {useQuery} from '@tanstack/react-query'
import {format,parseISO,addDays,nextSaturday} from 'date-fns'
import {ko} from 'date-fns/locale'
import {Plus,ChevronRight,CalendarPlus,Trash2} from 'lucide-react'
import {evangelismApi} from '../../api/evangelism'
import {scheduleGroupId,scheduleGroupName,scheduleStatus,rotationRows,scheduleRowsError,validEvangelismDate} from '../../utils/evangelismAdmin'
import AdminReadGuard from '../common/AdminReadGuard'
import SegmentedControl from '../common/SegmentedControl'
import Button from '../common/Button'
import DisclosureSummary from '../common/DisclosureSummary'
import EvangelismDialog from './EvangelismDialog'
import CompactSelect from '../common/CompactSelect'

const dateLabel=date=>validEvangelismDate(date)?format(parseISO(date),'M/d (eee)',{locale:ko}):date
const nextDate=()=>format(nextSaturday(new Date()),'yyyy-MM-dd')
export default function EvangelismSchedules({groups,groupsQuery,scope,busy,error,clearError,perform}){
 const [filter,setFilter]=useState('upcoming'),[form,setForm]=useState(null),[selected,setSelected]=useState(null),[confirm,setConfirm]=useState(null)
 const query=useQuery({queryKey:['evangelism-schedules-all',scope],queryFn:()=>evangelismApi.getSchedules(false).then(r=>r.data),refetchOnMount:'always'})
 const schedules=query.data||[],past=s=>['COMPLETED','CANCELED'].includes(s.status)
 const rows=schedules.filter(s=>filter==='all'||(filter==='past'?past(s):!past(s))).sort((a,b)=>filter==='past'?b.scheduledDate.localeCompare(a.scheduledDate):a.scheduledDate.localeCompare(b.scheduledDate))
 const current=schedules.find(s=>s.id===selected)
 const openForm=value=>{clearError();setSelected(null);setConfirm(null);setForm(value)}
 const close=()=>{clearError();setSelected(null);setConfirm(null)}
 return <section className="ev-body" aria-label="전도 일정 관리">
  <AdminReadGuard queries={[groupsQuery,query]} label="전도 일정" reserveStatusSpace={false}>
   <div className="ev-actions"><Button size="sm" onClick={()=>openForm({mode:'single'})}><Plus size={16}/>일정 추가</Button><Button size="sm" variant="secondary" onClick={()=>openForm({mode:'bulk'})}><CalendarPlus size={16}/>여러 일정 등록</Button></div>
   <SegmentedControl label="전도 일정 기간" value={filter} onChange={setFilter} options={[{value:'upcoming',label:'예정 '+schedules.filter(s=>!past(s)).length},{value:'past',label:'지난 '+schedules.filter(past).length},{value:'all',label:'전체'}]}/>
   <div className="ev-grid">{rows.map(s=><button key={s.id} type="button" className="ev-card" aria-label={s.scheduledDate+' '+scheduleGroupName(s)+' 상세'} onClick={()=>{clearError();setSelected(s.id);setConfirm(null)}}><strong>{dateLabel(s.scheduledDate)}</strong><span className="ev-card-names">{scheduleGroupName(s)}</span><span className="ev-card-bottom"><span className={'ev-status ev-status-'+s.status.toLowerCase()}>{scheduleStatus(s.status)}</span><ChevronRight size={16}/></span></button>)}</div>
   {!rows.length&&<p className="ev-empty">등록된 일정이 없습니다.</p>}
  </AdminReadGuard>
  {form&&<ScheduleForm key={form.id||form.mode} form={form} groups={groups} schedules={schedules} busy={busy} error={error} onClose={()=>{setForm(null);clearError()}} onSubmit={payload=>perform(form.id?'schedule-edit':'schedule-create',payload,key=>form.id?evangelismApi.updateSchedule(form.id,payload[0]):evangelismApi.createSchedules(payload,key),()=>setForm(null))}/>}
  {current&&<EvangelismDialog title="전도 일정 상세" busy={busy} onClose={close}>
   <div className="ev-heading"><strong>{dateLabel(current.scheduledDate)}</strong><span className={'ev-status ev-status-'+current.status.toLowerCase()}>{scheduleStatus(current.status)}</span></div>
   <h3 className="ui-section-title">{scheduleGroupName(current)}</h3><p className="ev-muted">{current.assignments?.map(a=>a.teacherName).join(' · ')||'등록된 담당 교사 없음'}</p>
   {current.status!=='CANCELED'&&<div className="ev-actions"><Button size="sm" onClick={()=>openForm({mode:'single',id:current.id,scheduledDate:current.scheduledDate,groupId:scheduleGroupId(current)})}>일정 수정</Button><button type="button" className="ev-small" disabled={busy} onClick={()=>setConfirm('cancel')}>일정 취소</button></div>}
   <button type="button" className="ev-small ev-danger" disabled={busy} onClick={()=>setConfirm('delete')}><Trash2 size={16}/>일정 삭제</button>
   {confirm&&<div className="ev-confirm"><p>이 일정을 {confirm==='delete'?'삭제':'취소'}할까요?</p><div className="ev-actions"><Button size="sm" loading={busy} onClick={()=>perform('schedule-'+confirm,current.id,()=>confirm==='delete'?evangelismApi.deleteSchedule(current.id):evangelismApi.cancelSchedule(current.id),close)}>{confirm==='delete'?'삭제 확인':'취소 확정'}</Button><button type="button" className="ev-small" disabled={busy} onClick={()=>setConfirm(null)}>돌아가기</button></div></div>}
   {error&&<p role="alert" className="ev-error">{error}</p>}
  </EvangelismDialog>}
 </section>
}
function ScheduleForm({form,groups,schedules,busy,error,onClose,onSubmit}){
 const bulk=form.mode==='bulk'
 const groupOptions=groups.map(g=>({value:String(g.id),label:g.name}))
 const [start,setStart]=useState(form.scheduledDate||nextDate()),[count,setCount]=useState(4),[interval,setInterval]=useState(1),[first,setFirst]=useState(String(form.groupId||groups[0]?.id||''))
 const initial=()=>bulk?rotationRows(form.scheduledDate||nextDate(),4,1,groups,groups[0]?.id):[{scheduledDate:form.scheduledDate||nextDate(),groupId:form.groupId||groups[0]?.id||''}]
 const [rows,setRows]=useState(initial),[dirty,setDirty]=useState(false),[confirmClose,setConfirmClose]=useState(false),[localError,setLocalError]=useState('')
 const feedback=useRef(null),closePrompt=useRef(null)
 useEffect(()=>{if(localError||error)feedback.current?.focus()},[localError,error])
 useEffect(()=>{if(confirmClose)closePrompt.current?.focus()},[confirmClose])
 useEffect(()=>{if(!dirty)return;const guard=e=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty])
 const update=(index,patch)=>{setRows(prev=>prev.map((r,i)=>i===index?{...r,...patch}:r));setDirty(true);setLocalError('')}
 const generate=()=>{
  const next=rotationRows(start,Number(count),Number(interval),groups,first)
  if(!next.length){setLocalError('시작 날짜·횟수(1~52회)·담당 조를 확인해주세요.');return}
  setRows(next);setDirty(true);setLocalError('')
 }
 const add=()=>{
  const last=rows.at(-1),index=groups.findIndex(g=>g.id===Number(last?.groupId))
  const date=validEvangelismDate(last?.scheduledDate)?format(addDays(parseISO(last.scheduledDate),7),'yyyy-MM-dd'):nextDate()
  setRows(prev=>[...prev,{scheduledDate:date,groupId:groups[(index+1)%groups.length]?.id||''}]);setDirty(true);setLocalError('')
 }
 const submit=async e=>{
  e.preventDefault();const validation=scheduleRowsError(rows,groups,schedules,form.id??null)
  setLocalError(validation);if(validation)return
  await onSubmit(rows.map(r=>({scheduledDate:r.scheduledDate,groupId:Number(r.groupId)})))
 }
 const title=form.id?'전도 일정 수정':bulk?'여러 전도 일정 등록':'전도 일정 등록'
 return <EvangelismDialog title={title} busy={busy} onClose={()=>dirty?setConfirmClose(true):onClose()}>
  {!groups.length&&<p className="ev-error" role="alert">전도 조를 먼저 추가해주세요.</p>}
  <form noValidate onSubmit={submit} className="ev-form">
   {bulk&&<details className="ev-generator" open><DisclosureSummary>반복 일정 만들기</DisclosureSummary><fieldset disabled={busy} className="ev-generator-fields"><div className="ev-field"><label htmlFor="ev-start">시작 날짜</label><input id="ev-start" type="date" value={start} onChange={e=>setStart(e.target.value)}/></div><div className="ev-pair"><div className="ev-field"><label htmlFor="ev-count">횟수</label><input id="ev-count" type="number" min="1" max="52" value={count} onChange={e=>setCount(e.target.value)}/></div><CompactSelect id="ev-interval" label="간격" value={interval} disabled={busy} onChange={setInterval} options={[{value:'1',label:'매주'},{value:'2',label:'2주마다'},{value:'4',label:'4주마다'}]}/></div><CompactSelect id="ev-first-group" label="시작 조" value={first} disabled={busy} onChange={setFirst} options={groupOptions}/><button type="button" className="ev-small" onClick={generate}>아래 목록 다시 만들기</button></fieldset></details>}
   <div className="ev-heading"><h3 className="ui-section-title">{bulk?'등록할 일정 '+rows.length+'개':'일정 정보'}</h3>{bulk&&<button type="button" className="ev-small" disabled={busy||rows.length>=52} onClick={add}><Plus size={16}/>다음 주 추가</button>}</div>
   <fieldset disabled={busy} className="ev-schedule-rows">{rows.map((row,index)=><div key={index} className="ev-schedule-row"><div className="ev-field"><label htmlFor={'ev-date-'+index}>{bulk?(index+1)+'. 날짜':'날짜'}</label><input id={'ev-date-'+index} type="date" value={row.scheduledDate} onChange={e=>update(index,{scheduledDate:e.target.value})}/></div><CompactSelect id={'ev-row-group-'+index} label="담당 조" value={row.groupId} disabled={busy} onChange={value=>update(index,{groupId:value})} options={groupOptions}/>{bulk&&<button type="button" className="ev-icon" aria-label={(index+1)+'번째 일정 제외'} onClick={()=>{setRows(prev=>prev.filter((_,i)=>i!==index));setDirty(true);setLocalError('')}}><Trash2 size={16}/></button>}</div>)}</fieldset>
   {(localError||error)&&<p ref={feedback} tabIndex={-1} role="alert" className="ev-error">{localError||error}</p>}
   <div className="ev-form-footer"><Button type="submit" loading={busy} disabled={!groups.length||!rows.length}>{form.id?'수정 저장':rows.length+'개 일정 등록'}</Button></div>
  </form>
  {confirmClose&&<div ref={closePrompt} tabIndex={-1} className="ev-confirm" role="alertdialog" aria-label="작성 취소 확인"><p>작성 중인 내용을 닫을까요?</p><div className="ev-actions"><button type="button" className="ev-small" onClick={onClose}>작성 취소</button><Button size="sm" onClick={()=>setConfirmClose(false)}>계속 작성</Button></div></div>}
 </EvangelismDialog>
}
