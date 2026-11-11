import test from 'node:test'
import assert from 'node:assert/strict'
import { reportSubmissionStatus, reportSubmissionLabel, isReportSubmitted } from '../src/utils/reportSubmission.js'
import { getMostRecentSunday, toApiDate } from '../src/utils/date.js'

test('draft changes require resubmission only after a first submission', () => {
  assert.equal(reportSubmissionLabel({submitted:false,changed:true}), '미제출')
  assert.equal(reportSubmissionLabel({submitted:true,changed:true}), '재제출 필요')
  assert.equal(isReportSubmitted({submitted:true,changed:true}), false)
  assert.equal(reportSubmissionLabel({submitted:true,changed:false}), '제출 완료')
  assert.equal(isReportSubmitted({submitted:true,changed:false}), true)
})

test('old attendance summary and report sources resolve to the same states', () => {
  for (const state of ['MISSING','CHANGED','SUBMITTED']) {
    const summary={submitted:state==='SUBMITTED',submissionStatus:state}
    const source={submitted:state!=='MISSING',changed:state==='CHANGED'}
    assert.equal(reportSubmissionStatus(summary),reportSubmissionStatus(source))
  }
})

test('dashboard keeps the same reporting Sunday throughout the week and across a year boundary', () => {
  for (let day=8;day<=14;day++) assert.equal(toApiDate(getMostRecentSunday(new Date(`2026-11-${String(day).padStart(2,'0')}T12:00:00`))), '2026-11-08')
  assert.equal(toApiDate(getMostRecentSunday(new Date('2027-01-01T12:00:00'))), '2026-12-27')
})
