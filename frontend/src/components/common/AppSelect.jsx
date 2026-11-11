import { useId, useRef, useState } from 'react'
import CompactSelect from './CompactSelect'
import { selectOptions } from '../../utils/selectOptions'

// The native control retains form values, required validation and React change events.
// Only CompactSelect is visible and keyboard-focusable.
export default function AppSelect({ children, className = '', id, value, onChange, onInvalid, ...props }) {
  const generatedId = useId(), native = useRef(null), control = useRef(null)
  const [invalid, setInvalid] = useState(false)
  const controlId = id || generatedId, errorId = controlId + '-error'
  const options = selectOptions(children)
  const selectedValue = options.some(option => option.value === String(value)) ? value : options[0]?.value
  const choose = next => {
    if (!native.current || native.current.matches(':disabled')) return
    native.current.value = next
    native.current.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const invalidInput = event => {
    onInvalid?.(event)
    event.preventDefault()
    setInvalid(true)
    const firstInvalid = Array.from(native.current.form?.elements || []).find(element => element.willValidate && !element.validity.valid)
    if (!firstInvalid || firstInvalid === native.current) control.current?.focus()
  }
  return <span className={'app-select ' + className}>
    <select {...props} ref={native} id={controlId + '-native'} value={value} tabIndex={-1} aria-hidden="true"
      className="app-select-native" data-app-select-native="" onInvalid={invalidInput}
      onChange={event => { setInvalid(false); onChange?.(event) }}>{children}</select>
    <CompactSelect id={controlId} controlRef={control} value={selectedValue} options={options} onChange={choose}
      disabled={props.disabled} required={props.required} invalid={invalid || props['aria-invalid']}
      ariaLabel={props['aria-label']} labelledBy={props['aria-labelledby']}
      describedBy={[props['aria-describedby'], invalid ? errorId : ''].filter(Boolean).join(' ') || undefined} />
    {invalid && <span id={errorId} className="app-select-error">항목을 선택해주세요.</span>}
  </span>
}
