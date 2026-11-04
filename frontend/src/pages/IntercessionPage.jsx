import {useCallback,useEffect,useRef,useState} from 'react'
import {Link,useNavigate,useSearchParams} from 'react-router-dom'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {AnimatePresence} from 'framer-motion'
import {ChevronLeft,ChevronRight,ArrowUp,ArrowDown,Users,FileText,Inbox,Plus,Monitor,Check,Copy,Settings,X} from 'lucide-react'
import Header from '../components/layout/Header'
import AppSelect from '../components/common/AppSelect'
import SegmentedControl from '../components/common/SegmentedControl'
import SearchField from '../components/common/SearchField'
import StatSummary from '../components/common/StatSummary'
import {ActionButton as Button,MotionDialog,MotionPage,FeedbackToast,MotionCheck} from '../components/praise/PraiseMotion'
import {FormField,RequestForm,ReviewForm,statusName} from '../components/intercession/RequestForms'
import {intercessionApi as api} from '../api/intercession'
import useAuthStore from '../store/authStore'
import {getWeekStartByOffset,toApiDate} from '../utils/date'
import {addWeeks,parseISO} from 'date-fns'
import './OfficerPage.css'
import '../components/intercession/intercession.css'

const titles={home:'중보기도팀',inbox:'기도제목 접수·정리',board:'함께 기도해요',materials:'모임 자료',team:'팀원 명단',submit:'기도제목 보내기',mine:'내 기도제목',detail:'기도제목 상세',present:'함께 기도해요'}
const shortDate=date=>date?.slice(5,10).replace('-','/')||''
const dayName=date=>new Date(date+'T12:00:00').getDay()===2?'화':'목'
const Label=({children})=><span className="it-badge">{children}</span>
const message=error=>error?.response?.data?.message||'연결을 확인하고 다시 시도해주세요.'
function QueryStatus({query}){return query.isError?<div className="it-error" role="alert">{message(query.error)}<Button size="sm" variant="secondary" onClick={()=>query.refetch()}>다시 확인</Button></div>:query.isPending?<p className="it-empty" role="status">불러오는 중…</p>:null}
function Pagination({data,onChange,busy}){return data?.pages>1&&<div className="it-row"><Button size="sm" variant="secondary" disabled={busy||data.page===0} onClick={()=>onChange(data.page-1)}>이전</Button><span className="it-meta">{data.page+1} / {data.pages}</span><Button size="sm" variant="secondary" disabled={busy||data.page+1>=data.pages} onClick={()=>onChange(data.page+1)}>다음</Button></div>}

export default function IntercessionPage(){
 const user=useAuthStore(s=>s.user),navigate=useNavigate(),[params,setParams]=useSearchParams(),qc=useQueryClient()
 const requested=params.get('page')||'home',page=titles[requested]?requested:'home'
 const week=params.get('week')||toApiDate(getWeekStartByOffset(0,1)),item=params.get('item')
 const day=params.get('date'),setDay=date=>setParams(p=>{const next=new URLSearchParams(p);next.set('date',date);return next})
 const [filter,setFilter]=useState('pending'),[boardFilter,setBoardFilter]=useState('published'),[search,setSearch]=useState(''),[pageNo,setPageNo]=useState(0)
 const [dialog,setDialog]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),busyRef=useRef(false)
 const [notice,setNotice]=useState(null),noticeId=useRef(0),[slide,setSlide]=useState(0),[fontSize,setFontSize]=useState(32)
 const closeNotice=useCallback(()=>setNotice(null),[])
 const state=useQuery({queryKey:['intercession',user?.id,week],queryFn:()=>api.state(week),enabled:!!user,refetchInterval:15000})
 const data=state.isError?null:state.data,manager=!!data?.canManage,leader=!!data?.canLead
 const meetings=data?.meetings||[],team=data?.team||[],current=meetings.find(m=>m.date===day)||meetings[1]||meetings[0]
 const scope=page==='inbox'?'inbox':page==='mine'?'mine':'board'
 const listStatus=scope==='inbox'?filter:page==='home'?'published':scope==='board'?boardFilter:'all'
 const listing=useQuery({queryKey:['intercession-list',user?.id,scope,listStatus,search,pageNo],
  queryFn:()=>api.list({scope,status:listStatus,search,page:pageNo}),
  enabled:!!data&&['home','inbox','board','mine'].includes(page)&&(scope!=='inbox'||manager)})
 const detail=useQuery({queryKey:['intercession-detail',user?.id,item],queryFn:()=>api.detail(item),enabled:!!data&&page==='detail'&&!!item,refetchOnWindowFocus:false})
 const active=detail.isError?null:detail.data,picked=current?.selected||[],paper=current?.paper||[]
 const url=(next,extra={})=>'?'+new URLSearchParams({page:next,week,...(day?{date:day}:{}),...extra}).toString()
 const go=(next,extra={})=>{setError('');setParams({page:next,week,...(day?{date:day}:{}),...extra})}
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
 useEffect(()=>{setSlide(0)},[current?.date,current?.preparedAt])
 useEffect(()=>{if(page!=='present')return;const keys=e=>{if(e.key==='ArrowRight')setSlide(n=>Math.min(paper.length-1,n+1));if(e.key==='ArrowLeft')setSlide(n=>Math.max(0,n-1));if(e.key==='Escape')go('materials')};window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys)},[page,paper.length,week])
 const closeDialog=()=>{if(!busy){setDialog(null);setError('')}}
 const openMeeting=m=>{setError('');setDialog({type:'meeting',...m,time:m.time?.slice(0,5)||''})}
 const saveSelection=ids=>run(()=>api.materials(current.date,{revision:current.revision,requestIds:ids}),'모임 자료에 반영했습니다.')
 const move=(index,delta)=>{const ids=picked.map(r=>r.id),target=index+delta;if(target<0||target>=ids.length)return;[ids[index],ids[target]]=[ids[target],ids[index]];return saveSelection(ids)}
 const copyPaper=()=>run(async()=>{
  const fresh=await api.state(week),m=fresh.meetings.find(m=>m.date===current.date)
  if(!m?.paper.length||m.paperStale)throw new Error('자료 변경')
  const text=[m.date+'('+dayName(m.date)+') 함께 기도해요',...m.paper.map((r,i)=>(i+1)+'. '+r.title+'\n'+r.body+(r.author?'\n'+r.author:''))].join('\n\n')
  try{await navigator.clipboard.writeText(text)}catch{setDialog({type:'copy',text})}
 },'공유 문구를 준비했습니다.')
 const menuLink=(to,Icon,title,meta)=><Link className="it-menu motion-tap" to={url(to)}><span className="it-icon"><Icon size={21}/></span><span><strong>{title}</strong>{meta&&<small>{meta}</small>}</span><ChevronRight size={17}/></Link>
 const requestLink=(r,publicOnly=false)=><button key={r.id} className="it-request motion-tap" onClick={()=>go('detail',{item:String(r.id)})}><span className="it-request-top"><span className="it-category">{r.category}</span><span className="it-meta">{publicOnly?shortDate(r.date):[r.author,r.source].filter(Boolean).join(' · ')}</span></span><strong>{publicOnly?r.publicTitle:r.title}</strong>{publicOnly?<p>{r.publicText}</p>:<span className="it-request-bottom"><span className="it-meta">{r.share?'전체 공유 요청':'팀만 전달'}</span><Label>{statusName[r.state]}</Label></span>}</button>
 const managerPage=['inbox','materials','team','present'].includes(page)
 return <div className={'it-app '+(page==='present'?'it-wide':'')} data-feature-tone="violet">
  <Header title={titles[page]} showBack showNotification={page!=='present'} onBack={()=>page==='home'?navigate('/'):go('home')}/>
  <MotionPage key={page} className="it-body">
   <QueryStatus query={state}/>
   {error&&!dialog&&<div role="alert" className="it-error">{error}<button className="it-text-button" onClick={()=>{setError('');refresh()}}>최신 내용 확인</button></div>}
   {data&&managerPage&&!manager?<p className="it-empty">중보기도팀만 이용할 수 있습니다.</p>:data&&<>
   {['home','materials','team'].includes(page)&&<nav className="it-row" aria-label="기도모임 주차"><button className="icon-button" aria-label="지난주" disabled={busy} onClick={()=>setParams({page,week:toApiDate(addWeeks(parseISO(week),-1))})}><ChevronLeft size={20}/></button><span className="it-meta">{shortDate(meetings[0]?.date)}(화) · {shortDate(meetings[1]?.date)}(목)</span><button className="icon-button" aria-label="다음 주" disabled={busy} onClick={()=>setParams({page,week:toApiDate(addWeeks(parseISO(week),1))})}><ChevronRight size={20}/></button></nav>}
   {page==='home'&&<>
    <section className="it-section"><div className="it-section-heading"><h2>화·목 기도모임</h2><Link className="it-text-button" to="/meeting/prayer">참석 투표 ›</Link></div><div className="it-meetings">{meetings.map(m=><article className="it-card" key={m.date}><div className="it-row"><strong className="it-date">{shortDate(m.date)} <span>{dayName(m.date)}</span></strong><Label>Zoom</Label></div><strong className="it-time">{m.time?m.time.slice(0,5)+' · '+m.duration+'분':'시간 미정'}</strong><p className="it-meta">진행 · {m.hostName}</p><div className="it-row it-vote"><span>참석 투표</span><strong>{m.voters}명</strong></div>{m.zoom?<a className="it-zoom motion-tap" href={m.zoom} target="_blank" rel="noopener noreferrer">Zoom 입장</a>:<Button size="sm" variant="secondary" disabled>링크 등록 대기</Button>}{manager&&<button className="it-text-button" onClick={()=>openMeeting(m)}><Settings size={13}/>모임 설정</button>}</article>)}</div></section>
    {manager&&<><StatSummary label="팀 준비 현황" items={[{label:'새 기도제목',value:data.pending,unit:'건'},{label:'전체 공유',value:data.published,unit:'건'},{label:'모임 자료',value:picked.length,unit:'건'}]}/><section className="it-section"><h2>팀 업무</h2><div className="it-menu-list">{menuLink('inbox',Inbox,'기도제목 접수·정리',data.pending+'건 대기')}{menuLink('materials',Monitor,'모임 자료 준비')}{menuLink('team',Users,'팀원 명단',team.length+'명')}</div></section></>}
    <div className="it-personal-actions"><Link className="it-text-button" to={url('submit')}><Plus size={15}/>기도제목 보내기</Link><Link className="it-text-button" to={url('mine')}>내 기도제목 ›</Link></div>
    <section className="it-section"><div className="it-section-heading"><h2>함께 기도해요</h2><Link className="it-text-button" to={url('board')}>전체 보기<ChevronRight size={14}/></Link></div><QueryStatus query={listing}/>{!listing.isError&&<div className="it-request-list">{listing.data?.items.slice(0,2).map(r=>requestLink(r,true))}{listing.data?.total===0&&<p className="it-empty">공유된 기도제목이 없습니다.</p>}</div>}</section>
    {user?.role!=='TEACHER'&&<Link className="it-text-button" to="/admin/prayer">기도모임 참석 통계 ›</Link>}
   </>}
   {['board','inbox','mine'].includes(page)&&<>
    <div className="it-row"><span className="it-meta">{page==='inbox'?'새 요청 '+data.pending+'건':page==='board'?'교사 전체 공유':'내가 보낸 기도제목'}</span><Button size="sm" onClick={()=>page==='inbox'?(setError(''),setDialog({type:'proxy'})):go('submit')}><Plus size={15}/>{page==='inbox'?'대신 등록':'기도제목 보내기'}</Button></div>
    {page==='inbox'&&<SegmentedControl label="접수 상태" value={filter} onChange={v=>{setFilter(v);setPageNo(0)}} options={[{value:'pending',label:'새 요청'},{value:'published',label:'공유 중'},{value:'private',label:'팀만'},{value:'all',label:'전체'}]}/>}
    {page==='board'&&<SegmentedControl label="공유 기도제목" value={boardFilter} onChange={v=>{setBoardFilter(v);setPageNo(0)}} options={[{value:'published',label:'함께 기도'},{value:'answered',label:'응답·감사'}]}/>}
    <SearchField label="기도제목 검색" value={search} onChange={setSearchTerm} placeholder={page==='board'?'공유 제목·내용 검색':'제목·제출자 검색'}/>
    <QueryStatus query={listing}/>{!listing.isError&&<div className="it-request-list">{listing.data?.items.map(r=>requestLink(r,page==='board'))}{listing.data?.total===0&&<p className="it-empty">기도제목이 없습니다.</p>}</div>}
    <Pagination data={listing.data} onChange={setPageNo} busy={listing.isFetching}/>
   </>}
   {page==='submit'&&<RequestForm busy={busy} onSave={form=>run(()=>api.submit(form),'기도제목을 보냈습니다.',()=>go('mine'))}/>}
   {page==='detail'&&<><QueryStatus query={detail}/>{active&&<>
    <div className="it-row"><Label>{active.category}</Label><span className="it-meta">{shortDate(active.date)} · {statusName[active.state]}</span></div>
    {active.canReadOriginal&&(active.own||manager)&&<section className="it-card it-stack"><div className="it-row"><h2>접수 원문</h2><span className="it-meta">{active.source} · {active.author}</span></div><strong>{active.title}</strong><p className="it-prayer-copy">{active.body}</p><span className="it-meta">{active.share?'전체 공유 가능':'팀만 전달'}</span></section>}
    {manager?<ReviewForm key={active.id+':'+active.revision} request={active} busy={busy} onSave={form=>run(()=>api.review(active.id,form),form.action==='PUBLISH'?'전체에 공유했습니다.':form.action==='ANSWER'?'응답·감사로 옮겼습니다.':'정리한 내용을 저장했습니다.')}/>:active.share&&['published','answered'].includes(active.state)?<section className="it-card it-stack"><h2>{active.publicTitle}</h2><p className="it-prayer-copy">{active.publicText}</p>{!active.anonymous&&<span className="it-meta">{active.author}</span>}<Label>교사 전체 공유</Label></section>:active.state!=='archived'&&<p className="it-meta">팀에서 확인하고 있습니다.</p>}
    {(active.own||manager)&&active.state!=='archived'&&<button className="it-text-button" onClick={()=>{setError('');setDialog({type:'withdraw',request:active})}}>기도제목 철회</button>}
   </>}</>}
   {page==='materials'&&current&&<>
    <SegmentedControl label="모임 날짜" value={current.date} onChange={setDay} options={meetings.map(m=>({value:m.date,label:shortDate(m.date)+'('+dayName(m.date)+')'}))}/>
    <div className="it-row"><div><h2>함께 기도할 제목</h2><span className="it-meta">{picked.length}건 · {current.paperStale?'자료 변경됨':paper.length?'공유본 준비됨':'준비 중'}</span></div><Button size="sm" variant="secondary" disabled={busy} onClick={()=>{setError('');setDialog({type:'pick',date:current.date,revision:current.revision,ids:picked.map(r=>r.id)})}}><Plus size={15}/>제목 추가</Button></div>
    <section className="it-paper-list">{picked.map((r,i)=><article className="it-paper-row" key={r.id}><span className="it-number">{i+1}</span><div><span className="it-category">{r.category}</span><strong>{r.publicTitle}</strong><p>{r.publicText}</p></div><div className="it-sort"><button className="icon-button" aria-label={r.publicTitle+' 위로'} disabled={busy||i===0} onClick={()=>move(i,-1)}><ArrowUp size={17}/></button><button className="icon-button" aria-label={r.publicTitle+' 아래로'} disabled={busy||i===picked.length-1} onClick={()=>move(i,1)}><ArrowDown size={17}/></button><button className="icon-button" aria-label={r.publicTitle+' 제외'} disabled={busy} onClick={()=>saveSelection(picked.filter(p=>p.id!==r.id).map(p=>p.id))}><X size={15}/></button></div></article>)}{!picked.length&&<p className="it-empty">기도제목을 선택해주세요.</p>}</section>
    <div className="it-actions"><Button variant="secondary" disabled={busy||!paper.length} onClick={copyPaper}><Copy size={16}/>공유 문구 복사</Button><Button disabled={busy||!picked.length} onClick={()=>run(()=>api.prepare(current.date,current.revision),'공유본을 준비했습니다.')}><Check size={16}/>{current.paperStale?'공유본 다시 만들기':'공유본 만들기'}</Button></div>
    <Button variant="secondary" size="lg" disabled={busy||!paper.length} onClick={()=>{setSlide(0);go('present')}}><Monitor size={18}/>모임 화면 띄우기</Button>
   </>}
   {page==='present'&&<section className="it-presentation"><div className="it-row"><span>{shortDate(current?.date)}({dayName(current?.date)}) 기도모임</span><span>{paper.length?slide+1:0} / {paper.length}</span></div>{paper[slide]?<article key={paper[slide].id}><span className="it-category">{paper[slide].category}</span><h2>{paper[slide].title}</h2><p style={{fontSize}}>{paper[slide].body}</p>{paper[slide].author&&<small>{paper[slide].author}</small>}</article>:<p>모임 자료에서 공유본을 준비해주세요.</p>}<div className="it-present-controls"><button className="icon-button" disabled={slide===0} aria-label="이전 기도제목" onClick={()=>setSlide(n=>n-1)}><ChevronLeft/></button><button className="it-text-button" onClick={()=>setFontSize(n=>Math.max(24,n-4))} aria-label="글씨 줄이기">가−</button><button className="it-text-button" onClick={()=>setFontSize(n=>Math.min(52,n+4))} aria-label="글씨 키우기">가＋</button><button className="icon-button" disabled={slide>=paper.length-1} aria-label="다음 기도제목" onClick={()=>setSlide(n=>n+1)}><ChevronRight/></button></div><Link className="it-text-button" to={url('materials')}>모임 자료로 돌아가기</Link></section>}
   {page==='team'&&<><div className="it-row"><span className="it-meta">{team.length}명</span>{leader&&<Button size="sm" onClick={()=>{setError('');setDialog({type:'members',revision:data.teamRevision,ids:team.map(t=>t.id)})}}>팀원 지정</Button>}</div><section className="it-card it-members">{team.map(t=><div key={t.id}><span className="it-icon"><Users size={20}/></span><div><strong>{t.name}</strong><small>{t.role}</small></div><span className="it-meta">{meetings.filter(m=>m.hostId===t.id).map(m=>shortDate(m.date)+'('+dayName(m.date)+')').join(' · ')||'이번 주 담당 없음'}</span></div>)}{!team.length&&<p className="it-empty">팀원을 지정해주세요.</p>}</section><section className="it-card it-stack"><h2>이번 주 진행자</h2>{meetings.map(m=><div className="it-row" key={m.date}><span>{shortDate(m.date)}({dayName(m.date)})</span><strong>{m.hostName}</strong><button className="it-text-button" onClick={()=>openMeeting(m)}>변경</button></div>)}</section></>}
   </>}
  </MotionPage><FeedbackToast notice={notice} onClose={closeNotice}/>
  <AnimatePresence>
   {dialog&&<MotionDialog title={dialog.type==='meeting'?shortDate(dialog.date)+'('+dayName(dialog.date)+') 모임 설정':dialog.type==='proxy'?'기도제목 대신 등록':dialog.type==='pick'?'함께 기도할 제목':dialog.type==='members'?'팀원 지정':dialog.type==='withdraw'?'기도제목 철회':'공유 문구'} busy={busy} error={error} onClose={closeDialog}>
    {dialog.type==='proxy'&&<RequestForm proxy busy={busy} onSave={form=>run(()=>api.submit(form),'대리 등록했습니다.',()=>{setDialog(null);setFilter('pending');go('inbox')})}/>}
    {dialog.type==='meeting'&&<form className="it-stack" onSubmit={e=>{e.preventDefault();run(()=>api.meeting(dialog.date,{revision:dialog.revision,startTime:dialog.time||null,duration:Number(dialog.duration),hostId:dialog.hostId||null,zoomUrl:dialog.zoom}),'모임 설정을 저장했습니다.',()=>setDialog(null))}}><fieldset disabled={busy} className="it-stack">
     <div className="it-form-grid"><FormField label="시작 시간"><input type="time" className="field-input" value={dialog.time} onInput={e=>setDialog(d=>({...d,time:e.target.value}))} onChange={e=>setDialog(d=>({...d,time:e.target.value}))}/></FormField><FormField label="진행 시간"><AppSelect aria-label="진행 시간" value={dialog.duration} onChange={e=>setDialog(d=>({...d,duration:e.target.value}))}>{[30,45,60].map(d=><option key={d} value={d}>{d}분</option>)}</AppSelect></FormField></div>
     <FormField label="기도 인도자"><AppSelect aria-label="기도 인도자" value={dialog.hostId||''} onChange={e=>setDialog(d=>({...d,hostId:Number(e.target.value)||null}))}><option value="">미배정</option>{team.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</AppSelect></FormField>
     <FormField label="Zoom 주소"><input type="url" maxLength={1000} className="field-input" value={dialog.zoom} onChange={e=>setDialog(d=>({...d,zoom:e.target.value}))} placeholder="https://…zoom.us/…"/></FormField><Button type="submit" loading={busy}>저장</Button>
    </fieldset></form>}
    {dialog.type==='pick'&&<RequestPicker userId={user?.id} ids={dialog.ids} busy={busy} onChange={ids=>setDialog(d=>({...d,ids}))} onSave={()=>run(()=>api.materials(dialog.date,{revision:dialog.revision,requestIds:dialog.ids}),'모임 자료에 반영했습니다.',()=>setDialog(null))}/>}
    {dialog.type==='members'&&<><div className="it-pick-list">{data?.candidates.map(t=><label className="it-pick" key={t.id}><MotionCheck disabled={busy||team.some(m=>m.id===t.id&&m.role==='팀장')} checked={dialog.ids.includes(t.id)} onChange={e=>setDialog(d=>({...d,ids:e.target.checked?[...d.ids,t.id]:d.ids.filter(id=>id!==t.id)}))}/><span>{t.name}<small>{team.find(m=>m.id===t.id)?.role||'교사'}</small></span></label>)}</div><Button loading={busy} onClick={()=>run(()=>api.team({revision:dialog.revision,userIds:dialog.ids}),'팀원 명단을 저장했습니다.',()=>setDialog(null))}>명단 저장</Button></>}
    {dialog.type==='withdraw'&&<><p className="it-prayer-copy">이 기도제목을 철회할까요?</p><div className="it-actions"><Button variant="secondary" disabled={busy} onClick={closeDialog}>취소</Button><Button loading={busy} onClick={()=>run(()=>api.withdraw(dialog.request.id,dialog.request.revision),'기도제목을 철회했습니다.',()=>setDialog(null))}>철회</Button></div></>}
    {dialog.type==='copy'&&<textarea className="field-input" rows={10} readOnly value={dialog.text} aria-label="공유 문구"/>}
   </MotionDialog>}
  </AnimatePresence>
 </div>
}

function RequestPicker({userId,ids,onChange,onSave,busy}){
 const [search,setSearch]=useState(''),[page,setPage]=useState(0)
 const query=useQuery({queryKey:['intercession-list',userId,'picker',search,page],queryFn:()=>api.list({scope:'board',status:'published',search,page})})
 return <div className="it-stack"><SearchField label="추가할 기도제목 검색" value={search} onChange={v=>{setSearch(v);setPage(0)}}/><QueryStatus query={query}/><div className="it-pick-list">{!query.isError&&query.data?.items.map(r=><label className="it-pick" key={r.id}><MotionCheck disabled={busy||!ids.includes(r.id)&&ids.length>=50} checked={ids.includes(r.id)} onChange={e=>onChange(e.target.checked?[...ids,r.id]:ids.filter(id=>id!==r.id))}/><span><strong>{r.publicTitle}</strong><small>{r.category}</small></span></label>)}{query.data?.total===0&&<p className="it-empty">공유 중인 기도제목이 없습니다.</p>}</div><Pagination data={query.data} onChange={setPage} busy={query.isFetching}/><Button loading={busy} onClick={onSave}>선택 완료 ({ids.length})</Button></div>
}
