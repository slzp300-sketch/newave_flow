import test from 'node:test'
import assert from 'node:assert/strict'
import { createReportDownloader, encodeReportBlob } from '../src/native/reportDownload.js'

test('iOS passes both report formats byte-for-byte to the save dialog without a browser download', async () => {
  for (const format of ['pdf', 'hwpx']) {
    const blob = new Blob([new Uint8Array([0, 1, 127, 128, 255]), '가상 보고서'])
    let saved
    const download = createReportDownloader({ platform: 'ios', native: { save: async value => { saved = value; return { cancelled: false } } } })
    assert.deepEqual(await download(blob, '2026-10-25', format), { status: 'saved' })
    assert.equal(saved.filename, `청소년부 주간보고서 (2026-10-25).${format}`)
    assert.deepEqual(Buffer.from(saved.base64, 'base64'), Buffer.from(await blob.arrayBuffer()))
    assert.deepEqual(Object.keys(saved).sort(), ['base64', 'filename'])
  }
})

test('native cancellation is not reported as saved; native errors do not fall back to an unusable link', async () => {
  const blob = new Blob(['%PDF-1.7 synthetic'])
  const cancelled = createReportDownloader({ platform: 'ios', native: { save: async () => ({ cancelled: true }) } })
  assert.deepEqual(await cancelled(blob, '2026-10-25', 'pdf'), { status: 'cancelled' })
  const failed = createReportDownloader({ platform: 'ios', native: { save: async () => { throw new Error('disk unavailable') } } })
  await assert.rejects(failed(blob, '2026-10-25', 'pdf'), /disk unavailable/)
})

test('unsafe names, unsupported formats, empty and oversized documents never reach the native bridge', async () => {
  let calls = 0
  const download = createReportDownloader({ platform: 'ios', native: { save: () => { calls++ } } })
  for (const [blob, date, format] of [[new Blob(['test']), '../file', 'pdf'], [new Blob(['test']), '2026-10-25', 'html'], [new Blob(), '2026-10-25', 'pdf'], [{ size: 25 * 1024 * 1024 + 1 }, '2026-10-25', 'hwpx']]) {
    await assert.rejects(download(blob, date, format))
  }
  assert.equal(calls, 0)
})

test('browser download uses the original blob and releases its URL after clicking', async () => {
  const blob = new Blob(['synthetic report']), events = []
  const link = { click: () => events.push('clicked'), remove: () => events.push('removed') }
  let cleanup
  const download = createReportDownloader({ platform: 'web', document: { createElement: tag => { assert.equal(tag, 'a'); return link }, body: { appendChild: element => assert.equal(element, link) } }, urls: { createObjectURL: value => { assert.equal(value, blob); return 'blob:report' }, revokeObjectURL: value => events.push(value) }, schedule: (fn, wait) => { assert.equal(wait, 60000); cleanup = fn } })
  assert.deepEqual(await download(blob, '2026-10-25', 'hwpx'), { status: 'started' })
  assert.equal(link.download, '청소년부 주간보고서 (2026-10-25).hwpx')
  assert.equal(link.href, 'blob:report')
  assert.deepEqual(events, ['clicked', 'removed'])
  cleanup()
  assert.equal(events.at(-1), 'blob:report')
})

test('binary encoding preserves data across chunk boundaries', async () => {
  const bytes = Uint8Array.from({ length: 20000 }, (_, index) => index % 256)
  assert.deepEqual(Buffer.from(await encodeReportBlob(new Blob([bytes])), 'base64'), Buffer.from(bytes))
})
