import client from './client'
import { saveReportFile } from '../native/reportExport'
import { requestErrorMessage } from '../utils/requestFeedback'

export const weeklyReportsApi = {
  attendance: date => client.get(`/weekly-reports/${date}/attendance`),
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
    try { return requestErrorMessage({response:{...error.response,data:JSON.parse(await error.response.data.text())}}, 'download') } catch { return requestErrorMessage(error, 'download') }
  }
  return requestErrorMessage(error, 'download')
}

export async function downloadReport(id, date, format) {
  const { data } = await weeklyReportsApi.file(id, format)
  return saveReportFile(data, date, format)
}
