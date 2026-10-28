// Synthetic, shared input for both real screens; no personal or production data.
export const quarterConsistency = Array.from({length:14}, (_,i) => {
  const score=i===13?null:120-i*10
  return {teacherId:99801+i,name:`검수교사 ${String(i+1).padStart(2,'0')}`,grade:i%2?'중1':'고1',score}
})
export const consistencyStats = {people:quarterConsistency.map(p=>({...p,key:`u${p.teacherId}`,calendarQuarters:{4:{weekly:p.score==null?{}:{'2026-10-18':p.score}}}}))}
export const consistencyAdmin = quarterConsistency.map(p=>({teacherId:p.teacherId,teacherName:p.name,grade:p.grade,totalScore:p.score??0,weekCount:p.score==null?0:1,weeklyScores:p.score==null?[]:[{weekNum:43,score:p.score}]}))
