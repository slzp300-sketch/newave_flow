import {useRef,useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {Copy,ChevronRight,Plus,Lock,Globe} from 'lucide-react'
import AppSelect from '../common/AppSelect'
import SearchField from '../common/SearchField'
import SegmentedControl from '../common/SegmentedControl'
import {ActionButton as Button} from '../praise/PraiseMotion'
import {intercessionApi as api} from '../../api/intercession'
import {PRAYER_CATEGORIES,loadPrayerRequests,loadPrayerCollection,formatPrayerCollection} from '../../utils/intercessionCollection'
import {prayerListParams,groupWorkspacePrayers,isPublicPrayer,workspaceCopyGroups} from '../../utils/prayerWorkspace'
import {sharingName} from './RequestForms'

export default function PrayerWorkspace({userId,manager,pending,view,onView,onRegister,onMine,onOpen,onCopy}){
 const [search,setSearch]=useState(''),[category,setCategory]=useState('all'),[audience,setAudience]=useState('all')
 const [copying,setCopying]=useState(null),[error,setError]=useState(''),copyLock=useRef(false)
 const activeView=!manager&&view==='pending'?'current':view
 const params=prayerListParams(manager,activeView)
 const query=useQuery({queryKey:['intercession-list',userId,'workspace',params.scope,params.status],queryFn:()=>loadPrayerRequests(api.list,params),staleTime:0,refetchInterval:15000})
 const filters={manager,view:activeView,audience:manager&&activeView!=='pending'?audience:'all',category,search}
 const groups=query.isError?[]:groupWorkspacePrayers(query.data||[],filters)
 const count=groups.reduce((sum,group)=>sum+group.items.length,0)
 const canCopy=items=>activeView==='current'&&items.some(isPublicPrayer)
 const copy=async target=>{
  if(copyLock.current)return
  copyLock.current=true;setCopying(target);setError('')
  try{
   const [fresh,publicRequests]=await Promise.all([query.refetch({throwOnError:true}),loadPrayerCollection(api.list)])
   const visible=groupWorkspacePrayers(fresh.data||[],filters)
   const selected=workspaceCopyGroups(visible,publicRequests,target==='all'?category:target)
   if(!selected.length){setError('복사할 공유 기도제목이 없습니다.');return}
   await onCopy(formatPrayerCollection(selected))
  }catch(e){setError(e?.response?.data?.message||'불러오지 못했습니다. 다시 시도해주세요.')}
  finally{copyLock.current=false;setCopying(null)}
 }
 const selectView=value=>{setError('');onView(value)}
 const options=[...(manager?[{value:'pending',label:<span className={pending>0?'it-new-tab':''}>새 요청{pending>0&&<b>{pending}</b>}</span>}]:[]),{value:'current',label:'현재 기도제목'},{value:'past',label:'지난 기도제목'}]
 return <div className="it-stack it-workspace">
  <div className="it-row"><button className="it-text-button" onClick={onMine}>내가 보낸 요청<ChevronRight size={13}/></button><Button size="sm" onClick={onRegister}><Plus size={15}/>{manager?'기도제목 등록':'기도제목 보내기'}</Button></div>
  <div className="it-inbox-filters"><SegmentedControl label="기도제목 상태" value={activeView} onChange={selectView} disabled={!!copying} options={options}/></div>
  <div className="it-workspace-filters">
   <AppSelect aria-label="기도제목 분류" value={category} disabled={!!copying} onChange={e=>setCategory(e.target.value)}><option value="all">전체 분류</option>{PRAYER_CATEGORIES.map(name=><option key={name} value={name}>{name}</option>)}</AppSelect>
   {manager&&activeView!=='pending'&&<AppSelect aria-label="공유 범위 필터" value={audience} disabled={!!copying} onChange={e=>setAudience(e.target.value)}><option value="all">전체 보기</option><option value="shared">전체 공유</option><option value="team">팀만 보기</option></AppSelect>}
  </div>
  <SearchField label="기도제목 검색" value={search} onChange={setSearch} placeholder={manager?'제목·내용·제출자 검색':'제목·내용 검색'}/>
  {error&&<p role="alert" className="it-error">{error}</p>}
  {query.isError?<div className="it-error" role="alert">기도제목을 불러오지 못했습니다.<Button size="sm" variant="secondary" onClick={()=>query.refetch()}>다시 확인</Button></div>:query.isPending?<p className="it-empty" role="status">불러오는 중…</p>:<>
   <div className="it-row"><span className="it-meta">{count}건</span>{canCopy(groups.flatMap(group=>group.items))&&<Button size="sm" variant="secondary" disabled={query.isFetching||!!copying} loading={copying==='all'} onClick={()=>copy('all')}><Copy size={14}/>공유 내용 복사</Button>}</div>
   {groups.map(group=><section className="it-collection-group" key={group.category} aria-label={group.category+' 기도제목'}>
    <div className="it-collection-heading"><h2>{group.category}<span>{group.items.length}</span></h2>{canCopy(group.items)&&<button className="it-text-button" disabled={query.isFetching||!!copying} onClick={()=>copy(group.category)} aria-label={group.category+' 공유 내용 복사'}><Copy size={14}/>{copying===group.category?'복사 중':'복사'}</button>}</div>
    <div className="it-collection-grid">{group.items.map(request=>{
     const shared=isPublicPrayer(request),original=!shared&&(manager||request.own),intendedShare=request.state==='pending'?request.share:shared,update=manager&&activeView==='pending'?request.pendingUpdate:null
     const author=manager?request.author:request.anonymous?'익명':request.author
     const registeredDate=request.date?.slice(0,10)
     return <button key={request.id} className="it-collection-item motion-tap" onClick={()=>onOpen(request)}>
      <span className="it-request-title"><strong>{update?.title||(original?request.title:request.publicTitle)}</strong><ChevronRight size={15}/></span>
      {manager&&request.pendingUpdate&&<span className="it-new-badge">수정·근황</span>}
      <span className="it-registration">
       <span className="it-registration-author"><span title={author||'이름 미등록'}>{author||'이름 미등록'}</span>{manager&&<span className={'it-sharing'+(intendedShare?'':' it-sharing-private')} title={sharingName(request)} aria-label={sharingName(request)}>{intendedShare?<Globe size={12}/>:<Lock size={12}/>}</span>}</span>
       {registeredDate?<time dateTime={request.date}>{registeredDate.replaceAll('-','.')} 등록</time>:<span>등록일 미상</span>}
      </span>
     </button>
    })}</div>
   </section>)}
   {!count&&<p className="it-empty">{search||category!=='all'?'검색 결과가 없습니다.':activeView==='pending'?'새 요청이 없습니다.':'기도제목이 없습니다.'}</p>}
  </>}
 </div>
}
