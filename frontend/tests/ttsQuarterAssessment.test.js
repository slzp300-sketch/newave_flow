import test from 'node:test'
import assert from 'node:assert/strict'
import { assessQuarter, filterQuarterStatus, quarterScore, adminQuarterScore } from '../src/utils/ttsQuarterAssessment.js'
import { quarterPeople } from '../src/utils/ttsPeriod.js'
import { filterPeople, rankedPeople, matchesTtsName } from '../src/utils/ttsStats.js'

test('quarter totals use full-population mean; equality passes, missing remains missing', () => {
  const people = [120, 60, 0, null].map((score, i) => ({ name: `가상 ${i}`, total: score ?? 0, weekly: score == null ? {} : {1: score} }))
  const a = assessQuarter(people)
  assert.equal(a.average, 60)
  assert.deepEqual([a.count, a.passed, a.below, a.unrecorded], [3,2,1,1])
  assert.deepEqual(people.map(p => a.status(quarterScore(p))), ['passed','passed','below','unrecorded'])
  const filtered = filterPeople(rankedPeople(people, quarterScore), { search:'가상 2' })
  assert.equal(filtered[0].rank, 3)
  assert.equal(a.status(quarterScore(filtered[0])), 'below')
})

test('unrounded mean controls boundary; empty and invalid data never become passed', () => {
  const a = assessQuarter([100,100,101], x=>x)
  assert.equal(a.status(100),'below')
  assert.equal(a.status(101),'passed')
  assert.equal(assessQuarter([]).average,null)
  assert.equal(assessQuarter([]).status(0),'unrecorded')
  assert.equal(assessQuarter([0],x=>x).status(0),'passed')
  assert.equal(assessQuarter([null,NaN,-1,Infinity],x=>x).count,0)
})

test('teacher and administrator use the same date-split Sunday scores across quarters', () => {
  const people = [
    { name:'가상 A', calendarQuarters:{1:{weekly:{'2027-03-28':70}},2:{weekly:{'2027-03-28':30}}}},
    { name:'가상 B', calendarQuarters:{1:{weekly:{'2027-03-28':30}},2:{weekly:{'2027-03-28':70}}}},
    { name:'가상 C', calendarQuarters:{1:{weekly:{}},2:{weekly:{}}}},
  ]
  const before = JSON.stringify(people)
  for(const q of [1,2]) {
    const ranked = quarterPeople(people,2027,q)
    const admin = ranked.map(p=>({ totalScore:p.total,weeklyScores:Object.values(p.weekly).map(score=>({score})) }))
    const a = assessQuarter(ranked), b = assessQuarter(admin,adminQuarterScore)
    assert.equal(a.average,50)
    assert.equal(a.average,b.average)
    assert.deepEqual(ranked.map(p=>a.status(quarterScore(p))), admin.map(p=>b.status(adminQuarterScore(p))))
    assert.deepEqual(ranked.map(p=>a.status(quarterScore(p))),q===1?['passed','below','unrecorded']:['below','passed','unrecorded'])
  }
  assert.equal(JSON.stringify(people),before)
})

test('status filters preserve full-quarter average and tied ranks, and combine with search', () => {
  const people = [120,60,60,0,null].map((score,i)=>({name:`가상 ${i}`,total:score??0,weekly:score==null?{}:{1:score}}))
  const assessment=assessQuarter(people)
  const ranked=rankedPeople(people,quarterScore)
  assert.equal(assessment.average,60)
  assert.deepEqual(filterQuarterStatus(ranked,assessment,'passed').map(p=>p.rank),[1,2,2])
  assert.deepEqual(filterQuarterStatus(ranked,assessment,'below').map(p=>p.rank),[4])
  assert.deepEqual(filterQuarterStatus(ranked,assessment,'unrecorded').map(p=>p.rank),[null])
  assert.equal(filterQuarterStatus(ranked,assessment,'all').length,5)
  assert.equal(filterQuarterStatus(filterPeople(ranked,{search:'가상 3'}),assessment,'passed').length,0)
  assert.equal(filterQuarterStatus(filterPeople(ranked,{search:'가상 3'}),assessment,'below')[0].rank,4)
  assert.equal(assessment.average,60)
  assert.equal(filterQuarterStatus([],assessQuarter([]),'unrecorded').length,0)
})

test('administrator filters keep full mean/ranks across pages, ordering and name-only searches', async () => {
  const {paginateAdminRows}=await import('../src/utils/adminSearch.js')
  const scores=Array.from({length:13},(_,i)=>({teacherName:`가상 ${i}`,grade:i%2?'중1':'고1',totalScore:120-i*10,weeklyScores:[{score:120-i*10}]}))
  scores.push({teacherName:'미기록',grade:'고1',totalScore:0,weeklyScores:[]})
  const before=JSON.stringify(scores)
  const assessment=assessQuarter(scores,adminQuarterScore)
  const ranked=rankedPeople(scores.map(t=>({...t,name:t.teacherName})),adminQuarterScore)
  assert.equal(assessment.average,60)
  assert.equal(paginateAdminRows(ranked,1,10).items.length,4)
  const below=filterQuarterStatus(ranked,assessment,'below',adminQuarterScore)
  assert.deepEqual(below.map(t=>t.rank),[8,9,10,11,12,13])
  const page=paginateAdminRows(below,1,10)
  assert.equal(page.currentPage,0)
  assert.equal(page.items[0].rank,8)
  const searched=filterQuarterStatus(ranked.filter(t=>matchesTtsName('가상 12',t.teacherName)),assessment,'below',adminQuarterScore)
  assert.equal(ranked.filter(t=>matchesTtsName('고1',t.teacherName)).length,0)
  assert.equal(searched[0].rank,13)
  assert.equal(searched[0].totalScore,0)
  assert.equal(filterQuarterStatus(ranked,assessment,'unrecorded',adminQuarterScore)[0].rank,null)
  assert.equal(filterQuarterStatus(ranked,assessment,'passed',adminQuarterScore).at(-1).totalScore,60)
  const ascending=[...below].reverse()
  assert.equal(ascending[0].rank,13)
  assert.equal(assessment.average,60)
  assert.equal(JSON.stringify(scores),before)
})
