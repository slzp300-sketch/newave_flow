export const WORSHIP_GRADES = ['중1','중2','중3','고1','고2','고3']
const iso = date => date.toISOString().slice(0,10)
export function currentWorshipDate(now = new Date()) {
 const korean = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const part = key => korean.find(p=>p.type===key).value
 const date = new Date(part('year')+'-'+part('month')+'-'+part('day')+'T12:00:00Z')
 date.setUTCDate(date.getUTCDate()+(7-date.getUTCDay())%7)
 return iso(date)
}
export function isWorshipDate(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false
 const d=new Date(value+'T12:00:00Z')
 return Number.isFinite(d.getTime())&&iso(d)===value&&d.getUTCDay()===0&&d.getUTCFullYear()>=2000&&d.getUTCFullYear()<=2100
}
export function shiftWorshipDate(value,amount){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+amount*7);return iso(d)}
export const worshipDateLabel = date => Number(date.slice(0,4))+'년 '+Number(date.slice(5,7))+'월 '+Number(date.slice(8,10))+'일'
export const personLabel = p => p ? p.name+(/^중|^고/.test(p.label||'')?' · '+p.label:'') : '미정'
export const committeeRows = data => [
 ['예배 전 중보기도',data.intercessionGrade||'미정'],
 ['헌금기도',personLabel(data.offeringPrayer)],
 ['대표기도',personLabel(data.representativePrayer)],
 ['헌금위원',data.offerings.length?data.offerings.map(personLabel).join('\n'):'미정'],
]
export const committeeComplete = data => !!(data.intercessionGrade&&data.offeringPrayer&&data.representativePrayer&&data.offerings.length)
