// App.tsx - Version corrigée
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { startSyncManager } from '@/services/syncService';
import { AppProviders } from '@/providers/AppProviders';
import { useAuthStore } from '@/store/useAuthStore';

function AppContent() {
  const { isLoading } = useAuthStore(); // Supprimer isAuthenticated qui n'est pas utilisé
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    // Attendre la fin du chargement initial
    if (!isLoading) {
      // Petit délai pour la stabilisation
      const timer = setTimeout(() => setShowApp(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!showApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Chargement de votre session...</p>
        </div>
      </div>
    );
  }

  return <AppRoutes />;
}

function App() {
  useEffect(() => {
    startSyncManager();
  }, []);

  return (
    <BrowserRouter>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </BrowserRouter>
  );
}

export default App;