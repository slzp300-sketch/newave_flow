import test from 'node:test'
import assert from 'node:assert/strict'
import {evangelismPeople,balancedMoves,rotationRows,scheduleRowsError,scheduleGroupId} from '../src/utils/evangelismAdmin.js'
test('evangelism balances only unassigned teachers using current group sizes',()=>{
 const groups=[{id:1,name:'1조',members:[1,2,3].map(id=>({teacherId:id,teacherName:'교사'+id}))},{id:2,name:'2조',members:[]}]
 const people=evangelismPeople([1,2,3,4,5,6,7].map(id=>({id,name:'교사'+id})),groups)
 assert.deepEqual(balancedMoves(people,groups).map(m=>[m.teacherId,m.toGroupId]),[[4,2],[5,2],[6,2],[7,1]])
 assert.equal(groups[1].members.length,0)
 assert.deepEqual(balancedMoves(people,[]),[])
})
test('evangelism selection retains stable identities and members omitted from teacher lookup',()=>{
 const p=evangelismPeople([{id:1,name:'동명이인'},{id:2,name:'동명이인'}],[{id:10,name:'조',members:[{teacherId:3,teacherName:'기존 조원'}]}])
 assert.equal(p.length,3);assert.equal(p.find(x=>x.id===3).groupId,10)
 assert.equal(new Set(p.map(x=>x.id)).size,3)
})
test('rotation crosses year boundary, starts with chosen group and supports intervals',()=>{
 assert.deepEqual(rotationRows('2026-12-26',3,2,[{id:1},{id:2}],2),[{scheduledDate:'2026-12-26',groupId:2},{scheduledDate:'2027-01-09',groupId:1},{scheduledDate:'2027-01-23',groupId:2}])
 assert.deepEqual(rotationRows('2026-02-30',3,1,[{id:1}],1),[])
 assert.deepEqual(rotationRows('2026-12-26',53,1,[{id:1}],1),[])
})
test('schedule validation rejects duplicate active dates per group but allows other groups and canceled slots',()=>{
 const groups=[{id:1},{id:2}],row={scheduledDate:'2026-11-07',groupId:1}
 assert.match(scheduleRowsError([row,row],groups),/중복/)
 assert.match(scheduleRowsError([row],groups,[{...row,id:3,status:'UPCOMING'}]),/이미/)
 assert.equal(scheduleRowsError([row],groups,[{...row,id:3,status:'CANCELED'}]),'')
 assert.equal(scheduleRowsError([row],groups,[{...row,id:3,status:'ACTIVE'}],3),'')
 assert.equal(scheduleRowsError([row,{...row,groupId:2}],groups),'')
 assert.equal(scheduleGroupId({groupId:2,assignments:[]}),2)
})
