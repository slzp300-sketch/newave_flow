import { gradeKey } from './gradeColors.js'
import { matchesAdminSearch } from './adminSearch.js'
import { eventAttendanceCounts } from './eventAttendanceSummary.js'

const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3']
export const EVENT_ATTENDANCE_STATUSES = [
  { value: 'PRESENT', label: '참석', count: 'present', tone: 'present' },
  { value: 'PARTIAL', label: '부분참석', count: 'partial', tone: 'partial' },
  { value: 'ABSENT', label: '불참', count: 'absent', tone: 'absent' },
  { value: 'UNSUBMITTED', label: '미제출', count: 'unsubmitted', tone: 'unsubmitted' },
]
export const attendanceStatusOf = status => EVENT_ATTENDANCE_STATUSES.find(item => item.value === status) || EVENT_ATTENDANCE_STATUSES[3]
const groupGrade = value => gradeKey(value) || value?.trim() || '미배정'

export const studentAttendancePeople = groups => groups.flatMap(group => (group.records || []).map(row => ({
  ...row, id: row.studentId, name: row.studentName || '이름 없음', gradeGroup: groupGrade(row.grade), className: group.classGroupName || '미배정',
})))
export const teacherAttendancePeople = rows => rows.map(row => ({ ...row, id: row.teacherId, name: row.teacherName || '이름 없음', gradeGroup: groupGrade(row.grade) }))

export function groupEventAttendance(rows) {
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row.gradeGroup)) groups.set(row.gradeGroup, [])
    groups.get(row.gradeGroup).push(row)
  }
  const rank = grade => GRADES.includes(grade) ? GRADES.indexOf(grade) : grade === '미배정' ? 99 : 98
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'ko'))
    .map(([grade, people]) => ({ grade, people, counts: eventAttendanceCounts(people) }))
}

export function filterEventAttendance(rows, { grade = null, status = 'all', search = '' } = {}) {
  return rows.filter(row => (!grade || row.gradeGroup === grade)
    && (status === 'all' || attendanceStatusOf(row.status).value === status)
    && matchesAdminSearch(search, row.name, row.grade, row.gradeGroup, row.className))
    .sort((a, b) => (a.className || '').localeCompare(b.className || '', 'ko') || a.name.localeCompare(b.name, 'ko') || a.id - b.id)
}

// Preserve submitted history when an event's current attendance target changes.
export function eventAttendanceTabs(event, students, teachers) {
  const target = event.attendanceTarget || 'STUDENT_ONLY'
  const submitted = rows => rows.some(row => attendanceStatusOf(row.status).value !== 'UNSUBMITTED')
  return [
    ...(target !== 'TEACHER_ONLY' || submitted(students) ? [{ value: 'student', label: '학생 출석' }] : []),
    ...(target !== 'STUDENT_ONLY' || submitted(teachers) ? [{ value: 'teacher', label: '교사 출석' }] : []),
  ]
}
