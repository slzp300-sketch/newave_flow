import { createContext, useContext, forwardRef, useId, useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, useSyncExternalStore } from 'react'
import { AnimatePresence, MotionConfig, motion, useIsPresent } from 'framer-motion'

import { createDisclosureScroll, DISCLOSURE_SECONDS, disclosureEase } from '../../utils/disclosureScroll'
import { installPressFeedback } from '../../utils/pressFeedback'
import { motionPreferenceStore, FEEDBACK_SECONDS } from '../../utils/motionPreference'

const MotionPreference = createContext(null)
const DisclosureScroll = createContext(null)
const ease = [0.22, 1, 0.36, 1]
const useSystemMotionPreference = () => useSyncExternalStore(motionPreferenceStore.subscribe, motionPreferenceStore.getSnapshot, () => false)

export function AppMotion({ children, reducedMotion }) {
  const rootRef = useRef(null)
  const disclosureScroll = useMemo(createDisclosureScroll, [])
  useEffect(() => disclosureScroll.connect(rootRef.current), [disclosureScroll])
  useEffect(() => installPressFeedback(rootRef.current), [])
  const systemPreference = useSystemMotionPreference()
  const reduced = reducedMotion ?? systemPreference ?? false
  return (
    <MotionPreference.Provider value={reduced}>
      <DisclosureScroll.Provider value={disclosureScroll}><MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ duration: reduced ? FEEDBACK_SECONDS : 0.32, ease }}>
        <div ref={rootRef} className={reduced ? 'contents app-motion motion-reduced' : 'contents app-motion'}>{children}</div>
      </MotionConfig></DisclosureScroll.Provider>
    </MotionPreference.Provider>
  )
}

export function useMotionPreference() {
  const context = useContext(MotionPreference)
  const systemPreference = useSystemMotionPreference()
  return context ?? systemPreference ?? false
}

// One disclosure motion for forms, details and lists. Closed content is unmounted
// after the exit so hidden inputs never remain in the keyboard focus order.
export const Collapse = forwardRef(function Collapse({ open, children, className = '', ...props }, ref) {
  return <AnimatePresence initial={false}>
    {open && <CollapsePanel panelRef={ref} {...props}
      className={`overflow-hidden ${className}`}>
      {children}
    </CollapsePanel>}
  </AnimatePresence>
})

export const CollapsePanel = forwardRef(function CollapsePanel({ children, className = '', initial, animate, exit, transition, panelRef, onAnimationComplete, ...props }, ref) {
  const reduced = useMotionPreference()
  const present = useIsPresent()
  const coordinator = useContext(DisclosureScroll)
  const node = useRef(null), session = useRef(null), close = useRef(null)
  const bind = useCallback(element => {
    node.current = element
    for (const target of [panelRef, ref]) {
      if (typeof target === 'function') target(element)
      else if (target) target.current = element
    }
  }, [panelRef, ref])
  useLayoutEffect(() => {
    if (present) {
      session.current = coordinator?.begin(node.current)
      close.current = null
      if (!reduced) coordinator?.reveal(session.current, node.current, false)
    } else {
      close.current = coordinator?.closing(session.current, node.current)
      if (!reduced) coordinator?.restore(session.current, close.current, false)
    }
  }, [present, reduced, coordinator])
  const complete = definition => {
    if (!reduced) {
      if (present) coordinator?.reveal(session.current, node.current, false)
      else coordinator?.restore(session.current, close.current, false)
    }
    onAnimationComplete?.(definition)
  }
  return <motion.div ref={bind} onAnimationComplete={complete} data-disclosure-panel="true" {...props} inert={present ? undefined : ''} aria-hidden={present ? undefined : true}
    initial={reduced ? { height: 'auto', opacity: 0 } : initial ?? { height: 0, opacity: 0 }}
    animate={reduced ? { height: 'auto', opacity: 1 } : animate ?? { height: 'auto', opacity: 1 }}
    exit={reduced ? { height: 'auto', opacity: 0 } : exit ?? { height: 0, opacity: 0 }}
    transition={reduced ? { duration: FEEDBACK_SECONDS, ease: 'easeOut', height: { duration: 0 } } : { ...transition, duration: DISCLOSURE_SECONDS, ease: disclosureEase }}
    className="min-w-0 overflow-hidden">
    <div className={className}>{children}</div>
  </motion.div>
})

export function Disclosure({ title, children, className = '', defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return <section className={className}>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left text-sm font-semibold">
      <span>{title}</span><span aria-hidden="true" className={`transition-transform duration-[280ms] ease-in-out ${open ? 'rotate-180' : ''}`}>⌄</span>
    </button>
    <Collapse open={open} id={id}>{children}</Collapse>
  </section>
}

// Reveal each section once as it enters view. Never wait for an exit before navigation.
export function Reveal({ children, className = '', delay = 0 }) {
  const reduced = useMotionPreference()
  return <motion.section className={className}
    initial={reduced ? { opacity: 0.65 } : { opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }}
    transition={{ duration: reduced ? FEEDBACK_SECONDS : 0.48, delay: reduced ? 0 : Math.min(delay, 0.2), ease }}>
    {children}
  </motion.section>
}

// Always show the actual value; the animation never counts through fictitious scores.
export function AnimatedValue({ value, className = '' }) {
  const reduced = useMotionPreference()
  return <motion.span key={String(value)} className={`inline-block ${className}`}
    initial={reduced ? { opacity: 0.65 } : { opacity: 0.45, y: 5, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: reduced ? FEEDBACK_SECONDS : 0.3, ease }}>{value}</motion.span>
}

export function ProgressFill({ ratio, className = '' }) {
  const reduced = useMotionPreference()
  const progress = Math.max(0, Math.min(Number(ratio) || 0, 1))
  return <motion.div aria-hidden="true" className={`h-full w-full origin-left rounded-full ${className}`}
    initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: progress }}
    transition={{ duration: reduced ? 0 : 0.55, ease }} />
}

export function SelectionMark({ size = 18, className = '' }) {
  const reduced = useMotionPreference()
  return <motion.svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    className={className} initial={reduced ? { opacity: 0 } : { scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
    transition={reduced ? { duration: FEEDBACK_SECONDS, ease: 'easeOut' } : undefined}>
    <motion.path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
      transition={{ duration: reduced ? 0 : 0.24 }} />
  </motion.svg>
}

export function WaveAccent() {
  return <svg aria-hidden="true" className="motion-wave" viewBox="0 0 240 120" fill="none">
    <path d="M-20 70C30 5 80 130 135 60S225 10 270 40" />
    <path d="M-20 90C30 25 80 150 135 80S225 30 270 60" />
    <path d="M-20 110C30 45 80 170 135 100S225 50 270 80" />
  </svg>
}
