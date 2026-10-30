import test from 'node:test'
import assert from 'node:assert/strict'
import { prayerTotals, prayerTrendTotals, matchesPrayerStatus, prayerWeekOffset } from '../src/utils/prayerParticipation.js'

test('prayer attendance uses responses only and separates unanswered from absent', () => {
  const totals = prayerTotals({ tuesday: 2, thursday: 3, absent: 2, unanswered: 9 })
  assert.equal(totals.attending, 5)
  assert.equal(totals.responded, 7)
  assert.equal(totals.rate, 71.4)
  assert.equal(totals.absent, 2)
  assert.equal(totals.unanswered, 9)
  assert.equal(prayerTotals({ absent: 3 }).rate, 0)
  assert.equal(prayerTotals({ unanswered: 4 }).rate, null)
})

test('eight-week total is weighted by response counts, not mean weekly percentages', () => {
  const weeks = [
    { tuesday: 1, thursday: 0, absent: 0, unanswered: 9 },
    { tuesday: 0, thursday: 0, absent: 9, unanswered: 1 },
    { tuesday: 0, thursday: 0, absent: 0, unanswered: 10 },
  ]
  assert.equal(prayerTrendTotals(weeks).rate, 10)
  assert.equal(prayerTrendTotals([]).rate, null)
})

test('prayer list filters keep unanswered distinct and both attendance days selectable', () => {
  const statuses = ['TUE', 'THU', 'ABSENT', 'UNKNOWN']
  assert.deepEqual(statuses.filter(s => matchesPrayerStatus(s, 'ATTEND')), ['TUE', 'THU'])
  assert.deepEqual(statuses.filter(s => matchesPrayerStatus(s, 'ABSENT')), ['ABSENT'])
  assert.deepEqual(statuses.filter(s => matchesPrayerStatus(s, 'UNKNOWN')), ['UNKNOWN'])
  assert.equal(statuses.filter(s => matchesPrayerStatus(s, 'ALL')).length, 4)
})

test('trend navigation crosses year and daylight saving boundaries by whole weeks', () => {
  assert.equal(prayerWeekOffset('2026-12-28', '2027-01-04'), -1)
  assert.equal(prayerWeekOffset('2026-03-02', '2026-03-09'), -1)
  assert.equal(prayerWeekOffset('2026-10-26', '2026-10-26'), 0)
})
