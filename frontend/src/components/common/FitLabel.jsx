import { useLayoutEffect, useRef } from 'react'

// Wrap first. Only compact labels may shrink, never body text or input fields.
// At the minimum size the label grows to more lines instead of clipping.
export default function FitLabel({ children, className = '', maxLines = 2 }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0, last = '', disposed = false
    const fit = () => {
      const base = parseFloat(getComputedStyle(el.parentElement).fontSize)
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const width = el.getBoundingClientRect().width
      if (!width) return
      const signature = `${width}:${base}:${rootSize}:${el.textContent}`
      if (signature === last) return
      last = signature
      const floor = Math.min(base, Math.max(rootSize * .875, base * .85))
      let size = base
      el.style.fontSize = `${size}px`
      while (size > floor && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > size * 1.4 * maxLines + 1)) {
        size = Math.max(floor, size - .5)
        el.style.fontSize = `${size}px`
      }
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit) }
    fit()
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    const mutation = new MutationObserver(schedule)
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
    const afterFonts = () => { if (!disposed) { last = ''; schedule() } }
    document.fonts?.ready.then(afterFonts)
    document.fonts?.addEventListener('loadingdone', afterFonts)
    window.addEventListener('resize', schedule)
    const afterFontTransition = event => { if (event.target === document.documentElement && event.propertyName === 'font-size') schedule() }
    document.documentElement.addEventListener('transitionend', afterFontTransition)
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); mutation.disconnect()
      window.removeEventListener('resize', schedule)
      document.fonts?.removeEventListener('loadingdone', afterFonts)
      document.documentElement.removeEventListener('transitionend', afterFontTransition)
    }
  }, [children, maxLines])
  return <span ref={ref} data-fit-label="true" className={`min-w-0 block flex-1 whitespace-normal break-keep [overflow-wrap:anywhere] ${className}`} style={{ lineHeight: 1.4 }}>{children}</span>
}
