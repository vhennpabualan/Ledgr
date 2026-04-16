import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../api/public',
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
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
