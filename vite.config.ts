import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages(https://<user>.github.io/life-supporter/)向けに、
// ビルド時のみサブパスを base にする。リポジトリ名を変える場合はここを合わせる。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/life-supporter/' : '/',
  plugins: [
    react(),
    VitePWA({
      // 更新は自動リロードせず、通知バー経由でユーザーが適用する(入力中の予期せぬリロードを防ぐ)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'life-supporter',
        short_name: 'life-supporter',
        description: 'メモと単価計算で日常を支援するローカルファーストPWA',
        lang: 'ja',
        display: 'standalone',
        start_url: '.',
        theme_color: '#FAF6F0',
        background_color: '#FAF6F0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 一度表示した地図タイルはオフラインでも再表示できるようにする。
        // OSM の利用規約により、まだ見ていない範囲を先読みすることはしない。
        // maxEntries の上限は、タイルがストレージを圧迫して
        // メモ本体ごと iOS Safari の削除対象になるのを避けるため
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
}))
