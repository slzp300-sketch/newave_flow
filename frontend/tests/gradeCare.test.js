import test from 'node:test'
import assert from 'node:assert/strict'
import {studentCounts,filterCareStudents,responseCounts} from '../src/utils/gradeCare.js'
import {invalidateAfterWrite} from '../src/api/queryPolicy.js'
const rows=[{id:1,name:'가상가람',classId:3,canCare:true,prayerCount:1,history:[{status:'ABSENT'}]},{id:2,name:'가상나래',classId:3,canCare:false,prayerCount:1,history:[{status:'UNKNOWN'}]},{id:3,name:'가상다온',classId:4,canCare:true,history:[{status:'NOT_ASSIGNED'}]},{id:4,name:'가상라온',classId:4,canCare:true,history:[{status:'LATE'}]}]
test('missing, late and before-assignment attendance are never counted as absences',()=>assert.deepEqual(studentCounts(rows),{total:4,present:0,absent:1,late:1,unknown:1,unassigned:1}))
test('care filters require permission and combine with name/class search',()=>{assert.deepEqual(filterCareStudents(rows,{filter:'prayer'}).map(x=>x.id),[1]);assert.deepEqual(filterCareStudents(rows,{filter:'prayer',classId:'3',search:' 가람 '}).map(x=>x.id),[1]);assert.equal(filterCareStudents(rows,{filter:'unknown'}).length,1)})
test('event and meeting absence is a response while missing is not',()=>assert.deepEqual(responseCounts([{status:'ABSENT'},{status:'PARTIAL'},{status:'UNKNOWN'},{status:'UNSUBMITTED'}]),{total:4,responded:2}))
test('source and authorization changes invalidate private care and overview reads',async()=>{let predicate;for(const path of ['/students/3/memo','/officers/organization/2026/GRADE_M1','/grade-care/students/3/records','/events/2','/meetings/attendance','/admin/classes/3']){await invalidateAfterWrite({invalidateQueries:async o=>{predicate=o.predicate}},path);assert(predicate({queryKey:['grade-care-student',1,3]}));assert(predicate({queryKey:['grade-care',1,'중1']}))}})
