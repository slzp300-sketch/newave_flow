import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,

      isHydrated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),

      updateAccessToken: (accessToken) => set({ accessToken }),

      updateUserSettings: (settings) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...settings } : null,
        })),

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'newave-auth',
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    }
  )
)

export default useAuthStore
