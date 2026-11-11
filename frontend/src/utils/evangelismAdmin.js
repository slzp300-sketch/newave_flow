import { addDays, format, isValid, parseISO } from 'date-fns'

export const scheduleGroupId = row => row.groupId ?? row.assignments?.find(a => a.groupId != null)?.groupId ?? null
export const scheduleGroupName = row => row.groupName || row.assignments?.find(a => a.groupName)?.groupName || '담당 없음'
export const scheduleStatus = status => ({ ACTIVE:'당번', UPCOMING:'예정', COMPLETED:'완료', CANCELED:'취소' }[status] || status)
export function evangelismPeople(teachers, groups) {
  const assigned = new Map()
  for (const group of groups) for (const member of group.members || []) assigned.set(member.teacherId, { groupId:group.id, groupName:group.name })
  // Include members absent from the current teacher projection so they can still be released.
  const people = new Map(teachers.map(t => [t.id, { id:t.id, name:t.name, grade:t.grade || '' }]))
  for (const group of groups) for (const member of group.members || []) if (!people.has(member.teacherId)) people.set(member.teacherId,{id:member.teacherId,name:member.teacherName,grade:''})
  return [...people.values()].map(p => ({ ...p, groupId:null, groupName:'미배정', ...assigned.get(p.id) })).sort((a,b)=>a.name.localeCompare(b.name,'ko') || a.id-b.id)
}
export function balancedMoves(people, groups) {
  if (!groups.length) return []
  const counts = groups.map(g=>({id:g.id,count:people.filter(p=>p.groupId===g.id).length}))
  return people.filter(p=>p.groupId==null).map(p=>{
    const target = counts.reduce((a,b)=>a.count<=b.count?a:b)
    target.count++
    return {teacherId:p.id,fromGroupId:null,toGroupId:target.id}
  })
}
export function validEvangelismDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && isValid(parseISO(value)) && format(parseISO(value),'yyyy-MM-dd')===value
}
export function rotationRows(start, count, interval, groups, firstGroupId) {
  if (!validEvangelismDate(start) || !Number.isInteger(count) || count<1 || count>52 || ![1,2,4].includes(interval) || !groups.length) return []
  const first = Math.max(0,groups.findIndex(g=>g.id===Number(firstGroupId)))
  return Array.from({length:count},(_,i)=>({scheduledDate:format(addDays(parseISO(start),i*7*interval),'yyyy-MM-dd'),groupId:groups[(first+i)%groups.length].id}))
}
export function scheduleRowsError(rows, groups, existing=[], excludeId=null) {
  if (!rows.length || rows.length>52) return '일정은 1~52개까지 등록할 수 있습니다.'
  const seen = new Set()
  for (const [i,row] of rows.entries()) {
    if (!validEvangelismDate(row.scheduledDate)) return `${i+1}번째 날짜를 확인해주세요.`
    if (!groups.some(g=>g.id===Number(row.groupId))) return `${i+1}번째 담당 조를 선택해주세요.`
    const key=row.scheduledDate+':'+row.groupId
    if (seen.has(key)) return '같은 날짜와 담당 조가 중복되었습니다.'
    seen.add(key)
    if (existing.some(s=>s.id!==excludeId && s.status!=='CANCELED' && s.scheduledDate===row.scheduledDate && scheduleGroupId(s)===Number(row.groupId))) return `${row.scheduledDate}에 해당 조의 일정이 이미 있습니다.`
  }
  return ''
}
