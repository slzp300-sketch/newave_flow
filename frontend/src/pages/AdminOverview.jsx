import { eventRangeKey } from '../api/queryPolicy'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, Users, Calendar, Bell, Megaphone,
  Settings2, Plus, X, Trash2
} from 'lucide-react'
import { reportsApi } from '../api/reports'
import { adminUsersApi } from '../api/adminUsers'
import { toApiDate } from '../utils/date'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import client from '../api/client'
import FeatureIcon from '../components/common/FeatureIcon'
import Card from '../components/common/Card'
import FitLabel from '../components/common/FitLabel'
import useToday from '../hooks/useToday'


const ALL_QUICK_LINKS = [
  { to: '/admin/student-attendance', label: '출석 현황', bg: 'bg-secondary-50', color: 'text-secondary-600' },
  { to: '/admin/event-attendance',   label: '행사 출석', bg: 'bg-primary-50',     color: 'text-primary-600'    },
  { to: '/admin/calendar',      label: '일정 관리',  bg: 'bg-rose-50',    color: 'text-rose-500'    },
  { to: '/admin/meeting-attendance', label: '교사회의',   bg: 'bg-primary-50',    color: 'text-primary-600'    },
  { to: '/admin/prayer',        label: '기도모임',   bg: 'bg-amber-50',   color: 'text-amber-600'   },
  { to: '/admin/minutes',       label: '회의록',     bg: 'bg-primary-50',  color: 'text-primary-600'  },
  { to: '/admin/tts',           label: 'TTS 점검',   bg: 'bg-secondary-50',    color: 'text-secondary-600'    },
  { to: '/admin/pending-users', label: '가입 승인',  bg: 'bg-amber-50',   color: 'text-amber-600',   badge: true },
  { to: '/admin/teachers',      label: '교사 관리',  bg: 'bg-primary-50',  color: 'text-primary-600'  },
  { to: '/admin/students',      label: '아이 관리',  bg: 'bg-secondary-50',    color: 'text-secondary-600'    },
  { to: '/admin/class-assignment',label: '반 배정',    bg: 'bg-primary-50',    color: 'text-primary-600'    },
  { to: '/admin/deactivation-requests', label: '제적 승인', bg: 'bg-rose-50', color: 'text-rose-500'   },
]

// ────────── Admin View (Dashboard) ──────────
export default function AdminOverview() {
  const navigate = useNavigate()
  const today = useToday()
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
    { label: '전체 교사',    value: teachers.length,     bg: 'bg-primary-50',  color: 'text-primary-600',  icon: Users      },
    { label: '이번 달 일정', value: monthEvents.length,  bg: 'bg-rose-50',    color: 'text-rose-500',    icon: Calendar   },
    { label: '예정 일정',    value: upcomingEvents.length, bg: 'bg-secondary-50', color: 'text-secondary-600', icon: Megaphone },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-5"
    >
      <SectionLabel>관리 요약</SectionLabel>

      {/* 승인 대기 알림 (옵션) */}
      {pendingUsers.length > 0 && (
        <button type="button"
          onClick={() => navigate('/admin/pending-users')}
          className="brand-card bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
        >
          <div className="flex min-w-0 items-center gap-2 text-amber-800 text-left">
            <Bell size={18} className="shrink-0" aria-hidden="true" />
            <span className="text-base font-bold">승인 대기 {pendingUsers.length}명</span>
          </div>
          <ChevronRight size={16} className="shrink-0 text-amber-700" />
        </button>
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
              className="brand-card bg-white rounded-2xl p-4 border border-gray-200 flex flex-col items-center text-center"
            >
              <div className={`w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center mb-2`}>
                <Icon size={16} className="text-primary-700" />
              </div>
              <p className={`text-2xl font-bold leading-none text-gray-900`}>{stat.value}</p>
              <p className="w-full text-sm font-semibold text-gray-600 mt-2">{stat.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* 바로가기 */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-lg font-bold text-gray-900">바로가기</h2>
          <button
            onClick={() => setIsEditingLinks(!isEditingLinks)}
            aria-pressed={isEditingLinks}
            className={`flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold px-3 py-2 rounded-lg transition-colors ${
              isEditingLinks ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings2 size={16} aria-hidden="true" />
            {isEditingLinks ? '완료' : '수정'}
          </button>
        </div>

        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-3">
          <AnimatePresence>
            {activeLinks.map((link, i) => {
              const showBadge = link.badge && pendingUsers.length > 0
              return (
                <motion.div
                  key={link.to}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: isEditingLinks ? 0 : i * 0.03 }}
                  className="relative min-w-0"
                >
                  <button
                    aria-label={isEditingLinks ? `${link.label} 바로가기 제거` : link.label}
                    onClick={() => isEditingLinks ? handleRemoveLink(link.to) : navigate(link.to)}
                    className={`w-full h-full min-h-28 flex flex-col items-center gap-2 bg-white rounded-2xl p-3 shadow-sm border transition-all ${
                      isEditingLinks ? 'border-red-200 bg-red-50/20 animate-pulse-slow' : 'border-gray-50 active:scale-95 hover:border-primary-200'
                    }`}
                  >
                    {!isEditingLinks && showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-6 min-h-6 bg-red-600 rounded-full text-sm text-white font-bold flex items-center justify-center px-1 z-10 shadow-sm">
                        {pendingUsers.length}
                      </span>
                    )}
                    {isEditingLinks && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white flex items-center justify-center z-10 shadow-sm shadow-red-200">
                        <Trash2 size={10} />
                      </span>
                    )}
                    <div className="brand-action-icon w-12 h-12 rounded-xl flex items-center justify-center">
                      <FeatureIcon path={link.to} />
                    </div>
                    <div className="w-full min-w-0 text-base font-bold text-gray-900"><FitLabel>{link.label}</FitLabel></div>
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
                    <Plus size={18} className="text-gray-600" />
                  </div>
                  <p className="text-base font-bold text-gray-700 text-center leading-relaxed">추가하기</p>
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
            <h2 className="text-lg font-bold text-gray-900">예정 일정</h2>
            <button onClick={() => navigate('/admin/calendar')} className="min-h-11 shrink-0 text-sm font-bold text-primary-700">전체보기 →</button>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingEvents.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                className="brand-card bg-white rounded-2xl px-4 py-3 border border-gray-200 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
              >
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} className="text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-relaxed text-gray-900 break-keep [overflow-wrap:anywhere]">{event.title}</p>
                  <p className="text-sm text-gray-600 font-medium mt-0.5">
                    {format(new Date(event.eventDate), 'M월 d일 (EEE)', { locale: ko })}
                    {event.startTime && ` · ${event.startTime}`}
                  </p>
                </div>
                {event.attendanceRequired && (
                  <span className="col-start-2 justify-self-start text-sm font-bold text-secondary-700 bg-secondary-50 px-2 py-1 rounded-lg">
                    출석
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 출석 제출 확인 */}
      {!reportLoading && reportData?.notSubmitted?.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
             <SectionLabel>출석 제출 확인</SectionLabel>
             <span className="text-sm font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md">{reportData.notSubmitted.length}명 미제출</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {reportData.notSubmitted.slice(0, 3).map(t => (
              <Card key={t.teacherId} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 py-3 px-4 border-l-4 border-l-red-400">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-sm font-bold">{t.teacherName[0]}</div>
                <div className="min-w-0">
                   <p className="text-base font-bold text-gray-900">{t.teacherName}</p>
                   <p className="text-sm font-medium text-gray-600">{t.className}</p>
                </div>
                <span className="col-start-2 justify-self-start rounded-lg bg-red-50 px-2 py-1 text-sm font-semibold text-red-700">보고서 미작성</span>
              </Card>
            ))}
            {reportData.notSubmitted.length > 3 && (
              <button
                onClick={() => navigate('/admin/student-attendance')}
                className="min-h-11 text-center text-sm text-gray-600 font-bold mt-1 hover:text-primary-500 transition-colors"
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
          <div className="safe-overlay safe-overlay-sm-spaced fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
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
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col safe-modal-panel safe-modal-80 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3 bg-white sticky top-0 z-10">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">바로가기 추가</h3>
                  <p className="text-sm font-bold text-gray-600 mt-0.5">추가할 메뉴를 선택해주세요. (최대 9개)</p>
                </div>
                <button
                  aria-label="바로가기 추가 닫기"
                  onClick={() => setShowLinkModal(false)}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex flex-col gap-2 pb-8 sm:pb-4">
                {unselectedLinks.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm font-bold text-gray-600">추가할 수 있는 메뉴가 없습니다.</p>
                  </div>
                ) : (
                  unselectedLinks.map(link => {
                    return (
                      <button
                        key={link.to}
                        onClick={() => handleAddLink(link.to)}
                        className="flex items-center gap-4 p-3.5 hover:bg-gray-50 active:bg-gray-100 active:scale-[0.98] rounded-2xl text-left border border-transparent hover:border-gray-100 transition-all group"
                      >
                        <div className="brand-action-icon w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          <FeatureIcon path={link.to} />
                        </div>
                        <div className="min-w-0 flex-1 text-base font-bold text-gray-900">
                          <FitLabel>{link.label}</FitLabel>

                        </div>
                        <div className="ml-auto shrink-0 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
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
  return <h2 className="text-lg font-bold text-gray-900 px-1">{children}</h2>
}
