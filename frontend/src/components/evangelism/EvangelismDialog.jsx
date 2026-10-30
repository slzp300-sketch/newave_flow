import { useId, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
export default function EvangelismDialog({title,children,onClose,busy=false}) {
 const ref=useRef(null),heading=useRef(null),id=useId()
 useLayoutEffect(()=>{
  const node=ref.current,previous=document.activeElement,overflow=document.body.style.overflow
  const position={left:window.scrollX,top:window.scrollY,behavior:'instant'}
  node.showModal();document.body.style.overflow='hidden';window.scrollTo(position);heading.current?.focus({preventScroll:true})
  return ()=>{node.close();document.body.style.overflow=overflow;window.scrollTo(position);if(previous?.isConnected)previous.focus({preventScroll:true})}
 },[])
 return createPortal(<dialog ref={ref} className="ev-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();if(!busy)onClose()}}>
  <header><h2 ref={heading} tabIndex={-1} id={id}>{title}</h2><button type="button" aria-label={title+' 닫기'} disabled={busy} onClick={onClose}><X size={22}/></button></header>
  <div className="ev-dialog-body">{children}</div>
 </dialog>,document.body)
}
