import {useState} from 'react'
import {SlidersHorizontal,Lock,Globe,Check,RotateCcw,History} from 'lucide-react'
import PrayerDisclosure from './PrayerDisclosure'
import AppSelect from '../common/AppSelect'
import SegmentedControl from '../common/SegmentedControl'
import {ActionButton as Button,MotionCheck} from '../praise/PraiseMotion'
import {PRAYER_CATEGORIES} from '../../utils/intercessionCollection'
export const categories=PRAYER_CATEGORIES
export const requestStatus=r=>r.state==='archived'?'삭제됨':r.state==='pending'?'새 요청':r.completed||r.state==='answered'?'지난 기도제목':'현재 기도제목'
export const isShared=r=>['published','answered'].includes(r.state)
export const sharingName=r=>r.state==='pending'?(r.share?(r.anonymous?'익명 공유 동의':'전체 공유 동의'):'팀만 전달'):isShared(r)?(r.anonymous?'익명 공유':'전체 공유'):'팀만 보기'
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
 const pending=r.state==='pending',completed=!!r.completed||r.state==='answered'
 const saved={revision:r.revision,publish:isShared(r),completed,publicTitle:r.publicTitle||r.title||'',publicText:r.publicText||r.body||'',anonymous:r.anonymous}
 const [form,setForm]=useState(saved)
 const change=patch=>setForm(s=>({...s,...patch}))
 const valid=form.publicTitle.trim()&&form.publicText.trim()
 if(r.state==='archived')return null
 const editor=<PrayerDisclosure title={pending?'내용 수정':'내용·공유 설정'} icon={SlidersHorizontal} disabled={busy}><div className="it-stack">
    {!pending&&<SegmentedControl label="공유 범위" value={String(form.publish)} disabled={busy} onChange={value=>change({publish:value==='true'})} options={[{value:'true',label:'전체 공유',disabled:!r.share},{value:'false',label:'팀만 보기'}]}/>}
    <FormField label="공유 제목"><input required maxLength={80} className="field-input" value={form.publicTitle} onChange={e=>change({publicTitle:e.target.value})}/></FormField>
    <FormField label="함께 기도할 내용"><textarea required maxLength={2000} rows={4} className="field-input" value={form.publicText} onChange={e=>change({publicText:e.target.value})}/></FormField>
    {!r.anonymous&&<label className="it-check"><MotionCheck checked={form.anonymous} onChange={e=>change({anonymous:e.target.checked})}/>제출자 이름 표시 안 함</label>}
    {!pending&&<Button type="submit" disabled={!valid} loading={busy}>변경사항 저장</Button>}
   </div></PrayerDisclosure>
 return <section className="it-card it-stack it-request-actions">
  {pending?<form onSubmit={e=>e.preventDefault()}><fieldset disabled={busy} className="it-stack">
   <h2>{r.share?'어떻게 함께 기도할까요?':'팀에서 함께 기도해요'}</h2>
   {r.share&&r.anonymous&&<span className="it-meta">전체 공유 시 이름 비공개</span>}
   {editor}
   <div className="it-actions">
    {r.share?<><Button type="button" variant="secondary" disabled={!valid} loading={busy} onClick={()=>onSave({...form,publish:false,completed:false},'accept')}><Lock size={15}/>팀에서만 기도</Button><Button type="button" disabled={!valid} loading={busy} onClick={()=>onSave({...form,publish:true,completed:false},'accept')}><Globe size={15}/>전체에 공유</Button></>:<Button type="button" disabled={!valid} loading={busy} onClick={()=>onSave({...form,publish:false,completed:false},'accept')}><Check size={16}/>확인하고 기도하기</Button>}
   </div>
  </fieldset></form>:<>
   <div className="it-row"><h2>{completed?'지난 기도제목':'현재 기도제목'}</h2><span className="it-meta">{sharingName(r)}</span></div>
   <Button disabled={busy} loading={busy} variant={completed?'secondary':'primary'} onClick={()=>onSave({...saved,completed:!completed},completed?'resume':'complete')}>
    {completed?<RotateCcw size={16}/>:<History size={16}/>} {completed?'다시 기도하기':'지난 기도제목으로 이동'}
   </Button>
   <form onSubmit={e=>{e.preventDefault();if(valid)onSave(form,'edit')}}><fieldset disabled={busy}>{editor}</fieldset></form>
  </>}
 </section>
}
