import test from 'node:test'
import assert from 'node:assert/strict'
import { organizationCounts, officerDuties } from '../src/utils/officers.js'
import { managementMenuGroups } from '../src/utils/menuGroups.js'
import { invalidateAfterWrite } from '../src/api/queryPolicy.js'
test('vacancies and concurrent offices count people separately', () => {
  assert.deepEqual(organizationCounts([{ userId: 4 }, { userId: 4 }, { userId: null }, { userId: 9 }]), { assigned: 3, vacant: 1, people: 2 })
})
test('common menus stay equal while specialist menus require granted capabilities', () => {
  const paths = (role, family, report) => managementMenuGroups(role, family, report).flatMap(g => g.items.map(i => i.to))
  assert.deepEqual(paths('ADMIN', false, false), paths('EXECUTIVE', false, false))
  assert(!paths('EXECUTIVE', false, false).includes('/admin/weekly-report'))
  assert(paths('EXECUTIVE', false, true).includes('/admin/weekly-report'))
  assert.deepEqual(paths('TEACHER', true, false), ['/new-family'])
  assert.deepEqual(paths('TEACHER', false, false), [])
  assert(paths('EXECUTIVE', false, false).includes('/admin/attendance'))
})
test('multi-office work links retain each grade and unimplemented team tools are absent', () => {
  const duties = officerDuties({ canReport: true, canNewFamily: true, grades: ['중1', '고3'], offices: [{ code: 'GENERAL' }] })
  assert.equal(duties.length, 5)
  assert(duties.some(d => d.to.endsWith(encodeURIComponent('중1'))))
  assert.deepEqual(officerDuties({ offices: [{ code: 'PRAISE' }], grades: [] }), [])
})
test('assignment and source writes refresh office capabilities and attendance summaries', async () => {
  let predicate
  const client = { invalidateQueries: async options => { predicate = options.predicate } }
  await invalidateAfterWrite(client, '/officers/organization/2026/SECRETARY')
  assert(predicate({ queryKey: ['officer-access', 1] }))
  assert(predicate({ queryKey: ['new-family-capability', 1] }))
  await invalidateAfterWrite(client, '/weekly-reports/2026-11-01/teachers/4')
  assert(predicate({ queryKey: ['officer-attendance', '2026-11-01'] }))
})
