import client from './client'
const data = p => p.then(r => r.data)
export const worshipApi = {
 state: date => data(client.get('/worship', {params:{date}})),
 team: (date,input) => data(client.put('/worship/team',input,{params:{date}})),
 committee: (date,input) => data(client.put('/worship/'+date+'/committee',input)),
 announce: (date,input) => data(client.put('/worship/'+date+'/announcement',input)),
 task: (date,key,action,input) => data(client.put('/worship/'+date+'/tasks/'+key+'/'+action,input)),
}
