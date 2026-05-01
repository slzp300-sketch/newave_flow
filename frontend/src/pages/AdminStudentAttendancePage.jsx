import { useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format, subWeeks, startOfWeek } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Users, CheckCircle2, XCircle, Clock, ChevronRight, AlertCircle } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { attendanceApi } from '../api/attendance'

// ── 주차 목록 생성 (최근 10주, 일요일 기준) ─────────────────────
function getPastSundays(count = 10) {
  const sundays = []
  const thisSunday = startOfWeek(new Date(), { weekStartsOn: 0 })
  for (let i = 0; i < count; i++) {
    sundays.push(format(subWeeks(thisSunday, i), 'yyyy-MM-dd'))
  }
  return sundays
}

const GRADE_ORDER = ['중1', '중2', '중3', '고1', '고2', '고3', '기타']

const GRADE_COLORS = {
  '중1': { bg: 'bg-rose-50',    text: 'text-rose-600',    accent: 'bg-rose-100',    bar: 'bg-rose-400',    back: 'text-rose-600 bg-rose-50' },
  '중2': { bg: 'bg-orange-50',  text: 'text-orange-600',  accent: 'bg-orange-100',  bar: 'bg-orange-400',  back: 'text-orange-600 bg-orange-50' },
  '중3': { bg: 'bg-amber-50',   text: 'text-amber-600',   accent: 'bg-amber-100',   bar: 'bg-amber-400',   back: 'text-amber-600 bg-amber-50' },
  '고1': { bg: 'bg-emerald-50', text: 'text-emerald-600', accent: 'bg-emerald-100', bar: 'bg-emerald-400', back: 'text-emerald-600 bg-emerald-50' },
  '고2': { bg: 'bg-blue-50',    text: 'text-blue-600',    accent: 'bg-blue-100',    bar: 'bg-blue-400',    back: 'text-blue-600 bg-blue-50' },
  '고3': { bg: 'bg-violet-50',  text: 'text-violet-600',  accent: 'bg-violet-100',  bar: 'bg-violet-400',  back: 'text-violet-600 bg-violet-50' },
  '기타': { bg: 'bg-gray-50',   text: 'text-gray-500',    accent: 'bg-gray-100',    bar: 'bg-gray-400',    back: 'text-gray-600 bg-gray-50' },
}

function getGradeKey(ageGroup) {
  if (!ageGroup) return '기타'
  const match = ageGroup.match(/^(중[123]|고[123])/)
  return match ? match[1] : '기타'
}

function getGradeColor(grade) {
  return GRADE_COLORS[grade] || GRADE_COLORS['기타']
}

// ── 학생 목록 패널 ────────────────────────────────────────────
function StudentDetailPanel({ classId, className, date, onBack }) {
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-attendance-students', classId, date],
    queryFn: () => attendanceApi.getByClass(classId, date).then(r => r.data),
  })

  const present = students.filter(s => s.status === 'PRESENT').length
  const absent  = students.filter(s => s.status === 'ABSENT').length
  const late    = students.filter(s => s.status === 'LATE').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-black text-primary-600 bg-primary-50 px-3 py-1.5 rounded-xl active:scale-95 transition-all"
        >
          ← {className}
        </button>
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">학생 명단</p>
      </div>

      {/* 반 통계 */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-3">
          <p className="text-xl font-black text-gray-900">{students.length}</p>
          <p className="text-[10px] font-black text-gray-400 mt-0.5">전체</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xl font-black text-emerald-500">{present}</p>
          <p className="text-[10px] font-black text-gray-400 mt-0.5">출석</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xl font-black text-red-400">{absent + late}</p>
          <p className="text-[10px] font-black text-gray-400 mt-0.5">결석</p>
        </Card>
      </div>

      {isLoading ? (
        <Card className="py-8 text-center text-sm text-gray-400">불러오는 중...</Card>
      ) : students.length === 0 ? (
        <Card className="py-10 text-center flex flex-col items-center gap-2">
          <Clock size={24} className="text-gray-200" />
          <p className="text-sm font-black text-gray-400">아직 출석 데이터가 없습니다</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-1.5 p-3">
          {students.map((s, idx) => (
            <motion.div
              key={s.studentId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`flex items-start justify-between px-3 py-2.5 rounded-2xl ${
                s.status === 'PRESENT' ? 'bg-emerald-50/60' :
                s.status === 'ABSENT'  ? 'bg-red-50/60' :
                s.status === 'LATE'    ? 'bg-amber-50/60' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  s.status === 'PRESENT' ? 'bg-emerald-200 text-emerald-700' :
                  s.status === 'ABSENT'  ? 'bg-red-200 text-red-700' :
                  s.status === 'LATE'    ? 'bg-amber-200 text-amber-700' :
                  'bg-gray-200 text-gray-500'
                }`}>{(s.studentName || '?')[0]}</span>
                <div>
                  <p className="text-sm font-black text-gray-800">{s.studentName}</p>
                  {s.absentReason && (
                    <p className="text-[10px] text-red-400 font-medium mt-0.5">
                      사유: {s.absentReason}
                    </p>
                  )}
                  {s.note && (
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                      메모: {s.note}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 mt-0.5">
                {s.status === 'PRESENT' ? <CheckCircle2 size={16} className="text-emerald-500" /> :
                 s.status === 'ABSENT'  ? <XCircle size={16} className="text-red-400" /> :
                 s.status === 'LATE'    ? <Clock size={16} className="text-amber-500" /> :
                 <span className="text-[10px] text-gray-400 font-bold">미기록</span>}
              </div>
            </motion.div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ── 반 목록 패널 ─────────────────────────────────────────────
function ClassListPanel({ grade, classes, date, onBack, onSelectClass }) {
  const color = getGradeColor(grade)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onBack}
          className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl active:scale-95 transition-all ${color.back}`}
        >
          ← {grade} 전체
        </button>
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">반별 현황</p>
      </div>

      <div className="flex flex-col gap-3">
        {classes.map((cls, idx) => {
          const pct = cls.totalStudents > 0 ? (cls.presentCount / cls.totalStudents) * 100 : 0
          return (
            <motion.button
              key={cls.classGroupId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectClass(cls)}
              className="w-full text-left"
            >
              <Card className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow active:scale-[0.99]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl ${color.accent} flex items-center justify-center flex-shrink-0`}>
                      <Users size={18} className={color.text} />
                    </div>
                    <div>
                      <p className="font-black text-gray-900 text-sm">{cls.classGroupName}</p>
                      <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                        {cls.presentCount}명 출석 · {cls.absentCount}명 결석
                        {!cls.submitted && <span className="text-amber-500 ml-1">· 미제출</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-black ${color.text}`}>
                      {cls.presentCount}/{cls.totalStudents}
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`h-full rounded-full ${color.bar}`}
                  />
                </div>
              </Card>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ── 학년 카드 그리드 ─────────────────────────────────────────
function GradeGridPanel({ gradeGroups, gradeList, onSelectGrade }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">학년별 현황</p>
      <div className="grid grid-cols-2 gap-3">
        {gradeList.map((g, idx) => {
          const color = getGradeColor(g.grade)
          const pct = g.total > 0 ? (g.present / g.total) * 100 : 0
          return (
            <motion.button
              key={g.grade}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectGrade(g.grade)}
              className={`${color.bg} rounded-3xl p-5 flex flex-col items-center gap-2 border-2 border-transparent hover:border-opacity-50 active:scale-95 transition-all text-center`}
            >
              <div className={`w-12 h-12 rounded-2xl ${color.accent} flex items-center justify-center mb-1`}>
                <Users size={24} className={color.text} />
              </div>
              <div>
                <p className={`font-black text-lg leading-tight ${color.text}`}>{g.grade}</p>
                <p className="text-[10px] text-gray-400 font-bold mt-1">
                  {g.present} / {g.total} 출석
                </p>
              </div>
              <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full ${color.bar} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ── 결석자 목록 패널 ─────────────────────────────────────────
function AbsentListPanel({ date }) {
  const { data: absentList = [], isLoading } = useQuery({
    queryKey: ['admin-absent-list', date],
    queryFn: () => attendanceApi.getAdminAbsent(date).then(r => r.data),
    staleTime: 30000,
  })

  if (isLoading) return <Card className="py-10 text-center text-sm text-gray-400">불러오는 중...</Card>

  if (absentList.length === 0) return (
    <Card className="py-14 flex flex-col items-center gap-3">
      <CheckCircle2 size={32} className="text-emerald-200" />
      <p className="text-sm font-black text-gray-400">이번 주 결석자가 없습니다</p>
    </Card>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">결석자 목록</p>
        <span className="text-xs font-black text-red-500">{absentList.length}명</span>
      </div>
      <Card className="flex flex-col gap-1.5 p-3">
        {absentList.map((s, idx) => {
          const gradeColor = getGradeColor(getGradeKey(s.ageGroup))
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="flex items-start gap-3 px-3 py-3 rounded-2xl bg-red-50/50"
            >
              {/* 학년 뱃지 */}
              <div className={`px-2 py-1 rounded-lg text-[10px] font-black flex-shrink-0 ${gradeColor.accent} ${gradeColor.text}`}>
                {s.ageGroup || '기타'}
              </div>
              {/* 반 + 이름 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 font-bold">{s.classGroupName}</span>
                  <span className="text-gray-200">·</span>
                  <span className="text-sm font-black text-gray-800">{s.studentName}</span>
                  {s.status === 'LATE' && (
                    <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md">지각</span>
                  )}
                </div>
                {s.absentReason ? (
                  <p className="text-[10px] text-red-400 font-medium mt-0.5 truncate">
                    사유: {s.absentReason}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-300 font-medium mt-0.5">사유 미입력</p>
                )}
              </div>
              <XCircle size={15} className="text-red-300 flex-shrink-0 mt-0.5" />
            </motion.div>
          )
        })}
      </Card>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function AdminStudentAttendancePage() {
  const sundays = getPastSundays()
  const [selectedDate, setSelectedDate] = useState(sundays[0])
  const [activeTab, setActiveTab] = usePersistedState('activeTab', 'grade')
  const [selectedGrade, setSelectedGrade] = usePersistedState('selectedGrade', null)
  const [selectedClass, setSelectedClass] = usePersistedState('selectedClass', null)

  const { data: classSummaries = [], isLoading } = useQuery({
    queryKey: ['admin-weekly-attendance', selectedDate],
    queryFn: () => attendanceApi.getAdminWeekly(selectedDate).then(r => r.data),
    staleTime: 30000,
  })

  // 학년별 그룹화
  const gradeGroups = classSummaries.reduce((acc, cls) => {
    const grade = getGradeKey(cls.ageGroup)
    if (!acc[grade]) acc[grade] = { grade, total: 0, present: 0, absent: 0, classes: [] }
    acc[grade].total   += cls.totalStudents
    acc[grade].present += cls.presentCount
    acc[grade].absent  += cls.absentCount
    acc[grade].classes.push(cls)
    return acc
  }, {})

  const gradeList = Object.values(gradeGroups).sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a.grade)
    const bi = GRADE_ORDER.indexOf(b.grade)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.grade.localeCompare(b.grade)
  })

  const totalPresent = classSummaries.reduce((s, c) => s + c.presentCount, 0)
  const totalStudents = classSummaries.reduce((s, c) => s + c.totalStudents, 0)
  const totalAbsent  = classSummaries.reduce((s, c) => s + c.absentCount, 0)

  const handleDateChange = (date) => {
    setSelectedDate(date)
    setSelectedGrade(null)
    setSelectedClass(null)
    setActiveTab('grade')
  }

  const handleSelectGrade = (grade) => {
    setSelectedGrade(grade)
    setSelectedClass(null)
  }

  const handleSelectClass = (cls) => setSelectedClass(cls)

  const handleBackToGrade = () => setSelectedClass(null)
  const handleBackToGrades = () => { setSelectedGrade(null); setSelectedClass(null) }

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="출석 관리" showBack />

      <div className="px-4 py-5 flex flex-col gap-5">

        {/* 주차 선택 */}
        <section>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">주차 선택 (기준 주일)</p>
          <select
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm font-black text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-primary-200"
          >
            {sundays.map(s => (
              <option key={s} value={s}>
                {format(new Date(s + 'T00:00:00'), 'yyyy년 M월 d일 (EEE)', { locale: ko })} 주차
              </option>
            ))}
          </select>
        </section>

        {isLoading ? (
          <Card className="py-16 text-center text-sm text-gray-400">불러오는 중...</Card>
        ) : classSummaries.length === 0 ? (
          <Card className="py-16 flex flex-col items-center gap-3">
            <Users size={36} className="text-gray-200" />
            <p className="text-sm font-black text-gray-400">해당 주차에 제출된 출석 데이터가 없습니다</p>
          </Card>
        ) : (
          <>
            {/* 전체 통계 */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center py-4">
                <p className="text-2xl font-black text-gray-900">{totalStudents}</p>
                <p className="text-[10px] font-black text-gray-400 mt-1">전체</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-2xl font-black text-emerald-500">{totalPresent}</p>
                <p className="text-[10px] font-black text-gray-400 mt-1">출석</p>
              </Card>
              <Card className="text-center py-4">
                <p className="text-2xl font-black text-red-400">{totalAbsent}</p>
                <p className="text-[10px] font-black text-gray-400 mt-1">결석</p>
              </Card>
            </div>

            {/* 탭 (학년별 / 결석자) */}
            {!selectedGrade && !selectedClass && (
              <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                <button
                  onClick={() => setActiveTab('grade')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'grade' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <Users size={13} /> 학년별 현황
                </button>
                <button
                  onClick={() => setActiveTab('absent')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'absent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <AlertCircle size={13} /> 결석자 목록
                </button>
              </div>
            )}

            {/* 뷰 전환 */}
            {selectedClass ? (
              <StudentDetailPanel
                classId={selectedClass.classGroupId}
                className={selectedClass.classGroupName}
                date={selectedDate}
                onBack={handleBackToGrade}
              />
            ) : selectedGrade ? (
              <ClassListPanel
                grade={selectedGrade}
                classes={gradeGroups[selectedGrade]?.classes || []}
                date={selectedDate}
                onBack={handleBackToGrades}
                onSelectClass={handleSelectClass}
              />
            ) : activeTab === 'absent' ? (
              <AbsentListPanel date={selectedDate} />
            ) : (
              <GradeGridPanel
                gradeGroups={gradeGroups}
                gradeList={gradeList}
                onSelectGrade={handleSelectGrade}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
