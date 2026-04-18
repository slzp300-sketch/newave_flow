import client from './client'

export const weeklyStatusApi = {
  getStatus: () => client.get('/weekly-status'),
}
