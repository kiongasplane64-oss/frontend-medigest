// hooks/useSubscription.ts
import { useAuthStore } from '@/store/useAuthStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Services
import * as subscriptionApi from '@/services/subscriptionService';

// Types
import type { 
  Plan,
  BillingHistoryResponse,
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
// HELPERS
// ============================================================================

const getPlanDescription = (planName: string): string => {
  const descriptions: Record<string, string> = {
    starter: 'Idéal pour démarrer avec les fonctionnalités essentielles',
    basic: 'Pour les petites structures avec des besoins standards',
    professional: 'Pour les professionnels ayant besoin de plus de fonctionnalités',
    pro: 'Pour les professionnels ayant besoin de plus de fonctionnalités',
    enterprise: 'Solution complète pour les grandes organisations',
    premium: 'Performance maximale et support prioritaire',
    trial: "Période d'essai pour découvrir la plateforme",
    infinite: 'Utilisateurs et produits illimités'
  };
  const key = planName?.toLowerCase() || '';
  return descriptions[key] || `Plan ${planName} avec toutes les fonctionnalités incluses`;
};

const formatDateWithTimezone = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Non définie';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date invalide';
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Date invalide';
  }
};

const calculateDaysRemaining = (endDate: string | null | undefined): number => {
  if (!endDate) return 0;
  
  try {
    const expiry = new Date(endDate);
    const now = new Date();
    
    const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return Math.max(0, Math.ceil((expiryDateOnly.getTime() - nowDateOnly.getTime()) / (1000 * 3600 * 24)));
  } catch {
    return 0;
  }
};

const isDateExpired = (endDate: string | null | undefined): boolean => {
  if (!endDate) return true;
  
  try {
    const expiry = new Date(endDate);
    const now = new Date();
    
    const expiryDateOnly = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return expiryDateOnly < nowDateOnly;
  } catch {
    return true;
  }
};

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
        const status = await subscriptionApi.getSubscription();
        const usage = await subscriptionApi.getSubscriptionUsage();
        
        const daysRemaining = calculateDaysRemaining(status.end_date);
        const isExpired = isDateExpired(status.end_date);
        
        let isTrial = status.is_trial || status.plan_name?.toLowerCase() === 'trial';
        let trialDaysRemaining = 0;
        
        if (status.trial_end_date) {
          trialDaysRemaining = calculateDaysRemaining(status.trial_end_date);
          isTrial = isTrial || trialDaysRemaining > 0;
        }
        
        const isActive = status.status === 'active' && !isExpired;
        
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
    staleTime: 5 * 60 * 1000,
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
    data: availablePlansData,
    isLoading: plansLoading,
    error: plansError,
    refetch: refetchPlans
  } = useQuery({
    queryKey: subscriptionKeys.plans(),
    queryFn: async (): Promise<SubscriptionPlan[]> => {
      try {
        console.log('🔄 Chargement des plans disponibles...');
        const plans = await subscriptionApi.getAvailablePlans(false);
        
        if (!plans || !Array.isArray(plans)) {
          console.warn('⚠️ Aucun plan disponible ou format invalide');
          return [];
        }
        
        console.log(`✅ ${plans.length} plans chargés avec succès`);
        
        return plans.map(plan => ({
          ...plan,
          is_popular: plan.is_popular || plan.name === 'professional' || plan.name === 'Pro' || plan.id === 'professional',
          description: plan.description || getPlanDescription(plan.name || plan.id),
        }));
      } catch (error) {
        console.error('❌ Erreur lors du chargement des plans:', error);
        return [];
      }
    },
    enabled: isAuthenticated,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  const availablePlans = useMemo(() => availablePlansData ?? [], [availablePlansData]);

  // Historique de facturation
  const {
    data: billingHistoryResponse,
    isLoading: billingLoading,
    refetch: refetchBilling
  } = useQuery({
    queryKey: subscriptionKeys.billing(),
    queryFn: (): Promise<BillingHistoryResponse> => subscriptionApi.getBillingHistory(50, 0),
    enabled: Boolean(isAuthenticated && subscriptionData?.subscription),
    staleTime: 10 * 60 * 1000,
  });

  const billingHistory = useMemo((): BillingHistoryResponse['billing_history'] => {
    return billingHistoryResponse?.billing_history || [];
  }, [billingHistoryResponse]);

  // ========================================
  // MUTATIONS
  // ========================================

  const changePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const plan = availablePlans.find(p => p.id === planId);
      if (!plan) throw new Error('Plan non trouvé');
      
      return subscriptionApi.updateSubscriptionWithPayment(plan);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.billing() });
      
      if (data && 'redirect' in data && data.redirect) {
        navigate('/subscription/payment', { 
          state: { plan: data.plan },
          replace: true
        });
      }
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => subscriptionApi.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
    },
  });

  // ========================================
  // MÉMOS & CALCULS
  // ========================================

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

  const subscriptionStatus = useMemo((): string => {
    if (subscriptionData?.subscription?.status) {
      return subscriptionData.subscription.status;
    }
    return user?.subscription_status || 'inactive';
  }, [subscriptionData, user]);

  const checkExpiry = useCallback((): { isExpired: boolean; daysRemaining: number } => {
    const endDate = subscriptionData?.subscription?.end_date;
    return {
      isExpired: isDateExpired(endDate),
      daysRemaining: calculateDaysRemaining(endDate),
    };
  }, [subscriptionData?.subscription?.end_date]);

  const trialInfo = useMemo(() => {
    const trialEndDate = subscriptionData?.subscription?.trial_end_date;
    if (!trialEndDate) {
      return { isTrial: false, daysRemaining: 0 };
    }
    
    const daysRemaining = calculateDaysRemaining(trialEndDate);
    const isTrial = (subscriptionData?.subscription?.is_trial || daysRemaining > 0) && daysRemaining > 0;
    
    return { isTrial, daysRemaining };
  }, [subscriptionData?.subscription?.trial_end_date, subscriptionData?.subscription?.is_trial]);

  const canAccess = useMemo((): boolean => {
    if (user?.role === 'super_admin') return true;
    if (subscriptionData?.can_access !== undefined) return subscriptionData.can_access;
    if (trialInfo.isTrial && trialInfo.daysRemaining > 0) return true;
    
    return !checkExpiry().isExpired;
  }, [user, subscriptionData, trialInfo, checkExpiry]);

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

  const formattedExpiryDate = useMemo((): string => {
    return formatDateWithTimezone(subscriptionData?.subscription?.end_date);
  }, [subscriptionData?.subscription?.end_date]);

  const formattedStartDate = useMemo((): string => {
    return formatDateWithTimezone(subscriptionData?.subscription?.start_date);
  }, [subscriptionData?.subscription?.start_date]);

  // ========================================
  // EFFETS - Alertes d'expiration
  // ========================================

  useEffect(() => {
    const { daysRemaining, isExpired } = checkExpiry();
    const { daysRemaining: trialDays, isTrial: isTrialActive } = trialInfo;
    
    let showAlert = false;
    let alertDays: number | null = null;
    let alertMessage: string | null = null;
    
    if (isTrialActive && trialDays > 0 && trialDays <= 7) {
      showAlert = true;
      alertDays = trialDays;
      alertMessage = `⚠️ Votre période d'essai se termine dans ${trialDays} jour${trialDays > 1 ? 's' : ''}. Souscrivez un abonnement pour continuer.`;
    } else if (!isExpired && daysRemaining > 0 && daysRemaining <= 7) {
      showAlert = true;
      alertDays = daysRemaining;
      alertMessage = `⏰ Votre abonnement expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Renouvelez dès maintenant !`;
    } else if (!isExpired && daysRemaining === 1) {
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

  useEffect(() => {
    if (plansError) {
      console.error('❌ Erreur lors du chargement des plans:', plansError);
    }
  }, [plansError]);

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
    billingHistoryResponse,
    
    // États
    isLoading: subscriptionLoading || plansLoading || usageLoading || billingLoading,
    isChangingPlan: changePlanMutation.isPending,
    isCancelling: cancelSubscriptionMutation.isPending,
    
    // Erreurs
    error: subscriptionError,
    plansError,
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
    if (user?.role === 'super_admin') return true;
    if (isReadOnly) return false;
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