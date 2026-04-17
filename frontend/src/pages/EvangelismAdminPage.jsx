import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { format, parseISO, addWeeks, nextSaturday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Plus, Trash2, Edit2, X, Check, ChevronDown, ChevronUp, Users, AlertTriangle, GripVertical, UserPlus } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { evangelismApi, usersApi } from '../api/evangelism'

const TABS = ['조 관리', '일정 관리']

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

      <div className="px-4 pt-4">
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
  const [editingId, setEditingId]   = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editForm, setEditForm]     = useState({ name: '' })
  const [addForm, setAddForm]       = useState({ name: '' })
  const [draggedTeacherId, setDraggedTeacherId] = useState(null)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['evangelism-groups'],
    queryFn: () => evangelismApi.getGroups().then(r => r.data),
  })

  // Mutations
  const createGroup = useMutation({
    mutationFn: (data) => evangelismApi.createGroup(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evangelism-groups'] })
      setShowAddForm(false)
      setAddForm({ name: '', description: '' })
    },
  })

  const deleteGroup = useMutation({
    mutationFn: (id) => evangelismApi.deleteGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evangelism-groups'] }),
  })

  const updateGroupMeta = useMutation({
    mutationFn: ({ id, data }) => evangelismApi.updateGroup(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evangelism-groups'] })
      setEditingId(null)
    },
  })

  const updateMembers = useMutation({
    mutationFn: ({ id, data }) => evangelismApi.updateGroupMembers(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evangelism-groups'] }),
  })

  if (isLoading) return <LoadingSpinner />

  // Helpers
  const assignedTeacherIds = new Set(groups.flatMap(g => g.members?.map(m => m.teacherId) || []))
  const teacherPool = teachers.filter(t => !assignedTeacherIds.has(t.id))

  const handleDragStart = (e, teacherId) => {
    setDraggedTeacherId(teacherId)
    e.dataTransfer.setData('teacherId', teacherId)
  }

  const handleDrop = (e, targetGroupId) => {
    e.preventDefault()
    const teacherId = parseInt(e.dataTransfer.getData('teacherId'))
    if (isNaN(teacherId)) return

    // Find current group of this teacher (if any)
    const sourceGroup = groups.find(g => g.members?.some(m => m.teacherId === teacherId))
    const targetGroup = groups.find(g => g.id === targetGroupId)

    if (sourceGroup?.id === targetGroupId) return // Same group

    // Add to target group
    const targetIds = [...(targetGroup.members?.map(m => m.teacherId) || []), teacherId]
    updateMembers.mutate({ id: targetGroupId, data: { teacherIds: targetIds } })

    // If moved from another group, the backend updateGroupMembers for the target group
    // is enough if we assume a teacher belongs to only one group.
    // However, our backend updateMembers REPLACES the members, so we don't need to manually remove from source
    // UNLESS the teacher can be in multiple groups.
    // Given the request "드래그해서 옮겨 수정하는 형식", we'll assume 1-to-1 or just handle removal if it exists.
    if (sourceGroup) {
      const sourceIds = sourceGroup.members.filter(m => m.teacherId !== teacherId).map(m => m.teacherId)
      updateMembers.mutate({ id: sourceGroup.id, data: { teacherIds: sourceIds } })
    }
  }

  const handleRemoveMember = (groupId, teacherId) => {
    const group = groups.find(g => g.id === groupId)
    const newIds = group.members.filter(m => m.teacherId !== teacherId).map(m => m.teacherId)
    updateMembers.mutate({ id: groupId, data: { teacherIds: newIds } })
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 pb-4">
      
      {/* 교사 풀 (대기 명단) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">배정 대기 명단 ({teacherPool.length})</p>
        </div>
        <Card className="bg-gray-50 border-dashed border-2 border-gray-200 min-h-[80px] p-3 flex flex-wrap gap-2">
          {teacherPool.length === 0 ? (
            <p className="text-xs text-gray-300 w-full text-center py-4">모든 교사가 배정되었습니다</p>
          ) : (
            teacherPool.map(t => (
              <motion.div
                key={t.id}
                draggable
                onDragStart={(e) => handleDragStart(e, t.id)}
                className="bg-white px-3 py-2 rounded-xl text-xs font-bold text-gray-700 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing flex items-center gap-2 group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <GripVertical size={12} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
                {t.name}
              </motion.div>
            ))
          )}
        </Card>
      </section>

      {/* 조 구성 그리드 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">전도 조 관리</p>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1.5 px-3 rounded-lg bg-primary-600 text-white text-[10px] font-black shadow-sm"
          >
            + 조 추가
          </button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Card className="flex flex-col gap-3 border border-primary-100 bg-primary-50/30">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-black text-primary-700">새 조 등록</p>
                  <button onClick={() => setShowAddForm(false)} className="text-gray-400"><X size={16} /></button>
                </div>
                <input
                  className="input-field text-sm"
                  value={addForm.name}
                  onChange={e => setAddForm({ name: e.target.value })}
                  placeholder="조 이름 (예: 1조)"
                />
                <button
                  disabled={!addForm.name || createGroup.isPending}
                  onClick={() => createGroup.mutate(addForm)}
                  className="py-2.5 bg-primary-600 text-white rounded-xl text-sm font-black disabled:opacity-50"
                >
                  {createGroup.isPending ? '등록 중...' : '조 생성하기'}
                </button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <motion.div
              key={g.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, g.id)}
              className="group"
            >
              <Card className="h-full flex flex-col gap-3 min-h-[160px] border-2 border-transparent hover:border-primary-100 transition-colors bg-white shadow-sm">
                
                {/* 조 헤더 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Users size={16} className="text-violet-600" />
                    </div>
                    {editingId === g.id ? (
                      <input
                        className="input-field text-xs py-1 px-2 h-7 w-24"
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        onBlur={() => updateGroupMeta.mutate({ id: g.id, data: editForm })}
                        autoFocus
                      />
                    ) : (
                      <p className="font-black text-gray-900 text-sm">{g.name}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingId(g.id); setEditForm({ name: g.name }) }}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => { if(window.confirm(`${g.name}을(를) 삭제하시겠습니까?`)) deleteGroup.mutate(g.id)}}
                      className="p-1.5 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 조원 목록 (Drop Target Inner) */}
                <div className="flex-1 flex flex-wrap gap-2 content-start p-2 rounded-xl bg-gray-50/50 min-h-[60px]">
                  {g.members?.length === 0 ? (
                    <div className="w-full flex flex-col items-center justify-center py-4 text-gray-300">
                      <UserPlus size={18} className="mb-1 opacity-50" />
                      <p className="text-[10px] font-bold">여기로 교사를 드래그하세요</p>
                    </div>
                  ) : (
                    g.members.map(m => (
                      <motion.div
                        key={m.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, m.teacherId)}
                        className="bg-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-violet-700 shadow-sm border border-violet-100 flex items-center gap-1.5 cursor-grab active:cursor-grabbing"
                        layoutId={`teacher-${m.teacherId}`}
                      >
                        {m.teacherName}
                        <button onClick={() => handleRemoveMember(g.id, m.teacherId)} className="text-violet-300 hover:text-violet-500 ml-0.5">
                          <X size={10} />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </motion.div>
  )
}

// ── 일정 관리 탭 ──────────────────────────────────────────────────────────
function ScheduleManagementTab({ teachers }) {
  const qc = useQueryClient()
  const [showForm, setShowForm]       = useState(false)
  const [editTarget, setEditTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState({
    scheduledDate: '',
    periodLabel: '',
    note: '',
    groupId: '', // Changed from selectedTeacherIds
  })

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evangelism-schedules-all'] })
      setDeleteTarget(null)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id) => evangelismApi.cancelSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evangelism-schedules-all'] }),
  })

  if (isLoading) return <LoadingSpinner />

  const openCreate = () => {
    setEditTarget(null)
    const nextSat = format(nextSaturday(new Date()), 'yyyy-MM-dd')
    setForm({ scheduledDate: nextSat, groupId: '' })
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditTarget(s.id)
    const firstGroupId = s.assignments?.[0]?.groupId || ''
    setForm({
      scheduledDate: s.scheduledDate,
      groupId: firstGroupId,
    })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditTarget(null) }

  const handleSubmit = () => {
    if (!form.scheduledDate) return
    const payload = {
      scheduledDate: form.scheduledDate,
      groupId: form.groupId ? parseInt(form.groupId) : null,
    }
    if (editTarget) updateMutation.mutate({ id: editTarget, data: payload })
    else            createMutation.mutate(payload)
  }

  const upcoming = schedules.filter(s => s.status !== 'COMPLETED' && s.status !== 'CANCELED')
  const past     = schedules.filter(s => s.status === 'COMPLETED' || s.status === 'CANCELED')
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3 pb-4">

      {/* 새 일정 등록 버튼 */}
      {!showForm && (
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 py-3.5 px-5 bg-primary-600 text-white rounded-2xl font-black text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={18} />
          새 전도 일정 등록
        </button>
      )}

      {/* 등록/수정 폼 */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="flex flex-col gap-4 border border-primary-100 bg-primary-50/50">
              <div className="flex items-center justify-between">
                <p className="font-black text-gray-900 text-sm">
                  {editTarget ? '일정 수정' : '새 일정 등록'}
                </p>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              {/* 날짜 */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">전도 날짜 (토요일 선택)</span>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={form.scheduledDate}
                  onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                />
              </label>

              {/* 담당 조 선택 */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">담당 조 선택</span>
                <select
                  className="input-field text-sm bg-white"
                  value={form.groupId}
                  onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}
                >
                  <option value="">조를 선택하세요</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.members?.length || 0}명)</option>
                  ))}
                </select>
                {form.groupId && (
                  <p className="text-[10px] text-gray-400 mt-1 pl-1">
                    담당자: {groups.find(g => g.id === parseInt(form.groupId))?.members?.map(m => m.teacherName).join(', ') || '없음'}
                  </p>
                )}
              </label>

              {/* 제출 */}
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!form.scheduledDate || !form.groupId || isPending}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-black text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  {isPending ? '저장 중...' : (editTarget ? '수정 완료' : '등록')}
                </button>
                <button
                  onClick={closeForm}
                  className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-sm"
                >
                  취소
                </button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 예정 일정 */}
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 mt-1">예정 일정</p>

      {upcoming.length === 0 && !showForm && (
        <Card className="py-8 flex items-center justify-center">
          <p className="text-sm text-gray-400">등록된 예정 일정이 없습니다</p>
        </Card>
      )}

      {upcoming.map((s, i) => (
        <ScheduleAdminCard
          key={s.id}
          schedule={s}
          index={i}
          onEdit={() => openEdit(s)}
          onDelete={() => setDeleteTarget(s)}
          onCancel={() => {
            if (window.confirm('일정을 취소하시겠습니까? (기록은 남습니다)')) {
              cancelMutation.mutate(s.id)
            }
          }}
        />
      ))}

      {/* 지난 일정 */}
      {past.length > 0 && (
        <>
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1 mt-2">지난 일정</p>
          {past.map((s, i) => (
            <ScheduleAdminCard
              key={s.id}
              schedule={s}
              index={i}
              past
              onEdit={() => openEdit(s)}
              onDelete={() => setDeleteTarget(s)}
              onCancel={() => cancelMutation.mutate(s.id)}
            />
          ))}
        </>
      )}

      {/* 삭제 확인 모달 */}
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

// ── 일정 카드 ──────────────────────────────────────────────────────────
function ScheduleAdminCard({ schedule, index, past, onEdit, onDelete }) {
  const dateStr   = fmtDate(schedule.scheduledDate)
  const assignees = schedule.assignments?.map(a => `${a.groupName} ${a.teacherName}`).join(' · ') ?? ''

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className={`flex items-center gap-3 py-4 px-4 ${past ? 'opacity-50' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900 text-sm">{dateStr}</p>
            {schedule.status === 'ACTIVE' && <Badge variant="danger" className="text-[9px]">당번</Badge>}
            {schedule.status === 'CANCELED' && <Badge variant="gray" className="text-[9px] bg-gray-200 text-gray-500 border-none">취소됨</Badge>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {assignees || '담당자 없음'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {schedule.status !== 'CANCELED' && (
            <>
              <button
                onClick={onEdit}
                className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
              >
                <Edit2 size={13} className="text-gray-500" />
              </button>
              <button
                onClick={onCancel}
                className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center active:scale-95 transition-transform"
                title="일정 취소"
              >
                <X size={13} className="text-amber-600" />
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center active:scale-95 transition-transform"
            title="기록 삭제"
          >
            <Trash2 size={13} className="text-red-400" />
          </button>
        </div>
      </Card>
    </motion.div>
  )
}

// ── 삭제 확인 모달 ──────────────────────────────────────────────────────────
function DeleteConfirmModal({ schedule, isPending, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        onClick={e => e.stopPropagation()}
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
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black text-sm disabled:opacity-50"
          >
            {isPending ? '삭제 중...' : '삭제'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm"
          >
            취소
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function fmtDate(dateStr) {
  try {
    return format(parseISO(dateStr), 'M월 d일 (eee)', { locale: ko })
  } catch {
    return dateStr
  }
}
