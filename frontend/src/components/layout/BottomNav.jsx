import { Link, useLocation } from 'react-router-dom'
import { Home } from 'lucide-react'
import { navigationSection } from '../../utils/navigation'
import { LayoutGroup, motion } from 'framer-motion'
import { useMotionPreference } from '../common/Motion'
import FeatureIcon from '../common/FeatureIcon'

// All roles share three tabs; feature and management menus live on Home.
const navItems = [
  { to: '/',         label: '홈' },
  { to: '/calendar', label: '일정' },
  { to: '/profile',  label: '내 정보' },
]

export default function BottomNav() {
  const reduced = useMotionPreference()
  const activeSection = navigationSection(useLocation().pathname)
  return (
    <nav aria-label="주요 메뉴" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-200 safe-bottom z-30 print:hidden">
      <LayoutGroup id="primary-navigation"><ul className="flex">
        {navItems.map(({ to, label }) => {
          const isActive = to === activeSection
          return (
          <li key={to} className="flex-1">
            <Link
              to={to}
              aria-current={isActive ? 'location' : undefined}
              className={
                `brand-nav-link motion-tap relative isolate flex min-h-[68px] flex-col justify-center items-center py-2 gap-1 text-xs font-medium
                ${isActive ? 'text-secondary-800' : 'text-gray-500'}`
              }
            >
                <>
                  {isActive && <motion.span aria-hidden="true" layoutId="active-tab" initial={false}
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 34 }}
                    className="brand-nav-indicator absolute inset-1 -z-10 rounded-xl" />}
                  <motion.span animate={{ y: !reduced && isActive ? -1 : 0, scale: !reduced && isActive ? 1.06 : 1 }}>
                    {to === '/' ? <Home size={22} strokeWidth={isActive ? 2 : 1.7} aria-hidden="true" /> : <FeatureIcon path={to} size={22} />}
                  </motion.span>
                  <span>{label}</span>
                </>
            </Link>
          </li>
        )})}
      </ul></LayoutGroup>
    </nav>
  )
}
