import { NavLink } from 'react-router-dom'
import { Home, ClipboardList, Calendar, BarChart2, BookOpen, User } from 'lucide-react'
import useAuthStore from '../../store/authStore'

const teacherNav = [
  { to: '/',          icon: Home,          label: '홈' },
  { to: '/roster',    icon: BookOpen,      label: '교적부' },
  { to: '/checklist', icon: ClipboardList, label: '주간 체크' },
  { to: '/calendar',  icon: Calendar,      label: '캘린더' },
  { to: '/profile',   icon: User,          label: '마이' },
]

const executiveNav = [
  { to: '/',           icon: Home,          label: '홈' },
  { to: '/roster',     icon: BookOpen,      label: '교적부' },
  { to: '/checklist',  icon: ClipboardList, label: '주간 체크' },
  { to: '/executive',  icon: BarChart2,     label: '관리' },
  { to: '/profile',    icon: User,          label: '마이' },
]

const adminNav = [
  { to: '/',        icon: Home,      label: '홈' },
  { to: '/roster',  icon: BookOpen,  label: '교적부' },
  { to: '/admin',   icon: BarChart2, label: '관리' },
  { to: '/calendar',icon: Calendar,  label: '캘린더' },
  { to: '/profile', icon: User,      label: '마이' },
]

export default function BottomNav() {
  const { user } = useAuthStore()
  const navItems =
    user?.role === 'EXECUTIVE' ? executiveNav :
    user?.role === 'TEACHER'   ? teacherNav   : adminNav

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 safe-bottom z-10">
      <ul className="flex">
        {navItems.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-2.5 gap-0.5 text-xs font-medium transition-colors
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
