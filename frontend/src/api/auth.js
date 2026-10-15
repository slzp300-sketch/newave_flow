import client from './client'
import { loginEnvironment } from '../auth/reviewEnvironment'

export const authApi = {
  kakaoConfig: () => client.get('/auth/kakao/config'),
  kakaoConnection: () => client.get('/users/me/kakao'),
  startKakao: (mode, data) => client.post(mode === 'LINK' ? '/users/me/kakao/start' : '/auth/kakao/start', data),
  completeKakao: data => client.post('/auth/kakao/complete', data),
  registerKakao: data => client.post('/auth/kakao/register', data),
  login: async (email, password) => {
    const apiEnvironment = loginEnvironment(email)
    const response = await client.post('/auth/login', { email, password }, { apiEnvironment, skipAuth: true })
    return { ...response, data: { ...response.data, apiEnvironment } }
  },
  register: (data)          => client.post('/auth/register', data),
  logout: (config)          => client.post('/auth/logout', undefined, config),
  me:     ()                => client.get('/users/me'),
  checkEmail: (email)       => client.get('/auth/check-email', { params: { email } }),
  checkName:  (name)        => client.get('/auth/check-name', { params: { name } }),
  findEmail:     (name, phone)         => client.post('/auth/find-email', { name, phone }),
  resetPassword: (email, name, phone)  => client.post('/auth/reset-password', { email, name, phone }),
}
