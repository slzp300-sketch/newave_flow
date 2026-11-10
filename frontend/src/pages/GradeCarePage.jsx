import {useState,useEffect} from 'react'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {AnimatePresence} from 'framer-motion'
import {ChevronRight,HeartHandshake,Lock,RefreshCw} from 'lucide-react'
import {subWeeks,startOfWeek,format} from 'date-fns'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import {gradeCareApi as api} from '../api/gradeCare'
import {checkLabels,minuteLabels,lastStatus,studentCounts,filterCareStudents,responseCounts,careError} from '../utils/gradeCare'
import {toApiDate,formatUpdatedAt} from '../utils/date'
import GradeLabel from '../components/common/GradeLabel'
import AppSelect from '../components/common/AppSelect'
import Button from '../components/common/Button'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import StatSummary from '../components/common/StatSummary'
import {MotionDialog,MotionPage} from '../components/praise/PraiseMotion'
import StudentCareDialog,{CareBadge} from '../components/grade-care/StudentCareDialog'
import './GradeCarePage.css'

export default function GradeCarePage(){
 const user=useAuthStore(s=>s.user),[params,setParams]=useSearchParams()
 const access=useQuery({queryKey:['grade-care-access',user?.id],queryFn:api.access,staleTime:0,refetchInterval:20000,refetchOnWindowFocus:'always'})
 const cap=access.isError?null:access.data
 const choices=cap?.assignedGrades.length?cap.assignedGrades:cap?.grades||[]
 const grade=cap?.grades.includes(params.get('grade'))?params.get('grade'):choices[0]||''
 const dates=Array.from({length:16},(_,i)=>toApiDate(subWeeks(startOfWeek(new Date(),{weekStartsOn:0}),i)))
 const date=dates.includes(params.get('date'))?params.get('date'):dates[0]
 const page=params.get('page')==='students'?'students':'overview'
 const [check,setCheck]=useState('attendance'),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[classId,setClassId]=useState(''),[student,setStudent]=useState(null),[person,setPerson]=useState(null),[eventId,setEventId]=useState(''),[eventKind,setEventKind]=useState('teachers')
 const query=useQuery({queryKey:['grade-care',user?.id,grade,date],queryFn:()=>api.overview(grade,date),enabled:!!cap?.canOverview&&!!grade,staleTime:0,refetchInterval:30000,refetchOnWindowFocus:'always'})
 const data=query.isError||!cap?null:query.data
 const selectedEvent=data?.events.find(e=>String(e.id)===eventId)||data?.events.filter(e=>e.date>=date).at(-1)||data?.events[0]
 const eventQuery=useQuery({queryKey:['grade-care-event',user?.id,grade,selectedEvent?.id],queryFn:()=>api.event(selectedEvent.id,grade),enabled:!!data&&!!selectedEvent&&check==='event',staleTime:0,refetchInterval:30000})
 const eventData=eventQuery.isError?null:eventQuery.data
 useEffect(()=>{setStudent(null);setPerson(null);setSearch('');setFilter('all');setClassId('');setEventId('')},[grade,date])
 const go=next=>setParams({grade,date,page:next})
 const openStudents=(next='all',id='')=>{setFilter(next);setClassId(String(id));setSearch('');go('students')}
 const refresh=()=>{access.refetch();query.refetch();if(selectedEvent&&check==='event')eventQuery.refetch()}
 const counts=studentCounts(data?.students),visible=filterCareStudents(data?.students||[],{search,classId,filter})
 const totals=data?[{id:'attendance',title:'반 출석',done:data.classes.filter(c=>c.status==='SUBMITTED').length,total:data.classes.length,unit:'반'}, {id:'worship',title:'교사 예배',done:data.teachers.filter(t=>t.worship!=='UNKNOWN').length,total:data.teachers.length,unit:'명'}, {id:'meeting',title:'교사회의',done:data.teachers.filter(t=>t.meeting!=='UNSUBMITTED').length,total:data.teachers.length,unit:'명'}]:[]
 const eventTarget=selectedEvent?.target,eventTab=eventTarget==='STUDENT_ONLY'?'students':eventTarget==='TEACHER_ONLY'?'teachers':eventKind
 const eventRows=eventData?.[eventTab]||[],eventCounts=responseCounts(eventRows)
 const meetingPerson=t=>({name:t.name,context:t.context,status:t[check],label:check==='worship'?(t.worship==='UNKNOWN'?'미확인':checkLabels[t.worship]):t.meeting==='ABSENT'?'불참':checkLabels[t.meeting],reason:check==='meeting'?t.reason:null,minute:check==='meeting'?minuteLabels[t.minute]:null,updated:check==='meeting'?t.meetingUpdated:t.worshipUpdated})
 const eventLabel=s=>s==='PRESENT'?'참석':s==='ABSENT'?'불참':s==='UNKNOWN'?'미응답':checkLabels[s]
 return <div className="gc-page"><Header title="우리 학년" showBack/><main className="gc-body">
 {access.isError?<ReadError error={access.error} retry={()=>access.refetch()}/>:!cap?<p className="gc-empty" role="status">담당 학년 확인 중…</p>:!cap.canOverview?<p role="alert" className="gc-empty">임원만 학년 현황을 확인할 수 있습니다.</p>:<>
  <div className="gc-identity"><div><GradeLabel value={grade}/><strong>{cap.assignedGrades.includes(grade)?'학년부장':'학년 현황'}</strong></div><Button size="sm" variant="secondary" disabled={query.isFetching} onClick={refresh}><RefreshCw size={14}/>새로고침</Button></div>
  <div className="gc-period">{choices.length>1&&<AppSelect aria-label="학년 선택" value={grade} onChange={e=>setParams({grade:e.target.value,date,page})}>{[...new Set([...choices,grade])].map(g=><option key={g}>{g}</option>)}</AppSelect>}<AppSelect aria-label="주일 선택" value={date} onChange={e=>setParams({grade,date:e.target.value,page})}>{dates.map(d=><option key={d} value={d}>{format(new Date(d+'T00:00:00'),'M월 d일')} 주일</option>)}</AppSelect></div>
  <SegmentedControl label="학년부장 화면" value={page} onChange={next=>{setFilter('all');setClassId('');setSearch('');go(next)}} options={[{value:'overview',label:'체크 현황'},{value:'students',label:'학생 돌봄'}]}/>
  {query.isError?<ReadError error={query.error} retry={()=>query.refetch()}/>:!data?<p className="gc-empty" role="status">학년 자료 확인 중…</p>:<MotionPage key={page} className="gc-content">
   {page==='overview'?<>
    <div className="gc-check-grid">{totals.map(item=><button className="gc-check motion-tap" aria-pressed={check===item.id} key={item.id} onClick={()=>setCheck(item.id)}><span>{item.title}<ChevronRight size={15}/></span><strong>{item.done}<small> / {item.total}{item.unit}</small></strong><span className="gc-muted">{item.total===0?'대상 없음':item.total===item.done?'확인 완료':`미확인 ${item.total-item.done}${item.unit}`}</span></button>)}<button className="gc-check motion-tap" aria-pressed={check==='event'} onClick={()=>setCheck('event')}><span>행사 응답<ChevronRight size={15}/></span><strong>{data.events.length}<small>개 행사</small></strong><span className="gc-muted">학생·교사 응답 보기</span></button></div>
    <section className="gc-panel"><div className="gc-heading"><h2>{check==='event'?'행사 응답':totals.find(t=>t.id===check)?.title}</h2><span className="gc-muted">{check==='meeting'?`${data.meetingDate.slice(5).replace('-','.')} 토요일`:check!=='event'?`${date.slice(5).replace('-','.')} 주일`:''}</span></div>
     {check==='attendance'?data.classes.length?data.classes.map(c=><button className="gc-row motion-tap" key={c.id} onClick={()=>openStudents('all',c.id)}><span><strong>{c.name}</strong><small>{c.teacher||'담임 미배정'}{c.submittedAt?` · ${formatUpdatedAt(c.submittedAt)}`:''}</small></span><CareBadge status={c.status}/><ChevronRight size={15}/></button>):<p className="gc-empty">등록된 반이 없습니다.</p>:check!=='event'?data.teachers.length?data.teachers.map(t=><button className="gc-row motion-tap" key={t.id} onClick={()=>setPerson(meetingPerson(t))}><span><strong>{t.name}</strong><small>{t.context||grade}{check==='meeting'&&t.meeting==='ABSENT'?` · ${minuteLabels[t.minute]}`:''}</small></span><CareBadge status={t[check]} label={meetingPerson(t).label}/><ChevronRight size={15}/></button>):<p className="gc-empty">대상 교사가 없습니다.</p>:!selectedEvent?<p className="gc-empty">출석 확인 행사가 없습니다.</p>:<div className="gc-event">
      <AppSelect aria-label="행사 선택" value={String(selectedEvent.id)} onChange={e=>setEventId(e.target.value)}>{data.events.map(e=><option key={e.id} value={String(e.id)}>{e.date} · {e.title}</option>)}</AppSelect>
      {eventTarget==='BOTH'&&<SegmentedControl label="행사 대상" value={eventTab} onChange={setEventKind} options={[{value:'teachers',label:'교사'},{value:'students',label:'학생'}]}/>}
      {eventQuery.isError?<ReadError error={eventQuery.error} retry={()=>eventQuery.refetch()}/>:!eventData?<p role="status" className="gc-empty">행사 응답 확인 중…</p>:<><p className="gc-muted">{eventTab==='teachers'?'교사':'학생'} 응답 {eventCounts.responded} / {eventCounts.total}명 · 행사 등록 명단 기준</p>{eventRows.map(p=><button className="gc-row" key={p.id} onClick={()=>setPerson({...p,label:eventLabel(p.status)})}><span><strong>{p.name}</strong><small>{p.context}</small></span><CareBadge status={p.status} label={eventLabel(p.status)}/><ChevronRight size={15}/></button>)}{!eventRows.length&&<p className="gc-empty">해당 학년 대상자가 없습니다.</p>}</>}
     </div>}
    </section>
    <section><div className="gc-heading"><h2 className="ui-section-title">학생 살펴보기</h2><button className="gc-text" onClick={()=>openStudents()}>전체 보기<ChevronRight size={14}/></button></div><div className="gc-panel gc-shortcuts"><button onClick={()=>openStudents('prayer')}><HeartHandshake size={18}/><span>기도제목</span><strong>{data.students.filter(s=>s.canCare&&s.prayerCount>0).length}명</strong><ChevronRight size={15}/></button></div></section>
   </>:<>
    <StatSummary label="학생 출석 현황" items={[{label:'학생',value:counts.total},{label:'출석',value:counts.present},{label:'결석',value:counts.absent},{label:'지각',value:counts.late}]}/>
    <p className="gc-muted">현재 명단 기준{counts.unknown>0?` · 미기록 ${counts.unknown}명`:''}{counts.unassigned>0?` · 배정 전 ${counts.unassigned}명`:''}</p>
    <div className="gc-filters"><SearchField label="학생 이름 검색" value={search} onChange={setSearch} placeholder="이름·학교 검색"/><AppSelect aria-label="반 선택" value={classId} onChange={e=>setClassId(e.target.value)}><option value="">전체 반</option>{[...new Map(data.students.map(s=>[String(s.classId),s.className])).entries()].map(([id,name])=><option value={id} key={id}>{name}</option>)}</AppSelect></div>
    <SegmentedControl label="학생 보기" value={filter} onChange={setFilter} options={[{value:'all',label:'전체'},{value:'prayer',label:'기도제목'},{value:'unknown',label:'미기록'}]}/>
    <div className="gc-panel">{visible.map(s=><button className="gc-row gc-student motion-tap" disabled={!s.canCare} key={s.id} onClick={()=>setStudent(s.id)}><span className="gc-avatar" aria-hidden="true">{s.name.slice(-2)}</span><span><strong>{s.name}</strong><small>{s.className}{s.canCare&&s.prayerCount?' · 기도제목':''}</small></span><CareBadge status={lastStatus(s)}/>{s.canCare?<ChevronRight size={14}/>:<Lock size={14}/>}</button>)}{!visible.length&&<p className="gc-empty">해당하는 학생이 없습니다.</p>}</div>
    <p className="gc-private"><Lock size={13}/>돌봄 기록은 담당자에게만 표시됩니다.</p>
   </>}
  </MotionPage>}
 </>}
 </main><AnimatePresence>{student&&cap&&data&&<StudentCareDialog key={student} studentId={student} date={date} onClose={()=>setStudent(null)}/>} {person&&<MotionDialog title={person.name} onClose={()=>setPerson(null)} footer={<Button onClick={()=>setPerson(null)}>확인</Button>}><div className="gc-detail"><p>{person.context}</p><CareBadge status={person.status} label={person.label}/>{person.reason&&<p>불참 사유 · {person.reason}</p>}{person.minute&&<p>{person.minute}</p>}{person.partialFrom&&<p>참석 시작 · {person.partialFrom}</p>}{person.partialNote&&<p>{person.partialNote}</p>}{person.updated&&<p className="gc-muted">수정 {formatUpdatedAt(person.updated)}</p>}</div></MotionDialog>}</AnimatePresence></div>
}
function ReadError({error,retry}){return <div role="alert" className="gc-empty"><p>{careError(error)}</p><Button variant="secondary" onClick={retry}>다시 확인</Button></div>}
