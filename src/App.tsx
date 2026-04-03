// App.tsx
import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { startSyncManager } from '@/services/syncService';
import { AppProviders } from '@/providers/AppProviders'; // ← AJOUT

function App() {
  useEffect(() => {
    startSyncManager();
  }, []);

  return (
    <BrowserRouter>
      <AppProviders>  {/* ← ENCAPSULEZ AppRoutes */}
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}

export default App;