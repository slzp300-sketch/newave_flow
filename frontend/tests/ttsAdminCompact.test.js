import test from 'node:test'
import assert from 'node:assert/strict'
import { weeklyTtsPeople, weeklyTtsCounts, weeklyTtsGroups, filterWeeklyTts, ttsQuestionError, ttsQuestionPayload } from '../src/utils/ttsAdminCompact.js'
const people = weeklyTtsPeople([
  { teacherId: 1, teacherName: '가람', grade: '중등1학년', score: 5, isSubmitted: true },
  { teacherId: 2, teacherName: '나래', grade: '중1-1', score: 0, isSubmitted: false },
  { key: 'legacy:3', teacherName: '가람', grade: '', score: 0, isSubmitted: false, scoreSource: 'SHEET' },
])
test('주간 참여는 서버 판정을 사용하고 0점·시트 기록의 미참여와 학년을 보존한다', () => {
  assert.deepEqual(weeklyTtsCounts(people), { total: 3, participating: 1, missing: 2, rate: 33.3 })
  assert.deepEqual(weeklyTtsGroups(people).map(g => [g.grade, g.total]), [['중1', 2], ['미분류', 1]])
  assert.equal(weeklyTtsCounts([]).rate, null)
})
test('동명이인도 안정된 키로 구분하며 주간 검색과 필터는 원본 통계에 영향이 없다', () => {
  const before = structuredClone(people)
  assert.deepEqual(filterWeeklyTts(people, { status: 'missing', search: '가람' }).map(p => p.key), ['legacy:3'])
  assert.deepEqual(filterWeeklyTts(people, { grade: '중1', status: 'missing' }).map(p => p.key), ['u2'])
  assert.deepEqual(people, before)
})
test('배점의 빈칸·음수·소수·상한 초과를 저장 전에 막고 0점은 허용한다', () => {
  for (const points of ['', null, -1, 0.5, 10001]) assert.ok(ttsQuestionError({ title: '기도', points }))
  assert.ok(ttsQuestionError({ title: '  ', points: 5 }))
  assert.equal(ttsQuestionError({ title: '기도', points: 0 }), null)
})
test('항목 저장은 편집용 키를 제외하며 요일별 항목의 자동 연결을 해제한다', () => {
  const result = ttsQuestionPayload([{ id: 4, _key: 'local', title: ' 기도 ', points: '5', type: 'DAYS', linkType: 'PRAYER_MEETING', active: true, displayOrder: 2 }])
  assert.deepEqual(result, [{ id: 4, title: '기도', points: 5, emoji: '', type: 'DAYS', linkType: 'NONE', active: true, displayOrder: 2 }])
})
