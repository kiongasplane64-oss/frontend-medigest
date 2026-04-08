import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
//import { registerSW } from 'virtual:pwa-register'
// 1. Importer les outils de TanStack Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 2. Créer une instance du QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Les données sont considérées comme fraîches pendant 5 min
      retry: 1, // Réessayer une fois en cas d'échec
      refetchOnWindowFocus: false, // Ne pas recharger dès qu'on change d'onglet
    },
  },
})

// Met à jour automatiquement l'app quand une nouvelle version est dispo
//registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 3. Envelopper l'application avec le Provider */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)