import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {DialogSections} from '../common/DialogActions'
export default function OfficerDialog({ title, busy, onClose, children }) {
  const dialog = useRef(null), heading = useRef(null), id = useId()
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow, node = dialog.current
    node.showModal(); document.body.style.overflow = 'hidden'; heading.current?.focus({ preventScroll: true })
    return () => { node.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={dialog} className="officer-dialog ui-dialog-shell" aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!busy) onClose() }}><DialogSections>
    <header><h2 id={id} ref={heading} tabIndex={-1}>{title}</h2><button type="button" className="icon-button" aria-label="닫기" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <div className="officer-dialog-body ui-dialog-body">{children}</div>
  </DialogSections></dialog>, document.body)
}
