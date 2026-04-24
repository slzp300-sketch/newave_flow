import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, X, BookOpen, Phone, MapPin, Loader2 } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { classesApi } from '../api/classes'

const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3']


const GRADE_COLORS = {
  '중1': { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-300'    },
  '중2': { bg: 'bg-violet-500',  light: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-300'  },
  '중3': { bg: 'bg-indigo-500',  light: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-300'  },
  '고1': { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-300' },
  '고2': { bg: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-300'   },
  '고3': { bg: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-300'    },
}

function calcAge(birth) {
  if (!birth) return null
  const today = new Date()
  const b = new Date(birth)
  let age = today.getFullYear() - b.getFullYear()
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--
  return age
}

function formatBirth(birth) {
  if (!birth) return null
  return birth.replace(/-/g, '.')
}

// ── 메인 페이지 ─────────────────────────────
export default function RosterPage() {
  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="교적부" showBack />
      <RosterTab />
    </div>
  )
}

// ── 교적부 탭 (기존 기능) ───────────────────
function RosterTab() {
  const [selectedGrade, setSelectedGrade] = useState('중1')
  const [selectedClass, setSelectedClass] = useState(null)
  const [rosterData, setRosterData] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const loadData = useCallback(() => {
    setIsLoading(true)
    setHasError(false)
    classesApi.getRoster().then(r => {
      const grouped = r.data.reduce((acc, cls) => {
        const grade = cls.grade || '기타'
        if (!acc[grade]) acc[grade] = []
        acc[grade].push(cls)
        return acc
      }, {})
      setRosterData(grouped)
    }).catch(() => {
      setHasError(true)
    }).finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const classes = rosterData[selectedGrade] || []
  const colors = GRADE_COLORS[selectedGrade] || GRADE_COLORS['중1']
  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center mt-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center mt-20 gap-4">
        <p className="text-gray-500 font-bold text-sm">데이터를 불러올 수 없습니다</p>
        <button
          onClick={loadData}
          className="px-5 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-xl active:scale-95 transition-transform"
        >
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
              <button
                key={grade}
                onClick={() => { setSelectedGrade(grade); setSelectedClass(null) }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-black transition-all active:scale-95 ${
                  isActive ? `${gc.bg} text-white shadow-md` : 'bg-gray-100 text-gray-500'
                }`}
              >
                {grade}
              </button>
            )
          })}
        </div>
        <motion.div
          key={selectedGrade}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mx-4 mb-3 px-4 py-2.5 rounded-xl ${colors.light} flex items-center gap-2`}
        >
          <BookOpen size={13} className={colors.text} />
          <span className={`text-xs font-black ${colors.text}`}>{selectedGrade}</span>
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-xs text-gray-600 font-semibold">총 {classes.length}반</span>
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-xs text-gray-600 font-semibold">{totalStudents}명</span>
        </motion.div>
      </div>

      <div className="px-4 py-4">
        {classes.length === 0 ? (
          <GradeEmptyState grade={selectedGrade} colors={colors} />
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
          <ClassDetailSheet cls={selectedClass} grade={selectedGrade} colors={colors} onClose={() => setSelectedClass(null)} />
        )}
      </AnimatePresence>
    </>
  )
}

// ── 교적부 컴포넌트들 ────────────────────────
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
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-20" />
      <div className="fixed inset-0 z-30 flex items-center justify-center px-4 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
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
        <div className="flex-1 overflow-y-auto">
          {count === 0 ? <EmptyStudentState colors={colors} /> : (
            <div className="divide-y divide-gray-50">
              {cls.students.map((student, idx) => <StudentRow key={student.id} student={student} colors={colors} idx={idx} />)}
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
        {student.profileImage ? (
          <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-black text-sm">{student.name[0]}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="font-black text-gray-900 text-sm">{student.name}</span>
          {student.baptism === true && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">세례</span>}
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
