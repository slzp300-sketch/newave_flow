import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { isNativeApp, secureAuthStorage } from '../native/platform'
import { validAuthIdentity } from '../auth/authIdentity'

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
      authIdentity: null,
      appleCheckPaused: false,
      setAppleCheckPaused: appleCheckPaused => set({ appleCheckPaused }),

      isHydrated: false,

      setAuth: (user, accessToken, refreshToken, apiEnvironment = 'production', authIdentity = null) =>
        set({ user, accessToken, refreshToken, apiEnvironment, authIdentity: validAuthIdentity(authIdentity) ? authIdentity : null }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, apiEnvironment: 'production', authIdentity: null }),

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
        authIdentity: validAuthIdentity(state.authIdentity) ? state.authIdentity : null,
      }),
      onRehydrateStorage: () => (state, error) => {
        hydrationError = error ?? null
        if (!error) state?.setHydrated()
      },
    }
  )
)

export default useAuthStore
