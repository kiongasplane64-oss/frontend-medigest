import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'MediGest Pro',
        short_name: 'MediGest',
        description: 'Application de gestion pharmaceutique',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      devOptions: {
        enabled: false // Désactiver en développement
      }
    })
  ],
  
  // Configuration des alias - CE QUI MANQUAIT
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // Configuration du serveur
  server: {
    port: 5173,
    host: true, // Expose sur le réseau
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    },
  },
  
  // Configuration du build - CORRIGÉE
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Regrouper les vendors React
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
            // Autres vendors
            return 'vendor'
          }
        },
      },
    },
  },
  
  // Optimisation des dépendances
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
      'sonner',
      'recharts',
      'date-fns',
      'zustand',
      'mobx',
      'mobx-react-lite'
    ],
    exclude: []
  },
  
  // CSS - Optionnel, commentez si vous n'utilisez pas SCSS
  // css: {
  //   preprocessorOptions: {
  //     scss: {
  //       additionalData: `@import "@/styles/variables.scss";`
  //     }
  //   }
  // },
  
  // Base URL pour le déploiement
  base: '/',
})