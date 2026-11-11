import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import App from './App'
import './index.css'
import useAuthStore, { assertAuthHydrated } from './store/authStore'
import { isNativeApp, nativePlatform, flushAuthStorage } from './native/platform'

async function prepare() {
  if (isNativeApp) {
    document.documentElement.dataset.nativePlatform = nativePlatform
    await useAuthStore.persist.rehydrate()
    assertAuthHydrated()
    await flushAuthStorage()
  }
  // 개발 환경에서도 실제 백엔드 명세와 연동하기 위해 MSW 비활성화
  // if (import.meta.env.DEV) {
  //   const { worker } = await import('./mocks/browser')
  //   await worker.start({ onUnhandledRequest: 'bypass' })
  // }
}

prepare().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  )
}).catch(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">로그인 정보를 불러오지 못했습니다</h1>
      <p>휴대폰 잠금을 해제한 뒤 다시 시도해 주세요.</p>
      <button className="px-5 py-3 bg-primary-600 text-white" onClick={() => window.location.reload()}>다시 시도</button>
    </main>
  )
})
