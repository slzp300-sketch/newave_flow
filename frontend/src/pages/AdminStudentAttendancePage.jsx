import GradeLabel from '../components/common/GradeLabel'
import { gradeClasses, gradeKey } from '../utils/gradeColors'
import FitLabel from '../components/common/FitLabel'
import './AdminStudentAttendancePage.css'
import SegmentedControl from '../components/common/SegmentedControl'
import { AdminIntro } from '../components/common/AdminTools'
import AdminReadGuard from '../components/common/AdminReadGuard'
import QueryNotice from '../components/common/QueryNotice'
import { hasQueryData } from '../utils/queryReadState'
import { useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { format, subWeeks, startOfWeek } from 'date-fns'
import { Users, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
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

function getGradeKey(value) { return gradeKey(value) || '기타' }
function getGradeColor(value) { const tone = gradeClasses(value); return { ...tone, bg: tone.light } }

function AttendanceRecords(props) {
  return <div className="admin-attendance-records min-w-0"><RecordViews {...props} /></div>
}

function AttendanceStatus({ status }) {
  const labels = { PRESENT: '출석', ABSENT: '결석', LATE: '지각' }
  const tone = status === 'PRESENT' ? 'bg-secondary-50 text-secondary-700' : status === 'ABSENT' ? 'bg-red-50 text-red-700' : status === 'LATE' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700'
  return <span className={`inline-block rounded-lg px-2 py-1 text-sm font-bold ${tone}`}>{labels[status] || '미기록'}</span>
}

// ── 학생 목록 패널 ────────────────────────────────────────────
function StudentDetailPanel({ classId, className, date, onBack, viewMode }) {
  const studentsQuery = useQuery({
    queryKey: ['admin-attendance-students', classId, date],
    queryFn: () => attendanceApi.getByClass(classId, date).then(r => r.data),
  })
  const { data: students = [], isLoading } = studentsQuery


  const present = students.filter(s => s.status === 'PRESENT').length
  const absent  = students.filter(s => s.status === 'ABSENT').length
  const late    = students.filter(s => s.status === 'LATE').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <button
          onClick={onBack}
          className="flex min-w-0 max-w-full min-h-11 items-center gap-2 text-base font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-xl active:scale-95 transition-all"
        >
          <span aria-hidden="true">←</span><FitLabel>{className}</FitLabel>
        </button>
        <h2 className="text-lg font-bold text-gray-900">학생 명단</h2>
      </div>

      <AdminReadGuard queries={[studentsQuery]} label="학생 출석 명단">
      {/* 반 통계 */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="min-w-0 text-center px-2 py-3">
          <p className="text-xl font-bold text-gray-900">{students.length}</p>
          <p className="text-sm font-bold text-gray-600 mt-0.5">전체</p>
        </Card>
        <Card className="min-w-0 text-center px-2 py-3">
          <p className="text-xl font-bold text-secondary-700">{present}</p>
          <p className="text-sm font-bold text-gray-600 mt-0.5">출석</p>
        </Card>
        <Card className="min-w-0 text-center px-2 py-3">
          <p className="text-xl font-bold text-red-700">{absent}</p>
          <p className="text-sm font-bold text-gray-600 mt-0.5">결석</p>
        </Card>
        <Card className="min-w-0 text-center px-2 py-3">
          <p className="text-xl font-bold text-amber-800">{late}</p>
          <p className="text-sm font-bold text-gray-600 mt-0.5">지각</p>
        </Card>
      </div>

      {isLoading ? (
        <Card className="py-8 text-center text-sm text-gray-600">불러오는 중...</Card>
      ) : students.length === 0 ? (
        <Card className="py-10 text-center flex flex-col items-center gap-2">
          <Clock size={24} className="text-gray-200" />
          <p className="text-sm font-bold text-gray-600">아직 출석 데이터가 없습니다</p>
        </Card>
      ) : (
        <AttendanceRecords mode={viewMode} rows={students} rowKey={s => s.studentId} columns={[
          { label: '학생', render: s => s.studentName },
          { label: '출석', render: s => <AttendanceStatus status={s.status} /> },
          { label: '결석 사유', render: s => s.absentReason },
          { label: '메모', render: s => s.note },
        ]}>
        <Card className="flex flex-col gap-1.5 p-3">
          {students.map((s, idx) => (
            <motion.div
              key={s.studentId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`brand-card grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-start px-3 py-3 rounded-2xl ${
                s.status === 'PRESENT' ? 'bg-secondary-50/60' :
                s.status === 'ABSENT'  ? 'bg-red-50/60' :
                s.status === 'LATE'    ? 'bg-amber-50/60' : 'bg-gray-50'
              }`}
            >
              <div className="contents">
                <span className={`text-sm font-bold w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  s.status === 'PRESENT' ? 'bg-secondary-200 text-secondary-700' :
                  s.status === 'ABSENT'  ? 'bg-red-200 text-red-700' :
                  s.status === 'LATE'    ? 'bg-amber-200 text-amber-700' :
                  'bg-gray-200 text-gray-500'
                }`}>{(s.studentName || '?')[0]}</span>
                <div className="min-w-0">
                  <p className="text-base font-bold leading-relaxed text-gray-900">{s.studentName}</p>
                </div>
              </div>
              <div className="col-start-2"><AttendanceStatus status={s.status} /></div>
              {s.absentReason && <p className="col-span-2 text-sm text-red-700 font-medium leading-relaxed">사유: {s.absentReason}</p>}
              {s.note && <p className="col-span-2 text-sm text-gray-600 font-medium leading-relaxed">메모: {s.note}</p>}
            </motion.div>
          ))}
        </Card>
        </AttendanceRecords>
      )}
      </AdminReadGuard>
    </div>
  )
}

// ── 반 목록 패널 ─────────────────────────────────────────────
function ClassListPanel({ grade, classes, date, onBack, onSelectClass, viewMode }) {
  const color = getGradeColor(grade)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <button
          onClick={onBack}
          className={`flex min-h-11 min-w-0 max-w-full items-center gap-2 text-base font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all ${color.back}`}
        >
          <span aria-hidden="true">←</span><FitLabel>{grade} 전체</FitLabel>
        </button>
        <h2 className="text-lg font-bold text-gray-900">반별 현황</h2>
      </div>

      <AttendanceRecords mode={viewMode} rows={classes} rowKey={cls => cls.classGroupId} onRowClick={onSelectClass} columns={[
        { label: '반', render: cls => cls.classGroupName },
        { label: '담임', render: cls => cls.teacherName },
        { label: '전체', render: cls => `${cls.totalStudents}명` },
        { label: '출석', render: cls => `${cls.presentCount}명` },
        { label: '결석', render: cls => `${cls.absentCount}명` },
        { label: '보고서', render: cls => cls.submitted ? '제출 완료' : '미제출' },
      ]}>
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
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                  <div className="contents">
                    <div className={`w-10 h-10 rounded-2xl ${color.accent} flex items-center justify-center flex-shrink-0`}>
                      <Users size={18} className={color.text} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-base"><FitLabel>{cls.classGroupName}</FitLabel></p>
                      <p className="text-sm text-gray-600 font-bold mt-0.5">
                        {cls.teacherName ? `담임 ${cls.teacherName}` : '담임 미배정'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-gray-500 mt-1" aria-hidden="true" />
                  <div className="col-start-2 col-span-2 flex flex-wrap gap-x-3 gap-y-2 text-sm font-semibold">
                    <span className="text-gray-600">전체 {cls.totalStudents}명</span>
                    <span className="text-secondary-700">출석 {cls.presentCount}명</span>
                    <span className="text-red-700">결석 {cls.absentCount}명</span>
                    <span className={cls.submitted ? 'text-gray-600' : 'text-amber-800'}>{cls.submitted ? '제출 완료' : '미제출'}</span>
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
      </AttendanceRecords>
    </div>
  )
}

// ── 학년 카드 그리드 ─────────────────────────────────────────
function GradeGridPanel({ gradeGroups, gradeList, onSelectGrade, viewMode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-gray-900 px-1">학년별 현황</h2>
      <AttendanceRecords mode={viewMode} rows={gradeList} rowKey={g => g.grade} onRowClick={g => onSelectGrade(g.grade)} columns={[
        { label: '학년', render: g => <GradeLabel value={g.grade} /> },
        { label: '전체', render: g => `${g.total}명` },
        { label: '출석', render: g => `${g.present}명` },
        { label: '결석', render: g => `${g.absent}명` },
      ]}>
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
              className={`${color.bg} min-w-0 rounded-3xl p-4 flex flex-col items-center gap-2 border-2 border-transparent hover:border-opacity-50 active:scale-95 transition-all text-center`}
            >
              <div className={`w-12 h-12 rounded-2xl ${color.accent} flex items-center justify-center mb-1`}>
                <Users size={24} className={color.text} />
              </div>
              <div className="min-w-0 w-full">
                <p className={`font-bold text-lg leading-tight ${color.text}`}><FitLabel>{g.grade}</FitLabel></p>
                <p className="text-sm text-gray-600 font-bold mt-1">
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
      </AttendanceRecords>
    </div>
  )
}

// ── 결석자 목록 패널 ─────────────────────────────────────────
function AbsentListPanel({ date, viewMode }) {
  const absentQuery = useQuery({
    queryKey: ['admin-absent-list', date],
    queryFn: () => attendanceApi.getAdminAbsent(date).then(r => r.data),
    staleTime: 30000,
  })
  const { data: absentList = [], isLoading } = absentQuery

  if (!hasQueryData([absentQuery]) || absentQuery.isError) return <QueryNotice queries={[absentQuery]} label="결석·지각 명단" />
  if (isLoading) return <Card className="py-10 text-center text-sm text-gray-600">불러오는 중...</Card>

  if (absentList.length === 0) return (
    <Card className="py-14 flex flex-col items-center gap-3">
      <CheckCircle2 size={32} className="text-secondary-200" />
      <p className="text-sm font-bold text-gray-600">선택한 주일에 결석·지각 기록이 없습니다</p>
    </Card>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-lg font-bold text-gray-900">결석·지각 목록</h2>
        <span className="text-sm font-bold text-red-700">{absentList.length}명</span>
      </div>
      <AttendanceRecords mode={viewMode} rows={absentList} rowKey={(s, index) => `${s.ageGroup}:${s.classGroupName}:${s.studentName}:${index}`} columns={[
        { label: '학생', render: s => s.studentName },
        { label: '학년', render: s => <GradeLabel value={s.ageGroup} /> },
        { label: '반', render: s => s.classGroupName },
        { label: '출석', render: s => <AttendanceStatus status={s.status} /> },
        { label: '결석 사유', render: s => s.absentReason },
      ]}>
      <Card className="flex flex-col gap-1.5 p-3">
        {absentList.map((s, idx) => {
          const gradeColor = getGradeColor(getGradeKey(s.ageGroup))
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="brand-card flex flex-col gap-2 px-3 py-3 rounded-2xl bg-red-50/50"
            >
              {/* 학년 뱃지 */}
              <div className={`self-start max-w-full px-2 py-1 rounded-lg text-sm font-bold ${gradeColor.accent} ${gradeColor.text}`}>
                {s.ageGroup || '기타'}
              </div>
              {/* 반 + 이름 */}
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold leading-relaxed text-gray-900">{s.studentName}</p>
                <p className="mt-1 text-sm text-gray-600">{s.classGroupName}</p>
                <div className="mt-2"><AttendanceStatus status={s.status} /></div>
                {s.absentReason ? (
                  <p className="text-sm text-red-700 font-medium mt-2 leading-relaxed">
                    사유: {s.absentReason}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 font-medium mt-0.5">사유 미입력</p>
                )}
              </div>

            </motion.div>
          )
        })}
      </Card>
      </AttendanceRecords>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────
export default function AdminStudentAttendancePage() {
  const [viewMode, setViewMode] = useViewMode('admin-student-attendance', 'large')
  const sundays = getPastSundays()
  const [selectedDate, setSelectedDate] = useState(sundays[0])
  const [activeTab, setActiveTab] = usePersistedState('activeTab', 'grade')
  const [selectedGrade, setSelectedGrade] = usePersistedState('selectedGrade', null)
  const [selectedClass, setSelectedClass] = usePersistedState('selectedClass', null)

  const attendanceQuery = useQuery({
    queryKey: ['admin-weekly-attendance', selectedDate],
    queryFn: () => attendanceApi.getAdminWeekly(selectedDate).then(r => r.data),
    staleTime: 30000,
  })
  const { data: classSummaries = [], isLoading } = attendanceQuery

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
    <div className="admin-attendance-page flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="출석 관리" showBack />

      <div className="px-4 py-5 flex flex-col gap-5">

        <AdminIntro title="주일 출석 현황" description="학년·반·학생별 출석과 결석·지각 기록을 확인하세요." />
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        {/* 주차 선택 */}
        <section>
          <label htmlFor="admin-attendance-week" className="block text-base font-bold text-gray-900 px-1 mb-2">조회할 주일</label>
          <select id="admin-attendance-week" aria-label="출석 조회 주차"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-base font-bold text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-primary-200"
          >
            {sundays.map(s => (
              <option key={s} value={s}>
                {format(new Date(s + 'T00:00:00'), 'yyyy년 M월 d일')} 주일
              </option>
            ))}
          </select>
        </section>

        <AdminReadGuard queries={[attendanceQuery]} label="주간 출석 현황">
        {isLoading ? (
          <Card className="py-16 text-center text-sm text-gray-600">불러오는 중...</Card>
        ) : classSummaries.length === 0 ? (
          <Card className="py-16 flex flex-col items-center gap-3">
            <Users size={36} className="text-gray-200" />
            <p className="text-sm font-bold text-gray-600">해당 주차에 제출된 출석 데이터가 없습니다</p>
          </Card>
        ) : (
          <>
            {/* 전체 통계 */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="min-w-0 text-center px-2 py-4">
                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
                <p className="text-sm font-bold text-gray-600 mt-1">전체</p>
              </Card>
              <Card className="min-w-0 text-center px-2 py-4">
                <p className="text-2xl font-bold text-secondary-700">{totalPresent}</p>
                <p className="text-sm font-bold text-gray-600 mt-1">출석</p>
              </Card>
              <Card className="min-w-0 text-center px-2 py-4">
                <p className="text-2xl font-bold text-red-700">{totalAbsent}</p>
                <p className="text-sm font-bold text-gray-600 mt-1">결석</p>
              </Card>
            </div>

            {/* 탭 (학년별 / 결석자) */}
            {!selectedGrade && !selectedClass && (
              <SegmentedControl label="출석 조회 방식" value={activeTab} onChange={setActiveTab} selectedClassName="text-gray-900"
                options={[{ value: 'grade', label: '학년별 현황' }, { value: 'absent', label: '결석·지각' }]} />
            )}

            {/* 뷰 전환 */}
            {selectedClass ? (
              <StudentDetailPanel
                viewMode={viewMode}
                classId={selectedClass.classGroupId}
                className={selectedClass.classGroupName}
                date={selectedDate}
                onBack={handleBackToGrade}
              />
            ) : selectedGrade ? (
              <ClassListPanel
                viewMode={viewMode}
                grade={selectedGrade}
                classes={gradeGroups[selectedGrade]?.classes || []}
                date={selectedDate}
                onBack={handleBackToGrades}
                onSelectClass={handleSelectClass}
              />
            ) : activeTab === 'absent' ? (
              <AbsentListPanel date={selectedDate} viewMode={viewMode} />
            ) : (
              <GradeGridPanel
                viewMode={viewMode}
                gradeGroups={gradeGroups}
                gradeList={gradeList}
                onSelectGrade={handleSelectGrade}
              />
            )}
          </>
        )}
        </AdminReadGuard>
      </div>
    </div>
  )
}
