import {useCallback,useEffect,useRef,useState} from 'react'
import {useNavigate,useSearchParams,Link} from 'react-router-dom'
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query'
import {AnimatePresence} from 'framer-motion'
import {ChevronLeft,ChevronRight,ChevronDown,CalendarDays,Download,Image,Check,Users,ClipboardCheck,Church} from 'lucide-react'
import Header from '../components/layout/Header'
import AppSelect from '../components/common/AppSelect'
import SegmentedControl from '../components/common/SegmentedControl'
import {ActionButton as Button,MotionDialog,MotionPage,FeedbackToast,MotionCheck} from '../components/praise/PraiseMotion'
import {CommitteeForm,PeoplePicker,PersonSelect,WorshipEditor} from '../components/worship/WorshipForms'
import {createNoticeImage} from '../components/worship/noticeImage'
import {downloadWorshipImage} from '../native/worshipExport'
import {worshipApi as api} from '../api/worship'
import useAuthStore from '../store/authStore'
import {currentWorshipDate,isWorshipDate,shiftWorshipDate,worshipDateLabel,committeeRows,committeeComplete,personLabel} from '../utils/worship'
import {gradeClasses} from '../utils/gradeColors'
import './OfficerPage.css'
import './WorshipPage.css'

const tabs=[{value:'home',label:'이번 주'},{value:'notice',label:'예배위원·공지'},{value:'team',label:'팀원'}]
const message=e=>e?.response?.data?.message||(e?.response?.status===403?'사용 권한을 확인해주세요.':e?.response?'연결을 확인하고 다시 시도해주세요.':e?.message||'연결을 확인해주세요.')
const stamp=s=>s?s.name+' · '+s.at.slice(5,16).replace('T',' '):''
const committeeDraft=data=>({revision:data.revision,intercessionGrade:data.intercessionGrade,offeringPrayerId:data.offeringPrayer?.id??null,representativePrayerId:data.representativePrayer?.id??null,offeringIds:data.offerings.map(p=>p.id),noticeMessage:data.noticeMessage})
const teamDraft=data=>({revision:data.teamRevision,userIds:data.team.filter(p=>p.label!=='팀장').map(p=>p.id)})
function Committee({data}){return <dl className="wo-committee">{committeeRows(data).map(([label,value],i)=><div key={label}><dt>{label}</dt><dd>{i===0&&value!=='미정'?<span className={'wo-grade '+gradeClasses(value).back}>{value}</span>:value}</dd></div>)}</dl>}
function WeekPicker({date,onChoose}){
 const [year,setYear]=useState(Number(date.slice(0,4))),[month,setMonth]=useState(Number(date.slice(5,7)))
 const dates=[];for(let day=1;day<=31;day++){const d=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');if(isWorshipDate(d))dates.push(d)}
 return <div className="wo-form"><div className="wo-pair">
  <AppSelect aria-label="연도" value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:101},(_,i)=>2000+i).map(y=><option key={y} value={y}>{y}년</option>)}</AppSelect>
  <AppSelect aria-label="월" value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}</AppSelect>
 </div><div className="wo-week-options">{dates.map(d=><button key={d} type="button" aria-pressed={d===date} onClick={()=>onChoose(d)}><span className="wo-week-label"><CalendarDays size={17}/>{Number(d.slice(8))}일 주일</span>{d===date&&<Check className="wo-week-selected" size={17}/>}</button>)}</div></div>
}
export default function WorshipPage(){
 const user=useAuthStore(s=>s.user),navigate=useNavigate(),[params,setParams]=useSearchParams(),qc=useQueryClient()
 const page=['home','notice','team','poster'].includes(params.get('page'))?params.get('page'):'home'
 const date=isWorshipDate(params.get('date'))?params.get('date'):currentWorshipDate()
 const [dialog,setDialog]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(null),[exporting,setExporting]=useState(false)
 const [saving,setSaving]=useState(false)
 const [conflict,setConflict]=useState(false)
 const serial=useRef(0),busyRef=useRef(false)
 const query=useQuery({queryKey:['worship',user?.id,date],queryFn:()=>api.state(date),enabled:!!user,refetchInterval:20000})
 const data=query.isError?null:query.data
 const mutation=useMutation({mutationFn:action=>action()})
 const busy=mutation.isPending||exporting||saving
 const notify=text=>setNotice({id:++serial.current,text})
 const closeNotice=useCallback(()=>setNotice(null),[])
 const go=(next,day=date)=>{if(busyRef.current)return;setDialog(null);setDraft(null);setError('');setParams({page:next,date:day})}
 const run=async(action,success,close=false)=>{
  if(busyRef.current||query.isError)return false
  busyRef.current=true;setSaving(true);setError('');setConflict(false)
  try{const result=await mutation.mutateAsync(action);qc.setQueryData(['worship',user?.id,date],result);await qc.invalidateQueries({queryKey:['officer-access']});if(close){setDialog(null);setDraft(null)}notify(success);return true}
  catch(e){setError(message(e));setConflict(e?.response?.status===409);return false}
  finally{busyRef.current=false;setSaving(false)}
 }
 useEffect(()=>{window.scrollTo(0,0)},[page,date])
 const openCommittee=()=>{setError('');setConflict(false);setDraft(committeeDraft(data));setDialog({type:'committee'})}
 const openTeam=()=>{setError('');setConflict(false);setDraft(teamDraft(data));setDialog({type:'team'})}
 const openAssign=t=>{setError('');setConflict(false);setDraft({revision:t.revision,userId:t.assignee?.id??null});setDialog({type:'assign',task:t})}
 const close=()=>{if(!busy){setDialog(null);setDraft(null);setError('')}}
 const reloadDraft=async()=>{
  if(busyRef.current)return false
  busyRef.current=true;setSaving(true)
  try{
   const {data:latest}=await query.refetch({throwOnError:true})
   if(dialog.type==='committee')setDraft(committeeDraft(latest))
   else if(dialog.type==='team')setDraft(teamDraft(latest))
   else{const task=latest.tasks.find(t=>t.key===dialog.task.key);setDraft({revision:task.revision,userId:task.assignee?.id??null})}
   setError('');setConflict(false);return true
  }catch(e){setError(message(e));return false}
  finally{busyRef.current=false;setSaving(false)}
 }
 const download=async()=>{
  if(busyRef.current)return false
  busyRef.current=true;setExporting(true);setError('')
  try{
   // Revalidate both permission and current content before exporting any personal names.
   const latest=await query.refetch({throwOnError:true})
   if(!latest.data?.canLead)throw new Error('팀장만 공지 이미지를 저장할 수 있습니다.')
   if(!committeeComplete(latest.data))throw new Error('예배위원을 먼저 등록해주세요.')
   const blob=await createNoticeImage(latest.data),result=await downloadWorshipImage(blob,date)
   if(result.status==='cancelled')return false
   notify(result.status==='saved'?'공지 이미지를 저장했습니다.':'공지 이미지 다운로드를 시작했습니다.');return true
  }catch(e){setError(message(e));return false}finally{busyRef.current=false;setExporting(false)}
 }
 const check=(t,review)=>run(()=>api.task(date,t.key,review?'review':'check',{revision:t.revision,checked:!(review?t.reviewed:t.completed)}),review?(t.reviewed?'팀장 확인을 해제했습니다.':'팀장 확인을 완료했습니다.'):(t.completed?'완료를 해제했습니다.':'준비 완료로 표시했습니다.'))
 const sections=[['before','예배 전'],['during','예배 중'],['after','예배 후']]
 const completed=data?.tasks.filter(t=>t.completed&&(!t.review||t.reviewed)).length||0
 return <>
  <Header title={page==='poster'?'예배위원 공지':'예배운영팀'} showBack onBack={()=>page==='poster'?go('notice'):page!=='home'?go('home'):navigate('/')} />
  <MotionPage className="wo-page">
   {page!=='poster'&&<SegmentedControl label="예배운영팀 메뉴" value={page} onChange={go} options={tabs} disabled={busy}/>}
   <div className="wo-week">
    <button className="icon-button" aria-label="이전 주" disabled={busy||!isWorshipDate(shiftWorshipDate(date,-1))} onClick={()=>go(page,shiftWorshipDate(date,-1))}><ChevronLeft size={20}/></button>
    <button className="wo-date" disabled={busy} onClick={()=>setDialog({type:'week'})}><span>{worshipDateLabel(date)} 주일</span><ChevronDown size={15}/></button>
    <button className="icon-button" aria-label="다음 주" disabled={busy||!isWorshipDate(shiftWorshipDate(date,1))} onClick={()=>go(page,shiftWorshipDate(date,1))}><ChevronRight size={20}/></button>
   </div>
   {date!==currentWorshipDate()&&<button className="wo-current" disabled={busy} onClick={()=>go(page,currentWorshipDate())}>이번 주로</button>}
   {query.isPending&&<p className="wo-empty" role="status">불러오는 중…</p>}
   {((error&&!dialog)||query.isError)&&<div className="wo-error" role="alert">{error||message(query.error)}<Button size="sm" variant="secondary" onClick={async()=>{await query.refetch();setDialog(null);setDraft(null);setError('')}}>최신 내용 확인</Button></div>}
   {data&&!data.canWork&&<p className="wo-readonly">열람 중</p>}
   {data&&page==='home'&&<>
    <section className="wo-card"><div className="wo-section-head"><h2><Church size={18}/>이번 주 예배위원</h2><button className="wo-text-button" onClick={()=>go('notice')}>공지 보기<ChevronRight size={15}/></button></div><Committee data={data}/></section>
    <section className="wo-card"><div className="wo-section-head"><h2><CalendarDays size={18}/>토요일</h2><span className={'wo-badge '+(data.announced?'done':'')}>{data.announced?'공지 완료':'공지 전'}</span></div>
     <label className="wo-notice-check"><MotionCheck checked={!!data.announced} disabled={!data.canLead||busy} onChange={()=>run(()=>api.announce(date,{revision:data.revision,checked:!data.announced}),data.announced?'공지 완료를 해제했습니다.':'공지 완료로 표시했습니다.')}/><span>카카오톡에 공지했어요{data.announced&&<small>{stamp(data.announced)}</small>}</span></label>
     <button className="wo-row-link" onClick={()=>go('notice')}><Image size={17}/>공지 이미지<ChevronRight size={17}/></button>
    </section>
    <div className="wo-section-head wo-progress"><h2><ClipboardCheck size={18}/>예배 준비</h2><span><strong>{completed}</strong> / {data.tasks.length}</span></div>
    {sections.map(([key,label])=><section className="wo-card wo-checklist" key={key}><h3>{label}</h3>{data.tasks.filter(t=>t.phase===key).map(t=><div className={'wo-task '+(t.completed?'is-complete':'')} key={t.key}>
     <div className="wo-task-main"><label><MotionCheck checked={!!t.completed} disabled={!t.canCheck||busy} onChange={()=>check(t,false)}/><span>{t.label}<small>{t.completed?stamp(t.completed):t.leaderOnly?'팀장':t.assignee?.name||'팀원'}{!t.assigneeAvailable?' · 담당자 재지정 필요':''}</small></span></label>
      {!t.leaderOnly&&data.canLead&&<button className="wo-text-button" disabled={busy} aria-label={t.label+' 담당 지정'} onClick={()=>openAssign(t)}>담당<ChevronDown size={14}/></button>}
     </div>
     {t.review&&<div className="wo-review"><span>{t.reviewed?stamp(t.reviewed):'팀장 확인'}</span><button className={t.reviewed?'checked':''} disabled={!data.canLead||busy||!t.completed} aria-pressed={!!t.reviewed} onClick={()=>check(t,true)}>{t.reviewed?<><Check size={14}/>확인 완료</>:'확인'}</button></div>}
    </div>)}</section>)}
   </>}
   {data&&page==='notice'&&<>
    <section className="wo-card"><div className="wo-section-head"><h2>예배위원</h2>{data.canLead&&<Button size="sm" variant="secondary" onClick={openCommittee}>명단 수정</Button>}</div><Committee data={data}/>{data.noticeMessage&&<p className="wo-note">{data.noticeMessage}</p>}</section>
    <section className="wo-card"><div className="wo-section-head"><h2>카카오톡 공지</h2><span className={'wo-badge '+(data.announced?'done':'')}>{data.announced?'공지 완료':'공지 전'}</span></div>
     <button className="wo-row-link" onClick={()=>go('poster')}><Image size={19}/><span>이미지 미리보기</span><ChevronRight size={18}/></button>
     {data.canLead&&<Button className="wo-wide" disabled={busy||!committeeComplete(data)} loading={exporting} onClick={download} successLabel="저장 요청 완료"><Download size={17}/>이미지 저장</Button>}
     {!committeeComplete(data)&&<p className="wo-meta">아직 정하지 않은 예배위원이 있습니다.</p>}
     {data.canLead&&<label className="wo-notice-check"><MotionCheck checked={!!data.announced} disabled={busy} onChange={()=>run(()=>api.announce(date,{revision:data.revision,checked:!data.announced}),data.announced?'공지 완료를 해제했습니다.':'공지 완료로 표시했습니다.')}/><span>카카오톡에 공지했어요{data.announced&&<small>{stamp(data.announced)}</small>}</span></label>}
    </section>
   </>}
   {data&&page==='poster'&&<>
    <article className="wo-poster" aria-label="공지 이미지 내용"><header><small>NEWAVE FLOW · 청소년부</small><h2>이번 주 예배위원</h2><p>{worshipDateLabel(date)} 주일</p></header><Committee data={data}/><p>{data.noticeMessage||'이번 주 예배를 함께 준비해주세요.'}</p></article>
    {data.canLead&&<Button className="wo-wide" disabled={busy||!committeeComplete(data)} loading={exporting} onClick={download} successLabel="저장 요청 완료"><Download size={17}/>이미지 저장</Button>}
   </>}
   {data&&page==='team'&&<>
    <section className="wo-card"><div className="wo-section-head"><h2><Users size={18}/>팀원 <span className="wo-meta">{data.team.length}명</span></h2>{data.canLead&&<Button size="sm" variant="secondary" onClick={openTeam}>팀원 지정</Button>}</div>
     {data.team.length?data.team.map(p=><div className="wo-team-row" key={p.id}><span className="wo-avatar">{p.name.slice(0,1)}</span><strong>{p.name}</strong><span className={'wo-badge '+(p.label==='팀장'?'leader':'')}>{p.label}</span></div>):<p className="wo-empty">등록된 팀원이 없습니다.</p>}
     {data.canLead&&<Link className="wo-row-link" to="/officers?view=organization">임원 조직도에서 팀장 확인<ChevronRight size={16}/></Link>}
    </section>
    {data.canLead&&<section className="wo-card"><div className="wo-section-head"><h2>이번 주 준비 담당</h2></div>{data.tasks.filter(t=>!t.leaderOnly).map(t=><button key={t.key} className="wo-row-link wo-assignment" onClick={()=>openAssign(t)}><span>{t.label}<small>{t.assignee?.name||'팀원 공동'}{!t.assigneeAvailable?' · 재지정 필요':''}</small></span><ChevronRight size={17}/></button>)}</section>}
   </>}
  </MotionPage>
  <AnimatePresence>{dialog?.type==='week'&&<MotionDialog className="wo-dialog" title="주일 선택" onClose={close}><WeekPicker date={date} onChoose={d=>go(page,d)}/></MotionDialog>}
   {data&&dialog?.type==='committee'&&<WorshipEditor title="예배위원 수정" onClose={close} busy={busy} error={error} canSave={data.canLead} onReload={conflict?reloadDraft:undefined} onSave={()=>run(()=>api.committee(date,draft),'예배위원을 저장했습니다.',true)}><CommitteeForm draft={draft} setDraft={setDraft} data={data}/></WorshipEditor>}
   {data&&dialog?.type==='team'&&<WorshipEditor title="팀원 지정" onClose={close} busy={busy} error={error} canSave={data.canLead} onReload={conflict?reloadDraft:undefined} onSave={()=>run(()=>api.team(date,draft),'팀원을 저장했습니다.',true)}><PeoplePicker label="예배운영팀 교사" people={data.candidates.filter(p=>!data.team.some(t=>t.id===p.id&&t.label==='팀장'))} selected={draft.userIds} onChange={userIds=>setDraft(d=>({...d,userIds}))}/></WorshipEditor>}
   {data&&dialog?.type==='assign'&&<WorshipEditor title="준비 담당 지정" onClose={close} busy={busy} error={error} canSave={data.canLead} onReload={conflict?reloadDraft:undefined} onSave={()=>run(()=>api.task(date,dialog.task.key,'assignee',draft),'담당자를 저장했습니다.',true)}><p className="wo-dialog-label">{dialog.task.label}</p><PersonSelect label="담당 교사" people={data.team} value={draft.userId} empty="팀원 공동" onChange={userId=>setDraft(d=>({...d,userId}))}/></WorshipEditor>}
  </AnimatePresence>
  <FeedbackToast className="wo-feedback" notice={notice} onClose={closeNotice}/>
 </>
}
