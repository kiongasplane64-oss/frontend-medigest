import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';

interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc: string;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

export const useAuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isLoading, isSuperAdmin } = useAuthStore();
  
  const isRedirecting = useRef(false);
  const lastRedirectPath = useRef<string>('');
  const redirectCount = useRef<Map<string, number>>(new Map());
  
  // On ne garde que l'état de chargement
  const [checkingService, setCheckingService] = useState(false);

  /**
   * Vérification robuste du rôle
   */
  const isSuperAdminUser = (): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || isSuperAdmin();
  };

  /**
   * Vérifie si l'utilisateur est un vendeur
   */
  const isSeller = (): boolean => {
    if (!user) return false;
    return user.role === 'seller' || user.role === 'vendeur';
  };

  /**
   * Vérifie si l'utilisateur est un admin (propriétaire)
   */
  const isAdminUser = (): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'owner' || user.role === 'pharmacy_admin';
  };

  /**
   * Vérifie si l'utilisateur a besoin d'un abonnement
   * Seuls les propriétaires (admin) ont besoin d'un abonnement actif
   */
  const needsSubscription = (): boolean => {
    if (!user) return false;
    // Les vendeurs n'ont pas besoin d'abonnement
    if (isSeller()) return false;
    // Les super admins n'ont pas besoin d'abonnement
    if (user.role === 'super_admin') return false;
    // Les admins (propriétaires) ont besoin d'un abonnement
    return true;
  };

  /**
   * Vérifie si la pharmacie est en service et stocke le résultat
   */
  const checkPharmacyService = async (pharmacyId: string): Promise<boolean> => {
    try {
      const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
      const status = response.data;
      
      // Stocker le statut dans le sessionStorage pour les composants qui en ont besoin (ex: page OutOfService)
      sessionStorage.setItem('service_status', JSON.stringify(status));
      
      return status.in_service;
    } catch (err) {
      console.error('Erreur lors de la vérification du service:', err);
      return true; // Sécurité : on laisse passer en cas d'erreur API
    }
  };

  /**
   * Détermine la destination logique selon le profil et le statut du service
   */
  const getTargetRoute = async (): Promise<string> => {
    // 🔥 Les vendeurs ont leur propre route, pas de vérifications supplémentaires
    if (isSeller()) {
      return '/vendor-pos';
    }
    
    if (isSuperAdminUser()) {
      return '/super-admin';
    }
    
    const pharmacyId = user?.pharmacy_id || user?.tenant_id;
    
    // Vérification du service uniquement pour les admins
    if (pharmacyId && !checkingService && isAdminUser()) {
      setCheckingService(true);
      try {
        const inService = await checkPharmacyService(pharmacyId);
        if (!inService) {
          const token = localStorage.getItem('access_token');
          sessionStorage.setItem('pending_user', JSON.stringify(user));
          if (token) sessionStorage.setItem('pending_token', token);
          return '/out-of-service';
        }
      } finally {
        setCheckingService(false);
      }
    }
    
    // Vérification de l'abonnement uniquement pour les admins
    if (needsSubscription() && !user?.has_subscription) {
      return '/subscription';
    }
    
    return '/dashboard';
  };

  /**
   * Validation stricte des accès par chemin
   */
  const hasAccessToRoute = (path: string): boolean => {
    const isSuper = isSuperAdminUser();
    const isSellerUser = isSeller();
    const absolutePublic = ['/login', '/superadmin-welcome', '/verify-otp', '/out-of-service'];
    
    if (absolutePublic.includes(path)) return true;

    if (isSuper) {
      return path.startsWith('/super-admin');
    }

    if (path.startsWith('/super-admin')) {
      return false;
    }

    // 🔥 Les vendeurs ne peuvent accéder qu'à /vendor-pos et ses sous-routes
    if (isSellerUser) {
      return path.startsWith('/vendor-pos');
    }

    if (path === '/subscription' && !needsSubscription()) {
      return false;
    }

    if (path === '/subscription' || path === '/out-of-service') {
      return true;
    }

    return user?.has_subscription === true || !needsSubscription();
  };

  useEffect(() => {
    // Verrous de sécurité
    if (isLoading || isRedirecting.current || checkingService || !isAuthenticated || !user) {
      return;
    }

    const currentPath = location.pathname;
    
    const executeRedirect = async () => {
      // Cas spécifique : déjà sur la page hors-service
      if (currentPath === '/out-of-service') {
        const pharmacyId = user?.pharmacy_id || user?.tenant_id;
        if (pharmacyId && isAdminUser()) {
          const inService = await checkPharmacyService(pharmacyId);
          if (inService) {
            const target = (needsSubscription() && !user?.has_subscription) ? '/subscription' : '/dashboard';
            navigate(target, { replace: true });
          }
        }
        return;
      }

      const targetRoute = await getTargetRoute();
      
      // Éviter redirection si déjà sur la bonne route
      if (currentPath === targetRoute) return;
      if (isSuperAdminUser() && currentPath.startsWith('/super-admin')) return;
      if (isSeller() && currentPath.startsWith('/vendor-pos')) return;

      // Protection boucles
      const attempts = redirectCount.current.get(currentPath) || 0;
      if (attempts >= 3) {
        console.error(`🚨 Boucle détectée sur ${currentPath}.`);
        return;
      }

      // Si l'accès actuel est valide, on ne fait rien
      if (hasAccessToRoute(currentPath)) {
        redirectCount.current.delete(currentPath);
        return;
      }

      if (lastRedirectPath.current === targetRoute) return;

      console.log(`🔀 Redirection : ${currentPath} -> ${targetRoute}`);
      
      redirectCount.current.set(currentPath, attempts + 1);
      isRedirecting.current = true;
      lastRedirectPath.current = targetRoute;
      
      navigate(targetRoute, { replace: true });
      
      const timer = setTimeout(() => {
        isRedirecting.current = false;
      }, 500);

      const cleanupTimer = setTimeout(() => {
        redirectCount.current.delete(currentPath);
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(cleanupTimer);
      };
    };
    
    executeRedirect();
    
  }, [isAuthenticated, user, isLoading, location.pathname, navigate]);
  
  return { checkingService };
};