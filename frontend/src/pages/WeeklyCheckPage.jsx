import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, FileText, Calendar, CheckSquare, CalendarCheck,
  MapPin, ChevronRight, AlertCircle, Sparkles
} from 'lucide-react'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import { evangelismApi } from '../api/evangelism'
import { weeklyStatusApi } from '../api/weeklyStatus'
import { getTTSWeekRange, getCurrentWeekRange } from '../utils/date'

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
  const evangelism    = useEvangelismStatus()
  const weekRange     = getCurrentWeekRange()

  const isEvangelismActive = evangelism?.nextSchedule?.status === 'ACTIVE'
  const minutesDone = weeklyStatus.unconfirmedMinutesCount === 0

  const tasks = [
    {
      id: 'attendance',
      icon: Users,
      color: weeklyStatus.attendanceSubmittedThisWeek ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600',
      title: '출석 체크',
      desc: weeklyStatus.attendanceSubmittedThisWeek ? '이번 주 출석 제출 완료!' : '학생들의 출결 현황을 기록하세요',
      done: weeklyStatus.attendanceSubmittedThisWeek,
      path: '/attendance',
    },
    {
      id: 'tts',
      icon: CheckSquare,
      color: ttsSubmitted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-50 text-amber-600',
      title: 'TTS 체크',
      desc: ttsSubmitted ? '이번 주 TTS 제출 완료!' : '이번 주 TTS를 제출해 주세요',
      done: ttsSubmitted,
      path: '/tts',
    },
    {
      id: 'meeting',
      icon: CalendarCheck,
      color: meetingChecked ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-50 text-violet-600',
      title: '주간 모임 체크',
      desc: meetingChecked ? '기도회 · 교사회의 체크 완료!' : '기도회 · 교사회의 참석을 체크하세요',
      done: meetingChecked,
      path: '/meeting',
    },
    {
      id: 'minutes',
      icon: FileText,
      color: minutesDone ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-50 text-violet-600',
      title: '회의록 및 영상',
      desc: minutesDone ? '미확인 회의록 없음' : `미확인 회의록 ${weeklyStatus.unconfirmedMinutesCount}건 남음`,
      done: minutesDone,
      path: '/minutes',
    },
    {
      id: 'evangelism',
      icon: MapPin,
      color: isEvangelismActive ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-orange-500',
      title: '전도 로테이션',
      desc: isEvangelismActive ? '이번 주 전도 당번입니다!' : '배정된 전도 일정을 확인하세요',
      done: null, // 완료 개념 없음
      path: '/evangelism',
      badge: isEvangelismActive ? '당번' : null,
    },
    {
      id: 'events',
      icon: Calendar,
      color: 'bg-rose-50 text-rose-600',
      title: '행사 일정',
      desc: '등록된 교회 행사를 확인하세요',
      done: null,
      path: '/events',
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

      <div className="px-4 py-5 flex flex-col gap-4">

        {/* 미완료 섹션 */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          {allDone ? (
            <div className="rounded-[1.5rem] p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Sparkles size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-800">이번 주 할 일 모두 완료!</p>
                <p className="text-[11px] text-emerald-500 font-bold mt-0.5">수고하셨어요 😊</p>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] overflow-hidden border border-amber-100">
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
              <div className="bg-white divide-y divide-gray-50">
                {incompleteTrackable.map(t => (
                  <button
                    key={t.id}
                    onClick={() => navigate(t.path)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${t.color}`}>
                        <t.icon size={15} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-gray-800">{t.title}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{t.desc}</p>
                      </div>
                    </div>
                    <ChevronRight size={15} className="text-gray-300 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>

      </div>
    </div>
  )
}
