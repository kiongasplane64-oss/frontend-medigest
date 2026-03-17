// hooks/useSubscription.ts
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Services
import * as subscriptionApi from '@/services/subscriptionService';

// Types (imports explicites avec 'type' pour la distinction)
import type { 
  Plan,
  BillingHistory,
  SubscriptionUsage
} from '@/services/subscriptionService';

import { PLAN_LIMITS } from '@/types/subscription';

// ============================================================================
// TYPES INTERNES
// ============================================================================

export interface SubscriptionUser {
  id: string;
  email: string;
  role?: string;
  plan_name?: string;
  plan_expires_at?: string | null;
  trial_ends_at?: string | null;
  subscription_status?: string;
}

export interface SubscriptionResponse {
  subscription?: {
    id?: string;
    plan_name: string;
    status: string;
    start_date?: string;
    end_date?: string;
    auto_renew?: boolean;
    grace_period_end?: string;
    max_products?: number | "Illimité";
    current_usage?: number;
    price?: number;
    currency?: string;
    billing_cycle?: string;
  };
  can_access?: boolean;
  message?: string;
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  invoice_url?: string;
}

export interface SubscriptionPlan extends Plan {
  is_popular?: boolean;
  description?: string;
}

// ============================================================================
// CLÉS DE CACHE REACT QUERY
// ============================================================================

export const subscriptionKeys = {
  all: ['subscription'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  usage: () => [...subscriptionKeys.all, 'usage'] as const,
  billing: () => [...subscriptionKeys.all, 'billing'] as const,
} as const;

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export const useSubscription = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Store
  const user = useAuthStore((state) => state.user) as SubscriptionUser | null;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  // State local
  const [expiryWarning, setExpiryWarning] = useState<{
    show: boolean;
    days: number | null;
  }>({ show: false, days: null });

  // ========================================
  // REQUÊTES
  // ========================================

  // Abonnement actuel
  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription
  } = useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: async (): Promise<SubscriptionResponse> => {
      const [subscription, usage] = await Promise.all([
        subscriptionApi.getSubscription(),
        subscriptionApi.getSubscriptionUsage()
      ]);
      
      return {
        subscription: {
          ...subscription,
          current_usage: usage.current_products,
          max_products: usage.max_products,
        },
        can_access: subscription.status === 'active' || subscription.status === 'trial',
      };
    },
    enabled: Boolean(isAuthenticated && user?.id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    gcTime: 10 * 60 * 1000, // 10 minutes (remplace cacheTime)
  });

  // Utilisation
  const {
    data: usageData,
    isLoading: usageLoading,
    refetch: refetchUsage
  } = useQuery({
    queryKey: subscriptionKeys.usage(),
    queryFn: (): Promise<SubscriptionUsage> => subscriptionApi.getSubscriptionUsage(),
    enabled: Boolean(isAuthenticated && subscriptionData?.subscription),
    staleTime: 5 * 60 * 1000,
  });

  // Plans disponibles
  const {
    data: availablePlans = [],
    isLoading: plansLoading,
    refetch: refetchPlans
  } = useQuery({
    queryKey: subscriptionKeys.plans(),
    queryFn: (): Promise<SubscriptionPlan[]> => subscriptionApi.getAvailablePlans(),
    enabled: isAuthenticated,
    staleTime: 30 * 60 * 1000, // 30 minutes
    initialData: [],
  });

  // Historique de facturation
  const {
    data: billingHistory = [],
    isLoading: billingLoading,
    refetch: refetchBilling
  } = useQuery({
    queryKey: subscriptionKeys.billing(),
    queryFn: (): Promise<BillingHistory[]> => subscriptionApi.getBillingHistory(),
    enabled: Boolean(isAuthenticated && subscriptionData?.subscription),
    staleTime: 10 * 60 * 1000,
    initialData: [],
  });

  // ========================================
  // MUTATIONS
  // ========================================

  // Changement de plan
  const changePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const plan = availablePlans.find(p => p.id === planId);
      if (!plan) throw new Error('Plan non trouvé');
      
      return subscriptionApi.updateSubscriptionWithPayment(plan);
    },
    onSuccess: (data) => {
      // Invalidation du cache
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.billing() });
      
      // Redirection si nécessaire
      if ('redirect' in data && data.redirect) {
        navigate('/subscription/payment', { 
          state: { plan: data.plan },
          replace: true
        });
      }
    },
  });

  // Annulation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => subscriptionApi.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
    },
  });

  // ========================================
  // MÉMOS & CALCULS
  // ========================================

  // Conversion en invoices
  const invoices = useMemo((): Invoice[] => 
    billingHistory.map(item => ({
      id: item.id,
      date: item.date,
      amount: item.amount,
      currency: item.currency,
      status: item.status as Invoice['status'],
      invoice_url: item.invoice_url,
    })), 
  [billingHistory]);

  // Statut
  const subscriptionStatus = useMemo((): string => {
    if (subscriptionData?.subscription?.status) {
      return subscriptionData.subscription.status;
    }
    return user?.subscription_status || 'inactive';
  }, [subscriptionData, user]);

  // Vérifications expiration
  const checkExpiry = useCallback((): { isExpired: boolean; daysRemaining: number } => {
    if (!user?.plan_expires_at) {
      return { isExpired: true, daysRemaining: 0 };
    }
    
    try {
      const expiry = new Date(user.plan_expires_at).getTime();
      const now = new Date().getTime();
      const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 3600 * 24)));
      
      return {
        isExpired: expiry < now,
        daysRemaining,
      };
    } catch {
      return { isExpired: true, daysRemaining: 0 };
    }
  }, [user?.plan_expires_at]);

  // Trial
  const trialInfo = useMemo(() => {
    if (!user?.trial_ends_at) {
      return { isTrial: false, daysRemaining: 0 };
    }
    
    try {
      const trialEnd = new Date(user.trial_ends_at).getTime();
      const now = new Date().getTime();
      const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 3600 * 24)));
      
      return {
        isTrial: trialEnd > now,
        daysRemaining,
      };
    } catch {
      return { isTrial: false, daysRemaining: 0 };
    }
  }, [user?.trial_ends_at]);

  // Période de grâce
  const gracePeriodInfo = useMemo(() => {
    if (!subscriptionData?.subscription?.grace_period_end) {
      return { isGracePeriod: false, daysRemaining: 0 };
    }
    
    try {
      const graceEnd = new Date(subscriptionData.subscription.grace_period_end).getTime();
      const now = new Date().getTime();
      const isExpired = checkExpiry();
      
      return {
        isGracePeriod: graceEnd > now && isExpired.isExpired,
        daysRemaining: Math.max(0, Math.ceil((graceEnd - now) / (1000 * 3600 * 24))),
      };
    } catch {
      return { isGracePeriod: false, daysRemaining: 0 };
    }
  }, [subscriptionData, checkExpiry]);

  // Accès
  const canAccess = useMemo((): boolean => {
    if (user?.role === 'super_admin') return true;
    if (subscriptionData?.can_access !== undefined) return subscriptionData.can_access;
    if (trialInfo.isTrial) return true;
    
    return !checkExpiry().isExpired;
  }, [user, subscriptionData, trialInfo, checkExpiry]);

  // Message d'accès
  const accessMessage = useMemo((): string | null => {
    if (canAccess) return null;
    
    if (subscriptionData?.message) {
      return subscriptionData.message;
    }
    
    if (checkExpiry().isExpired) {
      return 'Votre abonnement a expiré. Veuillez le renouveler pour continuer.';
    }
    
    return 'Accès refusé. Vérifiez votre abonnement.';
  }, [canAccess, subscriptionData, checkExpiry]);

  // Plan recommandé
  const recommendedPlan = useMemo((): SubscriptionPlan | null => {
    if (!availablePlans.length || !usageData) return null;
    
    const currentProducts = usageData.current_products || 0;
    const currentUsers = usageData.current_users || 0;
    
    return availablePlans.find(plan => {
      const maxUsers = typeof plan.max_users === 'number' ? plan.max_users : Infinity;
      const maxProducts = typeof plan.max_products === 'number' ? plan.max_products : Infinity;
      
      return currentUsers <= maxUsers && currentProducts <= maxProducts;
    }) || availablePlans[availablePlans.length - 1] || null;
  }, [availablePlans, usageData]);

  // Date formatée
  const formattedExpiryDate = useMemo((): string => {
    if (!user?.plan_expires_at) return 'Non définie';
    
    try {
      return new Date(user.plan_expires_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Date invalide';
    }
  }, [user?.plan_expires_at]);

  // ========================================
  // EFFETS
  // ========================================

  // Surveillance expiration
  useEffect(() => {
    if (!user?.plan_expires_at) return;
    
    const checkWarning = () => {
      const { daysRemaining } = checkExpiry();
      setExpiryWarning({
        show: daysRemaining <= 7 && daysRemaining > 0,
        days: daysRemaining,
      });
    };
    
    checkWarning();
    const interval = setInterval(checkWarning, 60 * 60 * 1000); // Toutes les heures
    
    return () => clearInterval(interval);
  }, [user?.plan_expires_at, checkExpiry]);

  // ========================================
  // ACTIONS
  // ========================================

  const redirectIfExpired = useCallback((): boolean => {
    if (!canAccess && user?.role !== 'super_admin') {
      navigate('/subscription', { 
        state: { 
          message: accessMessage,
          from: window.location.pathname 
        },
        replace: true
      });
      return true;
    }
    return false;
  }, [canAccess, user, navigate, accessMessage]);

  const changePlan = useCallback(async (planId: string): Promise<boolean> => {
    try {
      await changePlanMutation.mutateAsync(planId);
      return true;
    } catch {
      return false;
    }
  }, [changePlanMutation]);

  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    try {
      await cancelSubscriptionMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }, [cancelSubscriptionMutation]);

  // ========================================
  // UTILITAIRES (wrappers)
  // ========================================

  const formatMaxDisplay = useCallback(
    (value: number | "Illimité"): string => subscriptionApi.formatMaxDisplay(value),
    []
  );

  const formatRemainingText = useCallback(
    (value: number | "Illimité", singular: string, plural: string): string => 
      subscriptionApi.formatRemainingText(value, singular, plural),
    []
  );

  const isUnlimited = useCallback(
    (value: number | "Illimité"): boolean => subscriptionApi.isUnlimited(value),
    []
  );

  const getEffectiveLimit = useCallback(
    (value: number | "Illimité", unlimitedValue: number = 999999): number => 
      subscriptionApi.getEffectiveLimit(value, unlimitedValue),
    []
  );

  // ========================================
  // RETOUR
  // ========================================

  const { isExpired, daysRemaining } = checkExpiry();

  return {
    // Informations de base
    user,
    subscription: subscriptionData?.subscription || null,
    usage: usageData || null,
    isExpired,
    daysRemaining,
    plan_name: subscriptionData?.subscription?.plan_name || user?.plan_name || 'Aucun plan',
    expiryDate: user?.plan_expires_at || null,
    formattedExpiryDate,
    
    // Informations avancées
    subscriptionStatus,
    isTrial: trialInfo.isTrial,
    trialDaysRemaining: trialInfo.daysRemaining,
    isGracePeriod: gracePeriodInfo.isGracePeriod,
    gracePeriodDaysRemaining: gracePeriodInfo.daysRemaining,
    autoRenew: subscriptionData?.subscription?.auto_renew || false,
    
    // Plans
    availablePlans,
    recommendedPlan,
    
    // Factures
    invoices,
    billingHistory,
    
    // États
    isLoading: subscriptionLoading || plansLoading || usageLoading || billingLoading,
    isChangingPlan: changePlanMutation.isPending,
    isCancelling: cancelSubscriptionMutation.isPending,
    
    // Erreurs
    error: subscriptionError,
    changePlanError: changePlanMutation.error,
    
    // Accès
    canAccess,
    accessMessage,
    
    // Avertissements
    showExpiryWarning: expiryWarning.show,
    daysUntilExpiry: expiryWarning.days,
    
    // Actions
    refetch: refetchSubscription,
    refetchPlans,
    refetchInvoices: refetchBilling,
    refetchUsage,
    changePlan,
    cancelSubscription,
    redirectIfExpired,
    
    // Utilitaires
    formatMaxDisplay,
    formatRemainingText,
    isUnlimited,
    getEffectiveLimit,
    
    // Helpers
    hasActiveSubscription: subscriptionStatus === 'active' || subscriptionStatus === 'trial',
    needsSubscription: !canAccess && user?.role !== 'super_admin',
    
    // Constantes
    planLimits: PLAN_LIMITS,
  };
};

// ============================================================================
// HOOKS SPÉCIALISÉS
// ============================================================================

/**
 * Protection de routes basée sur l'abonnement
 */
export const useSubscriptionGuard = () => {
  const { canAccess, redirectIfExpired, isLoading } = useSubscription();
  
  useEffect(() => {
    if (!isLoading && !canAccess) {
      redirectIfExpired();
    }
  }, [canAccess, isLoading, redirectIfExpired]);
  
  return { canAccess, isLoading };
};

/**
 * Statistiques d'abonnement
 */
export const useSubscriptionStats = () => {
  const { subscription, invoices } = useSubscription();
  
  return useMemo(() => {
    const totalPaid = invoices.reduce((sum, inv) => 
      inv.status === 'paid' ? sum + inv.amount : sum, 0
    );
    
    const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
    const failedCount = invoices.filter(inv => inv.status === 'failed').length;
    
    return {
      totalPaid,
      pendingInvoices: pendingCount,
      failedInvoices: failedCount,
      totalInvoices: invoices.length,
      nextBillingDate: subscription?.end_date || null,
    };
  }, [subscription, invoices]);
};

export default useSubscription;