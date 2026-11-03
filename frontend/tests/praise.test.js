import test from 'node:test'
import assert from 'node:assert/strict'
import {saturdays,monthOfWeek,termMonths,myWeek,needsReview,unavailable} from '../src/utils/praise.js'
test('Saturday month owns a year-boundary worship date and never invents January/August operations',()=>{
 assert.deepEqual(saturdays('2026-12'),['2026-12-05','2026-12-12','2026-12-19','2026-12-26'])
 assert.equal(monthOfWeek({worshipDate:'2027-01-03'}),'2027-01')
 assert.equal(monthOfWeek({worshipDate:'2027-08-01'}),'2027-07')
 assert.deepEqual(termMonths({year:2026,half:1}),['2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'])
 assert.deepEqual(termMonths({year:2026,half:2}),['2026-09','2026-10','2026-11','2026-12'])
 const week={worshipDate:'2026-11-08'};assert.equal(myWeek([week],'2026-11-03'),week);assert.equal(myWeek([week],'2026-11-08'),week)
})
test('Unavailable, explicit none and schedule reconfirmation remain distinct',()=>{
 const response={userId:1,dates:[],scheduleVersions:{'2':0}}
 assert.equal(needsReview(undefined,[{id:2,scheduleVersion:1}]),false)
 assert.equal(needsReview(response,[{id:2,scheduleVersion:0}]),false)
 assert.equal(needsReview(response,[{id:2,scheduleVersion:1}]),true)
 assert.equal(unavailable({responses:[response]},{userId:1},'2026-12-05'),false)
 response.dates.push('2026-12-05');assert.equal(unavailable({responses:[response]},{userId:1},'2026-12-05'),true)
 assert.equal(unavailable({responses:[response]},{userId:2},'2026-12-05'),false)
})
