export const PRAYER_CATEGORIES=['청소년부','학생','교사','가정','기타']

const canCollect=request=>request.share&&request.state==='published'&&!request.completed

export async function loadPrayerRequests(fetchPage,{scope,status,search=''}){
 const first=await fetchPage({scope,status,search,page:0})
 const requests=[...first.items]
 for(let page=1;page<first.pages;page++){
  const next=await fetchPage({scope,status,search,page})
  requests.push(...next.items)
 }
 return [...new Map(requests.map(request=>[request.id,request])).values()]
}

export async function loadPrayerCollection(fetchPage,search=''){
 return (await loadPrayerRequests(fetchPage,{scope:'board',status:'published',search})).filter(canCollect)
}

export function groupPrayerCollection(requests,category='all'){
 return PRAYER_CATEGORIES.filter(name=>category==='all'||name===category)
  .map(name=>({category:name,items:requests.filter(request=>canCollect(request)&&request.category===name)}))
  .filter(group=>group.items.length)
}

export function formatPrayerCollection(groups){
 return groups.map(group=>`[${group.category}]\n`+group.items.map((request,index)=>
  [`${index+1}. ${request.publicTitle}`,request.publicText,!request.anonymous&&request.author?request.author:null]
   .filter(Boolean).join('\n')).join('\n\n')).join('\n\n')
}
