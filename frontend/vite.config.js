import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      workbox: { clientsClaim: true },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Newave Flow',
        short_name: 'NewaveFlow',
        description: '교회 교육부 교사 관리 시스템',
        theme_color: '#3D5AFE',
        background_color: '#F5F7FA',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
