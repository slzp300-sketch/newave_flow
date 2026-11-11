import test from 'node:test'
import assert from 'node:assert/strict'
import { reportIssueTarget, reportWeekOffset } from '../src/utils/reportIssues.js'

test('report corrections preserve exact student field and report week', () => {
  assert.deepEqual(reportIssueTarget({area:'class',targetId:12,action:'class',field:'gender',subjectId:'student:4'},'2026-11-01'), {kind:'class',id:12,field:'gender',subjectId:'student:4'})
  assert.deepEqual(reportIssueTarget({area:'class',targetId:-1},'2026-11-01'), {kind:'new-family',path:'/new-family?date=2026-11-01'})
  assert.deepEqual(reportIssueTarget({area:'teacher',targetId:3,field:'status'},'2026-11-01'), {kind:'teacher',id:3,field:'status',subjectId:undefined})
})
test('correction links only allow known destinations and support older report data', () => {
  assert.equal(reportIssueTarget({action:'https://example.com',area:'roster'}),null)
  assert.deepEqual(reportIssueTarget({area:'common',message:'설교 제목을 입력해주세요.'}),{kind:'common',field:'sermon'})
  assert.deepEqual(reportIssueTarget({area:'class',action:'assignment',targetId:2}),{kind:'external',path:'/admin/class-assignment'})
})
test('new-family report link keeps historical Sunday across year boundary', () => {
  assert.equal(reportWeekOffset('2025-12-28','2026-01-11'),-2)
  for(const date of ['2026-01-18','2026-01-10','2026-02-30','bad',null]) assert.equal(reportWeekOffset(date,'2026-01-11'),0)
})
