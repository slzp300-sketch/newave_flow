import {useState,useRef} from 'react'
import {useQuery,useQueryClient} from '@tanstack/react-query'
import {Plus,ChevronRight,Users,Shuffle,RefreshCw} from 'lucide-react'
import Header from '../components/layout/Header'
import SegmentedControl from '../components/common/SegmentedControl'
import AdminReadGuard from '../components/common/AdminReadGuard'
import SearchField from '../components/common/SearchField'
import Button from '../components/common/Button'
import CompactSelect from '../components/common/CompactSelect'
import EvangelismDialog from '../components/evangelism/EvangelismDialog'
import EvangelismSchedules from '../components/evangelism/EvangelismSchedules'
import {evangelismApi,usersApi} from '../api/evangelism'
import useAuthStore from '../store/authStore'
import {evangelismPeople,balancedMoves} from '../utils/evangelismAdmin'
import './EvangelismAdminPage.css'

// Retained for the teacher-facing rotation page.
const GROUP_COLORS=[
 {bg:'bg-primary-100',text:'text-primary-700',border:'border-primary-200',dot:'bg-primary-500',light:'bg-primary-50'},
 {bg:'bg-primary-100',text:'text-primary-700',border:'border-primary-200',dot:'bg-primary-500',light:'bg-primary-50'},
 {bg:'bg-secondary-100',text:'text-secondary-700',border:'border-secondary-200',dot:'bg-secondary-500',light:'bg-secondary-50'},
 {bg:'bg-amber-100',text:'text-amber-700',border:'border-amber-200',dot:'bg-amber-500',light:'bg-amber-50'},
 {bg:'bg-rose-100',text:'text-rose-700',border:'border-rose-200',dot:'bg-rose-500',light:'bg-rose-50'},
 {bg:'bg-primary-100',text:'text-primary-700',border:'border-primary-200',dot:'bg-primary-500',light:'bg-primary-50'},
 {bg:'bg-orange-100',text:'text-orange-700',border:'border-orange-200',dot:'bg-orange-500',light:'bg-orange-50'},
]
export const getGroupColor=index=>GROUP_COLORS[index%GROUP_COLORS.length]
export default function EvangelismAdminPage(){
 const {user,apiEnvironment}=useAuthStore()
 return <EvangelismAdmin key={apiEnvironment+':'+user?.id} scope={apiEnvironment+':'+user?.id}/>
}
function EvangelismAdmin({scope}){
 const [tab,setTab]=useState('groups'),[editor,setEditor]=useState(null),[meta,setMeta]=useState(null),[balance,setBalance]=useState(null)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const lock=useRef(false),attempt=useRef(null),qc=useQueryClient()
 const teachersQuery=useQuery({queryKey:['teachers','evangelism',scope],queryFn:()=>usersApi.getTeachers().then(r=>r.data)})
 const groupsQuery=useQuery({queryKey:['evangelism-groups',scope],queryFn:()=>evangelismApi.getGroups().then(r=>r.data),refetchOnMount:'always'})
 const groups=groupsQuery.data||[],people=evangelismPeople(teachersQuery.data||[],groups),pool=people.filter(p=>p.groupId==null)
 const refresh=()=>qc.invalidateQueries({predicate:q=>String(q.queryKey[0]).startsWith('evangelism-')})
 const perform=async(action,payload,work,done)=>{
  if(lock.current)return false
  const signature=JSON.stringify([action,payload])
  if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()}
  lock.current=true;setBusy(true);setError('');setNotice('')
  try{await work(attempt.current.key);attempt.current=null;await refresh();done?.();setNotice('저장 완료');return true}
  catch(e){setError(e.response?.data?.message||'저장 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.');await refresh();return false}
  finally{lock.current=false;setBusy(false)}
 }
 const openEditor=filter=>{setError('');setNotice('');setEditor(filter)}
 return <div className="admin-evangelism-page">
  <Header title="전도 관리" showBack/>
  <div className="ev-tabs"><SegmentedControl label="전도 관리 화면" value={tab} onChange={setTab} disabled={busy} options={[{value:'groups',label:'조 편성'},{value:'schedules',label:'일정 관리'}]}/></div>
  {notice&&<p className="ev-notice" role="status">{notice}</p>}
  {error&&!editor&&!meta&&!balance&&tab==='groups'&&<p className="ev-error" role="alert">{error}</p>}
  {tab==='groups'?<section className="ev-body" aria-label="전도 조 편성">
   <AdminReadGuard queries={[teachersQuery,groupsQuery]} label="전도 조 명단" reserveStatusSpace={false}>
    <div className="ev-metrics"><span>전체 <strong>{people.length}</strong></span><span>배정 <strong>{people.length-pool.length}</strong></span><span>미배정 <strong>{pool.length}</strong></span></div>
    <div className="ev-actions"><Button size="sm" onClick={()=>openEditor('pool')}><Users size={16}/>교사 배정</Button><Button size="sm" variant="secondary" onClick={()=>{setError('');setMeta({id:null,name:''})}}><Plus size={16}/>조 추가</Button><button className="ev-icon" type="button" aria-label="조 명단 새로고침" disabled={busy||groupsQuery.isFetching} onClick={()=>{void groupsQuery.refetch();void teachersQuery.refetch()}}><RefreshCw size={17}/></button></div>
    <div className="ev-grid">{groups.map(g=><button type="button" className="ev-card" key={g.id} onClick={()=>openEditor(String(g.id))} aria-label={g.name+' 조 편성 보기'}><span className="ev-card-heading"><strong>{g.name}</strong><span>{g.members?.length||0}명</span></span><span className="ev-card-names">{g.members?.map(m=>m.teacherName).join(' · ')||'조원 없음'}</span><span className="ev-card-bottom">조원 관리<ChevronRight size={16}/></span></button>)}</div>
    {!groups.length&&<p className="ev-empty">전도 조를 추가해주세요.</p>}
    <div className="ev-heading"><strong className="ui-section-title">미배정 {pool.length}명</strong><button type="button" className="ev-small" disabled={!pool.length||!groups.length} onClick={()=>{setError('');setBalance(balancedMoves(people,groups))}}><Shuffle size={16}/>자동 배분</button></div>
    <div className="ev-chips">{pool.map(p=><button key={p.id} type="button" onClick={()=>openEditor('pool')} aria-label={p.name+' 배정하기'}>{p.name}</button>)}</div>
   </AdminReadGuard>
  </section>:<EvangelismSchedules groups={groups} groupsQuery={groupsQuery} scope={scope} busy={busy} error={error} clearError={()=>setError('')} perform={perform}/>}
  {editor!==null&&<GroupEditor key={editor} initialFilter={editor} people={people} groups={groups} busy={busy} error={error} onClose={()=>{setEditor(null);setError('')}} onMeta={g=>{setEditor(null);setError('');setMeta(g)}} onMove={moves=>perform('move',moves,key=>evangelismApi.moveTeachers(moves,key))}/>}
  {meta&&<GroupMeta group={meta} busy={busy} error={error} onClose={()=>{setMeta(null);setError('')}} onSave={name=>perform('group-name',{id:meta.id,name},()=>meta.id?evangelismApi.updateGroup(meta.id,{name}):evangelismApi.createGroup({name}),()=>setMeta(null))} onDelete={()=>perform('group-delete',meta.id,()=>evangelismApi.deleteGroup(meta.id),()=>setMeta(null))}/>}
  {balance&&<EvangelismDialog title="미배정 자동 배분" busy={busy} onClose={()=>{setBalance(null);setError('')}}><div className="ev-rows">{groups.map(g=><div key={g.id} className="ev-preview-row"><strong>{g.name}</strong><span>{g.members?.length||0}명 → {(g.members?.length||0)+balance.filter(m=>m.toGroupId===g.id).length}명</span></div>)}</div><p className="ev-muted">기존 조원은 유지됩니다.</p>{error&&<p className="ev-error" role="alert">{error}</p>}<Button loading={busy} onClick={()=>perform('balance',balance,key=>evangelismApi.moveTeachers(balance,key),()=>setBalance(null))}>{balance.length}명 배분 확정</Button></EvangelismDialog>}
 </div>
}
function GroupEditor({initialFilter,people,groups,busy,error,onClose,onMove,onMeta}){
 const [filter,setFilter]=useState(initialFilter),[search,setSearch]=useState(''),[selected,setSelected]=useState([]),[target,setTarget]=useState(''),[message,setMessage]=useState('')
 const rows=people.filter(p=>(filter==='all'||filter==='pool'&&p.groupId==null||String(p.groupId)===filter)&&(!search.trim()||(p.name+' '+p.grade).includes(search.trim())))
 const current=groups.find(g=>String(g.id)===filter)
 const groupOptions=groups.map(g=>({value:String(g.id),label:g.name,detail:(g.members?.length||0)+'명'}))
 const toggle=p=>{setMessage('');setSelected(prev=>prev.some(s=>s.id===p.id)?prev.filter(s=>s.id!==p.id):[...prev,{...p}])}
 const allSelected=rows.length>0&&rows.every(p=>selected.some(s=>s.id===p.id))
 const move=async()=>{
  const to=target==='pool'?null:Number(target)
  const moves=selected.filter(p=>p.groupId!==to).map(p=>({teacherId:p.id,fromGroupId:p.groupId,toGroupId:to}))
  if(!moves.length){setMessage('이미 선택한 조에 속해 있습니다.');return}
  if(await onMove(moves)){setSelected([]);setTarget('');setMessage(moves.length+'명 이동 완료')}
 }
 return <EvangelismDialog title="교사 조 편성" busy={busy} onClose={onClose}>
  <CompactSelect id="ev-source" label="현재 조" disabled={busy} value={filter} onChange={setFilter} options={[{value:'pool',label:'미배정'},{value:'all',label:'전체 교사'},...groupOptions]}/>
  {current&&<button type="button" className="ev-small" disabled={busy} onClick={()=>onMeta(current)}>조 이름 수정·삭제</button>}
  <SearchField label="전도 교사 검색" value={search} onChange={setSearch} placeholder="이름·학년 검색"/>
  <div className="ev-heading"><span className="ev-muted">{rows.length}명 · 선택 {selected.length}명</span><button type="button" className="ev-small" disabled={busy||!rows.length} onClick={()=>setSelected(prev=>allSelected?prev.filter(p=>!rows.some(r=>r.id===p.id)):[...prev,...rows.filter(p=>!prev.some(s=>s.id===p.id))])}>{allSelected?'표시된 선택 해제':'표시된 교사 선택'}</button></div>
  <fieldset disabled={busy} className="ev-people">{rows.map(p=><label className="ev-person" key={p.id}><input type="checkbox" checked={selected.some(s=>s.id===p.id)} onChange={()=>toggle(p)} aria-label={p.name+' 선택'}/><span><strong>{p.name}</strong><small>{[p.grade,p.groupName].filter(Boolean).join(' · ')}</small></span></label>)}</fieldset>
  {!rows.length&&<p className="ev-empty">해당 교사가 없습니다.</p>}
  {!!selected.length&&<div className="ev-selection"><p className="ev-muted">{selected.map(p=>p.name).join(' · ')}</p><CompactSelect id="ev-destination" label="이동할 조" value={target} disabled={busy} onChange={setTarget} placeholder="담당 조 선택" options={[{value:'pool',label:'배정 해제'},...groupOptions]}/><div className="ev-actions"><Button size="sm" loading={busy} disabled={!target} onClick={move}>{selected.length}명 {target==='pool'?'배정 해제':'이동'}</Button><button type="button" className="ev-small" disabled={busy} onClick={()=>setSelected([])}>선택 해제</button></div></div>}
  {message&&<p role="status" className="ev-success">{message}</p>}{error&&<p role="alert" className="ev-error">{error}</p>}
 </EvangelismDialog>
}
function GroupMeta({group,busy,error,onClose,onSave,onDelete}){
 const [name,setName]=useState(group.name),[confirm,setConfirm]=useState(false)
 return <EvangelismDialog title={group.id?'조 설정':'조 추가'} busy={busy} onClose={onClose}><form onSubmit={e=>{e.preventDefault();if(name.trim())onSave(name.trim())}}><div className="ev-field"><label htmlFor="ev-group-name">조 이름</label><input id="ev-group-name" maxLength={100} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></div><div className="ev-actions mt-3"><Button type="submit" size="sm" loading={busy} disabled={!name.trim()}>저장</Button>{group.id&&<button type="button" className="ev-small" disabled={busy} onClick={()=>setConfirm(true)}>조 삭제</button>}</div></form>{confirm&&<div className="ev-confirm"><p>{group.name}를 삭제할까요? 조원은 미배정으로 이동합니다.</p><p className="ev-muted">기존 전도 일정은 유지됩니다.</p><div className="ev-actions"><Button size="sm" disabled={busy} onClick={onDelete}>삭제 확인</Button><button type="button" className="ev-small" disabled={busy} onClick={()=>setConfirm(false)}>취소</button></div></div>}{error&&<p role="alert" className="ev-error">{error}</p>}</EvangelismDialog>
}
