import FitLabel from './FitLabel'
import { useId } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { useMotionPreference } from './Motion'

/** Native buttons keep keyboard focus and selection available without custom tab-key handling. */
export default function SegmentedControl({ label, value, onChange, options, disabled = false, selectedClassName = 'text-primary-800' }) {
  const id = useId()
  const reduced = useMotionPreference()
  return (
    <LayoutGroup id={id}>
      <div role="group" aria-label={label} className="ui-segments">
        {options.map(option => (
          <button key={option.value} type="button" aria-pressed={value === option.value}
            disabled={disabled || option.disabled} onClick={() => onChange(option.value)}
            className={`motion-tap relative isolate min-w-0 flex-1 min-h-11 rounded-xl px-2 py-2 text-sm font-semibold disabled:opacity-40 ${value === option.value ? selectedClassName : 'text-gray-500'}`}>
            {value === option.value && <motion.span aria-hidden="true" layoutId={reduced ? undefined : 'selection'} initial={reduced ? { opacity: 0 } : false} animate={{ opacity: 1 }}
              transition={reduced ? { duration: 0.16, ease: 'easeOut' } : { type: 'spring', stiffness: 430, damping: 34 }}
              className="brand-selection absolute inset-0 -z-10 rounded-xl shadow-sm" />}
            <FitLabel>{option.label}</FitLabel>
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}
