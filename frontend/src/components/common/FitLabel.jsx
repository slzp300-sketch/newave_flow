import { useLayoutEffect, useRef } from 'react'
import { observeLabel } from '../../utils/labelFitter'

// Wrap first. Only compact labels may shrink, never body text or input fields.
// At the minimum size the label grows to more lines instead of clipping.
export default function FitLabel({ children, className = '', maxLines = 2 }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    return observeLabel(el, maxLines)
  }, [children, maxLines])
  return <span ref={ref} data-fit-label="true" className={`min-w-0 block flex-1 whitespace-normal break-keep [overflow-wrap:anywhere] ${className}`} style={{ lineHeight: 1.4 }}>{children}</span>
}
