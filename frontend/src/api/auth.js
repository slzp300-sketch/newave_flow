import client from './client'
import { createEmailLogin } from '../auth/createEmailLogin'

export const authApi = {
  kakaoConfig: (config) => client.get('/auth/kakao/config', config),
  kakaoConnection: () => client.get('/users/me/kakao'),
  startKakao: (mode, data) => client.post(mode === 'LINK' ? '/users/me/kakao/start' : '/auth/kakao/start', data),
  completeKakao: data => client.post('/auth/kakao/complete', data),
  registerKakao: data => client.post('/auth/kakao/register', data),
  login: createEmailLogin(client),
  register: (data)          => client.post('/auth/register', data),
  logout: async (config) => {
    // Remove this installation while the old session still authenticates the request.
    try {
      const { detachPushNotifications } = await import('../native/pushNotifications')
      await detachPushNotifications(config)
    } catch { /* A plugin/storage failure must not prevent logout. */ }
    return client.post('/auth/logout', undefined, config)
  },
  me:     ()                => client.get('/users/me'),
  checkEmail: (email)       => client.get('/auth/check-email', { params: { email } }),
  checkName:  (name)        => client.get('/auth/check-name', { params: { name } }),
  findEmail:     (name, phone)         => client.post('/auth/find-email', { name, phone }),
  resetPassword: (email, name, phone)  => client.post('/auth/reset-password', { email, name, phone }),
}
