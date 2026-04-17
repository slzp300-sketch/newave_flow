import client from './client'

export const checklistApi = {
  getItems: () => client.get('/checklist/items'),
  getRecords: (date) => client.get('/checklist/records', { params: { date } }),
  saveRecords: (data) => client.post('/checklist/records', data),
}
