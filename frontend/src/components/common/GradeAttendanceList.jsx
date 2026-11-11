import GradeLabel from './GradeLabel'
import DisclosureSummary from './DisclosureSummary'
import './GradeAttendanceList.css'

export const ATTENDANCE_GRADES = ['유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미분류']

export function compareAttendanceGrades(a, b) {
  const rank = grade => grade === '미분류' ? Infinity : ATTENDANCE_GRADES.includes(grade) ? ATTENDANCE_GRADES.indexOf(grade) : ATTENDANCE_GRADES.length
  return (rank(a) - rank(b)) || a.localeCompare(b, 'ko')
}

const attendanceStatus = status => status === 'ABSENT' ? ['불참', 'absent']
  : ['ATTEND', 'TUE', 'THU'].includes(status) ? ['참석', 'attend'] : ['미응답', 'unknown']

// A shared compact row keeps both meeting screens consistent and keyboard accessible.
export default function GradeAttendanceList({ rows, renderDetails }) {
  const groups = new Map()
  for (const row of rows) {
    const grade = row.teacherGrade?.trim() || '미분류'
    if (!groups.has(grade)) groups.set(grade, [])
    groups.get(grade).push(row)
  }
  return <div className="grade-attendance-list">
    {[...groups.keys()].sort(compareAttendanceGrades).map(grade => <section className="grade-attendance-group" key={grade} aria-label={`${grade} 교사 명단`}>
      <header className="grade-attendance-heading"><h3 className="ui-section-title"><GradeLabel value={grade} /></h3><span>{groups.get(grade).length}명</span></header>
      <div className="grade-attendance-rows">
        {groups.get(grade).sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ko') || a.teacherId - b.teacherId).map(row => {
          const [label, color] = attendanceStatus(row.status)
          return <details key={row.teacherId} className="grade-attendance-person">
            <DisclosureSummary className="grade-attendance-trigger" aria-label={`${row.teacherName} · ${label} · 상세 내용`}>
              <span className="grade-attendance-name">{row.teacherName}</span><span className={`grade-attendance-status grade-attendance-status-${color}`}>{label}</span>
            </DisclosureSummary>
            <dl className="grade-attendance-detail">{renderDetails(row)}</dl>
          </details>
        })}
      </div>
    </section>)}
  </div>
}
