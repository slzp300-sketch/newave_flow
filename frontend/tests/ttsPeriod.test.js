import test from 'node:test'
import assert from 'node:assert/strict'
import { ttsYear, ttsYears, ttsToday, weeksInYear, quartersForYear, defaultQuarter, quarterDateLabel, quarterPeople, weekReference } from '../src/utils/ttsPeriod.js'
import { weekLabelsByNum } from '../src/utils/date.js'

test('management begins in 2026 Q4 and 2027 retains all four quarters', () => {
  assert.deepEqual(quartersForYear(2025), [])
  assert.deepEqual(quartersForYear(2026), [{ q: 4, start: '2026-10-01', end: '2026-12-31', from: 40, to: 53 }])
  assert.deepEqual(quartersForYear(2027).map(q => [q.from,q.to]), [[1,14],[14,27],[27,40],[40,53]])
  assert.equal(weeksInYear(2028), 53)
})
test('calendar year changes at New Year, while stored week keys stay compatible', () => {
  const lastSunday = new Date(2026,11,27)
  assert.equal(ttsYear(lastSunday), 2026)
  assert.equal(defaultQuarter(2027,lastSunday), 1)
  assert.equal(defaultQuarter(2026,lastSunday), 4)
  assert.deepEqual(ttsYears(lastSunday), [2027,2026])
  assert.equal(quarterDateLabel(2026,4), '2026/10/1 ~ 2026/12/31')
  assert.equal(quarterDateLabel(2027,1), '2027/1/1 ~ 2027/3/31')
  assert.deepEqual(weekReference(2026,53), { year: 2027, weekNum: 1 })
  assert.deepEqual(weekReference(2028,54), { year: 2029, weekNum: 1 })
})
test('Korean calendar boundaries determine the quarter even on overseas devices', () => {
  assert.equal(defaultQuarter(2027,new Date('2027-03-31T14:59:59Z')), 1)
  assert.equal(defaultQuarter(2027,new Date('2027-03-31T15:00:00Z')), 2)
  assert.equal(defaultQuarter(2027,new Date('2027-06-30T15:00:00Z')), 3)
  assert.equal(defaultQuarter(2027,new Date('2027-09-30T15:00:00Z')), 4)
  assert.equal(ttsYear(new Date('2026-12-31T15:00:00Z')),2027)
  assert.equal(ttsToday(new Date('2027-03-31T15:00:00Z')),'2027-04-01')
})
test('server-split calendar totals preserve zero, imported scores and year-end partial weeks', () => {
  const people = [{ key:'u1', weekly: { 1:999, 39:200, 40:70, 41:100, 42:0 }, calendarQuarters: {
    4: { weekly: { '2026-09-27':70, '2026-10-04':100, '2026-10-11':0, '2026-12-27':20 } },
  } }]
  const [q4] = quarterPeople(people,2026,4)
  assert.deepEqual(q4.weekly,{ 40:70,41:100,42:0,53:20 })
  assert.equal(q4.total,190)
  assert.equal(q4.weeks,3)
  assert.equal(people[0].weekly[1],999)
  assert.deepEqual(quarterPeople(people,2026,3),[])
  assert.equal(q4.calendarDataReady,true)
})
test('an old server response never guesses how to split a boundary week', () => {
  const [person] = quarterPeople([{ weekly: {14:100} }],2027,1)
  assert.deepEqual(person.weekly,{})
  assert.equal(person.calendarDataReady,false)
})
test('invalid week 53 does not display as duplicate week 52', () => {
  assert.equal(weekLabelsByNum(2026,53).yearWeek,'유효하지 않은 주차')
  assert.equal(weekLabelsByNum(2028,53).yearWeek,'28년 53주차')
  assert.equal(weekLabelsByNum(2027,1).yearWeek,'27년 1주차')
})
