import { queryReadState } from './queryReadState.js'

export function ttsAdminReadState(query, online = true) {
  if (!online || query.fetchStatus === 'paused') return 'offline'
  return queryReadState([query])
}
