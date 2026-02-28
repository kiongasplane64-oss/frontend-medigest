import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import { startSyncManager } from '@/services/syncService';

function App() {
  // Initialisation du gestionnaire de synchronisation offline
  useEffect(() => {
    startSyncManager();
  }, []);

  return (
    <BrowserRouter>
      {/* AppRoutes contient déjà toute la logique de Switch, Login et Dashboard */}
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;