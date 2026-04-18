import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Calendar, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { evangelismApi } from '../api/evangelism'
import { getGroupColor } from './EvangelismAdminPage'

export default function EvangelismPage() {
  const navigate = useNavigate()

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['evangelism-status'],
    queryFn: () => evangelismApi.getMyStatus().then(r => r.data),
  })

  const { data: allSchedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['evangelism-schedules-all-teacher'],
    queryFn: () => evangelismApi.getSchedules(false).then(r => r.data),
  })

  const { data: allGroups = [] } = useQuery({
    queryKey: ['evangelism-groups'],
    queryFn: () => evangelismApi.getGroups().then(r => r.data),
  })

  if (statusLoading || schedulesLoading) return <LoadingSpinner />

  const myGroupId = status?.myGroup?.id
  const nextSchedule = status?.nextSchedule

  const upcoming = allSchedules.filter(s => s.status !== 'COMPLETED' && s.status !== 'CANCELED')
  const past     = allSchedules.filter(s => s.status === 'COMPLETED' || s.status === 'CANCELED')

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <Header title="전도 로테이션" showBack onBack={() => navigate('/')} />

      <div className="px-4 pt-4 flex flex-col gap-4">

        {/* 내 다음 차례 배너 */}
        <NextScheduleBanner nextSchedule={nextSchedule} myGroupId={myGroupId} allGroups={allGroups} />

        {/* 전체 조 편성표 */}
        <AllGroupsSection allGroups={allGroups} myGroupId={myGroupId} />

        {/* 전체 전도 일정 */}
        <div className="flex items-center gap-2 px-1">
          <Calendar size={12} className="text-gray-400" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">전도 일정</p>
        </div>

        {upcoming.length === 0 ? (
          <Card className="py-8 flex items-center justify-center">
            <p className="text-sm text-gray-400 font-medium">등록된 전도 일정이 없습니다</p>
          </Card>
        ) : (
          upcoming.map((s, i) => (
            <ScheduleCard key={s.id} schedule={s} index={i} myGroupId={myGroupId} allGroups={allGroups} />
          ))
        )}

        {past.length > 0 && (
          <>
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1 mt-1">지난 일정</p>
            {past.map((s, i) => (
              <ScheduleCard key={s.id} schedule={s} index={i} myGroupId={myGroupId} allGroups={allGroups} past />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── 내 다음 차례 배너 ──────────────────────────────────────────────────────
function NextScheduleBanner({ nextSchedule, myGroupId, allGroups }) {
  if (!myGroupId) {
    return (
      <Card className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
          <AlertCircle size={22} className="text-gray-400" />
        </div>
        <div>
          <p className="font-black text-gray-900 text-sm">조 배정 없음</p>
          <p className="text-xs text-gray-400 mt-0.5">아직 전도 조에 배정되지 않았습니다</p>
        </div>
      </Card>
    )
  }

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
  const groupIdx = allGroups.findIndex(g => g.id === myGroupId)
  const c = getGroupColor(groupIdx >= 0 ? groupIdx : 0)

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`p-5 flex items-center gap-4 ${isActive ? 'border border-red-200 bg-red-50/60' : ''}`}>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isActive ? 'bg-red-100' : c.bg}`}>
          <Calendar size={22} className={isActive ? 'text-red-500' : c.text} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-black text-sm ${isActive ? 'text-red-600' : 'text-gray-900'}`}>
            {isActive ? '이번 주 전도 당번입니다' : '다음 전도 일정'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
        </div>
        <Badge variant={isActive ? 'danger' : 'warning'} className="text-[10px] flex-shrink-0">
          {isActive ? '당번' : 'D-' + daysUntil(nextSchedule.scheduledDate)}
        </Badge>
      </Card>
    </motion.div>
  )
}

// ── 일정 카드 ──────────────────────────────────────────────────────────────
function ScheduleCard({ schedule, index, myGroupId, allGroups, past = false }) {
  const dateStr = formatScheduleDate(schedule.scheduledDate)
  const assignedGroupId = schedule.assignments?.[0]?.groupId
  const isMyGroup = myGroupId && assignedGroupId === myGroupId
  const groupIdx = allGroups.findIndex(g => g.id === assignedGroupId)
  const c = getGroupColor(groupIdx >= 0 ? groupIdx : 0)
  const groupName = schedule.assignments?.[0]?.groupName

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className={`flex items-center gap-4 py-4 px-5 ${past ? 'opacity-50' : ''} ${isMyGroup && !past ? `border-l-4 ${c.border}` : ''}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(schedule.status)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">{dateStr}</p>
            {isMyGroup && !past && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${c.bg} ${c.text}`}>내 조</span>
            )}
          </div>
          {groupName ? (
            <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${groupIdx >= 0 ? c.bg + ' ' + c.text : 'bg-gray-100 text-gray-500'}`}>
              {groupName}
            </span>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">담당 조 없음</p>
          )}
        </div>
        <StatusBadge status={schedule.status} />
      </Card>
    </motion.div>
  )
}

// ── 전체 조 편성표 ──────────────────────────────────────────────────────────
function AllGroupsSection({ allGroups, myGroupId }) {
  const [selectedIdx, setSelectedIdx] = useState(() => {
    const myIdx = allGroups.findIndex(g => g.id === myGroupId)
    return myIdx >= 0 ? myIdx : 0
  })

  if (allGroups.length === 0) return null

  const selectedGroup = allGroups[selectedIdx]
  const color = getGroupColor(selectedIdx)
  const isMyGroup = selectedGroup?.id === myGroupId

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Users size={12} className="text-gray-400" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">전체 조 편성표</p>
        </div>
        <p className="text-[10px] text-gray-400 font-bold">총 {allGroups.reduce((s, g) => s + (g.members?.length ?? 0), 0)}명</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {allGroups.map((g, idx) => {
          const c = getGroupColor(idx)
          const isSelected = idx === selectedIdx
          const isMine = g.id === myGroupId
          return (
            <button
              key={g.id}
              onClick={() => setSelectedIdx(idx)}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-2xl border-2 transition-all active:scale-95 ${
                isSelected ? `${c.bg} ${c.border}` : 'bg-gray-50 border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-black whitespace-nowrap ${isSelected ? c.text : 'text-gray-500'}`}>{g.name}</span>
                {isMine && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-primary-600 text-white">내 조</span>}
              </div>
              <span className={`text-[10px] font-bold ${isSelected ? c.text : 'text-gray-300'}`}>{g.members?.length ?? 0}명</span>
            </button>
          )
        })}
      </div>

      {selectedGroup && (
        <motion.div
          key={selectedGroup.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl border-2 ${color.border} overflow-hidden`}
        >
          <div className={`${color.light} px-5 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
              <p className={`font-black text-sm ${color.text}`}>{selectedGroup.name}</p>
              {isMyGroup && <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-primary-600 text-white">내 조</span>}
            </div>
            <p className={`text-[11px] font-bold ${color.text}`}>{selectedGroup.members?.length ?? 0}명</p>
          </div>
          <div className="bg-white px-4 py-3">
            {selectedGroup.members?.length === 0 ? (
              <p className="text-xs text-gray-300 text-center py-3">배정된 교사가 없습니다</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {selectedGroup.members.map(m => (
                  <div key={m.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${color.bg}`}>
                    <div className={`w-7 h-7 rounded-lg ${color.bg} ${color.text} flex items-center justify-center text-[11px] font-black flex-shrink-0`}>
                      {m.teacherName[0]}
                    </div>
                    <span className="text-xs font-bold text-gray-700 truncate">{m.teacherName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'ACTIVE')    return <Badge variant="danger"  className="text-[9px]">당번</Badge>
  if (status === 'UPCOMING')  return <Badge variant="warning" className="text-[9px]">예정</Badge>
  if (status === 'CANCELED')  return <Badge className="text-[9px] bg-gray-100 text-gray-400 border-none">취소</Badge>
  return                             <Badge variant="success" className="text-[9px]">완료</Badge>
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
