import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePersistedState } from '../hooks/usePersistedState'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, X, BookOpen, Phone, MapPin, Loader2,
  GraduationCap, ChevronRight, User, Tag, Plus, Trash2, Check
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { classesApi } from '../api/classes'
import { usersApi } from '../api/users'
import { tagsApi } from '../api/tags'
import useAuthStore from '../store/authStore'

// ── 상수 ────────────────────────────────────────────────
const GRADES = ['전체', '중1', '중2', '중3', '고1', '고2', '고3']
const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3']

const GRADE_COLORS = {
  '전체': { bg: 'bg-gray-700',    light: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-400'    },
  '중1': { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-300'    },
  '중2': { bg: 'bg-violet-500',  light: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-300'  },
  '중3': { bg: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-300'  },
  '고1': { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-300' },
  '고2': { bg: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-300'   },
  '고3': { bg: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-300'    },
}

const TAG_COLORS = [
  'bg-red-500 text-white border-red-600',
  'bg-orange-500 text-white border-orange-600',
  'bg-amber-500 text-white border-amber-600',
  'bg-yellow-500 text-white border-yellow-600',
  'bg-lime-500 text-white border-lime-600',
  'bg-green-500 text-white border-green-600',
  'bg-emerald-500 text-white border-emerald-600',
  'bg-teal-500 text-white border-teal-600',
  'bg-cyan-500 text-white border-cyan-600',
  'bg-sky-500 text-white border-sky-600',
  'bg-blue-500 text-white border-blue-600',
  'bg-indigo-500 text-white border-indigo-600',
  'bg-violet-500 text-white border-violet-600',
  'bg-purple-500 text-white border-purple-600',
  'bg-fuchsia-500 text-white border-fuchsia-600',
  'bg-pink-500 text-white border-pink-600',
  'bg-rose-500 text-white border-rose-600',
  'bg-slate-500 text-white border-slate-600',
  'bg-zinc-500 text-white border-zinc-600',
  'bg-neutral-500 text-white border-neutral-600',
  'bg-stone-500 text-white border-stone-600',
  'bg-red-400 text-white border-red-500',
  'bg-orange-400 text-white border-orange-500',
  'bg-emerald-400 text-white border-emerald-500',
  'bg-blue-400 text-white border-blue-500',
  'bg-violet-400 text-white border-violet-500',
  'bg-pink-400 text-white border-pink-500',
]

const ROLE_CONFIG = {
  PASTOR:    { label: '목사님', bg: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500'    },
  EXECUTIVE: { label: '임원',   bg: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500'   },
  TEACHER:   { label: '교사',   bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

function calcAge(birth) {
  if (!birth) return null
  const today = new Date()
  const b = new Date(birth)
  let age = today.getFullYear() - b.getFullYear()
  if (today.getMonth() < b.getMonth() ||
    (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--
  return age
}

function formatBirth(birth) {
  if (!birth) return null
  return birth.replace(/-/g, '.')
}

// ── 메인 페이지 ─────────────────────────────────────────
export default function RosterPage() {
  const [activeRoster, setActiveRoster] = useState(null) // null | 'student' | 'teacher'

  if (activeRoster === 'student') {
    return (
      <div className="flex flex-col min-h-screen pb-24">
        <Header title="학생 교적부" showBack onBack={() => setActiveRoster(null)} />
        <StudentRoster />
      </div>
    )
  }

  if (activeRoster === 'teacher') {
    return (
      <div className="flex flex-col min-h-screen pb-24">
        <Header title="교사 교적부" showBack onBack={() => setActiveRoster(null)} />
        <TeacherRoster />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="교적부" />
      <RosterLanding onSelect={setActiveRoster} />
    </div>
  )
}

// ── 랜딩 페이지 ─────────────────────────────────────────
function RosterLanding({ onSelect }) {
  const { data: rosterData = [] } = useQuery({
    queryKey: ['roster'],
    queryFn: () => classesApi.getRoster().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })
  const { data: teacherData = [] } = useQuery({
    queryKey: ['teacher-roster'],
    queryFn: () => usersApi.getTeacherRoster().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const totalStudents = rosterData.reduce((s, c) => s + (c.students?.length || 0), 0)
  const totalTeachers = teacherData.length

  return (
    <div className="px-4 py-6 flex flex-col gap-4">
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">교적부 선택</p>

      {/* 학생 교적부 카드 */}
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onClick={() => onSelect('student')}
        className="w-full text-left bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-all hover:border-blue-200 hover:shadow-md"
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <GraduationCap size={26} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900 text-base">학생 교적부</p>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            전체 {rosterData.length}반 · {totalStudents}명
          </p>
          <p className="text-[11px] text-blue-500 font-bold mt-1.5">학년별 반 구성 · 학생 정보 조회</p>
        </div>
        <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
      </motion.button>

      {/* 교사 교적부 카드 */}
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => onSelect('teacher')}
        className="w-full text-left bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 active:scale-[0.98] transition-all hover:border-emerald-200 hover:shadow-md"
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Users size={26} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900 text-base">교사 교적부</p>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            총 {totalTeachers}명
          </p>
          <p className="text-[11px] text-emerald-500 font-bold mt-1.5">목사님 · 임원 · 교사 정보 조회</p>
        </div>
        <ChevronRight size={20} className="text-gray-300 flex-shrink-0" />
      </motion.button>
    </div>
  )
}

// ── 학생 교적부 ─────────────────────────────────────────
function StudentRoster() {
  const [selectedGrade, setSelectedGrade] = usePersistedState('selectedGrade', '전체')
  const [selectedClass, setSelectedClass] = usePersistedState('selectedClass', null)
  const { data: rawClasses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['roster'],
    queryFn: () => classesApi.getRoster().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })

  const groupedData = useMemo(() => {
    const grouped = rawClasses.reduce((acc, cls) => {
      const grade = cls.grade || '기타'
      if (!acc[grade]) acc[grade] = []
      acc[grade].push(cls)
      return acc
    }, {})
    Object.keys(grouped).forEach(grade => {
      grouped[grade].sort((a, b) => (parseInt(a.name) || 0) - (parseInt(b.name) || 0))
    })
    return grouped
  }, [rawClasses])

  const classes = selectedGrade === '전체'
    ? GRADE_ORDER.flatMap(g => groupedData[g] || [])
    : (groupedData[selectedGrade] || [])
  const colors = GRADE_COLORS[selectedGrade] || GRADE_COLORS['전체']
  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0)

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center mt-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center mt-20 gap-4">
        <p className="text-gray-500 font-bold text-sm">데이터를 불러올 수 없습니다</p>
        <button onClick={() => refetch()}
          className="px-5 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-xl active:scale-95 transition-transform">
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="sticky top-14 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex overflow-x-auto px-4 pt-3 pb-2 gap-2" style={{ scrollbarWidth: 'none' }}>
          {GRADES.map(grade => {
            const gc = GRADE_COLORS[grade]
            const isActive = selectedGrade === grade
            return (
              <button key={grade}
                onClick={() => { setSelectedGrade(grade); setSelectedClass(null) }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-black transition-all active:scale-95 ${
                  isActive ? `${gc.bg} text-white shadow-md` : 'bg-gray-100 text-gray-500'
                }`}
              >{grade}</button>
            )
          })}
        </div>
        <motion.div key={selectedGrade} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className={`mx-4 mb-3 px-4 py-2.5 rounded-xl ${colors.light} flex items-center gap-2`}>
          <BookOpen size={13} className={colors.text} />
          <span className={`text-xs font-black ${colors.text}`}>{selectedGrade === '전체' ? '전체 학년' : selectedGrade}</span>
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-xs text-gray-600 font-semibold">총 {classes.length}반</span>
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-xs text-gray-600 font-semibold">{totalStudents}명</span>
        </motion.div>
      </div>

      <div className="px-4 py-4">
        {classes.length === 0 ? (
          <GradeEmptyState grade={selectedGrade} colors={colors} />
        ) : selectedGrade === '전체' ? (
          <motion.div key="전체" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {GRADE_ORDER.filter(g => groupedData[g]?.length > 0).map(g => {
              const gc = GRADE_COLORS[g]
              const gradeClasses = groupedData[g]
              return (
                <div key={g}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${gc.bg} text-white`}>{g}</span>
                    <span className="text-xs text-gray-400 font-medium">{gradeClasses.length}반</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {gradeClasses.map((cls, idx) => (
                      <ClassCard key={cls.id} cls={cls} grade={g} colors={gc} idx={idx}
                        isSelected={selectedClass?.id === cls.id} onClick={() => setSelectedClass(cls)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div key={selectedGrade} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-3">
            {classes.map((cls, idx) => (
              <ClassCard key={cls.id} cls={cls} grade={selectedGrade} colors={colors} idx={idx}
                isSelected={selectedClass?.id === cls.id} onClick={() => setSelectedClass(cls)} />
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedClass && (
          <ClassDetailSheet cls={selectedClass} grade={selectedClass.grade || selectedGrade}
            colors={GRADE_COLORS[selectedClass.grade] || colors} onClose={() => setSelectedClass(null)} />
        )}
      </AnimatePresence>
    </>
  )
}

// ── 교사 교적부 ─────────────────────────────────────────
function TeacherRoster() {
  const { user: me } = useAuthStore()
  const canManageTags = me?.role === 'PASTOR' || me?.role === 'ADMIN'
  const qc = useQueryClient()

  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [activeTab, setActiveTab] = useState('executive')
  const [activeGrade, setActiveGrade] = useState('전체')
  const [showTagPool, setShowTagPool] = useState(false)

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teacher-roster'],
    queryFn: () => usersApi.getTeacherRoster().then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.getAll().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center mt-20"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
  }

  const pastors    = teachers.filter(t => t.role === 'PASTOR')
  const executives = teachers.filter(t => t.role === 'EXECUTIVE')
  const pureTeachers = teachers.filter(t => t.role === 'TEACHER')
  // 반 배정된 임원도 교사 탭에 포함 (중복 제거)
  const assignedExecs = executives.filter(t => !!t.className)
  const teacherTabList = [...pureTeachers, ...assignedExecs]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

  // 교사 탭 – 학년별 그룹화
  const teachersByGrade = teacherTabList.reduce((acc, t) => {
    const grade = t.className && t.className.trim() !== '' ? t.className.split(' ')[0] : '미배정'
    if (!acc[grade]) acc[grade] = []
    acc[grade].push(t)
    return acc
  }, {})

  // 학년부장을 맨 앞으로, 그 다음은 반 번호 오름차순, 그 다음 이름순으로 정렬
  const getClassNum = (className) => {
    if (!className) return 999
    const match = className.match(/(\d+)반/)
    return match ? parseInt(match[1], 10) : 999
  }

  Object.values(teachersByGrade).forEach(list => {
    list.sort((a, b) => {
      const aHead = a.churchPosition?.includes('학년부장')
      const bHead = b.churchPosition?.includes('학년부장')
      if (aHead && !bHead) return -1
      if (!aHead && bHead) return 1
      
      const aClass = getClassNum(a.className)
      const bClass = getClassNum(b.className)
      if (aClass !== bClass) return aClass - bClass
      
      return a.name.localeCompare(b.name)
    })
  })

  const otherGrades = Object.keys(teachersByGrade).filter(g => !GRADE_ORDER.includes(g) && g !== '미배정')
  const gradeKeys = [
    ...GRADE_ORDER.filter(g => teachersByGrade[g]),
    ...otherGrades.sort((a, b) => a.localeCompare(b)),
    ...(teachersByGrade['미배정'] ? ['미배정'] : [])
  ]
  const availableGrades = ['전체', ...gradeKeys]
  const filteredGrades = activeGrade === '전체' ? gradeKeys : [activeGrade].filter(g => teachersByGrade[g])

  const execTags    = allTags.filter(t => t.category === 'EXECUTIVE').sort((a, b) => a.name.localeCompare(b.name))
  const teacherTags = allTags.filter(t => t.category === 'TEACHER').sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <div className="flex flex-col gap-0 pb-4">
        {/* 상단 탭 */}
        <div className="sticky top-14 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center px-4 pt-3 pb-0">
            <button
              onClick={() => setActiveTab('executive')}
              className={`flex-1 py-2.5 text-sm font-black border-b-2 transition-all ${
                activeTab === 'executive' ? 'border-amber-400 text-amber-600' : 'border-transparent text-gray-400'
              }`}
            >목사님 · 임원</button>
            <button
              onClick={() => { setActiveTab('teacher'); setActiveGrade('전체') }}
              className={`flex-1 py-2.5 text-sm font-black border-b-2 transition-all ${
                activeTab === 'teacher' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400'
              }`}
            >교사</button>
          </div>
        </div>

        
        {/* 총 인원 및 태그 관리 */}
        <div className="px-4 pt-3 pb-0 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-500">
            {activeTab === 'executive' 
              ? `총 ${pastors.length + executives.length}명` 
              : activeGrade === '전체' 
                ? `총 ${teacherTabList.length}명` 
                : `총 ${teachersByGrade[activeGrade]?.length || 0}명`
            }
          </span>
          {canManageTags && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (window.confirm('정말 모든 태그를 삭제하고 초기화하시겠습니까?')) {
                    await tagsApi.deleteAll()
                    qc.invalidateQueries({ queryKey: ['tags'] })
                    qc.invalidateQueries({ queryKey: ['teacher-roster'] })
                  }
                }}
                className="flex items-center gap-1.5 text-[12px] font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-full active:scale-95 transition-all"
              >
                <Trash2 size={13} /> 태그 전체 초기화
              </button>
              <button
                onClick={() => setShowTagPool(true)}
                className="flex items-center gap-1.5 text-[12px] font-black text-primary-500 bg-primary-50 px-3 py-1.5 rounded-full active:scale-95 transition-all"
              >
                <Tag size={13} /> 태그 관리
              </button>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'executive' && (
            <motion.div key="exec-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-6 px-4 pt-4">
              {pastors.length > 0 && (
                <RosterSection title="목사님" dotColor="bg-blue-500"
                  count={pastors.length} teachers={pastors} onSelect={setSelectedTeacher} context="executive" />
              )}
              {executives.length > 0 && (
                <RosterSection title="임원" dotColor="bg-amber-500"
                  count={executives.length} teachers={executives} onSelect={setSelectedTeacher} context="executive" />
              )}
              {pastors.length === 0 && executives.length === 0 && (
                <div className="py-20 flex flex-col items-center gap-3 text-gray-300">
                  <Users size={40} />
                  <p className="text-sm font-black">임원 정보가 없습니다</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'teacher' && (
            <motion.div key="teacher-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-4 pt-3">
              {availableGrades.length > 2 && (
                <div className="flex overflow-x-auto gap-2 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                  {availableGrades.map(grade => {
                    const gc = GRADE_COLORS[grade] || GRADE_COLORS['전체']
                    const isActive = activeGrade === grade
                    return (
                      <button key={grade}
                        onClick={() => setActiveGrade(grade)}
                        className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-black transition-all active:scale-95 ${
                          isActive ? `${gc.bg} text-white shadow-sm` : 'bg-gray-100 text-gray-500'
                        }`}
                      >{grade}</button>
                    )
                  })}
                </div>
              )}
              <div className="px-4 flex flex-col gap-6">
                {filteredGrades.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-3 text-gray-300">
                    <Users size={40} />
                    <p className="text-sm font-black">교사 정보가 없습니다</p>
                  </div>
                ) : filteredGrades.map(grade => {
                  const gc = GRADE_COLORS[grade] || GRADE_COLORS['전체']
                  const list = teachersByGrade[grade] || []
                  return (
                    <div key={grade}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${gc.bg} text-white`}>{grade}</span>
                        <span className="text-xs text-gray-400 font-medium">{list.length}명</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {list.map((t, idx) => (
                          <TeacherCard key={t.id} teacher={t} idx={idx} onSelect={setSelectedTeacher} context="teacher" />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedTeacher && (
          <TeacherDetailSheet
            teacher={selectedTeacher}
            allTags={allTags}
            execTags={execTags}
            teacherTags={teacherTags}
            canManageTags={canManageTags}
            onClose={() => setSelectedTeacher(null)}
            onTagChanged={() => qc.invalidateQueries({ queryKey: ['teacher-roster'] })}
            context={activeTab}
          />
        )}
        {showTagPool && (
          <TagPoolModal
            tags={allTags}
            execTags={execTags}
            teacherTags={teacherTags}
            onClose={() => setShowTagPool(false)}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ['tags'] })
              qc.invalidateQueries({ queryKey: ['teacher-roster'] })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function RosterSection({ title, dotColor, count, teachers, onSelect, context }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
        <span className="text-sm font-black text-gray-900">{title}</span>
        <span className="text-xs text-gray-400 font-medium">{count}명</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {teachers.map((t, idx) => (
          <TeacherCard key={t.id} teacher={t} idx={idx} onSelect={onSelect} context={context} />
        ))}
      </div>
    </div>
  )
}

function TeacherCard({ teacher, idx, onSelect, context = 'default' }) {
  const roleCfg = ROLE_CONFIG[teacher.role] ?? ROLE_CONFIG.TEACHER
  const isGradeHead = teacher.churchPosition?.includes('학년부장')
  
  let displayLabel = roleCfg.label
  let displayBg = roleCfg.bg
  
  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else if (teacher.role === 'TEACHER') {
      displayLabel = '교사'
      displayBg = 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      onClick={() => onSelect(teacher)}
      className="flex flex-col items-center gap-1 p-2 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.95] transition-all text-center"
    >
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {teacher.profileImage
          ? <img src={teacher.profileImage} alt={teacher.name} className="w-full h-full object-cover" />
          : <span className="font-black text-gray-600 text-base">{teacher.name?.[0]}</span>
        }
      </div>
      <p className="font-black text-gray-900 text-[11px] leading-tight w-full truncate mt-0.5">{teacher.name}</p>
      
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${displayBg}`}>
        {displayLabel}
      </span>
      
      {teacher.tags?.length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 w-full max-h-[30px] overflow-hidden">
          {teacher.tags.map(t => (
            <span key={t.id} className={`text-[8px] font-black px-1 py-0.5 rounded-sm truncate ${t.color || "bg-primary-50 text-primary-600"}`} style={{ maxWidth: '100%' }}>
              {t.name}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  )
}
function TeacherDetailSheet({ teacher, allTags, execTags, teacherTags, canManageTags, onClose, onTagChanged, context }) {
  const roleCfg = ROLE_CONFIG[teacher.role] ?? ROLE_CONFIG.TEACHER
  const age = calcAge(teacher.birthDate)
  
  const isGradeHead = teacher.churchPosition?.includes('학년부장')
  let displayLabel = roleCfg.label
  let displayBg = roleCfg.bg
  
  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else if (teacher.role === 'TEACHER') {
      displayLabel = '교사'
      displayBg = 'bg-emerald-50 text-emerald-600'
    }
  }
  const qc = useQueryClient()

  // 낙관적 업데이트를 위한 로컬 태그 상태
  const [localTagIds, setLocalTagIds] = useState(new Set((teacher.tags || []).map(t => t.id)))
  const [pendingIds, setPendingIds] = useState(new Set())

  // 이 교사에게 보여줄 태그 풀 (역할별)
  const relevantTags = teacher.role === 'EXECUTIVE' ? execTags : teacherTags

  const toggleTag = async (tagId) => {
    if (pendingIds.has(tagId)) return
    const isAssigned = localTagIds.has(tagId)
    // 낙관적 업데이트
    setLocalTagIds(prev => {
      const next = new Set(prev)
      isAssigned ? next.delete(tagId) : next.add(tagId)
      return next
    })
    setPendingIds(prev => new Set(prev).add(tagId))
    try {
      if (isAssigned) {
        await tagsApi.remove(tagId, teacher.id)
      } else {
        await tagsApi.assign(tagId, teacher.id)
      }
      onTagChanged()
    } catch {
      // 실패 시 롤백
      setLocalTagIds(prev => {
        const next = new Set(prev)
        isAssigned ? next.add(tagId) : next.delete(tagId)
        return next
      })
    } finally {
      setPendingIds(prev => { const n = new Set(prev); n.delete(tagId); return n })
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-[60]" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="w-full max-w-[360px] bg-white rounded-3xl pointer-events-auto shadow-2xl overflow-y-auto"
          style={{ maxHeight: '85vh' }}
        >
          <div className="flex justify-end px-4 pt-4 pb-0">
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:scale-90 transition-transform">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-4">
            <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
              {teacher.profileImage
                ? <img src={teacher.profileImage} alt={teacher.name} className="w-full h-full object-cover" />
                : <span className="font-black text-gray-500 text-4xl">{teacher.name?.[0]}</span>
              }
            </div>
            <div className="text-center">
              <p className="font-black text-gray-900 text-xl">{teacher.name}</p>
              <span className={`inline-block mt-1 text-xs font-bold px-3 py-1 rounded-full ${displayBg}`}>
                {displayLabel}
              </span>
              {teacher.churchPosition && (
                <p className="text-[11px] text-gray-400 font-medium mt-1">{teacher.churchPosition}</p>
              )}
            </div>
            {localTagIds.size > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {allTags.filter(t => localTagIds.has(t.id)).sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                  <span key={t.id} className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${t.color || "bg-primary-50 text-primary-600 border-primary-200"}`}>
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 flex flex-col gap-2">
            {teacher.className && <InfoRow label="담당 반" value={teacher.className} icon="📚" />}
            {teacher.birthDate && (
              <InfoRow label="나이"
                value={`${age ? `만 ${age}세` : ''} (${formatBirth(teacher.birthDate)})`}
                icon="🎂" />
            )}
            {teacher.phone && <InfoRow label="전화번호" value={teacher.phone} icon="📱" isPhone />}
          </div>

          {canManageTags && relevantTags.length > 0 && (
            <div className="px-4 py-4 mt-3 border-t border-gray-50">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">태그 배정</p>
              <div className="flex flex-wrap gap-1.5">
                {relevantTags.map(tag => {
                  const assigned = localTagIds.has(tag.id)
                  const pending  = pendingIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      disabled={pending}
                      className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-full border-2 transition-all active:scale-95 ${
                        pending ? 'opacity-60' :
                        assigned ? (tag.color || 'border-primary-400 bg-primary-50 text-primary-600') : 'border-gray-100 bg-gray-50 text-gray-400'
                      }`}
                    >
                      {assigned && <Check size={10} />}
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="h-4" />
        </motion.div>
      </div>
    </>
  )
}

// ── 태그 풀 관리 모달 (목사님 전용) ──────────────────────
function TagPoolModal({ tags, execTags, teacherTags, onClose, onChanged }) {
  const [tagTab, setTagTab] = useState('EXECUTIVE')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [selectedColor, setSelectedColor] = useState('')

  const currentTags = tagTab === 'EXECUTIVE' ? execTags : teacherTags

  const usedColors = new Set(tags.map(t => t.color).filter(Boolean))

  const getLeastUsedColor = () => {
    const colorCounts = {}
    TAG_COLORS.forEach(c => colorCounts[c] = 0)
    tags.forEach(t => {
      if (t.color && colorCounts[t.color] !== undefined) {
        colorCounts[t.color]++
      }
    })
    let leastUsed = TAG_COLORS[0]
    let minCount = Infinity
    for (const c of TAG_COLORS) {
      if (colorCounts[c] < minCount) {
        minCount = colorCounts[c]
        leastUsed = c
      }
    }
    return leastUsed
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const colorToUse = selectedColor || getLeastUsedColor()
      return tagsApi.create(newName.trim(), tagTab, colorToUse)
    },
    onSuccess: () => { setNewName(''); setSelectedColor(''); onChanged() },
  })

  const updateMutation = useMutation({
    mutationFn: () => tagsApi.update(editingId, editName.trim(), tagTab, selectedColor || getLeastUsedColor()),
    onSuccess: () => { setEditingId(null); setSelectedColor(''); onChanged() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => tagsApi.delete(id),
    onSuccess: onChanged,
  })

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-[60]" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="w-full max-w-[360px] bg-white rounded-3xl pointer-events-auto shadow-2xl flex flex-col"
          style={{ maxHeight: '82vh' }}
        >
          <div className="flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="font-black text-gray-900">태그 관리</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">태그를 만들고 임원·교사에게 부여하세요</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:scale-90 transition-transform">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            {/* 임원/교사 탭 */}
            <div className="flex border-b border-gray-100 mx-5 mb-3">
              <button
                onClick={() => { setTagTab('EXECUTIVE'); setNewName(''); setEditingId(null); setSelectedColor('') }}
                className={`flex-1 py-2 text-xs font-black border-b-2 transition-all ${
                  tagTab === 'EXECUTIVE' ? 'border-amber-400 text-amber-600' : 'border-transparent text-gray-400'
                }`}
              >임원 태그</button>
              <button
                onClick={() => { setTagTab('TEACHER'); setNewName(''); setEditingId(null); setSelectedColor('') }}
                className={`flex-1 py-2 text-xs font-black border-b-2 transition-all ${
                  tagTab === 'TEACHER' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400'
                }`}
              >교사 태그</button>
            </div>
          </div>

          <div className="px-5 flex flex-col gap-2 overflow-y-auto flex-1 py-1 relative">
            {currentTags.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">아직 태그가 없습니다</p>
            )}
            {currentTags.map(tag => (
              <div key={tag.id} className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl border ${editingId === tag.id ? 'bg-white shadow-sm border-gray-200' : 'bg-gray-50 border-transparent'}`}>
                <div className="flex items-center gap-2">
                  {editingId === tag.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 text-sm font-bold bg-white border border-primary-200 rounded-lg px-2 py-1 outline-none"
                      />
                      <button
                        onClick={() => updateMutation.mutate()}
                        disabled={!editName.trim() || updateMutation.isPending}
                        className="text-[11px] font-black text-primary-600 px-2 py-1 rounded-lg bg-primary-50 active:scale-95 disabled:opacity-50"
                      >저장</button>
                      <button onClick={() => { setEditingId(null); setSelectedColor('') }} className="text-[11px] font-black text-gray-400">취소</button>
                    </>
                  ) : (
                    <>
                      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${tag.color || "bg-primary-50 text-primary-600"}`}>{tag.name}</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => { setEditingId(tag.id); setEditName(tag.name); setSelectedColor(tag.color || '') }}
                        className="text-[10px] font-black text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100"
                      >수정</button>
                      <button
                        onClick={() => deleteMutation.mutate(tag.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg active:scale-90 transition-all"
                      ><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
                {/* 편집 중 색상 팔레트 */}
                {editingId === tag.id && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                    {TAG_COLORS.map(c => {
                      const isUsed = usedColors.has(c)
                      const isCurrent = tags.find(t => t.id === editingId)?.color === c
                      const isDisabled = isUsed && !isCurrent
                      return (
                        <button
                          key={c}
                          disabled={isDisabled}
                          onClick={() => setSelectedColor(c)}
                          className={`w-5 h-5 rounded-full border-2 ${c.split(' ')[0]} ${
                            isDisabled ? 'opacity-20 cursor-not-allowed' :
                            selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                          }`}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 mt-2 flex-shrink-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              {tagTab === 'EXECUTIVE' ? '임원' : '교사'} 태그 추가
            </p>
            {/* 색상 선택 (추가 모드) */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => setSelectedColor('')}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-black ${!selectedColor ? 'border-gray-800 bg-gray-100' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
              >?</button>
              {TAG_COLORS.map(c => {
                const isDisabled = usedColors.has(c)
                return (
                  <button
                    key={c}
                    disabled={isDisabled}
                    onClick={() => setSelectedColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${c.split(' ')[0]} ${
                      isDisabled ? 'opacity-20 cursor-not-allowed' :
                      selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                    }`}
                  />
                )
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newName.trim() && createMutation.mutate()}
                placeholder="태그 이름 입력"
                maxLength={30}
                className="flex-1 text-sm font-bold px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex items-center gap-1 px-3 py-2.5 bg-primary-500 text-white text-sm font-black rounded-xl active:scale-95 disabled:opacity-50 transition-all"
              ><Plus size={15} /></button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}

function InfoRow({ label, value, icon, isPhone = false }) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  )
  if (isPhone) {
    return <a href={`tel:${value}`}>{content}</a>
  }
  return content
}

// ── 학생 교적부 컴포넌트 ─────────────────────────────────
function ClassCard({ cls, grade, colors, idx, isSelected, onClick }) {
  const count = cls.students.length
  const baptizedCount = cls.students.filter(s => s.baptism === true).length
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
      <Card onClick={onClick} className={`border-2 transition-all ${isSelected ? colors.border : 'border-transparent'}`}>
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center shadow-sm`}>
            <span className="text-white font-black text-sm">{cls.name.replace('반', '')}</span>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
            cls.gender === '여' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
          }`}>{cls.gender}</span>
        </div>
        <p className="font-black text-gray-900 text-sm leading-tight">{grade} {cls.name}</p>
        {cls.teacherName && <p className="text-[11px] text-gray-500 font-medium mt-0.5">{cls.teacherName} 선생님</p>}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Users size={11} className={colors.text} />
            <span className={`text-[11px] font-black ${colors.text}`}>{count}명</span>
          </div>
          {count > 0 && (
            <>
              <span className="text-gray-200 text-xs">|</span>
              <span className="text-[10px] text-emerald-600 font-semibold">세례 {baptizedCount}</span>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

function ClassDetailSheet({ cls, grade, colors, onClose }) {
  const count = cls.students.length
  const baptizedCount   = cls.students.filter(s => s.baptism === true).length
  const unbaptizedCount = cls.students.filter(s => s.baptism === false).length
  const unknownCount    = cls.students.filter(s => s.baptism === null).length

  const [fullStudents, setFullStudents] = useState(cls.students)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  useEffect(() => {
    let isMounted = true
    setIsLoadingDetails(true)
    classesApi.getStudents(cls.id)
      .then(res => { if (isMounted) setFullStudents(res.data) })
      .catch(err => console.error('Failed to load students', err))
      .finally(() => { if (isMounted) setIsLoadingDetails(false) })
    return () => { isMounted = false }
  }, [cls.id])

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-[60]" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="w-full max-w-[430px] bg-white rounded-3xl flex flex-col pointer-events-auto"
          style={{ maxHeight: '82vh' }}
        >
          <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center shadow-sm flex-shrink-0`}>
                  <span className="text-white font-black text-sm">{cls.name.replace('반', '')}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-gray-900">{grade} {cls.name}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      cls.gender === '여' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
                    }`}>{cls.gender}</span>
                  </div>
                  <p className="text-xs text-gray-400">{cls.teacherName ? `${cls.teacherName} 선생님 · ` : ''}총 {count}명</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:scale-90 transition-transform">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            {count > 0 && (
              <div className="flex gap-2">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-bold">세례 {baptizedCount}명</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-bold">미세례 {unbaptizedCount}명</span>
                {unknownCount > 0 && <span className="text-[11px] px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-600 font-bold">미확인 {unknownCount}명</span>}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto relative">
            {isLoadingDetails && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            )}
            {count === 0 ? <EmptyStudentState colors={colors} /> : (
              <div className="divide-y divide-gray-50">
                {fullStudents.map((student, idx) => <StudentRow key={student.id} student={student} colors={colors} idx={idx} />)}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  )
}

function StudentRow({ student, colors, idx }) {
  const age = calcAge(student.birthDate)
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
      className="flex items-start gap-3 px-5 py-3.5">
      <div className={`w-9 h-9 rounded-xl ${student.gender === '여' ? 'bg-pink-400' : 'bg-blue-400'} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm overflow-hidden`}>
        {student.profileImage
          ? <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" />
          : <span className="text-white font-black text-sm">{student.name[0]}</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="font-black text-gray-900 text-sm">{student.name}</span>
          {student.baptism === true  && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">세례</span>}
          {student.baptism === false && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">미세례</span>}
        </div>
        {(student.school || student.birthDate) && (
          <p className="text-[11px] text-gray-500 mb-1">
            {[student.school, student.birthDate && `${formatBirth(student.birthDate)} (만 ${age}세)`].filter(Boolean).join(' · ')}
          </p>
        )}
        {student.phone && (
          <a href={`tel:${student.phone}`} className="flex items-center gap-1.5 text-[11px] text-gray-600 mb-0.5 active:text-blue-600">
            <Phone size={10} className="flex-shrink-0" />{student.phone}
          </a>
        )}
        {(student.fatherName || student.fatherPhone) && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-0.5">
            <Users size={10} className="flex-shrink-0" />
            <span>{[student.fatherName, student.fatherPhone].filter(Boolean).join(' · ')}{student.fatherName && <span className="text-[9px] text-gray-400 ml-1">(부)</span>}</span>
          </div>
        )}
        {(student.motherName || student.motherPhone) && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-0.5">
            <Users size={10} className="flex-shrink-0" />
            <span>{[student.motherName, student.motherPhone].filter(Boolean).join(' · ')}{student.motherName && <span className="text-[9px] text-gray-400 ml-1">(모)</span>}</span>
          </div>
        )}
        {student.address && (
          <div className="flex items-start gap-1.5 text-[11px] text-gray-400 mt-0.5">
            <MapPin size={10} className="flex-shrink-0 mt-0.5" /><span className="leading-snug">{student.address}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function GradeEmptyState({ grade, colors }) {
  return (
    <div className="py-20 text-center flex flex-col items-center">
      <div className={`w-20 h-20 rounded-3xl ${colors.light} flex items-center justify-center mb-4`}>
        <BookOpen size={32} className={colors.text} />
      </div>
      <p className="font-black text-gray-700 text-base">{grade} 데이터 준비 중</p>
      <p className="text-xs text-gray-400 mt-2">학생 명단이 곧 등록될 예정입니다</p>
    </div>
  )
}

function EmptyStudentState({ colors }) {
  return (
    <div className="py-14 text-center flex flex-col items-center">
      <div className={`w-16 h-16 rounded-2xl ${colors.light} flex items-center justify-center mb-4`}>
        <Users size={28} className={colors.text} />
      </div>
      <p className="font-black text-gray-700">학생 정보 준비 중</p>
      <p className="text-xs text-gray-400 mt-1">곧 학생 명단이 등록될 예정입니다</p>
    </div>
  )
}
