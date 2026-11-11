import test from 'node:test'
import assert from 'node:assert/strict'
import { familyCategory, familyCounts, familyStage } from '../src/utils/newFamily.js'
test('first week is first visit even after enrollment; later undecided visits remain separate',()=>{
  const p={id:1,firstVisit:'2026-10-25',enrolledOn:'2026-10-25'}
  assert.equal(familyCategory(p,'2026-10-25'),'FIRST')
  assert.equal(familyCategory(p,'2026-11-01'),'FAMILY')
  assert.equal(familyCategory({...p,enrolledOn:null},'2026-11-01'),'FOLLOWUP')
})
test('returning undecided visitor contributes once to total with late included',()=>{
  const rows=[{id:1,firstVisit:'2026-10-25'},{id:2,firstVisit:'2026-11-01'},{id:3,firstVisit:'2026-10-25',enrolledOn:'2026-10-25'}]
  assert.deepEqual(familyCounts(rows,{1:'PRESENT',2:'LATE'},'2026-11-01'),{FIRST:1,FAMILY:0,FOLLOWUP:1,total:2,unknown:1})
})
test('four sessions do not imply graduation; assignment waits for effective date',()=>{
  const p={enrolledOn:'2026-10-01',course:['a','b','c','d'],decision:'HOLD'}
  assert.equal(familyStage(p,'2026-10-30'),'계속 참여')
  assert.equal(familyStage({...p,course:[],decision:'READY'},'2026-10-30'),'등반 가능')
  assert.equal(familyStage({...p,classId:1,effectiveDate:'2026-11-01'},'2026-10-30'),'반 배정 예정')
  assert.equal(familyStage({...p,classId:1,effectiveDate:'2026-11-01'},'2026-11-01'),'반 배정 완료')
})
