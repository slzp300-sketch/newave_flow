export const careKinds={UPDATE:'근황',PRAYER:'기도제목',CONTACT:'연락·만남'}
export const careActions={CREATED:'기록 추가',EDITED:'내용 수정'}
export const checkLabels={PRESENT:'출석',ABSENT:'결석',LATE:'지각',UNKNOWN:'미기록',NOT_ASSIGNED:'배정 전',ATTEND:'참석',UNSUBMITTED:'미응답',PARTIAL:'부분 참석',SUBMITTED:'제출 완료',MISSING:'미제출',CHANGED:'재제출 필요'}
export const minuteLabels={EXEMPT:'참석자 · 확인 면제',NO_MINUTE:'회의록 미등록',CONFIRMED:'회의록 확인',UNCONFIRMED:'회의록 미확인'}
export const lastStatus=s=>s.history?.at(-1)?.status||'UNKNOWN'
export function studentCounts(students=[]){return{total:students.length,present:students.filter(s=>lastStatus(s)==='PRESENT').length,absent:students.filter(s=>lastStatus(s)==='ABSENT').length,late:students.filter(s=>lastStatus(s)==='LATE').length,unknown:students.filter(s=>lastStatus(s)==='UNKNOWN').length,unassigned:students.filter(s=>lastStatus(s)==='NOT_ASSIGNED').length}}
export function filterCareStudents(students,{search='',classId='',filter='all'}={}){const q=search.trim().normalize('NFKC');return students.filter(s=>(!classId||String(s.classId)===String(classId))&&(!q||`${s.name} ${s.school||''}`.normalize('NFKC').includes(q))&&(filter==='all'||filter==='prayer'&&s.canCare&&s.prayerCount>0||filter==='unknown'&&lastStatus(s)==='UNKNOWN'))}
export function responseCounts(rows=[]){return{total:rows.length,responded:rows.filter(r=>r.status&&r.status!=='UNKNOWN'&&r.status!=='UNSUBMITTED').length}}
export const careError=e=>e?.response?.data?.message||e?.message||'자료를 확인하지 못했습니다. 다시 시도해주세요.'
