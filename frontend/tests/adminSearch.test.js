import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesAdminSearch, paginateAdminRows } from '../src/utils/adminSearch.js'

test('admin search matches multiple terms across names and grades, including null and nested fields', () => {
  assert.equal(matchesAdminSearch('  중1  하늘 ', '가상 하늘', '중1', null), true)
  assert.equal(matchesAdminSearch('TTS', 'ｔｔｓ 점검'), true)
  assert.equal(matchesAdminSearch('동료', '1반', ['가상 동료', null]), true)
  assert.equal(matchesAdminSearch('중2 하늘', '가상 하늘', '중1'), false)
  assert.equal(matchesAdminSearch('   ', undefined), true)
})

test('filtered pagination clamps a page after a data refresh removes rows', () => {
  const rows = Array.from({ length: 12 }, (_, id) => ({ id }))
  assert.deepEqual(paginateAdminRows(rows, 1).items, rows.slice(10))
  assert.equal(paginateAdminRows(rows.slice(0, 3), 1).currentPage, 0)
  assert.deepEqual(paginateAdminRows([], 4), { currentPage: 0, totalPages: 0, items: [] })
})

test('search and pagination preserve full data, score totals and existing sort order', () => {
  const rows = [{ name: '하늘', grade: '중1', score: 120 }, { name: '바다', grade: '중2', score: 100 }, { name: '소망', grade: '중1', score: 0 }]
  const original = structuredClone(rows)
  const filtered = rows.filter(row => matchesAdminSearch('중1', row.name, row.grade))
  assert.deepEqual(paginateAdminRows(filtered, 0, 1).items, [rows[0]])
  assert.deepEqual(paginateAdminRows(filtered, 1, 1).items, [rows[2]])
  assert.deepEqual(rows, original)
  assert.equal(rows.reduce((sum, row) => sum + row.score, 0), 220)
})
