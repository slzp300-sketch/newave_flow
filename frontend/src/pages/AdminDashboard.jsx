import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Users, FileText, Calendar, BookOpen, CheckSquare,
  UserCog, ClipboardList, UserMinus, GraduationCap,
  UserPlus, UserCheck, Bell, ChevronRight, Megaphone
} from 'lucide-react'
import { motion } from 'framer-motion'
import Header from '../components/layout/Header'
import client from '../api/client'
import { adminUsersApi } from '../api/adminUsers'
import useAuthStore from '../store/authStore'
import { toApiDate } from '../utils/date'

const QUICK_LINKS = [
  { to: '/admin/pending-users', icon: UserPlus,     label: '가입 승인',  bg: 'bg-amber-50',   color: 'text-amber-600',   badge: true },
  { to: '/admin/teachers',      icon: UserCog,      label: '교사 관리',  bg: 'bg-indigo-50',  color: 'text-indigo-600'  },
  { to: '/admin/students',      icon: GraduationCap,label: '아이 관리',  bg: 'bg-teal-50',    color: 'text-teal-600'    },
  { to: '/admin/class-assignment',icon: UserCheck,  label: '반 배정',    bg: 'bg-blue-50',    color: 'text-blue-600'    },
  { to: '/admin/student-attendance', icon: ClipboardList, label: '출석 현황', bg: 'bg-emerald-50', color: 'text-emerald-600' },
  { to: '/admin/event-attendance',   icon: CheckSquare,   label: '행사 출석', bg: 'bg-sky-50',     color: 'text-sky-600'    },
  { to: '/admin/calendar',      icon: Calendar,     label: '일정 관리',  bg: 'bg-rose-50',    color: 'text-rose-500'    },
  { to: '/admin/meeting-attendance', icon: Users,   label: '교사회의',   bg: 'bg-blue-50',    color: 'text-blue-600'    },
  { to: '/admin/prayer',        icon: BookOpen,     label: '기도모임',   bg: 'bg-amber-50',   color: 'text-amber-600'   },
  { to: '/admin/minutes',       icon: FileText,     label: '회의록',     bg: 'bg-violet-50',  color: 'text-violet-600'  },
  { to: '/admin/tts',           icon: CheckSquare,  label: 'TTS 점검',   bg: 'bg-teal-50',    color: 'text-teal-600'    },
  { to: '/admin/deactivation-requests', icon: UserMinus, label: '제적 승인', bg: 'bg-rose-50', color: 'text-rose-500'   },
]

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const today = new Date()

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => adminUsersApi.getPending().then(r => r.data),
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => client.get('/users/teachers').then(r => r.data),
  })

  const { data: events = [] } = useQuery({
    queryKey: ['events', format(today, 'yyyy-MM')],
    queryFn: () => client.get('/events', {
      params: {
        from: toApiDate(startOfMonth(today)),
        to:   toApiDate(endOfMonth(today)),
      }
    }).then(r => r.data),
  })

  const upcomingEvents = events
    .filter(e => new Date(e.eventDate) >= today)
    .slice(0, 3)

  const STATS = [
    { label: '승인 대기',    value: pendingUsers.length, bg: 'bg-amber-50',   color: 'text-amber-600',   icon: Bell       },
    { label: '전체 교사',    value: teachers.length,     bg: 'bg-indigo-50',  color: 'text-indigo-600',  icon: Users      },
    { label: '이번 달 일정', value: events.length,       bg: 'bg-rose-50',    color: 'text-rose-500',    icon: Calendar   },
    { label: '예정 일정',    value: upcomingEvents.length, bg: 'bg-emerald-50', color: 'text-emerald-600', icon: Megaphone },
  ]

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="관리자 대시보드" />

      <div className="px-4 py-5 flex flex-col gap-6">

        {/* 웰컴 배너 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-5 text-white shadow-lg shadow-primary-100"
        >
          <p className="text-primary-200 text-xs font-bold">
            {format(today, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
          </p>
          <h2 className="text-xl font-black mt-1">
            안녕하세요, {user?.name}님 👋
          </h2>
          <p className="text-primary-200 text-sm mt-0.5">오늘도 수고 많으십니다.</p>

          {pendingUsers.length > 0 && (
            <Link
              to="/admin/pending-users"
              className="mt-3 flex items-center gap-2 bg-white/20 hover:bg-white/30 active:bg-white/10 rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition-all"
            >
              <Bell size={14} />
              승인 대기 {pendingUsers.length}명이 있습니다
              <ChevronRight size={14} className="ml-auto" />
            </Link>
          )}
        </motion.div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 gap-3">
          {STATS.map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50"
              >
                <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon size={16} className={stat.color} />
                </div>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] font-bold text-gray-400 mt-0.5">{stat.label}</p>
              </motion.div>
            )
          })}
        </div>

        {/* 바로가기 */}
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">바로가기</p>
          <div className="grid grid-cols-4 gap-2.5">
            {QUICK_LINKS.map((link, i) => {
              const Icon = link.icon
              const showBadge = link.badge && pendingUsers.length > 0
              return (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    to={link.to}
                    className="relative flex flex-col items-center gap-1.5 bg-white rounded-2xl p-3 shadow-sm border border-gray-50 active:scale-95 hover:shadow-md transition-all"
                  >
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[9px] text-white font-black flex items-center justify-center px-1">
                        {pendingUsers.length}
                      </span>
                    )}
                    <div className={`w-10 h-10 ${link.bg} rounded-xl flex items-center justify-center`}>
                      <Icon size={18} className={link.color} />
                    </div>
                    <p className="text-[10px] font-black text-gray-600 text-center leading-tight">{link.label}</p>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* 이번 달 예정 일정 */}
        {upcomingEvents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">예정 일정</p>
              <Link to="/admin/calendar" className="text-[11px] font-bold text-primary-500">전체보기 →</Link>
            </div>
            <div className="flex flex-col gap-2">
              {upcomingEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50 flex items-center gap-3"
                >
                  <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar size={16} className="text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-gray-800 truncate">{event.title}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                      {event.startTime && ` · ${event.startTime}`}
                    </p>
                  </div>
                  {event.attendanceRequired && (
                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex-shrink-0">
                      출석
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
