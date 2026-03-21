// components/ProtectedRoute.tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'super_admin' | 'admin' | 'user';
  requireSubscription?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requiredRole, 
  requireSubscription = false 
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, isLoading, isSuperAdmin } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Vérification du rôle
  if (requiredRole === 'super_admin') {
    const hasSuperAdminRole = user?.role === 'super_admin' || isSuperAdmin();
    if (!hasSuperAdminRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Vérification de l'abonnement (sauf pour super admin)
  if (requireSubscription && user?.role !== 'super_admin' && !isSuperAdmin()) {
    if (!user?.has_subscription) {
      return <Navigate to="/subscription" replace />;
    }
  }

  return <>{children}</>;
};