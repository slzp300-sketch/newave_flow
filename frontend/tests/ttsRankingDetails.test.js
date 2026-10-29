import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingRecordWeeks, rankingWeekDetail, rankingDateLabel, rankingSavedLabel } from '../src/utils/ttsRankingDetails.js'

const range = { start: '2027-04-01', end: '2027-06-30' }
const response = { weekStart: '2027-03-28', people: [
  { key: 'u1', name: '동명이인', source: 'APP', updatedAt: '2027-04-01T21:14:00', items: [
    { title: '말씀', type: 'DAYS', days: ['일', '월', '수', '목', '토', '토', '잘못된 요일'] },
    { title: '기도', type: 'DAYS', days: ['목'] },
    { title: '예배', type: 'ATTEND', checked: true },
  ] },
  { key: 'u2', name: '동명이인', source: 'APP', items: [{ title: '기도', type: 'DAYS', days: ['금'] }] },
] }

test('date details use stable identity, clip boundary weeks and never invent attendance dates', () => {
  const detail = rankingWeekDetail(response, 'u1', '2027-03-28', range)
  assert.deepEqual(detail.dates, [
    { date: '2027-04-03', titles: ['말씀'] },
    { date: '2027-04-01', titles: ['말씀', '기도'] },
  ])
  assert.deepEqual(detail.weeklyItems, ['예배'])
  assert.equal(detail.saved, '4/1 21:14')
  assert.deepEqual(rankingWeekDetail(response, 'u2', '2027-03-28', range).dates, [{ date: '2027-04-02', titles: ['기도'] }])
  assert.equal(rankingWeekDetail(response, 'missing', '2027-03-28', range), null)
})
test('Sunday checks stay visible when their date belongs to the selected quarter', () => {
  const detail = rankingWeekDetail(response, 'u1', '2027-03-28', { start: '2027-01-01', end: '2027-03-31' })
  assert.deepEqual(detail.dates.map(row => row.date), ['2027-03-31', '2027-03-29', '2027-03-28'])
})
test('mismatched/late week responses are rejected; sheet totals have no fabricated checkbox history', () => {
  assert.throws(() => rankingWeekDetail(response, 'u1', '2027-04-04', range))
  const imported = { ...response, importedPeriod: true }
  assert.deepEqual(rankingWeekDetail(imported, 'u1', '2027-03-28', range), { imported: true, dates: [], weeklyItems: [], saved: '' })
  const sheet = { ...response, people: [{ ...response.people[0], source: 'SHEET' }] }
  assert.deepEqual(rankingWeekDetail(sheet, 'u1', '2027-03-28', range).dates, [])
})
test('recorded zero-score weeks, partial quarter weeks and year-end storage keys are preserved', () => {
  const weeks = rankingRecordWeeks({ weekly: { 53: 0, 52: 20, 1: 999, invalid: 2 } }, 2026, 4, '2026-12-31')
  assert.deepEqual(weeks, [
    { start: '2026-12-27', end: '2027-01-02', year: 2027, weekNum: 1 },
    { start: '2026-12-20', end: '2026-12-26', year: 2026, weekNum: 52 },
  ])
  assert.equal(rankingRecordWeeks({ weekly: { 53: 2 } }, 2026, 4, '2026-10-29').length, 0)
  assert.deepEqual(rankingRecordWeeks({ weekly: {} }, 2026, 4), [])
  assert.deepEqual(rankingRecordWeeks({ weekly: { 1: 4 } }, 2025, 4), [])
})
test('Korean last-saved labels are independent of device timezone and do not guess missing timestamps', () => {
  assert.equal(rankingSavedLabel('2026-10-28T12:14:00Z'), '10/28 21:14')
  assert.equal(rankingSavedLabel('2026-10-28T21:14:00'), '10/28 21:14')
  assert.equal(rankingSavedLabel(null), '')
  assert.equal(rankingSavedLabel('unavailable'), '')
  assert.equal(rankingSavedLabel('2026-10-28Tinvalid'), '')
  assert.equal(rankingDateLabel('2026-10-25'), '10/25 (일)')
})
