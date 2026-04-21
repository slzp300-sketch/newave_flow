import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Users, FileText, Calendar, BookOpen, CheckSquare, UserCog, ClipboardList, UserMinus, GraduationCap, Baby } from 'lucide-react'
import Header from '../components/layout/Header'

const MENU = [
  {
    to: '/admin/students',
    icon: Baby,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    title: '아이 관리',
    desc: '전체 아이 명단 및 반 배정 관리',
  },
  {
    to: '/admin/class-assignment',
    icon: GraduationCap,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: '반 담임/부담임 배정',
    desc: '가입된 교사를 학년/반에 배정',
  },
  {
    to: '/admin/teachers',
    icon: UserCog,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: '교사 권한 관리',
    desc: '일반/임원 교사 권한 부여 및 관리',
  },
  {
    to: '/admin/evangelism',
    icon: Users,
    iconBg: 'bg-primary-50',
    iconColor: 'text-primary-600',
    title: '전도 관리',
    desc: '전도 조 편성 및 일정 관리',
  },
  {
    to: '/admin/minutes',
    icon: FileText,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    title: '회의록 관리',
    desc: '교사 회의록 작성 및 공개 설정',
  },
  {
    to: '/admin/calendar',
    icon: Calendar,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    title: '일정 관리',
    desc: '월별 부서 일정 등록 및 수정',
  },
  {
    to: '/admin/prayer',
    icon: BookOpen,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: '기도모임 관리',
    desc: '불참 명단 및 필사 제출 현황',
  },
  {
    to: '/admin/tts',
    icon: CheckSquare,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'TTS 점검 관리',
    desc: '주간 TTS 질문 항목 및 제출 현황',
  },
  {
    to: '/admin/event-attendance',
    icon: ClipboardList,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-600',
    title: '행사 출석 관리',
    desc: '행사별 반 학생 출석 현황 확인',
  },
  {
    to: '/admin/deactivation-requests',
    icon: UserMinus,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
    title: '제적 승인 관리',
    desc: '교사가 신청한 제적 요청 검토',
  },
]

export default function AdminDashboard() {
  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="관리자 메뉴" showBack />

      <div className="px-4 py-5 flex flex-col gap-3">
        {MENU.map(({ to, icon: Icon, iconBg, iconColor, title, desc }, idx) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
          >
            <Link
              to={to}
              className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
            >
              <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={22} className={iconColor} />
              </div>
              <div>
                <p className="font-black text-gray-900 text-sm">{title}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">{desc}</p>
              </div>
              <span className="ml-auto text-gray-200 text-lg">›</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
