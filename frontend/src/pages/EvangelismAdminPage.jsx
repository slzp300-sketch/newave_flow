import { CollapsePanel } from '../components/common/Motion'
import FitLabel from '../components/common/FitLabel'
import './EvangelismAdminPage.css'
import SegmentedControl from '../components/common/SegmentedControl'
import AdminReadGuard from '../components/common/AdminReadGuard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { evangelismApi, usersApi } from '../api/evangelism'

const TABS = ['조 관리', '일정 관리']

const GROUP_COLORS = [
  { bg: 'bg-primary-100', text: 'text-primary-700', border: 'border-primary-200', dot: 'bg-primary-500', light: 'bg-primary-50' },
  { bg: 'bg-primary-100',   text: 'text-primary-700',   border: 'border-primary-200',   dot: 'bg-primary-500',   light: 'bg-primary-50'   },
  { bg: 'bg-secondary-100',text: 'text-secondary-700',border: 'border-secondary-200',dot: 'bg-secondary-500',light: 'bg-secondary-50'},
  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500',  light: 'bg-amber-50'  },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-200',   dot: 'bg-rose-500',   light: 'bg-rose-50'   },
  { bg: 'bg-primary-100',   text: 'text-primary-700',   border: 'border-primary-200',   dot: 'bg-primary-500',   light: 'bg-primary-50'   },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', light: 'bg-orange-50' },
]
export const getGroupColor = (idx) => GROUP_COLORS[idx % GROUP_COLORS.length]

export default function EvangelismAdminPage() {
  const [tab, setTab] = useState(0)

  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: () => usersApi.getTeachers().then(r => r.data),
  })
  const { data: teachers = [] } = teachersQuery



  return (
    <div className="admin-evangelism-page flex flex-col min-h-screen pb-20">
      <Header title="전도 로테이션 관리" showBack />

      <div className="flex flex-col gap-4 px-4 pt-5">
        <h2 className="text-lg font-bold text-gray-900">조 편성 · 전도 일정</h2>
        <SegmentedControl label="전도 관리 화면" value={tab} onChange={setTab} selectedClassName="text-gray-900"
          options={TABS.map((label, value) => ({ value, label }))} />
      </div>

      <div className="pt-4">
        <AdminReadGuard queries={[teachersQuery]} label="전도 담당 교사 명단">
        <AnimatePresence mode="wait">
          {tab === 0
            ? <GroupManagementTab key="groups" teachers={teachers} />
            : <ScheduleManagementTab key="schedules" teachers={teachers} />
          }
        </AnimatePresence>
        </AdminReadGuard>
      </div>
    </div>
  )
}

// ── 조 관리 탭 ──────────────────────────────────────────────────────────
function GroupManagementTab({ teachers }) {
  const [viewMode, setViewMode] = useViewMode('admin-evangelism-groups', 'large')
  const qc = useQueryClient()
  const [moveSheet, setMoveSheet]       = useState(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [editingId, setEditingId]       = useState(null)
  const [editingName, setEditingName]   = useState('')
  const [search, setSearch]             = useState('')
  const [moving, setMoving]             = useState(false)
  const [activeItem, setActiveItem]     = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const groupsQuery = useQuery({
    queryKey: ['evangelism-groups'],
    queryFn: () => evangelismApi.getGroups().then(r => r.data),
  })

  const { data: groups = [], isLoading } = groupsQuery

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
      await evangelismApi.moveTeacher(teacherId, { fromGroupId, toGroupId })
    } catch (err) {
      alert(err.response?.data?.message || '이동 결과를 확인하지 못했습니다. 목록을 확인해주세요.')
    } finally {
      await qc.invalidateQueries({ predicate: query => String(query.queryKey[0]).startsWith('evangelism-') })
      setMoving(false)
      setMoveSheet(null)
    }
  }

  const renderGroupActions = g => <div className="evangelism-actions flex min-w-0 flex-wrap gap-2">
    {editingId === g.id ? <>
      <input aria-label={`${g.name} 새 이름`} className="evangelism-input w-full" disabled={updateGroupMeta.isPending} value={editingName} onChange={e=>setEditingName(e.target.value)} />
      <button type="button" disabled={updateGroupMeta.isPending || !editingName.trim()} onClick={()=>updateGroupMeta.mutate({id:g.id,data:{name:editingName.trim()}})} className="evangelism-action bg-primary-50 text-primary-800"><FitLabel>{updateGroupMeta.isPending ? '저장 중' : '이름 저장'}</FitLabel></button>
      <button type="button" disabled={updateGroupMeta.isPending} onClick={()=>setEditingId(null)} className="evangelism-action bg-gray-100 text-gray-700"><FitLabel>취소</FitLabel></button>
    </> : <button type="button" aria-label={`${g.name} 이름 수정`} onClick={()=>{setEditingId(g.id);setEditingName(g.name)}} className="evangelism-action bg-white text-gray-700"><Edit2 size={16} aria-hidden="true"/><FitLabel>이름 수정</FitLabel></button>}
    <button type="button" aria-label={`${g.name} 삭제`} disabled={deleteGroup.isPending || moving || updateGroupMeta.isPending} onClick={()=>{if(window.confirm(`${g.name}을(를) 삭제할까요?`)) deleteGroup.mutate(g.id)}} className="evangelism-action bg-red-50 text-red-700"><Trash2 size={16} aria-hidden="true"/><FitLabel>조 삭제</FitLabel></button>
  </div>

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
    <AdminReadGuard queries={[groupsQuery]} label="전도 조 명단"><DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5 pb-4">

        {/* ── 헤더 ── */}
        <div className="px-4 flex flex-col gap-3">
          <div>
            <p className="text-lg font-bold text-gray-900">조 편성 관리</p>
            <p className="text-sm text-gray-600 font-medium mt-1">
              총 {teachers.length}명 · {assignedIds.size}명 배정 · {pool.length}명 대기
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pool.length > 0 && (
              <button onClick={autoBalance} disabled={moving || !groups.length}
                className="evangelism-action bg-primary-50 text-primary-700 font-bold border border-primary-100 active:scale-95 disabled:opacity-50">
                <Shuffle size={18} aria-hidden="true" /> <FitLabel>자동 배분</FitLabel>
              </button>
            )}
            <button onClick={() => setShowAddGroup(true)}
              className="evangelism-action bg-primary-600 text-white font-bold active:scale-95">
              <Plus size={18} aria-hidden="true" /> <FitLabel>조 추가</FitLabel>
            </button>
          </div>
        </div>

        {/* ── 조 추가 폼 ── */}
        <AnimatePresence>
          {showAddGroup && (
            <CollapsePanel className="px-4">
              <Card className="flex flex-wrap items-center gap-2 p-3">
                <input aria-label="새 전도 조 이름" disabled={createGroup.isPending}
                  className="evangelism-input w-full"
                  placeholder="조 이름 (예: 1조)"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newGroupName.trim() && !createGroup.isPending) createGroup.mutate({ name: newGroupName }) }}
                />
                <button disabled={!newGroupName.trim() || createGroup.isPending}
                  onClick={() => createGroup.mutate({ name: newGroupName })}
                  className="evangelism-action bg-primary-600 text-white font-bold disabled:opacity-50"><FitLabel>{createGroup.isPending ? '저장 중' : '추가'}</FitLabel></button>
                <button aria-label="조 추가 닫기" disabled={createGroup.isPending} onClick={() => { setShowAddGroup(false); setNewGroupName('') }} className="evangelism-action text-gray-600"><X size={18} aria-hidden="true"/><FitLabel>취소</FitLabel></button>
              </Card>
            </CollapsePanel>
          )}
        </AnimatePresence>

        {[createGroup, updateGroupMeta, deleteGroup].some(m=>m.isError) && <p role="alert" className="mx-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">조 변경을 저장하지 못했습니다. 다시 시도해 주세요.</p>}
        {!groups.length && <p className="px-4 text-sm text-gray-600">등록된 전도 조가 없습니다.</p>}
        {/* ── 전체 조 카드 (2열 그리드) ── */}
        <div className="px-4"><ViewModeToggle mode={viewMode} onChange={setViewMode} label="전도 조 보기 방식" /></div>
        <div className={`admin-evangelism-records ${viewMode === 'large' ? '' : 'px-4'}`}>
        <RecordViews mode={viewMode} rows={groups} columns={[
          { label: '전도 조', render: g => g.name },
          { label: '인원', render: g => `${g.members?.length ?? 0}명` },
          { label: '조원', action: true, render: g => <div className="flex flex-wrap gap-1.5">{g.members?.length ? g.members.map(m => <button type="button" key={m.id} disabled={moving} onClick={() => setMoveSheet({ teacherId: m.teacherId, teacherName: m.teacherName, fromGroupId: g.id })} className="min-h-11 rounded-xl bg-primary-50 px-3">{m.teacherName} · 이동</button>) : '비어 있음'}</div> },
          { label: '조 관리', action: true, render: renderGroupActions },
        ]}>
        <div className="px-4 grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
          {groups.map((g, idx) => {
            const c = getGroupColor(idx)
            return (
              <GroupDropZone key={g.id} groupId={g.id} color={c}>
                <div className={`${c.light} flex min-w-0 flex-col gap-3 p-3`}>
                  <div className="flex min-w-0 items-start gap-2">
                    <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
                    <div className={`min-w-0 flex-1 text-base font-bold ${c.text}`}><FitLabel>{g.name}</FitLabel></div>
                    <span className={`shrink-0 text-sm font-semibold ${c.text}`}>{g.members?.length ?? 0}명</span>
                  </div>
                  {renderGroupActions(g)}
                </div>

                {/* 멤버 칩 */}
                <div className="bg-white px-2.5 py-2.5 flex flex-wrap gap-1.5 flex-1 min-h-[48px]">
                  {!g.members?.length ? (
                    <p className="w-full text-center text-sm text-gray-600 py-2">비어있음</p>
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
        </RecordViews>
        </div>

        {/* ── 배정 대기 풀 ── */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-lg font-bold text-gray-900">배정 대기 ({pool.length}명)</p>
          </div>
          {pool.length > 0 && (
            <div className="mb-2 relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                aria-label="배정 대기 교사 검색"
                className="w-full min-h-11 pl-9 pr-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-100 text-base focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="교사 이름 검색"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          <PoolDropZone>
            {pool.length === 0 ? (
              <div className="flex items-center justify-center py-3 gap-2 text-secondary-700">
                <Check size={15} /><p className="text-sm font-semibold">{teachers.length ? '모든 교사가 배정되었습니다' : '등록된 교사가 없습니다'}</p>
              </div>
            ) : filteredPool.length === 0 ? (
              <p className="text-center text-sm text-gray-600 py-3">검색 결과 없음</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredPool.map(t => (
                  <PoolChip
                    key={t.id}
                    teacher={t}
                    disabled={moving}
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
    </DndContext></AdminReadGuard>
  )
}

// ── 조 드롭 영역 ──────────────────────────────────────────────────────────
function GroupDropZone({ groupId, color, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId })
  return (
    <div
      ref={setNodeRef}
      className={`brand-card min-w-0 rounded-2xl border-2 ${color.border} overflow-hidden flex flex-col transition-all ${isOver ? 'ring-2 ring-offset-1 ring-primary-400 scale-[1.02]' : ''}`}
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
    disabled,
    data: { teacherId: member.teacherId, teacherName: member.teacherName, fromGroupId: groupId },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className={`flex max-w-full min-w-0 items-center gap-1 pl-2 pr-1 py-1 rounded-lg ${color.bg} ${color.text} text-base font-bold`}
    >
      {/* 드래그 핸들 + 이름 (탭 시 이동 시트) */}
      <button
        onClick={onTap}
        {...attributes} aria-label={`${member.teacherName} 조 이동`}
        disabled={disabled}
        className="flex min-h-11 min-w-0 items-center gap-2 text-left"
      >
        <span {...listeners} className="min-w-0 cursor-grab active:cursor-grabbing touch-none">
          {member.teacherName}
        </span>
        <ArrowRight size={16} className="opacity-60 flex-shrink-0" />
      </button>
      {/* X 버튼 */}
      <button
        aria-label={`${member.teacherName} 조 배정 해제`}
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        disabled={disabled}
        className={`w-11 h-11 rounded-md flex items-center justify-center ${color.bg} opacity-70 hover:opacity-100 flex-shrink-0`}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

// ── 배정대기 칩 (드래그 가능) ────────────────────────────────────────────
function PoolChip({ teacher, onTap, disabled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${teacher.id}`,
    disabled,
    data: { teacherId: teacher.id, teacherName: teacher.name, fromGroupId: null },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className="min-w-0 max-w-full bg-white rounded-xl shadow-sm border border-gray-100"
    >
      <button {...attributes} aria-label={`${teacher.name} 조 배정`} disabled={disabled} onClick={onTap} className="flex min-h-11 min-w-0 max-w-full items-center gap-2 px-3 py-2 text-left active:scale-95">
        <span {...listeners} className="min-w-0 text-base font-bold text-gray-700 cursor-grab active:cursor-grabbing touch-none">
          {teacher.name}
        </span>
        <Plus size={16} className="text-gray-400 flex-shrink-0" />
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
      className="safe-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={() => { if (!moving) onClose() }}
    >
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="전도 조 이동"
        className="safe-modal-panel min-w-0 max-h-[85dvh] overflow-y-auto w-full max-w-mobile bg-white rounded-t-3xl p-4 flex flex-col gap-4"
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-1" />
        <div>
          <p className="font-bold text-gray-900 text-lg">{teacherName}</p>
          <p className="text-sm text-gray-600 mt-1">
            {fromGroupId ? `현재: ${groups.find(g => g.id === fromGroupId)?.name}` : '현재: 배정 없음'}
          </p>
        </div>
        <p className="text-sm font-bold text-gray-600">이동할 조 선택</p>
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
                  className={`min-w-0 flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 ${c.border} ${c.light} active:scale-[0.98] transition-transform disabled:opacity-50`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className={`mt-2 w-2.5 h-2.5 shrink-0 rounded-full ${c.dot}`} />
                    <div className={`min-w-0 flex-1 text-base font-bold ${c.text}`}><FitLabel>{g.name}</FitLabel><span className="mt-1 block text-sm">{g.members?.length ?? 0}명</span></div>
                  </div>
                  <ChevronRight size={16} className={c.text} />
                </button>
              )
            })}
        </div>
        {fromGroupId && (
          <button onClick={onUnassign} disabled={moving}
            className="evangelism-action w-full bg-gray-100 text-gray-700 font-bold text-base active:scale-[0.98] disabled:opacity-50">
            <FitLabel>{moving ? '처리 중...' : '조 배정 해제'}</FitLabel>
          </button>
        )}
        <button onClick={onClose} disabled={moving} className="evangelism-action w-full text-gray-600 font-bold text-base"><FitLabel>취소</FitLabel></button>
      </motion.div>
    </motion.div>
  )
}

// ── 일정 관리 탭 ──────────────────────────────────────────────────────────
function ScheduleManagementTab({ teachers }) {
  const [viewMode, setViewMode] = useViewMode('admin-evangelism-schedules', 'large')
  const qc = useQueryClient()
  const [showForm, setShowForm]       = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({ scheduledDate: '', groupId: '' })

  const scheduleGroupsQuery = useQuery({
    queryKey: ['evangelism-groups'],
    queryFn: () => evangelismApi.getGroups().then(r => r.data),
  })

  const schedulesQuery = useQuery({
    queryKey: ['evangelism-schedules-all'],
    queryFn: () => evangelismApi.getSchedules(false).then(r => r.data),
  })

  const { data: groups = [] } = scheduleGroupsQuery
  const { data: schedules = [], isLoading } = schedulesQuery

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
    <AdminReadGuard queries={[scheduleGroupsQuery, schedulesQuery]} label="전도 일정"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 flex flex-col gap-4 pb-4">
      <button
        onClick={openCreate} disabled={isPending}
        className="flex items-center justify-center gap-2 py-3.5 px-5 bg-primary-600 text-white rounded-2xl font-bold text-base active:scale-[0.98] transition-transform"
      >
        <Plus size={18} aria-hidden="true" /> <FitLabel>새 전도 일정 등록</FitLabel>
      </button>

      <AnimatePresence>
        {showForm && (
          <CollapsePanel>
            <Card className="min-w-0 p-4 flex flex-col gap-5 border-2 border-primary-100 shadow-xl shadow-primary-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-gray-900 text-lg">{editTarget ? '일정 수정' : '새 일정 등록'}</p>
                <button aria-label="일정 작성 닫기" disabled={isPending} onClick={closeForm} className="evangelism-action text-gray-600"><X size={18} aria-hidden="true" /></button>
              </div>
              <div>
                <label htmlFor="admin-evangelism-date" className="text-sm font-bold text-gray-600 mb-2 block">전도 날짜 (토요일)</label>
                <input id="admin-evangelism-date" disabled={isPending} type="date" className="evangelism-input w-full" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-600 mb-2">담당 조</p>
                <div className="flex flex-col gap-2">
                  {groups.map((g, idx) => (
                    <button disabled={isPending} aria-pressed={form.groupId === String(g.id)}
                      key={g.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, groupId: String(g.id) }))}
                      className={`min-w-0 flex flex-col items-stretch gap-2 px-4 py-3 rounded-xl border-2 text-base font-bold transition-all ${
                        form.groupId === String(g.id)
                          ? 'border-primary-400 bg-primary-50 text-primary-700'
                          : 'border-gray-100 bg-gray-50 text-gray-600'
                      }`}
                    >
                      <FitLabel>{g.name}</FitLabel>
                      <span className="text-sm text-gray-600 text-left font-normal">{g.members?.map(m => m.teacherName).join(', ') || '없음'}</span>
                    </button>
                  ))}
                </div>
              </div>
              {!groups.length && <p className="text-sm text-gray-600">조 관리에서 전도 조를 먼저 추가해 주세요.</p>}
              <div className="flex flex-wrap gap-2">
                <button onClick={handleSubmit} disabled={!form.scheduledDate || !form.groupId || isPending} className="evangelism-action flex-1 bg-primary-600 text-white font-bold disabled:opacity-50">
                  <FitLabel>{isPending ? '저장 중...' : (editTarget ? '수정 완료' : '등록')}</FitLabel>
                </button>
                <button disabled={isPending} onClick={closeForm} className="evangelism-action flex-1 bg-gray-100 text-gray-700"><FitLabel>취소</FitLabel></button>
              </div>
            </Card>
          </CollapsePanel>
        )}
      </AnimatePresence>

      {[createMutation, updateMutation, deleteMutation, cancelMutation].some(m=>m.isError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">일정 변경을 저장하지 못했습니다. 다시 시도해 주세요.</p>}
      <p className="text-lg font-bold text-gray-900 px-1 mt-1">예정 일정</p>
      <ViewModeToggle mode={viewMode} onChange={setViewMode} label="전도 일정 보기 방식" />
      {upcoming.length === 0 && !showForm && (
        <Card className="py-8 flex items-center justify-center">
          <p className="text-base text-gray-600">등록된 예정 일정이 없습니다</p>
        </Card>
      )}
      <div className="admin-evangelism-records"><RecordViews mode={viewMode} rows={[...upcoming, ...past]} columns={[
        { label: '전도 일자', render: s => fmtDate(s.scheduledDate) },
        { label: '담당 조', render: s => s.assignments?.[0]?.groupName || '담당 없음' },
        { label: '상태', render: s => <ScheduleStatus status={s.status} /> },
        { label: '관리', action: true, render: s => <ScheduleActions schedule={s} disabled={isPending || cancelMutation.isPending || deleteMutation.isPending} onEdit={()=>openEdit(s)} onDelete={()=>setDeleteTarget(s)} onCancel={()=>{if(window.confirm('일정을 취소하시겠습니까?')) cancelMutation.mutate(s.id)}} /> },
      ]}>
      {upcoming.map((s, i) => (
        <ScheduleAdminCard key={s.id} schedule={s} index={i} groups={groups} disabled={isPending || cancelMutation.isPending || deleteMutation.isPending}
          onEdit={() => openEdit(s)}
          onDelete={() => setDeleteTarget(s)}
          onCancel={() => { if (window.confirm('일정을 취소하시겠습니까?')) cancelMutation.mutate(s.id) }}
        />
      ))}

      {past.length > 0 && (
        <>
          <p className="text-lg font-bold text-gray-900 px-1 mt-2">지난 일정</p>
          {past.map((s, i) => (
            <ScheduleAdminCard key={s.id} schedule={s} index={i} groups={groups} past disabled={isPending || cancelMutation.isPending || deleteMutation.isPending}
              onEdit={() => openEdit(s)} onDelete={() => setDeleteTarget(s)} onCancel={() => cancelMutation.mutate(s.id)}
            />
          ))}
        </>
      )}
      </RecordViews></div>

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
    </motion.div></AdminReadGuard>
  )
}

function ScheduleStatus({ status }) {
  const label = {ACTIVE:'당번',UPCOMING:'예정',COMPLETED:'완료',CANCELED:'취소됨'}[status] || status
  return <span className={`inline-flex max-w-full rounded-lg border px-2.5 py-1 text-sm font-semibold ${status==='ACTIVE' ? 'border-primary-200 bg-primary-50 text-primary-800' : status==='CANCELED' ? 'border-red-200 bg-red-50 text-red-700' : status==='COMPLETED' ? 'border-secondary-200 bg-secondary-50 text-secondary-800' : 'border-gray-200 bg-gray-100 text-gray-700'}`}>{label}</span>
}
function ScheduleActions({ schedule, disabled, onEdit, onDelete, onCancel }) {
  const dateLabel = fmtDate(schedule.scheduledDate)
  return <div className="evangelism-actions flex min-w-0 flex-wrap gap-2">
    {schedule.status !== 'CANCELED' && <>
      <button type="button" disabled={disabled} aria-label={`${dateLabel} 일정 수정`} onClick={onEdit} className="evangelism-action bg-primary-50 text-primary-800"><Edit2 size={16} aria-hidden="true"/><FitLabel>수정</FitLabel></button>
      <button type="button" disabled={disabled} aria-label={`${dateLabel} 일정 취소`} onClick={onCancel} className="evangelism-action bg-amber-50 text-amber-800"><X size={16} aria-hidden="true"/><FitLabel>일정 취소</FitLabel></button>
    </>}
    <button type="button" disabled={disabled} aria-label={`${dateLabel} 일정 삭제`} onClick={onDelete} className="evangelism-action bg-red-50 text-red-700"><Trash2 size={16} aria-hidden="true"/><FitLabel>삭제</FitLabel></button>
  </div>
}
function ScheduleAdminCard({ schedule, index, groups, disabled, onEdit, onDelete, onCancel }) {
  const groupId = schedule.assignments?.[0]?.groupId
  const groupName = schedule.assignments?.[0]?.groupName || '담당 조 없음'
  const count = groups.find(g=>g.id===groupId)?.members?.length
  return <motion.div initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:index*.04}}>
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <p className="text-lg font-bold text-gray-900">{fmtDate(schedule.scheduledDate)}</p>
      <div><ScheduleStatus status={schedule.status}/></div>
      <p className="text-base font-semibold leading-relaxed text-gray-800">{groupName}</p>
      {count != null && <p className="text-sm text-gray-600">조원 {count}명</p>}
      <ScheduleActions schedule={schedule} disabled={disabled} onEdit={onEdit} onDelete={onDelete} onCancel={onCancel}/>
    </Card>
  </motion.div>
}

function DeleteConfirmModal({ schedule, isPending, onConfirm, onCancel }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="safe-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={() => { if (!isPending) onCancel() }}
    >
      <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="전도 일정 삭제 확인"
        className="safe-modal-panel max-h-[85dvh] overflow-y-auto w-full max-w-mobile bg-white rounded-t-3xl p-4 flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">일정을 삭제할까요?</p>
            <p className="text-sm text-gray-600 mt-1">{fmtDate(schedule.scheduledDate)} 전도 일정</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={isPending} className="evangelism-action flex-1 bg-red-600 text-white font-bold disabled:opacity-50">
            <FitLabel>{isPending ? '삭제 중...' : '삭제'}</FitLabel>
          </button>
          <button disabled={isPending} onClick={onCancel} className="evangelism-action flex-1 bg-gray-100 text-gray-700"><FitLabel>취소</FitLabel></button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function fmtDate(dateStr) {
  try { return format(parseISO(dateStr), 'M월 d일 (eee)', { locale: ko }) }
  catch { return dateStr }
}
