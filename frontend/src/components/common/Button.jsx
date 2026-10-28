import { Children } from 'react'
import FitLabel from './FitLabel'
const variants = {
  primary: 'bg-primary-600 text-white',
  secondary: 'bg-primary-50 text-primary-700 border border-primary-200',
  outline: 'bg-primary-50 text-primary-700 border border-primary-200',
  danger: 'bg-primary-600 text-white',
  ghost: 'bg-primary-50 text-primary-700',
}
const sizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'w-full px-4 py-3.5 text-base',
}
export default function Button({ children, variant = 'primary', size = 'md', className = '', loading = false, disabled = false, ...props }) {
  // React splits interpolated text into adjacent children. Keep the sentence
  // together so each piece does not receive its own flex width and line breaks.
  const content = []
  let text = ''
  const flushText = () => {
    if (text.trim()) content.push(<FitLabel key={`label-${content.length}`}>{text.trim()}</FitLabel>)
    text = ''
  }
  Children.toArray(children).forEach(child => {
    if (typeof child === 'string' || typeof child === 'number') text += child
    else { flushText(); content.push(child) }
  })
  flushText()
  return (
    <button {...props} disabled={loading || disabled} aria-busy={loading || undefined}
      className={`motion-button inline-flex min-w-0 min-h-11 items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {loading && <svg aria-hidden="true" className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>}
      {content}
    </button>
  )
}
