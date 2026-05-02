// services/routingService.ts - Version simplifiée sans double attente
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscription } from '@/hooks/useSubscription';

export type UserRole = 'super_admin' | 'admin' | 'seller' | 'vendeur';

export interface RoutingDecision {
  shouldRedirect: boolean;
  targetPath: string | null;
  reason: string;
}

export const ROUTE_CONFIG = {
  public: ['/login', '/register', '/forgot-password', '/verify-otp', '/out-of-service'] as const,
  subscription: ['/subscription', '/payment', '/payment-success', '/activate-code'] as const,
  roleDefaults: {
    super_admin: '/super-admin',
    admin: '/dashboard',
    seller: '/vendor-pos',
    vendeur: '/vendor-pos',
    default: '/dashboard',
  },
  roleAllowedRoutes: {
    super_admin: ['/super-admin', '/superadmin-welcome'],
    admin: ['/dashboard', '/settings', '/stock', '/inventaire', '/transfers', '/returns', '/monitoring', '/finance', '/capital', '/expenses', '/profits', '/suppliers', '/clients', '/users', '/reports', '/factures', '/historique', '/rapports'],
    seller: ['/vendor-pos', '/vendor-pos/stock-report'],
  },
} as const;

type PublicRoute = typeof ROUTE_CONFIG.public[number];
type SubscriptionRoute = typeof ROUTE_CONFIG.subscription[number];

export class RoutingService {
  private static instance: RoutingService;
  private redirectInProgress = false;
  private lastRedirectTime = 0;
  private redirectCount = 0;

  static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService();
    }
    return RoutingService.instance;
  }

  canRedirect(targetPath: string, currentPath: string): boolean {
    const now = Date.now();
    
    if (targetPath === currentPath) return false;
    
    if (this.redirectCount >= 5 && (now - this.lastRedirectTime) < 10000) {
      console.warn('[Routing] Blocage temporaire: trop de redirections');
      return false;
    }
    
    if (this.redirectInProgress && (now - this.lastRedirectTime) < 500) {
      return false;
    }
    
    return true;
  }

  recordRedirect(_targetPath: string) {
    this.redirectInProgress = true;
    this.lastRedirectTime = Date.now();
    this.redirectCount++;
    
    setTimeout(() => {
      this.redirectInProgress = false;
    }, 2000);
    
    setTimeout(() => {
      this.redirectCount = 0;
    }, 10000);
  }

  reset() {
    this.redirectInProgress = false;
    this.redirectCount = 0;
    this.lastRedirectTime = 0;
  }

  private isPublicRoute(path: string): path is PublicRoute {
    return (ROUTE_CONFIG.public as readonly string[]).includes(path);
  }

  private isSubscriptionRoute(path: string): path is SubscriptionRoute {
    return (ROUTE_CONFIG.subscription as readonly string[]).includes(path);
  }

  determineRoute(
    isAuthenticated: boolean,
    user: any | null,
    currentPath: string,
    subscriptionInfo: {
      hasActiveSubscription: boolean;
      isTrial: boolean;
      trialDaysRemaining: number;
      isLoading: boolean;
    }
  ): RoutingDecision {
    // Si encore en chargement, ne pas rediriger
    if (subscriptionInfo.isLoading) {
      return { shouldRedirect: false, targetPath: null, reason: 'chargement_abonnement' };
    }

    // 1. Non authentifié
    if (!isAuthenticated || !user) {
      if (!this.isPublicRoute(currentPath)) {
        return {
          shouldRedirect: true,
          targetPath: '/login',
          reason: 'non_authentifie',
        };
      }
      return { shouldRedirect: false, targetPath: null, reason: 'public_route' };
    }

    // 2. Période d'essai active
    if (subscriptionInfo.isTrial && subscriptionInfo.trialDaysRemaining > 0) {
      const userRole = this.getNormalizedRole(user.role);
      const allowedRoutes = ROUTE_CONFIG.roleAllowedRoutes[userRole as keyof typeof ROUTE_CONFIG.roleAllowedRoutes] || [];
      const isAllowed = allowedRoutes.some(route => currentPath.startsWith(route)) || 
                        this.isPublicRoute(currentPath) ||
                        this.isSubscriptionRoute(currentPath);
      
      if (!isAllowed && currentPath !== '/') {
        const defaultRoute = ROUTE_CONFIG.roleDefaults[userRole as keyof typeof ROUTE_CONFIG.roleDefaults] || ROUTE_CONFIG.roleDefaults.default;
        return {
          shouldRedirect: true,
          targetPath: defaultRoute,
          reason: `route_non_autorisee_trial`,
        };
      }
      return { shouldRedirect: false, targetPath: null, reason: 'trial_actif' };
    }

    // 3. Super Admin
    if (user.role === 'super_admin') {
      if (!currentPath.startsWith('/super-admin') && currentPath !== '/superadmin-welcome') {
        return {
          shouldRedirect: true,
          targetPath: '/super-admin',
          reason: 'super_admin_redirect',
        };
      }
      return { shouldRedirect: false, targetPath: null, reason: 'super_admin_route_valide' };
    }

    // 4. Vérification de l'abonnement
    const hasValidSubscription = subscriptionInfo.hasActiveSubscription === true;
    const isSubscriptionRoute = this.isSubscriptionRoute(currentPath);
    const isPublicRoute = this.isPublicRoute(currentPath);
    
    if (!hasValidSubscription && !isSubscriptionRoute && !isPublicRoute) {
      return {
        shouldRedirect: true,
        targetPath: '/subscription',
        reason: 'pas_dabonnement',
      };
    }

    // 5. Route subscription avec abonnement actif
    if (hasValidSubscription && currentPath === '/subscription') {
      const userRole = this.getNormalizedRole(user.role);
      const defaultRoute = ROUTE_CONFIG.roleDefaults[userRole as keyof typeof ROUTE_CONFIG.roleDefaults] || ROUTE_CONFIG.roleDefaults.default;
      return {
        shouldRedirect: true,
        targetPath: defaultRoute,
        reason: 'abonnement_actif_redirect',
      };
    }

    // 6. Vérification des permissions de rôle
    const userRole = this.getNormalizedRole(user.role);
    const allowedRoutes = ROUTE_CONFIG.roleAllowedRoutes[userRole as keyof typeof ROUTE_CONFIG.roleAllowedRoutes] || [];
    const isRouteAllowed = allowedRoutes.some(route => currentPath.startsWith(route)) ||
                          isPublicRoute ||
                          isSubscriptionRoute;

    if (!isRouteAllowed && currentPath !== '/') {
      const defaultRoute = ROUTE_CONFIG.roleDefaults[userRole as keyof typeof ROUTE_CONFIG.roleDefaults] || ROUTE_CONFIG.roleDefaults.default;
      return {
        shouldRedirect: true,
        targetPath: defaultRoute,
        reason: `role_non_autorise`,
      };
    }

    return { shouldRedirect: false, targetPath: null, reason: 'ok' };
  }

  private getNormalizedRole(role: string): UserRole {
    if (role === 'super_admin') return 'super_admin';
    if (role === 'seller' || role === 'vendeur') return 'seller';
    return 'admin';
  }
}

// Hook unifié simplifié
export function useUnifiedRouting() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuthStore();
  const { 
    hasActiveSubscription, 
    isTrial, 
    trialDaysRemaining, 
    isLoading: isSubLoading 
  } = useSubscription();
  
  const routingService = RoutingService.getInstance();
  const redirectExecuted = useRef(false);

  // Logique de redirection
  useEffect(() => {
    // Attendre l'auth ET l'abonnement
    if (isAuthLoading || isSubLoading) return;
    
    // Éviter les redirections multiples
    if (redirectExecuted.current) return;

    const currentPath = location.pathname;
    
    const decision = routingService.determineRoute(
      isAuthenticated,
      user,
      currentPath,
      { hasActiveSubscription, isTrial, trialDaysRemaining, isLoading: isSubLoading }
    );

    if (decision.shouldRedirect && decision.targetPath) {
      if (routingService.canRedirect(decision.targetPath, currentPath)) {
        console.log(`[Routing] ${decision.reason}: ${currentPath} → ${decision.targetPath}`);
        routingService.recordRedirect(decision.targetPath);
        redirectExecuted.current = true;
        
        navigate(decision.targetPath, { replace: true });
        
        // Réinitialiser après la navigation
        setTimeout(() => {
          redirectExecuted.current = false;
        }, 500);
      }
    } else {
      // Réinitialiser le flag si on est sur une route valide
      redirectExecuted.current = false;
    }
  }, [isAuthLoading, isSubLoading, isAuthenticated, user, location.pathname, hasActiveSubscription, isTrial, trialDaysRemaining, navigate, routingService]);

  return {
    isReady: !isAuthLoading && !isSubLoading,
  };
}

export default useUnifiedRouting;