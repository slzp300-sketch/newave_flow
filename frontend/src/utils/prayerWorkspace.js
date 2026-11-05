import {PRAYER_CATEGORIES,groupPrayerCollection} from './intercessionCollection.js'

export const prayerPageAliases=['inbox','board','collection','materials','present']
export const normalizePrayerPage=page=>prayerPageAliases.includes(page)?'requests':page
export const isPublicPrayer=request=>request.share&&['published','answered'].includes(request.state)

export function prayerListParams(manager,view){
 const status=manager?({pending:'pending',current:'ongoing',past:'completed'}[view]||'ongoing'):(view==='past'?'answered':'published')
 return {scope:manager?'inbox':'board',status}
}

export function groupWorkspacePrayers(requests,{manager=false,view='current',audience='all',category='all',search=''}={}){
 const term=search.trim().toLocaleLowerCase()
 const items=requests.filter(request=>{
  if(request.state==='archived'||(!manager&&!isPublicPrayer(request)))return false
  const past=!!request.completed||request.state==='answered'
  if(view==='pending'?!manager||request.state!=='pending'&&!request.pendingUpdate:view==='past'?!past:past||request.state==='pending')return false
  if(audience==='shared'&&!isPublicPrayer(request)||audience==='team'&&isPublicPrayer(request))return false
  const fields=manager?[request.title,request.body,request.author,request.publicTitle,request.publicText,request.pendingUpdate?.title,request.pendingUpdate?.body,request.pendingUpdate?.note]:[request.publicTitle,request.publicText,!request.anonymous&&request.author]
  return !term||fields.filter(Boolean).some(value=>value.toLocaleLowerCase().includes(term))
 })
 return PRAYER_CATEGORIES.filter(name=>category==='all'||name===category)
  .map(name=>({category:name,items:items.filter(request=>request.category===name)})).filter(group=>group.items.length)
}

// Always copy a fresh public response, never the inbox's original text or identity fields.
export function workspaceCopyGroups(visibleGroups,publicRequests,category='all'){
 const ids=new Set(visibleGroups.flatMap(group=>group.items.map(request=>request.id)))
 return groupPrayerCollection(publicRequests.filter(request=>ids.has(request.id)),category)
}
