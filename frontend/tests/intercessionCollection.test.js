import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPrayerCollection,groupPrayerCollection,formatPrayerCollection} from '../src/utils/intercessionCollection.js'

const shared=(id,patch={})=>({id,share:true,state:'published',completed:false,category:'학생',publicTitle:`제목 ${id}`,publicText:`함께 기도 ${id}`,anonymous:true,...patch})

test('collection loads every page and does not repeat requests across page boundaries',async()=>{
 const calls=[]
 const result=await loadPrayerCollection(async params=>{
  calls.push(params)
  return params.page===0?{items:Array.from({length:30},(_,i)=>shared(i+1)),pages:2}:{items:[shared(30),shared(31)],pages:2}
 },'예배')
 assert.equal(result.length,31)
 assert.deepEqual(calls,[{scope:'board',status:'published',search:'예배',page:0},{scope:'board',status:'published',search:'예배',page:1}])
 await assert.rejects(loadPrayerCollection(async params=>{if(params.page)throw Error('connection lost');return {items:[shared(1)],pages:2}}))
})

test('category collection excludes private, pending and finished requests',()=>{
 const requests=[shared(1,{category:'교사'}),shared(2,{category:'청소년부'}),shared(3,{share:false}),shared(4,{state:'pending'}),shared(5,{completed:true}),shared(6,{state:'answered'})]
 const groups=groupPrayerCollection(requests)
 assert.deepEqual(groups.map(group=>[group.category,group.items.map(r=>r.id)]),[['청소년부',[2]],['교사',[1]]])
 assert.deepEqual(groupPrayerCollection(requests,'교사').map(group=>group.items.map(r=>r.id)),[[1]])
 assert.deepEqual(groupPrayerCollection(requests,'가정'),[])
})

test('copied text contains only shared content and consented names',()=>{
 const groups=groupPrayerCollection([
  shared(1,{title:'private original title',body:'private original body',source:'private source',author:'anonymous teacher'}),
  shared(2,{category:'교사',anonymous:false,author:'공유 동의 교사'})
 ])
 const text=formatPrayerCollection(groups)
 assert.equal(text,'[학생]\n1. 제목 1\n함께 기도 1\n\n[교사]\n1. 제목 2\n함께 기도 2\n공유 동의 교사')
 assert.equal(formatPrayerCollection([]),'')
})
