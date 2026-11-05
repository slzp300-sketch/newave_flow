import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizePrayerPage,prayerListParams,groupWorkspacePrayers,workspaceCopyGroups} from '../src/utils/prayerWorkspace.js'
import {loadPrayerRequests,formatPrayerCollection} from '../src/utils/intercessionCollection.js'

const prayer=(id,patch={})=>({id,state:'published',share:true,completed:false,category:'학생',title:'원문',body:'팀만 읽는 원문',author:'익명 제출자',anonymous:true,publicTitle:'공유 제목',publicText:'공유 내용',...patch})
const ids=groups=>groups.flatMap(group=>group.items.map(request=>request.id))

test('legacy prayer screens enter one workspace with role-appropriate API scopes',()=>{
 for(const page of ['inbox','board','collection','materials','present'])assert.equal(normalizePrayerPage(page),'requests')
 assert.equal(normalizePrayerPage('team'),'team')
 assert.deepEqual(prayerListParams(true,'pending'),{scope:'inbox',status:'pending'})
 assert.deepEqual(prayerListParams(true,'past'),{scope:'inbox',status:'completed'})
 assert.deepEqual(prayerListParams(false,'pending'),{scope:'board',status:'published'})
 assert.deepEqual(prayerListParams(false,'past'),{scope:'board',status:'answered'})
})

test('unified list separates pending, current, past and deleted records while retaining team-only history',()=>{
 const requests=[prayer(1),prayer(2,{state:'ready',share:false}),prayer(3,{state:'pending'}),prayer(4,{state:'answered',completed:true}),prayer(5,{state:'ready',share:false,completed:true}),prayer(6,{state:'archived',completed:true})]
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true})),[1,2])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true,view:'pending'})),[3])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true,view:'past'})),[4,5])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true,audience:'team'})),[2])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true,audience:'shared'})),[1])
 assert.deepEqual(ids(groupWorkspacePrayers(requests)),[1])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{view:'past'})),[4])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{view:'pending'})),[])
})

test('category and search stay consistent without exposing anonymous identities or originals in public searches',()=>{
 const requests=[prayer(1,{category:'교사'}),prayer(2,{category:'청소년부'}),prayer(3,{category:'교사',anonymous:false,author:'이름 공개 교사'})]
 assert.deepEqual(groupWorkspacePrayers(requests).map(group=>group.category),['청소년부','교사'])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{category:'교사',search:'공유 내용'})),[1,3])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{search:'익명 제출자'})),[])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{search:'원문'})),[])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true,search:'익명 제출자'})),[2,1])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{search:'이름 공개'})),[3])
})

test('copy uses fresh public versions and never includes private, completed, deleted or hidden records',()=>{
 const visible=groupWorkspacePrayers([prayer(1),prayer(2),prayer(3),prayer(4),prayer(5),prayer(6)],{manager:true})
 const fresh=[prayer(1,{publicText:'최신 공유 내용'}),prayer(2,{state:'ready',share:false}),prayer(3,{state:'answered',completed:true}),prayer(4,{state:'archived'}),prayer(5,{share:false}),prayer(6,{category:'교사',anonymous:false,author:'공개된 이름'}),prayer(7)]
 const groups=workspaceCopyGroups(visible,fresh)
 assert.deepEqual(ids(groups),[1,6])
 assert.equal(formatPrayerCollection(groups),'[학생]\n1. 공유 제목\n최신 공유 내용\n\n[교사]\n1. 공유 제목\n공유 내용\n공개된 이름')
 assert.deepEqual(ids(workspaceCopyGroups(visible,fresh,'교사')),[6])
})

test('workspace loads later pages before grouping categories and searching',async()=>{
 const calls=[]
 const result=await loadPrayerRequests(async params=>{calls.push(params);return params.page===0?{items:[prayer(1)],pages:2}:{items:[prayer(2,{category:'교사',body:'뒤 페이지 검색어'})],pages:2}},{scope:'inbox',status:'ongoing'})
 assert.equal(calls.length,2)
 assert.deepEqual(ids(groupWorkspacePrayers(result,{manager:true,search:'뒤 페이지 검색어',category:'교사'})),[2])
})

test('pending revisions appear in the team queue without replacing public content or exposing private updates',()=>{
 const update={title:'수정 제목',body:'수정 비밀 원문',note:'비공개 근황'}
 const requests=[prayer(1,{pendingUpdate:update}),prayer(2,{state:'answered',completed:true,pendingUpdate:update}),prayer(3,{state:'archived',pendingUpdate:update})]
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true,view:'pending'})),[1,2])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{manager:true,view:'pending',search:'비공개 근황'})),[1,2])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{search:'비공개 근황'})),[])
 assert.deepEqual(ids(groupWorkspacePrayers(requests,{search:'수정 비밀'})),[])
 const groups=groupWorkspacePrayers(requests,{manager:true})
 assert.equal(formatPrayerCollection(workspaceCopyGroups(groups,requests)),'[학생]\n1. 공유 제목\n공유 내용')
})
