import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  BookOpen, FileText, Calendar, CheckSquare,
  Users, ClipboardList, UserCheck, MapPin,
  GraduationCap, ChevronDown
} from 'lucide-react'
import Header from '../components/layout/Header'

const MENU_GROUPS = [
  {
    title: '모임 및 회의 관리',
    icon: FileText,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    desc: '기도모임, 교사회의, 회의록, 일정',
    items: [
      { to: '/admin/prayer',            icon: BookOpen,      iconBg: 'bg-amber-50',   iconColor: 'text-amber-600',   title: '기도모임 관리',  desc: '불참 명단 및 필사 제출 현황' },
      { to: '/admin/meeting-attendance',icon: Users,         iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    title: '교사회의 관리',  desc: '토요일 교사회의 참석 현황' },
      { to: '/admin/minutes',           icon: FileText,      iconBg: 'bg-violet-50',  iconColor: 'text-violet-600',  title: '회의록 관리',    desc: '교사 회의록 작성 및 공개 설정' },
      { to: '/admin/calendar',          icon: Calendar,      iconBg: 'bg-rose-50',    iconColor: 'text-rose-600',    title: '일정 관리',      desc: '월별 부서 일정 등록 및 수정' },
    ],
  },
  {
    title: '출석 및 활동 관리',
    icon: CheckSquare,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    desc: '주간 출석, 행사 출석, TTS, 전도',
    items: [
      { to: '/admin/student-attendance',icon: ClipboardList, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', title: '출석 관리',      desc: '주차별 학년/반/학생 출석 현황' },
      { to: '/admin/event-attendance',  icon: ClipboardList, iconBg: 'bg-sky-50',     iconColor: 'text-sky-600',     title: '행사 출석 관리', desc: '행사별 반 학생 출석 현황 확인' },
      { to: '/admin/tts',               icon: CheckSquare,   iconBg: 'bg-teal-50',    iconColor: 'text-teal-600',    title: 'TTS 점검 관리', desc: '주간 TTS 질문 항목 및 제출 현황' },
      { to: '/admin/evangelism',        icon: MapPin,        iconBg: 'bg-primary-50', iconColor: 'text-primary-600', title: '전도 관리',      desc: '전도 조 편성 및 일정 관리' },
    ],
  },
  {
    title: '학생 및 반 관리',
    icon: GraduationCap,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    desc: '아이 명단, 반 담임/부담임 배정',
    items: [
      { to: '/admin/students',          icon: GraduationCap, iconBg: 'bg-teal-50',    iconColor: 'text-teal-600',    title: '아이 관리',              desc: '전체 아이 명단 및 반 배정 관리' },
      { to: '/admin/class-assignment',  icon: UserCheck,     iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600',  title: '반 담임/부담임 배정',    desc: '가입된 교사를 학년/반에 배정' },
    ],
  },
]

export default function ExecutiveManagePage() {
  const [openGroup, setOpenGroup] = useState(null)

  const toggleGroup = (title) => {
    setOpenGroup(prev => prev === title ? null : title)
  }

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="관리 메뉴" />

      <div className="px-4 py-5 flex flex-col gap-4">
        {MENU_GROUPS.map((group, idx) => {
          const isOpen = openGroup === group.title
          const GroupIcon = group.icon

          return (
            <motion.div
              key={group.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(group.title)}
                className="w-full flex items-center justify-between p-5 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className={`w-12 h-12 rounded-2xl ${group.bg} flex items-center justify-center flex-shrink-0`}>
                    <GroupIcon size={24} className={group.color} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900">{group.title}</h3>
                    <p className="text-[11px] font-medium text-gray-400 mt-0.5">{group.desc}</p>
                  </div>
                </div>
                <div className={`p-2 rounded-full transition-transform duration-300 ${isOpen ? 'rotate-180 bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                  <ChevronDown size={18} />
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            className="flex items-center gap-4 p-3.5 rounded-2xl border border-gray-50 bg-gray-50/50 hover:bg-gray-100/80 active:scale-[0.98] transition-all group"
                          >
                            <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                              <ItemIcon size={18} className={item.iconColor} />
                            </div>
                            <div className="flex-1">
                              <p className="font-black text-gray-800 text-sm">{item.title}</p>
                              <p className="text-[10px] text-gray-500 font-medium mt-0.5">{item.desc}</p>
                            </div>
                            <span className="text-gray-300 text-lg group-hover:text-gray-500 transition-colors">›</span>
                          </Link>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
