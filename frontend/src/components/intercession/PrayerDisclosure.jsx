import {useId,useState} from 'react'
import {motion} from 'framer-motion'
import {ChevronDown} from 'lucide-react'
import {useMotionPreference} from '../common/Motion'

// Keep form drafts mounted while the panel closes; inert removes hidden fields from keyboard navigation.
export default function PrayerDisclosure({title,icon:Icon,children,defaultOpen=false,disabled=false}){
 const [open,setOpen]=useState(defaultOpen),id=useId(),reduced=useMotionPreference()
 return <section className="it-disclosure" data-open={open}>
  <button type="button" id={id+'-trigger'} className="ui-disclosure-trigger it-disclosure-trigger" aria-expanded={open} aria-controls={id+'-panel'} disabled={disabled} onClick={()=>setOpen(value=>!value)}>
   {Icon&&<span className="it-disclosure-icon" aria-hidden="true"><Icon size={17}/></span>}
   <span className="ui-disclosure-label">{title}</span>
   <ChevronDown size={18} className="ui-disclosure-chevron" aria-hidden="true"/>
  </button>
  <motion.div id={id+'-panel'} role="region" aria-labelledby={id+'-trigger'} aria-hidden={!open} inert={open?undefined:''} className="it-disclosure-panel"
   initial={false} animate={{height:open?'auto':0,opacity:open?1:0}} transition={{duration:reduced?0:.22,ease:[.22,1,.36,1]}}>
   <div className="it-disclosure-content">{children}</div>
  </motion.div>
 </section>
}
