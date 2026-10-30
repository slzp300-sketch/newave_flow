import AppSelect from '../components/common/AppSelect'
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
import { format, subWeeks, startOfWeek } from 'date-fns'
import { Users, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import StatSummary from '../components/common/StatSummary'
import { attendanceApi } from '../api/attendance'

// Recent Sundays, including the current week, preserve the existing date scope.
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

function AttendanceStatus({ status }) {
  const labels = { PRESENT: '출석', ABSENT: '결석', LATE: '지각' }
  const tone = status === 'PRESENT' ? 'bg-secondary-50 text-secondary-700' : status === 'ABSENT' ? 'bg-red-50 text-red-700' : status === 'LATE' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-700'
  return <span className={`attendance-status ${tone}`}>{labels[status] || '미기록'}</span>
}

function AttendanceTotals({ total, present, absent, late }) {
  const items = [
    ['전체', total, 'text-gray-900'],
    ['출석', present, 'text-secondary-700'],
    ['결석', absent, 'text-red-700'],
    ...(late == null ? [] : [['지각', late, 'text-amber-800']]),
  ]
  return <StatSummary label="출석 인원 요약" items={items.map(([label, value, color]) => ({ label, value, color }))} />
}

function AttendanceCounts({ total, present, absent }) {
  return <span className="attendance-counts">
    <span>전체 <strong>{total}</strong>명</span>
    <span className="text-secondary-700">출석 <strong>{present}</strong>명</span>
    <span className="text-red-700">결석 <strong>{absent}</strong>명</span>
  </span>
}

function StudentAttendanceRow({ student, showClass = false, showEmptyReason = false }) {
  return <article className="attendance-student-row">
    <div className="attendance-row-heading">
      <h3 className="attendance-row-name">{student.studentName}</h3>
      <AttendanceStatus status={student.status} />
    </div>
    {showClass && <p className="attendance-student-class">
      <GradeLabel value={student.ageGroup}>{student.ageGroup || '기타'}</GradeLabel>
      <span>{student.classGroupName || '반 미지정'}</span>
    </p>}
    {(student.absentReason || student.note || showEmptyReason) && <dl className="attendance-record-details">
      {(student.absentReason || showEmptyReason) && <><dt>사유</dt><dd>{student.absentReason || '미입력'}</dd></>}
      {student.note && <><dt>메모</dt><dd>{student.note}</dd></>}
    </dl>}
  </article>
}

function StudentDetailPanel({ classId, className, grade, date, onBack }) {
  const studentsQuery = useQuery({
    queryKey: ['admin-attendance-students', classId, date],
    queryFn: () => attendanceApi.getByClass(classId, date).then(r => r.data),
  })
  const { data: students = [], isLoading } = studentsQuery
  const present = students.filter(s => s.status === 'PRESENT').length
  const absent = students.filter(s => s.status === 'ABSENT').length
  const late = students.filter(s => s.status === 'LATE').length

  return <div className="flex flex-col gap-3">
    <div className="attendance-panel-heading">
      <button type="button" onClick={onBack} aria-label="반별 현황으로 돌아가기" className="attendance-back bg-primary-50 text-primary-600">
        <span aria-hidden="true">←</span><FitLabel>{[grade, className].filter(Boolean).join(' ')}</FitLabel>
      </button>
      <h2 className="text-lg font-bold text-gray-900">학생 명단</h2>
    </div>
    <AdminReadGuard queries={[studentsQuery]} label="학생 출석 명단">
      <AttendanceTotals total={students.length} present={present} absent={absent} late={late} />
      {isLoading ? <Card className="py-8 text-center text-sm text-gray-600">불러오는 중...</Card>
        : !students.length ? <Card className="py-10 text-center flex flex-col items-center gap-2">
          <Clock size={24} className="text-gray-200" /><p className="text-sm font-bold text-gray-600">아직 출석 데이터가 없습니다</p>
        </Card> : <ul className="attendance-list" aria-label="학생 출석 명단">
          {students.map(student => <li key={student.studentId}><StudentAttendanceRow student={student} /></li>)}
        </ul>}
    </AdminReadGuard>
  </div>
}

function ClassListPanel({ grade, classes, onBack, onSelectClass }) {
  const color = gradeClasses(grade)
  return <div className="flex flex-col gap-3">
    <div className="attendance-panel-heading">
      <button type="button" onClick={onBack} aria-label="학년별 현황으로 돌아가기" className={`attendance-back ${color.back}`}>
        <span aria-hidden="true">←</span><FitLabel>{grade} 전체</FitLabel>
      </button>
      <h2 className="text-lg font-bold text-gray-900">반별 현황</h2>
    </div>
    <ul className="attendance-list" aria-label={`${grade} 반별 출석 현황`}>
      {classes.map(cls => <li key={cls.classGroupId}>
        <button type="button" onClick={() => onSelectClass(cls)} aria-label={`${grade} ${cls.classGroupName} 학생 출석 보기`} className="attendance-list-button">
          <span className="attendance-row-content">
            <span className="attendance-row-heading">
              <span className="attendance-row-name">{cls.classGroupName}</span>
              <span className={'attendance-report-state ' + (cls.submitted ? 'attendance-report-complete' : 'attendance-report-pending')}>{cls.submitted ? '제출 완료' : '미제출'}</span>
            </span>
            <span className="attendance-teacher"><span>담임</span><span>{cls.teacherName || '미배정'}</span></span>
            <AttendanceCounts total={cls.totalStudents} present={cls.presentCount} absent={cls.absentCount} />
          </span>
          <ChevronRight size={18} className="attendance-row-chevron" aria-hidden="true" />
        </button>
      </li>)}
    </ul>
    {!classes.length && <p className="text-sm text-gray-600">표시할 반이 없습니다.</p>}
  </div>
}

function GradeListPanel({ gradeList, onSelectGrade }) {
  return <div className="flex flex-col gap-3">
    <h2 className="text-lg font-bold text-gray-900 px-1">학년별 현황</h2>
    <ul className="attendance-list" aria-label="학년별 출석 현황">
      {gradeList.map(grade => <li key={grade.grade}>
        <button type="button" onClick={() => onSelectGrade(grade.grade)} aria-label={`${grade.grade} 반별 출석 보기`} className="attendance-list-button">
          <span className="attendance-row-content">
            <span className="attendance-row-heading">
              <GradeLabel value={grade.grade} />
              <span className="attendance-grade-count">{grade.classes.length}개 반</span>
            </span>
            <AttendanceCounts total={grade.total} present={grade.present} absent={grade.absent} />
          </span>
          <ChevronRight size={18} className="attendance-row-chevron" aria-hidden="true" />
        </button>
      </li>)}
    </ul>
  </div>
}

function AbsentListPanel({ date }) {
  const absentQuery = useQuery({
    queryKey: ['admin-absent-list', date],
    queryFn: () => attendanceApi.getAdminAbsent(date).then(r => r.data),
    staleTime: 30000,
  })
  const { data: absentList = [], isLoading } = absentQuery
  if (!hasQueryData([absentQuery]) || absentQuery.isError) return <QueryNotice queries={[absentQuery]} label="결석·지각 명단" />
  if (isLoading) return <Card className="py-10 text-center text-sm text-gray-600">불러오는 중...</Card>
  if (!absentList.length) return <Card className="py-14 flex flex-col items-center gap-3">
    <CheckCircle2 size={32} className="text-secondary-200" /><p className="text-sm font-bold text-gray-600">선택한 주일에 결석·지각 기록이 없습니다</p>
  </Card>
  return <div className="flex flex-col gap-3">
    <div className="attendance-panel-heading"><h2 className="text-lg font-bold text-gray-900">결석·지각 목록</h2><span className="text-sm font-bold text-red-700">{absentList.length}명</span></div>
    <ul className="attendance-list" aria-label="결석·지각 명단">
      {absentList.map((student, index) => <li key={`${student.ageGroup}:${student.classGroupName}:${student.studentName}:${index}`}>
        <StudentAttendanceRow student={student} showClass showEmptyReason />
      </li>)}
    </ul>
  </div>
}


// ── 메인 페이지 ──────────────────────────────────────────────
export default function AdminStudentAttendancePage() {
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

      <div className="px-4 py-5 flex flex-col gap-4">

        <AdminIntro title="주일 출석 현황" />
        {/* 주차 선택 */}
        <section>
          <label htmlFor="admin-attendance-week" className="block text-base font-bold text-gray-900 px-1 mb-2">조회할 주일</label>
          <AppSelect id="admin-attendance-week" aria-label="출석 조회 주차"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-base font-bold text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-primary-200"
          >
            {sundays.map(s => (
              <option key={s} value={s}>
                {format(new Date(s + 'T00:00:00'), 'yyyy년 M월 d일')} 주일
              </option>
            ))}
          </AppSelect>
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
            <AttendanceTotals total={totalStudents} present={totalPresent} absent={totalAbsent} />

            {/* 탭 (학년별 / 결석자) */}
            {!selectedGrade && !selectedClass && (
              <SegmentedControl label="출석 조회 방식" value={activeTab} onChange={setActiveTab} selectedClassName="text-gray-900"
                options={[{ value: 'grade', label: '학년별 현황' }, { value: 'absent', label: '결석·지각' }]} />
            )}

            {/* 뷰 전환 */}
            {selectedClass ? (
              <StudentDetailPanel
                grade={selectedGrade}
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
              <GradeListPanel
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
