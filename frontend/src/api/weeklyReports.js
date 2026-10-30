import client from './client'
import { saveReportFile } from '../native/reportExport'

export const weeklyReportsApi = {
  get: date => client.get(`/weekly-reports/${date}`),
  preview: date => client.get(`/weekly-reports/${date}/preview`, { responseType: 'text' }),
  save: (date, revision, fields) => client.put(`/weekly-reports/${date}`, { revision, fields }),
  mine: date => client.get('/weekly-reports/my-worship', { params: { date } }),
  saveMine: (date, data) => client.put('/weekly-reports/my-worship', data, { params: { date } }),
  teacher: (date, id, data) => client.put(`/weekly-reports/${date}/teachers/${id}`, data),
  editor: (id, date) => client.get(`/weekly-reports/classes/${id}`, { params: { date } }),
  supplement: (id, date, data) => client.put(`/weekly-reports/classes/${id}`, data, { params: { date } }),
  correct: (id, date, data) => client.put(`/weekly-reports/${date}/classes/${id}/correction`, data),
  prepare: (date, report) => client.post(`/weekly-reports/${date}/exports`, { sourceHash: report.sourceHash, draftRevision: report.draftRevision }),
  file: (id, format) => client.get(`/weekly-reports/exports/${id}/${format}`, { responseType: 'blob' }),
}

export async function reportError(error) {
  if (error.response?.data instanceof Blob) {
    try { return JSON.parse(await error.response.data.text()).message || '파일을 받지 못했습니다.' } catch { return '파일을 받지 못했습니다. 다시 시도해주세요.' }
  }
  return error.response?.data?.message || error.message || '처리하지 못했습니다. 다시 시도해주세요.'
}

export async function downloadReport(id, date, format) {
  const { data } = await weeklyReportsApi.file(id, format)
  return saveReportFile(data, date, format)
}
