import {useState} from 'react'
import {useHasUnsavedChanges} from '../common/UnsavedChanges'
import {ReviewForm,requestStatus,isShared} from './RequestForms'
import {OwnerUpdateForm,UpdateReviewForm,UpdateHistory} from './RequestUpdates'
import {FileText,Globe,Trash2} from 'lucide-react'
import PrayerDisclosure from './PrayerDisclosure'

export default function RequestDetail({request,manager,busy,onSave,onDelete,onUpdate,onReviewUpdate}){
 // Keep the edited revision stable during background refresh. A confirmed save replaces it.
 const hasUnsaved=useHasUnsavedChanges()
 const [working,setWorking]=useState(request)
 const current=hasUnsaved()?working:request
 if(current!==working)setWorking(current)
 request={...current,own:request.own,canReadOriginal:request.canReadOriginal}
 const saved=handler=>async(...args)=>{const result=await handler(...args);if(result?.id===working.id)setWorking(result);return result}
 const original=request.canReadOriginal&&(request.own||manager)
 const originalContent=<><div className="it-row"><h2>기도제목</h2><span className="it-meta">{request.source} · {request.author}</span></div><strong>{request.title}</strong><p className="it-prayer-copy">{request.body}</p></>
 return <div className="it-stack">
  <div className="it-row"><span className="it-badge">{request.category}</span><span className="it-meta">{requestStatus(request)}</span></div>
  {original&&(request.pendingUpdate?<PrayerDisclosure title="기존 제출 내용" icon={FileText}><div className="it-stack">{originalContent}</div></PrayerDisclosure>:<section className="it-card it-stack">{originalContent}</section>)}
  {manager&&request.pendingUpdate?<UpdateReviewForm key={request.id+':'+request.revision} request={request} busy={busy} onSave={saved(onReviewUpdate)}/>:manager?<ReviewForm key={request.id+':'+request.revision} request={request} busy={busy} onSave={saved(onSave)}/>:request.share&&isShared(request)?<section className="it-card it-stack"><h2>{request.publicTitle}</h2><p className="it-prayer-copy">{request.publicText}</p>{!request.anonymous&&<span className="it-meta">{request.author}</span>}</section>:request.state==='pending'&&<p className="it-meta">팀에서 확인하고 있습니다.</p>}
  {manager&&request.share&&isShared(request)&&<PrayerDisclosure title="현재 공유 중인 내용" icon={Globe}><div className="it-stack"><strong>{request.publicTitle}</strong><p className="it-prayer-copy">{request.publicText}</p></div></PrayerDisclosure>}
  {!manager&&request.pendingUpdate&&<section className="it-card it-stack it-update-notice"><span className="it-new-badge">수정·근황 확인 대기</span><strong>{request.pendingUpdate.title}</strong><p className="it-prayer-copy">{request.pendingUpdate.body}</p>{request.pendingUpdate.note&&<p className="it-prayer-copy">{request.pendingUpdate.note}</p>}</section>}
  {request.own&&request.state!=='archived'&&<OwnerUpdateForm key={'owner:'+request.id+':'+request.revision} request={request} busy={busy} onSave={saved(onUpdate)}/>}
  {original&&<UpdateHistory updates={request.updates}/>}
  {(request.own||manager)&&request.state!=='archived'&&<div className="it-delete-area"><button type="button" className="it-delete-button" disabled={busy} onClick={onDelete}><Trash2 size={15} aria-hidden="true"/>기도제목 삭제</button></div>}
 </div>
}
