import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
          <motion.section
            key={group.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.05 }}
          >
            <p className={`text-[11px] font-black uppercase tracking-widest mb-2.5 px-1 ${group.admin ? 'text-primary-500' : 'text-gray-400'}`}>
              {group.title}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className="flex flex-col items-center gap-2 bg-white rounded-2xl px-2 py-4 shadow-sm border border-gray-50 active:scale-95 transition-all"
                  >
                    <div className={`w-11 h-11 ${item.iconBg} rounded-xl flex items-center justify-center`}>
                      <Icon size={20} className={item.iconColor} />
                    </div>
                    <p className="text-[11px] font-black text-gray-700 text-center leading-tight break-keep">{item.title}</p>
                  </button>
                )
              })}
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  )
}
