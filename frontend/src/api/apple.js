import client from './client'

export const appleApi = {
  config: () => client.get('/auth/apple/config'),
  connection: () => client.get('/users/me/apple'),
  start: (mode, data) => client.post(mode === 'LINK' ? '/users/me/apple/start'
    : mode === 'DELETE' ? '/users/me/apple/deletion/start' : '/auth/apple/start', data),
  complete: data => client.post('/auth/apple/complete', data),
  register: data => client.post('/auth/apple/register', data),
}
