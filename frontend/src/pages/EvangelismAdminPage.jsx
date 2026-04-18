import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { format, parseISO, nextSaturday } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  Plus, Trash2, Edit2, X, AlertTriangle,
  Search, Shuffle, ChevronRight, Check, ArrowRight
} from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  closestCenter,
} from '@dnd-kit/core'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { evangelismApi, usersApi } from '../api/evangelism'

const TABS = ['조 관리', '일정 관리']

const GROUP_COLORS = [
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', light: 'bg-violet-50' },
  { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500',   light: 'bg-blue-50'   },
  { bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-200',dot: 'bg-emerald-500',light: 'bg-emerald-50'},
  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500',  light: 'bg-amber-50'  },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-200',   dot: 'bg-rose-500',   light: 'bg-rose-50'   },
  { bg: 'bg-cyan-100',   text: 'text-cyan-700',   border: 'border-cyan-200',   dot: 'bg-cyan-500',   light: 'bg-cyan-50'   },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', light: 'bg-orange-50' },
]
export const getGroupColor = (idx) => GROUP_COLORS[idx % GROUP_COLORS.length]

export default function EvangelismAdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)

  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => usersApi.getTeachers().then(r => r.data),
  })

  if (teachersLoading) return <LoadingSpinner />

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <Header title="전도 로테이션 관리" showBack onBack={() => navigate('/')} />

      <div className="flex mx-4 mt-4 bg-gray-100 rounded-2xl p-1 gap-1">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
              tab === i ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pt-4">
        <AnimatePresence mode="wait">
          {tab === 0
            ? <GroupManagementTab key="groups" teachers={teachers} />
            : <ScheduleManagementTab key="schedules" teachers={teachers} />
          }
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── 조 관리 탭 ──────────────────────────────────────────────────────────
function GroupManagementTab({ teachers }) {
  const qc = useQueryClient()
  const [moveSheet, setMoveSheet]       = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingId, setEditingId]       = useState(null)
  const [editingName, setEditingName]   = useState('')
  const [search, setSearch]             = useState('')
  const [moving, setMoving]             = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['evangelism-groups'],
    queryFn: () => evangelismApi.getGroups().then(r => r.data),
  })

  const createGroup = useMutation({
    mutationFn: (data) => evangelismApi.createGroup(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evangelism-groups'] }); setShowAddGroup(false); setNewGroupName('') },
  })
  const deleteGroup = useMutation({
    mutationFn: (id) => evangelismApi.deleteGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evangelism-groups'] }),
  })
  const updateGroupMeta = useMutation({
    mutationFn: ({ id, data }) => evangelismApi.updateGroup(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evangelism-groups'] }); setEditingId(null) },
  })

  if (isLoading) return <LoadingSpinner />

  const assignedIds = new Set(groups.flatMap(g => g.members?.map(m => m.teacherId) || []))
  const pool = teachers.filter(t => !assignedIds.has(t.id))
  const filteredPool = pool.filter(t => t.name.includes(search))

  const moveTeacher = async (teacherId, fromGroupId, toGroupId) => {
    if (fromGroupId === toGroupId) return
    setMoving(true)
    try {
      if (toGroupId) {
        const tg = groups.find(g => g.id === toGroupId)
        const ids = [...(tg?.members?.map(m => m.teacherId) || []), teacherId]
        await evangelismApi.updateGroupMembers(toGroupId, { teacherIds: ids })
      }
      if (fromGroupId) {
        const sg = groups.find(g => g.id === fromGroupId)
        const ids = (sg?.members || []).filter(m => m.teacherId !== teacherId).map(m => m.teacherId)
        await evangelismApi.updateGroupMembers(fromGroupId, { teacherIds: ids })
      }
      await qc.invalidateQueries({ queryKey: ['evangelism-groups'] })
    } finally {
      setMoving(false)
      setMoveSheet(null)
    }
  }

  const autoBalance = async () => {
    if (groups.length === 0 || pool.length === 0) return
    setMoving(true)
    try {
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      const groupsCopy = groups.map(g => ({ id: g.id, pendingIds: g.members?.map(m => m.teacherId) || [] }))
      shuffled.forEach((t, i) => groupsCopy[i % groupsCopy.length].pendingIds.push(t.id))
      for (const g of groupsCopy) {
        await evangelismApi.updateGroupMembers(g.id, { teacherIds: g.pendingIds })
      }
      await qc.invalidateQueries({ queryKey: ['evangelism-groups'] })
    } finally {
      setMoving(false)
    }
  }

  const [activeItem, setActiveItem] = useState(null)

  const handleDragStart = (event) => {
    setActiveItem(event.active.data.current)
  }

  const handleDragEnd = (event) => {
    setActiveItem(null)

    const { active, over } = event
    if (!over) return
    const { teacherId, fromGroupId } = active.data.current
    const toGroupId = over.id === 'pool' ? null : over.id
    moveTeacher(teacherId, fromGroupId, toGroupId)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5 pb-4">

        {/* ── 헤더 ── */}
        <div className="px-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">조 편성 관리</p>
            <p className="text-xs text-gray-500 font-bold mt-0.5">
              총 {teachers.length}명 · {assignedIds.size}명 배정 · {pool.length}명 대기
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pool.length > 0 && (
              <button onClick={autoBalance} disabled={moving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-50 text-primary-700 text-[11px] font-black border border-primary-100 active:scale-95 disabled:opacity-50">
                <Shuffle size={12} /> 자동 배분
              </button>
            )}
            <button onClick={() => setShowAddGroup(true)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary-600 text-white text-[11px] font-black active:scale-95">
              <Plus size={13} /> 조 추가
            </button>
          </div>
        </div>

        {/* ── 조 추가 폼 ── */}
        <AnimatePresence>
          {showAddGroup && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-4">
              <Card className="flex items-center gap-2 p-3">
                <input autoFocus
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="조 이름 (예: 1조)"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newGroupName) createGroup.mutate({ name: newGroupName }) }}
                />
                <button disabled={!newGroupName || createGroup.isPending}
                  onClick={() => createGroup.mutate({ name: newGroupName })}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-black disabled:opacity-50">추가</button>
                <button onClick={() => { setShowAddGroup(false); setNewGroupName('') }} className="p-2 text-gray-400"><X size={16} /></button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 전체 조 카드 (2열 그리드) ── */}
        <div className="px-4 grid grid-cols-2 gap-3">
          {groups.map((g, idx) => {
            const c = getGroupColor(idx)
            return (
              <GroupDropZone key={g.id} groupId={g.id} color={c}>
                {/* 조 헤더 */}
                <div className={`${c.light} px-3 py-2.5 flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    {editingId === g.id ? (
                      <input autoFocus
                        className="text-xs font-black bg-transparent border-b border-current focus:outline-none w-14"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => updateGroupMeta.mutate({ id: g.id, data: { name: editingName } })}
                        onKeyDown={e => { if (e.key === 'Enter') updateGroupMeta.mutate({ id: g.id, data: { name: editingName } }) }}
                      />
                    ) : (
                      <span className={`text-xs font-black truncate ${c.text}`}>{g.name}</span>
                    )}
                    <span className={`text-[10px] font-bold ${c.text} opacity-60 flex-shrink-0`}>{g.members?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => { setEditingId(g.id); setEditingName(g.name) }}
                      className="p-1 rounded-md bg-white/60 text-gray-400 active:scale-95"><Edit2 size={11} /></button>
                    <button onClick={() => { if (window.confirm(`${g.name}을(를) 삭제할까요?`)) deleteGroup.mutate(g.id) }}
                      className="p-1 rounded-md bg-white/60 text-gray-400 active:scale-95"><Trash2 size={11} /></button>
                  </div>
                </div>

                {/* 멤버 칩 */}
                <div className="bg-white px-2.5 py-2.5 flex flex-wrap gap-1.5 flex-1 min-h-[48px]">
                  {g.members?.length === 0 ? (
                    <p className="w-full text-center text-[10px] text-gray-300 py-2">비어있음</p>
                  ) : (
                    g.members.map(m => (
                      <MemberChip
                        key={m.id}
                        member={m}
                        groupId={g.id}
                        color={c}
                        onTap={() => setMoveSheet({ teacherId: m.teacherId, teacherName: m.teacherName, fromGroupId: g.id })}
                        onRemove={() => moveTeacher(m.teacherId, g.id, null)}
                        disabled={moving}
                      />
                    ))
                  )}
                </div>
              </GroupDropZone>
            )
          })}
        </div>

        {/* ── 배정 대기 풀 ── */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">배정 대기 ({pool.length}명)</p>
          </div>
          {pool.length > 0 && (
            <div className="mb-2 relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="교사 이름 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          <PoolDropZone>
            {pool.length === 0 ? (
              <div className="flex items-center justify-center py-3 gap-2 text-emerald-500">
                <Check size={15} /><p className="text-xs font-black">모든 교사가 배정되었습니다</p>
              </div>
            ) : filteredPool.length === 0 ? (
              <p className="text-center text-xs text-gray-300 py-3">검색 결과 없음</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredPool.map(t => (
                  <PoolChip
                    key={t.id}
                    teacher={t}
                    onTap={() => setMoveSheet({ teacherId: t.id, teacherName: t.name, fromGroupId: null })}
                  />
                ))}
              </div>
            )}
          </PoolDropZone>
        </div>

        {/* ── 이동 Bottom Sheet ── */}
        <AnimatePresence>
          {moveSheet && (
            <MoveSheet
              teacherName={moveSheet.teacherName}
              fromGroupId={moveSheet.fromGroupId}
              groups={groups}
              moving={moving}
              onMove={(toGroupId) => moveTeacher(moveSheet.teacherId, moveSheet.fromGroupId, toGroupId)}
              onUnassign={() => moveTeacher(moveSheet.teacherId, moveSheet.fromGroupId, null)}
              onClose={() => setMoveSheet(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* dropAnimation={null} — 드롭 후 복귀 애니메이션 제거 */}
      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="px-2.5 py-1.5 rounded-lg bg-white shadow-lg border border-gray-200 text-xs font-bold text-gray-700">
            {activeItem.teacherName}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ── 조 드롭 영역 ──────────────────────────────────────────────────────────
function GroupDropZone({ groupId, color, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 ${color.border} overflow-hidden flex flex-col transition-all ${isOver ? 'ring-2 ring-offset-1 ring-primary-400 scale-[1.02]' : ''}`}
    >
      {children}
    </div>
  )
}

// ── 배정대기 드롭 영역 ────────────────────────────────────────────────────
function PoolDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border border-dashed p-3 min-h-[52px] transition-all ${isOver ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300' : 'border-gray-200 bg-gray-50'}`}
    >
      {children}
    </div>
  )
}

// ── 조원 칩 (드래그 가능 + X 버튼) ──────────────────────────────────────
function MemberChip({ member, groupId, color, onTap, onRemove, disabled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `member-${member.teacherId}`,
    data: { teacherId: member.teacherId, teacherName: member.teacherName, fromGroupId: groupId },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className={`flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg ${color.bg} ${color.text} text-[11px] font-bold`}
    >
      {/* 드래그 핸들 + 이름 (탭 시 이동 시트) */}
      <button
        onClick={onTap}
        disabled={disabled}
        className="flex items-center gap-1 min-w-0"
      >
        <span {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
          {member.teacherName}
        </span>
        <ArrowRight size={9} className="opacity-60 flex-shrink-0" />
      </button>
      {/* X 버튼 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        disabled={disabled}
        className={`w-4 h-4 rounded-md flex items-center justify-center ${color.bg} opacity-70 hover:opacity-100 flex-shrink-0`}
      >
        <X size={9} />
      </button>
    </div>
  )
}

// ── 배정대기 칩 (드래그 가능) ────────────────────────────────────────────
function PoolChip({ teacher, onTap }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${teacher.id}`,
    data: { teacherId: teacher.id, teacherName: teacher.name, fromGroupId: null },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100"
    >
      <button onClick={onTap} className="flex items-center gap-1.5 px-3 py-2 active:scale-95">
        <span {...listeners} {...attributes} className="text-xs font-bold text-gray-700 cursor-grab active:cursor-grabbing touch-none">
          {teacher.name}
        </span>
        <Plus size={11} className="text-gray-400 flex-shrink-0" />
      </button>
    </div>
  )
}

// ── 이동 시트 ──────────────────────────────────────────────────────────
function MoveSheet({ teacherName, fromGroupId, groups, moving, onMove, onUnassign, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-mobile bg-white rounded-t-3xl p-6 flex flex-col gap-4 safe-bottom"
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-1" />
        <div>
          <p className="font-black text-gray-900 text-base">{teacherName}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {fromGroupId ? `현재: ${groups.find(g => g.id === fromGroupId)?.name}` : '현재: 배정 없음'}
          </p>
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">이동할 조 선택</p>
        <div className="flex flex-col gap-2">
          {groups
            .filter(g => g.id !== fromGroupId)
            .map((g) => {
              const realIdx = groups.findIndex(gr => gr.id === g.id)
              const c = getGroupColor(realIdx)
              return (
                <button
                  key={g.id}
                  onClick={() => onMove(g.id)}
                  disabled={moving}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 ${c.border} ${c.light} active:scale-[0.98] transition-transform disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span className={`font-black text-sm ${c.text}`}>{g.name}</span>
                    <span className={`text-[11px] font-bold ${c.text} opacity-60`}>{g.members?.length ?? 0}명</span>
                  </div>
                  <ChevronRight size={16} className={c.text} />
                </button>
              )
            })}
        </div>
        {fromGroupId && (
          <button onClick={onUnassign} disabled={moving}
            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-black text-sm active:scale-[0.98] disabled:opacity-50">
            {moving ? '처리 중...' : '조 배정 해제'}
          </button>
        )}
        <button onClick={onClose} disabled={moving} className="w-full py-3 text-gray-400 font-bold text-sm">취소</button>
      </motion.div>
    </motion.div>
  )
}

// ── 일정 관리 탭 ──────────────────────────────────────────────────────────
function ScheduleManagementTab({ teachers }) {
  const qc = useQueryClient()
  const [showForm, setShowForm]       = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({ scheduledDate: '', groupId: '' })

  const { data: groups = [] } = useQuery({
    queryKey: ['evangelism-groups'],
    queryFn: () => evangelismApi.getGroups().then(r => r.data),
  })

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['evangelism-schedules-all'],
    queryFn: () => evangelismApi.getSchedules(false).then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data) => evangelismApi.createSchedule(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evangelism-schedules-all'] }); closeForm() },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => evangelismApi.updateSchedule(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evangelism-schedules-all'] }); closeForm() },
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => evangelismApi.deleteSchedule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evangelism-schedules-all'] }); setDeleteTarget(null) },
  })
  const cancelMutation = useMutation({
    mutationFn: (id) => evangelismApi.cancelSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evangelism-schedules-all'] }),
  })

  if (isLoading) return <LoadingSpinner />

  const openCreate = () => {
    setEditTarget(null)
    setForm({ scheduledDate: format(nextSaturday(new Date()), 'yyyy-MM-dd'), groupId: '' })
    setShowForm(true)
  }
  const openEdit = (s) => {
    setEditTarget(s.id)
    setForm({ scheduledDate: s.scheduledDate, groupId: String(s.assignments?.[0]?.groupId ?? '') })
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditTarget(null) }
  const handleSubmit = () => {
    if (!form.scheduledDate) return
    const payload = { scheduledDate: form.scheduledDate, groupId: form.groupId ? parseInt(form.groupId) : null }
    if (editTarget) updateMutation.mutate({ id: editTarget, data: payload })
    else            createMutation.mutate(payload)
  }

  const upcoming = schedules.filter(s => s.status !== 'COMPLETED' && s.status !== 'CANCELED')
  const past     = schedules.filter(s => s.status === 'COMPLETED' || s.status === 'CANCELED')
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 flex flex-col gap-3 pb-4">
      {!showForm && (
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 py-3.5 px-5 bg-primary-600 text-white rounded-2xl font-black text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={18} /> 새 전도 일정 등록
        </button>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="flex flex-col gap-4 border border-primary-100 bg-primary-50/50">
              <div className="flex items-center justify-between">
                <p className="font-black text-gray-900 text-sm">{editTarget ? '일정 수정' : '새 일정 등록'}</p>
                <button onClick={closeForm} className="text-gray-400"><X size={18} /></button>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">전도 날짜 (토요일)</span>
                <input type="date" className="input-field text-sm" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">담당 조</span>
                <select className="input-field text-sm bg-white" value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}>
                  <option value="">조를 선택하세요</option>
                  {groups.map((g, idx) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.members?.length || 0}명)</option>
                  ))}
                </select>
                {form.groupId && (
                  <p className="text-[10px] text-gray-400 pl-1">
                    담당자: {groups.find(g => g.id === parseInt(form.groupId))?.members?.map(m => m.teacherName).join(', ') || '없음'}
                  </p>
                )}
              </label>
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={!form.scheduledDate || !form.groupId || isPending} className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-black text-sm disabled:opacity-50">
                  {isPending ? '저장 중...' : (editTarget ? '수정 완료' : '등록')}
                </button>
                <button onClick={closeForm} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-sm">취소</button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 mt-1">예정 일정</p>
      {upcoming.length === 0 && !showForm && (
        <Card className="py-8 flex items-center justify-center">
          <p className="text-sm text-gray-400">등록된 예정 일정이 없습니다</p>
        </Card>
      )}
      {upcoming.map((s, i) => (
        <ScheduleAdminCard key={s.id} schedule={s} index={i} groups={groups}
          onEdit={() => openEdit(s)}
          onDelete={() => setDeleteTarget(s)}
          onCancel={() => { if (window.confirm('일정을 취소하시겠습니까?')) cancelMutation.mutate(s.id) }}
        />
      ))}

      {past.length > 0 && (
        <>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1 mt-2">지난 일정</p>
          {past.map((s, i) => (
            <ScheduleAdminCard key={s.id} schedule={s} index={i} groups={groups} past
              onEdit={() => openEdit(s)} onDelete={() => setDeleteTarget(s)} onCancel={() => cancelMutation.mutate(s.id)}
            />
          ))}
        </>
      )}

      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmModal
            schedule={deleteTarget}
            isPending={deleteMutation.isPending}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ScheduleAdminCard({ schedule, index, groups, past, onEdit, onDelete, onCancel }) {
  const dateStr = fmtDate(schedule.scheduledDate)
  const groupId = schedule.assignments?.[0]?.groupId
  const groupIdx = groups.findIndex(g => g.id === groupId)
  const color = getGroupColor(groupIdx >= 0 ? groupIdx : 0)
  const groupName = schedule.assignments?.[0]?.groupName || '담당 없음'
  const memberCount = groups.find(g => g.id === groupId)?.members?.length

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}>
      <Card className={`flex items-center gap-3 py-4 px-4 ${past ? 'opacity-50' : ''}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${schedule.status === 'ACTIVE' ? 'bg-red-500' : schedule.status === 'CANCELED' ? 'bg-gray-300' : 'bg-amber-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">{dateStr}</p>
            {schedule.status === 'ACTIVE' && <Badge variant="danger" className="text-[9px]">당번</Badge>}
            {schedule.status === 'CANCELED' && <Badge variant="gray" className="text-[9px] bg-gray-200 text-gray-500 border-none">취소됨</Badge>}
          </div>
          {groupId ? (
            <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${color.bg} ${color.text}`}>
              {groupName} {memberCount != null ? `· ${memberCount}명` : ''}
            </span>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">담당 조 없음</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {schedule.status !== 'CANCELED' && (
            <>
              <button onClick={onEdit} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95">
                <Edit2 size={13} className="text-gray-500" />
              </button>
              <button onClick={onCancel} className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center active:scale-95">
                <X size={13} className="text-amber-600" />
              </button>
            </>
          )}
          <button onClick={onDelete} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center active:scale-95">
            <Trash2 size={13} className="text-red-400" />
          </button>
        </div>
      </Card>
    </motion.div>
  )
}

function DeleteConfirmModal({ schedule, isPending, onConfirm, onCancel }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={e => e.stopPropagation()}
        className="w-full max-w-mobile bg-white rounded-t-3xl p-6 flex flex-col gap-4 safe-bottom"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="font-black text-gray-900">일정을 삭제할까요?</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(schedule.scheduledDate)} 전도 일정</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={isPending} className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black text-sm disabled:opacity-50">
            {isPending ? '삭제 중...' : '삭제'}
          </button>
          <button onClick={onCancel} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm">취소</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function fmtDate(dateStr) {
  try { return format(parseISO(dateStr), 'M월 d일 (eee)', { locale: ko }) }
  catch { return dateStr }
}
