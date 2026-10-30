import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import './CompactSelect.css'

export default function CompactSelect({ id, label, value, options, onChange, disabled = false, placeholder = '선택', controlRef, ariaLabel, labelledBy, describedBy, required = false, invalid = false }) {
  const generatedId = useId(), ownTrigger = useRef(null), menu = useRef(null), search = useRef({ text: '', time: 0 })
  const trigger = controlRef || ownTrigger
  const controlId = id || generatedId, listId = controlId + '-options'
  const [open, setOpen] = useState(false), [active, setActive] = useState(0), [position, setPosition] = useState(null)
  const [fieldsetDisabled, setFieldsetDisabled] = useState(false)
  const blocked = disabled || fieldsetDisabled
  const selected = options.findIndex(option => String(option.value) === String(value))
  const choice = options[selected]
  const available = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0)
  const expanded = open && !blocked && available.length > 0
  useLayoutEffect(() => {
    const node = trigger.current, observer = new MutationObserver(() => {
      const inherited = !!node.closest('fieldset:disabled')
      setFieldsetDisabled(inherited)
      if (inherited) setOpen(false)
    })
    setFieldsetDisabled(!!node.closest('fieldset:disabled'))
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'FIELDSET') observer.observe(ancestor, { attributes: true, attributeFilter: ['disabled'] })
    }
    return () => observer.disconnect()
  }, [trigger])
  const show = () => {
    if (blocked || trigger.current?.matches(':disabled') || !available.length) return
    search.current = { text: '', time: 0 }
    setActive(available.includes(selected) ? selected : available[0]); setPosition(null); setOpen(true)
  }
  const choose = index => {
    if (blocked || trigger.current?.matches(':disabled') || !options[index] || options[index].disabled) return
    onChange(String(options[index].value)); setOpen(false)
    trigger.current?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    if (!expanded) return
    const button = trigger.current, panel = menu.current
    const place = () => {
      const bounds = button.getBoundingClientRect(), viewport = window.visualViewport
      const leftEdge = (viewport?.offsetLeft || 0) + 8, topEdge = (viewport?.offsetTop || 0) + 8
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 16
      const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16
      const width = Math.min(Math.max(bounds.width, 200), rightEdge - leftEdge)
      const below = bottomEdge - bounds.bottom - 6, above = bounds.top - topEdge - 6
      const upwards = below < 240 && above > below
      const maxHeight = Math.max(44, Math.min(280, upwards ? above : below))
      setPosition({ left: Math.max(leftEdge, Math.min(bounds.left, rightEdge - width)), width, maxHeight,
        top: upwards ? undefined : bounds.bottom + 6,
        bottom: upwards ? window.innerHeight - bounds.top + 6 : undefined })
    }
    const outside = event => { if (!button.contains(event.target) && !panel.contains(event.target)) setOpen(false) }
    const scroll = event => { if (!panel.contains(event.target)) setOpen(false) }
    place()
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [expanded])

  useLayoutEffect(() => {
    const panel = menu.current, row = panel?.children[active]
    if (!expanded || !position || !row) return
    // Scroll only the options, never the form beneath them.
    if (row.offsetTop < panel.scrollTop) panel.scrollTop = row.offsetTop
    else if (row.offsetTop + row.offsetHeight > panel.scrollTop + panel.clientHeight) panel.scrollTop = row.offsetTop + row.offsetHeight - panel.clientHeight
  }, [active, expanded, position])

  const keyDown = event => {
    if (blocked || !available.length) return
    if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
    if (event.key === 'Tab') { setOpen(false); return }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!expanded) { show(); if (event.key === 'Home') setActive(available[0]); if (event.key === 'End') setActive(available.at(-1)); return }
      setActive(index => event.key === 'Home' ? available[0] : event.key === 'End' ? available.at(-1) : available[Math.max(0, Math.min(available.length - 1, available.indexOf(index) + (event.key === 'ArrowDown' ? 1 : -1)))])
    } else if ((event.key === 'Enter' || event.key === ' ') && expanded) { event.preventDefault(); choose(active) }
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
      const now = Date.now(), text = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLocaleLowerCase()
      search.current = { text, time: now }
      const index = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(text))
      if (index >= 0) { event.preventDefault(); if (!expanded) show(); setActive(index) }
    }
  }

  const Wrapper = label ? 'div' : 'span'
  return <Wrapper className={'compact-select' + (label ? ' compact-select-field ev-field' : '')}>
    {label && <label id={controlId + '-label'} htmlFor={controlId}>{label}</label>}
    <button ref={trigger} id={controlId} type="button" role="combobox" className="compact-select-trigger"
      aria-label={ariaLabel} aria-labelledby={label ? controlId + '-label' : labelledBy} aria-describedby={describedBy}
      aria-required={required || undefined} aria-invalid={invalid || undefined} aria-expanded={expanded} aria-haspopup="listbox"
      aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded ? listId + '-' + active : undefined}
      disabled={blocked || !available.length} onKeyDown={keyDown} onBlur={() => setOpen(false)} onClick={() => expanded ? setOpen(false) : show()}>
      <span className="compact-select-value">{choice?.label || placeholder}</span>
      {choice?.detail && <span className="compact-select-count">{choice.detail}</span>}
      <ChevronDown size={17} aria-hidden="true" />
    </button>
    {expanded && createPortal(<div ref={menu} id={listId} role="listbox" aria-label={ariaLabel} aria-labelledby={label ? controlId + '-label' : labelledBy}
      className="compact-select-menu" style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
      onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={listId + '-' + index} role="option"
        aria-selected={index === selected} aria-disabled={option.disabled || undefined} data-active={index === active} className="compact-select-option" onClick={() => choose(index)}>
        <span className="compact-select-value">{option.label}</span>
        {option.detail && <span className="compact-select-count">{option.detail}</span>}
        <span className="compact-select-check">{index === selected && <Check size={18} aria-hidden="true" />}</span>
      </div>)}
    </div>, trigger.current?.closest('dialog') || document.body)}
  </Wrapper>
}
