import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, UserPlus, X, Loader2, Search,
  ChevronRight, BookOpen, RefreshCw, Check,
  UserMinus, UserCheck, Pencil, ArrowRight, Camera, Image as ImageIcon
} from 'lucide-react'
import Header from '../components/layout/Header'
import { adminStudentsApi } from '../api/students'
import { classesApi } from '../api/classes'

const GRADE_ORDER = ['유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미분류']

function sortGrades(grades) {
  return [...grades].sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a)
    const bi = GRADE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export default function AdminStudentManagePage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('list') // 'list' | 'assign'
  const [activeGrade, setActiveGrade] = useState('전체')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [showDeactivated, setShowDeactivated] = useState(false)

  const { data: grouped = {}, isLoading } = useQuery({
    queryKey: ['admin-students'],
    queryFn: () => adminStudentsApi.getAll().then(r => r.data),
  })

  const { data: roster = [] } = useQuery({
    queryKey: ['admin-roster-full'],
    queryFn: () => classesApi.getRoster().then(r => r.data),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-students'] })

  // 모든 학생 flat 배열
  const allStudents = useMemo(() => Object.values(grouped).flat(), [grouped])

  const grades = useMemo(() => sortGrades(Object.keys(grouped)), [grouped])
  const gradeFilter = ['전체', ...grades]

  const filteredStudents = useMemo(() => {
    let students = activeGrade === '전체' ? allStudents : (grouped[activeGrade] || [])
    if (!showDeactivated) students = students.filter(s => s.isActive)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      students = students.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.school || '').toLowerCase().includes(q) ||
        (s.classGroupName || '').toLowerCase().includes(q)
      )
    }
    return [...students].sort((a, b) => {
      const genderOrder = { '여': 0, '남': 1 }
      const ga = genderOrder[a.gender] ?? 2
      const gb = genderOrder[b.gender] ?? 2
      if (ga !== gb) return ga - gb
      return a.name.localeCompare(b.name, 'ko')
    })
  }, [grouped, activeGrade, allStudents, search, showDeactivated])

  // 학년별 그룹핑 (탭=반배정용)
  const assignGroups = useMemo(() => {
    return roster.map(cls => ({
      ...cls,
      students: allStudents.filter(s => s.classGroupId === cls.id && s.isActive),
    }))
  }, [roster, allStudents])

  return (
    <div className="flex flex-col min-h-screen pb-28 bg-gray-50/50">
      <Header title="아이 관리" showBack />

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 flex px-4 gap-1 sticky top-[64px] z-10 shadow-sm">
        {[
          { id: 'list', label: '학년별 명단' },
          { id: 'assign', label: '반 배정 현황' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3.5 text-xs font-black border-b-2 transition-all ${
              tab === t.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        </div>
      ) : tab === 'list' ? (
        <StudentListTab
          grades={gradeFilter}
          activeGrade={activeGrade}
          setActiveGrade={setActiveGrade}
          search={search}
          setSearch={setSearch}
          students={filteredStudents}
          allStudents={allStudents}
          showDeactivated={showDeactivated}
          setShowDeactivated={setShowDeactivated}
          onAdd={() => setShowAddModal(true)}
          onEdit={setEditStudent}
          onAdvance={() => setShowAdvanceModal(true)}
          onRefresh={refresh}
          queryClient={queryClient}
        />
      ) : (
        <AssignTab
          assignGroups={assignGroups}
          roster={roster}
          allStudents={allStudents}
          onRefresh={refresh}
          queryClient={queryClient}
        />
      )}

      {/* 학생 추가 FAB */}
      {tab === 'list' && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-24 right-5 w-14 h-14 bg-primary-500 text-white rounded-full shadow-xl flex items-center justify-center z-30 active:scale-95 transition-all"
        >
          <UserPlus size={22} />
        </button>
      )}

      <AnimatePresence>
        {showAddModal && (
          <StudentFormModal
            roster={roster}
            onClose={() => setShowAddModal(false)}
            onSuccess={refresh}
          />
        )}
        {editStudent && (
          <StudentFormModal
            student={editStudent}
            roster={roster}
            onClose={() => setEditStudent(null)}
            onSuccess={refresh}
          />
        )}
        {showAdvanceModal && (
          <GradeAdvanceModal
            grades={grades}
            onClose={() => setShowAdvanceModal(false)}
            onSuccess={refresh}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── 학년별 명단 탭 ───────────────────────────────────────────
function StudentListTab({
  grades, activeGrade, setActiveGrade,
  search, setSearch, students, allStudents,
  showDeactivated, setShowDeactivated,
  onAdd, onEdit, onAdvance, onRefresh, queryClient,
}) {
  return (
    <>
      {/* 학년 필터 */}
      <div className="bg-white border-b border-gray-100 flex overflow-x-auto no-scrollbar px-4 py-2 gap-2 sticky top-[112px] z-10">
        {grades.map(g => (
          <button
            key={g}
            onClick={() => setActiveGrade(g)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeGrade === g
                ? 'bg-primary-500 text-white shadow'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
        {/* 검색 + 도구 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름, 학교, 반 검색..."
              className="w-full pl-9 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 outline-none focus:border-primary-300 shadow-sm"
            />
          </div>
          <button
            onClick={onAdvance}
            className="px-3 py-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 text-xs font-black flex items-center gap-1 flex-shrink-0"
            title="학년 진급"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">학년진급</span>
          </button>
        </div>

        {/* 제적 포함 토글 */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-400 font-bold">
            총 <span className="text-gray-800 font-black">{students.length}</span>명
          </p>
          <button
            onClick={() => setShowDeactivated(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
              showDeactivated
                ? 'bg-red-50 text-red-500 border border-red-100'
                : 'bg-gray-50 text-gray-400 border border-gray-100'
            }`}
          >
            <UserMinus size={12} />
            제적 포함
          </button>
        </div>
      </div>

      {/* 학생 목록 */}
      <div className="px-4 flex flex-col gap-2 pb-4">
        {students.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-300">
            <Users size={36} />
            <p className="text-sm font-bold">학생이 없습니다</p>
          </div>
        ) : (
          students.map((s, idx) => (
            <StudentCard
              key={s.id}
              student={s}
              idx={idx}
              onEdit={() => onEdit(s)}
              queryClient={queryClient}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>
    </>
  )
}

function StudentCard({ student: s, idx, onEdit, queryClient, onRefresh }) {
  const deactivateMut = useMutation({
    mutationFn: () => adminStudentsApi.deactivate(s.id),
    onSuccess: onRefresh,
  })
  const activateMut = useMutation({
    mutationFn: () => adminStudentsApi.activate(s.id),
    onSuccess: onRefresh,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
      className={`bg-white rounded-2xl border shadow-sm px-4 py-3.5 flex items-center gap-3 ${
        !s.isActive ? 'opacity-50 border-red-100' : 'border-gray-100'
      }`}
    >
      {/* 아바타 */}
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black flex-shrink-0 overflow-hidden ${
        s.gender === '여' ? 'bg-pink-50 text-pink-500' : 'bg-blue-50 text-blue-500'
      }`}>
        {s.profileImage ? (
          <img src={s.profileImage} alt={s.name} className="w-full h-full object-cover" />
        ) : (
          s.name[0]
        )}
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-black text-sm ${!s.isActive ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {s.name}
          </p>
          {!s.isActive && (
            <span className="text-[9px] font-black bg-red-100 text-red-400 px-1.5 py-0.5 rounded-md">제적</span>
          )}
          {s.baptism && (
            <span className="text-[9px] font-black bg-emerald-50 text-emerald-500 px-1.5 py-0.5 rounded-md">세례</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {s.grade && (
            <span className="text-[11px] text-primary-500 font-black bg-primary-50 px-2 py-0.5 rounded-md">{s.grade}</span>
          )}
          {s.classGroupName && (
            <span className="text-[11px] text-gray-500 font-bold">{s.classGroupName}</span>
          )}
          {s.school && (
            <span className="text-[11px] text-gray-300 font-bold truncate">{s.school}</span>
          )}
        </div>
      </div>

      {/* 액션 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-primary-50 hover:text-primary-500 transition-colors"
        >
          <Pencil size={13} />
        </button>
        {s.isActive ? (
          <button
            onClick={() => {
              if (confirm(`${s.name} 학생을 제적 처리하시겠어요?`)) deactivateMut.mutate()
            }}
            disabled={deactivateMut.isPending}
            className="w-8 h-8 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {deactivateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
          </button>
        ) : (
          <button
            onClick={() => activateMut.mutate()}
            disabled={activateMut.isPending}
            className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            {activateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── 반 배정 현황 탭 ──────────────────────────────────────────
function AssignTab({ assignGroups, roster, allStudents, onRefresh, queryClient }) {
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [activeGradeFilter, setActiveGradeFilter] = useState('전체')
  const [search, setSearch] = useState('')

  // 반 배정 없는 학생 (classGroupId가 없거나 roster에 없는 경우)
  const unassigned = allStudents.filter(s => s.isActive && !s.classGroupId)

  const gradeGroups = useMemo(() => {
    const map = {}
    assignGroups.forEach(cls => {
      const g = cls.grade || '미분류'
      if (!map[g]) map[g] = []
      map[g].push(cls)
    })
    return map
  }, [assignGroups])

  const sortedGrades = sortGrades(Object.keys(gradeGroups))
  const gradeFilter = ['전체', ...sortedGrades]

  const displayGroups = activeGradeFilter === '전체'
    ? assignGroups
    : assignGroups.filter(cls => cls.grade === activeGradeFilter)

  const filteredDisplayGroups = search.trim()
    ? displayGroups.map(cls => ({
        ...cls,
        students: cls.students.filter(s =>
          s.name.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(cls => cls.students.length > 0)
    : displayGroups

  return (
    <>
      {/* 학년 필터 */}
      <div className="bg-white border-b border-gray-100 flex overflow-x-auto no-scrollbar px-4 py-2 gap-2 sticky top-[112px] z-10">
        {gradeFilter.map(g => (
          <button
            key={g}
            onClick={() => setActiveGradeFilter(g)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeGradeFilter === g
                ? 'bg-primary-500 text-white shadow'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 검색..."
            className="w-full pl-9 pr-4 py-3 bg-white border border-gray-100 rounded-xl text-sm placeholder:text-gray-300 outline-none focus:border-primary-300 shadow-sm"
          />
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4 pb-4">
        {/* 미배정 학생 */}
        {unassigned.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-black text-amber-600 mb-2">⚠ 반 미배정 학생 {unassigned.length}명</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-gray-700 border border-amber-200 hover:border-primary-400 transition-colors"
                >
                  {s.name}
                  <span className="text-[10px] text-gray-400">{s.grade}</span>
                  <ArrowRight size={11} className="text-primary-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredDisplayGroups.map((cls, idx) => (
          <motion.div
            key={cls.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-primary-500 bg-primary-50 px-2 py-0.5 rounded-md">{cls.grade}</span>
                <p className="font-black text-sm text-gray-900">{cls.name}</p>
              </div>
              <span className="text-[11px] text-gray-400 font-bold">{cls.students.length}명</span>
            </div>
            <div className="p-3 flex flex-wrap gap-2">
              {cls.students.length === 0 ? (
                <p className="text-xs text-gray-300 font-bold py-2 px-1">배정된 학생 없음</p>
              ) : (
                cls.students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl text-xs font-bold text-gray-700 border border-gray-100 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  >
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black overflow-hidden ${
                    s.gender === '여' ? 'bg-pink-100 text-pink-500' : 'bg-blue-100 text-blue-500'
                  }`}>
                    {s.profileImage ? (
                      <img src={s.profileImage} alt={s.name} className="w-full h-full object-cover" />
                    ) : (
                      s.name[0]
                    )}
                  </span>
                    {s.name}
                    <ArrowRight size={11} className="text-gray-300" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedStudent && (
          <ClassAssignModal
            student={selectedStudent}
            roster={roster}
            onClose={() => setSelectedStudent(null)}
            onSuccess={() => {
              setSelectedStudent(null)
              onRefresh()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── 반 배정 변경 모달 ────────────────────────────────────────
function ClassAssignModal({ student, roster, onClose, onSuccess }) {
  const assignMut = useMutation({
    mutationFn: (classGroupId) => adminStudentsApi.assignClass(student.id, classGroupId),
    onSuccess,
    onError: (err) => alert('오류: ' + (err.response?.data?.message || err.message)),
  })

  const gradeGroups = useMemo(() => {
    const map = {}
    roster.forEach(cls => {
      const g = cls.grade || '미분류'
      if (!map[g]) map[g] = []
      map[g].push(cls)
    })
    return map
  }, [roster])

  const sortedGrades = sortGrades(Object.keys(gradeGroups))

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-0 left-0 right-0 z-[70] flex justify-center px-4 pb-8"
      >
        <div className="w-full max-w-[430px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">반 배정 변경</p>
              <h3 className="text-xl font-black text-gray-900">{student.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                현재: {student.classGroupName || '미배정'} ({student.grade || '-'})
              </p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {sortedGrades.map(grade => (
              <div key={grade}>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">{grade}</p>
                <div className="flex flex-col gap-1.5">
                  {gradeGroups[grade].map(cls => (
                    <button
                      key={cls.id}
                      disabled={assignMut.isPending}
                      onClick={() => assignMut.mutate(cls.id)}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                        student.classGroupId === cls.id
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-primary-200 hover:bg-primary-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {student.classGroupId === cls.id && (
                          <Check size={14} className="text-primary-500" />
                        )}
                        <span className="text-sm font-black">{cls.name}</span>
                        <span className="text-[11px] text-gray-400 font-bold">{(cls.students || []).filter(s => s.isActive !== false).length}명</span>
                      </div>
                      {assignMut.isPending && assignMut.variables === cls.id ? (
                        <Loader2 size={14} className="animate-spin text-primary-500" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-300" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── 학생 등록/수정 모달 ──────────────────────────────────────
const GRADES = ['유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3']

function StudentFormModal({ student, roster, onClose, onSuccess }) {
  const isEdit = !!student
  const [form, setForm] = useState({
    name: student?.name || '',
    classGroupId: student?.classGroupId || '',
    grade: student?.grade || '',
    gender: student?.gender || '남',
    birthDate: student?.birthDate || '',
    school: student?.school || '',
    phone: student?.phone || '',
    baptism: student?.baptism || false,
    fatherName: student?.fatherName || '',
    fatherPhone: student?.fatherPhone || '',
    motherName: student?.motherName || '',
    motherPhone: student?.motherPhone || '',
    address: student?.address || '',
    profileImage: student?.profileImage || '',
  })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const mutation = useMutation({
    mutationFn: () => {
      const body = { ...form, classGroupId: Number(form.classGroupId) }
      return isEdit
        ? adminStudentsApi.update(student.id, body)
        : adminStudentsApi.create(body)
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err) => alert('오류: ' + (err.response?.data?.message || err.message)),
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-0 left-0 right-0 z-[70] flex justify-center px-4 pb-8"
      >
        <div className="w-full max-w-[430px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">
                {isEdit ? '정보 수정' : '학생 등록'}
              </p>
              <h3 className="text-xl font-black text-gray-900">
                {isEdit ? student.name : '새 학생 추가'}
              </h3>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 사진 업로드 */}
            <section className="flex flex-col items-center gap-3 py-2">
              <div className="relative group">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-lg ${
                  form.gender === '여' ? 'bg-pink-50 text-pink-200' : 'bg-blue-50 text-blue-200'
                }`}>
                  {form.profileImage ? (
                    <img src={form.profileImage} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={32} />
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-9 h-9 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer active:scale-90 transition-all">
                  <ImageIcon size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onloadend = () => set('profileImage', reader.result)
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </label>
                {form.profileImage && (
                  <button
                    onClick={() => set('profileImage', '')}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <p className="text-[10px] font-black text-gray-300">JPG, PNG 파일 지원</p>
            </section>

            {/* 필수 정보 */}
            <section className="space-y-3">
              <SectionTitle>기본 정보</SectionTitle>
              <Field label="이름 *">
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="학생 이름"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="성별">
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </Field>
                <Field label="학년">
                  <select value={form.grade} onChange={e => set('grade', e.target.value)} className={inputCls}>
                    <option value="">선택</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="반 배정 *">
                <select
                  value={form.classGroupId}
                  onChange={e => set('classGroupId', e.target.value)}
                  className={inputCls}
                >
                  <option value="">반 선택</option>
                  {roster.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.grade} {cls.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="생년월일">
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={e => set('birthDate', e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="학교">
                <input
                  value={form.school}
                  onChange={e => set('school', e.target.value)}
                  placeholder="학교 이름"
                  className={inputCls}
                />
              </Field>
              <Field label="연락처">
                <input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="010-0000-0000"
                  className={inputCls}
                />
              </Field>
              <div className="flex items-center gap-2 px-1">
                <input
                  id="baptism"
                  type="checkbox"
                  checked={!!form.baptism}
                  onChange={e => set('baptism', e.target.checked)}
                  className="w-4 h-4 accent-primary-500"
                />
                <label htmlFor="baptism" className="text-sm font-bold text-gray-700">세례 여부</label>
              </div>
            </section>

            {/* 부모 정보 */}
            <section className="space-y-3">
              <SectionTitle>보호자 정보</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="아버지 이름">
                  <input value={form.fatherName} onChange={e => set('fatherName', e.target.value)} placeholder="홍길동" className={inputCls} />
                </Field>
                <Field label="아버지 연락처">
                  <input value={form.fatherPhone} onChange={e => set('fatherPhone', e.target.value)} placeholder="010-" className={inputCls} />
                </Field>
                <Field label="어머니 이름">
                  <input value={form.motherName} onChange={e => set('motherName', e.target.value)} placeholder="홍길순" className={inputCls} />
                </Field>
                <Field label="어머니 연락처">
                  <input value={form.motherPhone} onChange={e => set('motherPhone', e.target.value)} placeholder="010-" className={inputCls} />
                </Field>
              </div>
              <Field label="주소">
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="주소 입력" className={inputCls} />
              </Field>
            </section>
          </div>

          <div className="p-5 bg-gray-50/50 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl text-sm font-black">
              취소
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !form.name || !form.classGroupId}
              className="flex-1 py-3.5 bg-primary-500 text-white rounded-2xl text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {isEdit ? '수정 완료' : '등록'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── 학년 진급 모달 ──────────────────────────────────────────
const DEFAULT_ADVANCE_MAP = {
  '초1': '초2', '초2': '초3', '초3': '초4', '초4': '초5', '초5': '초6',
  '초6': '중1', '중1': '중2', '중2': '중3', '중3': '고1',
  '고1': '고2', '고2': '고3', '고3': '졸업(제적)',
}

function GradeAdvanceModal({ grades, onClose, onSuccess }) {
  const [gradeMap, setGradeMap] = useState(() => {
    const map = {}
    grades.forEach(g => { map[g] = DEFAULT_ADVANCE_MAP[g] || '' })
    return map
  })

  const advanceMut = useMutation({
    mutationFn: () => {
      // '졸업(제적)' 처럼 빈 값은 제외
      const filtered = Object.fromEntries(
        Object.entries(gradeMap).filter(([, v]) => v && v.trim() !== '졸업(제적)')
      )
      return adminStudentsApi.bulkAdvance(filtered)
    },
    onSuccess: (res) => {
      alert(`${res.data.advanced}명의 학생 학년이 진급되었습니다.`)
      onSuccess()
      onClose()
    },
    onError: (err) => alert('오류: ' + (err.response?.data?.message || err.message)),
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-0 left-0 right-0 z-[70] flex justify-center px-4 pb-8"
      >
        <div className="w-full max-w-[430px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">연도 개편</p>
              <h3 className="text-xl font-black text-gray-900">학년 일괄 진급</h3>
              <p className="text-xs text-gray-400 mt-0.5">진급 후 학년을 확인하고 적용하세요</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-2">
            {grades.map(g => (
              <div key={g} className="flex items-center gap-3 py-2 border-b border-gray-50">
                <div className="flex-1">
                  <span className="text-sm font-black text-gray-700 bg-gray-100 px-3 py-1.5 rounded-xl block text-center">{g}</span>
                </div>
                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                <div className="flex-1">
                  <select
                    value={gradeMap[g] || ''}
                    onChange={e => setGradeMap(prev => ({ ...prev, [g]: e.target.value }))}
                    className="w-full text-sm font-black text-primary-600 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-xl outline-none"
                  >
                    <option value="">변경 없음</option>
                    {GRADES.map(nextG => <option key={nextG} value={nextG}>{nextG}</option>)}
                    <option value="졸업(제적)">졸업(제적)</option>
                  </select>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 font-bold pt-2 px-1">
              * "변경 없음" 선택 시 해당 학년은 그대로 유지됩니다.<br />
              * "졸업(제적)" 선택 시 해당 학생들은 진급에서 제외됩니다.
            </p>
          </div>

          <div className="p-5 bg-gray-50/50 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl text-sm font-black">
              취소
            </button>
            <button
              onClick={() => {
                if (confirm('학년을 일괄 진급하시겠어요? 이 작업은 되돌리기 어렵습니다.')) {
                  advanceMut.mutate()
                }
              }}
              disabled={advanceMut.isPending}
              className="flex-1 py-3.5 bg-amber-500 text-white rounded-2xl text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {advanceMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              진급 적용
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── 공통 UI ─────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:border-primary-300 font-bold text-gray-800'

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-3.5 bg-primary-500 rounded-full" />
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{children}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-gray-500 px-1">{label}</label>
      {children}
    </div>
  )
}
