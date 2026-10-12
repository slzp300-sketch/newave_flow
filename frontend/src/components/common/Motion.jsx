import { createContext, useContext } from 'react'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'

const MotionPreference = createContext(null)
const ease = [0.22, 1, 0.36, 1]

export function AppMotion({ children, reducedMotion }) {
  const systemPreference = useReducedMotion()
  const reduced = reducedMotion ?? systemPreference ?? false
  return (
    <MotionPreference.Provider value={reduced}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ duration: reduced ? 0 : 0.32, ease }}>
        <div className={reduced ? 'contents motion-reduced' : 'contents'}>{children}</div>
      </MotionConfig>
    </MotionPreference.Provider>
  )
}

export function useMotionPreference() {
  const context = useContext(MotionPreference)
  const systemPreference = useReducedMotion()
  return context ?? systemPreference ?? false
}

// Reveal each section once as it enters view. Never wait for an exit before navigation.
export function Reveal({ children, className = '', delay = 0 }) {
  const reduced = useMotionPreference()
  return <motion.section className={className}
    initial={reduced ? false : { opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }}
    transition={{ duration: reduced ? 0 : 0.48, delay: reduced ? 0 : Math.min(delay, 0.2), ease }}>
    {children}
  </motion.section>
}

// Always show the actual value; the animation never counts through fictitious scores.
export function AnimatedValue({ value, className = '' }) {
  const reduced = useMotionPreference()
  return <motion.span key={String(value)} className={`inline-block ${className}`}
    initial={reduced ? false : { opacity: 0.45, y: 5, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: reduced ? 0 : 0.3, ease }}>{value}</motion.span>
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
    className={className} initial={reduced ? false : { scale: 0.7 }} animate={{ scale: 1 }}>
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
