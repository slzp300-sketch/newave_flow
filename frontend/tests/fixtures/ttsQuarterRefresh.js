export function quarterRefreshData(updated=false) {
  const q1=[120,60,0,null], q2=[20,40,0,updated?100:null]
  const rows=q1.map((score,i)=>({teacherId:99701+i,key:`u${99701+i}`,name:`갱신교사 ${i+1}`,grade:'중1',calendarQuarters:{1:{weekly:score==null?{}:{'2027-03-28':score}},2:{weekly:q2[i]==null?{}:{'2027-03-28':q2[i]}}}}))
  return {stats:{people:rows},admin:q=>rows.map((p,i)=>({teacherId:p.teacherId,teacherName:p.name,grade:p.grade,totalScore:(q===1?q1:q2)[i]??0,weekCount:(q===1?q1:q2)[i]==null?0:1,weeklyScores:(q===1?q1:q2)[i]==null?[]:[{weekNum:14,score:(q===1?q1:q2)[i]}]}))}
}
