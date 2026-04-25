import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import App from './App'
import './index.css'

async function prepare() {
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
})