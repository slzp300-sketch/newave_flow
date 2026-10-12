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
      includeAssets: ['apple-touch-icon.png', 'brand/*.svg', 'brand/*.jpg', 'fonts/*.woff2'],
      manifest: {
        name: 'Newave Flow',
        short_name: 'NewaveFlow',
        description: '뉴웨이브 청소년부 교사 공간',
        theme_color: '#10364B',
        background_color: '#F5F8FA',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
