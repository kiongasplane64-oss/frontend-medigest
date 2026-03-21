// layouts/MainLayout.tsx
import { Outlet } from 'react-router-dom';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useAuthStore } from '@/store/useAuthStore';

export const MainLayout = () => {
  // Hook centralisé pour les redirections
  useAuthRedirect();
  
  const { isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
      </div>
    );
  }
  
  return <Outlet />;
};