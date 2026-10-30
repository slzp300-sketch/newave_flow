import AppSelect from '../components/common/AppSelect'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import DisclosureSummary from '../components/common/DisclosureSummary'
import WeekNavigator from '../components/common/WeekNavigator'
import useAuthStore from '../store/authStore'
import { newFamilyApi as api } from '../api/newFamily'
import { toApiDate, getWeekStartByOffset, weekLabels } from '../utils/date'
import { FAMILY_GRADES, FAMILY_CATEGORIES, familyCategory, familyStage, familyCounts } from '../utils/newFamily'
import './NewFamilyPage.css'

const today = () => toApiDate()
const blankProfile = { name: '', grade: '', gender: '', school: '', phone: '', address: '', introducer: '' }
const messageFor = e => e.response?.data?.message || '저장하지 못했습니다. 연결을 확인하고 다시 시도해주세요.'

export default function NewFamilyPage() {
  const user = useAuthStore(s => s.user)
  const access = useQuery({ queryKey: ['new-family-capability', user?.id], queryFn: api.capability })
  const [tab, setTab] = useState('week')
  const [screen, setScreen] = useState(null)
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [weekDirty, setWeekDirty] = useState(false)
  const [reload, setReload] = useState(0)
  const qc = useQueryClient()
  const roster = useQuery({ queryKey: ['new-family-roster'], queryFn: api.roster, enabled: !!access.data?.canManage })
  const date = toApiDate(getWeekStartByOffset(offset, 0))
  const run = async (task, success, next) => {
    setBusy(true); setError(''); setMessage('')
    try { const result = await task(); setMessage(success); await next?.(result); await qc.invalidateQueries({ queryKey: ['new-family-roster'] }); return true }
    catch (e) { setError(messageFor(e)); return false } finally { setBusy(false) }
  }
  const open = (kind, person) => { setScreen({ kind, person }); setError(''); setMessage('') }
  const savedPerson = person => setScreen({ kind: 'person', person })
  const navigate = key => { setTab(key); setScreen(null); setError(''); setMessage('') }
  const canAssign = access.data?.canAssign
  const labels = weekLabels(getWeekStartByOffset(offset, 0))
  const baseProps = { busy, run, savedPerson, open }
  return <div className="nf-page"><Header title="새가족팀 관리" showBack /><main className="nf-body">
    {access.isPending ? <p role="status">업무 권한을 확인하고 있습니다…</p> : access.isError ? <div role="alert">권한을 확인하지 못했습니다. <Button variant="secondary" size="sm" onClick={() => access.refetch()}>다시 확인</Button></div> : !access.data.canManage ? <div className="nf-panel"><h2>새가족팀 담당자 전용</h2><p>관리자에게 새가족팀 업무 배정을 요청해주세요.</p><Link to="/">홈으로</Link></div> : <>
      <nav className="nf-tabs" aria-label="새가족팀 업무">{[['week','이번 주'],['people','학생·과정'],['handoff','등반·배정'],...(access.data.canManageTeam ? [['team','팀원 관리']] : [])].map(([key,label]) => <Button variant="secondary" size="sm" type="button" key={key} disabled={busy||weekDirty} aria-pressed={tab===key} onClick={() => navigate(key)}>{label}</Button>)}</nav>
      {error && <div role="alert" className="nf-error">{error}<Button variant="secondary" size="sm" disabled={busy} onClick={() => { setScreen(null); setError(''); setWeekDirty(false); setReload(n=>n+1); void qc.invalidateQueries({ queryKey: ['new-family-roster'] }); void qc.invalidateQueries({ queryKey: ['new-family-week'] }) }}>최신 자료 다시 확인</Button></div>}
      {message && <p role="status" className="nf-success">{message}</p>}
      {screen ? <><Button variant="secondary" size="sm" className="nf-back" disabled={busy} onClick={() => setScreen(null)}>← 목록으로</Button>
        {screen.kind==='new' && <ProfileForm key="new" firstVisit={date} {...baseProps} />}
        {screen.kind==='person' && <PersonDetail key={`${screen.person.id}:${screen.person.revision}`} person={screen.person} {...baseProps} />}
        {screen.kind==='edit' && <ProfileForm key={`edit:${screen.person.id}`} person={screen.person} {...baseProps} />}
        {screen.kind==='enroll' && <Enrollment person={screen.person} {...baseProps} />}
        {screen.kind==='decision' && <Decision person={screen.person} {...baseProps} />}
        {screen.kind==='assign' && <Assignment person={screen.person} {...baseProps} />}
      </> : tab==='week' ? <>
        <WeekNavigator offset={offset} onChange={setOffset} disabled={busy||weekDirty} title={`${labels.monthWeek} 출결`} sub={`${date} 주일 · 예배 합산`} />
        <Week key={`${date}:${reload}`} date={date} onDirty={setWeekDirty} {...baseProps} />
      </> : tab==='team' ? <Team {...baseProps} /> : <>
        <div><h2>{tab==='people' ? '학생·4주 과정' : '등반·반 배정'}</h2></div>
        {roster.isError ? <Button variant="secondary" size="sm" onClick={() => roster.refetch()}>명단 다시 불러오기</Button> : !roster.data ? <p role="status">명단을 불러오는 중…</p> : <div className="nf-list">{roster.data.filter(p => tab==='people' || p.decision==='READY').map(p => <article className="nf-card" key={p.id}><div className="nf-row"><div><strong>{p.profile.name}</strong><p className="nf-help">{p.profile.grade} · 첫 방문 {p.firstVisit}</p></div><span className="nf-badge">{familyStage(p,today())}</span></div>
          {p.enrolledOn && <><Progress dates={p.course} /><p className="nf-help">과정 기록 {p.course.filter(Boolean).length}/4{p.decisionReason ? ` · ${p.decisionReason}` : ''}</p></>}
          {p.classId ? <Handoff person={p} /> : tab==='handoff' && p.assignmentRequested ? <>{canAssign ? <Button size="sm" disabled={busy} onClick={() => open('assign',p)}>반 배정 확정하기</Button> : <p className="nf-help">관리자 확인을 기다리고 있습니다.</p>}</> : tab==='handoff' ? <Button size="sm" disabled={busy} onClick={() => run(() => api.request(p.id,p.revision),'관리자에게 반 배정을 요청했습니다.')}>관리자에게 반 배정 요청</Button> : null}
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => open('person',p)}>{p.enrolledOn ? '과정·판단' : '학생 확인'}</Button>
        </article>)}{!roster.data.some(p=>tab==='people'||p.decision==='READY') && <p className="nf-help">{tab==='people' ? '학생 없음 · 이번 주에서 첫 방문 기록' : '등반 대기 학생이 없습니다.'}</p>}</div>}
      </>}
    </>}
  </main></div>
}

function Progress({ dates }) { return <div className="nf-progress" role="img" aria-label={`과정 참여 ${dates.filter(Boolean).length}회 / 4회`}>{dates.map((date,i)=><span key={i} className={date ? 'done' : ''} />)}</div> }
function Handoff({person:p}) { return <p className="nf-info"><strong>{p.className}</strong> · {p.effectiveDate}부터 담당 반 명단에 연결{p.handoffMemo && <><br />인계: {p.handoffMemo}</>}</p> }
function Week({date,busy,run,open,onDirty}) {
  const query=useQuery({queryKey:['new-family-week',date],queryFn:()=>api.week(date)})
  const [draft,setDraft]=useState(null)
  const [targets,setTargets]=useState({})
  const data=query.data
  const statuses=draft?.checks || Object.fromEntries((data?.checks||[]).map(c=>[c.memberId,c.status]))
  const count=familyCounts(data?.people||[],statuses,date)
  const edit=(id,status)=>{onDirty(true);setDraft(previous=>({sourceHash:previous?.sourceHash||data.sourceHash,checks:{...(previous?.checks||statuses),[id]:status}}))}
  const saved=async()=>{await query.refetch();setDraft(null);onDirty(false)}
  if(query.isError)return <p role="alert">출결을 불러오지 못했습니다. <Button variant="secondary" size="sm" onClick={()=>query.refetch()}>다시 시도</Button></p>
  if(!data)return <p role="status">출결을 불러오는 중…</p>
  return <>
    <div className="nf-row"><h2>이번 주 출결</h2><Button variant="secondary" size="sm" disabled={busy||!!draft} onClick={()=>open('new')}>+ 첫 방문 기록</Button></div>
    <dl className="nf-summary ui-metrics" aria-label="새가족팀 출석 요약">{Object.entries(FAMILY_CATEGORIES).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{count[key]}<small>명</small></dd></div>)}<div><dt>총 출석</dt><dd>{count.total}<small>명</small></dd></div></dl>
    {count.unknown > 0 && <p className="nf-help">미확인 {count.unknown}명</p>}
    <details className="nf-panel"><DisclosureSummary>반에서 온 참고 기록 {data.references.filter(r=>!r.memberId).length}건</DisclosureSummary>{data.references.map(r=><div className="nf-reference" key={`${r.classId}:${r.visitorId}`}><strong>{r.name}</strong><p className="nf-help">{r.className} · 함께 온 친구 {r.introducer||'미입력'} · 교사 참고 출결 {({PRESENT:'출석',LATE:'지각',ABSENT:'불참'})[r.status]||'미확인'}</p>{r.memberId ? <p className="nf-help">기존 학생에 연결 완료</p> : <><label>연결할 학생<AppSelect aria-label="연결할 학생" value={targets[`${r.classId}:${r.visitorId}`]||''} onChange={e=>setTargets({...targets,[`${r.classId}:${r.visitorId}`]:e.target.value})}><option value="">같은 학생 선택</option>{data.people.map(p=><option key={p.id} value={p.id}>{p.profile.name} · {p.profile.grade} · 첫 방문 {p.firstVisit}</option>)}</AppSelect></label><Button variant="secondary" size="sm" disabled={busy||!!draft||!targets[`${r.classId}:${r.visitorId}`]} onClick={()=>run(()=>api.link(date,{classId:r.classId,visitorId:r.visitorId,memberId:Number(targets[`${r.classId}:${r.visitorId}`])}),'기존 학생 연결 완료',()=>query.refetch())}>기존 기록에 연결</Button><p className="nf-help">명단에 없으면 첫 방문 기록부터 추가</p></>}</div>)}</details>
    <div className="nf-list">{data.people.map(p=><article className="nf-card" key={p.id}><div className="nf-row"><div><strong>{p.profile.name}</strong><p className="nf-help">{p.profile.grade} · {FAMILY_CATEGORIES[familyCategory(p,date)]}</p></div><div className="nf-checks" aria-label={`${p.profile.name} 출결`}>{[['PRESENT','출석'],['ABSENT','불참'],['LATE','지각']].map(([value,label])=><Button variant="secondary" size="sm" type="button" key={value} disabled={busy} data-tone={value==='ABSENT'?'absence':undefined} aria-label={`${p.profile.name} ${label}`} aria-pressed={statuses[p.id]===value} onClick={()=>edit(p.id,value)}>{label}</Button>)}</div></div>{(statuses[p.id]||'UNKNOWN')==='UNKNOWN'&&<span className="nf-help">출석 미확인</span>}</article>)}</div>
    {!data.people.length&&<p className="nf-help">이 주에 새가족팀이 담당하는 학생이 없습니다.</p>}
    {draft&&<div className="nf-row"><Button size="sm" disabled={busy} onClick={()=>run(()=>api.attendance(date,draft.sourceHash,Object.entries(draft.checks).map(([memberId,status])=>({memberId:Number(memberId),status}))),'출결 저장 완료 · 팀 제출 필요',saved)}>출결 저장</Button><Button variant="secondary" size="sm" disabled={busy} onClick={()=>{setDraft(null);onDirty(false)}}>변경 취소</Button><p className="nf-help">저장 또는 취소 후 이동 가능</p></div>}
    <div className="nf-panel"><p>{data.submitted ? data.changed ? '수정된 자료 · 다시 제출 필요' : `제출 완료 · ${data.submittedBy}` : '새가족팀 자료 미제출'}</p>{data.issues.length>0&&<ul className="nf-help">{data.issues.map((s,i)=><li key={i}>{s}</li>)}</ul>}<Button size="sm" disabled={busy||!!draft||data.issues.length>0} onClick={()=>run(()=>api.submit(date,data.sourceHash),'제출 완료 · 보고서 반영',()=>query.refetch())}>{data.submitted?'확인 후 다시 제출':'새가족팀 출결 제출'}</Button></div>
  </>
}

function ProfileFields({value,onChange}) {const set=(key,value)=>onChange(previous=>({...previous,[key]:value}));return <><div className="nf-grid"><label>이름<input required maxLength={50} value={value.name} onChange={e=>set('name',e.target.value)} /></label><label>학년<AppSelect aria-label="학년" required value={value.grade} onChange={e=>set('grade',e.target.value)}><option value="">선택</option>{FAMILY_GRADES.map(g=><option key={g}>{g}</option>)}</AppSelect></label></div><details><DisclosureSummary>추가 정보 (선택)</DisclosureSummary><div className="nf-form"><label>성별<AppSelect aria-label="성별" value={value.gender} onChange={e=>set('gender',e.target.value)}><option value="">미확인</option><option>남</option><option>여</option></AppSelect></label>{[['school','학교',100],['phone','연락처',20],['address','주소',255],['introducer','인도자 · 함께 온 친구',100]].map(([key,label,max])=><label key={key}>{label}<input type={key==='phone'?'tel':'text'} maxLength={max} value={value[key]} onChange={e=>set(key,e.target.value)} /></label>)}</div></details></>}
function ProfileForm({person,firstVisit,busy,run,savedPerson}) {
  const [profile,setProfile]=useState(person?.profile||blankProfile)
  const [date,setDate]=useState(firstVisit||today())
  const [memo,setMemo]=useState(person?.memo||'')
  const [distinctPerson,setDistinct]=useState(false)
  return <form className="nf-panel nf-form" onSubmit={e=>{e.preventDefault();run(()=>person ? api.edit(person.id,{revision:person.revision,profile,memo}) : api.create({profile,firstVisit:date,distinctPerson}),person?'학생 정보를 저장했습니다.':'첫 방문 기록 완료 · 출석 체크 필요',savedPerson)}}><h2>{person?'학생 정보 보완':'처음 온 친구 기록'}</h2><fieldset disabled={busy} className="nf-form"><ProfileFields value={profile} onChange={setProfile} />{!person&&<><label>첫 방문일<input type="date" required min="2000-01-01" max={today()} value={date} onChange={e=>setDate(e.target.value)} /></label><label className="nf-checkbox"><input type="checkbox" checked={distinctPerson} onChange={e=>setDistinct(e.target.checked)} />같은 이름·학년의 학생과 다른 사람입니다</label></>}{person&&<label>팀 메모<textarea maxLength={1000} value={memo} onChange={e=>setMemo(e.target.value)} /></label>}<Button size="sm" type="submit">{person?'학생 정보 저장':'첫 방문 기록 저장'}</Button></fieldset></form>
}
function PersonDetail({person:p,busy,run,open,savedPerson}) {
  const [dates,setDates]=useState(p.course)
  const [memo,setMemo]=useState(p.memo)
  return <><div className="nf-row"><div><h2>{p.profile.name}</h2><p className="nf-help">{p.profile.grade} · {p.profile.gender||'성별 미확인'}</p></div><span className="nf-badge">{familyStage(p,today())}</span></div><div className="nf-panel"><p>첫 방문 {p.firstVisit}</p><p>등록 결정 {p.enrolledOn||'미정'}</p><Button variant="secondary" size="sm" disabled={busy} onClick={()=>open('edit',p)}>학생 정보 보완</Button></div>
    {!p.enrolledOn ? <div className="nf-panel"><h3>예배 후 등록 의사 확인</h3><Button size="sm" disabled={busy} onClick={()=>open('enroll',p)}>새가족 등록 결정</Button></div> : <>
      <form className="nf-panel nf-form" onSubmit={e=>{e.preventDefault();run(()=>api.course(p.id,{revision:p.revision,dates,memo}),'과정 기록 저장 완료',savedPerson)}}><div className="nf-row"><h3>4주 과정 참여 이력</h3><span>{dates.filter(Boolean).length}/4</span></div><Progress dates={dates}/><fieldset disabled={busy||!!p.classId} className="nf-form">{dates.map((date,i)=><div className="nf-course" key={i}><label className="nf-checkbox"><input type="checkbox" checked={!!date} onChange={e=>setDates(dates.map((d,j)=>i===j ? e.target.checked?today():null : d))}/>{i+1}주 과정</label><label>참여일<input type="date" aria-label={`${i+1}주 과정 참여일`} disabled={!date} required={!!date} min={p.enrolledOn} max={today()} value={date||''} onChange={e=>setDates(dates.map((d,j)=>i===j?e.target.value:d))}/></label></div>)}<label>팀 메모<textarea maxLength={1000} value={memo} onChange={e=>setMemo(e.target.value)}/></label>{!p.classId&&<Button variant="secondary" size="sm" type="submit">과정 기록 저장</Button>}</fieldset></form>
      <div className="nf-panel"><div className="nf-row"><h3>새가족팀 판단</h3><span className="nf-badge">{p.decision==='READY'?'등반 가능':p.decision==='HOLD'?'계속 참여':'검토 중'}</span></div><p>{p.decisionReason||'팀 판단 대기'}</p>{p.decidedBy&&<p className="nf-help">{p.decidedBy} · {p.decidedAt?.slice(0,10)}{p.graduatedOn&&` · 등반일 ${p.graduatedOn}`}</p>}{!p.classId&&<Button variant="secondary" size="sm" disabled={busy} onClick={()=>open('decision',p)}>등반 판단 기록</Button>}{p.decision==='READY'&&!p.classId&&!p.assignmentRequested&&<Button size="sm" disabled={busy} onClick={()=>run(()=>api.request(p.id,p.revision),'반 배정을 요청했습니다.',savedPerson)}>관리자에게 반 배정 요청</Button>}{p.assignmentRequested&&!p.classId&&<p className="nf-help">관리자 반 배정 대기</p>}</div>
    </>}{p.classId&&<Handoff person={p}/>}</>
}
function Enrollment({person:p,busy,run,savedPerson}) {const [date,setDate]=useState(today());const [memo,setMemo]=useState(p.memo);return <form className="nf-panel nf-form" onSubmit={e=>{e.preventDefault();run(()=>api.enroll(p.id,{revision:p.revision,date,memo}),'새가족 등록 결정을 기록했습니다.',savedPerson)}}><h2>{p.profile.name} · 새가족 등록</h2><fieldset disabled={busy} className="nf-form"><label>등록 결정일<input type="date" required min={p.firstVisit} max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>등록 확인 메모<textarea maxLength={1000} value={memo} onChange={e=>setMemo(e.target.value)}/></label><Button size="sm" type="submit">등록 결정 저장</Button></fieldset></form>}
function Decision({person:p,busy,run,savedPerson}) {const [decision,setDecision]=useState(p.decision==='READY'?'READY':'HOLD');const [reason,setReason]=useState(p.decisionReason);const [date,setDate]=useState(p.graduatedOn||today());return <form className="nf-panel nf-form" onSubmit={e=>{e.preventDefault();run(()=>api.decide(p.id,{revision:p.revision,decision,reason,graduatedOn:decision==='READY'?date:null}),'새가족팀의 개별 판단을 기록했습니다.',savedPerson)}}><h2>{p.profile.name} · 등반 판단</h2><p className="nf-help">과정 기록 {p.course.filter(Boolean).length}/4</p><fieldset disabled={busy} className="nf-form"><label>팀 판단<AppSelect aria-label="팀 판단" value={decision} onChange={e=>setDecision(e.target.value)}><option value="HOLD">계속 참여 · 추후 검토</option><option value="READY">등반 가능</option></AppSelect></label>{decision==='READY'&&<label>등반일<input type="date" required min={p.enrolledOn} max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label>}<label>판단 사유<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><Button size="sm" type="submit">팀 판단 저장</Button></fieldset></form>}
function Assignment({person:p,busy,run,savedPerson}) {const query=useQuery({queryKey:['new-family-classes'],queryFn:api.classes});const [classId,setClassId]=useState('');const [date,setDate]=useState(toApiDate(getWeekStartByOffset(1,0)));const [memo,setMemo]=useState('');return <form className="nf-panel nf-form" onSubmit={e=>{e.preventDefault();run(()=>api.assign(p.id,{revision:p.revision,classId:Number(classId),effectiveDate:date,memo}),'배정 완료 · 적용일부터 담당 반에서 출결 체크',savedPerson)}}><h2>{p.profile.name} · 반 배정</h2><p className="nf-help">팀 판단: {p.decisionReason}</p><fieldset disabled={busy||!query.data} className="nf-form"><label>배정할 반<AppSelect aria-label="배정할 반" required value={classId} onChange={e=>setClassId(e.target.value)}><option value="">같은 학년의 반 선택</option>{query.data?.filter(c=>c.grade===p.profile.grade).map(c=><option key={c.id} value={c.id}>{c.name} · {c.teacher} · {c.size}명</option>)}</AppSelect></label><label>반 적용일<input type="date" min={today()} required value={date} onChange={e=>setDate(e.target.value)}/></label><label>담임 인계 메모<textarea maxLength={500} value={memo} onChange={e=>setMemo(e.target.value)}/></label><p className="nf-help">적용일 전: 새가족팀 · 적용일부터: 배정 반</p><Button size="sm" type="submit">반 배정 확정</Button></fieldset>{query.isError&&<Button variant="secondary" size="sm" type="button" onClick={()=>query.refetch()}>반 목록 다시 불러오기</Button>}{query.data&&!query.data.some(c=>c.grade===p.profile.grade)&&<p className="nf-error">같은 학년의 반을 먼저 등록하세요.</p>}</form>}
function Team({busy,run}) {const query=useQuery({queryKey:['new-family-team'],queryFn:api.team});return <><h2>새가족팀 업무 배정</h2>{query.isError?<Button variant="secondary" size="sm" onClick={()=>query.refetch()}>팀원 다시 불러오기</Button>:query.data?.map(u=><div className="nf-card nf-row" key={u.id}><div><strong>{u.name}</strong><p className="nf-help">{u.role==='ADMIN'?'관리자':u.role==='PASTOR'?'목사님':u.role==='EXECUTIVE'?'임원':'교사'}{u.member?' · 새가족팀':''}</p></div>{!['ADMIN','PASTOR'].includes(u.role)&&<Button variant="secondary" size="sm" disabled={busy} onClick={()=>run(()=>api.setTeam(u.id,!u.member),u.member?'새가족팀 업무 배정을 해제했습니다.':'새가족팀 담당자로 지정했습니다.',()=>query.refetch())}>{u.member?'팀 배정 해제':'팀 담당 지정'}</Button>}</div>)}</>}
