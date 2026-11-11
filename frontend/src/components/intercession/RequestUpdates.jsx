import {useFormChanges} from '../common/UnsavedChanges'
import {useState} from 'react'
import {PencilLine,History,Globe} from 'lucide-react'
import PrayerDisclosure from './PrayerDisclosure'
import {ActionButton as Button} from '../praise/PraiseMotion'
import {FormField,isShared} from './RequestForms'

const stamp=value=>value?.replace('T',' ').slice(0,16)||''
export function OwnerUpdateForm({request:r,busy,onSave}){
 const [title,setTitle]=useState(r.pendingUpdate?.title||r.title),[body,setBody]=useState(r.pendingUpdate?.body||r.body),[note,setNote]=useState(r.pendingUpdate?.note||'')
 useFormChanges({title,body,note},{busy})
 const changed=title.trim()!==r.title||body.trim()!==r.body||!!note.trim()
 return <PrayerDisclosure title="내용 수정·근황 전달" icon={PencilLine} disabled={busy}><form onSubmit={e=>{e.preventDefault();if(changed)onSave({revision:r.revision,title,body,note})}}>
  <fieldset className="it-stack" disabled={busy}>
   <p className="it-meta">공유 여부는 팀에서 확인합니다.</p>
   <FormField label="수정할 기도제목"><input className="field-input" required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></FormField>
   <FormField label="수정할 내용"><textarea className="field-input" required rows={4} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/></FormField>
   <FormField label="달라진 상황 (선택)"><textarea className="field-input" rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="최근 상황이나 팀에 전할 내용을 적어주세요"/></FormField>
   <Button type="submit" disabled={!changed||!title.trim()||!body.trim()} loading={busy}>팀에 전달하기</Button>
  </fieldset>
 </form></PrayerDisclosure>
}

export function UpdateReviewForm({request:r,busy,onSave}){
 const update=r.pendingUpdate,shared=isShared(r)
 const [title,setTitle]=useState(update.title===r.title&&r.publicTitle?r.publicTitle:update.title)
 const [body,setBody]=useState((update.body===r.body&&r.publicText?r.publicText:update.body)+(update.note?'\n\n근황\n'+update.note:''))
 useFormChanges({title,body},{busy})
 const save=updatePublic=>onSave({revision:r.revision,updatePublic,publicTitle:title,publicText:body})
 return <section className="it-card it-stack it-update-notice">
  <div className="it-row"><h2>수정 내용·근황</h2><span className="it-new-badge">확인 대기</span></div>
  <span className="it-meta">{stamp(update.submittedAt)}</span><strong>{update.title}</strong><p className="it-prayer-copy">{update.body}</p>
  {update.note&&<><h2>전해온 근황</h2><p className="it-prayer-copy">{update.note}</p></>}
  <fieldset className="it-stack" disabled={busy}>
   {r.share&&<PrayerDisclosure title="공유할 내용" icon={Globe} disabled={busy}><div className="it-stack">
    <FormField label="공유할 제목"><input className="field-input" maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></FormField>
    <FormField label="공유할 본문"><textarea className="field-input" rows={4} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/></FormField>
    {body.length>2000&&<p className="it-error" role="alert">공유할 본문을 2,000자 이내로 줄여주세요. ({body.length}자)</p>}
   </div></PrayerDisclosure>}
   <Button variant="secondary" loading={busy} onClick={()=>save(false)}>{shared?'공유 내용 유지':'팀에서만 확인'}</Button>
   {r.share&&<Button loading={busy} disabled={!title.trim()||!body.trim()||body.length>2000} onClick={()=>save(true)}>{shared?'공유 내용에 반영':'전체에 공유'}</Button>}
  </fieldset>
 </section>
}

export function UpdateHistory({updates}){
 if(!updates?.length)return null
 return <PrayerDisclosure title={'지난 수정·근황 '+updates.length} icon={History}><div>
  {[...updates].reverse().map((entry,index)=><article className="it-update-history it-stack" key={index}>
   <div className="it-row"><span className="it-meta">{stamp(entry.update.submittedAt)}</span><span className="it-meta">{entry.shared?'공유 반영':'팀 확인'}</span></div>
   <strong>{entry.update.title}</strong><p className="it-prayer-copy">{entry.update.body}</p>{entry.update.note&&<p className="it-prayer-copy">{entry.update.note}</p>}
  </article>)}
 </div></PrayerDisclosure>
}
