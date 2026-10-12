import { useNavigate } from 'react-router-dom'
import { Reveal } from '../components/common/Motion'
import {
  ClipboardList, CheckSquare, Users, CalendarCheck, ListChecks,
  Calendar, FileText, MapPin, Bell, BookOpen, CheckCircle2, School,
} from 'lucide-react'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import { MENU_GROUPS } from './AdminDashboard'

const COMMON_GROUPS = [
  {
    title: '주간 체크',
    items: [
      { to: '/checklist',      icon: ListChecks,    iconBg: 'bg-primary-50', iconColor: 'text-primary-600', title: '주간 체크 현황' },
      { to: '/attendance',     icon: ClipboardList, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', title: '출석' },
      { to: '/tts',            icon: CheckSquare,   iconBg: 'bg-teal-50',    iconColor: 'text-teal-600',    title: 'TTS' },
      { to: '/meeting/prayer', icon: Users,         iconBg: 'bg-violet-50',  iconColor: 'text-violet-600',  title: '기도모임 투표' },
      { to: '/meeting/sat',    icon: CalendarCheck, iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    title: '교사회의 체크' },
    ],
  },
  {
    title: '모임 및 일정',
    items: [
      { to: '/events',        icon: Calendar, iconBg: 'bg-rose-50',   iconColor: 'text-rose-600',   title: '행사일정' },
      { to: '/minutes',       icon: FileText, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', title: '회의록 및 영상' },
      { to: '/evangelism',    icon: MapPin,   iconBg: 'bg-orange-50', iconColor: 'text-orange-500', title: '전도 로테이션' },
      { to: '/notifications', icon: Bell,     iconBg: 'bg-amber-50',  iconColor: 'text-amber-600',  title: '알림' },
    ],
  },
  {
    title: '학생 및 반 관리',
    items: [
      { to: '/roster',           icon: BookOpen,     iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', title: '교적부' },
      { to: '/class-manage',     icon: School,       iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', title: '반관리' },
      { to: '/event-attendance', icon: CheckCircle2, iconBg: 'bg-sky-50',    iconColor: 'text-sky-600',    title: '행사 출석 체크' },
    ],
  },
]

const ADMIN_ROLES = ['ADMIN', 'PASTOR', 'EXECUTIVE']

// 하단 '전체' 탭: 앱의 모든 화면을 카테고리별 카드로 모아 보여준다
export default function MenuPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const groups = ADMIN_ROLES.includes(user?.role)
    ? [...COMMON_GROUPS, ...MENU_GROUPS.map(g => ({ ...g, title: `관리 · ${g.title}`, admin: true }))]
    : COMMON_GROUPS

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="전체" />

      <div className="px-4 py-4 flex flex-col gap-6">
        {groups.map((group, gi) => (
          <Reveal
            key={group.title}
            delay={Math.min(gi * 0.04, 0.12)}
          >
            <p className={`text-xs font-bold uppercase tracking-widest mb-2.5 px-1 ${group.admin ? 'text-primary-500' : 'text-gray-400'}`}>
              {group.title}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {group.items.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    style={{ '--motion-delay': `${Math.min(index, 5) * 35}ms` }}
                    className="motion-menu-tile motion-tap flex items-center gap-3 text-left bg-white rounded-2xl px-3 py-4 border border-gray-200"
                  >
                    <div className={`w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center`}>
                      <Icon size={20} className="text-primary-700" />
                    </div>
                    <p className="text-xs font-bold text-gray-700 text-left leading-relaxed break-keep">{item.title}</p>
                  </button>
                )
              })}
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
