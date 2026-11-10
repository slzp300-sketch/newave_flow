import {Capacitor,registerPlugin} from '@capacitor/core'
import {createWorshipDownloader} from './worshipDownload'
export const downloadWorshipImage=createWorshipDownloader({platform:Capacitor.getPlatform(),native:registerPlugin('NewaveReportExport'),document:globalThis.document,urls:globalThis.URL})
