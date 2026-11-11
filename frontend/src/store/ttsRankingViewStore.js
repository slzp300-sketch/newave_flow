import { useStore } from 'zustand'
import useAuthStore from './authStore'
import { adminViewAccount as viewAccount } from './ttsAdminViewState'
import { createTtsRankingViewState } from './ttsRankingViewState'

const viewStore = createTtsRankingViewState(viewAccount(useAuthStore.getState()))
useAuthStore.subscribe(auth => viewStore.getState().selectAccount(viewAccount(auth)))
export function restoreTtsRankingPeriod({year,quarter}) {
  viewStore.setState({year,quarter,search:'',statusFilter:'all'})
}
export function useTtsRankingField(field) {
  const value = useStore(viewStore, state => state[field])
  return [value, next => viewStore.getState().setField(field, next)]
}
