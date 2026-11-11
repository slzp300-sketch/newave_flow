import client from './client'
const data=p=>p.then(r=>r.data)
export const gradeCareApi={
 access:()=>data(client.get('/grade-care/access')),
 overview:(grade,date)=>data(client.get('/grade-care',{params:{grade,date}})),
 event:(id,grade)=>data(client.get(`/grade-care/events/${id}`,{params:{grade}})),
 studentAccess:id=>data(client.get(`/grade-care/students/${id}/access`)),
 student:(id,date)=>data(client.get(`/grade-care/students/${id}`,{params:{date}})),
 create:(id,body)=>data(client.post(`/grade-care/students/${id}/records`,body)),
 update:(id,record,body)=>data(client.put(`/grade-care/students/${id}/records/${record}`,body)),
}
