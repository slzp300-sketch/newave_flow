const MAX_REPORT_BYTES = 25 * 1024 * 1024

export async function encodeReportBlob(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const parts = []
  for (let i = 0; i < bytes.length; i += 8192) parts.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
  return btoa(parts.join(''))
}

export function createReportDownloader({ platform, native, document, urls, schedule = setTimeout }) {
  return async (blob, date, format) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['hwpx', 'pdf'].includes(format)) throw new Error('보고서 파일 형식을 확인해주세요.')
    if (!blob?.size || blob.size > MAX_REPORT_BYTES) throw new Error('보고서 파일은 25MB 이하만 저장할 수 있습니다.')
    const filename = `청소년부 주간보고서 (${date}).${format}`
    if (platform === 'ios') {
      // Keep the authenticated download in the app; only document bytes cross the bridge.
      const result = await native.save({ filename, base64: await encodeReportBlob(blob) })
      return { status: result.cancelled ? 'cancelled' : 'saved' }
    }
    const url = urls.createObjectURL(blob)
    const link = document.createElement('a')
    try {
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
    } finally {
      link.remove()
      schedule(() => urls.revokeObjectURL(url), 60000)
    }
    return { status: 'started' }
  }
}
