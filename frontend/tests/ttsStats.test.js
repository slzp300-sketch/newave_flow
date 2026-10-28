import test from 'node:test'
import assert from 'node:assert/strict'
import { elapsedWeeks, scoreSummary, rankedPeople, filterPeople } from '../src/utils/ttsStats.js'
import { quartersForYear } from '../src/utils/ttsPeriod.js'

test('statistics distinguish zero from missing and give ties the same rank', () => {
  const people = [{ name: '가상 A', score: 10 }, { name: '가상 B', score: 10 }, { name: '가상 C', score: 0 }, { name: '가상 D', score: null }]
  assert.deepEqual(scoreSummary(people), { recorded: 3, participating: 2, average: 7, highest: 10 })
  assert.deepEqual(rankedPeople(people).map(p => p.rank), [1, 1, 3, null])
  assert.deepEqual(scoreSummary([]), { recorded: 0, participating: 0, average: null, highest: null })
})

test('weekly selectors exclude future weeks, respect Q4 start and include 53rd weeks', () => {
  const today = new Date(2026, 9, 12)
  assert.deepEqual(elapsedWeeks(2026, { from: 40, to: 52 }, 42, today), [42, 41, 40])
  assert.deepEqual(elapsedWeeks(2027, { from: 1, to: 13 }, null, today), [])
  assert.equal(elapsedWeeks(2028, { from: 40, to: 53 }, null, new Date(2029, 1, 1))[0], 53)
})

test('name and grade filters retain the full-list ranking without mutating records', () => {
  const people = rankedPeople([{ name: '가상 다', grade: '중1', score: 20 }, { name: '가상 가', grade: '중2', score: 10 }, { name: '가상 나', grade: '중1', score: 5 }])
  assert.deepEqual(filterPeople(people, { grade: '중1', search: '가상', sort: 'name' }).map(p => p.rank), [3, 1])
  assert.equal(people[0].name, '가상 다')
})

test('calendar week selectors include partial weeks only after the quarter starts in Korea', () => {
  const [q1,q2] = quartersForYear(2027)
  assert.equal(elapsedWeeks(2027,q1,14,new Date('2027-03-31T14:59:59Z'))[0],14)
  assert.deepEqual(elapsedWeeks(2027,q2,14,new Date('2027-03-31T14:59:59Z')),[])
  assert.deepEqual(elapsedWeeks(2027,q2,14,new Date('2027-03-31T15:00:00Z')),[14])
  assert.equal(elapsedWeeks(2026,quartersForYear(2026)[0],null,new Date('2026-12-31T03:00:00Z'))[0],53)
  assert.equal(elapsedWeeks(2028,quartersForYear(2028)[3],null,new Date('2029-01-01T03:00:00Z'))[0],54)
})
