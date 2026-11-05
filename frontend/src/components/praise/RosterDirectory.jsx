import React, {useId,useState} from 'react'
import {ChevronDown, Search, X} from 'lucide-react'
import AppSelect from '../common/AppSelect'
import GradeLabel from '../common/GradeLabel'
import {gradeClasses} from '../../utils/gradeColors'
import SegmentedControl from '../common/SegmentedControl'
import {GroupCollapse, MotionCheck} from './PraiseMotion'
import {AnimatedValue} from '../common/Motion'

import {parts,grades} from '../../utils/praise'
function RosterDirectory({members,onPerson,selectedIds,onSelection,lockedIds=[],memberNotes={}}){
 const [kind,setKind]=useState('전체'),[view,setView]=useState('group'),[search,setSearch]=useState(''),[collapsed,setCollapsed]=useState({})
 const directoryId=useId()
 const query=search.trim().toLowerCase(), selecting=!!onSelection
 const filtered=members.filter(p=>(kind==='전체'||p.kind===kind)&&(!query||p.name.toLowerCase().includes(query)))
 const groupNames=view==='part'?parts:['교사',...grades,'학년 미정']
 const groups=groupNames.map(label=>({label,items:filtered.filter(p=>view==='part'?p.parts.includes(label):label==='교사'?p.kind==='교사':p.kind==='학생'&&(label==='학년 미정'?!grades.includes(p.grade):p.grade===label)).sort((a,b)=>Number(!!b.leader)-Number(!!a.leader)||a.name.localeCompare(b.name,'ko'))})).filter(g=>g.items.length)
 const allCollapsed=groups.length>0&&groups.every(g=>collapsed[g.label])
 const counts={전체:members.length,교사:members.filter(p=>p.kind==='교사').length,학생:members.filter(p=>p.kind==='학생').length}
 return <section className="pt-directory" aria-label={selecting?'팀원 선택 목록':'찬양팀 명단'}>
   <div className="pt-dir-tools"><div className="pt-dir-search-row"><label className="pt-dir-search"><Search size={16} aria-hidden="true"/><input aria-label="명단 이름 검색" placeholder="이름 찾기" value={search} onChange={e=>{setSearch(e.target.value);setCollapsed({})}}/>{search&&<button type="button" aria-label="검색어 지우기" onClick={()=>{setSearch('');setCollapsed({})}}><X size={16}/></button>}</label><AppSelect aria-label="명단 묶음 기준" value={view} onChange={e=>{setView(e.target.value);setCollapsed({})}}><option value="group">구성별</option><option value="part" disabled={members.every(p=>!p.parts.length)}>파트별</option></AppSelect></div>
    <SegmentedControl label="명단 대상" value={kind} onChange={setKind} options={['전체','교사','학생'].map(k=>({value:k,label:`${k} ${counts[k]}`}))}/>
   </div>
   <div className="pt-dir-caption"><span aria-live="polite"><AnimatedValue value={query?`검색 ${filtered.length}명`:selecting?`선택 ${selectedIds.length}명`:`${filtered.length}명`}/>{view==='part'?' · 겸임 포함':''}</span>{!query&&groups.length>0&&<button type="button" onClick={()=>setCollapsed(Object.fromEntries(groups.map(g=>[g.label,!allCollapsed])))}>{allCollapsed?'모두 펼치기':'모두 접기'}</button>}</div>
   {groups.map(({label,items})=>{const open=!collapsed[label],grade=view==='group'&&grades.includes(label)?label:null;return <section className={`pt-dir-group${grade?' pt-dir-grade '+gradeClasses(grade).border:''}`} key={label}>
    <button type="button" className="pt-dir-heading ui-disclosure-trigger" aria-expanded={open} aria-controls={`${directoryId}-${label}`} aria-label={`${label} ${items.length}명`} onClick={()=>setCollapsed({...collapsed,[label]:open})}><span className="ui-disclosure-label"><strong><GradeLabel value={grade}>{label}</GradeLabel></strong><span className={grade?gradeClasses(grade).light:undefined}>{items.length}명</span></span><ChevronDown size={17} className={open?'pt-dir-expanded':''} aria-hidden="true"/></button>
    <div id={`${directoryId}-${label}`}><GroupCollapse open={open}><div className="pt-dir-names" key={`${view}:${kind}`}>{items.map(p=>{const meta=p.leader?'팀장':view==='part'?p.kind==='교사'?'교사':p.grade:p.parts.length===0?p.kind:p.parts.length===1?p.parts[0]:`${p.parts.length}파트`,note=memberNotes[p.id];return selecting?<label key={p.id} className="pt-dir-person pt-dir-pick" data-selected={selectedIds.includes(p.id)}><MotionCheck disabled={lockedIds.includes(p.id)} checked={selectedIds.includes(p.id)} onChange={e=>onSelection(p.id,e.target.checked)}/><span><strong>{p.name}</strong><small><GradeLabel value={view==='part'&&p.kind==='학생'?p.grade:null}>{meta}</GradeLabel></small>{note&&<small className="pt-av-note" data-tone={note.tone}>{note.text}</small>}</span></label>:<button type="button" key={p.id} className="pt-dir-person" onClick={()=>onPerson(p)} aria-label={`${p.name} ${p.kind}${p.grade?` ${p.grade}`:''} ${p.parts.join(' ')} 상세`}><strong>{p.name}</strong><small><GradeLabel value={view==='part'&&p.kind==='학생'?p.grade:null}>{meta}</GradeLabel></small>{note&&<small className="pt-av-note" data-tone={note.tone}>{note.text}</small>}</button>})}</div></GroupCollapse></div>
   </section>})}
   {!filtered.length&&<p className="pt-dir-empty" role="status">조건에 맞는 팀원이 없습니다.</p>}
 </section>
}


export default RosterDirectory
