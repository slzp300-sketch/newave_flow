import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, Users, FileText, Calendar, CheckSquare,
  CalendarCheck, Sparkles, CheckCircle2, MapPin,
  BookOpen, ClipboardList, Clock, Bell, LayoutGrid,
  ArrowUpRight, TrendingUp, UserMinus as UserMinusIcon
} from 'lucide-react'
import useAuthStore from '../store/authStore'
import { reportsApi } from '../api/reports'
import { evangelismApi } from '../api/evangelism'
import { eventApi } from '../api/event'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { ttsApi } from '../api/tts'
import { prayerVoteApi } from '../api/prayerVote'
import { deactivationApi } from '../api/students'
import { 
  formatDate, toApiDate, greetingByTime, getTTSWeekRange, 
  getCurrentWeekRange, canSubmitTTS 
} from '../utils/date'
import { startOfWeek, endOfWeek, format, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'

export default function Home() {
  const { user }  = useAuthStore()
  const navigate  = useNavigate()
  const today     = toApiDate()
  const isTeacher = user?.role === 'TEACHER'

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
        <motion.div
          animate={{ rotate: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl"
        />
        
        <p className="text-primary-100/80 text-sm font-bold tracking-wide uppercase relative flex items-center gap-2">
          <Sparkles size={14} /> {greetingByTime()}
        </p>
        <h2 className="text-white text-3xl font-black mt-2 relative tracking-tight">
          {user?.name}님, <br/>반가워요!
        </h2>
        <div className="mt-6 flex items-center justify-between relative">
          <p className="text-primary-100/60 text-xs font-medium tracking-widest">{formatDate(new Date())}</p>
          <RoleBadge role={user?.role} />
        </div>
      </motion.div>

      <div className="px-4 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {isTeacher
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

// ────────── Admin View (Dashboard) ──────────
function AdminView({ navigate, today }) {
  const [weeklyEvents, setWeeklyEvents] = useState([])
  
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['deactivation-requests-pending'],
    queryFn: () => deactivationApi.getPending().then(r => r.data),
    staleTime: 60 * 1000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['report-summary', today],
    queryFn:  () => reportsApi.getSummary(today).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

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

  const submitRate = data?.totalTeachers
    ? Math.round((data.submitted / data.totalTeachers) * 100)
    : 0

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="flex flex-col gap-5"
    >


      {/* Management Menu Navigation Card */}
      <Card 
        onClick={() => navigate('/admin')}
        className="p-6 bg-gray-900 border-none shadow-xl active:scale-[0.98] transition-all relative overflow-hidden group"
      >
        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-white">
           <LayoutGrid size={120} />
        </div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/10">
              <LayoutGrid size={22} />
            </div>
            <div>
              <p className="text-white font-black text-lg">전체 행정 관리 메뉴</p>
              <p className="text-white/40 text-xs font-bold mt-0.5">교육부서 모든 설정 및 데이터 관리</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
             <ArrowUpRight size={18} />
          </div>
        </div>
      </Card>

      <SectionLabel>부서 일정</SectionLabel>

      <Card onClick={() => navigate('/admin/calendar')} className="p-5 bg-gradient-to-br from-rose-50 to-orange-50/50 border-rose-100 group">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-rose-500 shadow-sm">
              <Bell size={16} />
            </div>
            <p className="text-sm font-black text-gray-900">이번 주 주요 일정</p>
          </div>
          <ChevronRight size={16} className="text-rose-300 group-hover:translate-x-1 transition-transform" />
        </div>
        
        <div className="flex flex-col gap-2.5">
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
      
      {/* Urgent Follow-up */}
      {!isLoading && data?.notSubmitted?.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
             <SectionLabel>Urgent Follow-up</SectionLabel>
             <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md">{data.notSubmitted.length}명 미제출</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {data.notSubmitted.slice(0, 3).map(t => (
              <Card key={t.teacherId} className="flex items-center gap-3 py-3 px-4 border-l-4 border-l-red-400">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-[11px] font-black">{t.teacherName[0]}</div>
                <div className="flex-1">
                   <p className="text-sm font-bold text-gray-700">{t.teacherName}</p>
                   <p className="text-[10px] font-medium text-gray-400">{t.className}</p>
                </div>
                <Badge variant="danger" className="text-[9px] px-2 py-1">보고서 미작성</Badge>
              </Card>
            ))}
            {data.notSubmitted.length > 3 && (
              <button 
                onClick={() => navigate('/admin/tts')}
                className="text-center text-[10px] text-gray-400 font-bold mt-1 hover:text-primary-500 transition-colors"
                >
                외 {data.notSubmitted.length - 3}명 더 있음 (상세 보기)
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">{children}</p>
}