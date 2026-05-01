import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useSettingsStore = create(
  persist(
    (set) => ({
      largeFontMode: false,
      toggleLargeFont: () => set((s) => ({ largeFontMode: !s.largeFontMode })),
    }),
    { name: 'newave-settings' }
  )
)

export default useSettingsStore
