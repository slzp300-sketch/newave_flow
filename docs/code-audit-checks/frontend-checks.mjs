// Audit characterization checks. Uses real source with local mock transports; no network or live data.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import axios from '../../frontend/node_modules/axios/index.js'
import { QueryClient } from '../../frontend/node_modules/@tanstack/query-core/build/modern/index.js'

const source = (await readFile(new URL('../../frontend/src/api/client.js', import.meta.url), 'utf8'))
  .replace(/^import .*$/gm, '')
  .replace(/import\.meta\.env\.PROD/g, 'false')
  .replace('export default client', 'globalThis.auditClient = client')
const sandbox = {
  axios,
  useAuthStore: {getState: () => ({accessToken: null, refreshToken: null})},
  localStorage: {getItem: () => null},
  window: {location: {}}, console,
  setTimeout: callback => { callback(); return 0 },
}
vm.runInNewContext(source, sandbox)
let writes = 0
sandbox.auditClient.defaults.adapter = async config => {
  writes++
  if (writes === 1) throw new axios.AxiosError('Synthetic response lost after server commit', 'ERR_NETWORK', config)
  return {status:200,statusText:'OK',headers:{},config,data:{saved:true}}
}
await sandbox.auditClient.post('/audit-only/synthetic-operation', {example:true})
assert.equal(writes, 2)
console.log('CONFIRMED: actual client interceptor repeats a POST after an ambiguous network error')

const queries = new QueryClient({defaultOptions:{queries:{staleTime:300000,retry:false}}})
const key = ['events','2026-10']
await queries.fetchQuery({queryKey:key,queryFn:async()=>['inside-month']})
let widerRangeFetches = 0
const calendar = await queries.fetchQuery({queryKey:key,queryFn:async()=>{widerRangeFetches++;return ['outside-month','inside-month']}})
assert.equal(widerRangeFetches,0)
assert.deepEqual(calendar,['inside-month'])
queries.clear()
console.log('CONFIRMED: matching Home/Calendar cache keys reuse the narrower fresh response')
