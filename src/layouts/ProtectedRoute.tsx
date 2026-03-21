import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ requireSuperAdmin = false }: { requireSuperAdmin?: boolean }) => {
  const { token, isLoading, isSuperAdmin } = useAuthStore();
  const location = useLocation();

  // 1. Attendre que Zustand ait fini de charger les données du localStorage
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-red-500 mb-4" size={40} />
        <p className="text-gray-400 text-sm">Chargement de la session...</p>
      </div>
    );
  }

  // 2. Si aucun token n'est trouvé après chargement, redirection vers login
  if (!token) {
    // On sauvegarde l'endroit où l'utilisateur voulait aller (state)
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Protection spécifique pour les routes Super Admin
  if (requireSuperAdmin && !isSuperAdmin()) {
    console.warn("Accès refusé : Tentative d'accès Super Admin sans les droits requis.");
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};