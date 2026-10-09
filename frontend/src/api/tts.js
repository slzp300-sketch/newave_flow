import client from './client'

export const ttsApi = {
  getQuestions: () => client.get('/tts/questions'),
  getMyTts: (year, weekNum) => client.get('/tts/my', { params: { year, weekNum } }),
  submitTts: (data) => client.post('/tts/submit', data),
  getSummary: (year, weekNum) => client.get('/admin/tts/summary', { params: { year, weekNum } }),
  getQuarterlyScores: (year, quarter) => client.get('/admin/tts/scores/quarterly', { params: { year, quarter } }),
  getAllQuestions: () => client.get('/admin/tts/questions'),
  updateQuestions: (questions) => client.post('/admin/tts/questions', questions),
  getWeek: (date) => client.get('/tts/week', { params: { date } }),
  saveAnswer: (data) => client.put('/tts/answer', data),
  getStats: (year) => client.get('/tts/stats', { params: { year } }),
  importLegacy: (year, text) => client.post('/admin/tts/legacy', { year, text }),
}
