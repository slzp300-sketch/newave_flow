import client from './client'

export const authApi = {
  login:  (email, password) => client.post('/auth/login', { email, password }),
  register: (data)          => client.post('/auth/register', data),
  logout: ()                => client.post('/auth/logout'),
  me:     ()                => client.get('/users/me'),
  checkEmail: (email)       => client.get('/auth/check-email', { params: { email } }),
  checkName:  (name)        => client.get('/auth/check-name', { params: { name } }),
  findEmail:     (name, phone)         => client.post('/auth/find-email', { name, phone }),
  resetPassword: (email, name, phone)  => client.post('/auth/reset-password', { email, name, phone }),
}
