import test from 'node:test'
import assert from 'node:assert/strict'
import { elapsedWeeks, scoreSummary, rankedPeople, filterPeople } from '../src/utils/ttsStats.js'

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
