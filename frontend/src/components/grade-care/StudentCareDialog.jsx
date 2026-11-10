import {useState,useRef,useCallback} from 'react'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {Plus,Lock} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import {gradeCareApi as api} from '../../api/gradeCare'
import {careKinds,checkLabels,careError} from '../../utils/gradeCare'
import {formatUpdatedAt} from '../../utils/date'
import Button from '../common/Button'
import AppSelect from '../common/AppSelect'
import GradeLabel from '../common/GradeLabel'
import {MotionDialog,FeedbackToast} from '../praise/PraiseMotion'
import '../../pages/OfficerPage.css'
import '../../pages/GradeCarePage.css'

export function CareBadge({status,label}){const positive=['PRESENT','ATTEND','SUBMITTED'].includes(status);return <span className={`gc-badge ${positive?'good':['UNKNOWN','NOT_ASSIGNED'].includes(status)?'neutral':'pending'}`}>{label||checkLabels[status]||status}</span>}
const shortDate=d=>d?.slice(5).replace('-','.')||'—'
export default function StudentCareDialog({studentId,date,onClose}){
 const user=useAuthStore(s=>s.user),qc=useQueryClient(),key=['grade-care-student',user?.id,studentId,date]
 const query=useQuery({queryKey:key,queryFn:()=>api.student(studentId,date),staleTime:0,gcTime:0,refetchInterval:30000,refetchOnWindowFocus:'always'})
 const data=query.isError?null:query.data
 const [draft,setDraft]=useState(null),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null),[discard,setDiscard]=useState(false)
 const locked=useRef(false),serial=useRef(0),closeNotice=useCallback(()=>setNotice(null),[])
 const begin=record=>{setDraft(record?{id:record.id,revision:record.revision,kind:record.kind,content:record.content}:{kind:'UPDATE',content:''});setError('');setConflict(false)}
 const run=async(action,success)=>{
  if(locked.current||query.isError)return false;locked.current=true;setBusy(true);setError('');setConflict(false)
  try{await action();setDraft(null);setNotice({id:++serial.current,text:success});await qc.invalidateQueries({queryKey:['grade-care']});await query.refetch();return true}
  catch(e){setError(careError(e));setConflict(e?.response?.status===409);if([401,403,404].includes(e?.response?.status))await query.refetch();return false}
  finally{locked.current=false;setBusy(false)}
 }
 const close=()=>{if(busy)return;if(draft){setDiscard(true);return}onClose()}
 const save=e=>{e.preventDefault();if(!draft.content.trim())return;run(()=>draft.id?api.update(studentId,draft.id,draft):api.create(studentId,draft),'기록을 저장했습니다.')}
 const reload=async()=>{const result=await query.refetch();const latest=result.data?.records.find(r=>r.id===draft?.id);if(latest)begin(latest);else setError('최신 기록을 확인하지 못했습니다.')}
 const visible=data?.records||[]
 const footer=query.isError?<Button onClick={onClose}>닫기</Button>:discard?<><Button variant="secondary" onClick={()=>setDiscard(false)}>계속 작성</Button><Button onClick={()=>{setDraft(null);setDiscard(false);setError('')}}>작성 취소</Button></>:draft?<><Button variant="secondary" disabled={busy} onClick={()=>setDiscard(true)}>취소</Button><Button type="submit" form="student-care-editor" loading={busy} disabled={!data||!draft.content.trim()||conflict}>저장</Button></>:<Button disabled={!data||busy} onClick={()=>begin(null)}><Plus size={16}/>기록 남기기</Button>
 return <><MotionDialog className="gc-dialog" title={draft?(draft.id?'기록 수정':'기록 남기기'):data?.student.name||'학생 돌봄'} busy={busy} onClose={close} error={error} footer={footer}>
 {query.isError?<div role="alert" className="gc-empty">{careError(query.error)}<Button variant="secondary" onClick={()=>query.refetch()}>다시 확인</Button></div>:!data?<p role="status" className="gc-empty">학생 기록 확인 중…</p>:discard?<p className="gc-inset">작성 중인 내용을 취소할까요?</p>:draft?<form id="student-care-editor" className="gc-form" onSubmit={save}>
  <p className="gc-muted">{data.student.name} · {data.student.className}</p>
  <label>기록 종류<AppSelect aria-label="기록 종류" value={draft.kind} disabled={busy} onChange={e=>setDraft({...draft,kind:e.target.value})}>{Object.entries(careKinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AppSelect></label>
  <label>내용<textarea className="field-input" rows={6} required maxLength={4000} disabled={busy} value={draft.content} placeholder="함께 알아둘 내용을 남겨주세요" onChange={e=>setDraft({...draft,content:e.target.value})}/></label>
  <p className="gc-private"><Lock size={14}/>담당 학년부장·담임/부담임·목사·관리자</p>
  {conflict&&<Button variant="secondary" type="button" onClick={reload}>작성 내용 버리고 최신 기록 열기</Button>}
 </form>:<div className="gc-detail">
  <div className="gc-student-profile"><GradeLabel value={data.student.grade}/><strong>{data.student.className} {data.student.school&&`· ${data.student.school}`}</strong></div>
  <p className="gc-muted">{data.teachers.map(t=>`${t.context} ${t.name}`).join(' · ')||'담임 배정 확인 필요'}</p>
  <section><div className="gc-heading"><h3 className="ui-section-title">최근 출석</h3><span className="gc-muted">4주</span></div><div className="gc-history">{data.student.history.map(h=><div key={h.date}><small>{shortDate(h.date)}</small><CareBadge status={h.status}/></div>)}</div></section>
  <div className="gc-heading"><h3 className="ui-section-title">근황·기도제목·연락</h3><Lock size={14}/></div>
  {visible.map(r=><article key={r.id} className="gc-note"><div className="gc-heading"><strong>{careKinds[r.kind]}</strong><small>{formatUpdatedAt(r.createdAt)}</small></div><p>{r.content||'개인정보 요청에 따라 삭제된 내용입니다.'}</p><div className="gc-note-meta"><small>{r.author}{r.revision>0?' · 수정됨':''}</small></div>
   {r.canEdit&&<div className="gc-note-edit"><Button size="sm" variant="secondary" disabled={busy} onClick={()=>begin(r)}>내용 수정</Button></div>}
  </article>)}
  {!visible.length&&<p className="gc-empty">등록된 기록이 없습니다.</p>}
  <p className="gc-private"><Lock size={14}/>담당자만 보는 공동 돌봄 기록입니다.</p>
 </div>}
 </MotionDialog><FeedbackToast notice={notice} onClose={closeNotice}/></>
}
