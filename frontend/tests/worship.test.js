import test from 'node:test'
import assert from 'node:assert/strict'
import {currentWorshipDate,isWorshipDate,shiftWorshipDate,committeeRows} from '../src/utils/worship.js'
import {wrapNoticeText} from '../src/components/worship/noticeImage.js'
import {createWorshipDownloader} from '../src/native/worshipDownload.js'
import {managementMenuGroups} from '../src/utils/menuGroups.js'
const png=new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),'synthetic'])
test('weeks use Seoul Sunday, including midnight and year boundaries',()=>{
 assert.equal(currentWorshipDate(new Date('2026-11-07T15:00:00Z')),'2026-11-08')
 assert.equal(currentWorshipDate(new Date('2026-11-08T15:00:00Z')),'2026-11-15')
 assert.equal(shiftWorshipDate('2026-12-27',1),'2027-01-03')
 for(const d of ['../file','2026-02-30','2026-11-09','1999-12-26'])assert.equal(isWorshipDate(d),false)
 assert.equal(isWorshipDate('2026-11-08'),true)
})
test('announcement includes every person and wraps without truncating characters',()=>{
 const names=Array.from({length:30},(_,i)=>({name:'가상학생'+i,label:'고1'}))
 const rows=committeeRows({intercessionGrade:'중1',offeringPrayer:null,representativePrayer:null,offerings:names})
 assert.equal(rows[3][1].split('\n').length,30)
 const text='아주긴이름과 안내내용'.repeat(100)
 const lines=wrapNoticeText(text,s=>s.length*30,720)
 assert.equal(lines.join(''),text);assert.ok(lines.every(l=>l.length<=24))
})
test('worship entry follows explicit capability, including regular teachers',()=>{
 const links=flag=>managementMenuGroups('TEACHER',false,false,false,false,flag).flatMap(g=>g.items.map(i=>i.to))
 assert.deepEqual(links(false),[]);assert.deepEqual(links(true),['/worship'])
})
test('iOS PNG export is byte preserving and cancellation is not success',async()=>{
 let saved
 const native={save:async value=>{saved=value;return {cancelled:true}}}
 const download=createWorshipDownloader({platform:'ios',native})
 assert.deepEqual(await download(png,'2026-11-08'),{status:'cancelled'})
 assert.equal(saved.filename,'예배위원 공지 (2026-11-08).png')
 assert.deepEqual(Buffer.from(saved.base64,'base64'),Buffer.from(await png.arrayBuffer()))
})
test('PNG export rejects invalid date, content, or oversized payload before native call',async()=>{
 let called=false
 const download=createWorshipDownloader({platform:'ios',native:{save:()=>{called=true}}})
 for(const [b,d] of [[png,'../file'],[png,'2026-11-09'],[new Blob(['fake']),'2026-11-08'],[{size:26*1024*1024},'2026-11-08']])await assert.rejects(download(b,d))
 assert.equal(called,false)
})
test('web PNG export downloads original bytes and cleans the temporary URL',async()=>{
 let clicked=false,cleanup,revoked
 const link={click:()=>{clicked=true},remove:()=>{}}
 const download=createWorshipDownloader({platform:'web',document:{createElement:()=>link,body:{appendChild:()=>{}}},urls:{createObjectURL:b=>{assert.equal(b,png);return 'blob:synthetic'},revokeObjectURL:u=>{revoked=u}},schedule:f=>{cleanup=f}})
 assert.deepEqual(await download(png,'2026-11-08'),{status:'started'})
 assert.ok(clicked);cleanup();assert.equal(revoked,'blob:synthetic')
})
