import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],  // Plus de VitePWA
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000/api/v1',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:8000/api/v1',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor'
            }
            if (id.includes('lucide-react') || id.includes('sonner') || id.includes('recharts')) {
              return 'ui-vendor'
            }
            return 'vendor'
          }
        },
      },
    },
  },
  
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-router-dom', '@tanstack/react-query',
      'lucide-react', 'sonner', 'recharts', 'date-fns', 'zustand', 'mobx', 'mobx-react-lite'
    ],
    exclude: ['workbox-window', 'workbox-core', 'workbox-routing']  // Peut aussi supprimer cette ligne
  },
  
  base: '/',
})