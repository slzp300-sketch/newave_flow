import test from 'node:test'
import assert from 'node:assert/strict'
import { ttsYear, ttsYears, weeksInYear, quartersForYear, defaultQuarter, quarterDateLabel, quarterPeople } from '../src/utils/ttsPeriod.js'
import { weekLabelsByNum } from '../src/utils/date.js'

test('management begins in 2026 Q4 and 2027 retains all four quarters', () => {
  assert.deepEqual(quartersForYear(2025), [])
  assert.deepEqual(quartersForYear(2026), [{ q: 4, from: 40, to: 52 }])
  assert.deepEqual(quartersForYear(2027).map(q => [q.from,q.to]), [[1,13],[14,26],[27,39],[40,52]])
  assert.equal(weeksInYear(2028), 53)
})
test('year changes on Sunday and old year remains selectable', () => {
  const lastSunday = new Date(2026,11,27)
  assert.equal(ttsYear(lastSunday), 2027)
  assert.equal(defaultQuarter(2027,lastSunday), 1)
  assert.equal(defaultQuarter(2026,lastSunday), 4)
  assert.deepEqual(ttsYears(lastSunday), [2028,2027,2026])
  assert.equal(quarterDateLabel(2026,4), '2026/9/27 ~ 2026/12/26 · 40~52주차')
  assert.equal(quarterDateLabel(2027,1), '2026/12/27 ~ 2027/3/27 · 1~13주차')
})
test('week boundaries, not calendar month alone, determine default quarter', () => {
  assert.equal(defaultQuarter(2027,new Date(2027,2,28)), 2)
  assert.equal(defaultQuarter(2027,new Date(2027,5,27)), 3)
  assert.equal(defaultQuarter(2027,new Date(2027,8,26)), 4)
})
test('quarter totals cannot include older quarters or absent cells as participation', () => {
  const people = [{ key:'u1', weekly: { 1:999, 39:200, 40:70, 41:100, 42:0, 53:500 } }]
  const [q4] = quarterPeople(people,2026,4)
  assert.deepEqual(q4.weekly,{ 40:70,41:100,42:0 })
  assert.equal(q4.total,170)
  assert.equal(q4.weeks,2)
  assert.equal(people[0].weekly[1],999)
  assert.deepEqual(quarterPeople(people,2026,3),[])
})
test('invalid week 53 does not display as duplicate week 52', () => {
  assert.equal(weekLabelsByNum(2026,53).yearWeek,'유효하지 않은 주차')
  assert.equal(weekLabelsByNum(2028,53).yearWeek,'28년 53주차')
  assert.equal(weekLabelsByNum(2027,1).yearWeek,'27년 1주차')
})
