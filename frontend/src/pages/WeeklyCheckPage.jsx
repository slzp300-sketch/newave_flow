import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, FileText, Calendar, CheckSquare, CalendarCheck,
  ChevronRight, AlertCircle, Sparkles, CheckCircle2, Mic2
} from 'lucide-react'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import { evangelismApi } from '../api/evangelism'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { eventApi } from '../api/event'
import { prayerVoteApi } from '../api/prayerVote'
import { ttsApi } from '../api/tts'
import client from '../api/client'
import { getTTSWeekRange, getCurrentWeekRange, canSubmitTTS } from '../utils/date'
import { format, addDays } from 'date-fns'

function getThisWeekMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return format(monday, 'yyyy-MM-dd')
}

// ── 날짜 / 권한 유틸 ────────────────────────
function isVoteWindowOpen() {
  const day = new Date().getDay()
  return day >= 1 && day <= 4 // Mon=1 ~ Thu=4
}
function isSundayToTuesday() {
  const day = new Date().getDay()
  return day === 0 || day === 1 || day === 2 // Sun=0, Mon=1, Tue=2
}
function isSatMeetingWindowOpen() {
  const now = new Date()
  const day  = now.getDay()
  const hour = now.getHours()
  if (day === 0)             return false       // 일: 닫힘
  if (day >= 1 && day <= 5)  return true        // 월~금: 열림
  if (day === 6)             return hour < 16   // 토: 16시 이전만 열림
  return false
}

// ── localStorage 상태 훅 ────────────────────────
function useTTSSubmitted() {
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => {
    const { weekNum } = getTTSWeekRange()
    const year = new Date().getFullYear()
    const saved = localStorage.getItem(`tts_${year}_week${weekNum}`)
    if (saved) setSubmitted(!!JSON.parse(saved).submitted)
  }, [])
  return submitted
}

function useMeetingChecked(user) {
  const { data: voteData } = useQuery({
    queryKey: ['prayer-vote', getThisWeekMonday(), user?.id],
    queryFn: () => prayerVoteApi.getMine(getThisWeekMonday()).then(r => r.data),
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  })

  const [satChecked, setSatChecked] = useState(false)
  useEffect(() => {
    const { weekNum } = getTTSWeekRange()
    const year = new Date().getFullYear()
    const sat = localStorage.getItem(`sat_meeting_${year}_w${weekNum}`)
    setSatChecked(sat ? JSON.parse(sat).submitted === true : false)
  }, [])

  // 기도모임 투표 완료 && 토요모임 제출 완료
  return !!voteData && satChecked
}

function useWeeklyStatus() {
  const { data } = useQuery({
    queryKey: ['weekly-status'],
    queryFn: () => weeklyStatusApi.getStatus().then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  return data ?? {
    attendanceSubmittedThisWeek: false,
    unconfirmedMinutesCount: 0,
    currentWeekMinutesExists: false,
    currentWeekMinutesConfirmed: false,
  }
}

function useAttendanceRequiredEvents() {
  const { data = [] } = useQuery({
    queryKey: ['attendance-required-events'],
    queryFn: () => eventApi.getAttendanceRequired().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const today = new Date().toISOString().split('T')[0]
  return data.filter(e => !e.attendanceDeadline || e.attendanceDeadline >= today)
}

function useEvangelismStatus() {
  const { data } = useQuery({
    queryKey: ['evangelism-status'],
    queryFn: () => evangelismApi.getMyStatus().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  return data ?? null
}

// ── 메인 페이지 ─────────────────────────────────
export default function WeeklyCheckPage() {
  const navigate      = useNavigate()
  const { user }      = useAuthStore()
  const { weekNum: ttsWeekNum } = getTTSWeekRange()
  const currentYear = new Date().getFullYear()
  const { data: ttsRecord } = useQuery({
    queryKey: ['tts-my', currentYear, ttsWeekNum],
    queryFn: () => ttsApi.getMyTts(currentYear, ttsWeekNum).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const ttsSubmitted = ttsRecord?.submitted ?? false

  // 기도모임 투표 완료 여부 (API)
  const weekMonday = getThisWeekMonday()
  const { data: prayerVoteData } = useQuery({
    queryKey: ['prayer-vote', weekMonday, user?.id],
    queryFn:  () => prayerVoteApi.getMine(weekMonday).then(r => r.data),
    enabled:  !!user,
    staleTime: 2 * 60 * 1000,
  })
  const prayerDone = !!prayerVoteData

  // 교사회의 체크 완료 여부 (API)
  const satDate = format(addDays(new Date(weekMonday), 5), 'yyyy-MM-dd')
  const { data: satData } = useQuery({
    queryKey: ['meeting-attendance', satDate, user?.id],
    queryFn:  () => client.get(`/meetings/attendance?date=${satDate}`).then(r => r.data),
    enabled:  !!user,
    staleTime: 2 * 60 * 1000,
  })
  const satDone = !!satData?.status
  const weeklyStatus  = useWeeklyStatus()
  const _rawAttendanceEvents = useAttendanceRequiredEvents()
  const _today = new Date().toISOString().split('T')[0]
  const attendanceEvents = _rawAttendanceEvents.filter(e => !e.attendanceDeadline || e.attendanceDeadline >= _today)
  const weekRange     = getCurrentWeekRange()

  // 행사별 제출 상태 확인 (교사 출석)
  const teacherAttQueries = useQueries({
    queries: attendanceEvents
      .filter(e => e.attendanceTarget === 'TEACHER_ONLY' || e.attendanceTarget === 'BOTH')
      .map(event => ({
        queryKey: ['event-teacher-attendance', event.id, user?.id],
        queryFn: () => eventApi.getMyTeacherAttendance(event.id).then(r => r.data),
        enabled: !!user,
        staleTime: 2 * 60 * 1000,
      })),
  })

  // 행사별 제출 상태 확인 (학생 출석)
  const studentAttQueries = useQueries({
    queries: attendanceEvents
      .filter(e => !e.attendanceTarget || e.attendanceTarget === 'STUDENT_ONLY' || e.attendanceTarget === 'BOTH')
      .map(event => ({
        queryKey: ['event-attendance', event.id, user?.id],
        queryFn: () => eventApi.getMyClassAttendance(event.id).then(r => r.data),
        enabled: !!user,
        staleTime: 2 * 60 * 1000,
      })),
  })

  const teacherEventIds = attendanceEvents
    .filter(e => e.attendanceTarget === 'TEACHER_ONLY' || e.attendanceTarget === 'BOTH')
    .map(e => e.id)
  const studentEventIds = attendanceEvents
    .filter(e => !e.attendanceTarget || e.attendanceTarget === 'STUDENT_ONLY' || e.attendanceTarget === 'BOTH')
    .map(e => e.id)

  const allEventsDone = attendanceEvents.length > 0 && attendanceEvents.every(event => {
    const needsTeacher = event.attendanceTarget === 'TEACHER_ONLY' || event.attendanceTarget === 'BOTH'
    const needsStudent = !event.attendanceTarget || event.attendanceTarget === 'STUDENT_ONLY' || event.attendanceTarget === 'BOTH'
    const tIdx = teacherEventIds.indexOf(event.id)
    const sIdx = studentEventIds.indexOf(event.id)
    const teacherDone = !needsTeacher || !!teacherAttQueries[tIdx]?.data?.status
    const studentData = sIdx >= 0 ? (studentAttQueries[sIdx]?.data ?? []) : []
    const studentDone = !needsStudent || studentData.length === 0 || studentData.some(s => s.status)
    return teacherDone && studentDone
  })

  // 각 파트별 활성화 상태
  const ttsOpen = canSubmitTTS()
  const meetingOpen = isVoteWindowOpen()
  const satWindowOpen = isSatMeetingWindowOpen()
  const attendanceOpen = isSundayToTuesday()
  const eventAttendanceOpen = attendanceEvents.length > 0
  const minutesOpen = true // 회의록은 상시 열림

  const tasks = [
    {
      id: 'attendance',
      icon: Users,
      color: weeklyStatus.attendanceSubmittedThisWeek ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600',
      title: '출석 체크',
      desc: weeklyStatus.attendanceSubmittedThisWeek ? '✅ 이번 주 출결 완료되었습니다.' : '학생들의 출결 현황을 기록하세요',
      done: weeklyStatus.attendanceSubmittedThisWeek,
      disabled: false, // 항목 항상 활성화 (페이지 진입 후 안내)
      path: '/attendance',
    },
    {
      id: 'tts',
      icon: CheckSquare,
      color: ttsSubmitted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-50 text-amber-600',
      title: 'TTS 체크',
      desc: ttsSubmitted ? '✅ 이번 주 TTS 제출 완료되었습니다.' : '이번 주 활동을 기록해 주세요',
      done: ttsSubmitted,
      disabled: false, // 항목 항상 활성화 (페이지 진입 후 안내)
      path: '/tts',
    },
    {
      id: 'prayer',
      icon: Users,
      color: prayerDone ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-50 text-violet-600',
      title: '기도모임 투표',
      desc: prayerDone ? '✅ 기도모임 투표 완료되었습니다.' : (meetingOpen ? '온라인 기도모임 참석 여부를 투표하세요' : '⚠️ 투표 기간이 아닙니다 (월~목 가능).'),
      done: prayerDone,
      disabled: !prayerDone && !meetingOpen,
      path: '/meeting/prayer',
    },
    {
      id: 'sat-meeting',
      icon: CalendarCheck,
      color: satDone ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600',
      title: '교사회의 체크',
      desc: satDone
        ? '✅ 교사 회의 참석 여부 제출 완료'
        : satWindowOpen
          ? '토요일 교사 회의 참석 여부를 제출하세요'
          : '⚠️ 제출 기간이 아닙니다 (월~토 정오 가능).',
      done: satDone,
      disabled: !satDone && !satWindowOpen,
      path: '/meeting/sat',
    },
    ...(satData?.status === 'ABSENT' ? [{
      id: 'minutes',
      icon: FileText,
      color: weeklyStatus.currentWeekMinutesConfirmed ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-50 text-violet-600',
      title: '회의록 및 영상',
      desc: weeklyStatus.currentWeekMinutesConfirmed
        ? '✅ 이번 주 회의록을 확인하셨습니다.'
        : weeklyStatus.currentWeekMinutesExists
          ? '이번 주 회의록 확인이 필요합니다.'
          : '⚠️ 이번 주 회의록이 아직 업로드되지 않았습니다.',
      done: weeklyStatus.currentWeekMinutesConfirmed,
      disabled: !weeklyStatus.currentWeekMinutesExists,
      path: '/minutes',
    }] : []),
    {
      id: 'event-attendance',
      icon: Calendar,
      color: allEventsDone ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-600',
      title: '행사 출석 체크',
      desc: !eventAttendanceOpen
        ? '⚠️ 현재 진행 중인 행사 출석 체크가 없습니다.'
        : allEventsDone
          ? `✅ ${attendanceEvents.length}개 행사 출석 체크 완료되었습니다.`
          : `출석 체크가 필요한 행사 ${attendanceEvents.length}건이 있습니다.`,
      done: eventAttendanceOpen ? allEventsDone : true,
      disabled: !eventAttendanceOpen,
      path: attendanceEvents.length === 1 ? `/event-attendance/${attendanceEvents[0].id}` : '/event-attendance',
    },
  ]

  // done이 null이 아닌 항목만 집계
  const trackable = tasks.filter(t => t.done !== null)
  const completedCount = trackable.filter(t => t.done).length
  const incompleteTrackable = trackable.filter(t => !t.done)
  const allDone = incompleteTrackable.length === 0
  const progress = Math.round((completedCount / trackable.length) * 100)

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <Header title="주간 체크" />

      {/* 서브 헤더 */}
      <div className="px-4 py-4 glass-effect">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Weekly Tasks</p>
            <p className="text-sm font-bold text-gray-700 mt-0.5">{weekRange}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-[10px] font-black text-primary-600">{completedCount}/{trackable.length} 완료</p>
            <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex flex-col gap-4">

        {/* 대시보드 리스트 */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          {allDone && (
            <div className="rounded-[1.5rem] p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Sparkles size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-800">이번 주 할 일 모두 완료!</p>
                <p className="text-[11px] text-emerald-500 font-bold mt-0.5">수고하셨어요 😊</p>
              </div>
            </div>
          )}
          <div className="rounded-[1.5rem] mt-3 overflow-hidden border border-amber-100 bg-white">
            {!allDone && (
              <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                    <AlertCircle size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">이번 주 미완료</p>
                    <p className="text-[10px] text-amber-500 font-bold mt-0.5">
                      {incompleteTrackable.length}개 항목 남음
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-[10px] font-black text-amber-600">{progress}%</p>
                  <div className="w-20 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
              <div className="bg-white divide-y divide-gray-50 flex flex-col gap-2 p-3">
                {tasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { if (!t.disabled) navigate(t.path) }}
                    disabled={t.disabled}
                    className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border transition-all group ${
                      t.done ? 'bg-emerald-50/50 border-emerald-100 shadow-sm' : 
                      t.disabled ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed' : 'bg-white border-gray-100 shadow-sm hover:border-primary-200 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        t.disabled && !t.done ? 'bg-gray-200 text-gray-400' : t.color
                      }`}>
                        <t.icon size={18} />
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-black ${t.disabled && !t.done ? 'text-gray-500' : 'text-gray-800'}`}>
                          {t.title}
                        </p>
                        <p className={`text-[11px] font-medium mt-0.5 ${
                          t.done ? 'text-emerald-600' : t.disabled ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {t.desc}
                        </p>
                      </div>
                    </div>
                    {t.done ? (
                      <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                      !t.disabled && <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
        </motion.div>

      </div>
    </div>
  )
}
