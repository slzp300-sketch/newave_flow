import test from 'node:test'
import assert from 'node:assert/strict'
import { studentAttendancePeople, teacherAttendancePeople, groupEventAttendance, filterEventAttendance, eventAttendanceTabs } from '../src/utils/eventAttendanceAdmin.js'

const students = studentAttendancePeople([{ classGroupId: 1, classGroupName: '사랑반', records: [
  { studentId: 1, studentName: '가람', grade: '중1-1', status: 'PRESENT' },
  { studentId: 2, studentName: '나래', grade: '중등 1학년', status: 'PARTIAL', partialFromDate: '2026-11-01', partialNote: '오후 합류' },
  { studentId: 3, studentName: '다온', grade: '고2', status: 'ABSENT', absenceReason: '가족 일정' },
  { studentId: 4, studentName: '라온', grade: null, status: null },
] }])

test('학생마다 저장된 학년으로 묶고 부분참석·불참·미제출을 분리한다', () => {
  const groups = groupEventAttendance(students)
  assert.deepEqual(groups.map(g => g.grade), ['중1', '고2', '미배정'])
  assert.deepEqual(groups[0].counts, { total: 2, present: 1, partial: 1, absent: 0, unsubmitted: 0 })
  assert.equal(groups[1].counts.absent, 1)
  assert.equal(groups[2].counts.unsubmitted, 1)
  assert.equal(groups[0].people[1].partialNote, '오후 합류')
})

test('검색·학년·출석 상태를 함께 적용하고 원본 집계는 유지한다', () => {
  const before = structuredClone(students)
  assert.deepEqual(filterEventAttendance(students, { grade: '중1', status: 'PARTIAL', search: '사랑반 나래' }).map(p => p.id), [2])
  assert.deepEqual(filterEventAttendance(students, { status: 'UNSUBMITTED' }).map(p => p.id), [4])
  assert.deepEqual(filterEventAttendance(students, { search: '없는 이름' }), [])
  assert.deepEqual(students, before)
})

test('현재 대상에 포함되지 않아도 기존 제출 기록은 조회 탭으로 보존한다', () => {
  assert.deepEqual(eventAttendanceTabs({ attendanceTarget: 'TEACHER_ONLY' }, students, []).map(t => t.value), ['student', 'teacher'])
  assert.deepEqual(eventAttendanceTabs({ attendanceTarget: 'STUDENT_ONLY' }, [], [{ status: 'PARTIAL' }]).map(t => t.value), ['student', 'teacher'])
  assert.deepEqual(eventAttendanceTabs({ attendanceTarget: 'TEACHER_ONLY' }, [{ status: null }], []).map(t => t.value), ['teacher'])
  assert.deepEqual(eventAttendanceTabs({}, [], [{ status: undefined }]).map(t => t.value), ['student'])
})

test('교사 학년 표기를 정규화하고 학년 순서와 미배정을 유지한다', () => {
  const rows = teacherAttendancePeople([
    { teacherId: 1, teacherName: '다온', grade: '고등 3학년', status: 'ABSENT' },
    { teacherId: 2, teacherName: '가람', grade: '', status: null },
    { teacherId: 3, teacherName: '나래', grade: '중2-1', status: 'PARTIAL' },
  ])
  assert.deepEqual(groupEventAttendance(rows).map(g => g.grade), ['중2', '고3', '미배정'])
  assert.equal(filterEventAttendance(rows, { status: 'PARTIAL' })[0].id, 3)
  assert.deepEqual(groupEventAttendance([]), [])
})
