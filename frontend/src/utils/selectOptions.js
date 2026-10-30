import { Children, Fragment, isValidElement } from 'react'

const optionText = children => Children.toArray(children).map(child =>
  isValidElement(child) ? optionText(child.props.children) : String(child)).join('')

// Preserve React's conditional/array options and native option text/value rules.
export function selectOptions(children) {
  const options = []
  Children.forEach(children, child => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) options.push(...selectOptions(child.props.children))
    else if (child.type === 'option') {
      const label = (child.props.label ?? optionText(child.props.children)).replace(/\s+/g, ' ').trim()
      options.push({ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled })
    }
  })
  return options
}
