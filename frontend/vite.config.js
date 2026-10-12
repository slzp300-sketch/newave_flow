import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { primary, neutral } from './brand-theme.js'

export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      disable: mode === 'native',
      registerType: 'prompt',
      injectRegister: false,
      workbox: { clientsClaim: true },
      includeAssets: ['apple-touch-icon.png', 'brand/*.svg', 'brand/*.jpg', 'brand/*.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Newave Flow',
        short_name: 'NewaveFlow',
        description: '뉴웨이브 청소년부 교사 공간',
        theme_color: primary[600],
        background_color: neutral[50],
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
}))
