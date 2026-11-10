import DialogActions from '../components/common/DialogActions'
import {useCallback,useEffect,useId,useRef,useState} from 'react'
import {Link,useNavigate,useSearchParams} from 'react-router-dom'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {AnimatePresence} from 'framer-motion'
import {ChevronLeft,ChevronRight,Users,Inbox,Plus,Settings,BarChart3} from 'lucide-react'
import Header from '../components/layout/Header'
import AppSelect from '../components/common/AppSelect'
import SearchField from '../components/common/SearchField'
import {ActionButton as Button,MotionDialog,MotionPage,FeedbackToast,MotionCheck} from '../components/praise/PraiseMotion'
import {FormField,RequestForm,requestStatus,sharingName} from '../components/intercession/RequestForms'
import PrayerWorkspace from '../components/intercession/PrayerWorkspace'
import RequestDetail from '../components/intercession/RequestDetail'
import {normalizePrayerPage} from '../utils/prayerWorkspace'
import {intercessionApi as api} from '../api/intercession'
import useAuthStore from '../store/authStore'
import {getWeekStartByOffset,toApiDate} from '../utils/date'
import {addWeeks,parseISO} from 'date-fns'
import './OfficerPage.css'
import '../components/intercession/intercession.css'

const titles={home:'중보기도팀',requests:'기도제목',team:'팀원 명단',submit:'기도제목 보내기',mine:'내 기도제목',detail:'기도제목 상세'}
const shortDate=date=>date?.slice(5,10).replace('-','/')||''
const dayName=date=>new Date(date+'T12:00:00').getDay()===2?'화':'목'
const Label=({children})=><span className="it-badge">{children}</span>
const NewRequestBadge=({count})=>count>0?<span className="it-new-badge" aria-label={'새 기도제목 '+count+'건'}>새 요청 {count}</span>:null
const message=error=>error?.response?.data?.message||'연결을 확인하고 다시 시도해주세요.'
function QueryStatus({query}){return query.isError?<div className="it-error" role="alert">{message(query.error)}<Button size="sm" variant="secondary" onClick={()=>query.refetch()}>다시 확인</Button></div>:query.isPending?<p className="it-empty" role="status">불러오는 중…</p>:null}
function Pagination({data,onChange,busy}){return data?.pages>1&&<div className="it-row"><Button size="sm" variant="secondary" disabled={busy||data.page===0} onClick={()=>onChange(data.page-1)}>이전</Button><span className="it-meta">{data.page+1} / {data.pages}</span><Button size="sm" variant="secondary" disabled={busy||data.page+1>=data.pages} onClick={()=>onChange(data.page+1)}>다음</Button></div>}

export default function IntercessionPage(){
 const meetingFormId=useId()
 const user=useAuthStore(s=>s.user),navigate=useNavigate(),[params,setParams]=useSearchParams(),qc=useQueryClient()
 const requested=normalizePrayerPage(params.get('page')||'home'),page=titles[requested]?requested:'home'
 const week=params.get('week')||toApiDate(getWeekStartByOffset(0,1)),item=params.get('item')
 const [view,setView]=useState(params.get('page')==='inbox'?'pending':'current'),[search,setSearch]=useState(''),[pageNo,setPageNo]=useState(0)
 const [dialog,setDialog]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),busyRef=useRef(false)
 const [notice,setNotice]=useState(null),noticeId=useRef(0)
 const closeNotice=useCallback(()=>setNotice(null),[])
 const state=useQuery({queryKey:['intercession',user?.id,week],queryFn:()=>api.state(week),enabled:!!user,refetchInterval:15000})
 const data=state.isError?null:state.data,manager=!!data?.canManage,leader=!!data?.canLead,canViewTeam=!!(data?.canViewTeam??data?.canManage)
 const meetings=data?.meetings||[],team=data?.team||[]
 const listing=useQuery({queryKey:['intercession-list',user?.id,'mine',search,pageNo],
  queryFn:()=>api.list({scope:'mine',status:'all',search,page:pageNo}),enabled:!!data&&page==='mine',staleTime:0,refetchInterval:15000})
 const detailId=dialog?.type==='request'?dialog.id:item
 const detail=useQuery({queryKey:['intercession-detail',user?.id,detailId],queryFn:()=>api.detail(detailId),enabled:!!data&&!!detailId&&(page==='detail'||dialog?.type==='request'),staleTime:0,refetchOnWindowFocus:false})
 const active=detail.isError?null:detail.data
 const url=(next,extra={})=>'?'+new URLSearchParams({page:next,week,...extra}).toString()
 const go=(next,extra={})=>{setError('');setParams({page:next,week,...extra})}
 const refresh=async()=>{await Promise.all([qc.invalidateQueries({queryKey:['intercession']}),qc.invalidateQueries({queryKey:['intercession-list']}),qc.invalidateQueries({queryKey:['intercession-detail']}),qc.invalidateQueries({queryKey:['officer-access']})])}
 const run=async(action,success,after)=>{
  if(busyRef.current)return false
  busyRef.current=true;setBusy(true);setError('')
  try{const result=await action();await refresh();after?.(result);setNotice({id:++noticeId.current,text:success});return result}
  catch(e){setError(message(e));return false}
  finally{busyRef.current=false;setBusy(false)}
 }
 const setSearchTerm=value=>{setSearch(value);setPageNo(0)}
 useEffect(()=>{setSearch('');setPageNo(0);setError('');window.scrollTo(0,0)},[page])
 const closeDialog=()=>{if(!busy){setDialog(null);setError('')}}
 const openMeeting=m=>{setError('');setDialog({type:'meeting',...m,canceled:!!m.canceled,cancellationReason:m.cancellationReason||''})}
 const copyCollection=async text=>{
  try{await navigator.clipboard.writeText(text);setNotice({id:++noticeId.current,text:'기도제목을 복사했습니다.'})}
  catch{setError('');setDialog({type:'copy',text})}
 }
 const menuLink=(to,Icon,title,meta)=><Link className="it-menu motion-tap" to={url(to)}><span className="it-icon"><Icon size={21}/></span><span><span className="it-menu-title"><strong>{title}</strong>{to==='requests'&&manager&&<NewRequestBadge count={data.pending}/>}</span>{meta&&<small>{meta}</small>}</span><ChevronRight size={17}/></Link>
 const openRequest=r=>{setError('');setDialog({type:'request',id:r.id})}
 const requestReturn=()=>normalizePrayerPage(params.get('from'))==='mine'?'mine':'requests'
 const saveRequest=(form,action)=>run(()=>api.decide(active.id,form),action==='accept'?(form.publish?'기도제목을 공유했습니다.':'현재 기도제목에 추가했습니다.'):action==='complete'?'지난 기도제목으로 옮겼습니다.':action==='resume'?'현재 기도제목으로 옮겼습니다.':'변경사항을 저장했습니다.',()=>{
  if(action==='edit')return
  setView(form.completed?'past':'current');setDialog(null)
  if(page==='detail')go(requestReturn())
 })
 const requestLink=(r,publicOnly=false)=><button key={r.id} className="it-request motion-tap" onClick={()=>openRequest(r)}><span className="it-request-top"><span className="it-category">{r.category}</span><span className="it-meta">{publicOnly?shortDate(r.date):[r.author,r.source].filter(Boolean).join(' · ')}</span></span><strong>{publicOnly?r.publicTitle:r.title}</strong>{publicOnly?<p>{r.publicText}</p>:<span className="it-request-bottom"><span className="it-meta">{sharingName(r)}</span>{r.pendingUpdate?<span className="it-new-badge">수정·근황 확인 대기</span>:<Label>{requestStatus(r)}</Label>}</span>}</button>
 const managerPage=page==='team'
 const register=()=>{setError('');setDialog({type:'register',proxy:false})}
 const deleteRequest=()=>run(()=>api.withdraw(active.id,active.revision),'기도제목을 삭제했습니다.',()=>{setDialog(null);if(page==='detail')go(requestReturn())})
 const saveUpdate=form=>run(()=>api.update(active.id,form),'수정 내용과 근황을 팀에 전달했습니다.')
 const reviewUpdate=form=>run(()=>api.reviewUpdate(active.id,form),form.updatePublic?'공유 내용에 반영했습니다.':'팀에서 확인했습니다.',()=>{setDialog(null);setView(active.completed?'past':'current');if(page==='detail')go(requestReturn())})
 const requestDetail=active&&<RequestDetail request={active} manager={manager} busy={busy} onSave={saveRequest} onUpdate={saveUpdate} onReviewUpdate={reviewUpdate} onDelete={()=>{setError('');setDialog({type:'request',id:active.id,confirmDelete:true})}}/>
 return <div className="it-app" data-feature-tone="violet">
  <Header title={titles[page]} showBack showNotification onBack={()=>page==='home'?navigate('/'):go(page==='detail'?requestReturn():page==='mine'?'requests':'home')}/>
  <MotionPage key={page} className="it-body">
   <QueryStatus query={state}/>
   {error&&!dialog&&<div role="alert" className="it-error">{error}<button className="it-text-button" onClick={()=>{setError('');refresh()}}>최신 내용 확인</button></div>}
   {data&&managerPage&&!canViewTeam?<p className="it-empty">중보기도팀만 이용할 수 있습니다.</p>:data&&<>
   {['home','team'].includes(page)&&<nav className="it-row" aria-label="기도모임 주차"><button className="icon-button" aria-label="지난주" disabled={busy} onClick={()=>setParams({page,week:toApiDate(addWeeks(parseISO(week),-1))})}><ChevronLeft size={20}/></button><span className="it-meta">{shortDate(meetings[0]?.date)}(화) · {shortDate(meetings[1]?.date)}(목)</span><button className="icon-button" aria-label="다음 주" disabled={busy} onClick={()=>setParams({page,week:toApiDate(addWeeks(parseISO(week),1))})}><ChevronRight size={20}/></button></nav>}
   {page==='home'&&<>
    <section className="it-section it-meeting-section">
     <div className="it-section-heading"><h2>화·목 기도모임</h2><Link className="it-text-button" to="/meeting/prayer">참석 투표 ›</Link></div>
     <div className="it-meetings">{meetings.map(m=><article className={'it-card'+(m.canceled?' it-canceled':'')} key={m.date}>
      <div className="it-row"><strong className="it-date">{shortDate(m.date)} <span>{dayName(m.date)}</span></strong><Label>{m.canceled?'모임 없음':'Zoom'}</Label></div>
      <strong className="it-time">21:30</strong><p className="it-meta">진행 · {m.hostName}</p>
      {m.canceled&&m.cancellationReason&&<p className="it-cancel-note">{m.cancellationReason}</p>}
      <div className="it-row it-vote"><span>참석 투표</span><strong>{m.voters}명</strong></div>
      {manager&&<button className="it-text-button" onClick={()=>openMeeting(m)}><Settings size={13}/>모임 설정</button>}
     </article>)}</div>
     {user?.role!=='TEACHER'&&(week>toApiDate(getWeekStartByOffset(0,1))?<div className="it-menu it-participation-link it-statistics-upcoming" aria-disabled="true"><span className="it-icon"><BarChart3 size={21}/></span><strong>기도모임 참석 통계</strong><span className="it-meta">집계 전</span></div>:<Link className="it-menu it-participation-link motion-tap" to={'/admin/prayer?week='+week} aria-label="기도모임 참석 통계 보기"><span className="it-icon"><BarChart3 size={21}/></span><strong>기도모임 참석 통계</strong><ChevronRight size={18}/></Link>)}
     <p className="it-meta">Zoom 링크는 카톡으로 공유해요.</p>
    </section>
    <section className="it-section">{manager&&<h2>기도모임 관리</h2>}<div className="it-menu-list">{menuLink('requests',Inbox,'기도제목')}{canViewTeam&&menuLink('team',Users,'팀원 명단',team.length+'명')}</div></section>
   </>}
   {page==='requests'&&<PrayerWorkspace key={user?.id} userId={user?.id} manager={manager} pending={data.pending} view={view} onView={setView} onRegister={register} onMine={()=>go('mine')} onOpen={openRequest} onCopy={copyCollection}/>}
   {page==='mine'&&<>
    <div className="it-row"><span className="it-meta">내가 보낸 기도제목</span><Button size="sm" onClick={register}><Plus size={15}/>기도제목 보내기</Button></div>
    <SearchField label="기도제목 검색" value={search} onChange={setSearchTerm} placeholder="제목·제출자 검색"/>
    <QueryStatus query={listing}/>{!listing.isError&&<div className="it-request-list">{listing.data?.items.map(r=>requestLink(r))}{listing.data?.total===0&&<p className="it-empty">{search?'검색 결과가 없습니다.':'기도제목이 없습니다.'}</p>}</div>}
    <Pagination data={listing.data} onChange={setPageNo} busy={listing.isFetching}/>
   </>}
   {page==='submit'&&<RequestForm busy={busy} onSave={form=>run(()=>api.submit(form),'기도제목을 보냈습니다.',()=>go('mine'))}/>}
   {page==='detail'&&<><QueryStatus query={detail}/>{requestDetail}</>}
   {page==='team'&&<><div className="it-row"><span className="it-meta">{team.length}명</span>{leader&&<Button size="sm" onClick={()=>{setError('');setDialog({type:'members',revision:data.teamRevision,ids:team.map(t=>t.id)})}}>팀원 지정</Button>}</div><section className="it-card it-members">{team.map(t=><div key={t.id}><span className="it-icon"><Users size={20}/></span><div><strong>{t.name}</strong><small>{t.role}</small></div><span className="it-meta">{meetings.filter(m=>m.hostId===t.id).map(m=>shortDate(m.date)+'('+dayName(m.date)+')').join(' · ')||'이번 주 담당 없음'}</span></div>)}{!team.length&&<p className="it-empty">팀원을 지정해주세요.</p>}</section><section className="it-card it-stack"><h2>이번 주 진행자</h2>{meetings.map(m=><div className="it-row" key={m.date}><span>{shortDate(m.date)}({dayName(m.date)})</span><strong>{m.hostName}</strong><button className="it-text-button" onClick={()=>openMeeting(m)}>변경</button></div>)}</section></>}
   </>}
  </MotionPage><FeedbackToast notice={notice} onClose={closeNotice}/>
  <AnimatePresence>
   {dialog&&<MotionDialog className={'it-dialog'+(dialog.type==='request'&&!dialog.confirmDelete?' it-request-dialog':'')} title={dialog.type==='meeting'?shortDate(dialog.date)+'('+dayName(dialog.date)+') 모임 설정':dialog.type==='register'?'기도제목 등록':dialog.type==='members'?'팀원 지정':dialog.type==='request'?(dialog.confirmDelete?'기도제목 삭제':'기도제목'):'기도제목 복사'} busy={busy} error={error} onClose={closeDialog}>
    {dialog.type==='register'&&<div className="it-app it-dialog-content it-stack" data-feature-tone="violet">
     {manager&&<label className="it-check"><MotionCheck checked={dialog.proxy} disabled={busy} onChange={e=>setDialog(d=>({...d,proxy:e.target.checked}))}/>다른 분의 기도제목 대신 등록</label>}
     <RequestForm key={String(dialog.proxy)} proxy={dialog.proxy} busy={busy} onSave={form=>run(()=>api.submit(form),'기도제목을 보냈습니다.',()=>{setDialog(null);if(manager)setView('pending')})}/>
    </div>}
    {dialog.type==='request'&&<div className="it-app it-dialog-content" data-feature-tone="violet"><QueryStatus query={detail}/>{active&&(dialog.confirmDelete?<div className="it-stack"><p className="it-prayer-copy">이 기도제목을 삭제할까요? 목록과 공유 화면에서 사라집니다.</p><DialogActions><Button variant="secondary" disabled={busy} onClick={()=>setDialog(d=>({...d,confirmDelete:false}))}>취소</Button><Button loading={busy} onClick={deleteRequest}>삭제하기</Button></DialogActions></div>:requestDetail)}</div>}
    {dialog.type==='meeting'&&<form id={meetingFormId} className="it-stack" onSubmit={e=>{e.preventDefault();run(()=>api.meeting(dialog.date,{revision:dialog.revision,startTime:'21:30',duration:Number(dialog.duration),hostId:dialog.hostId||null,zoomUrl:dialog.zoom,canceled:dialog.canceled,cancellationReason:dialog.canceled?dialog.cancellationReason:''}),'모임 설정을 저장했습니다.',()=>setDialog(null))}}><fieldset disabled={busy} className="it-stack">
     <div className="it-row"><span className="it-meta">시작 시간</span><strong>21:30 고정</strong></div>
     <FormField label="기도 인도자"><AppSelect aria-label="기도 인도자" value={dialog.hostId||''} onChange={e=>setDialog(d=>({...d,hostId:Number(e.target.value)||null}))}><option value="">미배정</option>{team.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</AppSelect></FormField>
     <label className="it-check"><MotionCheck checked={dialog.canceled} onChange={e=>setDialog(d=>({...d,canceled:e.target.checked}))}/><span>이번 모임은 쉬어요</span></label>
     {dialog.canceled&&<><FormField label="쉬는 이유 (선택)"><AppSelect aria-label="쉬는 이유" value={dialog.cancellationReason} onChange={e=>setDialog(d=>({...d,cancellationReason:e.target.value}))}><option value="">선택 안 함</option>{['교회 행사','부서 행사','기타'].map(reason=><option key={reason} value={reason}>{reason}</option>)}</AppSelect></FormField><p className="it-meta">기존 투표·통계는 유지됩니다.</p></>}
     <DialogActions><Button type="submit" form={meetingFormId} loading={busy}>저장</Button></DialogActions>
    </fieldset></form>}
    {dialog.type==='members'&&<><div className="it-pick-list">{data?.candidates.map(t=><label className="it-pick" key={t.id}><MotionCheck disabled={busy||team.some(m=>m.id===t.id&&m.role==='팀장')} checked={dialog.ids.includes(t.id)} onChange={e=>setDialog(d=>({...d,ids:e.target.checked?[...d.ids,t.id]:d.ids.filter(id=>id!==t.id)}))}/><span>{t.name}<small>{team.find(m=>m.id===t.id)?.role||'교사'}</small></span></label>)}</div><DialogActions><Button loading={busy} onClick={()=>run(()=>api.team({revision:dialog.revision,userIds:dialog.ids}),'팀원 명단을 저장했습니다.',()=>setDialog(null))}>명단 저장</Button></DialogActions></>}
    {dialog.type==='copy'&&<textarea className="field-input" rows={10} readOnly value={dialog.text} aria-label="복사할 기도제목"/>}
   </MotionDialog>}
  </AnimatePresence>
 </div>
}
