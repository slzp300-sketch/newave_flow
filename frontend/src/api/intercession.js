import client from './client'
const data = promise => promise.then(r => r.data)
export const intercessionApi = {
 state: week => data(client.get('/intercession', {params:{week}})),
 list: params => data(client.get('/intercession/requests', {params})),
 detail: id => data(client.get('/intercession/requests/'+id)),
 submit: input => data(client.post('/intercession/requests',input)),
 review: (id,input) => data(client.put('/intercession/requests/'+id,input)),
 decide: (id,input) => data(client.put('/intercession/requests/'+id+'/decision',input)),
 update: (id,input) => data(client.put('/intercession/requests/'+id+'/update',input)),
 reviewUpdate: (id,input) => data(client.put('/intercession/requests/'+id+'/update-review',input)),
 withdraw: (id,revision) => data(client.post('/intercession/requests/'+id+'/withdraw',{revision})),
 team: input => data(client.put('/intercession/team',input)),
 meeting: (date,input) => data(client.put('/intercession/meetings/'+date,input)),
 materials: (date,input) => data(client.put('/intercession/meetings/'+date+'/materials',input)),
 prepare: (date,revision) => data(client.post('/intercession/meetings/'+date+'/paper',{revision})),
}
