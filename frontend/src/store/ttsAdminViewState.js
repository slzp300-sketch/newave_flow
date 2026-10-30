import { createStore } from 'zustand/vanilla'
import { ttsYear, defaultQuarter } from '../utils/ttsPeriod.js'

export const adminViewAccount = auth => JSON.stringify([auth.apiEnvironment, auth.user?.id ?? null])
const defaults = () => {
  const year = ttsYear()
  return { activeTab: 'summary', weekOffset: 0, summarySearch: '', search: '', year,
    quarter: defaultQuarter(year), statusFilter: 'all', sortAsc: false }
}

// Session memory only: survive route remounts, discard on account/environment changes.
export function createTtsAdminViewState(account) {
  return createStore(set => ({
    ...defaults(), account,
    selectAccount: next => set(state => next === state.account ? state : { ...defaults(), account: next }),
    setField: (field, value) => set(state => ({ [field]: typeof value === 'function' ? value(state[field]) : value })),
  }))
}
