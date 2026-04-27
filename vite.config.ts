import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Fonction de debug pour afficher la mémoire
function logMemoryUsage(step: string): void {
  const used = process.memoryUsage();
  console.log(`[MEMORY DEBUG - ${step}]`, {
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(used.external / 1024 / 1024)} MB`
  });
}

// Plugin pour monitorer la mémoire pendant le build
function memoryMonitorPlugin(): Plugin {
  let interval: NodeJS.Timeout | null = null;
  return {
    name: 'memory-monitor',
    buildStart() {
      logMemoryUsage('Build Start');
      // Surveiller la mémoire toutes les 5 secondes
      interval = setInterval(() => {
        logMemoryUsage('During Build');
      }, 5000);
    },
    buildEnd() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      logMemoryUsage('Build End');
    },
    handleHotUpdate({ file }) {
      console.log(`[HMR] File changed: ${file}`);
      logMemoryUsage('Hot Update');
      return undefined;
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    memoryMonitorPlugin()  // Plugin de debug mémoire
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: false,
      interval: 1000
    },
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
        rewrite: (pathUrl: string) => pathUrl.replace(/^\/api/, '')
      }
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,  // Temporairement true pour debug
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Debug: log les gros modules
          if (id.includes('node_modules')) {
            const moduleName = id.split('node_modules/').pop()?.split('/')[0];
            if (moduleName === 'recharts' || moduleName === 'lucide-react') {
              console.log(`[CHUNK DEBUG] Processing large module: ${moduleName}`);
            }
          }
          
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
          return undefined;
        },
      },
    },
  },
  
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
    exclude: ['workbox-window', 'workbox-core', 'workbox-routing']
  },
  
  base: '/',
  
  // Configuration de debug supplémentaire
  logLevel: 'info',
  clearScreen: false,  // Garder les logs visibles
  
  // Option pour limiter l'usage mémoire
  cacheDir: 'node_modules/.vite-debug',  // Dossier cache séparé pour debug
})