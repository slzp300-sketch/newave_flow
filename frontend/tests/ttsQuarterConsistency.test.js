import { matchesTtsName } from '../src/utils/ttsStats.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {consistencyStats,consistencyAdmin} from './fixtures/ttsQuarterConsistency.js'
import {quarterPeople} from '../src/utils/ttsPeriod.js'
import {rankedPeople,filterPeople} from '../src/utils/ttsStats.js'
import {assessQuarter,filterQuarterStatus,quarterScore,adminQuarterScore} from '../src/utils/ttsQuarterAssessment.js'
import {paginateAdminRows} from '../src/utils/adminSearch.js'

test('both screens retain the same whole-quarter assessment across every status/name/page combination',()=>{
  const people=quarterPeople(consistencyStats.people,2026,4)
  const teacherAssessment=assessQuarter(people)
  const adminAssessment=assessQuarter(consistencyAdmin,adminQuarterScore)
  const totals=a=>[a.average,a.count,a.passed,a.below,a.unrecorded]
  const teacherRows=rankedPeople(people,quarterScore)
  const adminRows=rankedPeople(consistencyAdmin.map(p=>({...p,name:p.teacherName})),adminQuarterScore)
  const before=JSON.stringify([consistencyStats,consistencyAdmin])
  assert.deepEqual(totals(teacherAssessment),[60,13,7,6,1])
  assert.deepEqual(totals(adminAssessment),totals(teacherAssessment))
  for(const status of ['all','passed','below','unrecorded']) for(const search of ['', '검수교사 01','검수교사 07','검수교사 13','검수교사 14','없는 이름']) {
    const teacher=filterQuarterStatus(filterPeople(teacherRows,{search}),teacherAssessment,status)
    const admin=filterQuarterStatus(adminRows.filter(p=>matchesTtsName(search,p.teacherName)),adminAssessment,status,adminQuarterScore)
    const identity=p=>[p.teacherId,p.rank]
    assert.deepEqual(admin.map(identity),teacher.map(identity),`${status}/${search}`)
    const paged=[]
    for(let i=0;i<Math.ceil(admin.length/10);i++) paged.push(...paginateAdminRows(admin,i,10).items)
    assert.deepEqual(paged.map(identity),teacher.map(identity))
    assert.deepEqual(totals(teacherAssessment),[60,13,7,6,1])
    assert.deepEqual(totals(adminAssessment),[60,13,7,6,1])
  }
  assert.equal(teacherAssessment.status(0),'below')
  assert.equal(teacherAssessment.status(60),'passed')
  assert.equal(adminAssessment.status(adminQuarterScore(adminRows.at(-1))),'unrecorded')
  assert.equal(JSON.stringify([consistencyStats,consistencyAdmin]),before)
})
