import test from 'node:test'
import assert from 'node:assert/strict'
import { navigationSection, parentPath, filterMenuGroups } from '../src/utils/navigation.js'

test('nested pages and aliases highlight exactly the corresponding navigation section', () => {
  for (const path of ['/attendance', '/tts', '/meeting/sat', '/event-attendance/12', '/minutes']) assert.equal(navigationSection(path), '/checklist')
  assert.equal(navigationSection('/events'), '/calendar')
  assert.equal(navigationSection('/admin/tts'), '/menu')
  assert.equal(navigationSection('/students/12'), '/menu')
  assert.equal(navigationSection('/profile'), '/profile')
  assert.equal(navigationSection('/'), '/')
  assert.equal(navigationSection('/tts-other'), '/menu')
})

test('direct detail entry has a useful parent fallback', () => {
  assert.equal(parentPath('/students/12'), '/roster')
  assert.equal(parentPath('/event-attendance/12'), '/event-attendance')
  assert.equal(parentPath('/admin/tts'), '/admin')
  assert.equal(parentPath('/tts'), '/checklist')
  assert.equal(parentPath('/profile'), '/')
  assert.equal(parentPath('/privacy'), '/login')
})

test('menu search matches descriptions, multiple terms and only supplied authorized groups', () => {
  const common = { title: '주간 체크', items: [{ title: 'TTS', desc: '분기 통계' }, { title: '출석', desc: '우리 반' }] }
  const admin = { title: '관리', admin: true, items: [{ title: '교사 관리', desc: '권한' }] }
  assert.equal(filterMenuGroups([common, admin], ' tts  통계 ')[0].items[0].title, 'TTS')
  assert.equal(filterMenuGroups([common, admin], '', 'personal').length, 1)
  assert.equal(filterMenuGroups([common, admin], '', 'admin')[0].title, '관리')
  assert.deepEqual(filterMenuGroups([common], '권한'), [])
  assert.deepEqual(filterMenuGroups([common], '', 'admin'), [])
})
