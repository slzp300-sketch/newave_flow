import { Capacitor, registerPlugin } from '@capacitor/core'
import { createReportDownloader } from './reportDownload'

export const saveReportFile = createReportDownloader({
  platform: Capacitor.getPlatform(),
  native: registerPlugin('NewaveReportExport'),
  document,
  urls: URL,
})
