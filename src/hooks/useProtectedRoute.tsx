// hooks/useProtectedRoute.ts
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

export const useProtectedRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isSuperAdmin, isLoading } = useAuthStore();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Attendre que le chargement soit terminé
    if (isLoading) return;

    // Si non authentifié et pas sur une route publique
    if (!isAuthenticated) {
      const publicRoutes = ['/login', '/register', '/forgot-password'];
      if (!publicRoutes.includes(location.pathname)) {
        console.log('🔐 Non authentifié, redirection vers login');
        navigate('/login', { replace: true });
      }
      return;
    }

    // Si authentifié mais déjà redirigé, éviter les boucles
    if (hasRedirected.current) return;

    const userRole = user?.role;
    const isSuperAdminUser = userRole === 'super_admin' || isSuperAdmin();
    const currentPath = location.pathname;

    console.log('🔍 [ProtectedRoute] Vérification:', {
      currentPath,
      userRole,
      isSuperAdminUser,
      hasSubscription: user?.has_subscription
    });

    // Cas 1: Super Admin
    if (isSuperAdminUser) {
      // Si sur une route non Super Admin, rediriger vers /super-admin
      if (!currentPath.startsWith('/super-admin') && currentPath !== '/superadmin-welcome') {
        console.log('🚀 Super Admin sur route non autorisée, redirection vers /super-admin');
        hasRedirected.current = true;
        navigate('/super-admin', { replace: true });
        setTimeout(() => {
          hasRedirected.current = false;
        }, 1000);
      }
      return;
    }

    // Cas 2: Utilisateur standard sans abonnement
    if (!user?.has_subscription) {
      // Si pas sur /subscription, rediriger
      if (currentPath !== '/subscription') {
        console.log('🚀 Utilisateur sans abonnement, redirection vers /subscription');
        hasRedirected.current = true;
        navigate('/subscription', { replace: true });
        setTimeout(() => {
          hasRedirected.current = false;
        }, 1000);
      }
      return;
    }

    // Cas 3: Utilisateur standard avec abonnement
    if (user?.has_subscription) {
      // Si sur /subscription, rediriger vers /dashboard
      if (currentPath === '/subscription') {
        console.log('🚀 Utilisateur avec abonnement sur /subscription, redirection vers /dashboard');
        hasRedirected.current = true;
        navigate('/dashboard', { replace: true });
        setTimeout(() => {
          hasRedirected.current = false;
        }, 1000);
        return;
      }
      
      // Si sur une route Super Admin, rediriger vers /dashboard
      if (currentPath.startsWith('/super-admin') || currentPath === '/superadmin-welcome') {
        console.log('🚀 Utilisateur standard sur route Super Admin, redirection vers /dashboard');
        hasRedirected.current = true;
        navigate('/dashboard', { replace: true });
        setTimeout(() => {
          hasRedirected.current = false;
        }, 1000);
        return;
      }
    }

  }, [isAuthenticated, user, location.pathname, isLoading, navigate, isSuperAdmin]);
};