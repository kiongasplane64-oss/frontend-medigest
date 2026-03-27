// hooks/useSubscription.ts (version améliorée)
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Services
import * as subscriptionApi from '@/services/subscriptionService';

// Types
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
    plan_type?: string;
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
    days_remaining?: number;
    is_trial?: boolean;
    trial_end_date?: string;
  };
  can_access?: boolean;
  message?: string;
  access?: {
    mode: string;
    is_read_only: boolean;
    restrictions?: any;
  };
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
    message: string | null;
  }>({ show: false, days: null, message: null });

  // ========================================
  // REQUÊTES - Utilisation de l'API correcte
  // ========================================

  // Abonnement actuel - Utiliser /status qui renvoie les infos complètes
  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionError,
    refetch: refetchSubscription
  } = useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: async (): Promise<SubscriptionResponse> => {
      try {
        // Utiliser /status qui renvoie toutes les infos de l'abonnement
        const status = await subscriptionApi.getSubscription();
        
        // Récupérer l'utilisation pour avoir les limites
        const usage = await subscriptionApi.getSubscriptionUsage();
        
        // Calculer les jours restants
        let daysRemaining = 0;
        let isTrial = false;
        let trialDaysRemaining = 0;
        
        if (status.end_date) {
          const endDate = new Date(status.end_date);
          const now = new Date();
          daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24)));
        }
        
        if (status.trial_end_date) {
          const trialEnd = new Date(status.trial_end_date);
          const now = new Date();
          trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 3600 * 24)));
          isTrial = status.is_trial || trialDaysRemaining > 0;
        }
        
        const isActive = status.status === 'active' && daysRemaining > 0;
        
        return {
          subscription: {
            ...status,
            days_remaining: daysRemaining,
            is_trial: isTrial,
            current_usage: usage.current_products,
            max_products: usage.max_products,
          },
          can_access: isActive || (isTrial && trialDaysRemaining > 0),
          access: {
            mode: isActive ? 'full' : 'read_only',
            is_read_only: !isActive,
            restrictions: !isActive ? {
              can_view: true,
              can_create: false,
              can_update: false,
              can_delete: false,
              can_export: true,
              max_items_visible: 100,
              message: "Mode lecture seule : vous pouvez consulter les données mais pas les modifier."
            } : null
          }
        };
      } catch (error) {
        console.error('Erreur lors de la récupération de l\'abonnement:', error);
        throw error;
      }
    },
    enabled: Boolean(isAuthenticated && user?.id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    gcTime: 10 * 60 * 1000,
  });

  // Utilisation
  const {
    data: usageData,
    isLoading: usageLoading,
    refetch: refetchUsage
  } = useQuery({
    queryKey: subscriptionKeys.usage(),
    queryFn: (): Promise<SubscriptionUsage> => subscriptionApi.getSubscriptionUsage(),
    enabled: Boolean(isAuthenticated),
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
    staleTime: 30 * 60 * 1000,
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
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.billing() });
      
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
    const endDate = subscriptionData?.subscription?.end_date;
    if (!endDate) {
      return { isExpired: true, daysRemaining: 0 };
    }
    
    try {
      const expiry = new Date(endDate).getTime();
      const now = new Date().getTime();
      const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 3600 * 24)));
      
      return {
        isExpired: expiry < now,
        daysRemaining,
      };
    } catch {
      return { isExpired: true, daysRemaining: 0 };
    }
  }, [subscriptionData?.subscription?.end_date]);

  // Trial
  const trialInfo = useMemo(() => {
    const trialEndDate = subscriptionData?.subscription?.trial_end_date;
    if (!trialEndDate) {
      return { isTrial: false, daysRemaining: 0 };
    }
    
    try {
      const trialEnd = new Date(trialEndDate).getTime();
      const now = new Date().getTime();
      const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 3600 * 24)));
      
      return {
        isTrial: subscriptionData.subscription?.is_trial || daysRemaining > 0,
        daysRemaining,
      };
    } catch {
      return { isTrial: false, daysRemaining: 0 };
    }
  }, [subscriptionData?.subscription?.trial_end_date, subscriptionData?.subscription?.is_trial]);

  // Accès
  const canAccess = useMemo((): boolean => {
    if (user?.role === 'super_admin') return true;
    if (subscriptionData?.can_access !== undefined) return subscriptionData.can_access;
    if (trialInfo.isTrial && trialInfo.daysRemaining > 0) return true;
    
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
    
    if (trialInfo.isTrial && trialInfo.daysRemaining <= 0) {
      return 'Votre période d\'essai est terminée. Souscrivez un abonnement pour continuer.';
    }
    
    return 'Accès refusé. Vérifiez votre abonnement.';
  }, [canAccess, subscriptionData, checkExpiry, trialInfo]);

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
    const endDate = subscriptionData?.subscription?.end_date;
    if (!endDate) return 'Non définie';
    
    try {
      return new Date(endDate).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Date invalide';
    }
  }, [subscriptionData?.subscription?.end_date]);

  // Formatted start date
  const formattedStartDate = useMemo((): string => {
    const startDate = subscriptionData?.subscription?.start_date;
    if (!startDate) return 'Non définie';
    
    try {
      return new Date(startDate).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Date invalide';
    }
  }, [subscriptionData?.subscription?.start_date]);

  // ========================================
  // EFFETS - Alertes d'expiration
  // ========================================

  // Surveillance expiration et affichage des alertes
  useEffect(() => {
    const { daysRemaining, isExpired } = checkExpiry();
    const { daysRemaining: trialDays, isTrial: isTrialActive } = trialInfo;
    
    let showAlert = false;
    let alertDays: number | null = null;
    let alertMessage: string | null = null;
    
    // Priorité aux alertes d'essai
    if (isTrialActive && trialDays > 0 && trialDays <= 7) {
      showAlert = true;
      alertDays = trialDays;
      alertMessage = `⚠️ Votre période d'essai se termine dans ${trialDays} jour${trialDays > 1 ? 's' : ''}. Souscrivez un abonnement pour continuer.`;
    }
    // Sinon alerte d'expiration d'abonnement
    else if (!isExpired && daysRemaining > 0 && daysRemaining <= 7) {
      showAlert = true;
      alertDays = daysRemaining;
      alertMessage = `⏰ Votre abonnement expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Renouvelez dès maintenant !`;
    }
    // Alerte d'expiration imminente (1 jour)
    else if (!isExpired && daysRemaining === 1) {
      showAlert = true;
      alertDays = 1;
      alertMessage = `🚨 DERNIER JOUR ! Votre abonnement expire aujourd'hui. Renouvelez immédiatement pour ne pas perdre l'accès.`;
    }
    
    setExpiryWarning({
      show: showAlert,
      days: alertDays,
      message: alertMessage,
    });
  }, [checkExpiry, trialInfo]);

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
  // UTILITAIRES
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
    plan_type: subscriptionData?.subscription?.plan_type || 'free',
    expiryDate: subscriptionData?.subscription?.end_date || null,
    startDate: subscriptionData?.subscription?.start_date || null,
    formattedExpiryDate,
    formattedStartDate,
    price: subscriptionData?.subscription?.price || 0,
    billingCycle: subscriptionData?.subscription?.billing_cycle || 'monthly',
    autoRenew: subscriptionData?.subscription?.auto_renew || false,
    
    // Informations avancées
    subscriptionStatus,
    isTrial: trialInfo.isTrial,
    trialDaysRemaining: trialInfo.daysRemaining,
    accessMode: subscriptionData?.access?.mode || (canAccess ? 'full' : 'read_only'),
    isReadOnly: subscriptionData?.access?.is_read_only || !canAccess,
    accessRestrictions: subscriptionData?.access?.restrictions,
    
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
    expiryWarningMessage: expiryWarning.message,
    
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
    hasActiveSubscription: subscriptionStatus === 'active' && !isExpired,
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
  const { canAccess, redirectIfExpired, isLoading, isReadOnly, accessRestrictions } = useSubscription();
  
  useEffect(() => {
    if (!isLoading && !canAccess) {
      redirectIfExpired();
    }
  }, [canAccess, isLoading, redirectIfExpired]);
  
  return { 
    canAccess, 
    isLoading, 
    isReadOnly,
    restrictions: accessRestrictions 
  };
};

/**
 * Hook pour vérifier les permissions d'écriture
 */
export const useWritePermission = () => {
  const { isReadOnly, canAccess, user } = useSubscription();
  
  const canWrite = useCallback((): boolean => {
    // Super admin a toujours accès
    if (user?.role === 'super_admin') return true;
    // Lecture seule = pas d'écriture
    if (isReadOnly) return false;
    // Accès complet autorisé
    return canAccess;
  }, [isReadOnly, canAccess, user]);
  
  const checkWritePermission = useCallback((action: string): boolean => {
    const hasWrite = canWrite();
    if (!hasWrite) {
      console.warn(`Action "${action}" bloquée : mode lecture seule actif`);
    }
    return hasWrite;
  }, [canWrite]);
  
  return { canWrite, checkWritePermission };
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