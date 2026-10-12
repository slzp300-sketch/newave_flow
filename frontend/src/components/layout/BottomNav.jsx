import { Link, useLocation } from 'react-router-dom'
import { Home, LayoutGrid, Calendar, User, ListChecks } from 'lucide-react'
import { navigationSection } from '../../utils/navigation'
import { LayoutGroup, motion } from 'framer-motion'
import { useMotionPreference } from '../common/Motion'

// 모든 권한 공통 하단 탭 (관리 화면은 '전체' 탭 안에 카드로 들어 있음)
const navItems = [
  { to: '/',         icon: Home,       label: '홈' },
  { to: '/checklist', icon: ListChecks, label: '체크' },
  { to: '/calendar', icon: Calendar,   label: '일정' },
  { to: '/menu',     icon: LayoutGrid, label: '전체' },
  { to: '/profile',  icon: User,       label: '내 정보' },
]

export default function BottomNav() {
  const reduced = useMotionPreference()
  const activeSection = navigationSection(useLocation().pathname)
  return (
    <nav aria-label="주요 메뉴" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-200 safe-bottom z-30 print:hidden">
      <LayoutGroup id="primary-navigation"><ul className="flex">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === activeSection
          return (
          <li key={to} className="flex-1">
            <Link
              to={to}
              aria-current={isActive ? 'location' : undefined}
              className={
                `brand-action motion-tap relative isolate flex min-h-[68px] flex-col justify-center items-center py-2 gap-1 text-xs font-medium
                ${isActive ? 'text-primary-600' : 'text-gray-500'}`
              }
            >
                <>
                  {isActive && <motion.span aria-hidden="true" layoutId="active-tab" initial={false}
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 34 }}
                    className="brand-nav-indicator absolute inset-x-2 top-1.5 h-8 -z-10 rounded-full bg-primary-100" />}
                  <motion.span animate={{ y: !reduced && isActive ? -1 : 0, scale: !reduced && isActive ? 1.06 : 1 }}>
                    <Icon size={22} strokeWidth={isActive ? 2 : 1.7} />
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
