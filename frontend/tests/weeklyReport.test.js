import test from 'node:test'
import assert from 'node:assert/strict'
import { supplementFromEditor, statusFromEditor, reportWeekLabel } from '../src/utils/weeklyReport.js'

test('report week labels match the supplied June report and the exported ISO week at year boundaries', () => {
  assert.equal(reportWeekLabel('2025-06-22'), '2025년 25주차')
  assert.equal(reportWeekLabel('2026-10-25'), '2026년 43주차')
  assert.equal(reportWeekLabel('2023-01-01'), '2022년 52주차')
})

test('report editing keeps categories, visitor details and unknown attendance without double-counting visitors', () => {
  const student = { id: 'student:1', studentId: 1, name: '가상학생', category: 'REGULAR', graduated: true, gender: '남', status: 'UNKNOWN', school: '가상학교', address: '', phone: '', introducer: '' }
  const visitor = { id: 'visitor-1', name: '가상방문', gender: '여', grade: '중1', school: '가상학교', address: '가상주소', phone: '010-0000-0000', introducer: '가상교사', status: 'PRESENT' }
  const editor = { students: [student, { ...visitor, studentId: null }], supplement: { visitors: [visitor], notes: '제출할 특이사항' } }
  const result = supplementFromEditor(editor)
  assert.equal(result.members.length, 1)
  assert.equal(result.members[0].graduated, true)
  assert.equal(result.visitors.length, 1)
  assert.equal(result.notes, '제출할 특이사항')
  assert.deepEqual(statusFromEditor(editor), { 'student:1': 'UNKNOWN' })
  result.visitors[0].name = '수정'
  assert.equal(visitor.name, '가상방문')
})
