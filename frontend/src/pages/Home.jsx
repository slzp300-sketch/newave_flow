import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Users, FileText, Calendar, CheckSquare, CalendarCheck, Sparkles, CheckCircle2, MapPin, BookOpen, ClipboardList } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { reportsApi } from '../api/reports'
import { evangelismApi } from '../api/evangelism'
import { eventApi } from '../api/event'
import { 
  formatDate, toApiDate, greetingByTime, getTTSWeekRange, 
  getCurrentWeekRange, canSubmitTTS 
} from '../utils/date'
import { startOfWeek, endOfWeek, isSameDay, format } from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import { Clock, Bell } from 'lucide-react'

export default function Home() {
  const { user }  = useAuthStore()
  const navigate  = useNavigate()
  const today     = toApiDate()
  const isTeacher = user?.role === 'TEACHER'

  return (
    <div className="flex flex-col min-h-screen pb-12">
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
    PASTOR:    ['목사님', 'bg-white text-primary-700 shadow-sm'] 
  }
  const [label, cls] = map[role] ?? ['사용자', 'bg-white/20 text-white']
  return <span className={`text-[10px] uppercase font-black px-3 py-1.5 rounded-xl tracking-widest ${cls}`}>{label}</span>
}

// ────────── TTS 제출 여부 확인 ──────────
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


// ────────── 행사 출석 체크 훅 ──────────
function useAttendanceRequiredEvents() {
  const { data = [] } = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  return data
}

// ────────── 전도 상태 훅 ──────────
function useEvangelismStatus() {
  const { data } = useQuery({
    queryKey: ['evangelism-status'],
    queryFn: () => evangelismApi.getMyStatus().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  return data ?? null
}

// ────────── 교사 뷰 ──────────
function TeacherView({ navigate }) {
  const [weeklyEvents, setWeeklyEvents] = useState([])
  const ttsSubmitted          = useTTSSubmitted()
  const weekRange             = getCurrentWeekRange()
  const submissionOpen        = canSubmitTTS()
  const evangelism            = useEvangelismStatus()
  const attendanceEvents      = useAttendanceRequiredEvents()

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
    { id: 'attendance', icon: Users,        color: 'bg-blue-50 text-blue-600',      title: '출석 체크',      desc: '학생들의 출결 현황을 기록하세요',                         done: false, path: '/attendance' },
    {
      id: 'tts',
      icon: CheckSquare,
      color: ttsSubmitted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-50 text-amber-600',
      title: 'TTS 체크',
      desc: ttsSubmitted ? '이번 주 TTS 제출 완료!' : (submissionOpen ? '이번 주 TTS를 제출해 주세요' : '이번 주 활동을 기록해 주세요 (토-화 제출)'),
      done: ttsSubmitted,
      path: '/tts'
    },
    { id: 'meeting',    icon: CalendarCheck, color: 'bg-violet-50 text-violet-600', title: '주간 모임 체크', desc: '기도회 · 교사회의 참석을 체크하세요',                   done: false, path: '/meeting' },
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
    { id: 'minutes',    icon: FileText,      color: 'bg-violet-50 text-violet-600', title: '회의록 및 영상', desc: '미참석 회의록 확인 및 영상 시청',  done: false, path: '/minutes' },
    { id: 'events',     icon: Calendar,      color: 'bg-rose-50 text-rose-600',     title: '행사 일정',     desc: '등록된 교회 행사를 확인하세요',     done: false, path: '/events' },
    ...(attendanceEvents.length > 0 ? [{
      id: 'event-attendance',
      icon: ClipboardList,
      color: 'bg-emerald-50 text-emerald-600',
      title: '행사 출석 체크',
      desc: `출석 체크가 필요한 행사 ${attendanceEvents.length}건`,
      done: false,
      path: attendanceEvents.length === 1 ? `/event-attendance/${attendanceEvents[0].id}` : '/event-attendance',
      badge: `${attendanceEvents.length}건`,
    }] : []),
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
            weeklyEvents.slice(0, 2).map(e => (
              <div key={e.id} className="flex items-center gap-3">
                <span className={`w-1 h-3 rounded-full ${e.color ? `bg-${e.color}-500` : 'bg-primary-500'}`} style={{ backgroundColor: e.color }} />
                <p className="text-xs font-black text-gray-700 truncate">{e.title}</p>
                <span className="text-[10px] font-bold text-gray-400 ml-auto">
                  {format(new Date(e.eventDate), 'EEE', { locale: ko })}
                </span>
              </div>
            ))
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

// ────────── 관리자 뷰 ──────────
function AdminView({ navigate, today }) {
  const [weeklyEvents, setWeeklyEvents] = useState([])
  const { data, isLoading } = useQuery({
    queryKey: ['report-summary', today],
    queryFn:  () => reportsApi.getSummary(today).then(r => r.data),
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
      <SectionLabel>System Pulse</SectionLabel>

      {/* 통계 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <StatSummary value={submitRate + '%'} label="Submission" color="text-primary-600" />
        <StatSummary value={data?.totalTeachers ?? '-'} label="Teachers" color="text-gray-900" />
      </div>

      {/* 이번 주 일정 요약 */}
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
        
        <div className="flex flex-col gap-2">
          {weeklyEvents.length === 0 ? (
            <p className="text-xs text-gray-400 font-bold py-2">이번 주 예정된 일정이 없습니다.</p>
          ) : (
            weeklyEvents.slice(0, 2).map(e => (
              <div key={e.id} className="flex items-center gap-3">
                <span className={`w-1 h-3 rounded-full ${e.color ? `bg-${e.color}-500` : 'bg-primary-500'}`} style={{ backgroundColor: e.color }} />
                <p className="text-xs font-black text-gray-700 truncate">{e.title}</p>
                <span className="text-[10px] font-bold text-gray-400 ml-auto">
                  {format(new Date(e.eventDate), 'EEE', { locale: ko })}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      <SectionLabel>관리 메뉴</SectionLabel>

      {[
        { path: '/admin/evangelism', icon: MapPin,    bg: 'bg-primary-50', color: 'text-primary-600', title: '전도 관리',      desc: '전도 조 편성 및 일정 관리' },
        { path: '/admin/minutes',    icon: FileText,  bg: 'bg-violet-50',  color: 'text-violet-600',  title: '회의록 관리',    desc: '회의록 등록 · 영상 공유 · 확인 현황' },
        { path: '/admin/calendar',   icon: Calendar,  bg: 'bg-rose-50',    color: 'text-rose-600',    title: '일정 관리',      desc: '월별 부서 일정 등록 및 수정' },
        { path: '/admin/prayer',           icon: BookOpen,     bg: 'bg-amber-50',   color: 'text-amber-600',   title: '기도모임 관리',  desc: '불참 명단 및 필사 제출 현황' },
        { path: '/admin/event-attendance', icon: ClipboardList, bg: 'bg-emerald-50', color: 'text-emerald-600', title: '행사 출석 관리',  desc: '행사별 반 학생 출석 현황 확인' },
      ].map(({ path, icon: Icon, bg, color, title, desc }) => (
        <Card key={path} onClick={() => navigate(path)} className="flex items-center justify-between p-5 group">
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">{title}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
        </Card>
      ))}
      
      {/* 미제출 목록 피크 */}
      {!isLoading && data?.notSubmitted?.filter((_, idx) => idx < 3).length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Urgent Follow-up</SectionLabel>
          {data.notSubmitted.slice(0, 3).map(t => (
            <Card key={t.teacherId} className="flex items-center gap-3 py-3 px-4">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-[11px] font-black">{t.teacherName[0]}</div>
              <p className="text-sm font-bold text-gray-700">{t.teacherName}</p>
              <Badge variant="danger" className="ml-auto text-[9px]">미제출</Badge>
            </Card>
          ))}
          {data.notSubmitted.length > 3 && (
            <p className="text-center text-[10px] text-gray-400 font-bold mt-1">외 {data.notSubmitted.length - 3}명 더 있음</p>
          )}
        </div>
      )}
    </motion.div>
  )
}

function StatSummary({ value, label, color }) {
  return (
    <Card className="p-5 flex flex-col items-center">
      <p className={`text-3xl font-black ${color} tracking-tighter`}>{value}</p>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">{label}</p>
    </Card>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">{children}</p>
}