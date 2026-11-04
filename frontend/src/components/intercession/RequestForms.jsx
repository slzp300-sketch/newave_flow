import {useState} from 'react'
import {Globe,Lock} from 'lucide-react'
import AppSelect from '../common/AppSelect'
import {ActionButton as Button,MotionCheck} from '../praise/PraiseMotion'
export const categories=['청소년부','학생','교사','가정','기타']
export const statusName={pending:'접수',ready:'정리됨',published:'공유 중',answered:'응답·감사',archived:'철회됨'}
export function FormField({label,children}){return <label className="it-field"><span>{label}</span>{children}</label>}
export function RequestForm({proxy=false,onSave,busy}){
 const [form,setForm]=useState({title:'',body:'',category:'청소년부',proxy,senderName:'',share:true,anonymous:true})
 const change=patch=>setForm(s=>({...s,...patch}))
 return <form className="it-stack" onSubmit={e=>{e.preventDefault();onSave(form)}}>
  <fieldset disabled={busy} className="it-stack">
   {proxy&&<FormField label="보내주신 분"><input required maxLength={80} className="field-input" value={form.senderName} onChange={e=>change({senderName:e.target.value})} placeholder="이름 또는 익명"/></FormField>}
   <FormField label="기도제목"><input required maxLength={80} className="field-input" value={form.title} onChange={e=>change({title:e.target.value})} placeholder="함께 기도할 제목"/></FormField>
   <FormField label={proxy?'받은 내용 붙여넣기':'내용'}><textarea required maxLength={2000} rows={6} className="field-input" value={form.body} onChange={e=>change({body:e.target.value})} placeholder="기도할 내용을 적어주세요"/></FormField>
   <FormField label="분류"><AppSelect aria-label="기도제목 분류" value={form.category} onChange={e=>change({category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</AppSelect></FormField>
   <label className="it-check"><MotionCheck checked={form.share} onChange={e=>change({share:e.target.checked})}/>{proxy?'전체 공유 동의 확인':'교사 전체에 공유'}</label>
   {form.share?<label className="it-check"><MotionCheck checked={form.anonymous} onChange={e=>change({anonymous:e.target.checked})}/>이름은 표시하지 않기</label>:<p className="it-private"><Lock size={15}/>팀에만 전달</p>}
   <Button type="submit" size="lg" loading={busy}>{proxy?'등록하기':'기도제목 보내기'}</Button>
  </fieldset>
 </form>
}
export function ReviewForm({request:r,onSave,busy}){
 const [form,setForm]=useState({revision:r.revision,publicTitle:r.publicTitle||r.title||'',publicText:r.publicText||'',anonymous:r.anonymous})
 const change=patch=>setForm(s=>({...s,...patch}))
 const valid=form.publicTitle.trim()&&form.publicText.trim()
 return <form className="it-card it-stack" onSubmit={e=>{e.preventDefault();onSave({...form,action:'SAVE'})}}>
  <h2>공유용 정리</h2><fieldset disabled={busy||r.state==='archived'} className="it-stack">
   <FormField label="공유 제목"><input required maxLength={80} className="field-input" value={form.publicTitle} onChange={e=>change({publicTitle:e.target.value})}/></FormField>
   <FormField label="함께 기도할 내용"><textarea required maxLength={2000} rows={5} className="field-input" value={form.publicText} onChange={e=>change({publicText:e.target.value})}/></FormField>
   <label className="it-check"><MotionCheck disabled={r.anonymous} checked={form.anonymous} onChange={e=>change({anonymous:e.target.checked})}/>제출자 이름 표시 안 함</label>
   {!r.share&&<p className="it-private"><Lock size={15}/>팀만 전달</p>}
   <div className="it-actions"><Button type="submit" disabled={!valid} variant="secondary">{['published','answered'].includes(r.state)?'공유 중단·정리 저장':'정리 저장'}</Button><Button disabled={!r.share||!valid} onClick={()=>onSave({...form,action:'PUBLISH'})}><Globe size={15}/>{r.state==='published'?'공유 내용 수정':'전체 공유'}</Button></div>
   {r.state==='published'&&<button type="button" className="it-text-button" onClick={()=>onSave({...form,action:'ANSWER'})}>응답·감사로 옮기기</button>}
  </fieldset>
 </form>
}
