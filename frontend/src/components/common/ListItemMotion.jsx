import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { useMotionPreference } from './Motion'
import { listMotionTiming } from '../../utils/listMotion'

// Stable item keys keep existing rows mounted on refresh and when appending pages.
export default forwardRef(function ListItemMotion({ as = 'div', index, disabledMotion = false, initial, animate, transition, ...props }, ref) {
  const reduced = useMotionPreference()
  const timing = listMotionTiming(index, reduced, disabledMotion)
  const Element = as === 'button' ? motion.button : motion.div
  return <Element {...props} ref={ref} initial={timing.enter ? initial : false} animate={animate}
    transition={{ ...transition, duration: timing.duration, delay: timing.delay }} />
})
