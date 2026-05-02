// layouts/MainLayout.tsx
import { Outlet } from 'react-router-dom';
import { useUnifiedRouting } from '@/services/routingService';
import { useAuthStore } from '@/store/useAuthStore';

export const MainLayout = () => {
  // Hook centralisé pour les redirections
  const { isReady } = useUnifiedRouting();
  
  const { isLoading: isAuthLoading } = useAuthStore();
  
  // Attendre que l'auth ET le routing soient prêts
  if (isAuthLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
      </div>
    );
  }
  
  return <Outlet />;
};