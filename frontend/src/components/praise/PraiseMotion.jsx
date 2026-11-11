import SaveErrorNotice from '../common/SaveErrorNotice'
import React, {useEffect, useId, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {AnimatePresence, motion, useIsPresent} from 'framer-motion'
import {X} from 'lucide-react'
import Button from '../common/Button'
import {DialogSections} from '../common/DialogActions'
import {SelectionMark, useMotionPreference} from '../common/Motion'
import {installPressFeedback} from '../../utils/pressFeedback'
import './motion.css'

const ease=[.22,1,.36,1]
export function MotionPage({children,...props}){
 const reduced=useMotionPreference()
 return <motion.main {...props} initial={{opacity:reduced?.7:0}} animate={{opacity:1}} transition={{duration:reduced?.12:.22,ease}}>{children}</motion.main>
}

// Completion follows the handler's result. No artificial loading delay is added.
export function ActionButton({children,onClick,successLabel,...props}){
 const [done,setDone]=useState(0),[pending,setPending]=useState(false),[error,setError]=useState(false)
 const timer=useRef(null),mounted=useRef(true),locked=useRef(false)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(timer.current)}},[])
 if(!successLabel)return <Button {...props} onClick={onClick}>{children}</Button>
 const activate=async event=>{
  if(locked.current)return
  locked.current=true;setError(false)
  try{
   let result=onClick?.(event)
   if(result&&typeof result.then==='function'){setPending(true);result=await result}
   if(result===false)return
   if(mounted.current){setDone(n=>n+1);clearTimeout(timer.current);timer.current=setTimeout(()=>setDone(0),1500)}
  }catch{if(mounted.current){setDone(0);setError(true)}}
  finally{locked.current=false;if(mounted.current)setPending(false)}
 }
 return <span className="pt-action-control"><Button {...props} loading={pending} onClick={activate} className={`${props.className||''} ${done?'pt-action-complete':''}`}>
  {done?<span key={done} className="pt-action-result"><SelectionMark size={17}/>{successLabel}</span>:children}
 </Button>{error&&<span className="pt-action-error" role="alert">저장하지 못했습니다. 다시 시도해 주세요.</span>}</span>
}

export function FeedbackToast({notice,onClose,className=''}){
 const reduced=useMotionPreference()
 useEffect(()=>{if(!notice)return;const timer=setTimeout(onClose,4200);return()=>clearTimeout(timer)},[notice?.id,onClose])
 return createPortal(<div className={`pt-toast-layer ${reduced?'motion-reduced':''} ${className}`}><AnimatePresence initial={false}>
  {notice&&<motion.div key={notice.id} className="pt-feedback-toast" role="status" aria-live="polite" aria-atomic="true"
   initial={reduced?{opacity:0}:{opacity:0,y:10,scale:.98}} animate={{opacity:1,y:0,scale:1}}
   exit={reduced?{opacity:0}:{opacity:0,y:5}} transition={{duration:reduced?.12:.24,ease}}>
   <span className="pt-feedback-mark"><SelectionMark size={21}/></span><span>{notice.text}</span><button type="button" aria-label="알림 닫기" onClick={onClose}><X size={17}/></button>
  </motion.div>}
 </AnimatePresence></div>,document.body)
}

export function MotionDialog({title,busy,onClose,children,error,className='',footer}){
 const reduced=useMotionPreference(),present=useIsPresent(),dialog=useRef(null),heading=useRef(null),id=useId()
 useEffect(()=>{
  const node=dialog.current,previous=document.activeElement,overflow=document.body.style.overflow
  node.showModal();document.body.style.overflow='hidden';heading.current?.focus({preventScroll:true})
  const dispose=installPressFeedback(node)
  return()=>{dispose();node.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true})}
 },[])
 return createPortal(<motion.dialog ref={dialog} className={`officer-dialog pt-motion-dialog ui-dialog-shell app-motion ${reduced?'motion-reduced':''} ${className}`} aria-labelledby={id}
  data-exiting={!present||undefined} inert={present?undefined:''} onCancel={e=>{e.preventDefault();if(!busy&&present)onClose()}}
  initial={reduced?{opacity:0}:{opacity:0,y:14,scale:.985}} animate={{opacity:1,y:0,scale:1}}
  exit={reduced?{opacity:0}:{opacity:0,y:8,scale:.99}} transition={{duration:reduced?.12:.2,ease}}>
  <DialogSections footer={<><SaveErrorNotice error={error}/>{footer&&<div className="ui-dialog-actions">{footer}</div>}</>}>
   <header><h2 id={id} ref={heading} tabIndex={-1}>{title}</h2><button type="button" className="icon-button" aria-label="닫기" disabled={busy||!present} onClick={onClose}><X size={20}/></button></header>
   <div className="officer-dialog-body ui-dialog-body">{children}</div>
  </DialogSections>
 </motion.dialog>,document.body)
}

function GroupPanel({children}){
 const reduced=useMotionPreference(),present=useIsPresent()
 return <motion.div data-praise-collapse="true" aria-hidden={present?undefined:true} inert={present?undefined:''}
  initial={reduced?{opacity:0,height:'auto'}:{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={reduced?{opacity:0,height:'auto'}:{opacity:0,height:0}}
  transition={{duration:reduced?.1:.22,ease}} style={{overflow:'hidden'}}>{children}</motion.div>
}
export function GroupCollapse({open,children}){
 return <AnimatePresence initial={false}>{open&&<GroupPanel>{children}</GroupPanel>}</AnimatePresence>
}

export function MotionCheck({checked,...props}){
 return <span className="pt-check-control"><input {...props} type="checkbox" checked={checked}/><span className="pt-check-visual" aria-hidden="true">{checked&&<SelectionMark size={14}/>}</span></span>
}
