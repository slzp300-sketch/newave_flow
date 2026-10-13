import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { isNativeApp, secureAuthStorage } from '../native/platform'

let hydrationError = null
export function assertAuthHydrated() {
  if (hydrationError) throw hydrationError
}

const useAuthStore = create(
  persist(
    (set) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      apiEnvironment: 'production',

      isHydrated: false,

      setAuth: (user, accessToken, refreshToken, apiEnvironment = 'production') =>
        set({ user, accessToken, refreshToken, apiEnvironment }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, apiEnvironment: 'production' }),

      updateAccessToken: (accessToken) => set({ accessToken }),

      updateUserSettings: (settings) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...settings } : null,
        })),

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'newave-auth',
      storage: createJSONStorage(() => isNativeApp ? secureAuthStorage : localStorage),
      skipHydration: isNativeApp,
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
        apiEnvironment: state.apiEnvironment,
      }),
      onRehydrateStorage: () => (state, error) => {
        hydrationError = error ?? null
        if (!error) state?.setHydrated()
      },
    }
  )
)

export default useAuthStore
