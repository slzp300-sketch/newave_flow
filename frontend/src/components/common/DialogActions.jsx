import {createContext,useContext,useState} from 'react'
import {createPortal} from 'react-dom'
import './DialogActions.css'

const ActionTarget=createContext(null)

// Keep actions outside the scrolling content without moving form fields.
// Submit buttons rendered here must retain an explicit form association.
export function DialogSections({children,footer}){
 const [target,setTarget]=useState(null)
 return <ActionTarget.Provider value={target}>{children}<div ref={setTarget} className="ui-dialog-footer">{footer}</div></ActionTarget.Provider>
}

export default function DialogActions({children,className='',...props}){
 const target=useContext(ActionTarget)
 const actions=<div {...props} className={'ui-dialog-actions '+className}>{children}</div>
 return target?createPortal(actions,target):actions
}
