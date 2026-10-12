import { NavLink } from 'react-router-dom'
import { Home, LayoutGrid, Calendar, User } from 'lucide-react'
import { LayoutGroup, motion } from 'framer-motion'
import { useMotionPreference } from '../common/Motion'

// 모든 권한 공통 하단 탭 (관리 화면은 '전체' 탭 안에 카드로 들어 있음)
const navItems = [
  { to: '/',         icon: Home,       label: '홈' },
  { to: '/menu',     icon: LayoutGrid, label: '전체' },
  { to: '/calendar', icon: Calendar,   label: '캘린더' },
  { to: '/profile',  icon: User,       label: '마이' },
]

export default function BottomNav() {
  const reduced = useMotionPreference()
  return (
    <nav aria-label="주요 메뉴" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-200 safe-bottom z-30 print:hidden">
      <LayoutGroup id="primary-navigation"><ul className="flex">
        {navItems.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `motion-tap relative isolate flex min-h-[68px] flex-col justify-center items-center py-2 gap-1 text-xs font-medium
                ${isActive ? 'text-primary-600' : 'text-gray-500'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span aria-hidden="true" layoutId="active-tab" initial={false}
                    transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 34 }}
                    className="absolute inset-x-2 inset-y-1.5 -z-10 rounded-2xl bg-primary-50" />}
                  <motion.span animate={{ y: !reduced && isActive ? -1 : 0, scale: !reduced && isActive ? 1.06 : 1 }}>
                    <Icon size={22} strokeWidth={isActive ? 2 : 1.7} />
                  </motion.span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul></LayoutGroup>
    </nav>
  )
}
