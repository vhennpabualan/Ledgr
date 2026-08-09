import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      devOptions: {
        // SW disabled in dev: stops Workbox from intercepting Vite module requests
        // and flooding the console with 'Precaching did not find a match' / 'No route
        // found' logs. Production builds still get the full service worker (globPatterns
        // is gated on NODE_ENV below). Re-enable only if you need offline/PWA testing in dev.
        enabled: false,
        type: 'module',
        suppressWarnings: true,
      },
      manifest: {
        name: 'Ledgr',
        short_name: 'Ledgr',
        description: 'Personal finance tracker',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: process.env.NODE_ENV === 'production'
          ? ['**/*.{js,css,html,ico,png,svg,woff2}']
          : [],
        runtimeCaching: [
          {
            // GET API calls — serve cache instantly, revalidate in background
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-get-cache-v2',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 }, // 1h — don't serve 24h-stale data after a backend move
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Fallback for same-origin /api (dev proxy)
            urlPattern: /^\/api\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-get-cache-local-v2',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Injected at build time from package.json — bump "version" there to update
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — changes rarely, long cache life
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts lib is large — isolate so app code changes don't bust this cache
          'vendor-charts': ['recharts'],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
          // HTTP client
          'vendor-axios': ['axios'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
