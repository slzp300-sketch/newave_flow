import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, FileText, Calendar, CheckSquare, CalendarCheck,
  ChevronRight, AlertCircle, Sparkles, CheckCircle2
} from 'lucide-react'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import { evangelismApi } from '../api/evangelism'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { eventApi } from '../api/event'
import { getTTSWeekRange, getCurrentWeekRange, canSubmitTTS } from '../utils/date'

// ── 날짜 / 권한 유틸 ────────────────────────
function isVoteWindowOpen() {
  const day = new Date().getDay()
  return day >= 1 && day <= 4 // Mon=1 ~ Thu=4
}
function isSundayToTuesday() {
  const day = new Date().getDay()
  return day === 0 || day === 1 || day === 2 // Sun=0, Mon=1, Tue=2
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

function useWeeklyStatus() {
  const { data } = useQuery({
    queryKey: ['weekly-status'],
    queryFn: () => weeklyStatusApi.getStatus().then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })
  return data ?? { attendanceSubmittedThisWeek: false, unconfirmedMinutesCount: 0 }
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

// ── 메인 페이지 ─────────────────────────────────
export default function WeeklyCheckPage() {
  const navigate      = useNavigate()
  const { user }      = useAuthStore()
  const ttsSubmitted  = useTTSSubmitted()
  const meetingChecked = useMeetingChecked()
  const weeklyStatus  = useWeeklyStatus()
  const attendanceEvents = useAttendanceRequiredEvents()
  const weekRange     = getCurrentWeekRange()

  const minutesDone = weeklyStatus.unconfirmedMinutesCount === 0

  // 각 파트별 활성화 상태
  const ttsOpen = canSubmitTTS()
  const meetingOpen = isVoteWindowOpen()
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
      id: 'meeting',
      icon: CalendarCheck,
      color: meetingChecked ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-50 text-violet-600',
      title: '주간 모임 체크',
      desc: meetingChecked ? '✅ 기도회/교사회의 참석 여부 제출 완료' : (meetingOpen ? '기도회/교사회의 참석을 체크하세요' : '⚠️ 주간 모임 체크 기간이 아닙니다 (월~목 가능).'),
      done: meetingChecked,
      disabled: !meetingChecked && !meetingOpen,
      path: '/meeting',
    },
    {
      id: 'minutes',
      icon: FileText,
      color: minutesDone ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-50 text-violet-600',
      title: '회의록 및 영상',
      desc: minutesDone ? '✅ 모든 회의록을 확인하셨습니다.' : `미확인 회의록 ${weeklyStatus.unconfirmedMinutesCount}건이 있습니다.`,
      done: minutesDone,
      disabled: false,
      path: '/minutes',
    },
    {
      id: 'event-attendance',
      icon: Calendar,
      color: 'bg-rose-50 text-rose-600',
      title: '행사 출석 체크',
      desc: eventAttendanceOpen ? `출석 체크가 필요한 행사 ${attendanceEvents.length}건이 있습니다.` : '⚠️ 현재 진행 중인 행사 출석 체크가 없습니다.',
      done: eventAttendanceOpen ? false : true, // 진행할 행사가 없으면 패스
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
