import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesRosterName, familyRosterStage, filterFamilyRoster } from '../src/utils/rosterSearch.js'

const sunday='2026-11-08'
const people=[
  {id:1,profile:{name:'가상 새봄'},firstVisit:sunday,decision:'PENDING'},
  {id:2,profile:{name:'가상다시'},firstVisit:'2026-11-01',decision:'PENDING'},
  {id:3,profile:{name:'가상과정'},enrolledOn:'2026-10-01',firstVisit:'2026-10-01',course:[1,2,3,4],decision:'HOLD'},
  {id:4,profile:{name:'가상등반'},enrolledOn:'2026-10-01',decision:'READY',assignmentRequested:true},
]
test('names match independent of spacing, unicode form and case',()=>{
 assert.ok(matchesRosterName('가상 새봄','가상새 봄'))
 assert.ok(matchesRosterName('Ａmy','amy'))
 assert.ok(matchesRosterName('가람','가람'))
 assert.equal(matchesRosterName('가람','다른'),false)
})
test('family stages depend on team decision, never four attendance dates alone',()=>{
 assert.deepEqual(people.map(p=>familyRosterStage(p,sunday)),['first','undecided','course','handoff'])
 assert.equal(familyRosterStage({...people[2],classId:12},sunday),'handoff')
})
test('search and stage filters preserve handoff tab scope',()=>{
 const filter=opts=>filterFamilyRoster(people,{tab:'people',search:'',stage:'all',sunday,...opts}).map(p=>p.id)
 assert.deepEqual(filter({search:'새 봄'}),[1])
 assert.deepEqual(filter({stage:'undecided'}),[2])
 assert.deepEqual(filter({tab:'handoff'}),[4])
 assert.deepEqual(filter({tab:'handoff',search:'과정'}),[])
 assert.deepEqual(filter({stage:'course',search:'과정'}),[3])
})
