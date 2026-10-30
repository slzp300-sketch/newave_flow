import AppSelect from '../components/common/AppSelect'
import GradeLabel from '../components/common/GradeLabel'
import './PeopleReadability.css'
import './AdminStudentManagePage.css'
import PhotoReviewStatus from '../components/common/PhotoReviewStatus'
import { readProfilePhoto } from '../utils/profilePhoto'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminIntro } from '../components/common/AdminTools'
import QueryNotice from '../components/common/QueryNotice'
import { useState, useMemo } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, X, Loader2, Search, ChevronRight, RefreshCw, Check, UserMinus, UserCheck, Pencil, ArrowRight, Camera, Image as ImageIcon } from 'lucide-react'
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
  const [tab, setTab] = usePersistedState('tab', 'list')
  const [activeGrade, setActiveGrade] = usePersistedState('activeGrade', '전체')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [showDeactivated, setShowDeactivated] = usePersistedState('showDeactivated', false)

  const studentsQuery = useQuery({
    queryKey: ['admin-students'],
    queryFn: () => adminStudentsApi.getAll().then(r => r.data),
  })
  const { data: grouped = {}, isLoading } = studentsQuery

  const rosterQuery = useQuery({
    queryKey: ['admin-roster-full'],
    queryFn: () => classesApi.getRoster().then(r => r.data),
  })
  const { data: roster = [] } = rosterQuery

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
    <div className="admin-students-page people-readable readable-content flex flex-col min-h-screen pb-28 bg-gray-50/50">
      <Header title="아이 관리" showBack />

      <div className="flex flex-col gap-4 px-4 py-5">
        <AdminIntro title="학생 명단과 반 배정" />
        <SegmentedControl label="학생 관리 화면" value={tab} onChange={setTab}
          options={[{ value: 'list', label: '학년별 명단' }, { value: 'assign', label: '반 배정 현황' }]} />
      </div>

      {studentsQuery.isError || rosterQuery.isError ? (
        <QueryNotice queries={[studentsQuery, rosterQuery]} label="학생 및 반 명단" />
      ) : isLoading || rosterQuery.isLoading ? (
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
      <div className="bg-white border-b border-gray-100 flex overflow-x-auto no-scrollbar px-4 py-2 gap-2 ">
        {grades.map(g => (
          <button
            key={g}
            aria-pressed={activeGrade === g}
            onClick={() => setActiveGrade(g)}
            className={`flex-shrink-0 min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeGrade === g
                ? 'bg-primary-500 text-white shadow'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            <GradeLabel value={g} />
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 pb-2 flex flex-col gap-3">
        <SearchField label="학생 검색" value={search} onChange={setSearch} placeholder="이름, 학교, 반 검색" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onAdd} className="flex min-h-11 items-center gap-2 rounded-full bg-primary-500 px-4 text-sm font-semibold text-white"><UserPlus size={16} />학생 추가</button>
          <button type="button" onClick={onAdvance} className="flex min-h-11 items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-4 text-sm font-semibold text-amber-600"><RefreshCw size={14} />학년 진급</button>
        </div>

        {/* 제적 포함 토글 */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="text-xs text-gray-400 font-bold">
            표시 <span className="text-gray-800 font-bold">{students.length}</span>명
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              aria-pressed={showDeactivated}
              onClick={() => setShowDeactivated(v => !v)}
              className={`flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
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
      </div>

      {/* 학생 목록 */}
      <div className="px-4 pb-4">
        {students.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-300">
            <Users size={36} />
            <p className="text-sm font-bold">학생이 없습니다</p>
          </div>
        ) : (
          <ul className="student-management-list" aria-label="학생 관리 목록">
            {students.map(student => <li key={student.id}>
              <StudentCard student={student} onEdit={() => onEdit(student)} onRefresh={onRefresh} />
            </li>)}
          </ul>
        )}
      </div>
    </>
  )
}

function StudentCard({ student: s, onEdit, onRefresh }) {
  const deactivateMut = useMutation({
    mutationFn: () => adminStudentsApi.deactivate(s.id),
    onSuccess: onRefresh,
  })
  const activateMut = useMutation({
    mutationFn: () => adminStudentsApi.activate(s.id),
    onSuccess: onRefresh,
  })
  const busy = deactivateMut.isPending || activateMut.isPending

  return <article className={'student-management-row' + (!s.isActive ? ' student-record-inactive' : '')} aria-busy={busy || undefined}>
    <button type="button" className="student-record-edit" aria-label={`${s.name} 정보 수정`} aria-haspopup="dialog"
      aria-describedby={`student-state-${s.id} student-info-${s.id}`} onClick={onEdit} disabled={busy}>
      <span className={'student-record-avatar ' + (s.gender === '여' ? 'bg-pink-50 text-pink-500' : 'bg-primary-50 text-primary-500')} aria-hidden="true">
        {s.profileImage ? <img src={s.profileImage} alt="" /> : s.name[0]}
      </span>
      <span className="student-record-content">
        <span className="student-record-heading">
          <span className="student-record-name">{s.name}</span>
          <span id={`student-state-${s.id}`} className="student-record-badges">
            <span className={'student-record-status ' + (s.isActive ? 'student-record-active' : 'student-record-deactivated')}>{s.isActive ? '재적' : '제적'}</span>
            {s.baptism && <span className="student-record-baptism">세례</span>}
          </span>
          <Pencil size={14} className="student-record-pencil" aria-hidden="true" />
        </span>
        <span id={`student-info-${s.id}`} className="student-record-details">
          <span className="student-record-label">소속</span>
          <span className="student-record-value"><GradeLabel value={s.grade}>{s.grade || '학년 미지정'}</GradeLabel>{' · ' + (s.classGroupName || '반 미배정')}</span>
          <span className="student-record-label">학교</span>
          <span className="student-record-value">{s.school || '미등록'}</span>
        </span>
      </span>
    </button>
    <div className="student-record-actions">
      {s.isActive ? <button type="button" className="student-record-status-action student-record-deactivate"
        aria-label={`${s.name} 제적 처리`} disabled={busy} onClick={() => {
          if (confirm(`${s.name} 학생을 제적 처리하시겠어요?`)) deactivateMut.mutate()
        }}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserMinus size={16} aria-hidden="true" />}
        <span>제적</span>
      </button> : <button type="button" className="student-record-status-action student-record-activate"
        aria-label={`${s.name} 재적 복구`} disabled={busy} onClick={() => activateMut.mutate()}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserCheck size={16} aria-hidden="true" />}
        <span>복구</span>
      </button>}
    </div>
  </article>
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
      <div className="bg-white border-b border-gray-100 flex overflow-x-auto no-scrollbar px-4 py-2 gap-2 ">
        {gradeFilter.map(g => (
          <button aria-pressed={activeGradeFilter === g}
            key={g}
            onClick={() => setActiveGradeFilter(g)}
            className={`flex-shrink-0 min-h-11 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeGradeFilter === g
                ? 'bg-primary-500 text-white shadow'
                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            <GradeLabel value={g} />
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
            <p className="text-xs font-bold text-amber-600 mb-2">⚠ 반 미배정 학생 {unassigned.length}명</p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-gray-700 border border-amber-200 hover:border-primary-400 transition-colors"
                >
                  {s.name}
                  <span className="text-xs text-gray-400"><GradeLabel value={s.grade} /></span>
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
            className="brand-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/50">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded-md flex-shrink-0"><GradeLabel value={cls.grade} /></span>
                  <p className="font-bold text-sm text-gray-900 people-text">{cls.name}</p>
                </div>
                {((cls.teachers || []).length > 0) && (
                  <p className="text-xs text-gray-400 font-bold people-text pl-1">
                    {(() => {
                      const pt = cls.teachers.find(t => t.isPrimary)
                      const st = cls.teachers.filter(t => !t.isPrimary)
                      return [
                        pt ? `담임: ${pt.name}` : null,
                        st.length > 0 ? `부담임: ${st.map(t => t.name).join(', ')}` : null
                      ].filter(Boolean).join(' / ')
                    })()}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 font-bold flex-shrink-0">{cls.students.length}명</span>
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
                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold overflow-hidden ${
                    s.gender === '여' ? 'bg-pink-100 text-pink-500' : 'bg-primary-100 text-primary-500'
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
    // 학생의 학년과 일치하는 반만 필터링 (학년 정보가 없는 경우 전체 노출)
    const filteredRoster = student.grade 
      ? roster.filter(cls => cls.grade === student.grade)
      : roster

    filteredRoster.forEach(cls => {
      const g = cls.grade || '미분류'
      if (!map[g]) map[g] = []
      map[g].push(cls)
    })
    return map
  }, [roster, student.grade])

  const sortedGrades = sortGrades(Object.keys(gradeGroups))

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="safe-overlay fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none"
      >
        <div className="w-full max-w-[430px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col safe-modal-panel safe-modal-80 pointer-events-auto">
          <div className="shrink-0 p-5 border-b border-gray-50 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1">반 배정 변경</p>
              <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                현재: {student.classGroupName || '미배정'} (<GradeLabel value={student.grade}>{student.grade || '-'}</GradeLabel>)
              </p>
            </div>
            <button onClick={onClose} aria-label="학생 관리 창 닫기" className="shrink-0 w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {sortedGrades.map(grade => (
              <div key={grade}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 mb-2"><GradeLabel value={grade} /></p>
                <div className="flex flex-col gap-1.5">
                  {gradeGroups[grade].map(cls => (
                    <button aria-pressed={student.classGroupId === cls.id}
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
                        <span className="text-sm font-bold">{cls.name}</span>
                        <span className="whitespace-nowrap shrink-0 text-xs text-gray-400 font-bold">{(cls.students || []).filter(s => s.isActive !== false).length}명</span>
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
  const [photoError, setPhotoError] = useState('')

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
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="safe-overlay fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none"
      >
        <div className="w-full max-w-[430px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col safe-modal-panel safe-modal-85 pointer-events-auto">
          <div className="shrink-0 p-5 border-b border-gray-50 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1">
                {isEdit ? '정보 수정' : '학생 등록'}
              </p>
              <h3 className="text-xl font-bold text-gray-900">
                {isEdit ? student.name : '새 학생 추가'}
              </h3>
            </div>
            <button onClick={onClose} aria-label="학생 관리 창 닫기" className="shrink-0 w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* 사진 업로드 */}
            <section className="flex flex-col items-center gap-3 py-2">
              <div className="relative group">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-lg ${
                  form.gender === '여' ? 'bg-pink-50 text-pink-200' : 'bg-primary-50 text-primary-200'
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
                    accept="image/jpeg,image/png"
                    aria-label="학생 사진 선택"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files[0]
                      if (file) {
                        readProfilePhoto(file).then(image => { set('profileImage', image); setPhotoError('') }).catch(error => setPhotoError(error.message))
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
              {photoError && <p role="alert" className="text-sm text-red-700">{photoError}</p>}
              <PhotoReviewStatus targetType="STUDENT" targetId={student?.id} onRemoved={() => set('profileImage', '')} />
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
              <div className="people-form-grid gap-3">
                <Field label="성별">
                  <AppSelect aria-label="성별" value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </AppSelect>
                </Field>
                <Field label="학년">
                  <AppSelect aria-label="학년" value={form.grade} onChange={e => set('grade', e.target.value)} className={inputCls}>
                    <option value="">선택</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </AppSelect>
                </Field>
              </div>
              <Field label="반 배정 *">
                <AppSelect aria-label="반 배정"
                  value={form.classGroupId}
                  onChange={e => set('classGroupId', e.target.value)}
                  className={inputCls}
                >
                  <option value="">반 선택</option>
                  {roster.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.grade} {cls.name}</option>
                  ))}
                </AppSelect>
                {form.classGroupId && <p className="text-xs text-gray-600 mt-1">{roster.filter(cls => String(cls.id) === String(form.classGroupId)).map(cls => `${cls.grade} ${cls.name}`).join('')}</p>}
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
              <div className="people-form-grid gap-3">
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

          <div className="shrink-0 p-5 bg-gray-50/50 flex flex-wrap gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold">
              취소
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !form.name || !form.classGroupId}
              className="flex-1 py-3.5 bg-primary-500 text-white rounded-2xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
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
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="safe-overlay fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none"
      >
        <div className="w-full max-w-[430px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col safe-modal-panel safe-modal-85 pointer-events-auto">
          <div className="shrink-0 p-5 border-b border-gray-50 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">연도 개편</p>
              <h3 className="text-xl font-bold text-gray-900">학년 일괄 진급</h3>
              <p className="text-xs text-gray-400 mt-0.5">진급 후 학년을 확인하고 적용하세요</p>
            </div>
            <button onClick={onClose} aria-label="학생 관리 창 닫기" className="shrink-0 w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-2">
            {grades.map(g => (
              <div key={g} className="people-advance-row flex items-center gap-3 py-2 border-b border-gray-50">
                <div className="flex-1">
                  <span className="text-sm font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-xl block text-center"><GradeLabel value={g} /></span>
                </div>
                <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                <div className="flex-1">
                  <AppSelect aria-label={`${g} 진급 학년`}
                    value={gradeMap[g] || ''}
                    onChange={e => setGradeMap(prev => ({ ...prev, [g]: e.target.value }))}
                    className="w-full text-sm font-bold text-primary-600 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-xl outline-none"
                  >
                    <option value="">변경 없음</option>
                    {GRADES.map(nextG => <option key={nextG} value={nextG}>{nextG}</option>)}
                    <option value="졸업(제적)">졸업(제적)</option>
                  </AppSelect>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 font-bold pt-2 px-1">
              * "변경 없음" 선택 시 해당 학년은 그대로 유지됩니다.<br />
              * "졸업(제적)" 선택 시 해당 학생들은 진급에서 제외됩니다.
            </p>
          </div>

          <div className="shrink-0 p-5 bg-gray-50/50 flex flex-wrap gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl text-sm font-bold">
              취소
            </button>
            <button
              onClick={() => {
                if (confirm('학년을 일괄 진급하시겠어요? 이 작업은 되돌리기 어렵습니다.')) {
                  advanceMut.mutate()
                }
              }}
              disabled={advanceMut.isPending}
              className="flex-1 py-3.5 bg-amber-500 text-white rounded-2xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
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
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{children}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 px-1">{label}</label>
      {children}
    </div>
  )
}
