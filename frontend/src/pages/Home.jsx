import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, Users, FileText, Calendar, CheckSquare,
  CalendarCheck, Sparkles, CheckCircle2, MapPin,
  BookOpen, ClipboardList, Clock, Bell, LayoutGrid,
  ArrowUpRight, TrendingUp, UserMinus, Megaphone,
  UserPlus, UserCog, GraduationCap, UserCheck,
  Settings2, Plus, X, Trash2, ShieldCheck
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import { reportsApi } from '../api/reports'
import { evangelismApi } from '../api/evangelism'
import { eventApi } from '../api/event'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { ttsApi } from '../api/tts'
import { prayerVoteApi } from '../api/prayerVote'
import { deactivationApi } from '../api/students'
import { adminUsersApi } from '../api/adminUsers'
import { 
  formatDate, toApiDate, greetingByTime, getTTSWeekRange, 
  getCurrentWeekRange, canSubmitTTS 
} from '../utils/date'
import { startOfWeek, endOfWeek, format, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'

export default function Home() {
  const { user }    = useAuthStore()
  const navigate    = useNavigate()
  const today       = toApiDate()
  const isTeacher   = user?.role === 'TEACHER'
  const isExecutive = user?.role === 'EXECUTIVE'

  return (
    <div className="flex flex-col min-h-screen pb-12 bg-gray-50/50">
      <Header title="Newave Flow" showLogout={true} />

      {/* 프리미엄 그라데이션 배너 */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="mx-4 mt-2 mb-6 rounded-[2rem] p-8 premium-gradient relative overflow-hidden shadow-glow"
      >
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 80% 20%, white 1.5px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        
        <p className="text-primary-100/80 text-sm font-bold tracking-wide uppercase relative flex items-center gap-2">
          <Sparkles size={14} /> {greetingByTime()}
        </p>
        <h2 className="text-white text-3xl font-black mt-2 relative tracking-tight">
          {user?.name}님, <br/>반가워요!
        </h2>
        <div className="mt-6 flex items-center justify-between relative">
          <p className="text-primary-100/60 text-xs font-medium tracking-widest">{formatDate(new Date())}</p>
          <div className="flex items-center gap-2">
            {isExecutive && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl tracking-widest bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
              >
                <ShieldCheck size={12} />
                관리자 모드
              </button>
            )}
            <RoleBadge role={user?.role} />
          </div>
        </div>
      </motion.div>

      <div className="px-4 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {(isTeacher || isExecutive)
            ? <TeacherView key="teacher" navigate={navigate} />
            : <AdminView  key="admin"   navigate={navigate} today={today} />
          }
        </AnimatePresence>
      </div>
    </div>
  )
}

function RoleBadge({ role }) {
  const map = { 
    TEACHER:   ['교사', 'bg-white/20 text-white'], 
    EXECUTIVE: ['임원', 'bg-emerald-400/80 text-white'], 
    PASTOR:    ['목사님', 'bg-white text-primary-700 shadow-sm'],
    ADMIN:     ['관리자', 'bg-gray-900 text-white shadow-sm']
  }
  const [label, cls] = map[role] ?? ['사용자', 'bg-white/20 text-white']
  return <span className={`text-[10px] uppercase font-black px-3 py-1.5 rounded-xl tracking-widest ${cls}`}>{label}</span>
}

// ────────── Hooks ──────────
function useTTSSubmitted() {
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => {
    const { weekNum } = getTTSWeekRange()
    const year = new Date().getFullYear()
    const key  = `tts_${year}_week${weekNum}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const parsed = JSON.parse(saved)
      setSubmitted(!!parsed.submitted)
    }
  }, [])
  return submitted
}

function useWeeklyStatus() {
  const { data } = useQuery({
    queryKey: ['weekly-status'],
    queryFn: () => weeklyStatusApi.getStatus().then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  return data ?? { attendanceSubmittedThisWeek: false, unconfirmedMinutesCount: 0 }
}

function useMeetingChecked() {
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    const { weekNum } = getTTSWeekRange()
    const year = new Date().getFullYear()
    const prayer = localStorage.getItem(`prayer_vote_${year}_w${weekNum}`)
    const sat    = localStorage.getItem(`sat_meeting_${year}_w${weekNum}`)
    const p = prayer ? JSON.parse(prayer).submitted === true : false
    const s = sat    ? JSON.parse(sat).submitted    === true : false
    setChecked(p && s)
  }, [])
  return checked
}

function useAttendanceRequiredEvents() {
  const { data = [] } = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  return data
}

function useEvangelismStatus() {
  const { data } = useQuery({
    queryKey: ['evangelism-status'],
    queryFn: () => evangelismApi.getMyStatus().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  return data ?? null
}

// ────────── Teacher View ──────────
function TeacherView({ navigate }) {
  const [weeklyEvents, setWeeklyEvents] = useState([])
  const [openGroup, setOpenGroup] = useState(null)
  
  const evangelism    = useEvangelismStatus()
  const weeklyStatus  = useWeeklyStatus()
  const { user: authUser } = useAuthStore()

  const { weekNum: ttsWeekNum } = getTTSWeekRange()
  const currentYear = new Date().getFullYear()

  const { data: ttsRecord } = useQuery({
    queryKey: ['tts-my', currentYear, ttsWeekNum],
    queryFn: () => ttsApi.getMyTts(currentYear, ttsWeekNum).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  // 기도모임 투표 완료 여부
  const weekMonday = (() => {
    const now = new Date(); const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const m = new Date(now); m.setDate(now.getDate() + diff)
    return format(m, 'yyyy-MM-dd')
  })()
  const { data: prayerVoteData } = useQuery({
    queryKey: ['prayer-vote', weekMonday, authUser?.id],
    queryFn:  () => prayerVoteApi.getMine(weekMonday).then(r => r.data),
    enabled:  !!authUser,
    staleTime: 5 * 60 * 1000,
  })

  // 교사회의 체크 완료 여부
  const satDate = format(addDays(new Date(weekMonday), 5), 'yyyy-MM-dd')
  const { data: satData } = useQuery({
    queryKey: ['meeting-attendance', satDate, authUser?.id],
    queryFn:  () => client.get(`/meetings/attendance?date=${satDate}`).then(r => r.data),
    enabled:  !!authUser,
    staleTime: 5 * 60 * 1000,
  })

  const attendanceDone = weeklyStatus.attendanceSubmittedThisWeek
  const ttsDone        = ttsRecord?.submitted ?? false
  const prayerDone     = !!prayerVoteData
  const satDone        = !!satData?.status

  useEffect(() => {
    fetchWeeklyEvents()
  }, [])

  const fetchWeeklyEvents = async () => {
    try {
      const start = toApiDate(startOfWeek(new Date(), { weekStartsOn: 0 }))
      const end = toApiDate(endOfWeek(new Date(), { weekStartsOn: 0 }))
      const res = await client.get(`/events?from=${start}&to=${end}`)
      setWeeklyEvents(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const isEvangelismActive = evangelism?.nextSchedule?.status === 'ACTIVE'

  const TEACHER_GROUPS = [
    {
      title: '주간 필수 보고',
      icon: CheckSquare,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      desc: '출석체크, TTS, 주간모임',
      items: [
        { to: '/attendance',      icon: ClipboardList, iconBg: 'bg-emerald-50',  iconColor: 'text-emerald-600', title: '출석',        desc: '주일 예배 반 학생 출석체크', done: attendanceDone },
        { to: '/tts',             icon: CheckSquare,   iconBg: 'bg-teal-50',     iconColor: 'text-teal-600',    title: 'TTS',         desc: 'Teacher Training Sheet 작성', done: ttsDone },
        { to: '/meeting/prayer',  icon: Users,         iconBg: 'bg-violet-50',   iconColor: 'text-violet-600',  title: '기도모임 투표', desc: '온라인 기도모임 참석 투표 (월~목)', done: prayerDone },
        { to: '/meeting/sat',     icon: CalendarCheck, iconBg: 'bg-blue-50',     iconColor: 'text-blue-600',    title: '교사회의 체크', desc: '토요일 교사 회의 참석 여부 제출', done: satDone },
        ...(satData?.status === 'ABSENT' ? [{
          to: '/minutes',
          icon: FileText,
          iconBg: weeklyStatus.currentWeekMinutesConfirmed ? 'bg-emerald-50' : 'bg-violet-50',
          iconColor: weeklyStatus.currentWeekMinutesConfirmed ? 'text-emerald-600' : 'text-violet-600',
          title: '회의록 및 영상',
          desc: weeklyStatus.currentWeekMinutesConfirmed
            ? '이번 주 회의록 확인 완료'
            : weeklyStatus.currentWeekMinutesExists
              ? '이번 주 회의록 확인이 필요합니다'
              : '⚠️ 이번 주 회의록이 아직 업로드되지 않았습니다',
          done: weeklyStatus.currentWeekMinutesConfirmed,
          disabled: !weeklyStatus.currentWeekMinutesExists,
        }] : []),
      ]
    },
    {
      title: '모임 및 일정',
      icon: Calendar,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      desc: '행사일정, 회의록, 전도 로테이션',
      items: [
        { to: '/events', icon: Calendar, iconBg: 'bg-rose-50', iconColor: 'text-rose-600', title: '행사일정', desc: '등록된 교회 주요 행사 확인' },
        { to: '/minutes', icon: FileText, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', title: '회의록 및 영상', desc: '교사 회의록 확인 및 영상 시청' },
        { 
          to: '/evangelism', icon: MapPin, 
          iconBg: isEvangelismActive ? 'bg-red-50' : 'bg-orange-50', 
          iconColor: isEvangelismActive ? 'text-red-600' : 'text-orange-500', 
          title: '전도 로테이션', desc: '전도 조 편성 및 일정 확인' 
        },
      ]
    },
    {
      title: '학생 및 반 관리',
      icon: BookOpen,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      desc: '반 관리, 행사 출석 체크',
      items: [
        { to: '/class-manage', icon: BookOpen, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', title: '반관리', desc: '학생 정보 수정 및 재적/제적 관리' },
        { to: '/event-attendance', icon: CheckCircle2, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', title: '행사 출석 체크', desc: '행사별 학생 출석체크 및 관리' },
      ]
    }
  ]

  const toggleGroup = (title) => {
    setOpenGroup(prev => prev === title ? null : title)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Weekly Summary</p>
        <p className="text-[10px] font-bold text-gray-400">{getCurrentWeekRange()}</p>
      </div>

      {/* 이번 주 일정 요약 */}
      <Card onClick={() => navigate('/events')} className="p-5 bg-gradient-to-br from-rose-50 to-orange-50/50 border-rose-100 group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm">
              <Bell size={16} />
            </div>
            <p className="text-sm font-black text-gray-900">이번 주 주요 일정</p>
          </div>
          <ChevronRight size={16} className="text-rose-300 group-hover:translate-x-1 transition-transform" />
        </div>

        <div className="flex flex-col gap-2">
          {weeklyEvents.length === 0 ? (
            <p className="text-xs text-gray-400 font-bold py-2">이번 주 예정된 일정이 없습니다.</p>
          ) : (
            weeklyEvents.slice(0, 2).map(e => {
              const dotColor = {
                blue: 'bg-blue-500',
                red: 'bg-red-500',
                emerald: 'bg-emerald-500',
                violet: 'bg-violet-500',
                amber: 'bg-amber-400',
                rose: 'bg-rose-500',
                indigo: 'bg-indigo-500',
              }[e.color] || 'bg-primary-500'

              return (
                <div key={e.id} className="flex items-center gap-3 bg-white/40 p-2.5 rounded-xl border border-white/60">
                  <span className={`w-1 h-3 rounded-full ${dotColor}`} />
                  <p className="text-xs font-black text-gray-700 truncate">{e.title}</p>
                  <span className="text-[10px] font-bold text-gray-400 ml-auto">
                    {format(new Date(e.eventDate), 'EEE', { locale: ko })}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between px-1 mt-2">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Quick Menu</p>
      </div>

      {TEACHER_GROUPS.map((group, idx) => {
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
                <motion.div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </motion.div>
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
                        <button
                          key={item.to}
                          onClick={() => { if (!item.disabled) navigate(item.to) }}
                          disabled={item.disabled}
                          className={`flex items-center gap-4 p-3.5 rounded-2xl border transition-all group text-left w-full ${
                            item.disabled
                              ? 'border-gray-100 bg-gray-50/30 opacity-50 cursor-not-allowed'
                              : item.done
                                ? 'bg-emerald-50/60 border-emerald-100 active:scale-[0.98]'
                                : 'border-gray-50 bg-gray-50/50 hover:bg-gray-100/80 active:scale-[0.98]'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                            <ItemIcon size={18} className={item.iconColor} />
                          </div>
                          <div className="flex-1">
                            <p className="font-black text-gray-800 text-sm">{item.title}</p>
                            <p className="text-[10px] text-gray-500 font-medium mt-0.5">{item.desc}</p>
                          </div>
                          {item.done
                            ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                            : <span className="text-gray-300 text-lg group-hover:text-gray-500 transition-colors">›</span>
                          }
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

const ALL_QUICK_LINKS = [
  { to: '/admin/student-attendance', icon: ClipboardList, label: '출석 현황', bg: 'bg-emerald-50', color: 'text-emerald-600' },
  { to: '/admin/event-attendance',   icon: CheckSquare,   label: '행사 출석', bg: 'bg-sky-50',     color: 'text-sky-600'    },
  { to: '/admin/calendar',      icon: Calendar,     label: '일정 관리',  bg: 'bg-rose-50',    color: 'text-rose-500'    },
  { to: '/admin/meeting-attendance', icon: Users,   label: '교사회의',   bg: 'bg-blue-50',    color: 'text-blue-600'    },
  { to: '/admin/prayer',        icon: BookOpen,     label: '기도모임',   bg: 'bg-amber-50',   color: 'text-amber-600'   },
  { to: '/admin/minutes',       icon: FileText,     label: '회의록',     bg: 'bg-violet-50',  color: 'text-violet-600'  },
  { to: '/admin/tts',           icon: CheckSquare,  label: 'TTS 점검',   bg: 'bg-teal-50',    color: 'text-teal-600'    },
  { to: '/admin/pending-users', icon: UserPlus,     label: '가입 승인',  bg: 'bg-amber-50',   color: 'text-amber-600',   badge: true },
  { to: '/admin/teachers',      icon: UserCog,      label: '교사 관리',  bg: 'bg-indigo-50',  color: 'text-indigo-600'  },
  { to: '/admin/students',      icon: GraduationCap,label: '아이 관리',  bg: 'bg-teal-50',    color: 'text-teal-600'    },
  { to: '/admin/class-assignment',icon: UserCheck,  label: '반 배정',    bg: 'bg-blue-50',    color: 'text-blue-600'    },
  { to: '/admin/deactivation-requests', icon: UserMinus, label: '제적 승인', bg: 'bg-rose-50', color: 'text-rose-500'   },
]

// ────────── Admin View (Dashboard) ──────────
function AdminView({ navigate, today }) {
  const [selectedPaths, setSelectedPaths] = useState(() => {
    const saved = localStorage.getItem('admin_quick_links')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) { console.error(e) }
    }
    return [
      '/admin/student-attendance',
      '/admin/event-attendance',
      '/admin/calendar',
      '/admin/meeting-attendance',
      '/admin/prayer',
      '/admin/minutes',
      '/admin/tts'
    ]
  })
  const [isEditingLinks, setIsEditingLinks] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)

  const activeLinks = selectedPaths
    .map(path => ALL_QUICK_LINKS.find(link => link.to === path))
    .filter(Boolean)

  const unselectedLinks = ALL_QUICK_LINKS.filter(link => !selectedPaths.includes(link.to))

  const handleRemoveLink = (path) => {
    const newPaths = selectedPaths.filter(p => p !== path)
    setSelectedPaths(newPaths)
    localStorage.setItem('admin_quick_links', JSON.stringify(newPaths))
  }

  const handleAddLink = (path) => {
    if (selectedPaths.length >= 9) return
    const newPaths = [...selectedPaths, path]
    setSelectedPaths(newPaths)
    localStorage.setItem('admin_quick_links', JSON.stringify(newPaths))
    setShowLinkModal(false)
  }
  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => adminUsersApi.getPending().then(r => r.data),
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => client.get('/users/teachers').then(r => r.data),
  })

  const { data: monthEvents = [] } = useQuery({
    queryKey: ['events', format(new Date(), 'yyyy-MM')],
    queryFn: () => client.get('/events', {
      params: {
        from: toApiDate(startOfMonth(new Date())),
        to:   toApiDate(endOfMonth(new Date())),
      }
    }).then(r => r.data),
  })

  const upcomingEvents = monthEvents
    .filter(e => new Date(e.eventDate) >= new Date())
    .slice(0, 3)

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['report-summary', today],
    queryFn:  () => reportsApi.getSummary(today).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const STATS = [
    { label: '승인 대기',    value: pendingUsers.length, bg: 'bg-amber-50',   color: 'text-amber-600',   icon: Bell       },
    { label: '전체 교사',    value: teachers.length,     bg: 'bg-indigo-50',  color: 'text-indigo-600',  icon: Users      },
    { label: '이번 달 일정', value: monthEvents.length,  bg: 'bg-rose-50',    color: 'text-rose-500',    icon: Calendar   },
    { label: '예정 일정',    value: upcomingEvents.length, bg: 'bg-emerald-50', color: 'text-emerald-600', icon: Megaphone },
  ]

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="flex flex-col gap-5"
    >
      {/* 승인 대기 알림 (옵션) */}
      {pendingUsers.length > 0 && (
        <div 
          onClick={() => navigate('/admin/pending-users')}
          className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
        >
          <div className="flex items-center gap-2 text-amber-700">
            <Bell size={16} className="animate-bounce" />
            <span className="text-sm font-black">승인 대기 {pendingUsers.length}명</span>
          </div>
          <ChevronRight size={16} className="text-amber-400" />
        </div>
      )}

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
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex flex-col items-center text-center"
            >
              <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center mb-2`}>
                <Icon size={16} className={stat.color} />
              </div>
              <p className={`text-2xl font-black leading-none ${stat.color}`}>{stat.value}</p>
              <p className="text-[11px] font-bold text-gray-400 mt-1.5">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* 바로가기 */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">바로가기</p>
          <button 
            onClick={() => setIsEditingLinks(!isEditingLinks)}
            className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${
              isEditingLinks ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Settings2 size={12} />
            {isEditingLinks ? '완료' : '수정'}
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2.5">
          <AnimatePresence>
            {activeLinks.map((link, i) => {
              const Icon = link.icon
              const showBadge = link.badge && pendingUsers.length > 0
              return (
                <motion.div
                  key={link.to}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: isEditingLinks ? 0 : i * 0.03 }}
                  className="relative"
                >
                  <button
                    onClick={() => isEditingLinks ? handleRemoveLink(link.to) : navigate(link.to)}
                    className={`w-full flex flex-col items-center gap-1.5 bg-white rounded-2xl p-3 shadow-sm border transition-all ${
                      isEditingLinks ? 'border-red-200 bg-red-50/20 animate-pulse-slow' : 'border-gray-50 active:scale-95 hover:shadow-md'
                    }`}
                  >
                    {!isEditingLinks && showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[9px] text-white font-black flex items-center justify-center px-1 z-10 shadow-sm">
                        {pendingUsers.length}
                      </span>
                    )}
                    {isEditingLinks && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white flex items-center justify-center z-10 shadow-sm shadow-red-200">
                        <Trash2 size={10} />
                      </span>
                    )}
                    <div className={`w-10 h-10 ${link.bg} rounded-xl flex items-center justify-center`}>
                      <Icon size={18} className={link.color} />
                    </div>
                    <p className="text-[10px] font-black text-gray-600 text-center leading-tight truncate w-full">{link.label}</p>
                  </button>
                </motion.div>
              )
            })}
            
            {isEditingLinks && selectedPaths.length < 9 && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="w-full h-full min-h-[84px] flex flex-col items-center justify-center gap-1.5 bg-gray-50/50 rounded-2xl p-3 border-2 border-dashed border-gray-200 active:scale-95 transition-all hover:bg-gray-50 hover:border-gray-300"
                >
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                    <Plus size={18} className="text-gray-400" />
                  </div>
                  <p className="text-[10px] font-black text-gray-400 text-center leading-tight">추가하기</p>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>



      {/* 이번 달 예정 일정 */}
      {upcomingEvents.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">예정 일정</p>
            <button onClick={() => navigate('/admin/calendar')} className="text-[11px] font-bold text-primary-500">전체보기 →</button>
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
      
      {/* Urgent Follow-up */}
      {!reportLoading && reportData?.notSubmitted?.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center justify-between px-1">
             <SectionLabel>Urgent Follow-up</SectionLabel>
             <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md">{reportData.notSubmitted.length}명 미제출</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {reportData.notSubmitted.slice(0, 3).map(t => (
              <Card key={t.teacherId} className="flex items-center gap-3 py-3 px-4 border-l-4 border-l-red-400">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-[11px] font-black">{t.teacherName[0]}</div>
                <div className="flex-1">
                   <p className="text-sm font-bold text-gray-700">{t.teacherName}</p>
                   <p className="text-[10px] font-medium text-gray-400">{t.className}</p>
                </div>
                <Badge variant="danger" className="text-[9px] px-2 py-1">보고서 미작성</Badge>
              </Card>
            ))}
            {reportData.notSubmitted.length > 3 && (
              <button 
                onClick={() => navigate('/admin/tts')}
                className="text-center text-[10px] text-gray-400 font-bold mt-1 hover:text-primary-500 transition-colors"
                >
                외 {reportData.notSubmitted.length - 3}명 더 있음 (상세 보기)
              </button>
            )}
          </div>
        </div>
      )}

      {/* 바로가기 추가 모달 */}
      <AnimatePresence>
        {showLinkModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowLinkModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h3 className="font-black text-gray-900 text-lg">바로가기 추가</h3>
                  <p className="text-[11px] font-bold text-gray-400 mt-0.5">추가할 메뉴를 선택해주세요. (최대 9개)</p>
                </div>
                <button 
                  onClick={() => setShowLinkModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex flex-col gap-2 pb-8 sm:pb-4">
                {unselectedLinks.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-bold text-gray-400">추가할 수 있는 메뉴가 없습니다.</p>
                  </div>
                ) : (
                  unselectedLinks.map(link => {
                    const Icon = link.icon
                    return (
                      <button 
                        key={link.to} 
                        onClick={() => handleAddLink(link.to)} 
                        className="flex items-center gap-4 p-3.5 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] rounded-2xl text-left border border-transparent hover:border-gray-100 transition-all group"
                      >
                        <div className={`w-12 h-12 rounded-xl ${link.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm`}>
                          <Icon size={20} className={link.color}/>
                        </div>
                        <div>
                          <span className="font-black text-sm text-gray-800">{link.label}</span>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">{link.to}</p>
                        </div>
                        <div className="ml-auto w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                           <Plus size={16} />
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">{children}</p>
}