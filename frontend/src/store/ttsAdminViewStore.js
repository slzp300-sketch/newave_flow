import { useStore } from 'zustand'
import useAuthStore from './authStore'
import { adminViewAccount, createTtsAdminViewState } from './ttsAdminViewState'

const viewStore = createTtsAdminViewState(adminViewAccount(useAuthStore.getState()))
useAuthStore.subscribe(auth => viewStore.getState().selectAccount(adminViewAccount(auth)))

export function restoreTtsAdminPeriod({year,quarter}) {
  viewStore.setState({activeTab:'scores',year,quarter,search:'',statusFilter:'all'})
}
export function useTtsAdminField(field) {
  const value = useStore(viewStore, state => state[field])
  return [value, next => viewStore.getState().setField(field, next)]
}
