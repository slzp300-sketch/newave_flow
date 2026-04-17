import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Users, Calendar, ChevronRight, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { evangelismApi } from '../api/evangelism'

export default function EvangelismPage() {
  const navigate = useNavigate()
  const [groupOpen, setGroupOpen] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['evangelism-status'],
    queryFn: () => evangelismApi.getMyStatus().then(r => r.data),
  })

  const { data: allSchedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['evangelism-schedules-mine'],
    queryFn: () => evangelismApi.getMySchedules().then(r => r.data),
  })

  if (isLoading || schedulesLoading) return <LoadingSpinner />

  const { myGroup, nextSchedule } = status ?? {}
  const upcoming = allSchedules?.filter(s => s.status !== 'COMPLETED') ?? []
  const past     = allSchedules?.filter(s => s.status === 'COMPLETED') ?? []

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <Header title="전도 로테이션" showBack onBack={() => navigate('/')} />

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* 내 다음 차례 배너 */}
        <NextScheduleBanner nextSchedule={nextSchedule} />

        {/* 내 조 카드 */}
        <Card>
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setGroupOpen(v => !v)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Users size={20} className="text-violet-600" />
              </div>
              <div className="text-left">
                <p className="font-black text-gray-900 text-sm">내 조</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {myGroup ? `${myGroup.name} · ${myGroup.members?.length ?? 0}명` : '조 배정 없음'}
                </p>
              </div>
            </div>
            {groupOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {groupOpen && myGroup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2"
            >
              {myGroup.members?.map(m => (
                <div key={m.id} className="flex items-center gap-3 py-1">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-black">
                    {m.teacherName[0]}
                  </div>
                  <p className="text-sm font-bold text-gray-700">{m.teacherName}</p>
                </div>
              ))}
            </motion.div>
          )}
        </Card>

        {/* 예정 일정 */}
        <SectionLabel icon={Calendar} label="내 전도 일정" />

        {upcoming.length === 0 ? (
          <EmptyState message="예정된 전도 일정이 없습니다" />
        ) : (
          upcoming.map((s, i) => (
            <ScheduleCard key={s.id} schedule={s} index={i} />
          ))
        )}

        {/* 지난 일정 */}
        {past.length > 0 && (
          <>
            <SectionLabel label="지난 일정" dimmed />
            {past.map((s, i) => (
              <ScheduleCard key={s.id} schedule={s} index={i} past />
            ))}
          </>
        )}

        {/* 전체 로테이션 보기 */}
        <FullRotationSection />
      </div>
    </div>
  )
}

function NextScheduleBanner({ nextSchedule }) {
  if (!nextSchedule) {
    return (
      <Card className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
          <AlertCircle size={22} className="text-gray-400" />
        </div>
        <div>
          <p className="font-black text-gray-900 text-sm">예정된 전도 없음</p>
          <p className="text-xs text-gray-400 mt-0.5">현재 배정된 전도 일정이 없습니다</p>
        </div>
      </Card>
    )
  }

  const isActive = nextSchedule.status === 'ACTIVE'
  const dateStr  = formatScheduleDate(nextSchedule.scheduledDate)

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={`p-5 flex items-center gap-4 ${isActive ? 'border border-red-200 bg-red-50/60' : ''}`}>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isActive ? 'bg-red-100' : 'bg-amber-100'}`}>
          <Calendar size={22} className={isActive ? 'text-red-500' : 'text-amber-500'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-black text-sm ${isActive ? 'text-red-600' : 'text-gray-900'}`}>
            {isActive ? '이번 주 전도 당번입니다' : '다음 전도 일정'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
          {nextSchedule.periodLabel && (
            <p className="text-xs text-gray-400">{nextSchedule.periodLabel}</p>
          )}
        </div>
        <Badge variant={isActive ? 'danger' : 'warning'} className="text-[10px] flex-shrink-0">
          {isActive ? '당번' : 'D-' + daysUntil(nextSchedule.scheduledDate)}
        </Badge>
      </Card>
    </motion.div>
  )
}

function ScheduleCard({ schedule, index, past = false }) {
  const dateStr = formatScheduleDate(schedule.scheduledDate)
  const assignees = schedule.assignments?.map(a => a.teacherName).join(', ') ?? ''

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`flex items-center gap-4 py-4 px-5 ${past ? 'opacity-50' : ''}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(schedule.status)}`} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">{dateStr}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {schedule.periodLabel && <span>{schedule.periodLabel} · </span>}
            {assignees && <span>담당: {assignees}</span>}
          </p>
        </div>
        <StatusBadge status={schedule.status} />
      </Card>
    </motion.div>
  )
}

function FullRotationSection() {
  const [open, setOpen] = useState(false)

  const { data: schedules } = useQuery({
    queryKey: ['evangelism-schedules-upcoming'],
    queryFn: () => evangelismApi.getSchedules(true).then(r => r.data),
    enabled: open,
  })

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full py-2 px-1"
      >
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">전체 로테이션</p>
        <ChevronRight size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col gap-2 mt-2"
        >
          {(schedules ?? []).map(s => (
            <Card key={s.id} className="flex items-center gap-4 py-3 px-4">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(s.status)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{formatScheduleDate(s.scheduledDate)}</p>
                <p className="text-xs text-gray-400 truncate">
                  {s.assignments?.map(a => `${a.groupName} ${a.teacherName}`).join(' · ')}
                </p>
              </div>
              <StatusBadge status={s.status} />
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function SectionLabel({ icon: Icon, label, dimmed }) {
  return (
    <div className="flex items-center gap-2 px-1">
      {Icon && <Icon size={12} className="text-gray-400" />}
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${dimmed ? 'text-gray-300' : 'text-gray-400'}`}>{label}</p>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <Card className="py-8 flex items-center justify-center">
      <p className="text-sm text-gray-400 font-medium">{message}</p>
    </Card>
  )
}

function StatusBadge({ status }) {
  if (status === 'ACTIVE')    return <Badge variant="danger"   className="text-[9px]">당번</Badge>
  if (status === 'UPCOMING')  return <Badge variant="warning"  className="text-[9px]">예정</Badge>
  return                             <Badge variant="success"  className="text-[9px]">완료</Badge>
}

function statusDot(status) {
  if (status === 'ACTIVE')   return 'bg-red-500'
  if (status === 'UPCOMING') return 'bg-amber-400'
  return 'bg-gray-300'
}

function formatScheduleDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'M월 d일 (eee)', { locale: ko })
  } catch {
    return dateStr
  }
}

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  return Math.max(0, diff)
}
