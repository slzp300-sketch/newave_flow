import SearchField from '../components/common/SearchField'
import { AdminIntro, FilterResults, AdminEmpty } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import QueryNotice from '../components/common/QueryNotice'
import { useLayoutEffect, useRef, useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, X, Loader2, UserMinus, CheckCircle2, Search, ChevronRight } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import Button from '../components/common/Button'
import { classesApi } from '../api/classes'
import { usersApi } from '../api/users'

export default function AdminClassManagePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useViewMode('admin-class-assignment', 'large')
  const [selectedClassId, setSelectedClassId] = usePersistedState('selectedClassId', null)
  const [activeGrade, setActiveGrade] = usePersistedState('activeGrade', '전체')

  const rosterQuery = useQuery({
    queryKey: ['admin-roster-full'],
    queryFn: () => classesApi.getRoster().then(r => r.data),
  })
  const { data: roster = [], isLoading: isRosterLoading } = rosterQuery

  const usersQuery = useQuery({
    queryKey: ['all-users-pool'],
    queryFn: () => usersApi.getAll().then(r => r.data),
  })
  const { data: users = [], isLoading: isUsersLoading } = usersQuery

  const activeClass = roster.find(c => c.id === selectedClassId)

  const groupedClasses = roster.reduce((acc, cls) => {
    if (!acc[cls.grade]) acc[cls.grade] = []
    acc[cls.grade].push(cls)
    return acc
  }, {})
  Object.values(groupedClasses).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })))

  const grades = ['전체', ...Object.keys(groupedClasses).sort((a, b) => {
    const priority = { '중': 1, '고': 2 }
    const aPrefix = a[0]
    const bPrefix = b[0]
    
    if (priority[aPrefix] !== priority[bPrefix]) {
      return priority[aPrefix] - priority[bPrefix]
    }
    return a.localeCompare(b)
  })]

  const isLoading = isRosterLoading || isUsersLoading

  const sortedGradeKeys = grades.filter(g => g !== '전체')

  const gradeEntries = activeGrade === '전체'
    ? sortedGradeKeys.map(g => [g, groupedClasses[g] || []])
    : [[activeGrade, groupedClasses[activeGrade] || []]]

  const displayedEntries = gradeEntries.map(([grade, classes]) => [grade, classes.filter(cls => matchesAdminSearch(search, cls.name, cls.grade, cls.teachers?.map(t => t.name)))]).filter(([, classes]) => classes.length)
  const resultCount = displayedEntries.reduce((sum, [, classes]) => sum + classes.length, 0)

  const assignedOtherClassUserIds = new Set(
    roster
      .filter(c => c.id !== selectedClassId)
      .flatMap(c => (c.teachers || []).map(t => t.id))
  )

  return (
    <div className="flex flex-col min-h-screen pb-24 bg-gray-50/50">
      <Header title="반 담임/부담임 관리" showBack />

      <div className="flex flex-col gap-4 px-4 py-5">
        <AdminIntro title="반마다 담당 교사를 연결해요" description="반을 선택해 담임·부담임을 배정하거나 변경하세요." />
        <SearchField label="반과 담당 교사 검색" value={search} onChange={setSearch} placeholder="학년, 반 또는 교사 이름 검색" />
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>
      {!isLoading && (
        <div className="bg-white border-b border-gray-100 flex overflow-x-auto no-scrollbar px-4 py-2 gap-2 ">
          {grades.map(g => (
            <button
              key={g}
              aria-pressed={activeGrade === g}
              onClick={() => setActiveGrade(g)}
              className={`flex-shrink-0 min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeGrade === g 
                  ? 'bg-primary-500 text-white shadow-lg' 
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {rosterQuery.isError || usersQuery.isError ? <QueryNotice queries={[rosterQuery, usersQuery]} label="반과 교사 명단" /> : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-6 flex flex-col gap-8">
          <FilterResults count={resultCount} total={roster.length} unit="반" filtered={!!search.trim() || activeGrade !== '전체'} onReset={() => { setSearch(''); setActiveGrade('전체') }} />
          {!resultCount && <AdminEmpty />}
          <RecordViews mode={viewMode} rows={displayedEntries.flatMap(([, classes]) => classes)} onRowClick={cls => setSelectedClassId(cls.id)} columns={[
            { label: '반', render: cls => cls.name },
            { label: '학년', render: cls => cls.grade },
            { label: '담당 교사', render: cls => cls.teachers?.map(t => t.name).join(', ') || '미배정' },
            { label: '학생 수', render: cls => `${cls.students?.length ?? 0}명` },
          ]}>
          {displayedEntries.map(([grade, classes], gIdx) => (
            <motion.div 
              key={grade}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gIdx * 0.1 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 px-1">
                 <div className="w-1 h-4 bg-primary-500 rounded-full" />
                 <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">{grade}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
                {classes.map(cls => (
                  <ClassAssignmentCard 
                    key={cls.id} 
                    cls={cls} 
                    onManage={() => setSelectedClassId(cls.id)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
          </RecordViews>
        </div>
      )}
      
      <AnimatePresence>
        {activeClass && (
          <AssignmentModal 
            key={activeClass.id}
            cls={activeClass} 
            allUsers={users}
            assignedOtherClassUserIds={assignedOtherClassUserIds}
            onClose={() => setSelectedClassId(null)}
            onUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-roster-full'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ClassAssignmentCard({ cls, onManage }) {
  const primaryTeacher = (cls.teachers || []).find(t => t.isPrimary)
  const subTeachers = (cls.teachers || []).filter(t => !t.isPrimary)

  return (
    <Card onClick={onManage} className="p-5 flex items-center justify-between group hover:border-primary-500 border border-transparent transition-all bg-white shadow-sm overflow-hidden min-h-[100px]">
      <div className="flex flex-col gap-4 flex-1">
        {/* 상단: 반 이름 */}
        <div className="flex items-center gap-2">
           <span className="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded-md">{cls.grade}</span>
           <h3 className="text-lg font-bold text-gray-900">{cls.name}</h3>
        </div>

        {/* 하단: 담임 및 부담임 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 font-bold w-12">담임</span>
            <span className="text-gray-900 font-bold">{primaryTeacher?.name || '미배정'}</span>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <span className="text-gray-400 font-bold w-12 pt-0.5">부담임</span>
            <div className="flex flex-wrap gap-1 flex-1">
              {subTeachers.length > 0 ? (
                subTeachers.map(t => (
                  <span key={t.id} className="text-gray-700 font-bold">{t.name}</span>
                ))
              ) : (
                <span className="text-gray-300 font-bold">없음</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 최우측: 화살표 (수정 버튼 역할) */}
      <div className="flex-shrink-0 ml-4">
        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-primary-500 group-hover:text-white transition-all shadow-sm">
          <ChevronRight size={16} />
        </div>
      </div>
    </Card>
  )
}

function AssignmentModal({ cls, allUsers, assignedOtherClassUserIds, onClose, onUpdated }) {
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const addButtonRef = useRef(null)
  const [localTeachers, setLocalTeachers] = useState(cls.teachers || [])
  const [isAdding, setIsAdding] = useState(false)
  const [search, setSearch] = useState('')

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    // Native modality keeps background content inert and restores the opener's focus.
    dialog.showModal()
    closeButtonRef.current?.focus({ preventScroll: true })
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const updateMutation = useMutation({
    mutationFn: () => {
      const assignments = localTeachers.map(t => ({
        userId: t.id,
        isPrimary: !!t.isPrimary
      }))
      return classesApi.updateTeachers(cls.id, assignments)
    },
    onSuccess: () => {
      onUpdated()
      onClose()
    },
    onError: (err) => {
      console.error(err)
      alert('저장 중 오류가 발생했습니다: ' + (err.response?.data?.message || err.message))
    }
  })

  const handleAddTeacher = (user, isPrimary) => {
    let next = [...localTeachers]
    if (isPrimary) {
      // 기존 담임들을 부담임으로 강등 (하나만 담임 가능)
      next = next.map(t => ({ ...t, isPrimary: false }))
    }
    
    const existingIdx = next.findIndex(t => t.id === user.id)
    if (existingIdx > -1) {
      // 이미 목록에 있으면 역할만 변경
      next[existingIdx] = { ...next[existingIdx], isPrimary }
    } else {
      // 신규 추가
      next.push({ id: user.id, name: user.name, isPrimary })
    }
    
    setLocalTeachers(next)
    setIsAdding(false)
    setSearch('')
  }

  const handleRemoveTeacher = (userId) => {
    setLocalTeachers(prev => prev.filter(t => t.id !== userId))
  }

  const handlePromote = (userId) => {
    setLocalTeachers(prev => prev.map(t => ({
      ...t,
      isPrimary: t.id === userId
    })))
  }

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) &&
    !localTeachers.some(t => t.id === u.id) &&
    !assignedOtherClassUserIds.has(u.id)
  )

  const requestClose = () => {
    if (!updateMutation.isPending) onClose()
  }

  const keepTabInDialog = event => {
    if (event.key !== 'Tab') return
    const dialog = dialogRef.current
    const controls = [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length)
    const first = controls[0]
    const last = controls.at(-1)
    const active = document.activeElement
    if (!first || !controls.includes(active) || (event.shiftKey ? active === first : active === last)) {
      event.preventDefault()
      ;(event.shiftKey ? last : first)?.focus({ preventScroll: true })
      if (!first) dialog.focus({ preventScroll: true })
    }
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (updateMutation.isPending) dialog.focus({ preventScroll: true })
    else if (document.activeElement === dialog || !dialog.contains(document.activeElement)) {
      // Adding/removing/promoting a teacher may remove the focused button.
      ;(addButtonRef.current || closeButtonRef.current)?.focus()
    }
  }, [updateMutation.isPending, localTeachers, isAdding])

  return (
    <dialog ref={dialogRef} tabIndex={-1} aria-label={`${cls.name} 교사 배정`} aria-modal="true"
      onKeyDown={keepTabInDialog}
      onTouchStart={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
      onCancel={event => { event.preventDefault(); requestClose() }}
      onClick={event => { if (event.target === event.currentTarget) requestClose() }}
      className="safe-overlay safe-overlay-spaced fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-4 open:flex items-center justify-center backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="w-full max-w-[430px]"
      >
        <div aria-busy={updateMutation.isPending || undefined} className="w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col safe-modal-panel safe-modal-85d">
          <div className="p-5 border-b border-gray-50 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1">{cls.grade}</p>
              <h3 className="break-keep text-lg font-bold text-gray-900">{cls.name} 배정 현황</h3>
            </div>
            <button ref={closeButtonRef} aria-label="교사 배정 닫기" disabled={updateMutation.isPending} onClick={requestClose} className="h-11 w-11 shrink-0 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 disabled:opacity-50">
              <X size={20} />
            </button>
          </div>

          <fieldset disabled={updateMutation.isPending} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-5 space-y-6">
            {/* 현재 배정 된 명단 */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">배정된 교사</p>
              {localTeachers.length === 0 ? (
                <div className="brand-card py-8 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-300">
                  <p className="text-xs font-bold">배정된 교사가 없습니다</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {localTeachers.map(t => (
                    <div key={t.id} className="brand-card flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-xl bg-white flex items-center justify-center text-xs font-bold text-gray-700 shadow-sm">
                          {t.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-gray-700">{t.name}</p>
                          <span className={`text-[0.6875rem] font-bold px-1.5 py-0.5 rounded-md ${
                            t.isPrimary ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                            {t.isPrimary ? '담임' : '부담임'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        {!t.isPrimary && (
                          <button 
                            onClick={() => handlePromote(t.id)}
                            aria-label={`${t.name} 담임으로 승격`}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors"
                            title="담임으로 승격"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleRemoveTeacher(t.id)}
                          aria-label={`${t.name} 배정 해제`}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                          title="배정 해제"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 교사 추가 섹션 */}
            {!isAdding ? (
              <button 
                ref={addButtonRef}
                onClick={() => setIsAdding(true)}
                className="w-full py-4 border-2 border-dashed border-primary-200 rounded-3xl text-primary-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary-50 transition-colors"
              >
                <UserPlus size={18} /> 배정 교사 추가
              </button>
            ) : (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    autoFocus
                    aria-label="배정할 교사 이름 검색"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="교사 이름 검색..."
                    className="w-full pl-12 pr-14 py-4 bg-gray-900 text-white rounded-2xl text-sm placeholder:text-gray-600 outline-none focus:ring-4 focus:ring-primary-500/20"
                  />
                  <button 
                    onClick={() => setIsAdding(false)}
                    aria-label="교사 추가 취소"
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 items-center justify-center p-2 text-gray-400"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center py-4 text-xs text-gray-300 font-bold">검색 결과가 없습니다</p>
                  ) : (
                    filteredUsers.map(u => (
                      <div key={u.id} className="flex flex-col gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-primary-200 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-400">{u.name[0]}</div>
                           <div>
                              <p className="text-sm font-bold text-gray-700">{u.name}</p>
                              <p className="break-all text-xs text-gray-400">{u.email}</p>
                           </div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            aria-label={`${u.name} 담임 추가`} onClick={() => handleAddTeacher(u, true)}
                            className="flex-1 min-h-11 justify-center px-3 py-1.5 bg-primary-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                          >
                            담임 추가
                          </button>
                          <button 
                            aria-label={`${u.name} 부담임 추가`} onClick={() => handleAddTeacher(u, false)}
                            className="flex-1 min-h-11 justify-center px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold flex items-center gap-1"
                          >
                            부담임
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </fieldset>

          <div className="p-6 bg-gray-50/50 flex gap-4">
             <Button variant="ghost" onClick={requestClose} className="flex-1" disabled={updateMutation.isPending}>취소</Button>
             <Button 
                className="flex-[2]" 
                onClick={() => updateMutation.mutate()}
                loading={updateMutation.isPending}
             >
               저장하기
             </Button>
          </div>
        </div>
      </motion.div>
    </dialog>
  )
}
