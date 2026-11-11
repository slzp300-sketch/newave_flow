import { useEffect, useRef } from 'react'
import { useMotionPreference } from '../components/common/Motion'

export default function useReportFocus(root, request, ready = true) {
  const consumed = useRef(null)
  const reduced = useMotionPreference()
  useEffect(() => {
    if (!ready || !request || consumed.current === request.serial || !root.current) return
    const container = root.current
    const subject = request.subjectId && [...container.querySelectorAll('[data-report-subject]')].find(el => el.dataset.reportSubject === request.subjectId)
    const scope = subject || container
    const field = request.field && [...scope.querySelectorAll('[data-report-field]')].find(el => el.dataset.reportField === request.field)
    const target = field || scope
    // Open the outer section and the student's own editor before focusing it.
    for (let node = target; node; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true
    const frame = requestAnimationFrame(() => {
      consumed.current = request.serial
      const control = field?.querySelector('input:not([aria-hidden="true"]),textarea,button[role="combobox"],select:not([aria-hidden="true"])') || target
      if (!control.hasAttribute('tabindex') && !control.matches('input,textarea,button,select')) control.tabIndex = -1
      control.focus({ preventScroll:true })
      target.scrollIntoView({ block:'center', behavior:reduced ? 'instant' : 'smooth' })
      target.classList.add('wr-focus-target')
    })
    const timer = setTimeout(() => target.classList.remove('wr-focus-target'), 2200)
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); target.classList.remove('wr-focus-target') }
  }, [request, ready, reduced, root])
}
