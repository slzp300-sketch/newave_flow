import test from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { createApiClient } from '../src/api/createApiClient.js'
import { loginEnvironment, validatedReviewApiUrl } from '../src/auth/reviewEnvironment.js'

test('only the reserved review domain selects the synthetic environment', () => {
  assert.equal(loginEnvironment(' Play.Teacher@Review.Newaveflow.Invalid '), 'review')
  for (const email of ['teacher@gmail.com', 'teacher@review.newaveflow.invalid.evil', 'review.newaveflow.invalid@gmail.com', '']) {
    assert.equal(loginEnvironment(email), 'production')
  }
})

test('review endpoint rejects arbitrary origins, credentials, and redirect-like values', () => {
  assert.equal(validatedReviewApiUrl('https://synthetic.up.railway.app/api'), 'https://synthetic.up.railway.app/api')
  assert.equal(validatedReviewApiUrl('http://localhost:8081/api', true), 'http://localhost:8081/api')
  for (const value of ['https://evil.example/api', 'https://host.up.railway.app.evil/api', 'http://host.up.railway.app/api',
    'https://user:password@host.up.railway.app/api', 'https://host.up.railway.app/api?url=x', 'http://localhost:8081/api']) {
    assert.throws(() => validatedReviewApiUrl(value))
  }
})

function setup(reviewBaseURL = 'https://review.example/api') {
  const state = { user: { id: 1 }, accessToken: 'review-access', refreshToken: 'review-refresh', apiEnvironment: 'review',
    setAuth(user, accessToken, refreshToken, apiEnvironment) { Object.assign(this, { user, accessToken, refreshToken, apiEnvironment }) },
    clearAuth() { this.user = null; this.accessToken = null; this.refreshToken = null; this.apiEnvironment = 'production' },
  }
  const refreshes = [], requests = []
  const api = createApiClient({ axios: { create: axios.create, post: async (url, body) => {
    refreshes.push({ url, body }); return { data: { user: { id: 1 }, accessToken: 'new-review', refreshToken: 'new-review-refresh' } }
  } }, authStore: { getState: () => state }, baseURL: 'https://production.example/api', reviewBaseURL,
    wait: async () => {}, onSessionExpired() {} })
  api.client.defaults.adapter = async config => {
    requests.push({ url: api.client.getUri(config), token: config.headers.Authorization, method: config.method })
    return { config, status: 200, headers: {}, data: {} }
  }
  return { ...api, state, requests, refreshes }
}

test('review reads, writes and refresh stay on review; logout switches the next request back', async () => {
  const api = setup()
  await api.client.get('/students/1')
  await api.client.post('/attendances/batch', { fake: true })
  await api.refreshSession()
  assert.equal(api.state.apiEnvironment, 'review')
  assert.equal(api.refreshes[0].url, 'https://review.example/api/auth/refresh')
  assert.equal(api.refreshes[0].body.refreshToken, 'review-refresh')
  await api.client.post('/auth/logout')
  api.state.clearAuth()
  await api.client.get('/auth/kakao/config')
  assert.ok(api.requests.slice(0, 3).every(r => r.url.startsWith('https://review.example/api/')))
  assert.equal(api.requests[3].url, 'https://production.example/api/auth/kakao/config')
  assert.equal(api.requests[3].token, undefined)
})

test('review login never sends an existing production token to review', async () => {
  const api = setup()
  api.state.apiEnvironment = 'production'; api.state.accessToken = 'production-access'
  await api.client.post('/auth/login', { email: 'synthetic', password: 'synthetic' }, { apiEnvironment: 'review', skipAuth: true })
  assert.equal(api.requests[0].url, 'https://review.example/api/auth/login')
  assert.equal(api.requests[0].token, undefined)
})

test('unavailable review configuration never falls back to production', async () => {
  const api = setup(async () => { throw new Error('unavailable') })
  await assert.rejects(api.client.get('/students/1'))
  await assert.rejects(api.refreshSession())
  assert.equal(api.requests.length, 0)
  assert.equal(api.refreshes.length, 0)
  assert.equal(api.state.apiEnvironment, 'review')
})

test('a delayed review response is rejected after switching to a production session with the same user ID', async () => {
  const api = setup()
  let finish
  api.client.defaults.adapter = config => new Promise(resolve => { finish = () => resolve({ config, status: 200, headers: {}, data: { fake: true } }) })
  const pending = api.client.get('/students/1')
  await new Promise(resolve => setImmediate(resolve))
  api.state.setAuth({ id: 1 }, 'production-access', 'production-refresh', 'production')
  finish()
  await assert.rejects(pending, /로그인 상태가 변경/)
})
