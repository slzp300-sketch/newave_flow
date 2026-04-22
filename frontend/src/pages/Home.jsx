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
import { deactivationApi } from '../api/students'
import { 
  formatDate, toApiDate, greetingByTime, getTTSWeekRange, 
  getCurrentWeekRange, canSubmitTTS 
} from '../utils/date'
import { startOfWeek, endOfWeek, format } from 'date-fns'
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
  const ttsSubmitted          = useTTSSubmitted()
  const weekRange             = getCurrentWeekRange()
  const evangelism            = useEvangelismStatus()
  const attendanceEvents      = useAttendanceRequiredEvents()
  
  const meetingChecked        = useMeetingChecked()
  const weeklyStatus          = useWeeklyStatus()
  const minutesDone           = weeklyStatus.unconfirmedMinutesCount === 0
  const eventAttendanceDone   = attendanceEvents.length === 0 ? true : false

  // 주간 체크 올클리어 판별
  const allWeeklyChecksDone = ttsSubmitted && meetingChecked && weeklyStatus.attendanceSubmittedThisWeek && minutesDone && eventAttendanceDone

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

  const evangelismDesc = (() => {
    if (!evangelism?.nextSchedule) return '배정된 전도 일정을 확인하세요'
    if (evangelism.nextSchedule.status === 'ACTIVE') return '이번 주 전도 당번입니다!'
    const d = Math.ceil((new Date(evangelism.nextSchedule.scheduledDate) - new Date()) / 86400000)
    return `다음 전도까지 D-${Math.max(0, d)}`
  })()

  const isEvangelismActive = evangelism?.nextSchedule?.status === 'ACTIVE'

  const tasks = [
    {
      id: 'weekly-check',
      icon: CheckSquare,
      color: allWeeklyChecksDone ? 'bg-emerald-100 text-emerald-600' : 'bg-primary-50 text-primary-600',
      title: '주간 체크',
      desc: allWeeklyChecksDone ? '이번 주 필수 체크 항목 모두 완료!' : '출석, TTS, 주간 모임 등 필수 항목을 체크하세요',
      done: allWeeklyChecksDone,
      path: '/checklist'
    },
    { id: 'class-manage', icon: BookOpen,     color: 'bg-indigo-50 text-indigo-600', title: '반 관리',   desc: '학생 정보 수정 및 재적/제적 관리',    done: false, path: '/class-manage' },
    {
      id: 'evangelism',
      icon: MapPin,
      color: isEvangelismActive ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-orange-500',
      title: '전도 로테이션',
      desc: evangelismDesc,
      done: false,
      path: '/evangelism',
      badge: isEvangelismActive ? '당번' : null,
    },
    { id: 'events',     icon: Calendar,      color: 'bg-rose-50 text-rose-600',     title: '행사 일정',     desc: '등록된 교회 행사를 확인하세요',     done: false, path: '/events' }
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Weekly Summary</p>
        <p className="text-[10px] font-bold text-gray-400">{weekRange}</p>
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
                <div key={e.id} className="flex items-center gap-3">
                  <span className={`w-1 h-3 rounded-full ${dotColor}`} />
                  <p className="text-xs font-black text-gray-700 truncate">{e.title}</p>
                  <span className="text-[10px] font-bold text-gray-400 ml-auto">
                    {format(new Date(e.eventDate), 'EEE', { locale: ko })}
                  </span>
                </div>
              )
            })
          )}
          {weeklyEvents.length > 2 && (
            <p className="text-[10px] text-rose-400 font-black mt-1">+ {weeklyEvents.length - 2}개의 일정이 더 있습니다</p>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between px-1 mt-2">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tasks</p>
      </div>

      {tasks.map((t, idx) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.1 }}
        >
          <TaskCard {...t} navigate={navigate} />
        </motion.div>
      ))}
    </motion.div>
  )
}

function TaskCard({ icon: Icon, color, title, desc, done, path, navigate, badge }) {
  return (
    <Card
      onClick={() => navigate(path)}
      className="group relative flex items-center justify-between p-5"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 ${color}`}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-black text-gray-900 text-base">{title}</p>
            {badge && (
               <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-red-100 text-red-600">{badge}</span>
            )}
          </div>
          <p className={`text-[11px] font-medium mt-0.5 ${done ? 'text-emerald-500' : 'text-gray-400'}`}>{desc}</p>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2 ml-3">
        {done
          ? <CheckCircle2 size={20} className="text-emerald-500" />
          : <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
        }
      </div>
    </Card>
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
      <SectionLabel>Today's Pulse</SectionLabel>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-5 flex flex-col justify-between h-36 bg-white overflow-hidden relative">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp size={48} className="text-primary-600" />
           </div>
           <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reports</p>
              <p className="text-3xl font-black text-primary-600 tracking-tighter">{submitRate}%</p>
           </div>
           <div className="w-full bg-primary-50 h-2 rounded-full mt-auto overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${submitRate}%` }}
                className="h-full bg-primary-500 rounded-full" 
              />
           </div>
        </Card>

        <div className="grid grid-rows-2 gap-3">
          <Card className="p-4 flex items-center justify-between group">
             <div className="flex flex-col">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teachers</p>
                <p className="text-xl font-black text-gray-900">{data?.totalTeachers ?? '-'}</p>
             </div>
             <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                <Users size={16} />
             </div>
          </Card>
          <Card className="p-4 flex items-center justify-between group">
             <div className="flex flex-col">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending</p>
                <p className="text-xl font-black text-gray-900">{pendingRequests.length}</p>
             </div>
             <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${pendingRequests.length > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400'}`}>
                <UserMinusIcon size={16} />
             </div>
          </Card>
        </div>
      </div>

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