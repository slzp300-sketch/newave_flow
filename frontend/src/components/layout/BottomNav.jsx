import { NavLink } from 'react-router-dom'
import { Home, LayoutGrid, Calendar, User } from 'lucide-react'

// 모든 권한 공통 하단 탭 (관리 화면은 '전체' 탭 안에 카드로 들어 있음)
const navItems = [
  { to: '/',         icon: Home,       label: '홈' },
  { to: '/menu',     icon: LayoutGrid, label: '전체' },
  { to: '/calendar', icon: Calendar,   label: '캘린더' },
  { to: '/profile',  icon: User,       label: '마이' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 safe-bottom z-10">
      <ul className="flex">
        {navItems.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors whitespace-nowrap overflow-hidden
                ${isActive ? 'text-primary-600' : 'text-gray-400'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
