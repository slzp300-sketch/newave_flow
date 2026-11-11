import QueryNotice from '../components/common/QueryNotice'
import SaveErrorNotice from '../components/common/SaveErrorNotice'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import {hasQueryData,queryReadState} from '../utils/queryReadState'
import {requestErrorMessage} from '../utils/requestFeedback'
import { useUnsavedChanges, useFormChanges, useAfterSave } from '../components/common/UnsavedChanges'
import {useCallback,useEffect,useRef,useState} from 'react'
import {Link,useSearchParams} from 'react-router-dom'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {AnimatePresence} from 'framer-motion'
import {Music2,ChevronLeft,ChevronRight,Home,CalendarDays,Users,FileText,Video,BookOpen,Plus} from 'lucide-react'
import AppSelect from '../components/common/AppSelect'
import {Disclosure,AnimatedValue} from '../components/common/Motion'
import {ActionButton as Button,MotionPage,MotionDialog,MotionCheck,FeedbackToast} from '../components/praise/PraiseMotion'
import RosterDirectory from '../components/praise/RosterDirectory'
import Editor from '../components/praise/PraiseEditor'
import {featureTone} from '../utils/featureAppearance'
import {praiseApi,savePraisePdf} from '../api/praise'
import useAuthStore from '../store/authStore'
import {parts,today,shortDate,addDays,nextMonth,monthOfWeek,termMonths,saturdays,timeLabel,unavailable,needsReview,myWeek} from '../utils/praise'
import '../pages/OfficerPage.css'
import '../components/praise/proposal.css'
import '../components/praise/navigation.css'
import '../components/praise/roster.css'
import '../components/praise/availability.css'
import '../components/praise/live.css'

const labels={home:'찬양팀',roster:'팀원 명단',rotation:'예배 로테이션',availability:'참여 불가 일정',setlists:'콘티 자료실',prayer:'목요 기도회',term:'학기 운영'}
const icons={roster:Users,rotation:CalendarDays,availability:CalendarDays,setlists:FileText,prayer:Video,term:BookOpen}
export default function PraisePage(){
 const [params,setParams]=useSearchParams(),qc=useQueryClient(),user=useAuthStore(s=>s.user)
 const termId=Number(params.get('term'))||undefined,page=labels[params.get('page')]?params.get('page'):'home',weekId=Number(params.get('week'))||null
 const key=['praise',user?.id,termId],query=useQuery({queryKey:key,queryFn:()=>praiseApi.get(termId),refetchOnWindowFocus:false})
 const data=query.data,[editor,setEditor]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(null),seq=useRef(0),heading=useRef(null)
 const closeNotice=useCallback(()=>setNotice(null),[]),toast=text=>setNotice({id:++seq.current,text})
 const [pdf,setPdf]=useState(null),[refreshVersion,setRefreshVersion]=useState(0)
 useEffect(()=>()=>{if(pdf?.imageUrl)URL.revokeObjectURL(pdf.imageUrl)},[pdf?.imageUrl])
 useEffect(()=>{setEditor(null);setPdf(null);setError('');heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})},[page,weekId,termId])
 const link=(next,week=null,month=params.get('month'))=>{const p=new URLSearchParams({page:next});if(data?.term?.id)p.set('term',data.term.id);if(week)p.set('week',week);if(month)p.set('month',month);return `/praise?${p}`}
 const afterSave=useAfterSave()
 const run=async(work,message)=>{if(busy)return false;if(message&&queryReadState([query])!=='ready'){setError('최신 자료를 확인한 뒤 저장해 주세요.');return false;}setBusy(true);setError('');try{const result=await work();if(result?.term){qc.setQueryData(key,result);qc.setQueryData(['praise',user?.id,result.term.id],result);if(!data?.term||result.term.id!==data.term.id)afterSave(()=>setParams({page,term:result.term.id}));void qc.invalidateQueries({queryKey:['officer-access']})}setEditor(null);if(message)toast(message);return true}catch(e){setError(requestErrorMessage(e,message?'save':'load'));return false}finally{setBusy(false)}}
 const save=(path,body,message)=>run(()=>praiseApi.save(data.term.id,path,{revision:data.term.revision,...body}),message)
 const confirmMove=useUnsavedChanges({busy})
 const refresh=()=>confirmMove(async()=>{if(busy)return;try{await query.refetch({throwOnError:true});setEditor(null);setRefreshVersion(n=>n+1);setError('')}catch(e){setError(requestErrorMessage(e,'load'))}})
 const openPdf=async(w,item=w.pdfs[0])=>{if(!item)return;await run(async()=>{const [blob,image]=await Promise.all([praiseApi.pdf(item.id),praiseApi.page(item.id,0)]);setPdf({blob,imageUrl:URL.createObjectURL(image),week:w,version:item.version,id:item.id,page:0,pages:item.pages})})}
 const turnPdf=index=>run(async()=>{const image=await praiseApi.page(pdf.id,index);setPdf(p=>({...p,page:index,imageUrl:URL.createObjectURL(image)}))})
 const download=async()=>{const saved=await savePraisePdf(pdf.blob,pdf.week.worshipDate,pdf.version);if(saved)toast('콘티 파일을 준비했습니다.');return saved}
 if(!hasQueryData([query]))return <div className="pt-body"><QueryNotice queries={[query]} label="찬양팀 자료"/></div>
 const manager=data.canManage,roster=data.members.filter(m=>m.active),name=ids=>ids?.map(id=>data.members.find(m=>m.id===id)?.name||'삭제된 팀원').join(', ')||'—'
 const months=data.term?termMonths(data.term):[],month=months.includes(params.get('month'))?params.get('month'):months.includes(today().slice(0,7))?today().slice(0,7):months[0]
 const monthWeeks=data.weeks.filter(w=>monthOfWeek(w)===month),active=data.weeks.find(w=>w.id===weekId),current=myWeek(data.weeks)
 const title=active&&['rotation','setlists'].includes(page)?`${shortDate(active.worshipDate)} ${page==='rotation'?'로테이션':'콘티'}`:labels[page]
 const mine=roster.find(m=>m.userId===data.me),ownParts=w=>parts.filter(p=>w.slots[p]?.includes(mine?.id))
 const pdfSection=w=><section className="pt-card"><div className="pt-row"><h2><FileText size={17}/>콘티 PDF</h2><span className="pt-badge">{w.pdfs.length?`v${w.pdfs[0].version} · 공유됨`:'공유 대기'}</span></div><p className="pt-meta">{data.members.find(m=>m.id===w.slots.인도자?.[0])?.kind==='학생'?'학생 인도 · 팀장 공유':`인도 · ${name(w.slots.인도자)}`}</p><div className="pt-actions">{!!w.pdfs.length&&<Button size="sm" disabled={busy} onClick={()=>openPdf(w)}>PDF 보기</Button>}{w.canUpload&&<label className="pt-upload">{busy?'처리 중…':w.pdfs.length?'PDF 교체':'PDF 공유'}<input aria-label="콘티 PDF 선택" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file){if(file.size>5*1024*1024){setError('5MB 이하 PDF를 선택해주세요.');return}run(()=>praiseApi.upload(data.term.id,w.id,data.term.revision,file),'콘티를 공유했습니다.')}}}/></label>}</div>{w.canUpload&&<p className="pt-meta">수요일까지 · PDF 5MB 이하</p>}{w.pdfs.length>1&&<Disclosure className="pt-disclosure" title="이전 콘티">{w.pdfs.slice(1).map(item=><Button key={item.id} size="sm" variant="secondary" disabled={busy} onClick={()=>openPdf(w,item)}>v{item.version} · {item.uploadedAt.slice(0,10)}</Button>)}</Disclosure>}</section>
 return <div className="pt-preview pt-live"><div className="pt-app"><header className="pt-header pt-route-header app-header" data-feature-tone={featureTone('/praise')}><Link className="pt-route-icon" aria-label={page==='home'?'앱 홈':'찬양팀 홈으로'} to={page==='home'?'/':link('home')}><ChevronLeft size={21}/></Link><span className="brand-heading-icon" aria-hidden="true"><Music2 size={20}/></span><div className="pt-route-title"><h1 data-feature-title ref={heading} tabIndex={-1}>{title}</h1></div>{page!=='home'&&<Link aria-label="찬양팀 홈" className="pt-route-icon" to={link('home')}><Home size={19}/></Link>}</header>
 <QueryRefreshNotice queries={[query]} label="찬양팀 자료"/><div className="pt-term-bar">{data.terms.length>0&&<AppSelect aria-label="활동 학기" value={data.term.id} disabled={busy} onChange={e=>setParams({page,term:e.target.value})}>{data.terms.map(t=><option key={t.id} value={t.id}>{t.year} {t.half===1?'상':'하'}반기</option>)}</AppSelect>}<Button size="sm" variant="secondary" disabled={busy} onClick={refresh}>새로고침</Button></div>
 <SaveErrorNotice error={error} className="mx-4 my-2"/>
 <MotionPage key={`${page}:${weekId}:${data.term?.id}:${month}`} className="pt-body pt-route-body pt-motion-page">
 {!data.term?<section className="pt-card"><p>{manager?'학기를 만들어 시작하세요.':'지정된 찬양팀 학기가 없습니다.'}</p>{manager&&<Button onClick={()=>setEditor({type:'term'})}>학기 만들기</Button>}</section>:<>
 {page==='home'&&<>
  {current?<section className="pt-card pt-highlight pt-current-week"><div className="pt-row"><h2>이번 주 · {shortDate(current.worshipDate)} 주일</h2><span className="pt-badge">내 파트 · {ownParts(current).join(' · ')||'배정 없음'}</span></div><div className="pt-current-practice"><CalendarDays size={16}/><strong>{shortDate(current.practiceDate)} 연습</strong><span>{timeLabel(current)}</span></div>{!current.published&&!manager?<p className="pt-meta">로테이션 공개 대기</p>:<dl className="pt-current-slots">{parts.map(p=><div key={p} data-wide={['싱어','워십'].includes(p)} data-mine={current.slots[p]?.includes(mine?.id)}><dt>{p}</dt><dd>{name(current.slots[p])}</dd></div>)}</dl>}<div className="pt-current-resource"><FileText size={17}/><strong>콘티 PDF</strong>{current.pdfs.length?<Button size="sm" variant="secondary" disabled={busy} onClick={()=>openPdf(current)}>PDF 보기</Button>:<span className="pt-meta">공유 대기</span>}</div><div className="pt-current-prayer"><Video size={16}/><span>목요 기도회 · 22:30–23:00<br/>{(()=>{const p=data.prayers.find(p=>p.date===addDays(current.worshipDate,-3));return p?`진행 · ${name([p.hostId])}`:'진행자 배정 대기'})()}</span></div></section>:<section className="pt-card"><h2>이번 주</h2><p className="pt-meta">등록된 연습 일정이 없습니다.</p></section>}
  <h2 className="ui-section-title">찬양팀 메뉴</h2><nav className="pt-home-menu">{Object.keys(icons).map(p=>{const Icon=icons[p];return <Link key={p} to={link(p)} className="pt-menu-item brand-action motion-tap"><Icon size={22}/><strong>{labels[p]}</strong><ChevronRight size={16}/></Link>})}</nav>
 </>}
 {page==='roster'&&<><div className="pt-row"><h2 className="ui-section-title">활동 팀원 {roster.length}명</h2>{manager&&<Button size="sm" onClick={()=>setEditor({type:'member',revision:data.term.revision,parts:[],active:true})}><Plus size={15}/>팀원 지정</Button>}</div><RosterDirectory members={roster} onPerson={m=>setEditor({type:'person',member:m})}/>{manager&&data.members.some(m=>!m.active)&&<Disclosure className="pt-disclosure" title="활동 종료"><RosterDirectory members={data.members.filter(m=>!m.active)} onPerson={m=>setEditor({type:'member',...m,revision:data.term.revision})}/></Disclosure>}</>}
 {page==='availability'&&<Availability key={`${data.term.id}:${nextMonth()}:${refreshVersion}`} data={data} link={link} busy={busy} save={save}/>}
 {['rotation','setlists'].includes(page)&&(active?<>
  {page==='setlists'?pdfSection(active):<><section className="pt-card"><div className="pt-row"><h2>연습</h2>{manager&&<Button size="sm" variant="secondary" onClick={()=>setEditor({type:'week',...active,revision:data.term.revision})}>시간·배정 수정</Button>}</div><p>{shortDate(active.practiceDate)} · {timeLabel(active)}</p>{active.draftChanged&&<span className="pt-badge">공개 전 변경</span>}</section><section className="pt-card"><h2>파트별 배정</h2>{!active.published&&!manager?<p>공개 대기</p>:<dl className="pt-assignments">{parts.map(p=><div key={p} data-mine={active.slots[p]?.includes(mine?.id)}><dt>{p}</dt><dd>{name(active.slots[p])}{manager&&active.slots[p]?.some(id=>unavailable(data,data.members.find(m=>m.id===id),active.practiceDate))&&<small className="pt-av-inline"> · 참여 불가 포함</small>}</dd></div>)}</dl>}</section><Link className="pt-related-link" to={link('setlists',active.id)}>이 주의 콘티<ChevronRight size={17}/></Link></>}
  <Link to={link(page)} className="pt-related-link">목록으로<ChevronRight size={17}/></Link>
 </>:<>
  <AppSelect aria-label="로테이션 월" value={month} onChange={e=>setParams({page,term:data.term.id,month:e.target.value})}>{months.map(m=><option key={m}>{m}</option>)}</AppSelect>
  {manager&&page==='rotation'&&<div className="pt-actions"><Button size="sm" successLabel="일정 준비 완료" disabled={busy} onClick={()=>run(()=>praiseApi.generate(data.term.id,{revision:data.term.revision,month}),'월간 일정을 준비했습니다.')}>월간 일정 만들기</Button>{monthWeeks.length>0&&<Button size="sm" successLabel="공개 완료" disabled={busy} onClick={()=>save('publish',{month},'로테이션을 공개했습니다.')}>로테이션 공개</Button>}</div>}
  {!monthWeeks.length&&<p className="pt-meta">등록된 일정이 없습니다.</p>}
  <div className="pt-weeks">{monthWeeks.map(w=><Link key={w.id} className="pt-week brand-action motion-tap" to={link(page,w.id)}><div className="pt-row"><strong>{shortDate(w.worshipDate)} 주일</strong><ChevronRight size={17}/></div><p>{shortDate(w.practiceDate)} 연습 · {timeLabel(w)}</p><div className="pt-row"><span>인도 · {name(w.slots.인도자)}</span><span className="pt-badge">{page==='setlists'?(w.pdfs.length?'공유됨':'공유 대기'):w.draftChanged?'작성 중':w.published?'공개됨':'공개 대기'}</span></div><span className="pt-my">{ownParts(w).join(' · ')}</span></Link>)}</div>
  {page==='rotation'&&monthWeeks.length>0&&<Disclosure className="pt-disclosure" title="월간 표 보기"><div className="pt-table-scroll" role="region" aria-label="월간 로테이션 표" tabIndex={0}><table><thead><tr>{['주일','연습',...parts].map(p=><th key={p}>{p}</th>)}</tr></thead><tbody>{monthWeeks.map(w=><tr key={w.id}><th>{shortDate(w.worshipDate)}</th><td>{shortDate(w.practiceDate)}<br/>{timeLabel(w)}</td>{parts.map(p=><td key={p}>{name(w.slots[p])}</td>)}</tr>)}</tbody></table></div></Disclosure>}
 </>)}
 {page==='prayer'&&<><section className="pt-card pt-highlight"><h2>목요 기도회</h2><strong>22:30–23:00</strong></section><div className="pt-row"><h2 className="ui-section-title">학기 진행자</h2>{manager&&<Button size="sm" onClick={()=>setEditor({type:'prayer',date:'',hostId:'',zoomUrl:'',revision:data.term.revision})}>일정 추가</Button>}</div>{!data.prayers.length&&<p className="pt-meta">등록된 기도회가 없습니다.</p>}<section className="pt-card pt-prayer-list">{data.prayers.map(p=><div key={p.id}><strong>{shortDate(p.date)} 목</strong><span>{name([p.hostId])}{p.zoomUrl&&<a href={p.zoomUrl} target="_blank" rel="noopener noreferrer" className="pt-zoom">Zoom 참여</a>}</span>{(manager||p.hostId===mine?.id)&&<Button size="sm" variant="secondary" onClick={()=>setEditor({type:'prayer',...p,revision:data.term.revision})}>변경</Button>}</div>)}</section></>}
 {page==='term'&&<><section className="pt-card pt-stages"><h2>{data.term.year} {data.term.half===1?'상반기':'하반기'}</h2>{[[data.term.half===1?'모집':'재결단·모집','팀원 명단에서 지정'],[data.term.half===1?'2월 훈련':'9월 훈련','1개월'],[data.term.half===1?'3–7월 예배 활동':'10–12월 예배 활동',data.term.half===1?'5개월':'3개월']].map(([a,b],i)=><div key={a}><span>{i+1}</span><section><strong>{a}</strong><p>{b}</p></section></div>)}</section><Link className="pt-related-link" to={link('roster')}>학기 명단<ChevronRight size={17}/></Link>{manager&&<Button onClick={()=>setEditor({type:'term'})}>다른 학기 만들기</Button>}</>}
 </>}
 </MotionPage></div><FeedbackToast notice={notice} onClose={closeNotice}/><AnimatePresence>
 {editor&&<Editor key={`${editor.type}:${editor.id||''}`} editor={editor} error={error} setEditor={setEditor} data={data} busy={busy} save={save} run={run} name={name} link={link}/>}
 {pdf&&<MotionDialog className="pt-editor-dialog pt-pdf-dialog" key="pdf" busy={busy} error={error} title={`${shortDate(pdf.week.worshipDate)} 콘티 · v${pdf.version}`} onClose={()=>setPdf(null)} footer={<div className="pt-pdf-actions">{pdf.pages>1&&<div className="pt-row"><Button size="sm" disabled={busy||pdf.page===0} onClick={()=>turnPdf(pdf.page-1)}>이전</Button><span>{pdf.page+1} / {pdf.pages}</span><Button size="sm" disabled={busy||pdf.page===pdf.pages-1} onClick={()=>turnPdf(pdf.page+1)}>다음</Button></div>}<Button disabled={busy} successLabel="파일 준비 완료" onClick={download}>PDF 받기</Button></div>}><img alt={`콘티 ${pdf.page+1}/${pdf.pages}쪽`} className="pt-pdf-image" src={pdf.imageUrl}/></MotionDialog>}
 </AnimatePresence></div>
}

function Availability({data,link,busy,save}){
 const month=nextMonth(),valid=termMonths(data.term).includes(month),ws=data.weeks.filter(w=>monthOfWeek(w)===month),record=data.responses.find(r=>r.userId===data.me&&r.month===month)
 const overview=data.canViewAll??data.canManage,canRespond=data.canManage||data.members.some(m=>m.active&&m.userId===data.me),DateTag=canRespond?'label':'div'
 const [dates,setDates]=useState(record?.dates||[]),[none,setNone]=useState(!!record&&!record.dates.length)
 const toggle=d=>{setNone(false);setDates(a=>a.includes(d)?a.filter(v=>v!==d):[...a,d])},versions=Object.fromEntries(ws.map(w=>[String(w.id),w.scheduleVersion]))
 const {markSaved}=useFormChanges({dates,none},{busy})
 const submit=async()=>{const ok=await save('availability',{month,dates,scheduleVersions:versions},'불가 일정을 제출했습니다.');if(ok)markSaved();return ok}
 if(!valid)return <p className="pt-meta">다음 달에 해당하는 학기를 선택해주세요.</p>
 return <><div className="pt-row"><h2 className="ui-section-title">{month} 토요일</h2><span className="pt-meta">{overview?`${data.responses.filter(r=>r.month===month).length}명 제출`:record?'제출됨':'미제출'}</span></div>{needsReview(record,ws)&&<p className="pt-av-warning">연습 시간 변경 · 확인 후 다시 제출해주세요.</p>}<section className={overview?'pt-av-date-list':'pt-card'}><div className={overview?'pt-av-date-list':'pt-av-dates'}>{saturdays(month).map(d=>{const w=ws.find(w=>addDays(w.worshipDate,-1)===d),rows=data.responses.filter(r=>r.dates.includes(d)),selected=dates.includes(d);return <div key={d} className={overview?'pt-card pt-av-week':''} data-selected={selected}><DateTag className={overview?'pt-av-date-check':'pt-av-date'} data-selected={selected}>{canRespond&&<MotionCheck checked={selected} disabled={busy} onChange={()=>toggle(d)} aria-label={`${shortDate(d)} 토 연습 불가`}/>}<span><strong>{shortDate(d)} 토</strong><small>{w?`${w.practiceDate!==d?shortDate(w.practiceDate)+' 연습 · ':''}${timeLabel(w)}`:'17:00–19:00'}</small></span></DateTag>{overview&&<><div className="pt-row"><span className="pt-meta">불가 <AnimatedValue value={rows.length}/>명</span>{w&&<Link to={link('rotation',w.id,month)}>{data.canManage?'배정':'로테이션 보기'} ›</Link>}</div><p className="pt-av-names">{rows.map(r=>data.members.find(m=>m.userId===r.userId)?.name||(r.userId===data.me?'나':'활동 종료 교사')).join(', ')||'—'}</p></>}</div>})}</div></section>{canRespond&&<div className="pt-row"><label className="pt-av-none"><MotionCheck checked={none} disabled={busy} onChange={e=>{setNone(e.target.checked);setDates([])}}/>불가 날짜 없음</label><Button disabled={busy||(!dates.length&&!none)} successLabel="제출 완료" onClick={submit}>{record?'수정 제출':'제출'}</Button></div>}</>
}
