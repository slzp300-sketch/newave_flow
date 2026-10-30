import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Calendar, AlertCircle } from 'lucide-react'
import { useId } from 'react'
import FitLabel from '../components/common/FitLabel'
import QueryNotice from '../components/common/QueryNotice'
import { hasQueryData } from '../utils/queryReadState'
import { usePersistedState } from '../hooks/usePersistedState'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import { evangelismApi } from '../api/evangelism'
import { getGroupColor } from './EvangelismAdminPage'

export default function EvangelismPage() {
  const navigate = useNavigate()

  const statusQuery = useQuery({
    queryKey: ['evangelism-status'],
    queryFn: () => evangelismApi.getMyStatus().then(r => r.data),
  })

  const schedulesQuery = useQuery({
    queryKey: ['evangelism-schedules-all-teacher'],
    queryFn: () => evangelismApi.getSchedules(false).then(r => r.data),
  })

  const groupsQuery = useQuery({
    queryKey: ['evangelism-groups'],
    queryFn: () => evangelismApi.getGroups().then(r => r.data),
  })

  const queries = [statusQuery, schedulesQuery, groupsQuery]
  const { data: status } = statusQuery
  const { data: allSchedules = [] } = schedulesQuery
  const { data: allGroups = [] } = groupsQuery
  if (!hasQueryData(queries)) return <div className="min-h-screen pb-20">
    <Header title="전도 로테이션" showBack onBack={() => navigate('/')} />
    <div className="p-4"><QueryNotice queries={queries} label="전도 로테이션 현황" /></div>
  </div>

  const myGroupId = status?.myGroup?.id
  const nextSchedule = status?.nextSchedule

  const upcoming = allSchedules.filter(s => s.status !== 'COMPLETED' && s.status !== 'CANCELED')
  const past     = allSchedules.filter(s => s.status === 'COMPLETED' || s.status === 'CANCELED')

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <Header title="전도 로테이션" showBack onBack={() => navigate('/')} />

      <div className="px-4 pt-4 flex flex-col gap-4">

        {queries.some(q => q.isError) && <QueryNotice queries={queries} label="최신 전도 로테이션 현황" />}
        {/* 내 다음 차례 배너 */}
        <NextScheduleBanner nextSchedule={nextSchedule} myGroupId={myGroupId} allGroups={allGroups} />

        {/* 전체 조 편성표 */}
        <AllGroupsSection allGroups={allGroups} myGroupId={myGroupId} />

        {/* 전체 전도 일정 */}
        <div className="flex items-center gap-2 px-1">
          <Calendar size={18} className="text-gray-600" />
          <h2 className="text-lg font-bold text-gray-900">전도 일정</h2>
        </div>

        {upcoming.length === 0 ? (
          <Card className="py-8 flex items-center justify-center">
            <p className="text-base text-gray-600 font-medium">등록된 전도 일정이 없습니다</p>
          </Card>
        ) : (
          upcoming.map((s, i) => (
            <ScheduleCard key={s.id} schedule={s} index={i} myGroupId={myGroupId} allGroups={allGroups} />
          ))
        )}

        {past.length > 0 && (
          <>
            <h2 className="text-lg font-bold text-gray-900 px-1 mt-1">지난 일정</h2>
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
        <div className="w-11 h-11 shrink-0 rounded-2xl bg-gray-100 flex items-center justify-center">
          <AlertCircle size={22} className="text-gray-600" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-base">조 배정 없음</p>
          <p className="text-sm text-gray-600 mt-0.5">아직 전도 조에 배정되지 않았습니다</p>
        </div>
      </Card>
    )
  }

  if (!nextSchedule) {
    return (
      <Card className="p-5 flex items-center gap-4">
        <div className="w-11 h-11 shrink-0 rounded-2xl bg-gray-100 flex items-center justify-center">
          <AlertCircle size={22} className="text-gray-600" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-base">예정된 전도 없음</p>
          <p className="text-sm text-gray-600 mt-0.5">현재 배정된 전도 일정이 없습니다</p>
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
      <Card className={`p-5 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 ${isActive ? 'border border-red-200 bg-red-50/60' : ''}`}>
        <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${isActive ? 'bg-red-100' : c.bg}`}>
          <Calendar size={22} className={isActive ? 'text-red-500' : c.text} />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <p className={`font-bold text-lg ${isActive ? 'text-red-600' : 'text-gray-900'}`}>
            {isActive ? '이번 주 전도 당번입니다' : '다음 전도 일정'}
          </p>
          <p className="text-base text-gray-700 mt-1 leading-relaxed">{dateStr}</p>
        </div>
        <Badge variant={isActive ? 'danger' : 'warning'} className="text-sm col-start-2 justify-self-start">
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
      <Card className={`flex flex-col gap-3 py-4 px-5 ${isMyGroup && !past ? `border-l-4 ${c.border}` : ''}`}>
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-lg">{dateStr}</p>
            {isMyGroup && !past && (
              <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${c.bg} ${c.text}`}>내 조</span>
            )}
          </div>
          {groupName ? (
            <span className={`inline-block max-w-full break-keep [overflow-wrap:anywhere] mt-2 text-base font-semibold px-2 py-0.5 rounded-lg ${groupIdx >= 0 ? c.bg + ' ' + c.text : 'bg-gray-100 text-gray-500'}`}>
              {groupName}
            </span>
          ) : (
            <p className="text-sm text-gray-600 mt-0.5">담당 조 없음</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-gray-600">진행 상태</span><StatusBadge status={schedule.status} /></div>
      </Card>
    </motion.div>
  )
}

// ── 전체 조 편성표 ──────────────────────────────────────────────────────────
function AllGroupsSection({ allGroups, myGroupId }) {
  const panelId = useId()
  const myIdx = allGroups.findIndex(g => g.id === myGroupId)
  const [selectedIdx, setSelectedIdx] = usePersistedState('selectedIdx', myIdx >= 0 ? myIdx : 0)

  if (allGroups.length === 0) return null

  const safeIdx = allGroups[selectedIdx] ? selectedIdx : Math.max(0, myIdx)
  const selectedGroup = allGroups[safeIdx]
  const color = getGroupColor(safeIdx)
  const isMyGroup = selectedGroup?.id === myGroupId

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-600" />
          <h2 className="text-lg font-bold text-gray-900">전체 조 편성표</h2>
        </div>
        <p className="text-sm text-gray-600 font-bold">총 {allGroups.reduce((s, g) => s + (g.members?.length ?? 0), 0)}명</p>
      </div>

      <div role="group" aria-label="전도 조 선택" className="readable-card-grid gap-3">
        {allGroups.map((g, idx) => {
          const c = getGroupColor(idx)
          const isSelected = idx === safeIdx
          const isMine = g.id === myGroupId
          return (
            <button type="button" aria-pressed={isSelected} aria-controls={panelId}
              key={g.id}
              onClick={() => setSelectedIdx(idx)}
              className={`min-w-0 min-h-24 flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-2xl border-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-95 ${
                isSelected ? `${c.bg} ${c.border}` : 'bg-gray-50 border-transparent'
              }`}
            >
              <div className="flex flex-col w-full min-w-0 items-center gap-1.5">
                <span className={`w-full min-w-0 text-base font-bold ${isSelected ? c.text : 'text-gray-700'}`}><FitLabel>{g.name}</FitLabel></span>
                {isMine && <span className="text-sm font-bold px-1.5 py-0.5 rounded-md bg-primary-600 text-white">내 조</span>}
              </div>
              <span className={`text-sm font-bold ${isSelected ? c.text : 'text-gray-600'}`}>{g.members?.length ?? 0}명</span>
            </button>
          )
        })}
      </div>

      {selectedGroup && (
        <motion.div
          key={selectedGroup.id}
          id={panelId}
          role="region"
          aria-label={`${selectedGroup.name} 조원`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`brand-card rounded-3xl border-2 ${color.border} overflow-hidden`}
        >
          <div className={`${color.light} px-4 py-3 flex flex-wrap items-center justify-between gap-2`}>
            <div className="flex flex-wrap min-w-0 items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
              <p className={`font-bold text-base ${color.text}`}>{selectedGroup.name}</p>
              {isMyGroup && <span className="text-sm font-bold px-2 py-0.5 rounded-lg bg-primary-600 text-white">내 조</span>}
            </div>
            <p className={`text-sm font-bold ${color.text}`}>{selectedGroup.members?.length ?? 0}명</p>
          </div>
          <div className="bg-white px-4 py-3">
            {selectedGroup.members?.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-3">배정된 교사가 없습니다</p>
            ) : (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                {selectedGroup.members.map(m => (
                  <div key={m.id} className={`flex min-w-0 items-center gap-3 px-3 py-3 rounded-xl ${color.bg}`}>
                    <div className={`w-7 h-7 rounded-lg ${color.bg} ${color.text} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                      {m.teacherName[0]}
                    </div>
                    <span className="min-w-0 text-base font-semibold text-gray-900 leading-relaxed [overflow-wrap:anywhere]">{m.teacherName}</span>
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
  if (status === 'ACTIVE')    return <Badge variant="danger"  className="text-sm">당번</Badge>
  if (status === 'UPCOMING')  return <Badge variant="warning" className="text-sm">예정</Badge>
  if (status === 'CANCELED')  return <Badge className="text-sm bg-gray-100 text-gray-600 border-none">취소</Badge>
  return                             <Badge variant="success" className="text-sm">완료</Badge>
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
