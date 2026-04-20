import client from './client'

export const ttsApi = {
  getQuestions: () => client.get('/tts/questions'),
  getMyTts: (year, weekNum) => client.get('/tts/my', { params: { year, weekNum } }),
  submitTts: (data) => client.post('/tts/submit', data),
  getSummary: (year, weekNum) => client.get('/admin/tts/summary', { params: { year, weekNum } }),
  getQuarterlyScores: (year, quarter) => client.get('/admin/tts/scores/quarterly', { params: { year, quarter } }),
  updateQuestions: (questions) => client.post('/admin/tts/questions', questions),
}
