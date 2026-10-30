import { createStore } from 'zustand/vanilla'
import { ttsYear, defaultQuarter } from '../utils/ttsPeriod.js'

const defaults = () => {
  const year = ttsYear()
  return { year, quarter: defaultQuarter(year), search: '', statusFilter: 'all' }
}
// Separate from administrator selections; retain only within this app session.
export function createTtsRankingViewState(account) {
  return createStore(set => ({
    ...defaults(), account,
    selectAccount: next => set(state => next === state.account ? state : { ...defaults(), account: next }),
    setField: (field, value) => set(state => ({ [field]: typeof value === 'function' ? value(state[field]) : value })),
  }))
}
