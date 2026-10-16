import client from './client'

export const appleApi = {
  config: () => client.get('/auth/apple/config'),
  connection: () => client.get('/users/me/apple'),
  start: (mode, data) => client.post(mode === 'LINK' ? '/users/me/apple/start'
    : mode === 'DELETE' ? '/users/me/apple/deletion/start'
      : mode === 'DELETE_PUBLIC' ? '/auth/apple/deletion/start' : '/auth/apple/start', data,
    mode === 'DELETE_PUBLIC' ? { skipAuth: true, apiEnvironment: 'production' } : undefined),
  complete: (data, mode) => client.post('/auth/apple/complete', data,
    mode === 'DELETE_PUBLIC' ? { skipAuth: true, apiEnvironment: 'production' } : undefined),
  register: data => client.post('/auth/apple/register', data),
}
