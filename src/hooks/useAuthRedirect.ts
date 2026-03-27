// hooks/useAuthRedirect.ts
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [checkingService, setCheckingService] = useState(false);

  // Vérification robuste du rôle
  const isSuperAdminUser = (): boolean => {
    if (!user) return false;
    return user.role === 'super_admin' || isSuperAdmin();
  };

  /**
   * Vérifie si la pharmacie est en service
   */
  const checkPharmacyService = async (pharmacyId: string): Promise<boolean> => {
    try {
      const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
      const status = response.data;
      setServiceStatus(status);
      
      // Stocker le statut dans le sessionStorage pour le conserver
      sessionStorage.setItem('service_status', JSON.stringify(status));
      
      return status.in_service;
    } catch (err) {
      console.error('Erreur lors de la vérification du service:', err);
      // En cas d'erreur réseau, on autorise l'accès par sécurité
      return true;
    }
  };

  /**
   * Détermine la destination logique selon le profil et le statut du service
   */
  const getTargetRoute = async (): Promise<string> => {
    if (isSuperAdminUser()) {
      return '/super-admin';
    }
    
    // Vérifier d'abord le statut du service si l'utilisateur a une pharmacie
    const pharmacyId = user?.pharmacy_id || user?.tenant_id;
    if (pharmacyId && !checkingService) {
      setCheckingService(true);
      try {
        const inService = await checkPharmacyService(pharmacyId);
        if (!inService) {
          // Stocker l'utilisateur et le token pour la page out-of-service
          const token = localStorage.getItem('access_token');
          sessionStorage.setItem('pending_user', JSON.stringify(user));
          if (token) sessionStorage.setItem('pending_token', token);
          return '/out-of-service';
        }
      } finally {
        setCheckingService(false);
      }
    }
    
    // Vérifier l'abonnement
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
      if (path.startsWith('/super-admin')) {
        return true;
      }
      return false;
    }

    // 3. Logique spécifique Utilisateur Standard
    if (path.startsWith('/super-admin')) {
      return false;
    }

    if (path === '/subscription') {
      return true;
    }
    
    if (path === '/out-of-service') {
      return true;
    }

    return user?.has_subscription === true;
  };

  useEffect(() => {
    // 1. Verrous de sécurité initiaux
    if (isLoading || isRedirecting.current || checkingService) {
      return;
    }

    // Ne pas rediriger si pas authentifié
    if (!isAuthenticated || !user) {
      return;
    }

    const currentPath = location.pathname;
    
    // Si on est déjà sur /out-of-service, vérifier si le service est revenu
    if (currentPath === '/out-of-service') {
      const checkAndRedirect = async () => {
        const pharmacyId = user?.pharmacy_id || user?.tenant_id;
        if (pharmacyId) {
          const inService = await checkPharmacyService(pharmacyId);
          if (inService) {
            // Le service est revenu, rediriger vers la destination appropriée
            const targetRoute = user?.has_subscription ? '/dashboard' : '/subscription';
            navigate(targetRoute, { replace: true });
          }
        }
      };
      checkAndRedirect();
      return;
    }

    // Éviter la redirection si déjà sur la bonne route
    const executeRedirect = async () => {
      const targetRoute = await getTargetRoute();
      
      // Si on est déjà sur la route cible, ne rien faire
      if (currentPath === targetRoute) {
        return;
      }

      // Pour les super admins : autoriser toutes les routes commençant par /super-admin
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
    };
    
    executeRedirect();
    
  }, [isAuthenticated, user, isLoading, location.pathname, navigate, isSuperAdmin, checkingService]);
  
  return null;
};