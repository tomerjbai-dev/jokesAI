import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vitest/config'
import vercelConfig from './vercel.json' with { type: 'json' }

// The response headers live in vercel.json; `npm run preview` sends the same ones.
const securityHeaders = Object.fromEntries(vercelConfig.headers[0].headers.map(({ key, value }) => [key, value]))

// Content Security Policy as a <meta> tag in production builds only: Vite's dev server (also under
// `vercel dev`) needs inline scripts and styles for HMR. frame-ancestors is not allowed in a meta
// CSP, so framing is blocked by the X-Frame-Options header instead.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
  ],
})

export default defineConfig({
  preview: { headers: securityHeaders },
  plugins: [
    react(),
    cspMeta(),
    // The service worker exists only in production builds (no devOptions), so test it with build + preview.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'בדיחומט',
        short_name: 'בדיחומט',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#0F0E0D',
        background_color: '#0F0E0D',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only: never cache /api/* or jokes.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Vitest empties CSS by default; the contrast test reads the real color tokens.
    css: { include: [/tokens\.css/] },
  },
})
