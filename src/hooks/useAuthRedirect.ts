// hooks/useAuthRedirect.ts
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

export const useAuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isLoading, isSuperAdmin } = useAuthStore();
  
  const isRedirecting = useRef(false);
  const lastRedirectPath = useRef<string>('');
  const redirectCount = useRef<Map<string, number>>(new Map());

  // Vérification robuste du rôle
  const isSuperAdminUser = (): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || isSuperAdmin();
  };

  /**
   * Détermine la destination logique selon le profil
   */
  const getTargetRoute = (): string => {
    if (isSuperAdminUser()) {
      return '/super-admin';
    }
    if (!user?.has_subscription) {
      return '/subscription';
    }
    return '/dashboard';
  };

  /**
   * Validation stricte des accès par chemin
   */
  const hasAccessToRoute = (path: string): boolean => {
    const isSuper = isSuperAdminUser();
    
    // 1. Exceptions absolues (Auth de base et Welcome)
    const absolutePublic = ['/login', '/superadmin-welcome', '/verify-otp', '/out-of-service'];
    if (absolutePublic.includes(path)) return true;

    // 2. Logique spécifique Super Admin
    if (isSuper) {
      // ✅ Correction : Autoriser aussi /super-admin et ses sous-routes
      // Mais NE PAS rediriger si on est déjà sur une route super-admin valide
      if (path.startsWith('/super-admin')) {
        return true;
      }
      // Si super admin mais pas sur route super-admin, on redirigera
      return false;
    }

    // 3. Logique spécifique Utilisateur Standard
    if (path.startsWith('/super-admin')) {
      return false;
    }

    if (path === '/subscription') {
      return true;
    }

    return user?.has_subscription === true;
  };

  useEffect(() => {
    // 1. Verrous de sécurité initiaux
    if (isLoading || isRedirecting.current) {
      return;
    }

    // ✅ Important : Ne pas rediriger si pas authentifié
    if (!isAuthenticated || !user) {
      return;
    }

    const currentPath = location.pathname;

    // ✅ Éviter la redirection si déjà sur la bonne route
    const targetRoute = getTargetRoute();
    
    // Si on est déjà sur la route cible, ne rien faire
    if (currentPath === targetRoute) {
      return;
    }

    // ✅ Pour les super admins : autoriser toutes les routes commençant par /super-admin
    if (isSuperAdminUser() && currentPath.startsWith('/super-admin')) {
      return;
    }

    // 2. Protection contre les boucles infinies
    const attempts = redirectCount.current.get(currentPath) || 0;
    if (attempts >= 3) {
      console.error(`🚨 Boucle détectée sur ${currentPath}. Redirection stoppée.`);
      return;
    }

    // 3. Si l'accès est valide, on ne redirige pas
    if (hasAccessToRoute(currentPath)) {
      if (redirectCount.current.has(currentPath)) {
        redirectCount.current.delete(currentPath);
      }
      return;
    }

    // 4. Éviter de rediriger vers la même erreur
    if (lastRedirectPath.current === targetRoute) {
      return;
    }

    console.log(`🔀 Redirection : ${currentPath} -> ${targetRoute} (Rôle: ${user.role})`);
    
    // Mise à jour des compteurs et états
    redirectCount.current.set(currentPath, attempts + 1);
    isRedirecting.current = true;
    lastRedirectPath.current = targetRoute;
    
    navigate(targetRoute, { replace: true });
    
    // Libération du verrou après navigation
    const timer = setTimeout(() => {
      isRedirecting.current = false;
    }, 500);

    // Nettoyage automatique des compteurs d'erreurs après 5s
    const cleanupTimer = setTimeout(() => {
      redirectCount.current.delete(currentPath);
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(cleanupTimer);
    };
    
  }, [isAuthenticated, user, isLoading, location.pathname, navigate, isSuperAdmin]);
  
  return null;
};