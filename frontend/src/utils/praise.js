import {toApiDate} from './date.js'
export const parts=['인도자','메인','세컨','일렉','베이스','드럼','싱어','워십']
export const grades=['중1','중2','중3','고1','고2','고3']
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export const dateValue=s=>new Date(`${s}T12:00:00`)
export const shortDate=s=>s?`${Number(s.slice(5,7))}/${Number(s.slice(8,10))}`:'—'
export const addDays=(s,n)=>{const d=dateValue(s);d.setDate(d.getDate()+n);return toApiDate(d)}
export const nextMonth=()=>{const d=dateValue(today());d.setDate(1);d.setMonth(d.getMonth()+1);return toApiDate(d).slice(0,7)}
export const monthOfWeek=w=>addDays(w.worshipDate,-1).slice(0,7)
export const termMonths=t=>(t.half===1?[2,3,4,5,6,7]:[9,10,11,12]).map(m=>`${t.year}-${String(m).padStart(2,'0')}`)
export function saturdays(month){const days=[];for(let i=1;i<=31;i++){const s=`${month}-${String(i).padStart(2,'0')}`,d=dateValue(s);if(toApiDate(d)!==s)break;if(d.getDay()===6)days.push(s)}return days}
export const timeLabel=w=>`${w.startTime?.slice(0,5)}–${w.endTime?.slice(0,5)}`
export const unavailable=(data,member,date)=>data.responses.some(r=>r.userId===member?.userId&&r.dates.includes(date))
export const needsReview=(response,weeks)=>!!response&&weeks.some(w=>response.scheduleVersions[String(w.id)]!==w.scheduleVersion)
export function myWeek(weeks,date=today()){const d=dateValue(date),sun=addDays(date,(7-d.getDay())%7);return weeks.find(w=>w.worshipDate===sun)}
