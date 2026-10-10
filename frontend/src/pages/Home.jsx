import { eventRangeKey } from '../api/queryPolicy'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, Users, FileText, Calendar, CheckSquare,
  CheckCircle2,
  BookOpen, ClipboardList, Clock, Bell, LayoutGrid,
  ArrowUpRight, TrendingUp, UserMinus, Megaphone,
  UserPlus, UserCog, GraduationCap, UserCheck,
  Settings2, Plus, X, Trash2, ShieldCheck
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import { reportsApi } from '../api/reports'
import { eventApi } from '../api/event'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { ttsApi } from '../api/tts'
import { deactivationApi } from '../api/students'
import { adminUsersApi } from '../api/adminUsers'
import { 
  toApiDate, getTTSWeekRange, 
  canSubmitTTS, getWeekStartByOffset
} from '../utils/date'
import { startOfWeek, endOfWeek, format, startOfMonth, endOfMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import { parseAnswer, calcScore, CheckTab } from './TTSPage'

export default function Home() {
  const { user }    = useAuthStore()
  const navigate    = useNavigate()
  const today       = toApiDate()
  const isTeacher   = user?.role === 'TEACHER'
  const isExecutive = user?.role === 'EXECUTIVE'

  return (
    <div className="flex flex-col min-h-screen pb-12 bg-gray-50/50">
      {/* 로그인한 사람 + 직분은 헤더 오른쪽에 작게 */}
      <Header
        title="Newave Flow"
        showLogout={true}
        right={
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-black text-gray-700 truncate max-w-[5.5rem]">{user?.name}님</span>
            <RoleBadge role={user?.role} />
            {isExecutive && (
              <button
                onClick={() => navigate('/admin')}
                className="p-1.5 rounded-xl bg-primary-50 text-primary-600 active:scale-95 transition-all"
                aria-label="관리자 모드"
              >
                <ShieldCheck size={14} />
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 mt-1 flex flex-col gap-4">
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
    TEACHER:   ['교사', 'bg-primary-50 text-primary-600'],
    EXECUTIVE: ['임원', 'bg-emerald-50 text-emerald-600'],
    PASTOR:    ['목사님', 'bg-violet-50 text-violet-600'],
    ADMIN:     ['관리자', 'bg-gray-900 text-white shadow-sm']
  }
  const [label, cls] = map[role] ?? ['사용자', 'bg-gray-100 text-gray-500']
  return <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-lg flex-shrink-0 ${cls}`}>{label}</span>
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

// ────────── 내 영성체크 대시보드 (모든 권한 공통) ──────────
function PersonalDashboard({ navigate }) {
  const weeklyStatus = useWeeklyStatus()

  const sunday    = getWeekStartByOffset(0, 0)
  const weekStart = toApiDate(sunday)

  // TTS 화면과 같은 캐시를 써서, 체크하고 돌아오면 바로 반영된다
  const { data: questions = [] } = useQuery({
    queryKey: ['tts-questions'],
    queryFn: () => ttsApi.getQuestions().then(r => r.data),
  })
  const { data: week } = useQuery({
    queryKey: ['tts-week', weekStart],
    queryFn: () => ttsApi.getWeek(weekStart).then(r => r.data),
    staleTime: 60 * 1000,
  })

  const answers = useMemo(() => {
    const map = {}
    ;(week?.answers || []).forEach(a => {
      const q = questions.find(x => x.id === a.questionId)
      if (q) map[a.questionId] = parseAnswer(q, a.answerData)
    })
    return map
  }, [week, questions])

  const linked = useMemo(() => {
    const map = {}
    ;(week?.linked || []).forEach(l => { map[l.questionId] = l.checked })
    return map
  }, [week])

  const score    = calcScore(questions, answers, linked)

  // 기도모임·교사회의는 위 '예배 · 모임'에서 보이므로 출석·TTS만
  const todos = [
    { to: '/attendance', icon: ClipboardList, label: '출석', done: weeklyStatus.attendanceSubmittedThisWeek },
    { to: '/tts',        icon: CheckSquare,   label: 'TTS',  done: score > 0 },
  ]

  return (
    <>
      {/* 이번 주 영성체크: 홈에서 바로 체크 (TTS 화면과 같은 부품) */}
      <CheckTab embedded />

      {/* 이번 주 할 일: 칩 한 줄 */}
      <Card className="flex items-center gap-2">
        <p className="flex-1 text-sm font-black text-gray-900">이번 주 할 일</p>
        {todos.map(t => {
          const Icon = t.done ? CheckCircle2 : t.icon
          return (
            <button
              key={t.to}
              onClick={() => navigate(t.to)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[11px] font-black active:scale-95 transition-all ${
                t.done ? 'bg-emerald-50/60 border-emerald-100 text-emerald-700' : 'bg-gray-50/60 border-gray-100 text-gray-500'
              }`}
            >
              <Icon size={14} className={t.done ? 'text-emerald-500' : 'text-gray-400'} />
              {t.label}
            </button>
          )
        })}
      </Card>
    </>
  )
}

// ────────── 이번 주 주요 일정 ──────────
function WeeklyEventsCard({ navigate }) {
  const { data: weeklyEvents = [] } = useQuery({
    queryKey: ['weekly-events', toApiDate(startOfWeek(new Date(), { weekStartsOn: 0 }))],
    queryFn: async () => {
      const start = toApiDate(startOfWeek(new Date(), { weekStartsOn: 0 }))
      const end = toApiDate(endOfWeek(new Date(), { weekStartsOn: 0 }))
      const res = await client.get(`/events?from=${start}&to=${end}`)
      return res.data
    },
    staleTime: 5 * 60 * 1000,
  })

  return (
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
          weeklyEvents.slice(0, 3).map(e => {
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
  )
}

// ────────── Teacher View ──────────
function TeacherView({ navigate }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4"
    >
      <PersonalDashboard navigate={navigate} />
      <WeeklyEventsCard navigate={navigate} />
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
    queryKey: eventRangeKey(toApiDate(startOfMonth(new Date())), toApiDate(endOfMonth(new Date()))),
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
      {/* 내 영성체크 */}
      <div className="flex flex-col gap-4">
        <PersonalDashboard navigate={navigate} />
      </div>

      <SectionLabel>관리 요약</SectionLabel>

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
                onClick={() => navigate('/admin/student-attendance')}
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
