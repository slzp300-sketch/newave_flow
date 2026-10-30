import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'

const ICONS = [
  ['📖', '말씀'], ['🙏', '기도'], ['⛪', '예배'], ['✝️', '십자가'],
  ['🕊️', '평안'], ['🎵', '찬양'], ['👥', '모임'], ['🤝', '섬김'],
  ['❤️', '사랑'], ['🌱', '성장'], ['✨', '기쁨'], ['🎯', '목표'],
  ['✅', '실천'], ['📝', '기록'], ['📅', '일정'], ['🗂️', '활동'],
  ['🎁', '나눔'], ['💬', '교제'], ['☀️', '아침'], ['🌍', '전도'],
]

export default function TtsIconPicker({ value = '', onChange, label, disabled = false }) {
  const [open, setOpen] = useState(false)
  const selectedLabel = ICONS.find(([icon]) => icon === value)?.[1] || (value ? '기존 아이콘' : '없음')
  return <div className="tts-admin-field">
    <span>아이콘</span>
    <button type="button" className="tts-icon-trigger" aria-label={label + ' 선택'} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
      <span className="tts-icon-current" aria-hidden="true">{value || '—'}</span><span>{selectedLabel}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <IconChoices value={value} label={label} disabled={disabled} onClose={() => setOpen(false)} onSelect={icon => { if (icon !== value) onChange(icon); setOpen(false) }} />}
  </div>
}

function IconChoices({ value, label, disabled, onClose, onSelect }) {
  const dialog = useRef(null), heading = useRef(null), selected = useRef(null), titleId = useId()
  const choices = value && !ICONS.some(([icon]) => icon === value) ? [[value, '기존 아이콘'], ...ICONS] : ICONS
  useLayoutEffect(() => {
    const node = dialog.current, previous = document.activeElement, overflow = document.body.style.overflow
    const position = { left: window.scrollX, top: window.scrollY, behavior: 'instant' }
    node.showModal(); document.body.style.overflow = 'hidden'; window.scrollTo(position)
    ;(selected.current || heading.current)?.focus({ preventScroll: true })
    return () => {
      node.close(); document.body.style.overflow = overflow; window.scrollTo(position)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return createPortal(<dialog ref={dialog} className="tts-admin-dialog tts-icon-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2 ref={heading} tabIndex={-1} id={titleId}>아이콘 선택</h2><button type="button" aria-label="아이콘 선택 닫기" onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
    <div className="tts-admin-dialog-body">
      <div className="tts-icon-options" role="group" aria-label={label}>
        {choices.map(([icon, name]) => <button type="button" key={icon} ref={value === icon ? selected : undefined} disabled={disabled}
          aria-label={name + ' 아이콘'} aria-pressed={value === icon} onClick={() => onSelect(icon)}>
          <span aria-hidden="true">{icon}</span><span>{name}</span>
        </button>)}
      </div>
      <button type="button" className="tts-admin-small-action" ref={!value ? selected : undefined} disabled={disabled} aria-pressed={!value} onClick={() => onSelect('')}>아이콘 없음</button>
    </div>
  </dialog>, document.body)
}
